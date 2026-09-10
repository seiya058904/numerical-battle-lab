const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7','battlepower-v4','presets','presets-v6','presets-v7'])require('../src/'+f+'.js');
const N=global.NCB;

test('presets-v7: 60 cards, all 12 rarities x5, names frozen from Naming V3',()=>{
  const cards=N.SYSTEM_PRESETS_V7;
  assert.equal(cards.length,60);
  const tiers=new Set(cards.map(c=>c.rarity));
  assert.equal(tiers.size,12,'must cover all 12 rarity tiers');
  for(const r of N.RARITY_V2_ORDER)assert.equal(cards.filter(c=>c.rarity===r).length,5);
  // names frozen: identical (index-aligned) to the v6 catalog's canonical names
  const v6=N.SYSTEM_PRESETS_V6;
  assert.equal(v6.length,60);
  for(let i=0;i<60;i++){assert.equal(cards[i].name,v6[i].name);assert.equal(cards[i].displayName,v6[i].displayName);}
  const names=new Set(cards.map(c=>c.name));
  assert.equal(names.size,60);
  const ids=new Set(cards.map(c=>c.id));
  assert.equal(ids.size,60);
});

test('presets-v7: every card is Generator v7 with TargetTheta and a valid content pack',()=>{
  for(const c of N.SYSTEM_PRESETS_V7){
    assert.equal(c.generatorVersion,7);
    assert.ok(Math.abs(c.targetTheta-N.targetThetaV7(c.level,c.rarity))<=1e-5,`targetTheta for ${c.id}`);
    assert.ok(Number.isFinite(c.stats.ATK)&&c.stats.ATK>0);
    assert.ok(Number.isFinite(c.stats.MAX_HP)&&c.stats.MAX_HP>0);
    assert.ok(Math.abs(c.strengthModel.predictedTheta-c.targetTheta)<=.12,`solver convergence ${c.id}`);
    assert.ok(c.solver.converged,`solver converged ${c.id}`);
    assert.ok(Number.isFinite(N.battlePowerV4(c).power)&&N.battlePowerV4(c).power>0,'BPv4 positive');
    assert.equal(N.battlePowerV4(c).power,c.power,'frozen presentation power equals live BPv4');
    const v=N.validateContentPack(N.assembleCardPack(c));
    assert.ok(v.ok,`invalid pack for ${c.id}: ${v.errors.join('; ')}`);
  }
});

test('presets-v7: mechanic skeleton is seed-only and diverse across victory paths',()=>{
  const paths=new Set(N.SYSTEM_PRESETS_V7.map(c=>c.skeleton.victoryPath));
  assert.ok(paths.size>=6,`victory path diversity: ${[...paths].join(',')}`);
  const styles=new Set();
  for(const c of N.SYSTEM_PRESETS_V7)for(const axis of Object.keys(c.styleGenome||{}))if(c.styleGenome[axis]>.85)styles.add(axis);
  assert.ok(styles.size>=6,`style axis spread: ${[...styles].join(',')}`);
  // mechanic fingerprint invariance across level/rarity for a frozen seed
  const low=N.generateCardV7({seed:N.SYSTEM_PRESETS_V7[0].seed,rarity:'C',level:20});
  const high=N.generateCardV7({seed:N.SYSTEM_PRESETS_V7[0].seed,rarity:'XS_COLLECTOR',level:100});
  assert.equal(low.mechanicFingerprint,high.mechanicFingerprint);
});

test('presets-v7: no dead card — every card deals real damage through its backbone',()=>{
  for(const c of N.SYSTEM_PRESETS_V7){
    const anchors=c.actions.flatMap(a=>(a.effects||[]).filter(e=>e.strengthAnchor));
    assert.ok(anchors.length>=c.actions.length,`anchors ${c.id}`);
    assert.ok(anchors.every(e=>e.damageType!=='true'&&e.canCrit!==false));
  }
});
