'use strict';
// Mechanism Feature Exploration (V7).
//
// Reads the cached mechanism labels (no new battles) and reports how strongly
// each candidate CONTENT feature correlates with MechanismEmpiricalTheta, so the
// strength model can be built from features that actually track long-grind
// combat value instead of from hand-guessed weights.
//
// Also fits a ridge model on the train families and reports held-out family
// performance, which is the pattern the runtime model will use.
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7','battlepower-v4'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB;
const labels=JSON.parse(fs.readFileSync(path.join(ROOT,'qa/v7-mechanism-labels.json'),'utf8'));
const LEVEL=labels.methodology.level,RARITY=labels.methodology.rarity,WORLD=N.REFERENCE_WORLD_V7;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const num=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const responsive=value=>{const x=Math.max(.01,num(value,100)/100);return clamp(1+1.5*Math.tanh(Math.log(x)),.25,2.5);};
const mean=values=>values.reduce((sum,value)=>sum+value,0)/Math.max(1,values.length);
const quantile=(values,q)=>{const sorted=values.slice().sort((a,b)=>a-b),p=(sorted.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return sorted[lo]+(sorted[hi]-sorted[lo])*(p-lo);};
const pearson=(a,b)=>{const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;n+=x*y;da+=x*x;db+=y*y;}return da&&db?n/Math.sqrt(da*db):0;};
const rank=values=>{const sorted=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value);const ranks=Array(values.length);for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j].value===sorted[i].value)j++;const r=(i+j-1)/2;for(let k=i;k<j;k++)ranks[sorted[k].index]=r;i=j;}return ranks;};
const spearman=(a,b)=>pearson(rank(a),rank(b));

// rebuild the same population (deterministic) and attach labels
const population=[];
for(const row of labels.cards){
  const genome=N.styleGenomeV7(row.seed),skeleton=N.mechanicSkeletonV7(row.seed);
  population.push({label:row,card:N.buildUnsolvedCardV7(row.seed,RARITY,LEVEL,skeleton,genome),genome,skeleton});
}

function scopeFor(card){
  const s=card.stats||{},hp=Math.max(1,num(s.MAX_HP,1000)),atk=Math.max(0,num(s.ATK,0));
  return {...s,ATK:atk,MAX_HP:hp,HP:hp*.6,HP_PCT:.6,MISSING_HP:hp*.4,ENERGY:Math.min(num(s.ENERGY_MAX,8),4),ROUND:12,BATTLE_TURN:12,
    STACKS:2,CONSUMED_STACKS:2,TARGET_HP:(WORLD.hp||1000)*.6,TARGET_MAX_HP:WORLD.hp||1000,TARGET_HP_PCT:.6,EVENT_DAMAGE:atk};
}
const evaluate=(formula,card)=>{try{return Math.max(0,num(N.evaluateExpression(String(formula??'0'),scopeFor(card)),0));}catch(_){return 0;}};
const statusDefsFor=card=>new Map([...(card.statuses||[]).map(status=>[status.id,status]),...Object.entries(N.STATUS_DEFS||{})]);

// --- engine-accurate availability: cooldown counts down by recovery per round ---
function availability(card,action){
  const recovery=Math.max(.25,responsive(card.stats?.RECOVERY));
  const cooldown=Math.max(0,num(action.cooldown,0));
  const cooldownFrequency=cooldown<=0?1:clamp(recovery/cooldown,0,1);
  const regen=Math.max(.1,num(card.stats?.ENERGY_REGEN,2)),cost=Math.max(0,num(action.cost,0));
  const resourceFrequency=cost?clamp(regen/cost,0,1):1;
  return cooldownFrequency*resourceFrequency;
}
// --- per-action magnitudes (engine formulas through the card's own scope) ---
function actionProfile(card,action,statusDefs){
  const s=card.stats||{},profile={direct:0,periodic:0,heal:0,barrier:0,control:0,economy:0};
  const walk=(effects,multiplier=1,depth=0)=>{
    if(depth>7)return;
    for(const effect of effects||[]){
      const w=multiplier;
      if(effect.type==='conditional'){walk(effect.then,w*.55,depth+1);walk(effect.else,w*.45,depth+1);continue;}
      if(effect.type==='repeat'){walk(effect.effects,w*clamp(num(effect.times,1),1,16),depth+1);continue;}
      if(effect.type==='damage'){
        const components=effect.components||[{formula:effect.formula,multiplier:1}];
        const amount=components.reduce((sum,component)=>sum+evaluate(component.formula??effect.formula,card)*num(component.multiplier,1),0);
        const hits=clamp(num(effect.hits,1),1,32);
        const tags=[...(effect.tags||[]),...(action.tags||[])];
        const periodicLike=tags.some(tag=>['dot','periodic','trigger','detonation','potency'].includes(tag))||action.kind==='status'||action.kind==='trigger';
        if(periodicLike)profile.periodic+=amount*hits*w*responsive(s.POTENCY);
        else profile.direct+=amount*hits*w;
        if(num(effect.drainRatio,0)>0)profile.heal+=amount*hits*num(effect.drainRatio,0)*w;
      }else if(effect.type==='heal')profile.heal+=evaluate(effect.formula,card)*w*(num(s.HEAL_POWER,100)/100);
      else if(effect.type==='shield'||effect.type==='ward')profile.barrier+=evaluate(effect.formula,card)*w*responsive(s.BARRIER_POWER);
      else if(effect.type==='gain'||effect.type==='resource'||effect.type==='convertResource')profile.economy+=num(effect.amount,1)*w;
      else if(effect.type==='status'||effect.type==='toggleStatus'){
        const def=statusDefs.get(effect.status)||{};
        const duration=clamp(num(effect.duration??def.duration,2),1,6),chance=clamp(num(effect.chance,1),0,1);
        const weight=def.flags?.stun?1:def.flags?.silence?.7:(def.kind==='debuff'?.5:.05);
        const contest=clamp(1+(responsive(s.CONTROL_POWER)-responsive(s.TENACITY))*.5,.2,2);
        profile.control+=weight*duration*chance*w*contest;
        const periodic=def.periodic?.effects;
        if(periodic){
          let periodicDamage=0;
          const collect=effects=>{for(const inner of effects||[]){if(inner.type==='damage'){const components=inner.components||[{formula:inner.formula,multiplier:1}];periodicDamage+=components.reduce((sum,c)=>sum+evaluate(c.formula??inner.formula,card)*num(c.multiplier,1),0)*clamp(num(inner.hits,1),1,32);}if(inner.effects)collect(inner.effects);}};
          collect(periodic);
          profile.periodic+=periodicDamage*duration*chance*w*responsive(s.POTENCY);
        }
      }
      if(effect.effects)walk(effect.effects,w,depth+1);
    }
  };
  walk(action.effects);
  return profile;
}

function featureVector(card){
  const s=card.stats||{},actions=card.actions||[],statusDefs=statusDefsFor(card);
  const perAction=actions.map(action=>{
    const profile=actionProfile(card,action,statusDefs),avail=availability(card,action);
    const dmgType=action.effects?.find(effect=>effect.type==='damage')?.damageType||'physical';
    const pen=clamp((num(s.PEN,0)+num(action.penetrationBonus,0))/100,0,.95);
    const mitigation=['physical','bleed'].includes(dmgType)?100/(100+100*(1-pen)):100/(100+100*(1-pen));
    const acc=clamp(num(action.accuracy,1)*(100+num(s.ACC,100))/(100+num(s.ACC,100)+(num(WORLD.eva,30))*.85),.22,.995);
    const crit=1+clamp(num(s.CRIT,0)/100,0,.95)*Math.max(0,num(s.CRIT_DMG,150)/100-1);
    const scale=acc*crit*mitigation;
    const score=(profile.direct+profile.periodic)*scale+profile.heal*.5+profile.barrier*.35+profile.control*400+profile.economy*20;
    return {profile,avail,scale,score,
      offense:(profile.direct+profile.periodic)*scale*avail,
      periodic:profile.periodic*scale*avail,
      heal:profile.heal*avail,barrier:profile.barrier*avail,control:profile.control*avail,economy:profile.economy*avail};
  });
  const roundCap=100;
  // availability-weighted totals (what the kit can deliver per round)
  const sum=key=>perAction.reduce((total,row)=>total+row[key],0);
  // AI choice policy: the canonical AI plays the best-scoring action it can afford.
  // Model expected per-round output as a softmax-weighted expectation (one action
  // per round), which is neither a plain sum nor a plain average.
  const scores=perAction.map(row=>row.score);
  const maxScore=Math.max(...scores,1e-9),temperature=Math.max(1e-9,maxScore*.25);
  const weights=scores.map(score=>Math.exp((score-maxScore)/temperature));
  const weightSum=weights.reduce((a,b)=>a+b,0)||1;
  const policy=perAction.map((row,index)=>weights[index]/weightSum);
  const expected=key=>perAction.reduce((total,row,index)=>total+row[key]*policy[index],0);
  const best=key=>perAction.reduce((top,row)=>Math.max(top,row[key]),0);
  const topWeighted=key=>perAction.reduce((total,row,index)=>total+row[key]*(index===0?1:.35),0); // naive reference

  const defenseMix=(WORLD.damageTypeMix?.physical||0)+(WORLD.damageTypeMix?.bleed||0);
  const mitigation=defenseMix*(1+num(s.DEF,0)/100)+(1-defenseMix)*(1+num(s.RES,0)/100);
  const incomingHit=clamp((WORLD.acc||100)/(WORLD.acc||100+num(s.EVA,0)*.85),.25,1);
  const tenacity=.4+.6*responsive(s.TENACITY);
  const ehp=Math.max(1,num(s.MAX_HP,1)*mitigation/incomingHit*tenacity);

  const triggerFreq={roundStart:2.2,roundEnd:2.2,afterDamageTaken:1.6,afterDamageDealt:1.6,afterStatusInflicted:1.1,afterKill:.15,command:1};
  let triggerValue=0;
  for(const trigger of card.triggers||[]){
    const profile=actionProfile(card,{effects:trigger.effects,kind:'trigger',tags:['trigger']},statusDefs);
    triggerValue+=(profile.direct+profile.periodic)*1.2+(profile.heal+profile.barrier)*.6+profile.control*200;
  }
  const totalPolicy={};
  for(const key of ['offense','periodic','heal','barrier','control','economy'])totalPolicy[key]=expected(key);
  const dps=totalPolicy.offense;
  const sustain=totalPolicy.heal*.6+totalPolicy.barrier*.5;
  const control=totalPolicy.control;
  const avgAvailability=mean(perAction.map(row=>row.avail));
  const avgCooldown=mean(actions.map(action=>num(action.cooldown,0)));
  const maxPriority=Math.max(0,...actions.map(action=>num(action.priority,0)));
  const concentration=maxScore/(scores.reduce((a,b)=>a+b,0)||1);

  const roundLength=Math.max(4,Math.min(roundCap,num(s.MAX_HP,1)/Math.max(1e-6,dps*4)));
  return {
    // offense family
    logDps:Math.log(1+dps),logDpsSum:Math.log(1+sum('offense')),logDpsBest:Math.log(1+best('offense')),
    logDpsTopWeighted:Math.log(1+topWeighted('offense')),logDpsAnchor:Math.log(1+(perAction.find(row=>row.anchor)?.offense??perAction[0]?.offense??0)),
    logPeriodic:Math.log(1+totalPolicy.periodic),
    periodicShare:totalPolicy.periodic/Math.max(1e-9,totalPolicy.offense+totalPolicy.periodic),
    // durability / sustain
    logEhp:Math.log(1+ehp),logSustain:Math.log(1+sustain),
    sustainPerRound:sustain,healPerRound:totalPolicy.heal,barrierPerRound:totalPolicy.barrier,
    sustainRatio:sustain/Math.max(1e-9,ehp),
    netDps:dps-sustain,
    // control / tempo / reliability / economy / triggers
    controlPerRound:control,logControl:Math.log(1+control*400),
    avgAvailability,avgCooldown,maxPriority,recoveryRate:responsive(s.RECOVERY),regen:num(s.ENERGY_REGEN,2),
    logTrigger:Math.log(1+triggerValue),
    hitFactor:clamp((100+num(s.ACC,100))/(100+num(s.ACC,100)+30*.85),.2,1),
    critEv:1+clamp(num(s.CRIT,0)/100,0,.95)*Math.max(0,num(s.CRIT_DMG,150)/100-1),
    potencyRate:responsive(s.POTENCY),barrierRate:responsive(s.BARRIER_POWER),
    concentration,actionCount:actions.length,
    roundLength:Math.log(1+roundLength),
    // interactions
    dpsPerEhp:Math.log(1+dps/Math.max(1e-9,ehp)*1000),
    offenseSurvival:Math.log(1+dps)*(ehp/100000),
    controlTimesDps:Math.log(1+control*400*dps*.01),
    sustainTimesEhp:Math.log(1+(1+sustain)*(ehp/100000)),
    dpsTimesReliability:Math.log(1+dps*(clamp((100+num(s.ACC,100))/(100+num(s.ACC,100)+30*.85),.2,1))*(1+clamp(num(s.CRIT,0)/100,0,.95)*Math.max(0,num(s.CRIT_DMG,150)/100-1))),
  };
}

const rows=population.map(entry=>({label:entry.label,features:featureVector(entry.card)}));
const empirical=rows.map(row=>row.label.rawTheta);
const names=Object.keys(rows[0].features);
const correlations=names.map(name=>({name,rho:spearman(rows.map(row=>row.features[name]),empirical)}))
  .sort((a,b)=>Math.abs(b.rho)-Math.abs(a.rho));
console.log('real spread p95-p5:',(quantile(empirical,.95)-quantile(empirical,.05)).toFixed(3));
console.log('\nfeature correlations with MechanismEmpiricalTheta (|rho| desc):');
for(const row of correlations)console.log(`  ${row.rho>=0?'+':''}${row.rho.toFixed(3)}  ${row.name}`);

// --- ridge fit on train families, evaluate on held-out families ---
const trainFamilies=new Set(JSON.parse(fs.readFileSync(path.join(ROOT,'qa/v7-mechanism-ranking.json'),'utf8')).split.trainFamilies);
const trainRows=rows.filter(row=>trainFamilies.has(row.label.family));
const testRows=rows.filter(row=>!trainFamilies.has(row.label.family));
function fitRidge(rowsIn,lambda){
  const width=names.length;
  const means=names.map((_,i)=>mean(rowsIn.map(row=>row.features[names[i]])));
  const scales=names.map((name,i)=>{const sd=Math.sqrt(mean(rowsIn.map(row=>(row.features[name]-means[i])**2)));return sd||1;});
  const design=rowsIn.map(row=>[1,...names.map((name,i)=>(row.features[name]-means[i])/scales[i])]);
  const size=width+1,matrix=Array.from({length:size},()=>Array(size).fill(0)),vector=Array(size).fill(0);
  rowsIn.forEach((row,r)=>{vector[0]+=row.label.rawTheta;matrix[0][0]+=1;
    for(let i=0;i<width;i++){vector[i+1]+=design[r][i+1]*row.label.rawTheta;for(let j=0;j<width;j++)matrix[i+1][j+1]+=design[r][i+1]*design[r][j+1];}});
  for(let i=1;i<size;i++)matrix[i][i]+=lambda;
  // gaussian elimination
  const a=matrix.map((row,index)=>[...row,vector[index]]);
  for(let column=0;column<size;column++){
    let pivot=column;for(let r=column+1;r<size;r++)if(Math.abs(a[r][column])>Math.abs(a[pivot][column]))pivot=r;
    if(Math.abs(a[pivot][column])<1e-12)continue;
    [a[column],a[pivot]]=[a[pivot],a[column]];
    const divisor=a[column][column];for(let j=column;j<=size;j++)a[column][j]/=divisor;
    for(let r=0;r<size;r++)if(r!==column){const factor=a[r][column];for(let j=column;j<=size;j++)a[r][j]-=factor*a[column][j];}
  }
  const coefficients=a.map((row,index)=>Math.abs(row[index])<1e-12?0:row[size]);
  return {means,scales,coefficients};
}
const predict=(model,row)=>{let value=model.coefficients[0];for(let i=0;i<names.length;i++)value+=((row.features[names[i]]-model.means[i])/model.scales[i])*model.coefficients[i+1];return value;};
console.log(`\ntrain rows ${trainRows.length} · held-out rows ${testRows.length}`);
for(const lambda of [.1,1,10,100,1000]){
  const model=fitRidge(trainRows,lambda);
  const trainPred=trainRows.map(row=>predict(model,row)),testPred=testRows.map(row=>predict(model,row));
  console.log(`lambda ${String(lambda).padStart(4)}  train rho ${spearman(trainRows.map(r=>r.label.rawTheta),trainPred).toFixed(3)}  heldout rho ${spearman(testRows.map(r=>r.label.rawTheta),testPred).toFixed(3)}  heldout spread ${(quantile(testPred,.95)-quantile(testPred,.05)).toFixed(2)}`);
}
