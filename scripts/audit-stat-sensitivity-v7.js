'use strict';

function clone(value){
  return JSON.parse(JSON.stringify(value));
}

function round6(value){
  return Math.round(Number(value)*1e6)/1e6;
}

function perturbCardStat(card,stat,delta,options={}){
  const copy=clone(card);
  copy.stats=copy.stats||{};
  const base=Number(copy.stats[stat]||0);
  const next=options.percentagePoints?base+Number(delta):base*(1+Number(delta));
  copy.stats[stat]=round6(options.percentagePoints?Math.max(0,Math.min(100,next)):Math.max(0,next));
  return copy;
}

function centralSensitivity(card,stat,evaluate,options={}){
  const amount=options.percentagePoints?(options.delta??5):(options.delta??0.10);
  const low=perturbCardStat(card,stat,-amount,options);
  const high=perturbCardStat(card,stat,amount,options);
  const lowTheta=evaluate(low);
  const highTheta=evaluate(high);
  return {lowTheta,highTheta,deltaTheta:highTheta-lowTheta};
}

function empiricalThetaFromCounts(counts){
  const games=Number(counts.battleCount||0);
  if(!games)return 0;
  const score=Number(counts.higherWins||0)+Number(counts.draws||0)*0.5;
  const p=(score+0.5)/(games+1);
  return Math.log(p/(1-p));
}

function summarizeSamples(values){
  const sorted=values.slice().sort((a,b)=>a-b);
  const at=p=>sorted[Math.floor(p*(sorted.length-1))];
  return {p25:at(0.25),median:at(0.5),p75:at(0.75),min:sorted[0],max:sorted.at(-1)};
}

function buildSensitivityArtifact({version,cards,stats,evaluate,percentagePointStats=new Set(),metadata={}}){
  const axes={};
  for(const stat of stats){
    const percentagePoints=percentagePointStats.has(stat);
    const samples=cards.map(card=>{
      const result=centralSensitivity(card,stat,evaluate,{percentagePoints});
      return {cardId:card.id,lowTheta:round6(result.lowTheta),highTheta:round6(result.highTheta),deltaTheta:round6(result.deltaTheta)};
    });
    const summary=summarizeSamples(samples.map(row=>Math.abs(row.deltaTheta)));
    axes[stat]={perturbation:percentagePoints?'plus/minus 5 percentage points':'plus/minus 10 percent',samples,
      p25DeltaTheta:round6(summary.p25),medianDeltaTheta:round6(summary.median),p75DeltaTheta:round6(summary.p75),
      minDeltaTheta:round6(summary.min),maxDeltaTheta:round6(summary.max)};
  }
  return {schemaVersion:1,generatorVersion:version,method:'direct central perturbation; no regeneration or re-solving',...metadata,axes};
}

function auditSeedFor(cardId,opponentIndex,matchIndex){
  const text=`${cardId}|${opponentIndex}|${matchIndex}`;
  let hash=2166136261;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return 710000+(hash>>>0)%1000000000;
}

module.exports={perturbCardStat,centralSensitivity,empiricalThetaFromCounts,summarizeSamples,buildSensitivityArtifact,auditSeedFor};

if(require.main===module){
  const fs=require('node:fs');
  const path=require('node:path');
  const {emptyBattleCounts,addBattleCounts,scoreMirroredPair,summarizeBattleCounts}=require('../src/strength-audit-v6.js');
  const ROOT=path.resolve(__dirname,'..');
  for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-model','battlepower','battlepower-v2','battlepower-v3','numerical-knowledge','budget-v6','budget-price','gen-v6'])require(path.join(ROOT,'src',file+'.js'));
  const N=global.NCB;
  const version=Number(process.argv[2]||6);
  const cardCount=Number(process.argv[3]||6);
  const opponentCount=Number(process.argv[4]||6);
  const seedsPerPair=Number(process.argv[5]||2);
  const output=path.resolve(ROOT,process.argv[6]||`qa/v${version}-stat-sensitivity${version===6?'-baseline':''}.json`);
  const make=version===6?opts=>N.generateCardV6(opts):opts=>N.generateCardByVersion({...opts,generatorVersion:version});
  const cards=Array.from({length:cardCount},(_,i)=>make({seed:`v${version}-sensitivity-card-${i}`,rarity:'A',level:50}));
  const opponents=Array.from({length:opponentCount},(_,i)=>make({seed:`v${version}-sensitivity-opponent-${i}`,rarity:'A',level:50}));
  const sideTotals={teamAWins:0,teamBWins:0,draws:0,battles:0};
  function fight(a,b,seed){
    N.deployCard(a);N.deployCard(b);
    const engine=N.createBattle({seed:N.deriveSeed(seed),teamA:[a.id],teamB:[b.id],maxRounds:100});
    let guard=0;
    while(!engine.outcome().ended&&guard++<240)engine.resolveRound([...N.planAI(engine,'A','canonical'),...N.planAI(engine,'B','canonical')]);
    const winner=engine.outcome().winner;
    return winner==='A'?1:winner==='B'?-1:0;
  }
  function evaluate(card){
    const counts=emptyBattleCounts();
    for(let i=0;i<opponents.length;i++)for(let k=0;k<seedsPerPair;k++){
      const seed=auditSeedFor(card.id,i,k);
      addBattleCounts(counts,scoreMirroredPair(opponents[i],card,seed,fight));
    }
    sideTotals.teamAWins+=counts.teamAWins;sideTotals.teamBWins+=counts.teamBWins;
    sideTotals.draws+=counts.draws;sideTotals.battles+=counts.battleCount;
    return empiricalThetaFromCounts(counts);
  }
  const stats=['ATK','MAX_HP','DEF','RES','SPD','ACC','EVA','CRIT','PEN','HEAL_POWER','ENERGY_REGEN'];
  const artifact=buildSensitivityArtifact({version,cards,stats,evaluate,percentagePointStats:new Set(['CRIT','PEN']),metadata:{
    baselineHead:version===6?'09fd48fb10c70f28ad65b7392457335a7d4d1afe':null,
    population:{cards:cardCount,opponents:opponentCount,matchSeedsPerPair:seedsPerPair,mirroredSides:true,truth:'canonical AI vs AI battles'},
  }});
  artifact.teamSide={...sideTotals,teamAWinRate:round6(sideTotals.teamAWins/sideTotals.battles),teamBWinRate:round6(sideTotals.teamBWins/sideTotals.battles),drawRate:round6(sideTotals.draws/sideTotals.battles)};
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');
  console.log(JSON.stringify({output:path.relative(ROOT,output),axes:Object.fromEntries(Object.entries(artifact.axes).map(([key,value])=>[key,value.medianDeltaTheta])),teamSide:artifact.teamSide},null,2));
}
