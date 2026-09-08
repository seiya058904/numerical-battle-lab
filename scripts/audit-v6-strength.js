'use strict';
// Generator v6 empirical strength audit — Level/Rarity dominance + same-tier
// universal-strength spread, measured by REAL canonical-AI battles.
//
// Method: multiple independent Match Seeds, sides mirrored (card X as teamA then
// teamB with paired seeds). Same-tier spread uses the UNIVERSAL STRENGTH INDEX
// (USI): each card's mirrored win rate against a DIVERSE opponent pool (various
// rarities and levels), which is the honest "总体 strength tier" measure — strong
// counter-picking among same-tier peers is allowed (matchups may be extreme) but
// the tier must stay sealed vs the wider field.
//
// Usage: node scripts/audit-v6-strength.js [poolPerTier] [battlesPerPair] [roundCap]
// Writes qa/v6-strength-audit.json.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-model','battlepower','battlepower-v2','battlepower-v3','numerical-knowledge','budget-v6','budget-price','gen-v6'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;
const POOL=Number(process.argv[2])||3, PER=Number(process.argv[3])||5, RMAX=Number(process.argv[4])||100;
function fight(a,b,seed){N.deployCard(a);N.deployCard(b);const e=N.createBattle({seed:N.deriveSeed(seed),teamA:[a.id],teamB:[b.id],maxRounds:RMAX});let g=0;while(!e.outcome().ended&&g++<Math.min(900,RMAX*2+40))e.resolveRound([...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')]);const w=e.outcome().winner;return w==='A'?1:(w==='B'?-1:0);}
function hiWin(lo,hi,base){let w=0,n=0;for(let i=0;i<lo.length;i++){for(let k=0;k<PER;k++){const r1=fight(lo[i],hi[i%hi.length],base+i*131+k*7),r2=fight(hi[i%hi.length],lo[i],base+i*131+k*7+3);if(r2===1)w+=2;else if(r1===-1)w+=2;n+=2;}}return{win:+(w/n).toFixed(3),n};}
function mk(rar,lv){const a=[];for(let i=0;i<POOL;i++)a.push(N.generateCardV6({seed:'v6a-'+rar+'-'+lv+'-'+i,rarity:rar,level:lv}));return a;}
const C50=mk('C',50),A50=mk('A',50),SSS50=mk('SSS',50),XSC50=mk('XS_COLLECTOR',50);
const A10=mk('A',10),A30=mk('A',30),A60=mk('A',60),A100=mk('A',100);
const rarityGap={
  'C vs A (Lv50)':hiWin(C50,A50,50000),
  'A vs SSS (Lv50)':hiWin(A50,SSS50,50100),
  'A vs XS_COLLECTOR (Lv50)':hiWin(A50,XSC50,50200),
};
const levelGap={
  'A Lv10 vs Lv30':hiWin(A10,A30,90000),
  'A Lv10 vs Lv60':hiWin(A10,A60,90100),
  'A Lv30 vs Lv60':hiWin(A30,A60,90200),
  'A Lv60 vs Lv100':hiWin(A60,A100,90300),
  'A Lv30 vs Lv100':hiWin(A30,A100,90400),
};
// ---- same-tier universal strength (USI) vs a DIVERSE pool ----
const samePool=[];for(let i=0;i<Math.max(6,POOL*3);i++)samePool.push(N.generateCardV6({seed:'v6same-'+i,rarity:'A',level:50}));
const diverse=[];for(const [r,l] of [['C',30],['C',50],['B',40],['B',50],['A',20],['A',30],['A',70],['A',100],['S',50],['SS',40],['SSS',50],['C',80]]){diverse.push(N.generateCardV6({seed:'v6div-'+r+'-'+l,rarity:r,level:l}));}
const base=300000;const usi=[];
for(let i=0;i<samePool.length;i++){const c=samePool[i];let w=0,n=0;for(let j=0;j<diverse.length;j++){const r1=fight(c,diverse[j],base+i*97+j),r2=fight(diverse[j],c,base+i*97+j+13);w+=(r1===1?1:0)+(r2===-1?1:0);n+=2;}usi.push(+(w/n).toFixed(3));}
const s=usi.slice().sort((a,b)=>a-b);
const quant=p=>s[Math.min(s.length-1,Math.floor(p*s.length))];
const intraTier={pool:samePool.length,opponents:diverse.length,min:s[0],p25:quant(.25),median:quant(.5),p75:quant(.75),max:s[s.length-1],mean:+(s.reduce((x,y)=>x+y,0)/s.length).toFixed(3),spread:+(s[s.length-1]-s[0]).toFixed(3)};
const out={poolPerTier:POOL,battlesPerPair:PER,roundCap:RMAX,rarityGap,levelGap,intraTier};
fs.writeFileSync(path.join(ROOT,'qa/v6-strength-audit.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({rarityGap,levelGap,intraTier},null,2));