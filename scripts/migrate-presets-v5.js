'use strict';
// Migrate the curated v4 preset catalog to the v5 canonical catalog.
// For every frozen preset we PRESERVE: id, structure (actions/statuses/triggers/
// passives/resourceRegens => the mechanic fingerprint), seed, rarity, level,
// originSeed, curated fields, design note, and the earlier manual fixes.
// Two independent operations are applied:
//   1) Naming -> regenerated via Name Generator v2 (seed + structural identity;
//      independent of level/rarity/BattlePower).
//   2) Strength -> the LEVEL × RARITY PowerEnvelope target is baked into the REAL
//      numbers via battlepower-v3 bounded calibration (only continuous magnitudes
//      scale; cooldown/cost/resource/status/discrete fields are untouched), so the
//      canonical BattlePower v3 lands inside that card's rarity band at its level.
// The output is content/presets-v5.json (+ .js). presets-v4.json is left intact
// as the legacy/compat fixture.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','gen-v2','gen-v3','gen-v4','behavior','battlepower-v2','card-ui'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;

const src=require(path.join(ROOT,'content/presets-v4.json'));
if(src.cards.length!==60)throw new Error('expected 60 curated v4 presets');
const out={version:5,curationVersion:3,sourceVersion:4,generatorVersion:5,powerEnvelopeVersion:1,nameGeneratorVersion:2,cards:[]};
const assignName=N.createNameRegistrar();
const usedIds=new Set();
for(const c of src.cards){
  // 1) strength: recalibrate the real numbers into the Level×Rarity envelope.
  const target=N.targetPower(c.level,c.rarity,c.seed);
  const env=N.powerEnvelope(c.level,c.rarity);
  const calib=N.battlePowerV3Calibrate(c,target,{maxIterations:30,tolerance:0.004,envelope:{min:env.min,max:env.max}});
  let m=calib.card;
  m.generatorVersion=5;
  // Recompute the fingerprint from the card's ACTUAL current structure. The four
  // stored v4 fingerprints below were already stale in the committed data (a prior
  // human review edited structure without refreshing the stored hash); calibration
  // only moves numbers so it never alters structure. We record any correction.
  m.mechanicFingerprint=N.mechanicFingerprint(m);
  if(c.mechanicFingerprint&&m.mechanicFingerprint!==c.mechanicFingerprint){
    console.warn('[info] fingerprint recomputed for',c.displayName,'(stored value was stale)');
  }
  // 2) naming: species proper-name owned by seed + structural identity.
  m.name=assignName(m);m.displayName=m.name;
  usedIds.add(m.id);
  const bp=N.battlePowerV3(m).power;
  m.power=Math.round(bp);
  m.targetPower=Math.round(target);
  m.powerEnvelope={min:Math.round(env.min),target:Math.round(env.target),max:Math.round(env.max)};
  m._calibration={target:Math.round(target),delta:Math.round((bp-target)*10)/10,iterations:calib.iterations,converged:calib.converged};
  m.presentation=m.presentation||{};
  m.presentation.power=Math.round(bp);
  m.presentation.powerEnvelope={min:Math.round(env.min),target:Math.round(target),max:Math.round(env.max)};
  m.presentation.mechanicFingerprint=m.mechanicFingerprint;
  if(c.originSeed)m.originSeed=c.originSeed;
  m.curated=true;m.curationVersion=3;// migrated
  if(c.designNote)m.designNote=c.designNote;
  out.cards.push(m);
}
if(out.cards.length!==60)throw new Error('migration produced '+out.cards.length+' cards');
// verification: all inside envelope, all names unique, all id unique
let inEnv=0;
for(const m of out.cards){
  const env=N.powerEnvelope(m.level,m.rarity);
  const bp=N.battlePowerV3(m).power;
  if(bp>=env.min*0.995&&bp<=env.max*1.005)inEnv++;
}
console.log('migrated cards:',out.cards.length,'inside-envelope:',inEnv);
console.log('unique names:',new Set(out.cards.map(c=>c.displayName)).size,'unique ids:',usedIds.size);
fs.writeFileSync(path.join(ROOT,'content/presets-v5.json'),JSON.stringify(out,null,2)+'\n');
// also emit the browser embed (mirror of presets-v4.js)
fs.writeFileSync(path.join(ROOT,'content/presets-v5.js'),'(function(r){r.NCB.PRESET_V5_CONTENT='+JSON.stringify(out).replace(/<\/script/g,'<\\/script')+';})(typeof globalThis!==\'undefined\'?globalThis:window);\n');
console.log('wrote content/presets-v5.json + content/presets-v5.js');