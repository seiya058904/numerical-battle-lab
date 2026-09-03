const test=require('node:test');
const assert=require('node:assert/strict');
function load(){
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower-model','battlepower','card-ui'])
    delete require.cache[require.resolve('../src/'+f+'.js')];
  global.NCB={};
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower-model','battlepower','card-ui'])
    require('../src/'+f+'.js');
  return global.NCB;
}

test('V2_BUDGET_CURVE is strictly monotonic across RARITY_V2_ORDER (audit §5)',()=>{
  const N=load();
  const curve=N.V2_BUDGET_CURVE;
  assert.ok(curve&&typeof curve==='object','curve exported');
  const order=N.RARITY_V2_ORDER;
  assert.equal(order.length,12);
  let prev=-1;
  for(const r of order){
    const m=curve[r];
    assert.ok(Number.isFinite(m)&&m>0,'multiplier finite positive for '+r);
    assert.ok(m>prev,`V2_BUDGET_CURVE[${r}] ${m} must be > previous ${prev} (strictly monotonic)`);
    prev=m;
  }
  // anchor: C = 1.0 so C Lv100 Balanced keeps the ~1000 budget / ~10000 BP anchor
  assert.equal(curve.C,1.0);
});

test('v2GenerationBudget is deterministic and monotonic in rarity (audit §5)',()=>{
  const N=load();
  const g=r=>N.v2GenerationBudget({rarity:r,level:100,quality:1});
  let prev=0;
  for(const r of N.RARITY_V2_ORDER){
    const b=g(r);
    assert.ok(Number.isFinite(b)&&b>0);
    assert.ok(b>prev,'budget strictly rises with rarity');
    prev=b;
  }
  // deterministic
  assert.equal(g('A'),g('A'));
  // C anchor ~1000
  assert.ok(Math.abs(g('C')-1000)<1,'C Lv100 q=1 budget ~1000');
});

test('generateCardV2 uses the rarity budget curve (v2-only); v1 generationBudget untouched',()=>{
  const N=load();
  // v1 stays frozen (fixture test covers byte-for-byte); here just verify the
  // v2 card actually records a budget consistent with the curve.
  const card=N.generateCardV2({rarity:'SS',level:100,archetype:'Mage',seed:'BUDGET_V2_SS'});
  const expected=N.v2GenerationBudget({rarity:'SS',level:100,quality:card.quality});
  assert.ok(Math.abs(card.generationBudget-expected)<1,'card budget matches v2GenerationBudget');
  // higher rarity -> strictly higher budget for identical level/quality
  const low=N.generateCardV2({rarity:'C',level:100,archetype:'Mage',seed:'BUDGET_V2_C'});
  assert.ok(card.generationBudget>low.generationBudget,'SS budget > C budget');
});

test('V2_BUDGET_CURVE values are data-driven and documented (all 12 present)',()=>{
  const N=load();
  const expected=['C','C_PLUS','B','B_PLUS','A','A_PLUS','S','SS','SSS','SSS_COLLECTOR','XS','XS_COLLECTOR'];
  for(const r of expected)assert.ok(r in N.V2_BUDGET_CURVE,'curve covers '+r);
  for(const r of Object.keys(N.V2_BUDGET_CURVE))assert.ok(expected.includes(r),'no stray rarity '+r);
});