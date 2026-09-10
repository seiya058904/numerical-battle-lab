'use strict';
// Causal variance decomposition of the same-tier mechanism spread (V7).
//
// Question (user decision gate, round 3): of the ~6.3 theta same-tier spread on
// unsolved cards, how much comes from randomly drawn action scalar numbers vs
// real mechanic topology?
//
//   C0  original unsolved cards                                  (baseline)
//   C1  normalize scheduling only: cost/cooldown/priority of the random slots
//       are replaced by per-slot medians (everything else untouched)
//   C2  normalize magnitudes only: damage/heal/barrier coefficients, drainRatio,
//       gain amounts, action accuracy and status chance are replaced by per-slot
//       medians (mechanic type and scheduling untouched)
//   C3  C1 + C2
//   C4  deterministic permutation of the scalar parameter bundles across cards
//       (card i receives the bundle of card (i+1) mod 96, slot by slot, keeping
//       the skeleton); tests whether strength ranking follows the bundle
//
// All variants share the SAME edge list and the SAME paired match seeds, so the
// comparison is paired. Mechanism families / action counts / effect topology /
// triggers / statuses / targets / damage types are never changed.
//
// Usage:
//   node scripts/experiment-v7-attribution.js run <C0|C1|C2|C3|C4> [cards=96] [opponents=8] [seeds=3]
//   node scripts/experiment-v7-attribution.js aggregate [cards=96] [opponents=8] [seeds=3]
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const {emptyBattleCounts,addBattleCounts,scoreMirroredPair}=require(path.join(ROOT,'src/strength-audit-v6.js'));
const {fitBradleyTerryV7}=require(path.join(ROOT,'src/empirical-strength-v7.js'));
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7','battlepower-v4'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB;

const mode=process.argv[2];
const CARDS=Number(process.argv[4]||96);
const OPPONENTS=Number(process.argv[5]||8);
const PAIRED_SEEDS=Number(process.argv[6]||3);
const LEVEL=50,RARITY='A',ROUND_CAP=100;
const VARIANT=mode==='run'?process.argv[3]:null;

const stableHash=text=>crypto.createHash('sha256').update(String(text)).digest('hex').slice(0,16);
const quantile=(values,q)=>{const sorted=values.slice().sort((a,b)=>a-b),p=(sorted.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return sorted[lo]+(sorted[hi]-sorted[lo])*(p-lo);};
const mean=values=>values.reduce((sum,value)=>sum+value,0)/Math.max(1,values.length);
const pearson=(a,b)=>{const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;n+=x*y;da+=x*x;db+=y*y;}return da&&db?n/Math.sqrt(da*db):0;};
const rank=values=>{const sorted=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value);const ranks=Array(values.length);for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j].value===sorted[i].value)j++;const r=(i+j-1)/2;for(let k=i;k<j;k++)ranks[sorted[k].index]=r;i=j;}return ranks;};
const spearman=(a,b)=>pearson(rank(a),rank(b));

// ---------- population (unsolved base cards, single tier) ----------
const population=[];
for(let i=0;i<CARDS;i++){
  const seed=`v7-mech-${i}`;
  const genome=N.styleGenomeV7(seed),skeleton=N.mechanicSkeletonV7(seed);
  const card=N.buildUnsolvedCardV7(seed,RARITY,LEVEL,skeleton,genome);
  card.name=seed;card.displayName=seed;
  const dominant=Object.entries(genome).sort((a,b)=>b[1]-a[1])[0][0];
  population.push({card,seed,style:dominant,victoryPath:skeleton.victoryPath,resource:skeleton.resource,
    triggerEvent:skeleton.triggerEvent,damageType:skeleton.damageType,family:`${skeleton.victoryPath}|${skeleton.resource}`});
}

// ---------- slot model: identify structurally fixed vs randomly drawn params ----------
// V7 gen-v7 action construction: every non-backbone action first draws
// cost=1+random(5), cooldown=1+random(4), priority=random(5)-2, then the family
// case may override some of them. Slots are (name, occurrence ordinal).
const FIXED_SCHEDULING={ // fields that are structurally fixed per family (never random)
  '基础攻势':['cost','cooldown','priority'],
  '压制':['cost','cooldown'],        // cost=0, cooldown=2 fixed; priority is random
  '屏障':['cost','cooldown'],
  '再生':['cost','cooldown'],
  '裂变突袭':['cooldown'],           // cooldown=3 fixed; cost/priority random
  '先制':['cooldown','priority'],    // cooldown=1, priority genome-derived; cost random
};
const RANDOM_MAGNITUDE_NAMES=new Set(['精确打击','压制','屏障','再生','裂变突袭','先制','汲取','蓄能轰击','蚀印扩散','反射架势']);

function slotKeyOf(action,indexInName){return `${action.name}#${indexInName}`;}
function slotsOf(card){
  const seen={},out=[];
  for(const action of card.actions||[]){
    const ordinal=seen[action.name]=(seen[action.name]||0)+1;
    out.push({action,slot:slotKeyOf(action,ordinal),ordinal});
  }
  return out;
}
// collect per-slot scalar values across the C0 population (median source)
function collectScalars(){
  const scheduling={},magnitudes={};
  for(const entry of population){
    for(const {action,slot} of slotsOf(entry.card)){
      const fixed=FIXED_SCHEDULING[action.name]||[];
      for(const field of ['cost','cooldown','priority']){
        if(fixed.includes(field))continue;
        (scheduling[`${slot}.${field}`]=scheduling[`${slot}.${field}`]||[]).push(Number(action[field]));
      }
      if(!RANDOM_MAGNITUDE_NAMES.has(action.name))continue;
      if(action.accuracy!==undefined)(magnitudes[`${slot}.accuracy`]=magnitudes[`${slot}.accuracy`]||[]).push(Number(action.accuracy));
      walkMagnitudes(action.effects,(key,value)=>{(magnitudes[`${slot}.${key}`]=magnitudes[`${slot}.${key}`]||[]).push(value);});
    }
  }
  return {scheduling,magnitudes};
}
function walkMagnitudes(effects,emit,path=''){
  for(let index=0;index<(effects||[]).length;index++){
    const effect=effects[index];
    const key=path?`${path}[${index}]`:String(index);
    if(effect.type==='damage'&&typeof effect.formula==='string'&&/^ATK \* [\d.]+$/.test(effect.formula))emit(`damage.${key}`,parseFloat(effect.formula.slice(6)));
    if((effect.type==='heal'||effect.type==='shield'||effect.type==='ward')&&typeof effect.formula==='string'&&/^MAX_HP \* [\d.]+$/.test(effect.formula))emit(`magnitude.${key}`,parseFloat(effect.formula.slice(8)));
    if(effect.drainRatio!==undefined)emit(`drainRatio.${key}`,Number(effect.drainRatio));
    if(effect.type==='gain'&&effect.amount!==undefined)emit(`gain.${key}`,Number(effect.amount));
    if(effect.chance!==undefined)emit(`chance.${key}`,Number(effect.chance));
    if(effect.effects)walkMagnitudes(effect.effects,emit,key);
  }
}
const median=values=>{if(!values.length)return null;const sorted=values.slice().sort((a,b)=>a-b),n=sorted.length;return n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2;};

// ---------- variants ----------
function buildVariantCards(variant,scalars){
  return population.map(entry=>{
    const card=JSON.parse(JSON.stringify(entry.card));
    const slots=slotsOf(card);
    for(const {action,slot} of slots){
      const fixed=FIXED_SCHEDULING[action.name]||[];
      if(variant==='C1'||variant==='C3'){
        for(const field of ['cost','cooldown','priority']){
          if(fixed.includes(field))continue;
          const m=median(scalars.scheduling[`${slot}.${field}`]);
          if(m!==null)action[field]=Math.round(m);
        }
      }
      if(variant==='C2'||variant==='C3'){
        if(RANDOM_MAGNITUDE_NAMES.has(action.name)){
          if(action.accuracy!==undefined){const m=median(scalars.magnitudes[`${slot}.accuracy`]);if(m!==null)action.accuracy=m;}
          walkMagnitudes(action.effects,(key,value)=>{
            const m=median(scalars.magnitudes[`${slot}.${key}`]);
            if(m===null)return;
            applyMagnitude(action.effects,key,m);
          });
        }
      }
      if(variant==='C4'){
        const donor=population[(entry.seedIndex+1)%CARDS];
        // transplant the donor's scalar fields for this slot (keep skeleton/effects structure)
        const donorSlots=slotsOf(donor.card).find(s=>s.slot===slot);
        if(!donorSlots)continue;
        const donorAction=donorSlots.action;
        for(const field of ['cost','cooldown','priority'])if(!fixed.includes(field))action[field]=donorAction[field];
        if(RANDOM_MAGNITUDE_NAMES.has(action.name)){
          if(action.accuracy!==undefined)action.accuracy=donorAction.accuracy;
          transplantMagnitudes(action.effects,donorAction.effects);
        }
      }
    }
    return {card,entry};
  });
}
function applyMagnitude(effects,key,value){
  const parts=key.split(/[\[\]]+/).filter(Boolean);
  let node=effects;
  for(let i=0;i<parts.length-1;i++)node=node[Number(parts[i])];
  const effect=node[Number(parts[parts.length-1])];
  const kind=parts[0];
  if(kind==='damage')effect.formula=`ATK * ${value}`;
  else if(kind==='magnitude')effect.formula=`MAX_HP * ${value}`;
  else if(kind==='drainRatio')effect.drainRatio=value;
  else if(kind==='gain')effect.amount=value;
  else if(kind==='chance')effect.chance=value;
}
function transplantMagnitudes(targetEffects,sourceEffects){
  const walk=(t,s,path='')=>{
    for(let index=0;index<(t||[]).length&&index<(s||[]).length;index++){
      const te=t[index],se=s[index];
      const key=path?`${path}[${index}]`:String(index);
      if(te.type==='damage'&&typeof te.formula==='string'&&/^ATK \* [\d.]+$/.test(te.formula))te.formula=`ATK * ${parseFloat(se.formula.slice(6))}`;
      if((te.type==='heal'||te.type==='shield'||te.type==='ward')&&typeof te.formula==='string'&&/^MAX_HP \* [\d.]+$/.test(te.formula))te.formula=`MAX_HP * ${parseFloat(se.formula.slice(8))}`;
      if(te.drainRatio!==undefined)te.drainRatio=se.drainRatio;
      if(te.type==='gain'&&te.amount!==undefined)te.amount=se.amount;
      if(te.chance!==undefined)te.chance=se.chance;
      if(te.effects)walk(te.effects,se.effects,key);
    }
  };
  walk(targetEffects,sourceEffects);
}

// ---------- shared graph + battle runner ----------
function buildEdges(){
  const ids=population.map(entry=>entry.card.id),pairs=new Map();
  const add=(i,j)=>{if(i===j)return;const a=Math.min(i,j),b=Math.max(i,j),key=a+'|'+b;if(!pairs.has(key))pairs.set(key,{a:ids[a],b:ids[b]});};
  const steps=[1,2,3,5,7,11,17,23,29,37,43,53];
  for(let i=0;i<ids.length;i++)for(let s=0;s<Math.min(OPPONENTS,steps.length);s++)add(i,(i+steps[s])%ids.length);
  return [...pairs.values()];
}
const edges=buildEdges();

function runVariant(variant){
  // seed index attached for C4 donor mapping
  population.forEach((entry,index)=>{entry.seedIndex=index;});
  const scalars=collectScalars();
  const variantCards=buildVariantCards(variant,scalars);
  const byId=new Map(variantCards.map(({card})=>[card.id,card]));
  function fight(a,b,seed){
    N.deployCard(a);N.deployCard(b);
    const engine=N.createBattle({seed:N.deriveSeed(seed),teamA:[a.id],teamB:[b.id],maxRounds:ROUND_CAP});
    let guard=0;while(!engine.outcome().ended&&guard++<ROUND_CAP*2+40)engine.resolveRound([...N.planAI(engine,'A','canonical'),...N.planAI(engine,'B','canonical')]);
    const winner=engine.outcome().winner;return winner==='A'?1:winner==='B'?-1:0;
  }
  const scored=[];
  for(let index=0;index<edges.length;index++){
    const edge=edges[index],a=byId.get(edge.a),b=byId.get(edge.b),counts=emptyBattleCounts();
    for(let k=0;k<PAIRED_SEEDS;k++)addBattleCounts(counts,scoreMirroredPair(a,b,650000+index*131+k*17,fight));
    scored.push({...edge,winsA:counts.higherWins,winsB:counts.lowerWins,draws:counts.draws,battles:counts.battleCount});
  }
  const ids=population.map(entry=>entry.card.id);
  const fit=fitBradleyTerryV7(ids,scored.map(edge=>({a:edge.a,b:edge.b,winsA:edge.winsA,winsB:edge.winsB,draws:edge.draws})));
  const contentHash=stableHash(JSON.stringify(population.map(entry=>({id:entry.card.id,stats:entry.card.stats,actions:entry.card.actions}))));
  const artifact={schemaVersion:1,generatorVersion:7,variant,methodology:{cards:CARDS,opponentsPerCard:OPPONENTS,pairedMatchSeeds:PAIRED_SEEDS,edges:scored.length,battles:scored.reduce((sum,e)=>sum+e.battles,0),mirroredSides:true,canonicalAI:true,roundCap:ROUND_CAP,level:LEVEL,rarity:RARITY,sharedGraph:true,sharedMatchSeeds:true},
    contentHash,fit:{converged:fit.converged,logLoss:fit.logLoss,games:fit.games},
    cards:population.map(entry=>({id:entry.card.id,seed:entry.seed,seedIndex:entry.seedIndex,victoryPath:entry.victoryPath,resource:entry.resource,family:entry.family,
      rawTheta:fit.theta[entry.card.id],standardError:fit.standardError[entry.card.id],
      games:scored.filter(edge=>edge.a===entry.card.id||edge.b===entry.card.id).reduce((sum,e)=>sum+e.battles,0)})),
    edges:scored};
  const output=path.join(ROOT,`qa/v7-attribution-${variant}.json`);
  fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');
  const thetas=artifact.cards.map(card=>card.rawTheta);
  console.log(JSON.stringify({variant,cards:CARDS,edges:scored.length,battles:artifact.methodology.battles,converged:fit.converged,
    spread:+(quantile(thetas,.95)-quantile(thetas,.05)).toFixed(3),p5:+quantile(thetas,.05).toFixed(3),p95:+quantile(thetas,.95).toFixed(3)},null,2));
}

if(mode==='run'&&VARIANT)runVariant(VARIANT);
else if(mode==='aggregate')aggregate();

function aggregate(){
  const variants={};
  for(const variant of ['C0','C1','C2','C3','C4']){
    const artifact=JSON.parse(fs.readFileSync(path.join(ROOT,`qa/v7-attribution-${variant}.json`),'utf8'));
    if(artifact.cards.length!==CARDS)throw new Error(`attribution artifact mismatch for ${variant}`);
    variants[variant]=artifact;
  }
  const thetaOf=(variant,id)=>variants[variant].cards.find(card=>card.id===id).rawTheta;
  const ids=variants.C0.cards.map(card=>card.id);
  const variance=values=>{const m=mean(values);return mean(values.map(v=>(v-m)**2));};
  const spread=values=>quantile(values,.95)-quantile(values,.05);
  const c0=ids.map(id=>thetaOf('C0',id));
  const byFamily=new Map();
  for(const card of variants.C0.cards){(byFamily.get(card.family)||byFamily.set(card.family,[]).get(card.family)).push(card.rawTheta);}
  const familyStats=Object.fromEntries([...byFamily].sort().map(([family,values])=>[family,{count:values.length,mean:mean(values),withinVariance:variance(values)}]));
  const familyMeansOf=variant=>Object.fromEntries([...byFamily].sort().map(([family,values])=>{
    const valuesIn=ids.map(id=>{const c=variants[variant].cards.find(c=>c.id===id);return c.family===family?c.rawTheta:null}).filter(v=>v!==null);
    return [family,{count:values.length,mean:valuesIn.length?mean(valuesIn):null}];
  }));
  const withinFamilyVarianceOf=variant=>mean([...byFamily].map(([family])=>{
    const valuesIn=ids.map(id=>{const c=variants[variant].cards.find(c=>c.id===id);return c.family===family?c.rawTheta:null}).filter(v=>v!==null);
    return valuesIn.length>1?variance(valuesIn):0;
  }));
  const rows={};
  for(const variant of ['C1','C2','C3','C4']){
    const values=ids.map(id=>thetaOf(variant,id));
    rows[variant]={spread:spread(values),p5:quantile(values,.05),p95:quantile(values,.95),variance:variance(values),
      spearmanWithC0:spearman(c0,values),
      varianceReduction:1-variance(values)/Math.max(1e-12,variance(c0)),
      spreadReduction:1-spread(values)/Math.max(1e-12,spread(c0)),
      familyMeans:familyMeansOf(variant),
      withinFamilyVariance:withinFamilyVarianceOf(variant)};
  }
  // C4 donor tracking: card i received the bundle of donor (i+1) mod N; if the
  // bundles carry strength, C4 ranking should follow the DONOR's C0 ranking.
  const donorMap=new Map(variants.C4.cards.map(card=>[card.id,ids[(card.seedIndex+1)%CARDS]]));
  const c4Values=ids.map(id=>thetaOf('C4',id));
  const donorC0=ids.map(id=>thetaOf('C0',donorMap.get(id)));
  rows.C4.spearmanWithDonorC0=spearman(c4Values,donorC0);
  rows.C4.selfC0=spearman(c4Values,c0);
  const attribution={scheduling:rows.C1.varianceReduction,magnitude:rows.C2.varianceReduction,both:rows.C3.varianceReduction,
    remainingTopology:1-rows.C3.varianceReduction,
    note:'variance-reduction attribution is non-additive; remaining = 1 - C3 reduction (topology + interactions + noise)'};
  const artifact={schemaVersion:1,generatorVersion:7,methodology:variants.C0.methodology,
    decisionGate:{c3SpreadReduction:rows.C3.spreadReduction,interpretation:rows.C3.spreadReduction>=.6?'>=60%: action scalar numbers are the dominant cause; action-solver prototype permitted':rows.C3.spreadReduction<=.4?'<=40%: hypothesis not supported; continue Mechanism-Aware StrengthModel':rows.C3.spreadReduction>=.4&&rows.C3.spreadReduction<.6?'40-60%: mixed cause; decompose availability/magnitude/topology further':''},
    c0:{spread:spread(c0),p5:quantile(c0,.05),p95:quantile(c0,.95),variance:variance(c0),familyMeans:familyStats},
    variants:rows,attribution};
  fs.writeFileSync(path.join(ROOT,'qa/v7-scheduling-magnitude-attribution.json'),JSON.stringify(artifact,null,2)+'\n');
  console.log(JSON.stringify({c0:{spread:+spread(c0).toFixed(3)},variants:Object.fromEntries(Object.entries(rows).map(([v,r])=>[v,{spread:+r.spread.toFixed(3),varianceReduction:+r.varianceReduction.toFixed(3),spreadReduction:+r.spreadReduction.toFixed(3),spearmanWithC0:+r.spearmanWithC0.toFixed(3),...(v==='C4'?{spearmanWithDonorC0:+r.spearmanWithDonorC0.toFixed(3)}:{})}])),attribution,decisionGate:artifact.decisionGate.interpretation},null,2));
}
