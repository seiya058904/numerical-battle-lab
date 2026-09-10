'use strict';
// Mechanism Feature Exploration v2 (V7).
//
// v1 showed the mechanism spread (~6.3 theta) is not explained by magnitude
// features alone, and that barrierType "ward vs shield" only looked dominant
// because pick() consumes a PRNG draw and shifts downstream action parameters
// (a controlled same-card swap measured 15 vs 14 — no effect). So this pass
// focuses on the STRUCTURAL, engine-accurate drivers: per-round availability of
// each action (cooldown counted down by RECOVERY, resource affordability), the
// signature action's value, how many actions stay usable, and the damage-vs-
// sustain race. Labels are cached, so this costs no battles.
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7','battlepower-v4'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB;
const labels=JSON.parse(fs.readFileSync(path.join(ROOT,'qa/v7-mechanism-labels.json'),'utf8'));
const ranking=JSON.parse(fs.readFileSync(path.join(ROOT,'qa/v7-mechanism-ranking.json'),'utf8'));
const WORLD=N.REFERENCE_WORLD_V7;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const num=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const responsive=value=>{const x=Math.max(.01,num(value,100)/100);return clamp(1+1.5*Math.tanh(Math.log(x)),.25,2.5);};
const mean=values=>values.reduce((sum,value)=>sum+value,0)/Math.max(1,values.length);
const quantile=(values,q)=>{const sorted=values.slice().sort((a,b)=>a-b),p=(sorted.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return sorted[lo]+(sorted[hi]-sorted[lo])*(p-lo);};
const pearson=(a,b)=>{const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;n+=x*y;da+=x*x;db+=y*y;}return da&&db?n/Math.sqrt(da*db):0;};
const rank=values=>{const sorted=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value);const ranks=Array(values.length);for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j].value===sorted[i].value)j++;const r=(i+j-1)/2;for(let k=i;k<j;k++)ranks[sorted[k].index]=r;i=j;}return ranks;};
const spearman=(a,b)=>pearson(rank(a),rank(b));

const scopeFor=card=>{const s=card.stats||{},hp=Math.max(1,num(s.MAX_HP,1000)),atk=Math.max(0,num(s.ATK,0));
  return {...s,ATK:atk,MAX_HP:hp,HP:hp*.6,HP_PCT:.6,MISSING_HP:hp*.4,ENERGY:Math.min(num(s.ENERGY_MAX,8),4),ROUND:12,BATTLE_TURN:12,STACKS:2,CONSUMED_STACKS:2,TARGET_HP:(WORLD.hp||1000)*.6,TARGET_MAX_HP:WORLD.hp||1000,TARGET_HP_PCT:.6,EVENT_DAMAGE:atk};};
const evaluate=(formula,card)=>{try{return Math.max(0,num(N.evaluateExpression(String(formula??'0'),scopeFor(card)),0));}catch(_){return 0;}};

// Engine-accurate availability: cooldown ticks down by recoveryRate per round, so
// a skill is usable once per ceil(cd/recovery) rounds; energy accrues regen/round.
function availabilityOf(card,action){
  const recovery=Math.max(.25,responsive(card.stats?.RECOVERY));
  const cooldown=Math.max(0,num(action.cooldown,0));
  const cooldownFrequency=cooldown<=0?1:clamp(recovery/Math.max(1,cooldown),0,1);
  const regen=Math.max(.1,num(card.stats?.ENERGY_REGEN,2)),cost=Math.max(0,num(action.cost,0));
  const resourceFrequency=cost?clamp(regen/Math.max(1,cost),0,1):1;
  return cooldownFrequency*resourceFrequency;
}
const statusDefsFor=card=>new Map([...(card.statuses||[]).map(status=>[status.id,status]),...Object.entries(N.STATUS_DEFS||{})]);
function effectMagnitudes(card,effects,tags,depth=0,statusDefs){
  const out={damage:0,periodic:0,heal:0,barrier:0,control:0};
  if(depth>6)return out;
  const add=part=>{for(const key of Object.keys(out))out[key]+=part[key]||0;};
  for(const effect of effects||[]){
    if(effect.type==='conditional'){add(effectMagnitudes(card,effect.then,[],depth+1,statusDefs));add(effectMagnitudes(card,effect.else,[],depth+1,statusDefs));continue;}
    if(effect.type==='repeat'){add(effectMagnitudes(card,effect.effects,tags,depth+1,statusDefs));continue;}
    if(effect.type==='damage'){
      const components=effect.components||[{formula:effect.formula,multiplier:1}];
      const amount=components.reduce((sum,c)=>sum+evaluate(c.formula??effect.formula,card)*num(c.multiplier,1),0)*clamp(num(effect.hits,1),1,32);
      const periodicLike=[...(effect.tags||[]),...(tags||[])].some(tag=>['dot','periodic','trigger','detonation','potency'].includes(tag));
      if(periodicLike)out.periodic+=amount;else out.damage+=amount;
    }else if(effect.type==='heal')out.heal+=evaluate(effect.formula,card)*(num(card.stats?.HEAL_POWER,100)/100);
    else if(effect.type==='shield'||effect.type==='ward')out.barrier+=evaluate(effect.formula,card);
    else if(effect.type==='status'||effect.type==='toggleStatus'){
      const def=statusDefs.get(effect.status)||{};
      const duration=clamp(num(effect.duration??def.duration,2),1,6),chance=clamp(num(effect.chance,1),0,1);
      const weight=def.flags?.stun?1:def.flags?.silence?.7:(def.kind==='debuff'?.5:.05);
      out.control+=weight*duration*chance;
      if(def.periodic?.effects)out.periodic+=effectMagnitudes(card,def.periodic.effects,tags,depth+1,statusDefs).damage*duration*chance;
    }
  }
  return out;
}
function featureVector(card){
  const s=card.stats||{},actions=card.actions||[],statusDefs=statusDefsFor(card);
  const mitigation=100/(100+75);
  const acc=clamp((100+num(s.ACC,100))/(100+num(s.ACC,100)+num(WORLD.eva,30)*.85),.2,.995);
  const crit=1+clamp(num(s.CRIT,0)/100,0,.95)*Math.max(0,num(s.CRIT_DMG,150)/100-1);
  const rows=actions.map(action=>{
    const magnitude=effectMagnitudes(card,action.effects,action.tags,0,statusDefs);
    const availability=availabilityOf(card,action);
    const actionAcc=clamp(num(action.accuracy,1)*acc,.1,.995);
    const dps=(magnitude.damage*actionAcc*crit*mitigation+magnitude.periodic*responsive(s.POTENCY)*mitigation);
    return {action,magnitude,availability,dps,heal:magnitude.heal,barrier:magnitude.barrier*responsive(s.BARRIER_POWER),control:magnitude.control,
      score:dps+ (magnitude.heal*num(s.HEAL_POWER,100)/100)*.35 + magnitude.barrier*responsive(s.BARRIER_POWER)*.2 + magnitude.control*300};
  });
  const damageRows=rows.filter(row=>row.action.name!=='屏障'&&row.action.name!=='再生');
  const sorted=[...rows].sort((a,b)=>b.score-a.score);
  // Per-round expectation under the AI's "best affordable action" policy:
  // one action per round, so the sustainable output is the best AVAILABLE option.
  const perRoundDps=Math.max(...rows.map(row=>row.dps*row.availability),0);
  const perRoundHeal=Math.max(...rows.map(row=>row.heal*row.availability),0)*(num(s.HEAL_POWER,100)/100);
  const perRoundBarrier=Math.max(...rows.map(row=>row.barrier*row.availability),0);
  const perRoundControl=Math.max(...rows.map(row=>row.control*row.availability),0);
  const signature=rows.find(row=>!['基础攻势','精确打击','压制','屏障','再生'].includes(row.action.name))||rows.at(-1);
  const usableCount=rows.filter(row=>row.availability>=.5).length;
  const cooldowns=actions.map(action=>num(action.cooldown,0)),costs=actions.map(action=>num(action.cost,0));
  const ehp=Math.max(1,num(s.MAX_HP,1)*mitigation/clamp((WORLD.acc||100)/((WORLD.acc||100)+num(s.EVA,0)*.85),.25,1)*(.4+.6*responsive(s.TENACITY)));
  const sustainPerRound=perRoundHeal+perRoundBarrier;
  const netDepletion=perRoundDps-sustainPerRound*0;
  return {
    logPerRoundDps:Math.log(1+perRoundDps),
    logPerRoundHeal:Math.log(1+perRoundHeal),
    logPerRoundBarrier:Math.log(1+perRoundBarrier),
    logSustainPerRound:Math.log(1+sustainPerRound),
    sustainToDps:sustainPerRound/Math.max(1,perRoundDps),
    sustainToEhp:sustainPerRound/Math.max(1,ehp),
    logSignatureDps:Math.log(1+signature.dps),
    signatureAvailability:signature.availability,
    signatureShare:signature.dps/Math.max(1,Math.max(1,...rows.map(row=>row.dps))),
    usableCount,
    meanAvailability:mean(rows.map(row=>row.availability)),
    maxCooldown:Math.max(0,...cooldowns),minCooldown:Math.min(...cooldowns),meanCooldown:mean(cooldowns),
    meanCost:mean(costs),maxCost:Math.max(0,...costs),
    logControlPerRound:Math.log(1+perRoundControl*300),
    controlShare:perRoundControl/Math.max(.001,perRoundControl+perRoundDps),
    logEhp:Math.log(1+ehp),
    dpsToEhp:perRoundDps/Math.max(1,ehp),
    regen:num(s.ENERGY_REGEN,2),recovery:responsive(s.RECOVERY),potency:responsive(s.POTENCY),barrierRate:responsive(s.BARRIER_POWER),
    logPeriodicPerRound:Math.log(1+Math.max(...rows.map(row=>row.magnitude.periodic*responsive(s.POTENCY)*mitigation*row.availability),0)),
    periodicShare:Math.max(...rows.map(row=>row.magnitude.periodic),0)/Math.max(1,Math.max(...rows.map(row=>row.magnitude.periodic+row.magnitude.damage),0)),
    actionCount:actions.length,
    killTime:Math.log(1+num(s.MAX_HP,1)/Math.max(1,perRoundDps)),
    // race interaction: per-round progress toward killing vs being sustained
    racePressure:Math.log(1+perRoundDps)/Math.max(.05,Math.log(1+sustainPerRound)),
    netPressure:Math.log(1+Math.max(0,perRoundDps)),
  };
}
const population=[];
for(const row of labels.cards){
  const genome=N.styleGenomeV7(row.seed),skeleton=N.mechanicSkeletonV7(row.seed);
  population.push({label:row,features:featureVector(N.buildUnsolvedCardV7(row.seed,'A',50,skeleton,genome))});
}
const names=Object.keys(population[0].features);
const empirical=population.map(row=>row.label.rawTheta);
const correlations=names.map(name=>({name,rho:spearman(population.map(row=>row.features[name]),empirical)})).sort((a,b)=>Math.abs(b.rho)-Math.abs(a.rho));
console.log('real spread:',(quantile(empirical,.95)-quantile(empirical,.05)).toFixed(3));
console.log('\ntop correlations:');
for(const row of correlations.slice(0,14))console.log(`  ${row.rho>=0?'+':''}${row.rho.toFixed(3)}  ${row.name}`);

const trainFamilies=new Set(ranking.split.trainFamilies),validationFamilies=new Set(ranking.split.validationFamilies);
const trainRows=population.filter(row=>trainFamilies.has(row.label.family));
const validationRows=population.filter(row=>validationFamilies.has(row.label.family));
const testRows=population.filter(row=>!trainFamilies.has(row.label.family)&&!validationFamilies.has(row.label.family));
function fitRidge(rowsIn,lambda){
  const width=names.length;
  const means=names.map(name=>mean(rowsIn.map(row=>row.features[name])));
  const scales=names.map((name,i)=>Math.sqrt(mean(rowsIn.map(row=>(row.features[name]-means[i])**2)))||1);
  const design=rowsIn.map(row=>[1,...names.map((name,i)=>(row.features[name]-means[i])/scales[i])]);
  const size=width+1,matrix=Array.from({length:size},()=>Array(size).fill(0)),vector=Array(size).fill(0);
  rowsIn.forEach((row,r)=>{vector[0]+=row.label.rawTheta;matrix[0][0]+=1;
    for(let i=0;i<width;i++){vector[i+1]+=design[r][i+1]*row.label.rawTheta;for(let j=0;j<width;j++)matrix[i+1][j+1]+=design[r][i+1]*design[r][j+1];}});
  for(let i=1;i<size;i++)matrix[i][i]+=lambda;
  const a=matrix.map((row,index)=>[...row,vector[index]]);
  for(let column=0;column<size;column++){
    let pivot=column;for(let r=column+1;r<size;r++)if(Math.abs(a[r][column])>Math.abs(a[pivot][column]))pivot=r;
    if(Math.abs(a[pivot][column])<1e-12)continue;
    [a[column],a[pivot]]=[a[pivot],a[column]];
    const divisor=a[column][column];for(let j=column;j<=size;j++)a[column][j]/=divisor;
    for(let r=0;r<size;r++)if(r!==column){const factor=a[r][column];for(let j=column;j<=size;j++)a[r][j]-=factor*a[column][j];}
  }
  return {means,scales,coefficients:a.map((row,index)=>Math.abs(row[index])<1e-12?0:row[size])};
}
const predict=(model,row)=>{let value=model.coefficients[0];for(let i=0;i<names.length;i++)value+=((row.features[names[i]]-model.means[i])/model.scales[i])*model.coefficients[i+1];return value;};
console.log(`\nrows train ${trainRows.length} / validation ${validationRows.length} / test ${testRows.length}`);
let best=null;
for(const lambda of [1,3,10,30,100,300,1000]){
  const model=fitRidge(trainRows,lambda);
  const rho=rows=>spearman(rows.map(r=>r.label.rawTheta),rows.map(r=>predict(model,r)));
  const spread=rows=>{const p=rows.map(r=>predict(model,r));return quantile(p,.95)-quantile(p,.05);};
  const score={lambda,train:rho(trainRows),validation:rho(validationRows),test:rho(testRows),testSpread:spread(testRows),realSpread:quantile(testRows.map(r=>r.label.rawTheta),.95)-quantile(testRows.map(r=>r.label.rawTheta),.05)};
  console.log(`  lambda ${String(lambda).padStart(4)}  train ${score.train.toFixed(3)}  val ${score.validation.toFixed(3)}  test ${score.test.toFixed(3)}  testSpread ${score.testSpread.toFixed(2)}/${score.realSpread.toFixed(2)}`);
  if(!best||score.validation>best.validation)best=score;
}
console.log('best by validation:',JSON.stringify(best));
