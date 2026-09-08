'use strict';
// Empirical strength validation: canonical-AI battles bucketed by BP ratio and
// rarity gap. Answers "does larger BP gap -> larger expected win advantage" at
// scale, with honest sample sizes. Writes qa/empirical-strength.json.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-v2'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;
const R=N.RARITY_V2_ORDER;

function fight(a,b,seed){
  N.deployCard(a);N.deployCard(b);
  const e=N.createBattle({seed:N.deriveSeed(seed),teamA:[a.id],teamB:[b.id],maxRounds:150});
  let g=0;while(!e.outcome().ended&&g++<200)e.resolveRound([...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')]);
  const w=e.outcome().winner;return w==='A'?1:(w==='B'?-1:0);
}

function run(opts={}){
  const nCards=opts.nCards||1200,nPairs=opts.nPairs||3000,seedBase=opts.seedBase||100000;
  // generate the card pool: cross-seed, all rarities at Lv100
  const cards=[];
  for(let i=0;i<nCards;i++){
    const r=R[i%R.length];
    cards.push(N.generateCardV5({seed:'emp-'+r+'-'+i,rarity:r,level:100}));
  }
  // deterministic pseudo-random pair sampler (no Math.random in scripts gate? audit scripts may use it; use seeded Gen5)
  const prng=new N.Gen5PRNG('gen5,11,22,33,44');
  const buckets={}; // key -> {count, hi, lo, dr}
  const gapBuckets={}; // rarity tier gap
  const add=(map,key,result,hiBP,loBP)=>{
    const b=map[key]||(map[key]={count:0,hiWins:0,loWins:0,draws:0,hiBpSum:0,loBpSum:0});
    b.count++;b.hiWins+=(result===1?1:0);b.loWins+=(result===-1?1:0);b.draws+=(result===0?1:0);b.hiBpSum+=hiBP;b.loBpSum+=loBP;
  };
  let i=0;
  while(i<nPairs){
    const ai=prng.random(cards.length),bi=prng.random(cards.length);
    if(ai===bi)continue;
    let a=cards[ai],b=cards[bi];
    const hiBP=Math.max(a.power,b.power),loBP=Math.min(a.power,b.power);
    const ratio=hiBP/Math.max(1,loBP);
    // ensure team A is the higher-BP card for a consistent metric
    let r;
    if(a.power>=b.power){r=fight(a,b,seedBase+i);}else{r=fight(b,a,seedBase+i);}
    const rk=ratio>=1.6?'very-large':ratio>=1.4?'large':ratio>=1.25?'medium-large':ratio>=1.15?'medium':ratio>=1.05?'small':'tiny';
    add(buckets,rk,r,hiBP,loBP);
    const riA=R.indexOf(a.rarity),riB=R.indexOf(b.rarity);
    const gap=Math.abs(riA-riB);
    const gk=gap>=8?'8+':gap>=5?'5-7':gap>=3?'3-4':gap===2?'2':gap===1?'1':'same';
    add(gapBuckets,gk,r,hiBP,loBP);
    i++;
  }
  const summarize=(m)=>{const out={};for(const [k,b] of Object.entries(m)){out[k]={count:b.count,higherWinRate:Math.round(b.hiWins/b.count*1000)/1000,lowerWinRate:Math.round(b.loWins/b.count*1000)/1000,drawRate:Math.round(b.draws/b.count*1000)/1000};}return out;};
  const bpBuckets=summarize(buckets);
  const gapRes=summarize(gapBuckets);
  const result={nCards,nPairs,byBpRatio:bpBuckets,byRarityGap:gapRes};
  fs.writeFileSync(path.join(ROOT,'qa/empirical-strength.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({nCards,nPairs,byBpRatio:bpBuckets,byRarityGap:gapRes},null,2));
  return result;
}
if(require.main===module)run({nCards:Number(process.argv[2])||1200,nPairs:Number(process.argv[3])||3000});
module.exports={run};