const test=require('node:test');
const assert=require('node:assert/strict');
// Deterministic regression layer of gate:v7-product (battle smokes live in
// scripts/gate-v7-product.js, executed by verify:release).
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7','battlepower-v4','presets','presets-v6','presets-v7'])require('../src/'+file+'.js');
const N=global.NCB;

test('gate: strength geometry invariants hold (level span, convexity, anchors)',()=>{
  const g=N.assertStrengthGeometryV7();
  assert.equal(g.ok,true);
  assert.ok(g.fullLevelSpan>=2*g.fullRaritySpan);
  assert.ok(g.levelGap40To100-g.fullRaritySpan>=4.5);
  assert.ok(g.fullRaritySpan>=g.levelGap70To100);
  assert.equal(g.convexRarity,true);
  assert.equal(N.targetThetaV7(50,'A'),0);
  assert.ok(N.targetThetaV7(100,'C')-N.targetThetaV7(40,'XS_COLLECTOR')>4.5);
});

test('gate: solver converges to TargetTheta on representative tiers',()=>{
  for(const [level,rarity] of [[20,'C'],[40,'XS_COLLECTOR'],[50,'A'],[70,'XS'],[75,'A'],[100,'C'],[100,'XS_COLLECTOR']]){
    const card=N.generateCardV7({seed:'gate-solver-'+level+'-'+rarity,rarity,level});
    assert.equal(card.solver.converged,true,`converged ${level} ${rarity}`);
    assert.ok(Math.abs(card.strengthModel.predictedTheta-card.targetTheta)<=.12,`|pred-target| ${level} ${rarity}`);
    assert.equal(N.validateContentPack(N.assembleCardPack(card)).ok,true);
  }
});

test('gate: seed structure is invariant across level and rarity',()=>{
  const low=N.generateCardV7({seed:'gate-fp',rarity:'C',level:20});
  const high=N.generateCardV7({seed:'gate-fp',rarity:'XS_COLLECTOR',level:100});
  assert.equal(low.mechanicFingerprint,high.mechanicFingerprint);
});

test('gate: BattlePower v4 stays content-only (identity/budget/empirical edits cannot change features)',()=>{
  const card=N.generateCardV7({seed:'gate-bp',rarity:'A',level:50});
  const base=N.battlePowerV4FeaturesV4(card);
  const edited=JSON.parse(JSON.stringify(card));
  edited.level=100;edited.rarity='XS_COLLECTOR';edited.seed='other';
  edited.targetTheta=99;edited.expectedStrength=999;edited.generationStrengthBudget=1234;
  edited.empiricalTheta=-50;edited.generationBudget=99999;edited.power=1;
  assert.deepEqual(N.battlePowerV4FeaturesV4(edited),base);
  const stronger=JSON.parse(JSON.stringify(card));
  stronger.stats.ATK*=2;stronger.stats.MAX_HP*=1.5;
  const idx=N.BATTLEPOWER_V4_FEATURE_NAMES.indexOf('logAttackTotal');
  assert.ok(N.battlePowerV4FeaturesV4(stronger)[idx]>base[idx]);
});

test('gate: legacy v1/v6 reproduction is deterministic and neutral-100 axes stay absent',()=>{
  const v1=N.generateCardByVersion({seed:'gate-legacy',rarity:'A',level:50,archetype:'Mage',generatorVersion:1});
  assert.equal(v1.generatorVersion,1);
  const v6=N.generateCardByVersion({seed:'gate-legacy6',rarity:'A',level:50,generatorVersion:6});
  assert.deepEqual(v6,N.generateCardByVersion({seed:'gate-legacy6',rarity:'A',level:50,generatorVersion:6}));
  for(const key of ['POTENCY','CONTROL_POWER','TENACITY','RECOVERY','BARRIER_POWER'])assert.equal(v6.stats[key],undefined);
});

test('gate: Naming V3 presets-v7 names are index-aligned with presets-v6',()=>{
  const v7=N.SYSTEM_PRESETS_V7,v6=N.SYSTEM_PRESETS_V6;
  assert.equal(v7.length,60);assert.equal(v6.length,60);
  for(let i=0;i<60;i++){assert.equal(v7[i].name,v6[i].name);assert.equal(v7[i].displayName,v6[i].displayName);}
});

test('gate: presets-v7 diversity — unique fingerprints and victory-path spread',()=>{
  const v7=N.SYSTEM_PRESETS_V7;
  assert.equal(new Set(v7.map(c=>c.mechanicFingerprint)).size,60);
  assert.ok(new Set(v7.map(c=>c.skeleton.victoryPath)).size>=6);
});
