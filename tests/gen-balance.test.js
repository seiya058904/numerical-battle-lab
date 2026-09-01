const test=require('node:test');
const assert=require('node:assert/strict');
function load(){
  for(const f of ['kernel','power','gen-balance'])delete require.cache[require.resolve('../src/'+f+'.js')];
  global.NCB={};for(const f of ['kernel','power','gen-balance'])require('../src/'+f+'.js');
  return global.NCB;
}
// Note on spec 3: the formula ExpectedWin=PA^3/(PA^3+PB^3) is the canonical definition;
// the prose percentages (up-1 ~56-58, up-2 ~63-67, up-3 ~70-75, up-4 ~78-82) are a reference
// line and the spec explicitly says they are not hard per-matchup requirements. The tests
// below assert the formula's actual deterministic outputs (SSS vs C ~90% matches prose; the
// lower rungs land just below the prose ranges because RPI steps are ~+9-11%).
test('expectedWinRate implements the canonical cube formula',()=>{
  const N=load();
  assert.equal(N.expectedWinRate(100,100),0.5);
  // SSS vs C ~90% (matches prose)
  const ssc=N.expectedWinRate(207,100);
  assert.ok(ssc>0.88&&ssc<0.92,ssc);
  // up-4 A(141) vs C(100): formula => ~73.7% (prose ~78-82 is aspirational)
  const a4=N.expectedWinRate(141,100);
  assert.ok(Math.abs(a4-0.737)<0.02,a4);
  // up-3 B+(129): ~68.2%
  const a3=N.expectedWinRate(129,100);
  assert.ok(Math.abs(a3-0.682)<0.02,a3);
  // up-2 B(118): ~62.2%
  const a2=N.expectedWinRate(118,100);
  assert.ok(Math.abs(a2-0.622)<0.02,a2);
  // up-1 C+(108): ~55.7%
  const a1=N.expectedWinRate(108,100);
  assert.ok(Math.abs(a1-0.557)<0.02,a1);
  // monotonic: stronger side always has >50%
  assert.ok(N.expectedWinRate(118,100)>0.5);
  assert.ok(N.expectedWinRate(100,118)<0.5);
  // symmetry
  assert.ok(Math.abs(N.expectedWinRate(118,100)+N.expectedWinRate(100,118)-1)<1e-9);
});
test('expectedWinRate guards zero and non-finite',()=>{
  const N=load();
  assert.equal(N.expectedWinRate(0,100),0);
  assert.equal(N.expectedWinRate(100,0),1);
  assert.equal(N.expectedWinRate(0,0),0.5);
  assert.throws(()=>N.expectedWinRate(NaN,100),/non-finite/);
});
test('expectedRarityWin uses RPI',()=>{
  const N=load();
  const w=N.expectedRarityWin('SSS','C');
  assert.ok(w>0.88);
});