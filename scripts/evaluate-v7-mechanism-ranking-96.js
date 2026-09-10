'use strict';
// Q1 evaluator: mechanism ranking of the current models on the OFFICIAL 96-card
// same-tier dataset (C0 attribution run), under three splits:
//   1. random card split (reference only)
//   2. seed-family split via the canonical splitCardFamiliesV7 (official gate)
//   3. mechanism-family holdout (victoryPath|resource, extra stress test)
// Labels come from qa/v7-attribution-C0.json (96 unsolved Lv50 A cards).
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7','battlepower-v4'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB;
const c0=JSON.parse(fs.readFileSync(path.join(ROOT,'qa/v7-attribution-C0.json'),'utf8'));
const mean=values=>values.reduce((sum,value)=>sum+value,0)/Math.max(1,values.length);
const quantile=(values,q)=>{const sorted=values.slice().sort((a,b)=>a-b),p=(sorted.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return sorted[lo]+(sorted[hi]-sorted[lo])*(p-lo);};
const pearson=(a,b)=>{const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;n+=x*y;da+=x*x;db+=y*y;}return da&&db?n/Math.sqrt(da*db):0;};
const rank=values=>{const sorted=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value);const ranks=Array(values.length);for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j].value===sorted[i].value)j++;const r=(i+j-1)/2;for(let k=i;k<j;k++)ranks[sorted[k].index]=r;i=j;}return ranks;};
const spearman=(a,b)=>pearson(rank(a),rank(b));
const {splitCardFamiliesV7}=require(path.join(ROOT,'src/empirical-strength-v7.js'));

const rows=c0.cards.map(card=>{
  const genome=N.styleGenomeV7(card.seed),skeleton=N.mechanicSkeletonV7(card.seed);
  const base=N.buildUnsolvedCardV7(card.seed,'A',50,skeleton,genome);
  return {id:card.id,seed:card.seed,family:card.family,victoryPath:card.victoryPath,empirical:card.rawTheta,
    predictTheta:N.predictThetaV7(base),predictReality:N.predictRealityThetaV7(base),
    bpv4:N.battlePowerV4(base).predictedTheta};
});
const byId=new Map(rows.map(row=>[row.id,row]));
const splitOf=(split,id)=>{
  if(split==='random'){
    const hash=id.split('').reduce((h,c)=>(Math.imul(h,31)+c.charCodeAt(0))>>>0,2166136261);
    const bucket=hash%20;
    return bucket<14?'train':bucket<17?'validation':'test';
  }
  if(split==='seedFamily'){
    const byPartition={train:new Set(),validation:new Set(),test:new Set()};
    const parts=splitCardFamiliesV7(rows.map(row=>({id:row.id,seed:row.seed})));
    for(const partition of ['train','validation','test'])for(const row of parts[partition])byPartition[partition].add(row.id);
    return byPartition.train.has(id)?'train':byPartition.validation.has(id)?'validation':'test';
  }
  // mechanism-family holdout
  const families=[...new Set(rows.map(row=>row.family))].sort();
  const train=new Set(),validation=new Set(),test=new Set();
  families.forEach((family,index)=>{const bucket=index%20;if(bucket<14)train.add(family);else if(bucket<17)validation.add(family);else test.add(family);});
  return train.has(byId.get(id).family)?'train':validation.has(byId.get(id).family)?'validation':'test';
};
function metrics(ids,valueOf){
  const empirical=ids.map(id=>byId.get(id).empirical),predicted=ids.map(id=>valueOf(byId.get(id)));
  const pairs=[];
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)pairs.push({dEmp:byId.get(ids[i]).empirical-byId.get(ids[j]).empirical,dPre:valueOf(byId.get(ids[i]))-valueOf(byId.get(ids[j]))});
  const large=pairs.filter(pair=>Math.abs(pair.dEmp)>=1&&Math.abs(pair.dPre)>1e-9);
  return {count:ids.length,spearman:ids.length>3?spearman(predicted,empirical):null,
    pairwise:large.length?large.filter(pair=>Math.sign(pair.dEmp)===Math.sign(pair.dPre)).length/large.length:null,
    predictedSpread:ids.length>3?quantile(predicted,.95)-quantile(predicted,.05):null,
    realSpread:ids.length>3?quantile(empirical,.95)-quantile(empirical,.05):null};
}
const allIds=rows.map(row=>row.id);
const result={};
for(const model of ['predictTheta','predictReality','bpv4']){
  const valueOf=row=>row[model];
  result[model]={};
  for(const split of ['random','seedFamily','mechanismFamily']){
    const testIds=allIds.filter(id=>splitOf(split,id)==='test');
    result[model][split]={...metrics(testIds,valueOf),
      spreadRatio:metrics(testIds,valueOf).predictedSpread!==null?metrics(testIds,valueOf).predictedSpread/Math.max(1e-9,metrics(testIds,valueOf).realSpread):null};
  }
  result[model].overall=metrics(allIds,valueOf);
}
const artifact={schemaVersion:1,generatorVersion:7,dataset:'qa/v7-attribution-C0.json',cards:c0.methodology.cards,
  methodology:{...c0.methodology,splitNotes:{random:'reference only; hash-bucket 70/15/15',seedFamily:'canonical splitCardFamiliesV7 by seed (official gate); single-tier population -> one card per seed',mechanismFamily:'victoryPath|resource holdout (extra stress test)'}},
  realSpread:quantile(allIds.map(id=>byId.get(id).empirical),.95)-quantile(allIds.map(id=>byId.get(id).empirical),.05),
  results:result};
const output=path.join(ROOT,'qa/v7-mechanism-ranking-96.json');
fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');
console.log('real spread:',artifact.realSpread.toFixed(3));
console.log('model                     overall    seedFamily(test)  random(test)   mechanismFamily(test)');
for(const [model,row] of Object.entries(result)){
  const fmt=v=>v===null||v===undefined?' n/a':v.toFixed(3);
  console.log(`${model.padEnd(24)} ${fmt(row.overall.spearman)}     ${fmt(row.seedFamily.spearman)}          ${fmt(row.random.spearman)}         ${fmt(row.mechanismFamily.spearman)}`);
}
console.log('spread ratios (test, predicted/real):');
for(const [model,row] of Object.entries(result))console.log(`  ${model.padEnd(24)} seedFamily ${fmt2(row.seedFamily.spreadRatio)}   mechanismFamily ${fmt2(row.mechanismFamily.spreadRatio)}`);
function fmt2(v){return v===null||v===undefined?' n/a':v.toFixed(2);}
