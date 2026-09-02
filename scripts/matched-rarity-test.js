// v1.2.2 Matched-Seed Rarity Test (audit §10/§11/§13/§15).
//
// Two distinct rarity questions, reported separately:
//   A. Causal Rarity Effect  (matched-seed): same seed + archetype + level across
//      C/C+/B/... keeps the SAME skill grammar roll / passive/trigger blueprint /
//      composition structure (verified: kinds/targets/effects/statuses identical,
//      only rarity budget changes coefficients). Battling LOW vs HIGH of the SAME
//      seed answers: "同一张卡牌胚子提升一个稀有度后，是否真的变强？"
//   B. Population Strength    (independent random seeds): is the higher-rarity
//      population statistically stronger than the lower-rarity population?
//
// Statistics (audit §7-9/§15): CI by MATCHED-CARD bootstrap — the statistical unit
// is an independently generated matched card pair (not a single battle). DRAWS ARE
// REPORTED SEPARATELY: heal/shield mirrors can stall to maxRounds, and a draw is not
// a rarity loss. winRateHigherTier = CONDITIONAL higher win rate (draws excluded);
// drawRate is reported alongside so a stale mirror is visible but never misread as
// an inversion. Reports battle/generatedCard/seed/pair counts.
//
// Inversion thresholds (audit §13): Hard <40%, Mild 40-48%, Neutral 48-52%,
// Expected 52-62% (applied to the conditional win rate).
//
// Usage: node scripts/matched-rarity-test.js [--seeds K] [--battles M]
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const src=(f)=>require(path.join(root,'src',f));
global.NCB={};
for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower'])src(f);
const N=global.NCB;
function parseArg(name,dflt){const i=process.argv.indexOf('--'+name);return i>=0&&process.argv[i+1]?Number(process.argv[i+1])||dflt:dflt;}
const K=parseArg('seeds',48);
const BATTLES=parseArg('battles',8);
const MAX_ROUNDS=30;
const ARCHETYPES=Object.keys(N.ARCHETYPES);
const rarities=N.RARITY_V2_ORDER;

function buildLadders(){
  const ladders={};
  for(let s=0;s<K;s++){
    ladders[s]={};
    for(const a of ARCHETYPES){
      ladders[s][a]={};
      for(const r of rarities){
        const seed='ML_'+s+'_'+a;
        const card=N.generateCardV2({rarity:r,level:100,archetype:a,seed});
        ladders[s][a][r]=N.deployCardV2(card);
      }
    }
  }
  return ladders;
}
// returns {cond, draw}: conditional higher win rate + draw rate over battles x 2 dirs
function pairBattle(idHi,idLo,seedBase){
  const s1=N.runSimulation({seedBase,battles:BATTLES,maxRounds:MAX_ROUNDS,teamA:[idHi],teamB:[idLo]});
  const s2=N.runSimulation({seedBase:seedBase+1,battles:BATTLES,maxRounds:MAX_ROUNDS,teamA:[idLo],teamB:[idHi]});
  const hiWins=(s1.winRateA+s2.winRateB)/2;
  const loWins=(s1.winRateB+s2.winRateA)/2;
  const draw=Math.max(0,1-hiWins-loWins);
  const cond=hiWins+loWins>0?hiWins/(hiWins+loWins):0.5;
  return{cond,draw};
}
function bootstrapCI(xs,b=2000,alpha=0.05){
  const n=xs.length;const means=new Array(b);
  for(let k=0;k<b;k++){let s=0;for(let i=0;i<n;i++)s+=xs[(Math.random()*n)|0];means[k]=s/n;}
  means.sort((x,y)=>x-y);
  return{lo:means[Math.floor(b*alpha/2)],hi:means[Math.floor(b*(1-alpha/2))]};
}
function classify(wr){return wr<0.40?'HARD_INV':wr<0.48?'MILD_INV':wr<0.52?'NEUTRAL':'EXPECTED';}
function summarize(arr){const m=arr.reduce((x,y)=>x+y,0)/arr.length;const ci=bootstrapCI(arr);return{mean:m,ciLow:ci.lo,ciHigh:ci.hi,n:arr.length,class:classify(m)};}

(async()=>{
  const t0=Date.now();
  const ladders=buildLadders();
  const pairs=[];
  for(let i=0;i<rarities.length-1;i++)pairs.push([rarities[i],rarities[i+1]]);
  const perPairArch={};const perPairOverall={};
  for(const [loR,hiR] of pairs){
    const key=loR+'->'+hiR;
    perPairArch[key]={};perPairOverall[key]={matched:[],population:[],drawMatched:[],drawPop:[]};
    for(const a of ARCHETYPES){
      const matched=[],population=[],dM=[],dP=[];
      for(let s=0;s<K;s++){
        const rM=pairBattle(ladders[s][a][hiR],ladders[s][a][loR],100000+s*7+rarities.indexOf(loR)*13+ARCHETYPES.indexOf(a)*3);
        matched.push(rM.cond);dM.push(rM.draw);
        const s2=(s*37+11)%K;
        if(s2!==s){
          const rP=pairBattle(ladders[s][a][hiR],ladders[s2][a][loR],110000+s*7+rarities.indexOf(loR)*13+ARCHETYPES.indexOf(a)*3);
          population.push(rP.cond);dP.push(rP.draw);
        }
      }
      perPairArch[key][a]={matched,population,drawMatched:dM,drawPop:dP};
      perPairOverall[key].matched.push(...matched);perPairOverall[key].population.push(...population);
      perPairOverall[key].drawMatched.push(...dM);perPairOverall[key].drawPop.push(...dP);
    }
  }
  const report={version:'1.2.2',seeds:K,battlesPerDirection:BATTLES,maxRounds:MAX_ROUNDS,archetypes:ARCHETYPES.length,
    statisticalUnit:'independent matched card pair (bootstrap over pairs, not battles)',
    winRateNote:'CONDITIONAL higher-tier win rate (draws excluded); drawRate reported separately',
    rarityPairs:[]};
  let hardM=0,hardP=0;const hm=[],hp=[];
  for(const [loR,hiR] of pairs){
    const key=loR+'->'+hiR;
    const ovM=summarize(perPairOverall[key].matched);
    const ovP=summarize(perPairOverall[key].population);
    const dm=perPairOverall[key].drawMatched.reduce((x,y)=>x+y,0)/perPairOverall[key].drawMatched.length;
    const dp=perPairOverall[key].drawPop.reduce((x,y)=>x+y,0)/perPairOverall[key].drawPop.length;
    const arch={};
    for(const a of ARCHETYPES){
      const m=summarize(perPairArch[key][a].matched);
      const p=summarize(perPairArch[key][a].population);
      const dmA=perPairArch[key][a].drawMatched.reduce((x,y)=>x+y,0)/Math.max(1,perPairArch[key][a].drawMatched.length);
      const dpA=perPairArch[key][a].drawPop.reduce((x,y)=>x+y,0)/Math.max(1,perPairArch[key][a].drawPop.length);
      arch[a]={matched:{wr:m.mean,ciLow:m.ciLow,ciHigh:m.ciHigh,class:m.class,n:m.n,drawRate:dmA},
        population:{wr:p.mean,ciLow:p.ciLow,ciHigh:p.ciHigh,class:p.class,n:p.n,drawRate:dpA}};
      if(m.mean<0.40){hardM++;hm.push(`${a} ${key} matched ${m.mean.toFixed(3)}`);}
      if(p.mean<0.40){hardP++;hp.push(`${a} ${key} population ${p.mean.toFixed(3)}`);}
    }
    report.rarityPairs.push({pair:key,
      causalMatched:{wr:ovM.mean,ciLow:ovM.ciLow,ciHigh:ovM.ciHigh,n:ovM.n,class:ovM.class,drawRate:dm},
      population:{wr:ovP.mean,ciLow:ovP.ciLow,ciHigh:ovP.ciHigh,n:ovP.n,class:ovP.class,drawRate:dp},
      byArchetype:arch});
    console.log(`${key.padEnd(15)} MATCHED ${ovM.mean.toFixed(3)} [${ovM.ciLow.toFixed(3)}-${ovM.ciHigh.toFixed(3)}] ${ovM.class} d${(dm*100).toFixed(0)}% | POP ${ovP.mean.toFixed(3)} [${ovP.ciLow.toFixed(3)}-${ovP.ciHigh.toFixed(3)}] ${ovP.class} d${(dp*100).toFixed(0)}%`);
  }
  report.hardInversionsMatched=hardM;report.hardInversionsMatchedList=hm;
  report.hardInversionsPopulation=hardP;report.hardInversionsPopulationList=hp;
  report.archetypeConditioned={};
  for(const a of ARCHETYPES){
    const row={};
    for(const [loR,hiR] of pairs){const key=loR+'->'+hiR;row[key]=perPairArch[key][a].matched.reduce((x,y)=>x+y,0)/Math.max(1,perPairArch[key][a].matched.length);}
    report.archetypeConditioned[a]=row;
  }
  fs.writeFileSync(path.join(root,'qa','matched-rarity-test.json'),JSON.stringify(report,null,2));
  console.log(`hard inversions (<40%, conditional): matched ${hardM} · population ${hardP}`);
  if(hm.length)console.log('  matched hard:',hm.join(' | '));
  if(hp.length)console.log('  population hard:',hp.join(' | '));
  console.log('elapsed',((Date.now()-t0)/1000).toFixed(0),'s · data:',
    `independentSeedCount=${K} generatedCardCount=${K*ARCHETYPES.length*rarities.length} pairCount(cell)=${K}`);
  process.exit(0);
})();