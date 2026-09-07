const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','battlepower-model','battlepower','card-ui','presets'])require('../src/'+f+'.js');
const N=global.NCB;

test('system presets: 14 cards, 7 archetypes x2 each',()=>{
  assert.equal(N.SYSTEM_PRESETS.length,14);
  const byArchetype={};
  for(const c of N.SYSTEM_PRESETS){byArchetype[c.archetype]=(byArchetype[c.archetype]||0)+1;}
  for(const [arch,n] of Object.entries(byArchetype))assert.ok(n>=2,`archetype ${arch} has only ${n}`);
  assert.deepEqual(Object.keys(byArchetype).sort(),['Assassin','Balanced','Bruiser','Controller','Mage','Support','Tank']);
});

test('system presets: cover all 12 rarity tiers',()=>{
  const tiers=new Set(N.SYSTEM_PRESETS.map(c=>c.rarity));
  for(const t of ['C','C_PLUS','B','B_PLUS','A','A_PLUS','S','SS','SSS','SSS_COLLECTOR','XS','XS_COLLECTOR'])assert.ok(tiers.has(t),`missing rarity tier ${t}`);
  assert.equal(tiers.size,12);
});

test('system presets: all Generator v3, deterministic, valid content, distinct names',()=>{
  const names=new Set();
  for(const c of N.SYSTEM_PRESETS){
    assert.equal(c.generatorVersion,3);
    assert.ok(c.actions.length>=2&&c.actions.length<=6);
    const regen=N.generateCardV3({seed:c.seed,rarity:c.rarity,level:c.level,archetype:c.archetype});
    assert.deepEqual(c.stats,regen.stats);
    assert.equal(c.id,regen.id);
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
  assert.equal(N.battlePowerOf(meta),Math.round(N.battlePower(meta).power));

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
  const rebuild=N.generateCardV3({seed:copy.seed,rarity:copy.rarity,level:copy.level,archetype:copy.archetype});
  assert.equal(rebuild.actions.length,preset.actions.length);
  assert.deepEqual(rebuild.stats,preset.stats);
});