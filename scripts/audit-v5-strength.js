'use strict';
// v5 strength audit: PowerEnvelope compliance + Level audit + Rarity audit +
// explicit C+ vs A+ regression + Battle Reality Monte Carlo (cross-rarity).
// Writes qa/power-envelope-v5.json. Fails if any envelope/hierarchy rule breaks.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-v2','card-ui','presets'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;

function run(){
  const envLevels=[1,10,25,50,75,100];
  const envelopeSample=[];let envFailures=0;
  for(const L of envLevels){
    const row={level:L,bands:{}};
    for(const r of N.RARITY_V2_ORDER){
      const e=N.powerEnvelope(L,r);row.bands[r]={min:Math.round(e.min),max:Math.round(e.max)};
      for(let i=0;i<12;i++){
        const c=N.generateCardV5({seed:`pe-${L}-${r}-${i}`,rarity:r,level:L});
        if(!(c.power>=e.min&&c.power<=e.max))envFailures++;
      }
    }
    envelopeSample.push(row);
  }
  // cross-seed regression: all C+ Lv100 BP < all A+ Lv100 BP
  let cMax=0,aMin=Infinity;
  for(let i=0;i<250;i++){const cp=N.generateCardV5({seed:'cs-c-'+i,rarity:'C_PLUS',level:100}).power;const ap=N.generateCardV5({seed:'cs-a-'+i,rarity:'A_PLUS',level:100}).power;if(cp>cMax)cMax=cp;if(ap<aMin)aMin=ap;}
  const crossOk=cMax<aMin;
  // level ladder same seed+rarity
  let levelOk=true;const levelLadder=[];
  for(const seed of ['la','lb']){
    const row={seed,values:{}};let prev=-1;
    for(const L of envLevels){const bp=N.generateCardV5({seed,rarity:'A',level:L}).power;row.values[L]=bp;if(bp<=prev)levelOk=false;prev=bp;}
    levelLadder.push(row);
  }
  // rarity ladder same seed Lv100
  let rarityOk=true;const rarityLadder={};
  {let prev=-1;for(const r of N.RARITY_V2_ORDER){const bp=N.generateCardV5({seed:'rari',rarity:r,level:100}).power;rarityLadder[r]=bp;if(bp<=prev)rarityOk=false;prev=bp;}}
  // Battle Reality Monte Carlo: aggregate winrates by rarity gap (higher=team A).
  const R=N.RARITY_V2_ORDER;
  const pairDefs=[
    {label:'same-rarity',lo:'A',hi:'A'},
    {label:'adjacent-1',lo:'A',hi:'A_PLUS'},
    {label:'2-tier-gap',lo:'A',hi:'S'},
    {label:'4-tier-gap',lo:'A',hi:'SS'},
    {label:'C_vs_S',lo:'C',hi:'S'},
    {label:'A_vs_SSS',lo:'A',hi:'SSS'},
    {label:'S_vs_XS',lo:'S',hi:'XS'},
  ];
  const mc={};
  for(const def of pairDefs){
    const lo=def.lo,hi=def.hi;let hiWins=0,loWins=0,draws=0,battles=0;
    for(let i=0;i<96;i++){
      const hiCard=N.generateCardV5({seed:'mc-hi-'+def.label+'-'+i,rarity:hi,level:100});
      const loCard=N.generateCardV5({seed:'mc-lo-'+def.label+'-'+i,rarity:lo,level:100});
      N.deployCard(hiCard);N.deployCard(loCard);
      const e=N.createBattle({seed:N.deriveSeed(Number('981'+i)+0),teamA:[hiCard.id],teamB:[loCard.id],maxRounds:150});
      let g=0;while(!e.outcome().ended&&g++<120)e.resolveRound([...N.planAI(e,'A'),...N.planAI(e,'B')]);
      battles++;
      const w=e.outcome().winner;
      if(w==='A')hiWins++;else if(w==='B')loWins++;else draws++;
    }
    mc[def.label]={hi:def.hi,lo:def.lo,hiWins,loWins,draws,battles,
      higherWinRate:Math.round(hiWins/battles*1000)/1000,lowerWinRate:Math.round(loWins/battles*1000)/1000,drawRate:Math.round(draws/battles*1000)/1000};
  }
  const result={powerEnvelopeVersion:1,envelopeLevels:envLevels,envelopeFailures:envFailures,crossRarityCplusVsAplus:{cMax,aMin,ok:crossOk},
    levelLadderOk:levelOk,levelLadder,rarityLadderOk:rarityOk,rarityLadder,monteCarlo:mc};
  fs.writeFileSync(path.join(ROOT,'qa/power-envelope-v5.json'),JSON.stringify(result,null,2)+'\n');
  const ok=envFailures===0&&crossOk&&levelOk&&rarityOk;
  console.log(JSON.stringify({envelopeFailures:envFailures,envLevels,crossRarityCplusVsAplus:{cMax,aMin,ok:crossOk},levelOk,rarityOk,
    monteCarlo:Object.fromEntries(Object.entries(mc).map(([k,v])=>[k,{higher:v.higherWinRate,lower:v.lowerWinRate,draw:v.drawRate}]))},null,2));
  if(!ok)process.exitCode=1;
  return result;
}
if(require.main===module)run();
module.exports={run};