'use strict';
// Mechanism Ranking Diagnostic + Dataset (V7).
//
// Root cause B: StrengthModelV7's cross-mechanism predicted spread (1.11 theta)
// is far below the real battle spread (3.35 theta) with a Spearman of -0.046, so
// the iso-power solver optimises an objective that does not track reality.
//
// This script builds the offline truth needed to fix that:
//   * a deterministic population of UNSOLVED base cards at a canonical neutral
//     tier (Lv50 A), so Level and Rarity are held constant and only the mechanic
//     skeleton / style genome differ;
//   * a balanced sparse mirrored battle graph over that population with several
//     paired Match Seeds, fitted with the existing Bradley-Terry implementation
//     into MechanismEmpiricalTheta (offline calibration only — never runtime);
//   * a mechanism-family split (family = victoryPath|resource) so whole
//     mechanism groups are held out of train;
//   * metrics for any candidate model: Spearman, spread ratio, pairwise
//     direction accuracy for |delta| >= 1.
//
// Battle labels depend only on the GENERATOR, not on the model, so they are
// cached (qa/v7-mechanism-labels.json) keyed by a content hash and reused across
// model iterations. Pass --rebuild-labels to force a rebuild.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const {emptyBattleCounts,addBattleCounts,scoreMirroredPair}=require(path.join(ROOT,'src/strength-audit-v6.js'));
const {fitBradleyTerryV7}=require(path.join(ROOT,'src/empirical-strength-v7.js'));
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7','battlepower-v4'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB;

const CARDS=Number(process.argv[2]||48);
const OPPONENTS=Number(process.argv[3]||10);
const PAIRED_SEEDS=Number(process.argv[4]||3);
const LEVEL=50,RARITY='A',ROUND_CAP=100;
const LABELS=path.join(ROOT,'qa/v7-mechanism-labels.json');
const OUTPUT=path.join(ROOT,'qa/v7-mechanism-ranking.json');

const mean=values=>values.reduce((sum,value)=>sum+value,0)/Math.max(1,values.length);
const quantile=(values,q)=>{const sorted=values.slice().sort((a,b)=>a-b),position=(sorted.length-1)*q,lower=Math.floor(position),upper=Math.ceil(position);return sorted[lower]+(sorted[upper]-sorted[lower])*(position-lower);};
const pearson=(a,b)=>{const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;n+=x*y;da+=x*x;db+=y*y;}return n/Math.sqrt(da*db);};
const rank=values=>{const sorted=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value);const ranks=Array(values.length);for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j].value===sorted[i].value)j++;const r=(i+j-1)/2;for(let k=i;k<j;k++)ranks[sorted[k].index]=r;i=j;}return ranks;};
const spearman=(a,b)=>pearson(rank(a),rank(b));
const stableHash=text=>crypto.createHash('sha256').update(String(text)).digest('hex').slice(0,16);

// ---- population (unsolved base cards, single tier) ----
const population=[];
for(let i=0;i<CARDS;i++){
  const seed=`v7-mech-${i}`;
  const genome=N.styleGenomeV7(seed),skeleton=N.mechanicSkeletonV7(seed);
  const card=N.buildUnsolvedCardV7(seed,RARITY,LEVEL,skeleton,genome);
  card.name=seed;card.displayName=seed;
  const dominant=Object.entries(genome).sort((a,b)=>b[1]-a[1])[0][0];
  population.push({card,seed,style:dominant,victoryPath:skeleton.victoryPath,resource:skeleton.resource,
    triggerEvent:skeleton.triggerEvent,damageType:skeleton.damageType,
    family:`${skeleton.victoryPath}|${skeleton.resource}`});
}
const contentHash=stableHash(JSON.stringify(population.map(row=>({id:row.card.id,stats:row.card.stats,actions:row.card.actions,triggers:row.card.triggers,statuses:row.card.statuses}))));

// ---- balanced sparse graph (connected, deterministic, model-independent) ----
function buildEdges(){
  const ids=population.map(row=>row.card.id),pairs=new Map();
  const add=(i,j)=>{
    if(i===j)return;
    const a=Math.min(i,j),b=Math.max(i,j),key=a+'|'+b;
    if(pairs.has(key))return;
    pairs.set(key,{a:ids[a],b:ids[b]});
  };
  const steps=[1,2,3,5,7,11,17,23,29,37,43,53,67,79,89,97];
  for(let i=0;i<ids.length;i++)for(let s=0;s<Math.min(OPPONENTS,steps.length);s++)add(i,(i+steps[s])%ids.length);
  return [...pairs.values()];
}
const edges=buildEdges();

let labels=null;
const force=process.argv.includes('--rebuild-labels');
if(!force&&fs.existsSync(LABELS)){
  const cached=JSON.parse(fs.readFileSync(LABELS,'utf8'));
  if(cached.contentHash===contentHash&&cached.cards.length===CARDS&&cached.edges.length===edges.length&&cached.methodology.pairedMatchSeeds===PAIRED_SEEDS)labels=cached;
}
if(!labels){
  function fight(a,b,seed){
    N.deployCard(a);N.deployCard(b);
    const engine=N.createBattle({seed:N.deriveSeed(seed),teamA:[a.id],teamB:[b.id],maxRounds:ROUND_CAP});
    let guard=0;while(!engine.outcome().ended&&guard++<ROUND_CAP*2+40)engine.resolveRound([...N.planAI(engine,'A','canonical'),...N.planAI(engine,'B','canonical')]);
    const winner=engine.outcome().winner;return winner==='A'?1:winner==='B'?-1:0;
  }
  const byId=new Map(population.map(row=>[row.card.id,row.card]));
  const scored=[];
  let index=0;
  for(const edge of edges){
    const a=byId.get(edge.a),b=byId.get(edge.b),counts=emptyBattleCounts();
    for(let k=0;k<PAIRED_SEEDS;k++)addBattleCounts(counts,scoreMirroredPair(a,b,650000+index*131+k*17,fight));
    scored.push({...edge,winsA:counts.higherWins,winsB:counts.lowerWins,draws:counts.draws,teamAWins:counts.teamAWins,teamBWins:counts.teamBWins,battles:counts.battleCount});
    index++;
  }
  const ids=population.map(row=>row.card.id);
  const fit=fitBradleyTerryV7(ids,scored.map(edge=>({a:edge.a,b:edge.b,winsA:edge.winsA,winsB:edge.winsB,draws:edge.draws})));
  labels={schemaVersion:1,contentHash,methodology:{cards:CARDS,opponentsPerCard:OPPONENTS,pairedMatchSeeds:PAIRED_SEEDS,edges:scored.length,battles:scored.reduce((sum,edge)=>sum+edge.battles,0),mirroredSides:true,canonicalAI:true,roundCap:ROUND_CAP,level:LEVEL,rarity:RARITY,fit:'regularized Bradley-Terry'},
    fit:{converged:fit.converged,logLoss:fit.logLoss,games:fit.games},
    cards:population.map(row=>({id:row.card.id,seed:row.seed,style:row.style,victoryPath:row.victoryPath,resource:row.resource,triggerEvent:row.triggerEvent,damageType:row.damageType,family:row.family,
      rawTheta:fit.theta[row.card.id],standardError:fit.standardError[row.card.id],
      games:scored.filter(edge=>edge.a===row.card.id||edge.b===row.card.id).reduce((sum,edge)=>sum+edge.battles,0)})),
    edges:scored};
  fs.writeFileSync(LABELS,JSON.stringify(labels,null,2)+'\n');
  console.log(`labels rebuilt: ${labels.methodology.battles} battles over ${labels.methodology.edges} edges (${path.relative(ROOT,LABELS)})`);
}else{
  console.log(`labels reused: ${labels.methodology.battles} battles over ${labels.methodology.edges} edges`);
}

// ---- split by mechanism family (whole groups held out) ----
const families=[...new Set(labels.cards.map(card=>card.family))].sort();
const trainFamilies=[],validationFamilies=[],testFamilies=[];
families.forEach((family,index)=>{
  const bucket=index%20;
  if(bucket<14)trainFamilies.push(family);else if(bucket<17)validationFamilies.push(family);else testFamilies.push(family);
});
const familyOf=new Map(labels.cards.map(card=>[card.id,card.family]));
const splitOf=id=>trainFamilies.includes(familyOf.get(id))?'train':validationFamilies.includes(familyOf.get(id))?'validation':'test';

// ---- candidate model evaluation ----
const thetaById=new Map(labels.cards.map(card=>[card.id,card.rawTheta]));
const modelById=new Map();
for(const row of population){
  const id=row.card.id;
  modelById.set(id,{id,predictTheta:N.predictThetaV7(row.card),predictReality:N.predictRealityThetaV7(row.card),
    generalPower:N.strengthFeaturesV7(row.card).generalPower,
    bpv4:N.battlePowerV4(row.card).predictedTheta,bpv4Power:N.battlePowerV4(row.card).power});
}
function metricsFor(ids,valueOf){
  const empirical=ids.map(id=>thetaById.get(id)),predicted=ids.map(id=>valueOf(modelById.get(id)));
  const pairs=[];
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)pairs.push({dEmp:thetaById.get(ids[i])-thetaById.get(ids[j]),dPre:valueOf(modelById.get(ids[i]))-valueOf(modelById.get(ids[j]))});
  const large=pairs.filter(pair=>Math.abs(pair.dEmp)>=1&&Math.abs(pair.dPre)>1e-9);
  const spread=values=>quantile(values,.95)-quantile(values,.05);
  return {count:ids.length,
    spearman:ids.length>3?spearman(predicted,empirical):null,
    pearson:ids.length>3?pearson(predicted,empirical):null,
    predictedSpread:ids.length>3?spread(predicted):null,
    realSpread:ids.length>3?spread(empirical):null,
    largeGapPairs:large.length,
    pairwiseDirectionAccuracy:large.length?large.filter(pair=>Math.sign(pair.dEmp)===Math.sign(pair.dPre)).length/large.length:null};
}
const allIds=labels.cards.map(card=>card.id);
const modelCandidates={predictTheta:row=>row.predictTheta,predictRealityTheta:row=>row.predictReality,battlePowerV4:row=>row.bpv4};
const results={};
for(const [name,valueOf] of Object.entries(modelCandidates)){
  const overall=metricsFor(allIds,valueOf);
  results[name]={overall,train:metricsFor(allIds.filter(id=>splitOf(id)==='train'),valueOf),validation:metricsFor(allIds.filter(id=>splitOf(id)==='validation'),valueOf),test:metricsFor(allIds.filter(id=>splitOf(id)==='test'),valueOf)};
  if(overall.predictedSpread!==null&&overall.realSpread)results[name].spreadRatio=overall.predictedSpread/overall.realSpread;
}
const empiricalAll=allIds.map(id=>thetaById.get(id));
const artifact={schemaVersion:1,generatorVersion:7,methodology:labels.methodology,
  split:{train:trainFamilies.length,validation:validationFamilies.length,test:testFamilies.length,
    trainFamilies,validationFamilies,testFamilies,
    notes:'families are victoryPath|resource; a whole family stays inside exactly one split'},
  fit:labels.fit,
  referenceGeneralPower:N.REFERENCE_WORLD_V7.referenceGeneralPower,
  realSpread:quantile(empiricalAll,.95)-quantile(empiricalAll,.05),
  cards:labels.cards.map(card=>({...card,...modelById.get(card.id),split:splitOf(card.id)})),
  results};
fs.writeFileSync(OUTPUT,JSON.stringify(artifact,null,2)+'\n');

console.log('\nmodel                    overall rho  pred spread (ratio)  pairwise>=1  test rho');
for(const [name,row] of Object.entries(results)){
  const fmt=value=>value===null||value===undefined?' n/a':value.toFixed(3);
  console.log(`${name.padEnd(24)} ${fmt(row.overall.spearman)}      ${fmt(row.overall.predictedSpread)} (${fmt(row.spreadRatio)})        ${fmt(row.overall.pairwiseDirectionAccuracy)}      ${fmt(row.test.spearman)}`);
}
console.log(`real spread p95-p5: ${(quantile(empiricalAll,.95)-quantile(empiricalAll,.05)).toFixed(3)}`);
console.log(`output: ${path.relative(ROOT,OUTPUT)}`);
