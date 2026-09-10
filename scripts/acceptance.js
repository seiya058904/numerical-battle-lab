/* =========================================================
   scripts/acceptance.js — 产品实战验收（npm run verify 的一部分）
   核心匹配 + BP 排序抽查 + 近战力随机性，输出报告。
   ========================================================= */
'use strict';
const { CARDS, RARITY_LIST } = require('../src/cards.js');
const { buildUnit, battlePower } = require('../src/power.js');
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
    const r = winStats(x, 70, c, 100, 200);
    aWins += r.a; bWins += r.b; total += r.seeds;
  }
  const xRate = aWins / (aWins + bWins) * 100;
  report('Lv70 XS Collector vs Lv100 C → 有悬念（双方都能赢）',
    bWins > 0 && xRate >= 30 && xRate <= 70,
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

// ---- 近战力随机性 ----
console.log('\n【近 Battle Power 卡对 × 大量 Match Seed（双方都能赢）】');
const bps = CARDS.map(c => ({ card: c, bp: battlePower(buildUnit(c, 50)) }));
const near = [];
for (let i = 0; i < bps.length; i++) for (let j = i + 1; j < bps.length; j++) {
  const a = bps[i], b = bps[j];
  const gap = Math.abs(a.bp - b.bp) / Math.min(a.bp, b.bp);
  if (gap <= 0.06) near.push([a.card, b.card, gap]);
}
near.sort((x, y) => x[2] - y[2]);
const shown = near.slice(0, 8);
if (shown.length === 0) {
  report('存在近 BP 卡对', false, '未找到');
} else {
  for (const [a, b, gap] of shown) {
    const r = winStats(a, 50, b, 50, 300);
    const ok = r.a / r.seeds >= 0.05 && r.b / r.seeds >= 0.05;
    report(`${a.id} vs ${b.id}（BP 差 ${(gap * 100).toFixed(1)}%）`, ok,
      `${pct(r.a, r.seeds)} / ${pct(r.b, r.seeds)}`);
  }
}

// ---- BP 排序抽查 ----
console.log('\n【Battle Power 排序抽查（随机 120 组，BP 差 > 25% 应长期占优）】');
let ordered = 0, audited = 0;
for (let i = 0; i < 120; i++) {
  const a = CARDS[i % 24];
  const b = CARDS[(i * 13 + 7) % 24];
  if (a.id === b.id) continue;
  const la = 10 + ((i * 37) % 91);
  const lb = 10 + ((i * 53 + 5) % 91);
  const bpA = battlePower(buildUnit(a, la));
  const bpB = battlePower(buildUnit(b, lb));
  const hi = bpA > bpB ? a : b;
  const lo = bpA > bpB ? b : a;
  const lvHi = bpA > bpB ? la : lb;
  const lvLo = bpA > bpB ? lb : la;
  const gap = Math.max(bpA, bpB) / Math.min(bpA, bpB);
  if (gap < 1.25) continue;
  audited++;
  const r = winStats(hi, lvHi, lo, lvLo, 20);
  if (r.a >= 14) ordered++;
}
report('BP 高者长期平均更强（≥70% 胜率）',
  audited > 40 && ordered >= audited * 0.85,
  `${ordered}/${audited} 组 BP 高者 ≥70% 胜率`);

console.log(`\n========== 验收 ${failed ? '失败' : '通过'} ==========`);
process.exit(failed ? 1 : 0);
