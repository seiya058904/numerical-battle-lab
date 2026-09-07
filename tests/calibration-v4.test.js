const test=require('node:test');
const assert=require('node:assert/strict');
// Calibration pipeline smoke: real script, tiny sample, reports actual numbers.
// This proves the pipeline runs; the authoritative sample is
// `npm run calibration:v4` -> qa/power-v4-calibration.json.
const {runCalibration,spearman}=require('../scripts/power-v4-calibration.js');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior','battlepower-v2'])require('../src/'+f+'.js');

test('spearman helper ranks correctly',()=>{
  assert.ok(Math.abs(spearman([1,2,3,4,5],[1,2,3,4,5])-1)<1e-9);
  assert.ok(Math.abs(spearman([1,2,3,4,5],[5,4,3,2,1])+1)<1e-9);
});

test('calibration pipeline runs end-to-end and reports real metrics',()=>{
  const r=runCalibration({cards:24,pairs:120});
  assert.equal(r.nCards,24);
  assert.ok(r.pairs>30,'enough decided pairs for a signal');
  assert.ok(r.spearman>=-1&&r.spearman<=1);
  assert.ok(r.pairwiseOrdering>0.5,'pairwise ordering should beat a coin flip');
  assert.ok(r.byRarity&&typeof r.byRarity==='object');
  // rarity trend sanity: XS bucket median should be well above C bucket median
  const med=k=>{const v=(r.byRarity[k]||[]).slice().sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:null;};
  const c=med('C'),xs=med('XS_COLLECTOR');
  if(c!==null&&xs!==null)assert.ok(xs>c,`XS_COLLECTOR median BP should exceed C (${c} vs ${xs})`);
});