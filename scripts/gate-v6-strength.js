'use strict';
// v6 strength regression gate — small deterministic sample run inside
// `npm run verify:release` so CI catches Level/Rarity dominance regressions
// without the full audit (which stays a local/release diagnostic).
//
// Assertions (modest, non-flaky thresholds — they detect DOMINANCE REGRESSIONS,
// not fine balance):
//   1. rarity (same Lv50): A beats C >= 0.55; SSS beats A >= 0.55
//   2. level (rarity A): Lv60 beats Lv10 >= 0.60; Lv100 beats Lv10 >= 0.65
//   3. same-tier universal strength spread (Lv50 A vs a small diverse pool) <= 0.75
// Exits non-zero on failure.
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-model','battlepower','battlepower-v2','battlepower-v3','numerical-knowledge','budget-v6','budget-price','gen-v6'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;
const POOL=2,PER=5,RMAX=80;
function fight(a,b,seed){N.deployCard(a);N.deployCard(b);const e=N.createBattle({seed:N.deriveSeed(seed),teamA:[a.id],teamB:[b.id],maxRounds:RMAX});let g=0;while(!e.outcome().ended&&g++<Math.min(600,RMAX*2+40))e.resolveRound([...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')]);const w=e.outcome().winner;return w==='A'?1:(w==='B'?-1:0);}
function hiWin(lo,hi,base){let w=0,n=0;for(let i=0;i<lo.length;i++)for(let k=0;k<PER;k++){const r1=fight(lo[i],hi[i%hi.length],base+i*131+k*7),r2=fight(hi[i%hi.length],lo[i],base+i*131+k*7+3);if(r2===1)w+=2;else if(r1===-1)w+=2;n+=2;}return n?w/n:0.5;}
function mk(rar,lv){const a=[];for(let i=0;i<POOL;i++)a.push(N.generateCardV6({seed:'gate-'+rar+'-'+lv+'-'+i,rarity:rar,level:lv}));return a;}
const C50=mk('C',50),A50=mk('A',50),SSS50=mk('SSS',50);
const A10=mk('A',10),A60=mk('A',60),A100=mk('A',100);
const checks=[];
checks.push({name:'rarity Lv50: A beats C',val:hiWin(C50,A50,100000),min:0.55});
checks.push({name:'rarity Lv50: SSS beats A',val:hiWin(A50,SSS50,101000),min:0.55});
checks.push({name:'level: Lv60 A beats Lv10 A',val:hiWin(A10,A60,102000),min:0.60});
checks.push({name:'level: Lv100 A beats Lv10 A',val:hiWin(A10,A100,103000),min:0.65});
// same-tier USI spread (Lv50 A vs small diverse pool) must stay bounded
const div=[];for(const [r,l] of [['C',30],['A',20],['S',50]])div.push(N.generateCardV6({seed:'gate-div-'+r+'-'+l,rarity:r,level:l}));
const usi=[];for(const c of A50){let w=0,n=0;for(let j=0;j<div.length;j++){const r1=fight(c,div[j],200000+j),r2=fight(div[j],c,200000+j+5);w+=(r1===1?1:0)+(r2===-1?1:0);n+=2;}usi.push(n?w/n:0.5);}
const spread=Math.max(...usi)-Math.min(...usi);
checks.push({name:'same-tier USI spread (Lv50 A)',val:spread,max:0.75});
let fail=0;
for(const c of checks){
  const ok=c.max!==undefined?c.val<=c.max:c.val>=c.min;
  if(!ok)fail++;
  console.log(`${ok?'PASS':'FAIL'} ${c.name}: ${c.val.toFixed(3)} ${c.max!==undefined?('<= '+c.max):('>= '+c.min)}`);
}
if(fail){console.error('v6 strength gate FAILED');process.exit(1);}
console.log('v6 strength gate PASS');