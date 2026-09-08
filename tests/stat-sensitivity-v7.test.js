const test=require('node:test');
const assert=require('node:assert/strict');

test('V7 sensitivity perturbation clones the card and changes only the requested stat',()=>{
  const {perturbCardStat}=require('../scripts/audit-stat-sensitivity-v7.js');
  const card={id:'base',stats:{ATK:100,MAX_HP:500,CRIT:20},actions:[{id:'a',effects:[{type:'damage',formula:'ATK * 1'}]}]};
  const changed=perturbCardStat(card,'ATK',0.10);
  assert.notEqual(changed,card);
  assert.deepEqual(card.stats,{ATK:100,MAX_HP:500,CRIT:20});
  assert.deepEqual(changed.stats,{ATK:110,MAX_HP:500,CRIT:20});
  assert.deepEqual(changed.actions,card.actions);
});

test('V7 probability perturbation uses percentage points without re-solving',()=>{
  const {perturbCardStat}=require('../scripts/audit-stat-sensitivity-v7.js');
  const card={stats:{CRIT:20,PEN:98},powerAudit:{predictedTheta:3}};
  assert.equal(perturbCardStat(card,'CRIT',5,{percentagePoints:true}).stats.CRIT,25);
  assert.equal(perturbCardStat(card,'PEN',5,{percentagePoints:true}).stats.PEN,100);
  assert.deepEqual(card,{stats:{CRIT:20,PEN:98},powerAudit:{predictedTheta:3}});
});

test('V7 central sensitivity evaluates symmetric perturbations of the same frozen card',()=>{
  const {centralSensitivity}=require('../scripts/audit-stat-sensitivity-v7.js');
  const card={id:'frozen',stats:{ATK:100,MAX_HP:500}};
  const seen=[];
  const result=centralSensitivity(card,'ATK',c=>{seen.push(c);return Math.log(c.stats.ATK);});
  assert.equal(seen.length,2);
  assert.equal(seen[0].stats.ATK,90);
  assert.equal(seen[1].stats.ATK,110);
  assert.equal(result.lowTheta,Math.log(90));
  assert.equal(result.highTheta,Math.log(110));
  assert.equal(result.deltaTheta,Math.log(110)-Math.log(90));
  assert.deepEqual(card,{id:'frozen',stats:{ATK:100,MAX_HP:500}});
});

test('V7 sensitivity summarizes empirical theta deltas and treats draws as half outcomes',()=>{
  const {empiricalThetaFromCounts,summarizeSamples}=require('../scripts/audit-stat-sensitivity-v7.js');
  assert.equal(empiricalThetaFromCounts({higherWins:5,lowerWins:5,draws:0,battleCount:10}),0);
  assert.ok(empiricalThetaFromCounts({higherWins:8,lowerWins:1,draws:1,battleCount:10})>1);
  assert.deepEqual(summarizeSamples([0.1,0.4,0.2,0.3]),{p25:0.1,median:0.2,p75:0.3,min:0.1,max:0.4});
});

test('V7 sensitivity artifact reports per-stat card samples without regenerating',()=>{
  const {buildSensitivityArtifact}=require('../scripts/audit-stat-sensitivity-v7.js');
  const cards=[{id:'a',stats:{ATK:100,CRIT:20}},{id:'b',stats:{ATK:200,CRIT:30}}];
  const artifact=buildSensitivityArtifact({
    version:6,cards,stats:['ATK','CRIT'],
    evaluate:c=>Math.log(c.stats.ATK)+c.stats.CRIT/100,
    percentagePointStats:new Set(['CRIT']),
  });
  assert.equal(artifact.generatorVersion,6);
  assert.equal(artifact.axes.ATK.samples.length,2);
  assert.equal(artifact.axes.CRIT.samples.length,2);
  assert.ok(artifact.axes.ATK.medianDeltaTheta>artifact.axes.CRIT.medianDeltaTheta);
  assert.deepEqual(cards,[{id:'a',stats:{ATK:100,CRIT:20}},{id:'b',stats:{ATK:200,CRIT:30}}]);
});

test('V7 sensitivity reuses one paired Match Seed for low and high perturbations',()=>{
  const {auditSeedFor}=require('../scripts/audit-stat-sensitivity-v7.js');
  assert.equal(auditSeedFor('card-a',2,3),auditSeedFor('card-a',2,3));
  assert.notEqual(auditSeedFor('card-a',2,3),auditSeedFor('card-a',2,4));
  assert.notEqual(auditSeedFor('card-a',2,3),auditSeedFor('card-b',2,3));
});
