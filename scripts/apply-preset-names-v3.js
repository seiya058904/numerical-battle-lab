'use strict';
// Apply the FINAL canonical preset names (Name Generator v3 hand-finished list)
// to content/presets-v5.json. NAME-ONLY migration: the ONLY changes are
//   * each card's name / displayName  -> canonical species name (index-aligned
//     with the e4a3179 baseline card order, which is seed-identical),
//   * top-level nameGeneratorVersion  -> 3.
// Every other field (id, identity, seed, originSeed, rarity, level, stats,
// actions, statuses, triggers, passives, resources, resistances, affinities,
// mechanicFingerprint, BattlePower, powerEnvelope, calibration, ...) is byte-
// identical, verified by a full JSON compare + per-card fingerprint compare.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const FILE=path.join(ROOT,'content/presets-v5.json');

const CANONICAL_NAMES=[
  '米洛','咕拉奇','诺米亚','布鲁米','啵洛安','莫里亚姆','咪诺拉','波奇姆','阿米洛','布洛奇安',
  '奇洛','卡维克','迪诺克','提拉奇','皮鲁特','比洛克','希诺特','维拉诺克','卡迪诺','奇米克亚',
  '克塔','塔鲁克','格洛恩','古罗德','达鲁姆','巴洛坦','摩格恩','博鲁克','格鲁安德','塔洛克恩',
  '洛菲','维洛恩','赛米亚','伊诺安','艾洛维','泽鲁亚','希拉恩','诺维姆','维米诺亚','赛拉维恩',
  '托鲁','巴奇洛','布拉姆','咕鲁克','鲁米塔','莫洛奇','拉迪安','卡诺拉','鲁奇恩塔','卡米洛安',
  '洛兰','奥兰姆','阿鲁恩','欧拉诺','伊赛诺','塔米洛','维赛安','赛鲁恩','阿鲁诺德','奥维兰恩',
];
if(CANONICAL_NAMES.length!==60)throw new Error('expected 60 canonical names');

const content=JSON.parse(fs.readFileSync(FILE,'utf8'));
if(content.cards.length!==60)throw new Error('expected 60 cards');
// snapshot everything except the two name fields for the "no other change" check
const before=content.cards.map(c=>({id:c.id,fp:c.mechanicFingerprint,rest:JSON.stringify(c,(k,v)=>k==='name'||k==='displayName'?undefined:v)}));
const beforeFps=before.map(b=>b.fp);

content.cards.forEach((c,i)=>{
  c.name=CANONICAL_NAMES[i];
  c.displayName=CANONICAL_NAMES[i];
});
content.nameGeneratorVersion=3;
content.nameGeneratorNote='Name Generator v3 canonical preset names (hand-finished; seed-ordered from baseline e4a3179)';

// verify: fingerprints unchanged 60/60, and the "rest" of each card unchanged
let fpOk=0,restOk=0;
content.cards.forEach((c,i)=>{
  if(c.mechanicFingerprint===beforeFps[i])fpOk++;
  const rest=JSON.stringify(c,(k,v)=>k==='name'||k==='displayName'?undefined:v);
  if(rest===before[i].rest)restOk++;
});
if(fpOk!==60||restOk!==60)throw new Error(`fingerprint ${fpOk}/60, no-other-change ${restOk}/60`);
const names=new Set(content.cards.map(c=>c.displayName));
if(names.size!==60)throw new Error('names must be 60/60 unique');
if(content.cards.some(c=>c.name.length<2||c.name.length>4))throw new Error('canonical names must be 2-4 chars');
const lenDist={};for(const c of content.cards)lenDist[c.name.length]=(lenDist[c.name.length]||0)+1;

fs.writeFileSync(FILE,JSON.stringify(content,null,2)+'\n');
fs.writeFileSync(path.join(ROOT,'content/presets-v5.js'),'(function(r){r.NCB.PRESET_V5_CONTENT='+JSON.stringify(content).replace(/<\/script/g,'<\\/script')+';})(typeof globalThis!==\'undefined\'?globalThis:window);\n');
console.log(JSON.stringify({cards:60,namesApplied:60,uniqueNames:60,fingerprintUnchanged:fpOk,otherFieldsUnchanged:restOk,lengthDistribution:lenDist}));
module.exports={CANONICAL_NAMES};