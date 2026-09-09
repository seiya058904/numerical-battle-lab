'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const {buildSparsePairsV7,splitCardFamiliesV7}=require('../src/empirical-strength-v7.js');
const {scoreMirroredPair}=require('../src/strength-audit-v6.js');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB;
const familyCount=Number(process.argv[2]||6),seedsPerPair=Number(process.argv[3]||3),roundCap=Number(process.argv[4]||100);
const tiers=[[20,'A'],[40,'C'],[40,'XS_COLLECTOR'],[50,'C'],[50,'A'],[50,'XS_COLLECTOR'],[70,'XS'],[70,'XS_COLLECTOR'],[75,'A'],[100,'C'],[100,'A'],[100,'XS_COLLECTOR']];
const cards=[];
for(let family=0;family<familyCount;family++)for(const [level,rarity] of tiers){
  const card=N.generateCardV7({seed:`v7-family-${family}`,level,rarity});
  const dominant=Object.entries(card.styleGenome).sort((a,b)=>b[1]-a[1])[0][0];
  cards.push({id:card.id,seed:card.seed,level,rarity,targetTheta:card.targetTheta,predictedTheta:card.strengthModel.predictedTheta,style:dominant,shapeFeatures:N.strengthShapeVectorV7(card),card});
}
const plan=buildSparsePairsV7(cards),byId=new Map(cards.map(card=>[card.id,card]));
function fight(left,right,seed){
  N.deployCard(left);N.deployCard(right);
  const engine=N.createBattle({seed:N.deriveSeed(seed),teamA:[left.id],teamB:[right.id],maxRounds:roundCap});
  let guard=0;while(!engine.outcome().ended&&guard++<roundCap*2+40)engine.resolveRound([...N.planAI(engine,'A','canonical'),...N.planAI(engine,'B','canonical')]);
  const winner=engine.outcome().winner;return winner==='A'?1:winner==='B'?-1:0;
}
const edges=[];let index=0;
for(const pair of plan){
  const a=byId.get(pair.a),b=byId.get(pair.b);let winsA=0,winsB=0,draws=0,teamAWins=0,teamBWins=0;
  for(let k=0;k<seedsPerPair;k++){
    const counts=scoreMirroredPair(a.card,b.card,830000+index*97+k,fight);
    winsA+=counts.lowerWins;winsB+=counts.higherWins;draws+=counts.draws;teamAWins+=counts.teamAWins;teamBWins+=counts.teamBWins;
  }
  edges.push({...pair,winsA,winsB,draws,teamAWins,teamBWins,battles:winsA+winsB+draws});index++;
}
const split=splitCardFamiliesV7(cards,card=>card.seed);
const artifact={schemaVersion:1,generatorVersion:7,methodology:{graph:'connected sparse',cards:cards.length,families:familyCount,tiers:tiers.length,pairedMatchSeeds:seedsPerPair,mirroredSides:true,canonicalAI:true,roundCap},
  split:Object.fromEntries(Object.entries(split).map(([key,rows])=>[key,rows.map(row=>row.id)])),
  cards:cards.map(({card,...row})=>row),edges};
const output=path.join(ROOT,'qa/v7-battle-graph.json');fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({output:path.relative(ROOT,output),cards:cards.length,edges:edges.length,battles:edges.reduce((sum,edge)=>sum+edge.battles,0),split:Object.fromEntries(Object.entries(split).map(([key,rows])=>[key,rows.length]))},null,2));
