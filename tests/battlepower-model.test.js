const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

function loadModel(){
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower-model','battlepower'])
    delete require.cache[require.resolve('../src/'+f+'.js')];
  global.NCB={};
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower-model','battlepower'])
    require('../src/'+f+'.js');
  return global.NCB;
}

// v1.2.3 (audit §1/§5): the SINGLE SOURCE OF TRUTH for BattlePower weights is the
// model registry (src/battlepower-model.js). Calibration, browser, tests and UI
// must all read the same model. Static gates below assert the release artifact:
//   - battlepower.js consumes exactly the registry weights (no hardcoded divergence)
//   - the shipped model hash is deterministic
//   - the committed qa/power-calibration.json records selectedModelHash ===
//     shippedModelHash (the model FINAL-validated is the shipped model)
test('battlepower.js consumes the registry weights (single source of truth)',()=>{
  const N=loadModel();
  const registryWeights=N.battlePowerModel.weights;
  const card=N.generateCardV2({rarity:'A',level:80,archetype:'Mage',seed:'MODEL_TEST_1'});
  const bp=N.battlePower(card);
  assert.deepEqual(bp.weights,registryWeights,'battlePower reports the registry weights');
  assert.equal(N.SUBSCORE_WEIGHTS,registryWeights,'NCB.SUBSCORE_WEIGHTS alias == registry weights');
});

test('model hash is deterministic and stable for the shipped weights',()=>{
  const N=loadModel();
  const h1=N.battlePowerModel.hash;
  const h2=N.battlePowerModel.modelHash({...N.battlePowerModel.weights});
  assert.equal(h1,h2,'hash is deterministic');
  assert.match(h1,/^[0-9a-f]{8}$/,'8-hex hash format');
  const other=N.battlePowerModel.modelHash({offense:0.30,durability:0.30,tempo:0.30,sustain:0.02,utility:0.02,economy:0.03,reliability:0.03});
  assert.notEqual(other,h1,'different weights -> different hash');
});

test('committed calibration artifact: selectedModelHash === shippedModelHash (static gate)',()=>{
  // The release artifact is qa/power-calibration.json (produced by
  // scripts/power-calibration.js --ship on the FINAL release run). This is a pure
  // static check of the committed artifact — it never mutates the registry.
  const p=path.join(root,'qa','power-calibration.json');
  assert.ok(fs.existsSync(p),'qa/power-calibration.json exists (release artifact)');
  const r=JSON.parse(fs.readFileSync(p,'utf8'));
  assert.equal(r.version,'1.2.3','artifact is v1.2.3');
  assert.ok(r.model,'artifact carries model block');
  assert.equal(r.model.hashesEqual,true,'report asserts selected == shipped');
  assert.equal(r.model.selectedModelHash,r.model.shippedModelHash,'hashes equal in the artifact');
  // the shipped hash in the artifact matches the CURRENT registry hash
  const N=loadModel();
  assert.equal(r.model.shippedModelHash,N.battlePowerModel.hash,
    'artifact shipped hash matches the current src/battlepower-model.js registry');
});

test('NEW FINAL holdout fields present in the committed artifact',()=>{
  const p=path.join(root,'qa','power-calibration.json');
  const r=JSON.parse(fs.readFileSync(p,'utf8'));
  assert.equal(typeof r.spearman.finalTestSelected,'number');
  assert.equal(typeof r.pairwiseOrderingAccuracy.final,'number');
  assert.equal(typeof r.similarBPFairness.final,'number');
  assert.ok(r.winProbabilityModel&&typeof r.winProbabilityModel.finalHoldout.brier==='number');
  assert.ok(r.winProbabilityModel.finalHoldout.ece>=0);
  assert.ok(r.splits.final>0,'NEW FINAL split populated');
});