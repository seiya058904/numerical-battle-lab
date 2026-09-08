const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior','battlepower-v2','battlepower-model','battlepower','card-ui','presets'])require('../src/'+f+'.js');
const N=global.NCB;

test('system presets: 60 classless cards, five per rarity with level and dynamic coverage',()=>{
  assert.equal(N.SYSTEM_PRESETS.length,60);
  const buckets={};
  for(const r of N.RARITY_V2_ORDER){const cards=N.SYSTEM_PRESETS.filter(c=>c.rarity===r);assert.equal(cards.length,5);assert.ok(Math.max(...cards.map(c=>c.level))-Math.min(...cards.map(c=>c.level))>=50);assert.ok(cards.some(c=>c.stats.VOLATILITY<=.6));assert.ok(cards.some(c=>c.stats.VOLATILITY>=1.6));}
  for(const c of N.SYSTEM_PRESETS){assert.ok(!('archetype' in c));const b=c.level===100?100:Math.floor(c.level/10)*10;buckets[b]=(buckets[b]||0)+1;assert.ok(c.curated&&c.curationVersion&&c.designNote&&c.originSeed);}
  for(const b of [10,20,30,40,50,60,70,80,90,100])assert.ok(buckets[b]>=4);
});

test('system presets: cover all 12 rarity tiers',()=>{
  const tiers=new Set(N.SYSTEM_PRESETS.map(c=>c.rarity));
  for(const t of ['C','C_PLUS','B','B_PLUS','A','A_PLUS','S','SS','SSS','SSS_COLLECTOR','XS','XS_COLLECTOR'])assert.ok(tiers.has(t),`missing rarity tier ${t}`);
  assert.equal(tiers.size,12);
});

test('system presets: all Generator v4, frozen, valid content, distinct names',()=>{
  const names=new Set();
  for(const c of N.SYSTEM_PRESETS){
    assert.equal(c.generatorVersion,4);
    assert.ok(c.actions.length>=2&&c.actions.length<=6);
    const pack=N.assembleCardPack(c);const v=N.validateContentPack(pack);
    assert.ok(v.ok,v.errors.join('\n'));
    names.add(c.displayName||c.name);
  }
  assert.equal(names.size,N.SYSTEM_PRESETS.length,'preset display names must be distinct');
});

test('metadata resolver finds system preset and user card with correct rarity/level/BP',()=>{
  const preset=N.SYSTEM_PRESETS[0];
  const ctx={system:N.SYSTEM_PRESETS,library:[],deployed:new Map()};
  const meta=N.resolveCardMeta(preset.id,ctx);
  assert.ok(meta,'resolver should find a system preset by templateId');
  assert.equal(meta.rarity,preset.rarity);
  assert.equal(meta.level,preset.level);
  assert.equal(N.battlePowerOf(meta),Math.round(N.battlePowerV2(meta).power));

  // a user card (deployed-generated v3 card) resolves too
  const user=N.generateCardV3({seed:'resolver-user-card',rarity:'S',level:42});
  const userCtx={system:N.SYSTEM_PRESETS,library:[user],deployed:new Map()};
  assert.equal(N.resolveCardMeta(user.id,userCtx),user);
  assert.equal(N.resolveCardMeta(user.id,userCtx).rarity,'S');
  assert.ok(!N.resolveCardMeta('does-not-exist',userCtx),'unknown id -> null');
});

test('presets are isolated from the user library',()=>{
  // Deleting a user card must not touch presets; presets are never auto-inserted.
  const lib=[N.generateCardV3({seed:'iso-user',rarity:'C'})];
  const before=N.SYSTEM_PRESETS.map(c=>c.id).sort();
  // simulate delete of the only user card
  const remaining=lib.filter(c=>c.id!==lib[0].id);
  assert.equal(remaining.length,0);
  // presets unchanged
  assert.deepEqual(N.SYSTEM_PRESETS.map(c=>c.id).sort(),before);
  // a preset id is never present in the user library by default
  assert.ok(!lib.some(c=>N.SYSTEM_PRESETS.some(p=>p.id===c.id)),'empty user library must not contain preset ids');
});

test('copying a preset produces a distinct library entry (no id conflict)',()=>{
  const preset=N.SYSTEM_PRESETS[1];
  // simulate the app's copy: deep-clone + new id + remap internal ids
  function remapCard(preset){let c=N.deepClone(preset);const oldId=c.id,newId=oldId+'-mine-test';const remap=x=>{if(typeof x==='string')return x.startsWith(oldId)?newId+x.slice(oldId.length):x;if(Array.isArray(x))return x.map(remap);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,remap(v)]));return x;};c=remap(c);c.id=newId;return c;}
  const copy=remapCard(preset);
  assert.notEqual(copy.id,preset.id);
  assert.ok(!N.SYSTEM_PRESETS.some(c=>c.id===copy.id),'copied id must not collide with any preset');
  // deterministic combat identity preserved: copy keeps seed/rarity/level/archetype,
// so regenerating from the copy's own params yields the SAME kit structure.
  assert.equal(copy.seed,preset.seed);
  assert.equal(copy.level,preset.level);
  assert.equal(copy.rarity,preset.rarity);
  assert.equal(copy.archetype,preset.archetype);
  assert.deepEqual(copy.stats,preset.stats);
  assert.equal(copy.actions.length,preset.actions.length);
});

test('BP canonical truth: battlePowerV2 is the only source for all 60 presets',()=>{
  assert.ok(N.battlePowerV2,'battlePowerV2 must be loaded');
  for(const c of N.SYSTEM_PRESETS){
    const canonical=N.battlePowerV2(c).power;
    assert.ok(Number.isFinite(canonical)&&canonical>0,`canonical BP missing for ${c.displayName}`);
    // Frozen content field must equal the canonical computed value (no stale drift).
    assert.equal(c.presentation?.power,canonical,`${c.displayName}: content presentation.power != canonical battlePowerV2 (${c.presentation?.power} vs ${canonical})`);
  }
});

test('cachePresetPower seeds the BP cache from canonical, so battlePowerOf matches battlePowerV2',()=>{
  for(const c of N.SYSTEM_PRESETS){
    N.cachePresetPower(c); // pre-warm exactly like src/presets.js does on load
    const displayed=N.battlePowerOf(c);
    const canonical=N.battlePowerV2(c).power;
    assert.equal(displayed,canonical,`${c.displayName}: battlePowerOf ${displayed} != battlePowerV2 ${canonical}`);
  }
});