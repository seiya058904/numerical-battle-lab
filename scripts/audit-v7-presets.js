'use strict';
// V7 preset reality smoke: real canonical-AI battles across the 60 presets.
//   * 12-rarity representative matrix (one card per rarity tier, mirrored pairs,
//     multiple fixed Match Seeds) -> the Level x Rarity hierarchy must hold.
//   * 3v3 smoke (explicit 1-6 team selection, canonical AI, new Match Seed).
//   * Side bias: team A vs team B must stay neutral.
// This is release evidence, NOT part of the CI regression.
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const {emptyBattleCounts,addBattleCounts,scoreMirroredPair,summarizeBattleCounts,wilson95}=require('../src/strength-audit-v6.js');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7','battlepower-v4','presets','presets-v6','presets-v7'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB;
const cards=N.SYSTEM_PRESETS_V7;
if(cards.length!==60)throw new Error('expected 60 v7 presets');
const seedsPerPair=Number(process.argv[2]||2),roundCap=100;
function fight(a,b,seed){
  N.deployCard(a);N.deployCard(b);
  const engine=N.createBattle({seed:N.deriveSeed(seed),teamA:[a.id],teamB:[b.id],maxRounds:roundCap});
  let guard=0;while(!engine.outcome().ended&&guard++<roundCap*2+40)engine.resolveRound([...N.planAI(engine,'A','canonical'),...N.planAI(engine,'B','canonical')]);
  const winner=engine.outcome().winner;return winner==='A'?1:winner==='B'?-1:0;
}
// --- 12-rarity representative matrix ---
const byRarity=new Map();for(const card of cards){if(!byRarity.has(card.rarity))byRarity.set(card.rarity,card);}
const reps=N.RARITY_V2_ORDER.map(rarity=>byRarity.get(rarity));
const matrix=[];
for(let i=0;i<reps.length;i++)for(let j=i+1;j<reps.length;j++){
  // Representatives carry different levels, so order each pair by TargetTheta
  // (not by rarity index) before scoring the mirrored pair.
  const thetaI=N.targetThetaV7(reps[i].level,reps[i].rarity),thetaJ=N.targetThetaV7(reps[j].level,reps[j].rarity);
  const low=thetaI<=thetaJ?reps[i]:reps[j],high=thetaI<=thetaJ?reps[j]:reps[i];
  const counts=emptyBattleCounts();
  for(let k=0;k<seedsPerPair;k++)addBattleCounts(counts,scoreMirroredPair(low,high,700000+i*1000+j*17+k,fight));
  const summary=summarizeBattleCounts(counts);
  matrix.push({a:{id:low.id,rarity:low.rarity,level:low.level,targetTheta:low.targetTheta},b:{id:high.id,rarity:high.rarity,level:high.level,targetTheta:high.targetTheta},...summary});
}
// the higher-TargetTheta card must win the majority of decided pairs
const decidedMatrix=matrix.filter(row=>row.higherWins!==row.lowerWins);
const hierarchyUpsets=decidedMatrix.filter(row=>row.higherWins<row.lowerWins);
// --- 3v3 smoke: explicit 3-card teams, canonical AI, mirrored orientation ---
// (a) distinct-team smoke: composition differs, so this checks validity/settlement,
//     not side bias; (b) identical-team mirror: the SAME three presets on both
//     sides decides side neutrality, where any A/B asymmetry is a real engine bias.
const teamCards=cards.slice(0,6);
function run3v3(seed,teamAIds,teamBIds){
  const engine=N.createBattle({seed:N.deriveSeed(seed),teamA:teamAIds,teamB:teamBIds,maxRounds:roundCap});
  let guard=0;while(!engine.outcome().ended&&guard++<roundCap*2+40)engine.resolveRound([...N.planAI(engine,'A','canonical'),...N.planAI(engine,'B','canonical')]);
  return {winner:engine.outcome().winner,rounds:engine.roundIndex,ended:engine.outcome().ended};
}
for(const card of teamCards)N.deployCard(card);
const distinct=teamCards.map(c=>c.id);
const teamAIds=distinct.slice(0,3),teamBIds=distinct.slice(3,6);
const threeVsThree=[];
for(let k=0;k<Math.max(4,seedsPerPair*2);k++)threeVsThree.push({...run3v3(830000+k,teamAIds,teamBIds),matchSeed:830000+k});
const distinctOutcomes=threeVsThree.reduce((acc,r)=>(acc[r.winner]=(acc[r.winner]||0)+1,acc),{});
// identical teams mirrored: swap which side gets the same three presets
const mirrorIds=distinct.slice(0,3);
const sideSamples=[];
for(let k=0;k<Math.max(6,seedsPerPair*3);k++){
  sideSamples.push({seed:840000+k,plain:run3v3(840000+k,mirrorIds,mirrorIds)});
}
let teamAWins=0,teamBWins=0,draws=0;
for(const sample of sideSamples){
  if(sample.plain.winner==='A')teamAWins++;else if(sample.plain.winner==='B')teamBWins++;else draws++;
}
const sideBattles=teamAWins+teamBWins,ci=wilson95(teamAWins,sideBattles);
const artifact={schemaVersion:1,generatorVersion:7,methodology:{presets:cards.length,representativeMatrix:{pairs:matrix.length,matchSeedsPerPair:seedsPerPair,mirroredSides:true,canonicalAI:true,roundCap,orderedBy:'TargetTheta per pair (representatives carry different levels)'},threeVsThree:{teams:'explicit slots, no autofill',distinctTeamCards:distinct,matchSeeds:threeVsThree.length,sideBiasProbe:'identical three presets on both sides, mirrored orientation'}},
  matrix,matrixSummary:{pairs:matrix.length,strictlyHigherTierPairs:decidedMatrix.length,hierarchyUpsets:hierarchyUpsets.length,upholdRate:decidedMatrix.length?(decidedMatrix.length-hierarchyUpsets.length)/decidedMatrix.length:1,worstUpsets:hierarchyUpsets.slice(0,5)},
  threeVsThree:{distinctTeamSamples:threeVsThree,distinctTeamOutcomes:distinctOutcomes,noInfinite:threeVsThree.every(r=>r.ended&&r.rounds<roundCap),
    identicalTeamSamples:sideSamples.length,teamAWins,teamBWins,draws,teamAWinRate:sideBattles?teamAWins/sideBattles:0,teamAWilson95:ci,sideBiasPass:ci.low<=.5&&ci.high>=.5}};
const output=path.join(ROOT,'qa/v7-preset-matrix.json');
fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({output:path.relative(ROOT,output),matrixPairs:matrix.length,hierarchyUpholdRate:artifact.matrixSummary.upholdRate,distinctTeamOutcomes:distinctOutcomes,sideBias:{teamAWins,teamBWins,draws,teamAWinRate:artifact.threeVsThree.teamAWinRate,sideBiasPass:artifact.threeVsThree.sideBiasPass}},null,2));

