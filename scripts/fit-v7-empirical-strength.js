'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {fitBradleyTerryV7}=require('../src/empirical-strength-v7.js');
const {fitLinearScaleV7}=require('../src/calibration-v7.js');
const ROOT=path.resolve(__dirname,'..'),graph=JSON.parse(fs.readFileSync(path.join(ROOT,'qa/v7-battle-graph.json'),'utf8'));
const nodes=graph.cards.map(card=>card.id),fit=fitBradleyTerryV7(nodes,graph.edges.map(edge=>({a:edge.a,b:edge.b,winsA:edge.winsA,winsB:edge.winsB,draws:edge.draws})));
const mean=values=>values.reduce((a,b)=>a+b,0)/Math.max(1,values.length);
const rank=values=>{const sorted=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value);const ranks=Array(values.length);for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j].value===sorted[i].value)j++;const r=(i+j-1)/2;for(let k=i;k<j;k++)ranks[sorted[k].index]=r;i=j;}return ranks;};
const pearson=(a,b)=>{const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;n+=x*y;da+=x*x;db+=y*y;}return n/Math.sqrt(da*db);};
const target=graph.cards.map(card=>card.targetTheta),raw=graph.cards.map(card=>fit.theta[card.id]);
const trainIds=new Set(graph.split.train);
const scale=fitLinearScaleV7(graph.cards.filter(card=>trainIds.has(card.id)).map(card=>({raw:fit.theta[card.id],target:card.targetTheta})));
const {slope,intercept}=scale,empirical=raw.map(value=>intercept+slope*value);
const rows=graph.cards.map((card,i)=>({...card,rawBradleyTerryTheta:raw[i],empiricalTheta:empirical[i],standardError:fit.standardError[card.id]*Math.abs(slope),games:graph.edges.filter(edge=>edge.a===card.id||edge.b===card.id).reduce((sum,edge)=>sum+edge.battles,0),
  wins:graph.edges.reduce((sum,edge)=>sum+(edge.a===card.id?edge.winsA:edge.b===card.id?edge.winsB:0),0),losses:graph.edges.reduce((sum,edge)=>sum+(edge.a===card.id?edge.winsB:edge.b===card.id?edge.winsA:0),0),draws:graph.edges.reduce((sum,edge)=>sum+((edge.a===card.id||edge.b===card.id)?edge.draws:0),0)}));
const errors=rows.map(row=>row.empiricalTheta-row.targetTheta),metrics={mae:mean(errors.map(Math.abs)),rmse:Math.sqrt(mean(errors.map(value=>value*value))),spearman:pearson(rank(target),rank(empirical)),pearson:pearson(target,empirical),calibrationSlope:slope,pairwiseDirectionAccuracy:graph.edges.filter(edge=>byTarget(edge)!==0).filter(edge=>byTarget(edge)===Math.sign(fit.theta[edge.a]-fit.theta[edge.b])).length/Math.max(1,graph.edges.filter(edge=>byTarget(edge)!==0).length)};
function byTarget(edge){const a=graph.cards.find(card=>card.id===edge.a),b=graph.cards.find(card=>card.id===edge.b);return Math.sign(a.targetTheta-b.targetTheta);}
const splitMetrics=Object.fromEntries(Object.entries(graph.split).map(([partition,ids])=>{
  const set=new Set(ids),partitionErrors=rows.filter(row=>set.has(row.id)).map(row=>row.empiricalTheta-row.targetTheta);
  return [partition,{count:partitionErrors.length,mae:mean(partitionErrors.map(Math.abs)),rmse:Math.sqrt(mean(partitionErrors.map(value=>value*value)))}];
}));
const artifact={schemaVersion:1,methodology:{...graph.methodology,fit:'regularized Bradley-Terry; draws score 0.5',scale:'linear alignment fit on train families only'},scale:{slope,intercept,trainedOn:'train'},fit:{converged:fit.converged,logLoss:fit.logLoss,...metrics,splitMetrics},cards:rows};
const output=path.join(ROOT,'qa/v7-empirical-strength.json');fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');console.log(JSON.stringify({output:path.relative(ROOT,output),fit:artifact.fit},null,2));
