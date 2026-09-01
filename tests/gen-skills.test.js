const test=require('node:test');
const assert=require('node:assert/strict');
function load(){
  for(const f of ['kernel','power','gen-stats','components','rules','content','gen-skills'])delete require.cache[require.resolve('../src/'+f+'.js')];
  global.NCB={};
  for(const f of ['kernel','power','gen-stats','components','rules','content','gen-skills'])require('../src/'+f+'.js');
  return global.NCB;
}
test('refSkillCost combines target/accuracy/cooldown factors',()=>{
  const N=load();
  const single=N.refSkillCost({rawPower:1.5,targetCount:1,accuracy:1.0,cooldown:0});
  const aoe=N.refSkillCost({rawPower:0.75,targetCount:6,accuracy:1.0,cooldown:0});
  assert.ok(aoe>single,'aoe 6 targets at 0.75 base costs more than single 1.5');
  const lowAcc=N.refSkillCost({rawPower:1.2,accuracy:0.7,cooldown:0});
  assert.ok(lowAcc<single+1e-9,'low accuracy lowers long-term cost');
  const cd2=N.refSkillCost({rawPower:2.0,accuracy:1.0,cooldown:2});
  assert.equal(cd2,N.refSkillCost({rawPower:2.0,accuracy:1.0,cooldown:2}));
  assert.ok(cd2<2,'longer cooldown lowers per-use cost');
  // priority premium
  const fast=N.refSkillCost({rawPower:1,accuracy:1,cooldown:0,priority:2});
  assert.ok(fast>1,'priority>0 is a premium');
});
test('target factor table matches spec',()=>{
  const N=load();
  const t=N.SKILL_FACTORS.targetMulti;
  assert.equal(t(1),1);assert.equal(t(0),0.85); // self
  assert.equal(t(2),1.55);assert.equal(t(3),2.0);assert.equal(t(4),2.4);assert.equal(t(5),2.75);assert.equal(t(6),3.05);
});
test('SKILL_RECIPES is a finite validated kit referencing real components',()=>{
  const N=load();
  assert.ok(N.SKILL_RECIPES.length>=10,'expected >=10 recipes, got '+N.SKILL_RECIPES.length);
  for(const r of N.SKILL_RECIPES){
    assert.ok(r.id&&r.kind&&r.target&&r.effects&&r.scaling,r.id+' missing required fields');
    assert.ok(N.EFFECT_COMPONENTS[r.effectType],r.id+' unknown effect '+r.effectType);
    assert.ok(N.TARGET_COMPONENTS[r.target],r.id+' unknown target '+r.target);
    if(r.damageType)assert.ok(N.DAMAGE_TYPES[r.damageType],r.id+' unknown damageType');
    if(r.status)assert.ok(N.STATUS_DEFS[r.status],r.id+' unknown status '+r.status);
  }
  assert.ok(N.SKILL_RECIPES.some(r=>r.kind==='damage'&&r.target==='all-enemies'),'has an AoE recipe');
  assert.ok(N.SKILL_RECIPES.some(r=>r.kind==='heal'),'has a heal recipe');
  assert.ok(N.SKILL_RECIPES.some(r=>r.kind==='shield'),'has a shield recipe');
});
test('recipeBaseCost is finite and positive',()=>{
  const N=load();
  for(const r of N.SKILL_RECIPES){const c=N.recipeBaseCost(r);assert.ok(Number.isFinite(c)&&c>0,r.id+' base cost '+c);}
});

test('refSkillCost integrates the self-target 0.85 factor via real cost (targetCount=0)',()=>{
  const N=load();
  // Regression: `targetCount || 1` used to coerce 0 -> 1, so the self 0.85 never
  // reached the real cost. Nullish default must keep 0 and apply the 0.85 factor.
  const self=N.refSkillCost({rawPower:1,targetCount:0,accuracy:1,cooldown:0,priority:0});
  assert.equal(self,0.85,'self target must cost 0.85x');
  const single=N.refSkillCost({rawPower:1,targetCount:1,accuracy:1,cooldown:0,priority:0});
  assert.equal(single,1,'single target costs 1x');
  // shield/fortify recipes are self-targeting (targetCount 0) and must reflect 0.85
  for(const r of N.SKILL_RECIPES)if(r.target==='self'){
    assert.equal(r.targetCount,0,r.id+' self recipe targetCount must be 0');
    const base=N.recipeBaseCost(r);
    const asSingle=N.refSkillCost({rawPower:1,targetCount:1,accuracy:r.accuracy,cooldown:r.cooldown,priority:r.priority});
    assert.ok(base<asSingle,r.id+' self base cost must be cheaper than the same skill counted as single-target');
  }
});

test('penetration raises reference cost (more pen => higher cost => lower coefficient under same budget)',()=>{
  const N=load();
  const base={rawPower:1,targetCount:1,accuracy:1,cooldown:0,priority:0};
  const zero=N.refSkillCost({...base,penetration:0});
  const twenty=N.refSkillCost({...base,penetration:20});
  assert.ok(twenty>zero,'20 pen must cost more than 0 pen: '+twenty+' vs '+zero);
  assert.ok(N.refSkillCost({...base,penetration:40})>twenty,'40 pen costs more than 20');
  // pierce recipe carries the unified penetrationBonus field (no penBonus alias)
  const pierce=N.SKILL_RECIPES.find(r=>r.id==='pierce');
  assert.ok(pierce,'pierce recipe exists');
  assert.equal(pierce.penetrationBonus,20,'pierce uses penetrationBonus=20');
  assert.equal(pierce.penBonus,undefined,'no penBonus alias remains');
  // recipeBaseCost accounts for the recipe's penetrationBonus
  const clone={...pierce,penetrationBonus:0};
  assert.ok(N.recipeBaseCost(pierce)>N.recipeBaseCost(clone),'pierce base cost includes its penetration');
});