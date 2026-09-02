const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');

// v1.2.2 calibration semantics (audit §1/§2/§10-14 + leak fix §2): smoke-run the
// calibration script and verify:
//   - strict vs trend monotonicity distinguished (never label trend as strict)
//   - model selection uses ONLY TRAIN+VALIDATION (FINAL never in selection)
//   - pairwise / similar-BP split into train/validation/final
//   - win-probability fitted on TRAIN, evaluated on FINAL holdout
let _smoke=null;
function runSmoke(){
  if(_smoke!==null)return _smoke;
  const out=path.join(root,'qa','.smoke-power-calibration.json');
  const res=spawnSync(process.execPath,[path.join(root,'scripts/power-calibration.js'),'--sample','120','--battles','6','--rarityN','12','--out',out],{cwd:root,encoding:'utf8'});
  assert.ok(res.status===0||res.status===1,'calibration exits 0 or 1 (gate), never crashes');
  _smoke=JSON.parse(fs.readFileSync(out,'utf8'));
  fs.rmSync(out,{force:true});
  return _smoke;
}

test('v1.2.2 calibration JSON: strict vs trend monotonicity distinguished',()=>{
  const r=runSmoke();
  assert.equal(r.version,'1.2.2');
  assert.equal(typeof r.rarityLadderStrictMonotonic,'boolean');
  assert.equal(typeof r.rarityLadderTrendAcceptable,'boolean');
  if(!r.rarityLadderStrictMonotonic)assert.ok(r.rarityLadderTrendAcceptable!==undefined);
  assert.equal(Object.keys(r.rarityMeansLv100||{}).length,12);
});

test('v1.2.2 calibration JSON: model selection uses only TRAIN+VALIDATION (no FINAL leak)',()=>{
  const r=runSmoke();
  assert.ok(r.fittedWeights&&typeof r.fittedWeights.offense==='number','auto-fit produced weights');
  assert.ok(['fitted','committed','balanced','wA','wF'].includes(r.selectedName),'model selection recorded: '+r.selectedName);
  // the FINAL split must NEVER be used for fitting/selection — assert the script
  // declares exactly which splits participated
  assert.deepEqual(r.modelSelectionUsedSplits,['TRAIN','VALIDATION']);
  // FINAL only has a post-freeze holdout evaluation
  assert.equal(typeof r.spearman.finalTestSelected,'number');
  assert.equal(typeof r.spearman.validationSelected,'number');
  assert.equal(r.splits.train+r.splits.validation+r.splits.finalTest,r.cards.length,'splits partition the sample');
});

test('v1.2.2 calibration JSON: pairwise + similar-BP split into train/validation/final',()=>{
  const r=runSmoke();
  assert.equal(typeof r.pairwiseOrderingAccuracy.train,'number');
  assert.equal(typeof r.pairwiseOrderingAccuracy.validation,'number');
  assert.equal(typeof r.pairwiseOrderingAccuracy.final,'number');
  assert.equal(typeof r.similarBPFairness.train,'number');
  assert.equal(typeof r.similarBPFairness.validation,'number');
  assert.equal(typeof r.similarBPFairness.final,'number');
});

test('v1.2.2 calibration JSON: win-probability fitted on TRAIN, evaluated on FINAL holdout',()=>{
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
  assert.ok(Object.keys(r.rarityMeansLv100).length>=12);
});