'use strict';
// Migrate the 60 official v6 presets to Generator v7 (presets-v7).
//
// Rules honored from the V7 spec:
//   * DO NOT break presets-v6 (kept as the frozen legacy catalog).
//   * Reuse the frozen Naming V3 canonical names verbatim (index-aligned with the
//     presets-v6 order) — NO renaming, NO name-generator calls.
//   * Each card is regenerated from the SAME seed/rarity/level, so its mechanic
//     skeleton is deterministic and seed-faithful under Generator v7 (Seed owns
//     form; Level x Rarity own total strength via TargetTheta and the solver).
//   * BattlePower v4 (content-only, reality-calibrated) is measured AFTER
//     generation and frozen into presentation.power, exactly like v6 froze v3.
//
// Output: content/presets-v7.json (+ presets-v7.js browser embed), 60 cards.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-model','battlepower','battlepower-v2','battlepower-v3','numerical-knowledge','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7','battlepower-v4'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;

const v6=JSON.parse(fs.readFileSync(path.join(ROOT,'content/presets-v6.json'),'utf8'));
if(v6.cards.length!==60)throw new Error('expected 60 v6 presets');

const bpModelPresent=fs.existsSync(path.join(ROOT,'calibration/battlepower-v4.json'));
if(!bpModelPresent)throw new Error('calibration/battlepower-v4.json missing: run scripts/audit-battlepower-v4.js after the final EmpiricalTheta exists');

const cards=[];
for(let i=0;i<60;i++){
  const src=v6.cards[i];
  const gen=N.generateCardV7({seed:src.seed,rarity:src.rarity,level:src.level});
  // frozen canonical name (index-aligned with the presets-v6 order)
  gen.name=src.name;
  gen.displayName=src.displayName;
  const bp=N.battlePowerV4(gen);
  if(!Number.isFinite(bp.power)||bp.power<=0)throw new Error('non-positive BPv4 power for '+gen.id);
  gen.power=bp.power;
  gen.presentation=gen.presentation||{};
  gen.presentation.power=bp.power;
  gen.originSeed=src.originSeed||src.seed;
  gen.curated=true;
  gen.curationVersion=3;
  gen.designNote=(src.designNote||'')+((src.designNote)?' | ':'')+'migrated to Generator v7 (Strength Geometry + iso-power solver); name frozen from Naming V3.';
  cards.push(gen);
}

const content={
  version:7,
  curationVersion:3,
  sourceVersion:6,
  generatorVersion:7,
  nameGeneratorVersion:3,
  nameGeneratorNote:'Naming V3 canonical names reused verbatim from presets-v6 (frozen, seed-ordered)',
  cards,
};

// ---- verification ----
const names=new Set(cards.map(c=>c.name));
if(names.size!==60)throw new Error('names must be 60/60 unique');
for(let i=0;i<60;i++){if(cards[i].name!==v6.cards[i].name)throw new Error('name order drift at '+i);}
if(cards.some(c=>c.name.length<2||c.name.length>4))throw new Error('canonical names must be 2-4 chars');
let valid=0;
for(const c of cards){
  const v=N.validateContentPack(N.assembleCardPack(c));
  if(!v.ok)throw new Error('invalid content pack for '+c.id+': '+v.errors.join('; '));
  if(!Number.isFinite(c.stats.ATK)||!Number.isFinite(c.stats.MAX_HP))throw new Error('non-finite stats '+c.id);
  if(Math.abs(c.targetTheta-N.targetThetaV7(c.level,c.rarity))>1e-5)throw new Error('targetTheta mismatch '+c.id);
  valid++;
}
const rarityCount={};for(const c of cards)rarityCount[c.rarity]=(rarityCount[c.rarity]||0)+1;
const victoryPaths={};for(const c of cards)victoryPaths[c.skeleton.victoryPath]=(victoryPaths[c.skeleton.victoryPath]||0)+1;
const lenDist={};for(const c of cards)lenDist[c.name.length]=(lenDist[c.name.length]||0)+1;
const bpRange=cards.reduce((acc,c)=>({min:Math.min(acc.min,c.power),max:Math.max(acc.max,c.power)}),{min:Infinity,max:0});

fs.writeFileSync(path.join(ROOT,'content/presets-v7.json'),JSON.stringify(content,null,2)+'\n');
fs.writeFileSync(path.join(ROOT,'content/presets-v7.js'),'(function(r){r.NCB.PRESET_V7_CONTENT='+JSON.stringify(content).replace(/<\/script/g,'<\\/script')+';})(typeof globalThis!==\'undefined\'?globalThis:window);\n');
console.log(JSON.stringify({cards:cards.length,namesApplied:60,namesUnique:60,nameOrderFrozen:true,validPacks:valid,rarityCount,victoryPaths,lengthDistribution:lenDist,battlePowerV4Range:bpRange}));
