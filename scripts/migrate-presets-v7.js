'use strict';
// Migrate the 60 official presets to Stat-Only Generator v7 (presets-v7).
// Names frozen from Naming V3, index-aligned with presets-v6; every card comes
// from the final generator; BattlePower (display of GeneralPower) is frozen into
// presentation.power.
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','strength-model-v7','stat-battle-v7','gen-v7','battlepower-v4'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;
const v6=JSON.parse(fs.readFileSync(path.join(ROOT,'content/presets-v6.json'),'utf8'));
if(v6.cards.length!==60)throw new Error('expected 60 v6 presets');
const cards=[];
for(let i=0;i<60;i++){
  const src=v6.cards[i];
  const gen=N.generateCardV7({seed:src.seed,rarity:src.rarity,level:src.level});
  gen.name=src.name;gen.displayName=src.displayName;
  const bp=N.battlePowerV7(gen);
  if(!Number.isFinite(bp)||bp<=0)throw new Error('non-positive BP for '+gen.id);
  gen.power=bp;
  gen.presentation=gen.presentation||{};gen.presentation.power=bp;
  gen.originSeed=src.originSeed||src.seed;gen.curated=true;gen.curationVersion=3;
  gen.designNote=(src.designNote||'')+((src.designNote)?' | ':'')+'migrated to Generator v7 (Stat-Only Numerical Battle); name frozen from Naming V3.';
  cards.push(gen);
}
const content={version:7,curationVersion:3,sourceVersion:6,generatorVersion:7,nameGeneratorVersion:3,
  nameGeneratorNote:'Naming V3 canonical names reused verbatim from presets-v6 (frozen, seed-ordered)',cards};
const names=new Set(cards.map(c=>c.name));
if(names.size!==60)throw new Error('names must be 60/60 unique');
for(let i=0;i<60;i++)if(cards[i].name!==v6.cards[i].name)throw new Error('name order drift at '+i);
for(const c of cards){
  const v=N.validateContentPack(N.assembleCardPack(c));
  if(!v.ok)throw new Error('invalid content pack for '+c.id+': '+v.errors.join('; '));
  if(Math.abs(c.targetTheta-N.targetThetaV7(c.level,c.rarity))>1e-5)throw new Error('targetTheta mismatch '+c.id);
}
fs.writeFileSync(path.join(ROOT,'content/presets-v7.json'),JSON.stringify(content,null,2)+'\n');
fs.writeFileSync(path.join(ROOT,'content/presets-v7.js'),'(function(r){r.NCB.PRESET_V7_CONTENT='+JSON.stringify(content).replace(/<\/script/g,'<\\/script')+';})(typeof globalThis!==\'undefined\'?globalThis:window);\n');
const rarityCount={};for(const c of cards)rarityCount[c.rarity]=(rarityCount[c.rarity]||0)+1;
console.log(JSON.stringify({cards:cards.length,namesApplied:60,namesUnique:60,nameOrderFrozen:true,rarityCount,battlePowerRange:[Math.min(...cards.map(c=>c.power)),Math.max(...cards.map(c=>c.power))]}));
