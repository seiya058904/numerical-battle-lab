// BattlePower v2 empirical calibration (spec §25-26, §72).
//
// Generates a panel of v4 cards across rarity/level, plays them with the
// canonical AI (pair sampling), derives an empirical strength rating (Elo-like),
// then reports how well battlePowerV2 predicts it:
//   - Spearman correlation (BP vs empirical rating)
//   - pairwise ordering accuracy (of two cards, does BP order them like battles do?)
//   - rarity median trend (per-rarity BP distribution must move right)
//
// This is a DIAGNOSTIC tool, not a release gate: it reports real numbers and
// never fake-passes. The unit test runs a tiny sample to prove the pipeline;
// the real sample is run via `npm run calibration:v4`.
const fs=require('node:fs'),path=require('node:path');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior','battlepower-v2'])require('../src/'+f+'.js');
const N=global.NCB;

function spearman(xs,ys){
  const n=xs.length;if(n<3)return 0;
  const rank=a=>{const idx=a.map((v,i)=>[v,i]).sort((p,q)=>p[0]-q[0]);const r=new Array(n);let i=0;while(i<n){let j=i;while(j<n-1&&idx[j+1][0]===idx[i][0])j++;const avg=(i+j)/2+1;for(let k=i;k<=j;k++)r[idx[k][1]]=avg;i=j+1;}return r;};
  const rx=rank(xs),ry=rank(ys);
  const mx=rx.reduce((a,b)=>a+b,0)/n,my=ry.reduce((a,b)=>a+b,0)/n;
  let num=0,dx=0,dy=0;
  for(let i=0;i<n;i++){const a=rx[i]-mx,b=ry[i]-my;num+=a*b;dx+=a*a;dy+=b*b;}
  return dx&&dy?num/Math.sqrt(dx*dy):0;
}
function eloRatings(results,players){
  const rating=new Map();for(const p of players)rating.set(p,1400);
  for(const [a,b,w] of results){
    const ra=rating.get(a),rb=rating.get(b);
    const ea=1/(1+Math.pow(10,(rb-ra)/400)),eb=1-ea;
    const K=24;
    rating.set(a,ra+K*(w-ea));rating.set(b,rb+K*((1-w)-eb));
  }
  return rating;
}
function samplePairs(cards,nPairs,rngSeed){
  const prng=new N.Gen5PRNG(N.deriveSeed(N.seedHash?N.seedHash(String(rngSeed)):String(rngSeed)));
  const pick=n=>Math.floor(prng.random()*n);
  const pairs=[];const seen=new Set();
  let guard=0;
  while(pairs.length<nPairs&&guard++<nPairs*30){
    const i=pick(cards.length),j=pick(cards.length);
    if(i===j)continue;const key=i<j?i*10000+j:j*10000+i;
    if(seen.has(key))continue;seen.add(key);
    pairs.push([cards[i],cards[j]]);
  }
  return pairs;
}
function runCalibration(opts={}){
  const nCards=opts.cards||60,nPairs=opts.pairs||900;
  const cards=[];
  for(let i=0;i<nCards;i++){
    const rarity=N.RARITY_V2_ORDER[i%12];
    const level=10+((i*37)%91);
    cards.push(N.generateCardV4({seed:'cal-v4-'+i,rarity,level}));
  }
  // deploy all (distinct ids)
  const deployed=new Map();
  for(const c of cards){N.deployCard(c);deployed.set(c.id,c);}
  const players=cards.map(c=>c.id);
  const results=[];
  const maxRounds=opts.maxRounds||60;
  const pairs=samplePairs(cards,nPairs,'gen5,cal,1,2,3');
  for(let k=0;k<pairs.length;k++){
    const [a,b]=pairs[k];
    const e=N.createBattle({seed:N.deriveSeed(700000+k),teamA:[a.id],teamB:[b.id],maxRounds});
    let guard=0;
    while(!e.outcome().ended&&guard++<maxRounds)e.resolveRound([...N.planAI(e,'A'),...N.planAI(e,'B')]);
    const o=e.outcome();if(o.ended&&o.winner!=='draw'){
      const w=o.winner==='A'?1:0;
      results.push([a.id,b.id,w]);
    }
  }
  const rating=eloRatings(results,players);
  const rows=cards.map(c=>{
    const bp=N.battlePowerV2(c).power;
    return {id:c.id,rarity:c.rarity,level:c.level,bp,emp:rating.get(c.id)||1400};
  });
  const bpVals=rows.map(r=>r.bp),empVals=rows.map(r=>r.emp);
  const corr=spearman(bpVals,empVals);
  // pairwise ordering accuracy on decided pairs
  let agree=0,total=0;
  for(const [a,b,w] of results){
    const bpA=N.battlePowerV2(deployed.get(a)).power,bpB=N.battlePowerV2(deployed.get(b)).power;
    if(bpA===bpB)continue;total++;
    const bpSays=bpA>bpB?'A':'B';const battleSays=w===1?'A':'B';
    if(bpSays===battleSays)agree++;
  }
  const pairwise=total?agree/total:0;
  // rarity median trend
  const byRarity={};
  for(const r of rows)(byRarity[r.rarity]=byRarity[r.rarity]||[]).push(r.bp);
  const trend={};
  for(const [k,vs] of Object.entries(byRarity)){
    vs.sort((x,y)=>x-y);trend[k]={median:vs[Math.floor(vs.length/2)],min:vs[0],max:vs[vs.length-1]};
  }
  return{nCards,pairs:results.length,spearman:Math.round(corr*1000)/1000,pairwiseOrdering:Math.round(pairwise*1000)/1000,trend,byRarity};
}

if(require.main===module){
  const n=Number(process.argv[2])||60,p=Number(process.argv[3])||900;
  const report=runCalibration({cards:n,pairs:p});
  fs.mkdirSync(path.join(__dirname,'../qa'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,'../qa/power-v4-calibration.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,1));
}
module.exports={runCalibration,spearman};