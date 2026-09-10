'use strict';
// Generator v7 runtime performance benchmark.
// Targets from the V7 spec: median < 10 ms and p95 < 25 ms for 1000 cards.
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB;
const count=Number(process.argv[2]||1000);
const rarities=N.RARITY_V2_ORDER;
const levels=[20,40,50,70,75,100];
const samples=[];
for(let i=0;i<count;i++){
  const rarity=rarities[i%rarities.length],level=levels[i%levels.length];
  const started=process.hrtime.bigint();
  const card=N.generateCardV7({seed:'bench-v7-'+i,rarity,level});
  const elapsed=Number(process.hrtime.bigint()-started)/1e6;
  if(!card||card.generatorVersion!==7)throw new Error('bad generated card at '+i);
  samples.push(elapsed);
}
const sorted=samples.slice().sort((a,b)=>a-b);
const at=p=>sorted[Math.min(sorted.length-1,Math.floor(p*sorted.length))];
const sum=samples.reduce((a,b)=>a+b,0);
const result={schemaVersion:1,generatorVersion:7,methodology:{cards:count,rarities:12,levels:6,runtime:'solver+model only; no battles, AI, opponent, Monte Carlo or BattlePower',os:process.platform,node:process.version},
  totalMs:Math.round(sum*100)/100,meanMs:Math.round((sum/samples.length)*1000)/1000,medianMs:Math.round(at(.5)*1000)/1000,p95Ms:Math.round(at(.95)*1000)/1000,p99Ms:Math.round(at(.99)*1000)/1000,minMs:Math.round(sorted[0]*1000)/1000,maxMs:Math.round(sorted.at(-1)*1000)/1000,
  gates:{medianUnder10ms:at(.5)<10,p95Under25ms:at(.95)<25}};
const output=path.join(ROOT,'qa/v7-performance.json');
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output:path.relative(ROOT,output),cards:count,meanMs:result.meanMs,medianMs:result.medianMs,p95Ms:result.p95Ms,gates:result.gates},null,2));
if(!Object.values(result.gates).every(Boolean))process.exitCode=1;
