'use strict';
// Solver Saturation Audit (V7).
//
// The iso-power solver is only meaningful if it still has room to move. If a
// stale reference scale pushes every card into its hard bounds (measured before
// this fix: ATK -> 3, MAX_HP -> 530, HEAL_POWER -> 52.73 for every seed), the
// solver can no longer equalise mechanisms and seed dispersion explodes.
//
// Requirement (spec section 12): over 1000 random cards every core knob must
// stay under a 2% bound-hit rate; anything above 5% is a blocker.
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB;
const COUNT=Number(process.argv[2]||1000);
const limits=N.SOLVER_LIMITS_V7;
const knobs=Object.keys(limits);
const levels=[1,20,40,50,70,75,100];
const hits=Object.fromEntries(knobs.map(knob=>[knob,{min:0,max:0}]));
const errors=[],iterations=[];
let nonConverged=0,invalid=0;
for(let i=0;i<COUNT;i++){
  const rarity=N.RARITY_V2_ORDER[i%N.RARITY_V2_ORDER.length],level=levels[i%levels.length];
  const card=N.generateCardV7({seed:'v7-saturation-'+i,rarity,level});
  if(!card.solver.converged)nonConverged++;
  if(!N.validateContentPack(N.assembleCardPack(card)).ok)invalid++;
  errors.push(Math.abs(card.strengthModel.predictedTheta-card.targetTheta));
  iterations.push(card.solver.iterations);
  for(const knob of knobs){
    const value=Number(card.stats[knob]),[min,max]=limits[knob];
    if(!Number.isFinite(value))continue;
    // integer-rounded stats can land a hair outside; treat within 0.5 units of a
    // bound as a bound hit so rounding cannot mask real saturation.
    if(value<=min+.5)hits[knob].min++;
    if(value>=max-.5)hits[knob].max++;
  }
}
const rate=(name,side)=>hits[name][side]/COUNT;
const perKnob=Object.fromEntries(knobs.map(knob=>{
  const minRate=rate(knob,'min'),maxRate=rate(knob,'max'),combined=minRate+maxRate;
  return [knob,{limit:limits[knob],atMin:hits[knob].min,atMax:hits[knob].max,minRate,maxRate,boundHitRate:combined,
    ok:combined<.02,blocker:combined>.05}];
}));
const quantile=(values,q)=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(q*sorted.length))];};
const blockers=Object.entries(perKnob).filter(([,row])=>row.blocker).map(([knob])=>knob);
const failures=Object.entries(perKnob).filter(([,row])=>!row.ok).map(([knob])=>knob);
const gates={noKnobAboveTwoPercent:failures.length===0,noBlockerAboveFivePercent:blockers.length===0,allConverged:nonConverged===0,allValid:invalid===0};
const artifact={schemaVersion:1,generatorVersion:7,method:'bound-hit rate of every solver knob over random cards',
  cards:COUNT,referenceGeneralPower:N.REFERENCE_WORLD_V7.referenceGeneralPower,
  knobs:perKnob,
  convergence:{nonConverged,medianAbsError:quantile(errors,.5),p95AbsError:quantile(errors,.95),maxAbsError:Math.max(...errors),
    medianIterations:quantile(iterations,.5),p95Iterations:quantile(iterations,.95)},
  gates,failures,blockers,pass:Object.values(gates).every(Boolean)};
const output=path.join(ROOT,'qa/v7-solver-saturation.json');
fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({output:path.relative(ROOT,output),cards:COUNT,referenceGeneralPower:N.REFERENCE_WORLD_V7.referenceGeneralPower,
  boundHitRates:Object.fromEntries(Object.entries(perKnob).map(([knob,row])=>[knob,+(row.boundHitRate*100).toFixed(2)])),
  convergence:{medianAbsError:+quantile(errors,.5).toFixed(4),p95AbsError:+quantile(errors,.95).toFixed(4),medianIterations:quantile(iterations,.5)},gates},null,2));
if(!artifact.pass)process.exitCode=1;
