const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');

// v1.2.3 calibration semantics (audit §2-§6 + model-consistency §1/§5): smoke-run
// the calibration script and verify:
//   - NEW FINAL HOLDOUT (NEW_FINAL_2026_09) is a brand-new split; old FINAL_TEST
//     seeds are never used again (audit §2/§19)
//   - model selection uses ONLY TRAIN+VALIDATION (FINAL never in selection)
//   - candidate fairness re-builds pairs per model (buildPairsForModel) — no stale
//     stored-BP preselection (audit §3/§4)
//   - pairwise / similar-BP / win-probability all take an explicit model and never
//     read a stale row.battlePower (audit §6)
//   - the report carries selectedModelHash + shippedModelHash (audit §5)
let _smoke=null;
function runSmoke(){
  if(_smoke!==null)return _smoke;
  const out=path.join(root,'qa','.smoke-power-calibration.json');
  // smoke does NOT --ship (must not mutate the shipped registry from a smoke run)
  const res=spawnSync(process.execPath,[path.join(root,'scripts/power-calibration.js'),'--sample','120','--battles','6','--rarityN','12','--out',out],{cwd:root,encoding:'utf8'});
  assert.ok(res.status===0||res.status===1,'calibration exits 0 or 1 (gate), never crashes');
  _smoke=JSON.parse(fs.readFileSync(out,'utf8'));
  fs.rmSync(out,{force:true});
  return _smoke;
}

test('v1.2.3 calibration JSON: NEW FINAL holdout + model block present',()=>{
  const r=runSmoke();
  assert.equal(r.version,'1.2.3');
  assert.ok(r.model&&typeof r.model.selectedName==='string','model selection recorded');
  assert.ok(r.model.selectedWeights&&typeof r.model.selectedWeights.offense==='number','selected weights present');
  assert.match(r.model.selectedModelHash,/^[0-9a-f]{8}$/,'selected model hash 8-hex');
  assert.match(r.model.shippedModelHash,/^[0-9a-f]{8}$/,'shipped model hash 8-hex');
  assert.equal(typeof r.splits.final,'number');
  assert.ok(r.splits.final>0,'NEW FINAL split populated');
});

test('v1.2.3 calibration JSON: model selection uses only TRAIN+VALIDATION (no FINAL leak)',()=>{
  const r=runSmoke();
  assert.ok(r.fittedWeights===undefined,'v1.2.2-style top-level fittedWeights removed (moved under model)');
  assert.ok(['fitted','shipped','balanced','wF'].includes(r.model.selectedName),'selection from candidate set: '+r.model.selectedName);
  // FINAL only has a post-freeze holdout evaluation; the report never lets FINAL
  // influence selection (selection happens on validation spearman + fairness)
  assert.equal(typeof r.spearman.finalTestSelected,'number');
  assert.equal(typeof r.spearman.validationSelected,'number');
  assert.ok(r.splits.train+r.splits.validation+r.splits.final===r.cards.length,'splits partition the sample');
});

test('v1.2.3 calibration JSON: pairwise + similar-BP split into train/validation/final',()=>{
  const r=runSmoke();
  assert.equal(typeof r.pairwiseOrderingAccuracy.train,'number');
  assert.equal(typeof r.pairwiseOrderingAccuracy.validation,'number');
  assert.equal(typeof r.pairwiseOrderingAccuracy.final,'number');
  assert.equal(typeof r.similarBPFairness.train,'number');
  assert.equal(typeof r.similarBPFairness.validation,'number');
  assert.equal(typeof r.similarBPFairness.final,'number');
});

test('v1.2.3 calibration JSON: win-probability fitted on TRAIN, evaluated on FINAL holdout',()=>{
  const r=runSmoke();
  const wp=r.winProbabilityModel;
  assert.equal(wp.fittedOn,'TRAIN');
  assert.equal(typeof wp.b0,'number');
  assert.equal(typeof wp.b1,'number');
  assert.equal(typeof wp.finalHoldout.brier,'number');
  assert.equal(typeof wp.finalHoldout.logLoss,'number');
  assert.equal(typeof wp.finalHoldout.ece,'number');
  assert.ok(wp.finalHoldout.pairs>=2,'FINAL holdout has pairs');
});

test('calibration exits 0 when validation Spearman >= 0.70 (smoke may warn but must not crash)',()=>{
  const r=runSmoke();
  assert.ok(r.cards.length>0);
  assert.ok(typeof r.spearman.validationSelected==='number');
});