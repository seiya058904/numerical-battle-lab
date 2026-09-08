'use strict';
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-model','battlepower','battlepower-v2','battlepower-v3','numerical-knowledge','budget-v6','budget-price','gen-v6'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB,round=v=>Math.round(v*1000)/1000;
const quantile=(values,p)=>{const a=values.slice().sort((x,y)=>x-y);if(!a.length)return 0;const x=(a.length-1)*p,lo=Math.floor(x),hi=Math.ceil(x),t=x-lo;return round(a[lo]*(1-t)+a[hi]*t);};
const summary=values=>{const mean=values.reduce((a,b)=>a+b,0)/values.length;return {mean:round(mean),std:round(Math.sqrt(values.reduce((n,v)=>n+(v-mean)**2,0)/values.length)),p5:quantile(values,.05),p25:quantile(values,.25),p50:quantile(values,.5),p75:quantile(values,.75),p95:quantile(values,.95)};};
const ranks=values=>{const sorted=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),out=Array(values.length);for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j].v===sorted[i].v)j++;const rank=(i+j-1)/2+1;for(let k=i;k<j;k++)out[sorted[k].i]=rank;i=j;}return out;};
const pearson=(a,b)=>{const ma=a.reduce((x,y)=>x+y,0)/a.length,mb=b.reduce((x,y)=>x+y,0)/b.length;let n=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;n+=x*y;da+=x*x;db+=y*y;}return round(n/Math.sqrt(da*db));};
const write=(name,data)=>fs.writeFileSync(path.join(ROOT,'qa',name),JSON.stringify(data,null,2)+'\n');

const same=Array.from({length:100},(_,i)=>N.generateCardV6({seed:'v6-dispersion-'+i,rarity:'A',level:50}));
const panel={};for(const key of ['ATK','MAX_HP','DEF','RES','SPD'])panel[key]=summary(same.map(c=>c.stats[key]));
const pricedRatios=same.map(c=>N.budgetPriceCardV6(c).total/c.expectedStrength);
const bpValues=same.map(c=>N.battlePowerV3(c).power);
write('v6-seed-dispersion.json',{tier:{level:50,rarity:'A'},sampleSize:same.length,panel,pricedStrength:{...summary(pricedRatios),unit:'ratio to ExpectedStrength'},battlePower:summary(bpValues),statement:'allocation diversity high; priced strength variance bounded'});

const categories=N.CATEGORIES,examples=categories.map(category=>{
  const card=same.slice().sort((a,b)=>b.allocationProfile[category]-a.allocationProfile[category])[0];
  const priced=N.budgetPriceCardV6(card).total;
  return {category,seed:card.seed,name:card.name,expectedStrength:card.expectedStrength,pricedStrength:priced,deviation:round((priced-card.expectedStrength)/card.expectedStrength),allocationProfile:card.allocationProfile,panel:Object.fromEntries(['ATK','MAX_HP','DEF','RES','SPD'].map(k=>[k,card.stats[k]])),victoryPath:card._shape.victory,actions:card.actions.map(a=>a.name)};
});
write('v6-budget-distribution.json',{tier:{level:50,rarity:'A'},sampleSize:same.length,maxAbsoluteDeviation:round(Math.max(...pricedRatios.map(v=>Math.abs(v-1)))),deviation:summary(pricedRatios.map(v=>v-1)),allocation:Object.fromEntries(categories.map(k=>[k,summary(same.map(c=>c.allocationProfile[k]))])),examples});

const levels=[10,20,30,40,50,60,75,80,100],curves={};for(const rarity of N.RARITY_V2_ORDER)curves[rarity]=levels.map(level=>({level,expectedStrength:N.expectedStrengthV6(level,rarity)}));
const crossDefs=[[20,'XS',50,'A'],[30,'S',60,'B'],[80,'C',40,'SSS'],[100,'C',50,'XS']];
const crossInteractions=crossDefs.map(([l1,r1,l2,r2])=>{const a=N.expectedStrengthV6(l1,r1),b=N.expectedStrengthV6(l2,r2);return {label:`Lv${l1} ${r1} vs Lv${l2} ${r2}`,left:a,right:b,ratio:round(a/b),expectedWinner:a===b?'tie':(a>b?'left':'right')};});
write('v6-expected-strength.json',{formula:'1000 * LevelScaleV6(level) * RarityStrengthScaleV6(rarity)',rarityScale:N.RARITY_STRENGTH_LV100,levels,curves,crossInteractions});

const population=[];for(const rarity of N.RARITY_V2_ORDER)for(const level of [10,25,50,75,100])for(let i=0;i<5;i++){const card=N.generateCardV6({seed:`v6-corr-${rarity}-${level}-${i}`,rarity,level});population.push({expected:card.expectedStrength,bp:N.battlePowerV3(card).power,rarity,level,seed:card.seed});}
write('v6-battlepower-correlation.json',{sampleSize:population.length,spearman:pearson(ranks(population.map(x=>x.expected)),ranks(population.map(x=>x.bp))),pearson:pearson(population.map(x=>x.expected),population.map(x=>x.bp)),note:'BattlePower reads card content only; ExpectedStrength is recorded solely by this external audit.'});

const timings=[];const start=performance.now();for(let i=0;i<1000;i++){const t=performance.now();N.generateCardV6({seed:'v6-perf-'+i,rarity:N.RARITY_V2_ORDER[i%12],level:1+(i%100)});timings.push(performance.now()-t);}const total=performance.now()-start;
write('v6-performance.json',{cards:1000,totalMs:round(total),meanMsPerCard:round(total/1000),medianMsPerCard:quantile(timings,.5),p95MsPerCard:quantile(timings,.95),measurement:'wall clock performance.now; no battle engine or AI invoked'});
console.log(JSON.stringify({sameTier:100,correlationPopulation:population.length,spearman:pearson(ranks(population.map(x=>x.expected)),ranks(population.map(x=>x.bp))),performanceMs:round(total),maxAbsoluteDeviation:round(Math.max(...pricedRatios.map(v=>Math.abs(v-1))))}));
