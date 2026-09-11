/* =========================================================
   scripts/acceptance.js — 产品实战验收（npm run verify 的一部分）
   核心匹配 + BP 排序抽查 + 近战力随机性，输出报告。
   ========================================================= */
'use strict';
const { CARDS, RARITY_LIST } = require('../src/cards.js');
const { simulate } = require('../src/battle.js');

const idx = {};
CARDS.forEach(c => idx[c.id] = c);
const cs = CARDS.filter(c => c.rarity === 0);
const xscs = CARDS.filter(c => c.rarity === 11);

let failed = false;
function report(name, ok, line) {
  console.log(`${ok ? '✓' : '✗'} ${name}: ${line}`);
  if (!ok) failed = true;
}

function winStats(cardA, lvlA, cardB, lvlB, seeds, base = 880000) {
  let a = 0, b = 0, d = 0;
  for (let s = 0; s < seeds; s++) {
    const r = simulate(cardA, lvlA, cardB, lvlB, base + s * 1299721);
    if (r.winner === 0) a++; else if (r.winner === 1) b++; else d++;
  }
  return { a, b, d, seeds };
}
const pct = (n, s) => (n / s * 100).toFixed(1) + '%';

console.log('========== 数值卡牌 · 自动 PK — 产品实战验收 ==========\n');

// ---- 核心匹配 ----
console.log('【核心匹配（关键验收）】');
{
  const r = winStats(idx.axe_brute, 100, idx.iron_guard, 40, 60);
  report('Lv100 C vs Lv40 C → Lv100 压倒性', r.b === 0, `${pct(r.a, r.seeds)} / ${pct(r.b, r.seeds)}`);
}
{
  let upsets = 0, total = 0;
  for (const c of cs) for (const x of xscs) {
    const r = winStats(c, 100, x, 40, 40);
    upsets += r.b; total += r.seeds;
  }
  report('Lv100 C vs Lv40 XS Collector → Lv100 压倒性', upsets === 0, `${pct(total - upsets, total)} / ${pct(upsets, total)}`);
}
{
  let aWins = 0, bWins = 0, total = 0;
  for (const x of xscs) for (const c of cs) {
    const r = winStats(x, 55, c, 100, 200);
    aWins += r.a; bWins += r.b; total += r.seeds;
  }
  const xRate = aWins / total * 100;
  report('Lv55 XS Collector vs Lv100 C → 悬念（XS-C 约 45%–65%）',
    bWins > 0 && xRate >= 45 && xRate <= 65,
    `XS-C ${pct(aWins, total)} / C ${pct(bWins, total)}（综合 ${xRate.toFixed(1)}%）`);
}
{
  let upsets = 0, total = 0;
  for (const c of cs) for (const x of xscs) {
    const r = winStats(x, 50, c, 50, 40);
    upsets += r.b; total += r.seeds;
  }
  report('同等级 C vs XS Collector → 高稀有度压倒性', upsets === 0, `${pct(total - upsets, total)} / ${pct(upsets, total)}`);
}

// ---- 同档对抗 ----
console.log('\n【同档对抗（Lv50 × 200 场，双方都应能赢）】');
for (let t = 0; t < RARITY_LIST.length; t++) {
  const pair = CARDS.filter(c => c.rarity === t);
  if (pair.length !== 2) continue;
  const r = winStats(pair[0], 50, pair[1], 50, 200);
  const ok = r.a > 0 && r.b > 0 && r.a / r.seeds >= 0.05 && r.b / r.seeds >= 0.05;
  report(`[${RARITY_LIST[t]}] ${pair[0].id} vs ${pair[1].id}`, ok,
    `${pct(r.a, r.seeds)} / ${pct(r.b, r.seeds)}`);
}

// ---- 同等级相邻档 ----
console.log('\n【同等级相邻档（Lv50 × 120 场，高档在前）】');
{
  const tier = (t) => CARDS.filter(c => c.rarity === t);
  const pairs = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11]];
  const rates = [];
  for (const [lo, hi] of pairs) {
    let a = 0, b = 0, tot = 0;
    for (const h of tier(hi)) for (const l of tier(lo)) {
      const r = winStats(h, 50, l, 50, 60);
      a += r.a; b += r.b; tot += r.seeds;
    }
    const hiPct = a / tot * 100;
    rates.push(hiPct);
    const ok = lo < 5 ? hiPct >= 55 : hiPct >= 90;
    report(`[${RARITY_LIST[hi]} vs ${RARITY_LIST[lo]}] 高档总体更强`, ok,
      `高档 ${pct(a, tot)} / 低档 ${pct(b, tot)}`);
  }
  const sPlus = rates.slice(5); // S 及以上相邻档
  let increasing = true;
  for (let i = 1; i < sPlus.length; i++) if (sPlus[i] < sPlus[i - 1] - 0.5) increasing = false;
  report('S 以上相邻档优势随档位逐步更明显（单调不减）', increasing, sPlus.map(r => r.toFixed(1) + '%').join(' → '));
}

// BP evaluation is owned by battlepower-audit.js, using the frozen pools.
console.log(`\n========== 验收 ${failed ? '失败' : '通过'} ==========`);
process.exit(failed ? 1 : 0);
