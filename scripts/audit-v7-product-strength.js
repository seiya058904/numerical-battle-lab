'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const {scoreMirroredPair,emptyBattleCounts,addBattleCounts}=require('../src/strength-audit-v6.js');
const {evaluateProductScenarioV7,wilsonIntervalV7}=require('../src/audit-statistics-v7.js');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB,population=Number(process.argv[2]||40),matchSeeds=Number(process.argv[3]||8),roundCap=100;
const scenarios=[
  ...['C','A','SSS','XS_COLLECTOR'].map(rarity=>({id:`lv40-vs-lv100-${rarity}`,low:{level:40,rarity},high:{level:100,rarity},gate:{higherMin:.99,lowerMax:.01,wilsonLowerMin:.98}})),
  {id:'lv40-xc-vs-lv100-c',low:{level:40,rarity:'XS_COLLECTOR'},high:{level:100,rarity:'C'},gate:{higherMin:.98,lowerMax:.015}},
  {id:'lv70-xc-vs-lv100-c',low:{level:70,rarity:'XS_COLLECTOR'},high:{level:100,rarity:'C'},gate:{lowerMin:.35,lowerMax:.70}},
  {id:'lv70-xs-vs-lv100-c',low:{level:70,rarity:'XS'},high:{level:100,rarity:'C'},gate:{lowerMin:.20,lowerMax:.45}},
  {id:'lv50-c-vs-lv50-xc',low:{level:50,rarity:'C'},high:{level:50,rarity:'XS_COLLECTOR'},gate:{higherMin:.99}},
  {id:'lv100-c-vs-lv100-xc',low:{level:100,rarity:'C'},high:{level:100,rarity:'XS_COLLECTOR'},gate:{higherMin:.99}},
];
function fight(left,right,seed){
  N.deployCard(left);N.deployCard(right);
  const engine=N.createBattle({seed:N.deriveSeed(seed),teamA:[left.id],teamB:[right.id],maxRounds:roundCap});
  let guard=0;while(!engine.outcome().ended&&guard++<roundCap*2+40)engine.resolveRound([...N.planAI(engine,'A','canonical'),...N.planAI(engine,'B','canonical')]);
  return engine.outcome().winner==='A'?1:engine.outcome().winner==='B'?-1:0;
}
const results=[];
for(let scenarioIndex=0;scenarioIndex<scenarios.length;scenarioIndex++){
  const scenario=scenarios[scenarioIndex],counts=emptyBattleCounts();
  for(let cardIndex=0;cardIndex<population;cardIndex++){
    const seedA=`v7-product-${scenarioIndex}-a-${cardIndex}`,seedB=`v7-product-${scenarioIndex}-b-${cardIndex}`;
    const pairs=[
      [N.generateCardV7({seed:seedA,...scenario.low}),N.generateCardV7({seed:seedB,...scenario.high})],
      [N.generateCardV7({seed:seedB,...scenario.low}),N.generateCardV7({seed:seedA,...scenario.high})],
    ];
    for(let orientation=0;orientation<pairs.length;orientation++)for(let matchIndex=0;matchIndex<matchSeeds;matchIndex++)addBattleCounts(counts,scoreMirroredPair(pairs[orientation][0],pairs[orientation][1],910000+scenarioIndex*100000+cardIndex*211+orientation*97+matchIndex,fight));
  }
  const evaluated=evaluateProductScenarioV7({higherWins:counts.higherWins,lowerWins:counts.lowerWins,draws:counts.draws},scenario.gate);
  results.push({...scenario,populationPerSide:population*2,seedPairs:population,pairedMatchSeeds:matchSeeds,mirroredSides:true,crossBalancedSeedFamilies:true,teamAWins:counts.teamAWins,teamBWins:counts.teamBWins,...evaluated});
  console.log(`${scenario.id}: high=${(evaluated.higherRate*100).toFixed(2)}% low=${(evaluated.lowerRate*100).toFixed(2)}% draw=${(evaluated.drawRate*100).toFixed(2)}% pass=${evaluated.pass}`);
}
const totals=results.reduce((sum,row)=>({battles:sum.battles+row.battles,teamAWins:sum.teamAWins+row.teamAWins,teamBWins:sum.teamBWins+row.teamBWins,draws:sum.draws+row.draws}),{battles:0,teamAWins:0,teamBWins:0,draws:0});
const decidedSideBattles=totals.teamAWins+totals.teamBWins,teamAWilson95=wilsonIntervalV7(totals.teamAWins,decidedSideBattles),sideBiasPass=teamAWilson95.lower<=.5&&teamAWilson95.upper>=.5;
const artifact={schemaVersion:1,generatorVersion:7,methodology:{populationPerSide:population*2,seedPairs:population,pairedMatchSeeds:matchSeeds,mirroredSides:true,crossBalancedSeedFamilies:true,canonicalAI:true,roundCap,allBattlesIncludedInRates:true},pass:results.every(row=>row.pass)&&sideBiasPass,totals:{...totals,teamAWinRate:totals.teamAWins/decidedSideBattles,teamAWilson95,sideBiasPass},scenarios:results};
const output=path.join(ROOT,'qa/v7-product-strength.json');fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({output:path.relative(ROOT,output),pass:artifact.pass,totals},null,2));
if(!artifact.pass)process.exitCode=1;
