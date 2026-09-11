'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { manifest, manifestHash, evaluatePool, evaluateLocal } = require('../scripts/bp-evaluation.js');
const { CARDS } = require('../src/cards.js');
const power = require('../src/power.js');
test('calibration and holdout have disjoint unordered pairs and seed sets', () => {
  assert.equal(manifestHash, '81a8582a7ac856670a587e6c148f14ccc5fa2aa63a54fcbacd7aa3e9225bf77e', 'Changing frozen evaluation data requires an explicit new audit version');
  const keys = split => new Set(manifest.pools[split].map(([a,,b]) => [a,b].sort().join('|')));
  const cal = keys('calibration'), hold = keys('holdout');
  for (const key of cal) assert.equal(hold.has(key), false);
  for (const seed of manifest.seeds.calibration) assert.equal(manifest.seeds.holdout.includes(seed), false);
  for (const seed of [...manifest.seeds.historical, ...manifest.seeds.historicalV3]) assert.equal(manifest.seeds.holdout.includes(seed), false);
  const history = new Set([...manifest.pools.historical, ...manifest.pools.historicalV3].map(r => JSON.stringify(r)));
  for (const row of manifest.pools.holdout) assert.equal(history.has(JSON.stringify(row)), false);
  for (const [a,,b] of manifest.repairRegressions) assert.equal(hold.has([a,b].sort().join('|')), false);
  for (const [a,,b] of manifest.regressions) {
    const key = [a,b].sort().join('|'); assert.equal(cal.has(key), false); assert.equal(hold.has(key), false);
  }
});
test('near win denominator includes draws; missing coverage fails', () => {
  const report = evaluatePool([{ a: CARDS[0].id, la: 50, b: CARDS[1].id, lb: 50, wins: 4, losses: 4, draws: 92, total: 100 }], () => 100);
  assert.ok(report.failures.some(f=>f.code==='near-one-sided'));
  assert.ok(report.failures.some(f=>f.code==='coverage'));
  assert.equal(report.summaries.near.tied.length, 1);
  assert.equal(report.summaries.near.wins, 0);
  assert.equal(report.summaries.near.averageScore, null);
});
test('Level/Rarity ties cannot pass decisive generic local ordering', () => {
  const observation = [{ level: 25, allScores: CARDS.map((_, i)=>i/24), local: [{ a: 'berserker', b: 'scout', n: 512, mean: .02, low: .015, high: .025 }] }];
  const r = evaluateLocal(observation, u=>Math.round(power.gLevel(u.level)*power.rarityMul(u.rarity)*1000));
  assert.ok(r.failures.some(f=>f.code==='local-order'));
});
