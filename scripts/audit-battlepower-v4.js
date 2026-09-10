'use strict';
// BattlePower V4 reality audit.
//
// Trains the independent content-only BPv4 ridge model against train seed
// families of the Phase-6 final EmpiricalTheta, selects the ridge lambda on
// validation seed families, then evaluates the FROZEN model on untouched test
// seed families. Runtime source never reads the labels — it only consumes the
// committed calibration/battlepower-v4.json coefficients.
//
// DoD (spec Task 7): holdout Spearman >= 0.90, large-gap ordering >= 95%,
// strong inversion rate <= 2%.
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const {fitRidgeCalibrationV7}=require('../src/calibration-v7.js');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7','battlepower-v4'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB;
const graph=JSON.parse(fs.readFileSync(path.join(ROOT,'qa/v7-battle-graph.json'),'utf8'));
const empirical=JSON.parse(fs.readFileSync(path.join(ROOT,'qa/v7-empirical-strength.json'),'utf8'));
const partitionById=new Map(Object.entries(graph.split).flatMap(([partition,ids])=>ids.map(id=>[id,partition])));
const mean=values=>values.reduce((a,b)=>a+b,0)/Math.max(1,values.length);
const rank=values=>{const sorted=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value);const ranks=Array(values.length);for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j].value===sorted[i].value)j++;const r=(i+j-1)/2;for(let k=i;k<j;k++)ranks[sorted[k].index]=r;i=j;}return ranks;};
const spearman=(a,b)=>pearson(rank(a),rank(b));
function pearson(a,b){const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;n+=x*y;da+=x*x;db+=y*y;}return n/Math.sqrt(da*db);}
// Rebuild each graph card deterministically from its frozen seed/level/rarity
// (Generator v7 is a pure function of those three inputs).
const rows=[];
for(const row of empirical.cards){
  const card=N.generateCardV7({seed:row.seed,level:row.level,rarity:row.rarity});
  if(card.id!==row.id)throw new Error(`deterministic rebuild mismatch for ${row.id}: got ${card.id}`);
  const bp=N.battlePowerV4(card);
  rows.push({id:row.id,seed:row.seed,level:row.level,rarity:row.rarity,partition:partitionById.get(row.id),
    empiricalTheta:row.empiricalTheta,targetTheta:row.targetTheta,predictedTheta:bp.predictedTheta,power:bp.power,features:bp.features});
}
const datasets={train:[],validation:[],test:[]};
for(const row of rows)datasets[row.partition].push({id:row.id,features:row.features,outcome:row.empiricalTheta});
const fit=fitRidgeCalibrationV7(datasets.train,datasets.validation,datasets.test,[.01,.1,1,10,100,1000]);
const model=fit.model;
const evaluateTheta=row=>{let value=Number(model.intercept);for(let i=0;i<row.features.length;i++)value+=((row.features[i]-model.means[i])/Math.max(1e-9,model.scales[i]))*model.coefficients[i];return value;};
for(const row of rows)row.predictedTheta=evaluateTheta(row);
const thetaById=new Map(rows.map(row=>[row.id,row.empiricalTheta])),bpById=new Map(rows.map(row=>[row.id,row.predictedTheta]));
function pairMetrics(ids){
  const pairs=[];
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    const a=ids[i],b=ids[j],empGap=thetaById.get(a)-thetaById.get(b),bpGap=bpById.get(a)-bpById.get(b);
    pairs.push({a,b,empGap,bpGap,largeGap:Math.abs(empGap)>=1.5,strongInversion:Math.abs(bpGap)>=2&&Math.sign(empGap)!==Math.sign(bpGap)&&Math.abs(empGap)>=1.5});
  }
  const decided=pairs.filter(pair=>pair.empGap!==0&&pair.bpGap!==0);
  const large=pairs.filter(pair=>pair.largeGap&&pair.empGap!==0&&pair.bpGap!==0);
  const orderingCorrect=decided.filter(pair=>Math.sign(pair.empGap)===Math.sign(pair.bpGap)).length/Math.max(1,decided.length);
  const largeCorrect=large.filter(pair=>Math.sign(pair.empGap)===Math.sign(pair.bpGap)).length/Math.max(1,large.length);
  return {totalPairs:pairs.length,decidedPairs:decided.length,orderingAccuracy:orderingCorrect,largeGapPairs:large.length,largeGapOrderingAccuracy:largeCorrect,strongInversions:decided.filter(pair=>pair.strongInversion).length,strongInversionRate:decided.length?decided.filter(pair=>pair.strongInversion).length/decided.length:0};
}
function correlationOf(ids,key){
  const subset=rows.filter(row=>ids.includes(row.id));
  if(subset.length<4)return null;
  return {count:subset.length,spearman:spearman(subset.map(row=>row[key]),subset.map(row=>row.empiricalTheta))};
}
const allIds=rows.map(row=>row.id),testIds=rows.filter(row=>row.partition==='test').map(row=>row.id);
const levels=[...new Set(rows.map(row=>row.level))].sort((a,b)=>a-b);
const rarities=[...new Set(rows.map(row=>row.rarity))];
const withinLevel=Object.fromEntries(levels.map(level=>({level,metrics:correlationOf(rows.filter(row=>row.level===level).map(row=>row.id),'predictedTheta')})).map(entry=>[entry.level,entry.metrics]));
const withinRarity=Object.fromEntries(rarities.map(rarity=>({rarity,metrics:correlationOf(rows.filter(row=>row.rarity===rarity).map(row=>row.id),'predictedTheta')})).map(entry=>[entry.rarity,entry.metrics]));
const worstResiduals=rows.map(row=>({id:row.id,level:row.level,rarity:row.rarity,empiricalTheta:row.empiricalTheta,predictedTheta:row.predictedTheta,residual:row.predictedTheta-row.empiricalTheta,absResidual:Math.abs(row.predictedTheta-row.empiricalTheta)})).sort((a,b)=>b.absResidual-a.absResidual).slice(0,12).map(({absResidual,...rest})=>rest);
const overall=pairMetrics(allIds),holdout=pairMetrics(testIds);
const correlation={overall:correlationOf(allIds,'predictedTheta'),holdout:correlationOf(testIds,'predictedTheta'),withinLevel,withinRarity};
const gates={holdoutSpearman:correlation.holdout?.spearman>=.9,largeGapOrdering:holdout.largeGapOrderingAccuracy>=.95,strongInversionRate:holdout.strongInversionRate<=.02};
const calibration={schemaVersion:1,generatorVersion:7,modelVersion:4,trainedOn:'train seed families only',selectedOn:'validation seed families',testedOn:'untouched test seed families',featurePolicy:'content-only; never reads level/rarity/seed/target/budget/empirical labels',featureNames:N.BATTLEPOWER_V4_FEATURE_NAMES.slice(0,model.coefficients.length),means:model.means,scales:model.scales,coefficients:model.coefficients,intercept:model.intercept,ridge:model.lambda,displayGain:.28,displayAnchor:'power = round(1000*exp(0.28*theta)); theta 0 anchors Lv50 A near 1000'};
fs.writeFileSync(path.join(ROOT,'calibration/battlepower-v4.json'),JSON.stringify(calibration,null,2)+'\n');
// Browser embed (offline static runtime cannot fetch JSON).
fs.writeFileSync(path.join(ROOT,'calibration/battlepower-v4.js'),'(function(r){r.NCB=r.NCB||{};r.NCB.BATTLEPOWER_V4_CALIBRATION='+JSON.stringify(calibration).replace(/<\/script/g,'<\\/script')+';})(typeof globalThis!==\'undefined\'?globalThis:window);\n');
const artifact={schemaVersion:1,methodology:{truth:'regularized Bradley-Terry EmpiricalTheta over final Phase-6 canonical graph',familyIsolation:true,featureCount:model.coefficients.length,ridgeLambda:model.lambda,displayAnchor:'Lv50 A near 1000'},
  fit:{train:fit.metrics.train,validation:fit.metrics.validation,test:fit.metrics.test},correlation,holdoutPairMetrics:holdout,overallPairMetrics:overall,gates,worstResiduals};
const output=path.join(ROOT,'qa/v7-battlepower-reality.json');
fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({output:path.relative(ROOT,output),holdoutSpearman:correlation.holdout?.spearman,overallSpearman:correlation.overall?.spearman,holdoutLargeGapOrdering:holdout.largeGapOrderingAccuracy,holdoutStrongInversionRate:holdout.strongInversionRate,gates},null,2));
if(!Object.values(gates).every(Boolean))process.exitCode=1;
