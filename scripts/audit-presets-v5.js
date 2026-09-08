'use strict';
// v5 preset QA audit — per-card envelope table + uniqueness + fingerprint.
// Writes qa/presets-v5-audit.json and prints a summary.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-v2','card-ui','presets'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;
const out=require(path.join(ROOT,'content/presets-v5.json'));
const rows=[],names=new Set(),fingerprints=new Set();let inEnv=0,dups=0,nonFinite=0;
for(const c of out.cards){
  const env=N.powerEnvelope(c.level,c.rarity);
  const bp=N.battlePowerV3(c).power;
  const inside=bp>=env.min&&bp<=env.max;
  if(inside)inEnv++;else dups++;
  if(!Number.isFinite(bp)||!Number.isFinite(c.stats.ATK)||!Number.isFinite(c.stats.MAX_HP))nonFinite++;
  names.add(c.displayName);fingerprints.add(c.mechanicFingerprint||JSON.stringify({actions:c.actions,statuses:c.statuses}));
  rows.push({name:c.displayName,seed:c.seed,level:c.level,rarity:c.rarity,envelopeMin:Math.round(env.min),envelopeMax:Math.round(env.max),battlePower:bp,insideEnvelope:inside,mechanicFingerprint:c.mechanicFingerprint});
}
// verify structure-preservation vs source v4 (fingerprints should match a fresh recompute)
const src=require(path.join(ROOT,'content/presets-v4.json'));
let structurePreserved=0;
for(const s of src.cards){const m=out.cards.find(x=>x.seed===s.seed&&x.level===s.level&&x.rarity===s.rarity);if(m){const fresh=N.mechanicFingerprint(m);if(fresh===m.mechanicFingerprint)structurePreserved++;}}
const result={total:out.cards.length,insideEnvelope:inEnv,outOfEnvelope:dups,uniqueNames:names.size,nonFinite,
  structureSelfConsistent:structurePreserved,version:out.version,generatorVersion:out.generatorVersion,powerEnvelopeVersion:out.powerEnvelopeVersion,nameGeneratorVersion:out.nameGeneratorVersion,rows};
fs.writeFileSync(path.join(ROOT,'qa/presets-v5-audit.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({total:result.total,uniqueNames:result.uniqueNames,insideEnvelope:result.insideEnvelope,outOfEnvelope:result.outOfEnvelope,nonFinite,structureSelfConsistent:result.structureSelfConsistent},null,2));
if(result.outOfEnvelope||result.uniqueNames!==result.total||result.nonFinite)process.exitCode=1;
module.exports={run:()=>result};