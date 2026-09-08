'use strict';
const fs=require('node:fs'),path=require('node:path');
const {emptyBattleCounts,addBattleCounts,scoreMirroredPair,summarizeBattleCounts}=require('../src/strength-audit-v6.js');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-model','battlepower','battlepower-v2','battlepower-v3','numerical-knowledge','budget-v6','budget-price','gen-v6'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB,cards=require('../content/presets-v6.json').cards,PER=Number(process.argv[2])||1,RMAX=Number(process.argv[3])||100;
function fight(a,b,seed){N.deployCard(a);N.deployCard(b);const e=N.createBattle({seed:N.deriveSeed(seed),teamA:[a.id],teamB:[b.id],maxRounds:RMAX});let g=0;while(!e.outcome().ended&&g++<Math.min(900,RMAX*2+40))e.resolveRound([...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')]);const winner=e.outcome().winner;return winner==='A'?1:(winner==='B'?-1:0);}
const rows=[];let totalBattles=0;
for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){
  const left=cards[i],right=cards[j],leftStrength=N.expectedStrengthV6(left.level,left.rarity),rightStrength=N.expectedStrengthV6(right.level,right.rarity);
  const high=leftStrength>=rightStrength?left:right,low=high===left?right:left,counts=emptyBattleCounts();
  for(let k=0;k<PER;k++)addBattleCounts(counts,scoreMirroredPair(low,high,N.deriveSeed(700000+i*10000+j*100+k),fight));
  const result=summarizeBattleCounts(counts);totalBattles+=result.battleCount;
  rows.push({left:{id:left.id,name:left.name,level:left.level,rarity:left.rarity},right:{id:right.id,name:right.name,level:right.level,rarity:right.rarity},higherExpected:high.id,expectedRatio:+(Math.max(leftStrength,rightStrength)/Math.min(leftStrength,rightStrength)).toFixed(3),...result});
}
const out={schemaVersion:1,methodology:{unit:'battle',pairedSideMirroring:true,pairedSeedPolicy:'same seed for both side assignments',confidenceInterval:'Wilson 95%'},cards:cards.length,matchups:rows.length,pairsPerMatchup:PER,totalBattles,rows};
fs.writeFileSync(path.join(ROOT,'qa/v6-preset-matchup-matrix.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({cards:cards.length,matchups:rows.length,pairsPerMatchup:PER,totalBattles}));
