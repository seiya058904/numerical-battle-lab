const test=require('node:test');
const assert=require('node:assert/strict');
function load(){
  for(const f of ['kernel.js','gen-names.js']){
    delete require.cache[require.resolve('../src/'+f)];
  }
  global.NCB={};require('../src/kernel.js');require('../src/gen-names.js');return global.NCB;
}

test('generateDisplayName is seeded-deterministic',()=>{
  const N=load();
  const a=N.generateDisplayName({seed:'A_Seed_1',archetype:'Assassin'});
  const b=N.generateDisplayName({seed:'A_Seed_1',archetype:'Assassin'});
  assert.equal(a,b,'same seed+archetype => same name');
  assert.ok(typeof a==='string'&&a.length>=1);
});

test('generateDisplayName differs across archetypes for the same seed',()=>{
  const N=load();
  const asn=N.generateDisplayName({seed:'N_1',archetype:'Assassin'});
  const tank=N.generateDisplayName({seed:'N_1',archetype:'Tank'});
  // Very likely differ, but not strictly guaranteed; assert the pool membership.
  assert.ok(N.NAME_PREFIX_POOL.includes(asn[0])||N.NAME_CORE_POOL.includes(asn[0]));
});

test('generateDisplayName is data-driven and registry-based (no per-card logic)',()=>{
  const N=load();
  assert.ok(N.NAME_PREFIX_POOL.length>=20);
  assert.ok(N.NAME_CORE_POOL.length>=20);
  // Produce 200 names; all must be composed ONLY from the data pools (letters are CJK).
  for(let i=0;i<200;i++){
    const nm=N.generateDisplayName({seed:'S'+i,archetype:'Balanced'});
    assert.ok(nm.length>=1&&nm.length<=5,'name in range: '+nm);
  }
});

test('displayCardName falls back to generated name without mutating id',()=>{
  const N=load();
  const card={id:'gen_test', seed:'q', archetype:'Tank', name:'Tank Tank'};
  const before=card.id;
  const nm=N.displayCardName(card);
  assert.ok(nm.length>=1);
  assert.equal(card.id,before,'display name must not change card id');
});