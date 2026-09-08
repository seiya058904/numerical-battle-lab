'use strict';
const path=require('node:path');
const {emptyBattleCounts,addBattleCounts,scoreMirroredPair,summarizeBattleCounts}=require('../src/strength-audit-v6.js');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-model','battlepower','battlepower-v2','battlepower-v3','numerical-knowledge','budget-v6','budget-price','gen-v6'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB,POOL=2,PER=5,RMAX=80;
function fight(a,b,seed){N.deployCard(a);N.deployCard(b);const e=N.createBattle({seed:N.deriveSeed(seed),teamA:[a.id],teamB:[b.id],maxRounds:RMAX});let g=0;while(!e.outcome().ended&&g++<Math.min(600,RMAX*2+40))e.resolveRound([...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')]);const w=e.outcome().winner;return w==='A'?1:(w==='B'?-1:0);}
function mk(r,l){return Array.from({length:POOL},(_,i)=>N.generateCardV6({seed:'gate-'+r+'-'+l+'-'+i,rarity:r,level:l}));}
function measure(low,high,base){const counts=emptyBattleCounts();for(let i=0;i<low.length;i++)for(let k=0;k<PER;k++)addBattleCounts(counts,scoreMirroredPair(low[i],high[i%high.length],N.deriveSeed(base+i*131+k*7),fight));return summarizeBattleCounts(counts);}
const C50=mk('C',50),A50=mk('A',50),SSS50=mk('SSS',50),A10=mk('A',10),A60=mk('A',60),A100=mk('A',100);
const checks=[{name:'rarity Lv50: A beats C',result:measure(C50,A50,100000),min:.55},{name:'rarity Lv50: SSS beats A',result:measure(A50,SSS50,101000),min:.55},{name:'level: Lv60 A beats Lv10 A',result:measure(A10,A60,102000),min:.60},{name:'level: Lv100 A beats Lv10 A',result:measure(A10,A100,103000),min:.65}];
let fail=0;for(const c of checks){const value=c.result.higherWinRate,lower=c.result.ci95.low,ok=lower>=c.min;if(!ok)fail++;console.log(`${ok?'PASS':'FAIL'} ${c.name}: ${value.toFixed(3)} CI95 [${lower.toFixed(3)}, ${c.result.ci95.high.toFixed(3)}], lower bound >= ${c.min}`);}if(fail){console.error('v6 strength gate FAILED');process.exit(1);}console.log('v6 strength gate PASS');
