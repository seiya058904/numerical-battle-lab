'use strict';
// Decisive diagnostic: rank UNSOLVED base cards by the content model, then fight
// them for real. If the model's mechanism valuation is directionally right, its
// predicted ranking must correlate with the real battle ranking (in which case
// the solver's compensation is the problem); if not, the model valuation is.
const fs=require('node:fs'),path=require('node:path');
const ROOT=__dirname;
const {emptyBattleCounts,addBattleCounts,scoreMirroredPair}=require(path.join(ROOT,'src/strength-audit-v6.js'));
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;
const seeds=Number(process.argv[2]||8);
function fight(a,b,seed){
  N.deployCard(a);N.deployCard(b);
  const e=N.createBattle({seed:N.deriveSeed(seed),teamA:[a.id],teamB:[b.id],maxRounds:100});
  let guard=0;while(!e.outcome().ended&&guard++<240)e.resolveRound([...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')]);
  const w=e.outcome().winner;return w==='A'?1:(w==='B'?-1:0);
}
const cards=[];
for(let i=0;i<15;i++){
  const seed='base-'+i,genome=N.styleGenomeV7(seed),skel=N.mechanicSkeletonV7(seed);
  const card=N.buildUnsolvedCardV7(seed,'A',50,skel,genome);
  card.name='base'+i;card.displayName='base'+i;
  cards.push({card,predicted:N.predictThetaV7(card),victory:skel.victoryPath});
}
const theta=Object.fromEntries(cards.map(r=>[r.card.id,0])),games=Object.fromEntries(cards.map(r=>[r.card.id,0]));
for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){
  const counts=emptyBattleCounts();
  for(let k=0;k<seeds;k++)addBattleCounts(counts,scoreMirroredPair(cards[i].card,cards[j].card,440000+i*100+j*7+k,fight));
  const wins=counts.higherWins+counts.lowerWins+counts.draws;
  theta[cards[i].card.id]+=counts.higherWins+counts.draws/2;games[cards[i].card.id]+=wins;
  theta[cards[j].card.id]+=counts.lowerWins+counts.draws/2;games[cards[j].card.id]+=wins;
}
const rows=cards.map(r=>({victory:r.victory,predicted:r.predicted,actual:Math.log((theta[r.card.id]+.5)/(games[r.card.id]-theta[r.card.id]+.5))}));
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const corr=(a,b)=>{const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;n+=x*y;da+=x*x;db+=y*y;}return n/Math.sqrt(da*db);};
const rank=v=>{const s=v.map((x,i)=>({x,i})).sort((a,b)=>a.x-b.x);const r=Array(v.length);s.forEach((e,i)=>r[e.i]=i);return r;};
console.log('corr(predicted, actual) UNSOLVED:',corr(rows.map(r=>r.predicted),rows.map(r=>r.actual)).toFixed(3));
console.log('spearman(predicted, actual) UNSOLVED:',corr(rank(rows.map(r=>r.predicted)),rank(rows.map(r=>r.actual))).toFixed(3));
console.log('predicted spread:',(Math.max(...rows.map(r=>r.predicted))-Math.min(...rows.map(r=>r.predicted))).toFixed(2));
console.log('actual spread:',(Math.max(...rows.map(r=>r.actual))-Math.min(...rows.map(r=>r.actual))).toFixed(2));
for(const r of rows.slice().sort((a,b)=>a.actual-b.actual))console.log(r.victory.padEnd(9)+' predicted='+r.predicted.toFixed(2).padStart(7)+' actual='+r.actual.toFixed(2).padStart(7));
