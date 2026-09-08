'use strict';
// Generator v6 empirical strength audit — Level/Rarity/ExpectedStrength dominance
// and intra-tier seed dispersion, measured by REAL canonical-AI battles.
//
// Reports (defaults small for CI; use larger argv for a full local run):
//   node scripts/audit-v6-strength.js  [poolPerTier] [battlesPerPair] [roundCap]
//
// Writes qa/v6-strength-audit.json. Uses multiple independent Match Seeds and
// mirrors sides (card X as teamA then teamB with paired seeds) so no side bias.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-model','battlepower','battlepower-v2','battlepower-v3','numerical-knowledge','budget-v6','budget-price','gen-v6'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;

const POOL=Number(process.argv[2])||4;      // cards per tier
const PER=Number(process.argv[3])||6;       // independent match seeds per pair (mirrored)
const RMAX=Number(process.argv[4])||110;    // battle round cap

function fight(a,b,seed){
  N.deployCard(a);N.deployCard(b);
  const e=N.createBattle({seed:N.deriveSeed(seed),teamA:[a.id],teamB:[b.id],maxRounds:RMAX});
  let g=0;while(!e.outcome().ended&&g++<Math.min(1000,RMAX*2+40))e.resolveRound([...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')]);
  const w=e.outcome().winner;return w==='A'?1:(w==='B'?-1:0);
}
// higher-card win rate over `lo` pool vs `hi` pool, mirrored, multiple seeds
function hiWin(loCards,hiCards,base){
  let hi=0,n=0;
  for(let i=0;i<loCards.length;i++){const lo=loCards[i],hiC=hiCards[i%hiCards.length];
    for(let k=0;k<PER;k++){
      const r1=fight(lo,hiC,base+i*131+k*7),r2=fight(hiC,lo,base+i*131+k*7+3);
      if(r2===1)hi+=2;else if(r1===-1)hi+=2;n+=2;
    }}
  return {win:+(hi/n).toFixed(3),n};
}
function mk(rar,lv){const a=[];for(let i=0;i<POOL;i++)a.push(N.generateCardV6({seed:'v6a-'+rar+'-'+lv+'-'+i,rarity:rar,level:lv}));return a;}

const RARITIES=['C','C_PLUS','B','B_PLUS','A','A_PLUS','S','SS','SSS','SSS_COLLECTOR','XS','XS_COLLECTOR'];
const tiers={};for(const r of RARITIES)tiers[r]=mk(r,50); // same-level rarity ladder
// level ladder at a fixed rarity
const A30=mk('A',30),A60=mk('A',60),A100=mk('A',100),A10=mk('A',10);

const rarityGap={};
for(let i=0;i<RARITIES.length;i++){
  for(let j=i+1;j<RARITIES.length;j++){ // higher rarity j vs lower i
    rarityGap[RARITIES[i]+' vs '+RARITIES[j]]=hiWin(tiers[RARITIES[i]],tiers[RARITIES[j]],50000+i*1000+j);
  }
}
const levelGap={
  'A Lv10 vs Lv30':hiWin(A10,mk('A',30),90000),
  'A Lv10 vs Lv60':hiWin(A10,A60,90020),
  'A Lv30 vs Lv60':hiWin(A30,A60,90040),
  'A Lv60 vs Lv100':hiWin(A60,A100,90060),
  'A Lv30 vs Lv100':hiWin(A30,A100,90080),
  'A Lv10 vs Lv100':hiWin(A10,A100,90100),
};
// intra-tier seed dispersion: same-tier aggregate win distribution
const SAME_POOL=Math.max(6,POOL*2);
const poolA=[];for(let i=0;i<SAME_POOL;i++)poolA.push(N.generateCardV6({seed:'v6intra-'+i,rarity:'A',level:50}));
const base=300000;const intra=[];
for(let i=0;i<SAME_POOL;i++){const c=poolA[i];let w=0,n=0;for(let j=0;j<SAME_POOL-1;j++){const oi=(i+1+j*3)%SAME_POOL;if(oi===i)continue;const o=poolA[oi];const r1=fight(c,o,base+i*97+j),r2=fight(o,c,base+i*97+j+13);w+=(r1===1?1:0)+(r2===-1?1:0);n+=2;}intra.push(+(w/n).toFixed(3));}
const wrs=intra.slice().sort((a,b)=>a-b);
const quant=p=>wrs[Math.min(wrs.length-1,Math.floor(p*wrs.length))];
const intraSummary={pool:SAME_POOL,min:wrs[0],p25:quant(.25),median:quant(.5),p75:quant(.75),max:wrs[wrs.length-1],mean:+(wrs.reduce((x,y)=>x+y,0)/wrs.length).toFixed(3)};

const out={poolPerTier:POOL,battlesPerPair:PER,phase:'v6',rarityGap,levelGap,intraTier:intraSummary};
fs.writeFileSync(path.join(ROOT,'qa/v6-strength-audit.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({rarityGap,levelGap,intraTier:intraSummary},null,2));