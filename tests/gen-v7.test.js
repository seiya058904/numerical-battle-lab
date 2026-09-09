const test=require('node:test');
const assert=require('node:assert/strict');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7'])require('../src/'+file+'.js');
const N=global.NCB;

test('V7 mechanic skeleton depends on seed only and is scalable',()=>{
  const a=N.mechanicSkeletonV7('same-seed');
  const b=N.mechanicSkeletonV7('same-seed');
  assert.deepEqual(a,b);
  assert.equal(a.scalable,true);
  assert.ok(a.actionFamilies.length>=2&&a.actionFamilies.length<=6);
});

test('V7 generation preserves fingerprint across level and rarity while changing only magnitudes',()=>{
  const low=N.generateCardV7({seed:'invariant-seed',rarity:'C',level:20});
  const high=N.generateCardV7({seed:'invariant-seed',rarity:'XS_COLLECTOR',level:100});
  assert.equal(low.mechanicFingerprint,high.mechanicFingerprint);
  assert.equal(low.generatorVersion,7);assert.equal(high.generatorVersion,7);
  assert.ok(high.stats.ATK!==low.stats.ATK||high.stats.MAX_HP!==low.stats.MAX_HP);
});

test('V7 solver converges to TargetTheta without Battle AI or BattlePower dependencies',()=>{
  const card=N.generateCardV7({seed:'solver-contract',rarity:'A',level:50});
  assert.ok(Math.abs(card.strengthModel.predictedTheta-card.targetTheta)<=.12);
  assert.ok(card.solver.converged);
  assert.equal(N.validateContentPack(N.assembleCardPack(card)).ok,true);
  for(const file of ['src/style-genome-v7.js','src/strength-model-v7.js','src/solver-v7.js','src/gen-v7.js']){
    const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..',file),'utf8');
    assert.doesNotMatch(source,/createBattle\s*\(|resolveRound\s*\(|planAI\s*\(|battlePowerV4\s*\(/);
  }
});

test('V7 output is deterministic and V6 remains the product default before final switch',()=>{
  const opts={seed:'deterministic-v7',rarity:'SS',level:70};
  assert.deepEqual(N.generateCardV7(opts),N.generateCardV7(opts));
  assert.equal(N.generateCardByVersion({seed:'still-v6',rarity:'A',level:50}).generatorVersion,6);
  assert.equal(N.generateCardByVersion({...opts,generatorVersion:6}).generatorVersion,6);
});

test('V7 cards carry a content-native cooldown pressure backbone across all styles',()=>{
  for(const seed of ['direct-style','support-style','control-style']){
    const card=NCB.generateCardV7({seed,level:50,rarity:'A'});
    const backbone=card.actions.find(action=>action.name==='基础攻势');
    assert.ok(backbone);
    assert.equal(backbone.cooldown,1);
    assert.equal(backbone.target,'enemy');
    assert.ok(backbone.effects.some(effect=>effect.type==='damage'&&effect.damageType==='true'&&effect.formula.includes('ATK')));
    for(const action of card.actions)assert.ok(action.effects.some(effect=>effect.type==='damage'&&effect.damageType==='true'&&effect.formula.includes('ATK')));
  }
});

test('V7 soft style preferences cannot create order-of-magnitude stat splits at equal target strength',()=>{
  const cards=Array.from({length:12},(_,index)=>NCB.generateCardV7({seed:'solver-balance-'+index,level:100,rarity:'A'}));
  for(const key of ['ATK','MAX_HP','DEF','RES']){
    const values=cards.map(card=>card.stats[key]);
    const limit=key==='ATK'||key==='MAX_HP'?3:5;
    assert.ok(Math.max(...values)/Math.min(...values)<limit,`${key} spread was ${Math.max(...values)/Math.min(...values)}`);
  }
});
