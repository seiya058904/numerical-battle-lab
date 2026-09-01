// Monte Carlo smoke runner for generated cards (sub-plan 5, task 3).
// Generates one card per side, deploys it, and compares actual forward/swapped
// win rates against the ExpectedWin reference line. Report-only: no hard band.
const path=require('node:path');
const root=path.resolve(__dirname,'..');
global.NCB={};
for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-balance'])
  require(path.join(root,'src',f));
const N=global.NCB;

function matchup(seedBase,aCard,bCard,label){
  N.deployCard(aCard);N.deployCard(bCard);
  const A=[aCard.id],B=[bCard.id];
  const fwd=N.runSimulation({battles:80,seedBase,teamA:A,teamB:B,maxRounds:30});
  const swp=N.runSimulation({battles:80,seedBase,teamA:B,teamB:A,maxRounds:30});
  const actual=+((fwd.winRateA+swp.winRateB)/2).toFixed(3);
  const ref=+N.expectedWinRate(aCard.powerIndex,bCard.powerIndex).toFixed(3);
  console.log(label.padEnd(28),'A_power',String(aCard.powerIndex).padStart(6),'B_power',String(bCard.powerIndex).padStart(6),
    '| actual_first_side',String(actual).padStart(5),'| ref',String(ref).padStart(5));
}
console.log('GEN MC SMOKE — generated cards, 80 battles each direction (report only)');
matchup(11,N.generateCard({rarity:'C',level:100,archetype:'Balanced',seed:'mc-c'}),N.generateCard({rarity:'C',level:100,archetype:'Balanced',seed:'mc-c2'}),'C100 vs C100');
matchup(12,N.generateCard({rarity:'C',level:100,archetype:'Balanced',seed:'mc-c'}),N.generateCard({rarity:'A',level:100,archetype:'Balanced',seed:'mc-a'}),'C100 vs A100');
matchup(13,N.generateCard({rarity:'C',level:100,archetype:'Balanced',seed:'mc-c'}),N.generateCard({rarity:'SSS',level:100,archetype:'Balanced',seed:'mc-s'}),'C100 vs SSS100');
matchup(14,N.generateCard({rarity:'A',level:50,archetype:'Assassin',seed:'mc-a50'}),N.generateCard({rarity:'C',level:100,archetype:'Balanced',seed:'mc-c'}),'A50(asn) vs C100');
matchup(15,N.generateCard({rarity:'B',level:80,archetype:'Mage',seed:'mc-b80'}),N.generateCard({rarity:'A',level:50,archetype:'Tank',seed:'mc-a50t'}),'B80(mage) vs A50(tank)');
console.log('done');
