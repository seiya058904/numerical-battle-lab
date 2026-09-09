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

test('V7 neutral-100 axes perturb around 100 when absent from a legacy card',()=>{
  const {perturbCardStat}=require('../scripts/audit-stat-sensitivity-v7.js');
  const legacy={id:'legacy',stats:{ATK:50}};
  assert.equal(perturbCardStat(legacy,'POTENCY',-.1).stats.POTENCY,90);
  assert.equal(perturbCardStat(legacy,'RECOVERY',.1).stats.RECOVERY,110);
  assert.deepEqual(legacy,{id:'legacy',stats:{ATK:50}});
});

test('axis health gate requires six competitive axes and caps ATK dominance and share',()=>{
  const {evaluateAxisHealth}=require('../scripts/audit-stat-sensitivity-v7.js');
  const healthy=evaluateAxisHealth({
    'Direct Pressure':1,Endurance:.8,Sustain:.7,Reliability:.6,Control:.55,
    'Control Resistance':.5,'Tempo / Readiness':.7,Economy:.6,
  });
  assert.equal(healthy.pass,true);
  assert.equal(healthy.competitiveAxisCount,7);
  assert.equal(evaluateAxisHealth({'Direct Pressure':1,Endurance:.1,Sustain:.1,Reliability:.1,Control:.1,'Control Resistance':.1,'Tempo / Readiness':.1,Economy:.1}).pass,false);
});

test('paired empirical sensitivity can identify the high-low marginal while retaining panel estimates',()=>{
  const {buildSensitivityArtifact}=require('../scripts/audit-stat-sensitivity-v7.js');
  const cards=[{id:'a',stats:{ATK:100}}];
  const artifact=buildSensitivityArtifact({version:7,cards,stats:['ATK'],evaluate:c=>c.stats.ATK/100,pairEvaluate:(low,high)=>Math.log(high.stats.ATK/low.stats.ATK)});
  const sample=artifact.axes.ATK.samples[0];
  assert.equal(sample.lowTheta,.9);
  assert.equal(sample.highTheta,1.1);
  assert.equal(sample.panelDeltaTheta,.2);
  assert.equal(sample.deltaTheta,Math.round(Math.log(110/90)*1e6)/1e6);
});
