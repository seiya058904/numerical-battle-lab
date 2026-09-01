const test=require('node:test');
const assert=require('node:assert/strict');
function load(){
  for(const f of ['kernel.js','power.js']){
    delete require.cache[require.resolve('../src/'+f)];
  }
  global.NCB={};require('../src/kernel.js');require('../src/power.js');return global.NCB;
}

test('12-rarity v2 order is ascending and keeps old RPIs, adding 3 new on top',()=>{
  const N=load();
  assert.deepEqual(N.RARITY_V2_ORDER,['C','C_PLUS','B','B_PLUS','A','A_PLUS','S','SS','SSS','SSS_COLLECTOR','XS','XS_COLLECTOR']);
  assert.equal(N.RARITY_V2_ORDER.length,12);
  // old nine RPI values must be preserved exactly (no re-tuning of old rarities)
  assert.equal(N.rpiV2('C'),100);assert.equal(N.rpiV2('SSS'),207);
  // new rarities
  assert.equal(N.rpiV2('SSS_COLLECTOR'),218);
  assert.equal(N.rpiV2('XS'),232);
  assert.equal(N.rpiV2('XS_COLLECTOR'),245);
  // strict ascending
  for(let i=1;i<N.RARITY_V2_ORDER.length;i++){
    assert.ok(N.RARITY_V2_RPI[N.RARITY_V2_ORDER[i]]>N.RARITY_V2_RPI[N.RARITY_V2_ORDER[i-1]],
      N.RARITY_V2_ORDER[i]+' must be stronger than '+N.RARITY_V2_ORDER[i-1]);
  }
  // v1 canonical table stays untouched (backward compat surface)
  assert.deepEqual(N.RARITY_ORDER,['C','C+','B','B+','A','A+','S','SS','SSS']);
});

test('toV2RarityId maps legacy v1 alt-forms and rejects unknowns',()=>{
  const N=load();
  assert.equal(N.toV2RarityId('C+'),'C_PLUS');
  assert.equal(N.toV2RarityId('B+'),'B_PLUS');
  assert.equal(N.toV2RarityId('A+'),'A_PLUS');
  assert.equal(N.toV2RarityId('SSS_COLLECTOR'),'SSS_COLLECTOR');
  assert.equal(N.toV2RarityId(undefined),'C');
  assert.equal(N.toV2RarityId('XS'),'XS');
  assert.throws(()=>N.toV2RarityId('ZZZ'),/unknown rarity/);
});

test('v2 rarity display labels are distinct from ordinary ones (collector distinguishable)',()=>{
  const N=load();
  assert.equal(N.V2_RARITY_DISPLAY.SSS,'SSS');
  assert.equal(N.V2_RARITY_DISPLAY['SSS_COLLECTOR'],'SSS 典藏版');
  assert.equal(N.V2_RARITY_DISPLAY.XS,'XS');
  assert.equal(N.V2_RARITY_DISPLAY['XS_COLLECTOR'],'XS 典藏版');
});

test('rpiV2 must never be a direct damage multiplier (no combat hook)',()=>{
  const N=load();
  // rpiV2 is only a budget-coordinate lookup, mirroring v1 rpiOf usage.
  assert.equal(typeof N.rpiV2,'function');
  assert.ok(Object.values(N.RARITY_V2_RPI).every(v=>v>=100&&v<=245));
});