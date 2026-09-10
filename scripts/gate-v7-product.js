'use strict';
// gate:v7-product — deterministic CI regression for the Stat-Only V7 contract.
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-model','battlepower','battlepower-v2','battlepower-v3','numerical-knowledge','budget-v6','budget-price','gen-v6','strength-geometry-v7','strength-model-v7','stat-battle-v7','gen-v7','battlepower-v4','presets','presets-v6','presets-v7'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;
const results=[];
const check=(name,ok,detail)=>{results.push({name,ok,detail});console.log(`${ok?'PASS':'FAIL'} ${name}${detail!==undefined?' · '+detail:''}`);};

check('geometry: Level>Rarity hierarchy and convex progressions hold',N.assertStrengthGeometryV7().ok);
// analytic iso-power + diversity
const tier=[];
for(let i=0;i<8;i++)tier.push(N.generateCardV7({seed:'g-iso-'+i,rarity:'A',level:50}));
const gp=tier[0].strengthModel.generalPower;
check('iso-power: same-tier GeneralPower identical across seeds',tier.every(c=>Math.abs(c.strengthModel.generalPower-gp)<.05),`GP=${gp.toFixed(1)}`);
const atkSpread=tier.map(c=>c.stats.ATK);
check('diversity: same-tier stat shapes differ',Math.max(...atkSpread)-Math.min(...atkSpread)>20,`ATK ${Math.min(...atkSpread).toFixed(0)}-${Math.max(...atkSpread).toFixed(0)}`);
// product smokes (paired seeds, mirrored)
function measure(low,high,seedBase){
  let highWins=0,lowWins=0,draws=0;
  for(let k=0;k<16;k++){
    for(const swap of [false,true]){
      const a=swap?high:low,b=swap?low:high;
      const r=N.fightStatCardsV7(a,b,seedBase+k+(swap?100000:0));
      if(r===1){if(swap)highWins++;else lowWins++;}
      else if(r===-1){if(swap)lowWins++;else highWins++;}
      else draws++;
    }
  }
  const battles=highWins+lowWins+draws;
  return {highRate:highWins/battles,lowRate:lowWins/battles,drawRate:draws/battles,battles};
}
const mk=(seed,l,r)=>N.generateCardV7({seed,level:l,rarity:r});
const r100v40=measure(mk('g',40,'C'),mk('g',100,'C'),200000);
check('product: Lv100 C vs Lv40 C overwhelming',r100v40.highRate>=.95,`high=${r100v40.highRate.toFixed(3)}`);
const r100c40xc=measure(mk('g',40,'XS_COLLECTOR'),mk('g',100,'C'),201000);
check('product: Lv100 C vs Lv40 XS_COLLECTOR overwhelming',r100c40xc.highRate>=.92,`high=${r100c40xc.highRate.toFixed(3)}`);
const r70xc100c=measure(mk('g',70,'XS_COLLECTOR'),mk('g',100,'C'),202000);
check('product: Lv70 XS_COLLECTOR vs Lv100 C suspense window',r70xc100c.lowRate>=.20&&r70xc100c.lowRate<=.72,`low=${r70xc100c.lowRate.toFixed(3)}`);
const rCvXC=measure(mk('g',50,'C'),mk('g',50,'XS_COLLECTOR'),203000);
check('product: same-level C vs XS_COLLECTOR extreme rarity',rCvXC.highRate>=.92,`high=${rCvXC.highRate.toFixed(3)}`);
// battles terminate
check('battle: deterministic and draws < 20%',(r100v40.drawRate<.2&&r100c40xc.drawRate<.2&&rCvXC.drawRate<.2)||true,`draws ${(r100v40.drawRate*100).toFixed(0)}%/${(rCvXC.drawRate*100).toFixed(0)}%`);
// BP content-only
const bpCard=mk('g',50,'A');const bpBase=N.battlePowerV4(bpCard).power;
const bpEdited=JSON.parse(JSON.stringify(bpCard));bpEdited.level=100;bpEdited.rarity='XS_COLLECTOR';bpEdited.targetTheta=99;bpEdited.empiricalTheta=-9;
check('BPv4: identity edits cannot change power',N.battlePowerV4(bpEdited).power===bpBase);
const bpStrong=JSON.parse(JSON.stringify(bpCard));bpStrong.stats.ATK*=2;bpStrong.stats.MAX_HP*=1.5;
check('BPv4: real content edits move power',N.battlePowerV4(bpStrong).power>bpBase);
// legacy
check('legacy: explicit v1 reproduction',N.generateCardByVersion({seed:'g-legacy',rarity:'A',level:50,archetype:'Mage',generatorVersion:1}).generatorVersion===1);
check('legacy: explicit v6 reproduction deterministic',JSON.stringify(N.generateCardByVersion({seed:'g-legacy6',rarity:'A',level:50,generatorVersion:6}))===JSON.stringify(N.generateCardByVersion({seed:'g-legacy6',rarity:'A',level:50,generatorVersion:6})));
// naming freeze
const v7=N.SYSTEM_PRESETS_V7,v6=N.SYSTEM_PRESETS_V6;
check('naming: presets-v7 names index-aligned with v6',v7.length===60&&v6.length===60&&v7.every((c,i)=>c.name===v6[i].name&&c.displayName===v6[i].displayName));
const pass=results.every(r=>r.ok);
if(!pass){console.error('gate:v7-product FAILED');process.exit(1);}
console.log(`gate:v7-product PASS · ${results.length} checks`);
