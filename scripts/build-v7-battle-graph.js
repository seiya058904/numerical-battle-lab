'use strict';
// Build the Stat-Only V7 battle graph: 180 cards (15 seed families x 12 tiers),
// sparse connected graph, 12 paired Match Seeds per edge, mirrored sides,
// canonical stat-only battles, round cap 100 -> 37,440 battles.
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const {buildSparsePairsV7,splitCardFamiliesV7}=require('../src/empirical-strength-v7.js');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','strength-model-v7','stat-battle-v7','gen-v7','battlepower-v4'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB;
const familyCount=Number(process.argv[2]||15),seedsPerPair=Number(process.argv[3]||12),roundCap=Number(process.argv[4]||100);
const tiers=[[20,'A'],[40,'C'],[40,'XS_COLLECTOR'],[50,'C'],[50,'A'],[50,'XS_COLLECTOR'],[70,'XS'],[70,'XS_COLLECTOR'],[75,'A'],[100,'C'],[100,'A'],[100,'XS_COLLECTOR']];
const cards=[];
for(let family=0;family<familyCount;family++)for(const [level,rarity] of tiers){
  const card=N.generateCardV7({seed:`v7-family-${family}`,level,rarity});
  cards.push({id:card.id,seed:card.seed,level,rarity,targetTheta:card.targetTheta,generalPower:card.strengthModel.generalPower,battlePower:card.strengthModel.battlePower,card});
}
const plan=buildSparsePairsV7(cards),byId=new Map(cards.map(card=>[card.id,card]));
const edges=[];let index=0;
for(const pair of plan){
  const a=byId.get(pair.a).card,b=byId.get(pair.b).card;
  let winsA=0,winsB=0,draws=0,teamAWins=0,teamBWins=0;
  for(let k=0;k<seedsPerPair;k++){
    const seed=830000+index*97+k;
    const r1=N.fightStatCardsV7(a,b,seed,roundCap);
    if(r1===1){winsA++;teamAWins++;}else if(r1===-1){winsB++;teamBWins++;}else draws++;
    const r2=N.fightStatCardsV7(b,a,seed,roundCap);
    if(r2===1){winsB++;teamAWins++;}else if(r2===-1){winsA++;teamBWins++;}else draws++;
  }
  edges.push({...pair,winsA,winsB,draws,teamAWins,teamBWins,battles:winsA+winsB+draws});index++;
}
const split=splitCardFamiliesV7(cards,card=>card.seed);
const artifact={schemaVersion:1,generatorVersion:7,methodology:{graph:'connected sparse',cards:cards.length,families:familyCount,tiers:tiers.length,pairedMatchSeeds:seedsPerPair,mirroredSides:true,canonicalStatOnlyBattle:true,roundCap},
  split:Object.fromEntries(Object.entries(split).map(([key,rows])=>[key,rows.map(row=>row.id)])),
  cards:cards.map(({card,...row})=>row),edges};
const output=path.join(ROOT,'qa/v7-battle-graph.json');
fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({output:path.relative(ROOT,output),cards:cards.length,edges:edges.length,battles:edges.reduce((sum,edge)=>sum+edge.battles,0)},null,2));
