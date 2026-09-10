/* =========================================================
   scripts/battlepower-audit.js — 轻量 Battle Power 审计
   多个等级（Lv25 / Lv55 / Lv100）循环赛：每张卡打遍其他 23 张，
   统计长期综合胜率，与 Battle Power 排名做 Spearman 秩相关。
   另加跨 Level/Rarity 组合抽查。
   不需要 ML / Solver / 大规模世界模型 —— 几万场简单循环就够。
   ========================================================= */
'use strict';
const { CARDS, RARITY_LIST } = require('../src/cards.js');
const { buildUnit, battlePower } = require('../src/power.js');
const { simulate } = require('../src/battle.js');

const LEVELS = [25, 55, 100];
const SEEDS_PER_MATCH = 40;
const RHO_MIN = 0.90;

function winRate(cardA, lvlA, cardB, lvlB, seeds) {
  let pts = 0;
  for (let s = 0; s < seeds; s++) {
    const r = simulate(cardA, lvlA, cardB, lvlB, 330000 + s * 15485863 + cardA.rarity * 1000 + cardB.rarity);
    if (r.winner === 0) pts += 1;
    else if (r.winner === 1) pts += 0;
    else pts += 0.5;
  }
  return pts / seeds;
}

function spearman(rows, level) {
  const byWr = [...rows].sort((a, b) => b.wr - a.wr);
  const byBp = [...rows].sort((a, b) => b.bp - a.bp);
  const rankWr = new Map(byWr.map((r, i) => [r.card.id, i + 1]));
  const rankBp = new Map(byBp.map((r, i) => [r.card.id, i + 1]));
  const n = rows.length;
  const d2 = rows.reduce((s, r) => s + (rankWr.get(r.card.id) - rankBp.get(r.card.id)) ** 2, 0);
  const rho = 1 - 6 * d2 / (n * (n * n - 1));
  console.log(`Lv${level} 循环赛（每卡 ×23 对手 ×${SEEDS_PER_MATCH} 场）`);
  byWr.forEach((r, i) => {
    const bpRank = rankBp.get(r.card.id);
    const mark = bpRank === i + 1 ? ' ' : `(BP#${bpRank})`;
    console.log(
      String(i + 1).padStart(4) + ' | ' + r.card.id.padEnd(23) + ' | ' +
      RARITY_LIST[r.card.rarity].padEnd(14) + ' | ' + String(r.bp).padStart(7) +
      ' | ' + (r.wr * 100).toFixed(1).padStart(5) + ' ' + mark
    );
  });
  console.log(`Spearman ρ（胜率排名 vs BP 排名）= ${rho.toFixed(4)}`);
  return rho;
}

console.log('========== Battle Power 审计（多等级循环赛 + 跨等级抽查）==========\n');
let failed = false;

// ---- 多等级循环赛 ----
const rhos = [];
for (const level of LEVELS) {
  const rows = CARDS.map((c) => {
    let total = 0;
    for (const o of CARDS) {
      if (o.id === c.id) continue;
      total += winRate(c, level, o, level, SEEDS_PER_MATCH);
    }
    return { card: c, bp: battlePower(buildUnit(c, level)), wr: total / (CARDS.length - 1) };
  });
  const rho = spearman(rows, level);
  rhos.push(rho);
  if (rho < RHO_MIN) {
    failed = true;
    console.log(`✗ Lv${level} ρ=${rho.toFixed(4)} < ${RHO_MIN}`);
  }
  console.log('');
}

// ---- 跨 Level / Rarity 抽查 ----
console.log(`【跨 Level/Rarity 抽查（120 组，BP 差 > 25%，BP 高者应 ≥70% 胜率）】`);
let ordered = 0, audited = 0;
for (let i = 0; i < 120; i++) {
  const a = CARDS[i % 24];
  const b = CARDS[(i * 13 + 7) % 24];
  if (a.id === b.id) continue;
  const la = 10 + ((i * 37) % 91);
  const lb = 10 + ((i * 53 + 5) % 91);
  const bpA = battlePower(buildUnit(a, la));
  const bpB = battlePower(buildUnit(b, lb));
  if (Math.max(bpA, bpB) / Math.min(bpA, bpB) < 1.25) continue;
  audited++;
  const hi = bpA > bpB ? a : b, lvHi = bpA > bpB ? la : lb;
  const lo = bpA > bpB ? b : a, lvLo = bpA > bpB ? lb : la;
  let hiWins = 0;
  for (let s = 0; s < 20; s++) {
    const r = simulate(hi, lvHi, lo, lvLo, 770000 + s * 104729 + i);
    if (r.winner === 0) hiWins++;
  }
  if (hiWins >= 14) ordered++;
}
console.log(`${ordered}/${audited} 组 BP 高者 ≥70% 胜率`);
if (audited < 40 || ordered < audited * 0.85) failed = true;

const allOk = rhos.every(r => r >= RHO_MIN) && !failed;
console.log(`\n检查：所有等级 ρ ≥ ${RHO_MIN} 且跨等级抽查通过 → ${allOk ? '通过' : '失败'}`);
process.exit(allOk ? 0 : 1);
