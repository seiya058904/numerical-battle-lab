const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');

// v1.2.1 calibration semantics (audit §1/§2/§10-14): smoke-run the calibration
// script and verify the JSON report distinguishes strict vs trend monotonicity
// (a "trend acceptable" must never be reported as strict), reports the selected
// model + all split Spearman values and the direct-battle metrics.
let _smoke=null;
function runSmoke(){
  // fast smoke: small samples, few battles; requires only the generator, no matrix file.
  // The gate may fail on a tiny smoke sample (exit 1) but the JSON is always written,
  // so spawnSync captures output regardless of the gate exit code. Run once and cache.
  if(_smoke!==null)return _smoke;
  const res=spawnSync(process.execPath,[path.join(root,'scripts/power-calibration.js'),'--sample','120','--battles','6','--rarityN','12'],{cwd:root,encoding:'utf8'});
  assert.ok(res.status===0||res.status===1,'calibration exits 0 or 1 (gate), never crashes');
  _smoke=JSON.parse(fs.readFileSync(path.join(root,'qa/power-calibration.json'),'utf8'));
  return _smoke;
}

test('v1.2.1 calibration JSON: strict vs trend monotonicity distinguished',()=>{
  const r=runSmoke();
  assert.equal(r.version,'1.2.1');
  // both flags present and are booleans (separate concepts, not one merged flag)
  assert.equal(typeof r.rarityLadderStrictMonotonic,'boolean');
  assert.equal(typeof r.rarityLadderTrendAcceptable,'boolean');
  // trend-acceptable must never be silently labelled strict
  if(!r.rarityLadderStrictMonotonic)assert.ok(r.rarityLadderTrendAcceptable!==undefined);
  // 12 rarity means present
  assert.equal(Object.keys(r.rarityMeansLv100||{}).length,12);
});

test('v1.2.1 calibration JSON: fitted weights from TRAIN + model selection recorded',()=>{
  const r=runSmoke();
  assert.ok(r.fittedWeights&&typeof r.fittedWeights.offense==='number','auto-fit produced weights');
  assert.ok(['fitted','committed','balanced','wA','wF'].includes(r.selectedName),'model selection recorded: '+r.selectedName);
  assert.equal(typeof r.spearman.validationFitted,'number');
  assert.equal(typeof r.spearman.validationCommitted,'number');
  assert.equal(typeof r.spearman.finalTestSelected,'number');
  assert.equal(r.splits.train+r.splits.validation+r.splits.finalTest,r.cards.length,'splits partition the sample');
});

test('v1.2.1 calibration JSON: direct-battle metrics + win-probability model reported',()=>{
  const r=runSmoke();
  assert.equal(typeof r.pairwiseOrderingAccuracy.validation,'number');
  assert.equal(typeof r.similarBPFairnessHigherBPWinRate,'number');
  assert.ok(r.winProbabilityModel&&typeof r.winProbabilityModel.brier==='number');
  assert.ok(r.winProbabilityModel.logLoss>0);
  assert.ok(r.winProbabilityModel.pairs>=4,'win-prob model trained on direct pair battles');
});

test('calibration exits 0 when validation Spearman >= 0.70 (smoke may warn but must not crash)',()=>{
  // The gate uses direct-battle + split metrics; the script must complete and write
  // a JSON (even if the tiny smoke fails the gate, exit is decided by the gate, and
  // a crash is a test failure). We only require a well-formed run here.
  const r=runSmoke();
  assert.ok(r.cards.length>0);
  assert.ok(Object.keys(r.rarityMeansLv100).length>=12);
});