const test=require('node:test');
const assert=require('node:assert/strict');
for(const file of ['kernel','components','rules','power','power-v5','strength-geometry-v7'])require('../src/'+file+'.js');
const N=global.NCB;

test('V7 level score follows the canonical convex 16 by x power 1.70 curve',()=>{
  assert.equal(N.levelScoreV7(1),0);
  assert.ok(Math.abs(N.levelScoreV7(50)-4.84)<0.01);
  assert.equal(N.levelScoreV7(100),16);
  const low=N.levelScoreV7(50)-N.levelScoreV7(20);
  const high=N.levelScoreV7(100)-N.levelScoreV7(70);
  assert.ok(high>=1.4*low);
});

test('V7 rarity scores and adjacent increments are strictly convex',()=>{
  const expected=[0,.27,.61,1.03,1.52,2.10,2.76,3.52,4.38,5.35,6.42,7.60];
  assert.deepEqual(N.RARITY_SCORE_V7.map(([id,value])=>[id,value]),N.RARITY_V2_ORDER.map((id,i)=>[id,expected[i]]));
  const increments=expected.slice(1).map((value,i)=>value-expected[i]);
  for(let i=1;i<increments.length;i++)assert.ok(increments[i]>increments[i-1]);
});

test('V7 TargetTheta anchors Lv50 A and satisfies world-order invariants',()=>{
  assert.ok(Math.abs(N.targetThetaV7(50,'A'))<1e-9);
  const audit=N.assertStrengthGeometryV7();
  assert.equal(audit.ok,true);
  assert.ok(audit.fullLevelSpan>=2*audit.fullRaritySpan);
  assert.ok(audit.levelGap40To100-audit.fullRaritySpan>=4.5);
  assert.ok(audit.fullRaritySpan>=audit.levelGap70To100);
  assert.ok(N.targetThetaV7(100,'C')-N.targetThetaV7(40,'XS_COLLECTOR')>=4.5);
  assert.ok(Math.abs(N.targetThetaV7(70,'XS_COLLECTOR')-N.targetThetaV7(100,'C'))<0.5);
});

test('V7 geometry rejects invalid level and rarity',()=>{
  assert.throws(()=>N.levelScoreV7(0),/level/i);
  assert.throws(()=>N.rarityScoreV7('NOPE'),/rarity/i);
});
