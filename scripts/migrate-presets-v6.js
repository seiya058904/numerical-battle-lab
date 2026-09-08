'use strict';
// Migrate the 60 official v5 presets to Generator v6 (presets-v6).
//
// Rules honored from the v6 spec:
//   * DO NOT break presets-v5 (kept as the frozen legacy catalog).
//   * Reuse the frozen Naming V3 canonical names verbatim (index-aligned with the
//     presets-v5 order) — NO renaming, NO name-generator calls.
//   * Mechanic identity preserved as much as possible: each card is regenerated
//     with the SAME seed/rarity/level, so its structural skeleton is deterministic
//     and seed-faithful under the v6 Power Budget Contract.
//   * The budget contract may re-tune numbers/coefficients/costs/cooldowns so the
//     card lands in its true Level x Rarity strength tier — that is the whole
//     point of Generator v6 (Level/Rarity own total strength; Seed owns form).
//
// Output: content/presets-v6.json (+ presets-v6.js browser embed), 60 cards.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-model','battlepower','battlepower-v2','battlepower-v3','numerical-knowledge','budget-v6','budget-price','gen-v6'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;

const v5=JSON.parse(fs.readFileSync(path.join(ROOT,'content/presets-v5.json'),'utf8'));
if(v5.cards.length!==60)throw new Error('expected 60 v5 presets');

const cards=[];
for(let i=0;i<60;i++){
  const src=v5.cards[i];
  const gen=N.generateCardV6({seed:src.seed,rarity:src.rarity,level:src.level});
  // frozen canonical name (index-aligned with the presets-v5 order)
  gen.name=src.name;
  gen.displayName=src.displayName;
  // curation provenance preserved
  gen.originSeed=src.originSeed||src.seed;
  gen.curated=true;
  gen.curationVersion=3;
  gen.designNote=(src.designNote||'')+((src.designNote)?' | ':'')+'migrated to Generator v6 (Power Budget Contract); name frozen from Naming V3.';
  cards.push(gen);
}

const content={
  version:6,
  curationVersion:3,
  sourceVersion:5,
  generatorVersion:6,
  nameGeneratorVersion:3,
  budgetVersion:N.BUDGET_V6_VERSION,
  nameGeneratorNote:'Naming V3 canonical names reused verbatim from presets-v5 (frozen, seed-ordered)',
  cards,
};

// ---- verification ----
const names=new Set(cards.map(c=>c.name));
if(names.size!==60)throw new Error('names must be 60/60 unique');
for(let i=0;i<60;i++){if(cards[i].name!==v5.cards[i].name)throw new Error('name order drift at '+i);}
if(cards.some(c=>c.name.length<2||c.name.length>4))throw new Error('canonical names must be 2-4 chars');
let valid=0;
for(const c of cards){
  const v=N.validateContentPack(N.assembleCardPack(c));
  if(!v.ok)throw new Error('invalid content pack for '+c.id+': '+v.errors.join('; '));
  if(!Number.isFinite(c.stats.ATK)||!Number.isFinite(c.stats.MAX_HP))throw new Error('non-finite stats '+c.id);
  if(!(c.strengthLedger&&c.strengthLedger.totalBudget===c.generationStrengthBudget))throw new Error('missing budget ledger '+c.id);
  valid++;
}
const rarityCount={};for(const c of cards)rarityCount[c.rarity]=(rarityCount[c.rarity]||0)+1;
const lenDist={};for(const c of cards)lenDist[c.name.length]=(lenDist[c.name.length]||0)+1;

fs.writeFileSync(path.join(ROOT,'content/presets-v6.json'),JSON.stringify(content,null,2)+'\n');
fs.writeFileSync(path.join(ROOT,'content/presets-v6.js'),'(function(r){r.NCB.PRESET_V6_CONTENT='+JSON.stringify(content).replace(/<\/script/g,'<\\/script')+';})(typeof globalThis!==\'undefined\'?globalThis:window);\n');
console.log(JSON.stringify({cards:cards.length,namesApplied:60,namesUnique:60,nameOrderFrozen:true,validPacks:valid,rarityCount,lengthDistribution:lenDist}));