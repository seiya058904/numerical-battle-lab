const test=require('node:test');
const assert=require('node:assert/strict');
function load(){
  for(const f of ['kernel','power','gen-stats'])delete require.cache[require.resolve('../src/'+f+'.js')];
  global.NCB={};require('../src/kernel.js');require('../src/power.js');require('../src/gen-stats.js');return global.NCB;
}
const SPEC={
  Balanced:{MAX_HP:.30,ATK:.25,DEF:.18,RES:.18,SPD:.09},
  Tank:{MAX_HP:.38,ATK:.14,DEF:.22,RES:.20,SPD:.06},
  Bruiser:{MAX_HP:.31,ATK:.29,DEF:.16,RES:.14,SPD:.10},
  Assassin:{MAX_HP:.20,ATK:.35,DEF:.10,RES:.08,SPD:.27},
  Mage:{MAX_HP:.23,ATK:.34,DEF:.08,RES:.17,SPD:.18},
  Support:{MAX_HP:.30,ATK:.14,DEF:.14,RES:.20,SPD:.22},
  Controller:{MAX_HP:.27,ATK:.17,DEF:.12,RES:.18,SPD:.26},
};
test('archetypes match spec, sum to 1; registerArchetype extends',()=>{
  const N=load();
  assert.deepEqual(N.PRIMARY_STAT_LIST,['MAX_HP','ATK','DEF','RES','SPD']);
  for(const [id,w] of Object.entries(SPEC)){
    assert.ok(N.ARCHETYPES[id],'missing '+id);
    const s=N.PRIMARY_STAT_LIST.reduce((a,x)=>a+(N.ARCHETYPES[id][x]||0),0);
    assert.ok(Math.abs(s-1)<1e-9,id+' sum '+s);
    for(const x of N.PRIMARY_STAT_LIST)assert.ok(Math.abs((N.ARCHETYPES[id][x]||0)-(w[x]||0))<1e-9);
  }
  N.registerArchetype('Zombie',{MAX_HP:.5,ATK:.1,DEF:.1,RES:.2,SPD:.1});
  assert.ok(N.ARCHETYPES.Zombie);
});
test('primary conversion matches spec',()=>{
  const N=load();
  const c=N.PRIMARY_CONVERSION;
  assert.equal(c.MAX_HP(0),600);assert.equal(c.MAX_HP(10),900);
  assert.equal(c.ATK(0),60);assert.equal(c.ATK(10),90);
  assert.equal(c.DEF(0),40);assert.equal(c.DEF(10),60);
  assert.equal(c.RES(0),40);assert.equal(c.RES(10),60);
  assert.equal(c.SPD(0),85);assert.equal(c.SPD(50),100);
});
test('allocatePrimary is seeded-deterministic, preserves total budget, honors archetype shape',()=>{
  const N=load();
  const a=N.allocatePrimary({budget:520,archetype:'Assassin',seed:'A1'});
  const b=N.allocatePrimary({budget:520,archetype:'Assassin',seed:'A1'});
  assert.deepEqual(a.statBP,b.statBP,'same seed same distribution');
  const tot=N.PRIMARY_STAT_LIST.reduce((s,x)=>s+a.statBP[x],0);
  assert.ok(Math.abs(tot-520)<3,'primary BP ~ budget, got '+tot);
  assert.ok(a.statBP.ATK>a.statBP.DEF,'assassin ATK>DEF');
  assert.ok(a.stats.ATK>=60&&a.stats.MAX_HP>=600);
  const c=N.allocatePrimary({budget:520,archetype:'Assassin',seed:'different'});
  const totC=N.PRIMARY_STAT_LIST.reduce((s,x)=>s+c.statBP[x],0);
  assert.ok(Math.abs(totC-520)<3);
});
test('allocatePrimary rejects unknown archetype',()=>{const N=load();assert.throws(()=>N.allocatePrimary({budget:100,archetype:'Nope',seed:'s'}),/unknown archetype/);});
test('allocateSecondary uses cost table, stays within bounds, is deterministic',()=>{
  const N=load();
  const o1=N.allocateSecondary({budget:130,seed:'S1'});
  const o2=N.allocateSecondary({budget:130,seed:'S1'});
  assert.deepEqual(o1,o2,'deterministic');
  const b=N.SECONDARY_BOUNDS;
  for(const k in o1.seconds){const v=o1.seconds[k];assert.ok(v>=b[k][0]-1e-6&&v<=b[k][1]+1e-6,k+'='+v+' bounds '+b[k]);}
  const base=N.SECONDARY_BASELINE;
  for(const k in base)if(!(k in o1.seconds))assert.equal(o1.seconds[k],base[k],k+' baseline');
  assert.ok(o1.spent>0,'should have spent some secondary budget');
});
test('secondary cost table matches spec',()=>{const N=load();assert.equal(N.SECONDARY_COST.ACC,2);assert.equal(N.SECONDARY_COST.CRIT,3);assert.equal(N.SECONDARY_COST.LIFESTEAL,3);assert.equal(N.SECONDARY_COST.REFLECT,4);});