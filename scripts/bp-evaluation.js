'use strict';
const crypto = require('node:crypto');
const { CARDS } = require('../src/cards.js');
const { buildUnit } = require('../src/power.js');
const { simulate } = require('../src/battle.js');
const { spearman, pairedInterval512 } = require('./audit-statistics.js');
const LEVELS = [25, 55, 100];
const SEEDS = Array.from({ length: 512 }, (_, i) => 0x10000000 + i * 65537);
const THRESHOLDS = { rho: .90, localDifference: .01, near: 1.06, far: 1.25, nearWins: .05, nearCount: 8, categoryCount: 2, mediumCount: 8, farCount: 40, farScore: .70, farOrdered: .85 };
const pairKey = (a, b) => [a.id, b.id].sort().join('|');
const regressions = [['scout',50,'stone_giant',48],['berserker',50,'stone_giant',48],['wind_ranger',50,'stone_giant',50],['shadow_lord',50,'dragon_knight',50]];
const regressionKeys = regressions.map(([a,,b]) => [a,b].sort().join('|'));
const pools = { calibration: [], holdout: [] };
for (let i=0;i<CARDS.length;i++) for(let j=i+1;j<CARDS.length;j++) {
  const a=CARDS[i], b=CARDS[j], key=pairKey(a,b);
  if(regressionKeys.includes(key)) continue;
  const digest=crypto.createHash('sha256').update('nbl-split-v2:'+key).digest();
  const split=digest[0]%2 ? 'holdout' : 'calibration';
  for(const la of [10,25,50,75,100]) {
    // Choose comparable primary scaling without consulting BP or battle results.
    const p=require('../src/power.js');
    const scale=p.gLevel(la)*p.rarityMul(a.rarity);
    let nearest=1;
    for(let l=2;l<=100;l++) if(Math.abs(Math.log(p.gLevel(l)*p.rarityMul(b.rarity)/scale))<Math.abs(Math.log(p.gLevel(nearest)*p.rarityMul(b.rarity)/scale))) nearest=l;
    for(const lb of new Set([la,1,100,...[-5,-2,0,2,5].map(d=>Math.max(1,Math.min(100,nearest+d)))])) pools[split].push([a.id,la,b.id,lb]);
  }
}
const repairRegressions = [["iron_guard",75,"stone_giant",71],["iron_guard",10,"stone_giant",1],["stone_giant",75,"heavy_knight",69],["stone_giant",25,"corruptor",20],["stone_giant",97,"dragon_knight",85]];
const historical = pools.holdout;
const reservedKeys = new Set(historical.map(([a,,b]) => [a,b].sort().join('|')));
function reservedPool(levels, promotedCount) {
  const excluded = new Set(repairRegressions.slice(0, promotedCount).map(([a,,b]) => [a,b].sort().join('|')));
  const rows = [];
  const p = require('../src/power.js');
  for (let i = 0; i < CARDS.length; i++) for (let j = i + 1; j < CARDS.length; j++) {
    const a = CARDS[i], b = CARDS[j], key = pairKey(a, b);
    if (!reservedKeys.has(key) || excluded.has(key)) continue;
    for (const la of levels) {
      const scale = p.gLevel(la) * p.rarityMul(a.rarity);
      let nearest = 1;
      for (let lb = 2; lb <= 100; lb++) {
        if (Math.abs(Math.log(p.gLevel(lb)*p.rarityMul(b.rarity)/scale)) < Math.abs(Math.log(p.gLevel(nearest)*p.rarityMul(b.rarity)/scale))) nearest = lb;
      }
      for (const lb of new Set([la,1,100,...[-5,-2,0,2,5].map(d=>Math.max(1,Math.min(100,nearest+d)))])) rows.push([a.id,la,b.id,lb]);
    }
  }
  return rows;
}
pools.historical = historical;
pools.historicalV3 = reservedPool([12,28,53,78,97], 4);
pools.holdout = reservedPool([14,31,57,81,94], 5);
const manifest = {
  version: 4, previousHash: '04074fa8c2ac1ba7518d5490a2f97422362196dd375faeb6f58fdf136daa41be',
  levels: LEVELS, thresholds: THRESHOLDS, pools, regressions, repairRegressions,
  seeds: { calibration: SEEDS, historical: SEEDS.map(s=>s+0x20000000), historicalV3: SEEDS.map(s=>s+0x60000000), holdout: SEEDS.map(s=>s+0x80000000), regression: SEEDS.map(s=>s+0x40000000) },
  localRole: 'final regression only; never coefficient fitting',
  disclosure: 'V2 and V3 holdouts are permanently historical regressions. V4 holdout uses new unit/level combinations and seeds on reserved pairs not used for coefficient fitting; all promoted repair pairs are excluded. Card identities have historical observations and are not claimed to be unseen.'
};
const manifestHash = crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
function points(winner, side) { return winner === -1 ? .5 : winner === side ? 1 : 0; }
function observeLocal(seeds = manifest.seeds.regression) {
  return LEVELS.map(level => {
    const scores = CARDS.map(() => Array(512).fill(0));
    const allScores = CARDS.map(() => 0);
    for (let i = 0; i < CARDS.length; i++) for (let j = i + 1; j < CARDS.length; j++) {
      for (let s = 0; s < seeds.length; s++) {
        const f = simulate(CARDS[i], level, CARDS[j], level, seeds[s]);
        const r = simulate(CARDS[j], level, CARDS[i], level, seeds[s]);
        const a = (points(f.winner, 0) + points(r.winner, 1)) / 2;
        allScores[i] += a / (512 * 23); allScores[j] += (1 - a) / (512 * 23);
        if (CARDS[i].rarity !== CARDS[j].rarity) {
          scores[i][s] += a / 22; scores[j][s] += (1 - a) / 22;
        }
      }
    }
    const local = [];
    for (let t = 0; t < 12; t++) {
      const ids = CARDS.map((c, i) => c.rarity === t ? i : -1).filter(i => i >= 0);
      const [a, b] = ids;
      local.push({ a: CARDS[a].id, b: CARDS[b].id, ...pairedInterval512(scores[a].map((v, s) => v - scores[b][s])) });
    }
    return { level, allScores, local };
  });
}
function evaluateLocal(observations, bp) {
  const failures = [];
  const levels = observations.map(row => {
    const values = CARDS.map(c => bp(buildUnit(c, row.level)));
    const rho = spearman(values, row.allScores);
    if (rho === null || rho < THRESHOLDS.rho) failures.push({ code: 'rank-correlation', level: row.level, rho });
    const local = row.local.map(r => {
      const a = CARDS.findIndex(c => c.id === r.a), b = CARDS.findIndex(c => c.id === r.b);
      const decisive = Math.abs(r.mean) >= THRESHOLDS.localDifference && (r.low > 0 || r.high < 0);
      const ok = !decisive || Math.sign(values[a] - values[b]) === Math.sign(r.mean);
      if (!ok) failures.push({ code: 'local-order', level: row.level, a: r.a, b: r.b });
      return { ...r, decisive, bpA: values[a], bpB: values[b], ok };
    });
    return { level: row.level, rho, local };
  });
  return { levels, failures };
}
function observePool(split) {
  if (!manifest.pools[split]) throw new Error('Unknown split');
  return manifest.pools[split].map(([a, la, b, lb]) => observePair(a, la, b, lb, manifest.seeds[split]));
}
function observePair(a, la, b, lb, seeds) {
  const ca = CARDS.find(c => c.id === a), cb = CARDS.find(c => c.id === b);
  let wins = 0, losses = 0, draws = 0;
  for (const seed of seeds) for (const reverse of [false, true]) {
    const r = reverse ? simulate(cb, lb, ca, la, seed) : simulate(ca, la, cb, lb, seed);
    if (r.winner === -1) draws++; else if (r.winner === (reverse ? 1 : 0)) wins++; else losses++;
  }
  return { a, la, b, lb, wins, losses, draws, total: seeds.length * 2 };
}
function evaluatePool(observations, bp) {
  const failures = [], bins = { near: [], medium: [], far: [] };
  for (const r of observations) {
    const a = CARDS.find(c => c.id === r.a), b = CARDS.find(c => c.id === r.b);
    const ba = bp(buildUnit(a, r.la)), bb = bp(buildUnit(b, r.lb));
    if (![ba, bb].every(v => Number.isFinite(v) && v > 0)) { failures.push({ code: 'invalid-bp', a: r.a, b: r.b }); continue; }
    const ratio = Math.max(ba, bb) / Math.min(ba, bb);
    const bin = ratio <= 1.06 ? 'near' : ratio < 1.25 ? 'medium' : 'far';
    const highWins = ba === bb ? null : ba > bb ? r.wins : r.losses;
    bins[bin].push({ ...r, bpA: ba, bpB: bb, ratio, tied: ba === bb, highWins, highLosses: highWins === null ? null : r.total - r.draws - highWins,
      score: highWins === null ? null : (highWins + .5 * r.draws) / r.total, sameTier: a.rarity === b.rarity });
    if (bin === 'near' && (r.wins / r.total < .05 || r.losses / r.total < .05)) failures.push({ code: 'near-one-sided', a: r.a, la: r.la, b: r.b, lb: r.lb });
  }
  const near = bins.near;
  const coverage = { near: near.length, medium: bins.medium.length, far: bins.far.length,
    sameTier: near.filter(r => r.sameTier).length, crossLevel: near.filter(r => r.la !== r.lb).length,
    crossTier: near.filter(r => !r.sameTier).length,
    regions: [[1,33],[34,66],[67,100]].map(([lo,hi])=>near.filter(r=>r.la>=lo&&r.la<=hi&&r.lb>=lo&&r.lb<=hi).length) };
  if (coverage.near < 8 || coverage.medium < 8 || coverage.far < 40 || [coverage.sameTier,coverage.crossLevel,coverage.crossTier,...coverage.regions].some(n=>n<2)) failures.push({ code: 'coverage', coverage });
  const summaries = {};
  for (const [name, rows] of Object.entries(bins)) {
    const ranked = rows.filter(r=>!r.tied);
    const total = ranked.reduce((s,r)=>s+r.total,0), wins = ranked.reduce((s,r)=>s+r.highWins,0), losses = ranked.reduce((s,r)=>s+r.highLosses,0), draws = ranked.reduce((s,r)=>s+r.draws,0);
    summaries[name] = { combinations: rows.length, battles: rows.reduce((s,r)=>s+r.total,0), rankedBattles: total, wins, losses, draws,
      averageScore: total ? (wins+.5*draws)/total : null, orderedFraction: ranked.length ? ranked.filter(r=>r.highWins/r.total>=.70).length/ranked.length : null,
      tied: rows.filter(r=>r.tied), worst: [...rows].sort((a,b)=> name === 'near'
        ? Math.min(a.wins,a.losses)/a.total - Math.min(b.wins,b.losses)/b.total
        : (a.score ?? .5) - (b.score ?? .5)).slice(0,5) };
  }
  if (summaries.far.averageScore === null || summaries.far.averageScore < .70 || summaries.far.orderedFraction < .85) failures.push({ code: 'far-order' });
  return { coverage, summaries, failures };
}
module.exports = { LEVELS, SEEDS, THRESHOLDS, manifest, manifestHash, observeLocal, evaluateLocal, observePool, evaluatePool, observePair };
