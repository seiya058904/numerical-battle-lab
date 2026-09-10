'use strict';
// Solver Knob Utilization Audit (V7).
//
// Answers: why does the solver converge mostly through MAX_HP? For every knob
// over a random 1000-card population this reports the actual usage pattern:
// how many cards it was adjusted on, how often it was the FIRST selection,
// total adjustment count, median/p95 absolute and relative delta, its share of
// the total theta correction it performed, its marginal-value distribution at
// selection time, bound-hit rate, and how often the final value equals the
// initial value. This distinguishes "a genuinely best lever" from
// "greedy/derivative degeneracy" (user decision gate, round 3, section 5).
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB;
const COUNT=Number(process.argv[2]||1000);
const knobs=Object.keys(N.SOLVER_LIMITS_V7);
const levels=[1,20,40,50,70,75,100];
const quantile=(values,q)=>{if(!values.length)return 0;const sorted=values.slice().sort((a,b)=>a-b),p=(sorted.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return sorted[lo]+(sorted[hi]-sorted[lo])*(p-lo);};
const acc=Object.fromEntries(knobs.map(k=>[k,{adjustedCards:0,firstSelectedCards:0,adjustments:0,statDeltas:[],relativeDeltas:[],thetaDeltas:[],marginals:[],boundHits:0,keptInitial:0,initialSum:0}]));
let totalThetaCorrection=0,totalAdjustments=0,nonConverged=0;
for(let i=0;i<COUNT;i++){
  const rarity=N.RARITY_V2_ORDER[i%N.RARITY_V2_ORDER.length],level=levels[i%levels.length];
  const card=N.generateCardV7({seed:'v7-util-'+i,rarity,level});
  const telemetry=card.solver.telemetry;
  if(!card.solver.converged)nonConverged++;
  for(const key of knobs){
    const row=acc[key],t=telemetry;
    if(t.adjustments[key]>0)row.adjustedCards++;
    if(t.firstSelected[key]>0)row.firstSelectedCards++;
    row.adjustments+=t.adjustments[key];
    row.statDeltas.push(...t.statDeltas[key]);
    row.relativeDeltas.push(...t.relativeDeltas[key]);
    row.thetaDeltas.push(...t.thetaDeltas[key]);
    row.marginals.push(...t.marginals[key]);
    const [min,max]=N.SOLVER_LIMITS_V7[key];
    const final=Number(t.final[key]);
    if(final<=min+.5||final>=max-.5)row.boundHits++;
    const initial=Number(t.initial[key]);
    if(Math.abs(final-initial)<=Math.max(1e-9,Math.abs(initial)*1e-9+1e-9))row.keptInitial++;
    row.initialSum+=initial;
    for(const d of t.thetaDeltas[key])totalThetaCorrection+=d;
  }
  for(const key of knobs)totalAdjustments+=telemetry.adjustments[key];
}
const perKnob=Object.fromEntries(knobs.map(key=>{
  const row=acc[key];
  const thetaShare=row.thetaDeltas.length?row.thetaDeltas.reduce((a,b)=>a+b,0)/Math.max(1e-9,totalThetaCorrection):0;
  return [key,{limit:N.SOLVER_LIMITS_V7[key],
    adjustedCardRate:row.adjustedCards/COUNT,
    firstSelectedRate:row.firstSelectedCards/COUNT,
    totalAdjustments:row.adjustments,
    adjustmentShare:totalAdjustments?row.adjustments/totalAdjustments:0,
    medianAbsStatDelta:quantile(row.statDeltas,.5),p95AbsStatDelta:quantile(row.statDeltas,.95),
    medianRelativeDelta:quantile(row.relativeDeltas,.5),p95RelativeDelta:quantile(row.relativeDeltas,.95),
    thetaCorrectionShare:thetaShare,
    marginalMedian:quantile(row.marginals,.5),marginalP5:quantile(row.marginals,.05),marginalP95:quantile(row.marginals,.95),
    boundHitRate:row.boundHits/COUNT,
    keptInitialRate:row.keptInitial/COUNT,
    meanInitial:row.initialSum/COUNT}];
}));
const artifact={schemaVersion:1,generatorVersion:7,cards:COUNT,referenceGeneralPower:N.REFERENCE_WORLD_V7.referenceGeneralPower,
  totals:{adjustments:totalAdjustments,nonConverged,meanAdjustmentsPerCard:totalAdjustments/COUNT},
  perKnob,notes:'thetaCorrectionShare is the knob share of the total |predicted theta| change actually performed by the solver across the population'};
const output=path.join(ROOT,'qa/v7-solver-utilization.json');
fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({output:path.relative(ROOT,output),cards:COUNT,totalAdjustments,meanAdjustmentsPerCard:+(totalAdjustments/COUNT).toFixed(2),
  perKnob:Object.fromEntries(Object.entries(perKnob).map(([k,r])=>[k,{adjustedCardRate:+r.adjustedCardRate.toFixed(2),firstSelectedRate:+r.firstSelectedRate.toFixed(2),adjustments:r.totalAdjustments,thetaCorrectionShare:+r.thetaCorrectionShare.toFixed(3),medianAbsDelta:+r.medianAbsStatDelta.toFixed(1),medianRelativeDelta:+r.medianRelativeDelta.toFixed(3),marginalMedian:+r.marginalMedian.toFixed(4),boundHitRate:r.boundHitRate,keptInitialRate:+r.keptInitialRate.toFixed(2)}]))},null,2));
