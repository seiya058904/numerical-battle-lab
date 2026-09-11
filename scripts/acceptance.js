/* =========================================================
   scripts/acceptance.js — 96 卡产品实战验收（npm run verify）
   核心锚点 + 同档全组合 + 相邻档 + 全卡池轻量 BP 相关性。
   冻结的 BP v4 深度审计仍由 battlepower-audit.js 对 LEGACY_CARDS 执行。
   ========================================================= */
'use strict';
const { CARDS, RARITY_LIST } = require('../src/cards.js');
const { buildUnit, battlePower } = require('../src/power.js');
const { simulate } = require('../src/battle.js');
const { spearman } = require('./audit-statistics.js');

const tier = (t) => CARDS.filter(c => c.rarity === t);
const cs = tier(0);
const xscs = tier(11);

let failed = false;
function report(name, ok, line) {
  console.log(`${ok ? '✓' : '✗'} ${name}: ${line}`);
  if (!ok) failed = true;
}
function pct(n, total) { return (n / total * 100).toFixed(1) + '%'; }

function winStats(cardA, lvlA, cardB, lvlB, seeds, base = 880000) {
  let a = 0, b = 0, d = 0;
  for (let s = 0; s < seeds; s++) {
    const r = simulate(cardA, lvlA, cardB, lvlB, (base + s * 1299721) >>> 0);
    if (r.winner === 0) a++;
    else if (r.winner === 1) b++;
    else d++;
  }
  return { a, b, d, seeds };
}

console.log('========== 数值卡牌 · 自动 PK — 96 卡产品实战验收 ==========\n');

console.log('【核心锚点】');
{
  let upsets = 0, total = 0;
  for (const c of cs) for (const x of xscs) {
    const r = winStats(c, 100, x, 40, 24);
    upsets += r.b; total += r.seeds;
  }
  report('Lv100 C vs Lv40 XS Collector → Lv100 压倒性',
    upsets === 0, `高等级 ${pct(total - upsets, total)} / 翻盘 ${pct(upsets, total)}`);
}
{
  let xWins = 0, cWins = 0, draws = 0, total = 0;
  for (const x of xscs) for (const c of cs) {
    const r = winStats(x, 55, c, 100, 80);
    xWins += r.a; cWins += r.b; draws += r.d; total += r.seeds;
  }
  const rate = xWins / total * 100;
  report('Lv55 XS Collector vs Lv100 C → 悬念（45%–65%）',
    xWins > 0 && cWins > 0 && rate >= 45 && rate <= 65,
    `XS-C ${pct(xWins, total)} / C ${pct(cWins, total)} / draw ${pct(draws, total)}`);
}
{
  let upsets = 0, total = 0;
  for (const x of xscs) for (const c of cs) {
    const r = winStats(x, 50, c, 50, 24);
    upsets += r.b; total += r.seeds;
  }
  report('同等级 C vs XS Collector → 高稀有度压倒性',
    upsets === 0, `XS-C ${pct(total - upsets, total)} / C ${pct(upsets, total)}`);
}

console.log('\n【同档 8 卡全组合】');
for (let t = 0; t < RARITY_LIST.length; t++) {
  const cards = tier(t);
  let worst = 1;
  let worstPair = '';
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const r = winStats(cards[i], 50, cards[j], 50, 80);
      const minority = Math.min(r.a, r.b) / r.seeds;
      if (minority < worst) {
        worst = minority;
        worstPair = `${cards[i].id} vs ${cards[j].id}`;
      }
    }
  }
  report(`[${RARITY_LIST[t]}] 任意卡对双方均保留胜机`,
    worst >= .05, `最差少数方 ${(worst * 100).toFixed(1)}% · ${worstPair}`);
}

console.log('\n【同等级相邻档】');
for (let lo = 0; lo < RARITY_LIST.length - 1; lo++) {
  const hi = lo + 1;
  let highWins = 0, lowWins = 0, total = 0;
  for (const h of tier(hi)) for (const l of tier(lo)) {
    const r = winStats(h, 50, l, 50, 30);
    highWins += r.a; lowWins += r.b; total += r.seeds;
  }
  const rate = highWins / total;
  const threshold = lo >= 5 ? .90 : .55;
  report(`[${RARITY_LIST[hi]} vs ${RARITY_LIST[lo]}] 高档总体更强`,
    rate >= threshold && highWins > lowWins,
    `高档 ${pct(highWins, total)} / 低档 ${pct(lowWins, total)}`);
}

console.log('\n【96 卡全池 Battle Power 快速相关性】');
{
  const level = 50;
  const seeds = Array.from({ length: 8 }, (_, i) => (0x31415926 + Math.imul(i, 0x9e3779b1)) >>> 0);
  const scores = CARDS.map(() => 0);
  for (let i = 0; i < CARDS.length; i++) {
    for (let j = i + 1; j < CARDS.length; j++) {
      let pointsI = 0;
      for (const seed of seeds) {
        const f = simulate(CARDS[i], level, CARDS[j], level, seed);
        const r = simulate(CARDS[j], level, CARDS[i], level, seed);
        pointsI += f.winner === -1 ? .5 : f.winner === 0 ? 1 : 0;
        pointsI += r.winner === -1 ? .5 : r.winner === 1 ? 1 : 0;
      }
      const share = pointsI / (2 * seeds.length);
      scores[i] += share / (CARDS.length - 1);
      scores[j] += (1 - share) / (CARDS.length - 1);
    }
  }
  const bps = CARDS.map(c => battlePower(buildUnit(c, level)));
  const rho = spearman(bps, scores);
  report('Lv50 BP vs 全卡池轻量循环赛 Spearman ≥ 0.95',
    rho !== null && rho >= .95, `rho=${rho === null ? 'null' : rho.toFixed(4)}`);
}

console.log(`\n========== 验收 ${failed ? '失败' : '通过'} ==========`);
process.exit(failed ? 1 : 0);
