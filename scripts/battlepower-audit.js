/* =========================================================
   scripts/battlepower-audit.js — 轻量 Battle Power 审计
   每张卡在同等级（Lv50）下打遍其他 23 张卡，统计长期综合胜率，
   与 Battle Power 排名做 Spearman 秩相关检查。
   不需要 ML / Solver / 大规模世界模型 —— 两万多场简单循环就够。
   ========================================================= */
'use strict';
const { CARDS, RARITY_LIST } = require('../src/cards.js');
const { buildUnit, battlePower } = require('../src/power.js');
const { simulate } = require('../src/battle.js');

const LEVEL = 50;
const SEEDS_PER_MATCH = 40;

function winRate(cardA, cardB, seeds) {
  let pts = 0;
  for (let s = 0; s < seeds; s++) {
    const r = simulate(cardA, LEVEL, cardB, LEVEL, 330000 + s * 15485863 + cardA.rarity * 1000 + cardB.rarity);
    if (r.winner === 0) pts += 1;
    else if (r.winner === 1) pts += 0;
    else pts += 0.5;
  }
  return pts / seeds;
}

// 汇总每张卡的长期综合胜率（对 23 个对手取平均）
const rows = CARDS.map((c) => {
  let total = 0;
  for (const o of CARDS) {
    if (o.id === c.id) continue;
    total += winRate(c, o, SEEDS_PER_MATCH);
  }
  return { card: c, bp: battlePower(buildUnit(c, LEVEL)), wr: total / (CARDS.length - 1) };
});

// 按胜率与按 BP 分别排名 → Spearman 秩相关
const byWr = [...rows].sort((a, b) => b.wr - a.wr);
const byBp = [...rows].sort((a, b) => b.bp - a.bp);
const rankWr = new Map(byWr.map((r, i) => [r.card.id, i + 1]));
const rankBp = new Map(byBp.map((r, i) => [r.card.id, i + 1]));

const n = rows.length;
const d2 = rows.reduce((s, r) => s + (rankWr.get(r.card.id) - rankBp.get(r.card.id)) ** 2, 0);
const rho = 1 - 6 * d2 / (n * (n * n - 1));

console.log(`========== Battle Power 审计（Lv${LEVEL} 循环赛 × ${SEEDS_PER_MATCH} 场/对）==========`);
console.log('rank | card                    | rarity |      BP | 胜率%');
byWr.forEach((r, i) => {
  const bpRank = rankBp.get(r.card.id);
  const mark = bpRank === i + 1 ? ' ' : `(BP#${bpRank})`;
  console.log(
    String(i + 1).padStart(4) + ' | ' + r.card.id.padEnd(23) + ' | ' +
    RARITY_LIST[r.card.rarity].padEnd(14) + ' | ' + String(r.bp).padStart(7) +
    ' | ' + (r.wr * 100).toFixed(1).padStart(5) + ' ' + mark
  );
});
console.log(`\nSpearman ρ（胜率排名 vs BP 排名）= ${rho.toFixed(4)}`);

const THRESHOLD = 0.85;
const ok = rho >= THRESHOLD;
console.log(`检查：ρ ≥ ${THRESHOLD} → ${ok ? '通过' : '失败'}`);
process.exit(ok ? 0 : 1);
