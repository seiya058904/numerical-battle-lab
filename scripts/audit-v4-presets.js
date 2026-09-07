'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fight}=require('./audit-v4-battles.js');
const {effects,issues,timeProfile,levelDecade}=require('./select-v4-presets.js');
const N=global.NCB,cards=require('../content/presets-v4.json').cards;
function audit(){const rows=[],buckets={},rarities={},fingerprints=new Set(),errors=[];
 for(const [i,c] of cards.entries()){
  const ri=N.RARITY_V2_ORDER.indexOf(c.rarity),results=[];
  for(const [j,offset] of [-3,-1,0,0,1,3].entries()){
   const opponent=N.generateCardV4({seed:`preset-panel-${i}-${j}`,rarity:N.RARITY_V2_ORDER[Math.max(0,Math.min(11,ri+offset))],level:Math.max(10,Math.min(100,c.level+(j%3-1)*4))});
   results.push({opponent:opponent.seed,rarity:opponent.rarity,level:opponent.level,...fight(c,opponent,901000+i*10+j)});
  }
  const mirror=fight(c,c,921000+i),f=N.battlePowerV2(c),es=effects(c.actions),behavior=N.analyzeBehavior(c);
  const fp=crypto.createHash('sha256').update(c.mechanicFingerprint).digest('hex').slice(0,16);
  if(fingerprints.has(fp))errors.push(c.id+': duplicate');fingerprints.add(fp);
  const flaws=issues(c);if(flaws.length)errors.push(c.id+': '+flaws.join(','));
  const used=new Set(results.flatMap(r=>r.actions)),situational=c.actions.filter(a=>!used.has(a.id)).map(a=>a.name);
  if(results.some(r=>r.hardCap)||mirror.hardCap)errors.push(c.id+': hard cap');
  buckets[levelDecade(c.level)]=(buckets[levelDecade(c.level)]||0)+1;rarities[c.rarity]=(rarities[c.rarity]||0)+1;
  const result={name:c.displayName,id:c.id,rarity:c.rarity,level:c.level,power:f.power,tags:behavior.tags,fingerprint:fp,volatility:c.stats.VOLATILITY,luck:c.stats.LUCK,timeProfile:timeProfile(c),actionCount:c.actions.length,damageCapability:es.some(e=>e.type==='damage'),sustainCapability:es.some(e=>['heal','shield','ward'].includes(e.type)),designNote:c.designNote,unusedInPanel:situational,mirrorRounds:mirror.rounds,results};
  rows.push(result);
 }
 const nearDuplicates=[];
 for(let i=0;i<rows.length;i++)for(let j=0;j<i;j++){
  const a=cards[i],b=cards[j],ka=new Set(effects(a.actions).map(e=>e.type)),kb=new Set(effects(b.actions).map(e=>e.type)),intersection=[...ka].filter(k=>kb.has(k)).length;
  if(intersection/new Set([...ka,...kb]).size>=.95&&timeProfile(a)===timeProfile(b)&&Math.abs(a.stats.VOLATILITY-b.stats.VOLATILITY)<.3)nearDuplicates.push([a.displayName,b.displayName]);
 }
 return {total:cards.length,battles:cards.length*7,rarities,levelBuckets:buckets,errors,nearDuplicates,notes:'Unused actions are conditional/situational diagnostics, not proof of dead actions. Source semantic checks reject effects with no consumer. Six opponents per card: same/near level and lower/equal/higher rarity; seventh is mirror.',rows};
}
if(require.main===module){const r=audit();fs.writeFileSync(path.join(__dirname,'../qa/v4-preset-audit.json'),JSON.stringify(r,null,2)+'\n');
 fs.writeFileSync(path.join(__dirname,'../docs/V4-PRESET-TABLE.md'),'# 60 curated v4 presets\n\n| Name | Rarity | Lv | BP | Tags | Volatility | Time | Mirror rounds |\n|---|---|---:|---:|---|---:|---|---:|\n'+r.rows.map(x=>`| ${x.name} | ${x.rarity} | ${x.level} | ${x.power} | ${x.tags.join(' / ')} | ${x.volatility} | ${x.timeProfile} | ${x.mirrorRounds} |`).join('\n')+'\n');console.log(JSON.stringify({total:r.total,battles:r.battles,levelBuckets:r.levelBuckets,errors:r.errors,nearDuplicates:r.nearDuplicates}));if(r.errors.length)process.exitCode=1;}
module.exports={audit};
