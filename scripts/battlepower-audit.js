'use strict';
const { CARDS } = require('../src/cards.js');
const { battlePower, buildUnit, gLevel, rarityMul } = require('../src/power.js');
const { manifest, manifestHash, observeLocal, evaluateLocal, observePool, evaluatePool, observePair } = require('./bp-evaluation.js');

function evaluateRegressions(rows, bp) {
  return rows.map(r => {
    const a = bp(buildUnit(CARDS.find(c => c.id === r.a), r.la));
    const b = bp(buildUnit(CARDS.find(c => c.id === r.b), r.lb));
    const ordered = Math.sign(a - b) === Math.sign(r.wins - r.losses);
    const oneSided = Math.min(r.wins, r.losses) / r.total < .05;
    const ok = ordered && (!oneSided || Math.max(a, b) / Math.min(a, b) > 1.06);
    return { ...r, bpA: a, bpB: b, ok };
  });
}
function audit() {
  console.error('BP: frozen calibration pool');
  const calibration = evaluatePool(observePool('calibration'), battlePower);
  console.error('BP: entire former holdout retained as historical regression');
  const historicalRows = observePool('historical');
  const historical = evaluatePool(historicalRows, battlePower);
  console.error('BP: V3 holdout retained as historical regression');
  const historicalV3Rows = observePool('historicalV3');
  const historicalV3 = evaluatePool(historicalV3Rows, battlePower);
  const repairs = new Set(manifest.repairRegressions.map(r => JSON.stringify(r)));
  const repairRegressions = evaluateRegressions([...historicalRows, ...historicalV3Rows].filter(r => repairs.has(JSON.stringify([r.a, r.la, r.b, r.lb]))), battlePower);
  console.error('BP: frozen holdout pool (no fitting)');
  const holdout = evaluatePool(observePool('holdout'), battlePower);
  console.error('BP: final common-opponent regression and negative controls');
  const observed = observeLocal();
  const local = evaluateLocal(observed, battlePower);
  const controls = {
    constant: evaluateLocal(observed, () => 1),
    levelRarity: evaluateLocal(observed, u => Math.round(gLevel(u.level) * rarityMul(u.rarity) * 1000)),
    reverse: evaluateLocal(observed, u => 1e10 - battlePower(u))
  };
  const controlChecks = {
    constant: controls.constant.failures.some(f => ['rank-correlation', 'local-order'].includes(f.code)),
    levelRarity: controls.levelRarity.failures.some(f => f.code === 'local-order'),
    reverse: controls.reverse.failures.some(f => ['rank-correlation', 'local-order'].includes(f.code))
  };
  const seeds = Array.from({ length: 8192 }, (_, i) => (0x6a09e667 + Math.imul(i, 0x85ebca6b)) >>> 0);
  const regressions = evaluateRegressions(manifest.regressions.map(r => observePair(...r, seeds)), battlePower);
  const ok = !calibration.failures.length && !historical.failures.length && !historicalV3.failures.length && !holdout.failures.length && !local.failures.length && Object.values(controlChecks).every(Boolean) && regressions.every(r => r.ok) && repairRegressions.length === repairs.size && repairRegressions.every(r => r.ok);
  return { manifestHash, disclosure: manifest.disclosure, calibration, historical, historicalV3, holdout, local, controlChecks, controls, regressions, repairRegressions, ok };
}
if (require.main === module) {
  const result = audit();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}
module.exports = { audit, evaluateRegressions };
