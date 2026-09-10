/* =========================================================
   tests/product-acceptance.test.js — 产品关键实战验收
   ========================================================= */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CARDS, RARITY_LIST } = require('../src/cards.js');
const { buildUnit, battlePower } = require('../src/power.js');
const { simulate } = require('../src/battle.js');

const idx = {};
CARDS.forEach(c => idx[c.id] = c);
const cs = CARDS.filter(c => c.rarity === 0);
const xscs = CARDS.filter(c => c.rarity === 11);

function winStats(cardA, lvlA, cardB, lvlB, seeds, base = 700000) {
  let a = 0, b = 0, d = 0;
  for (let s = 0; s < seeds; s++) {
    const r = simulate(cardA, lvlA, cardB, lvlB, base + s * 104729);
    if (r.winner === 0) a++; else if (r.winner === 1) b++; else d++;
  }
  return { a, b, d, seeds };
}

test('验收① Lv100 C vs Lv40 C → Lv100 压倒性（40 场零翻盘）', () => {
  for (const c of cs) for (const o of cs) {
    if (c.id === o.id) continue;
    const r = winStats(c, 100, o, 40, 40);
    assert.equal(r.b, 0, `${c.id} Lv100 应全胜 Lv40 ${o.id}，实际败 ${r.b} 场`);
    assert.equal(r.a, 40);
  }
});

test('验收② Lv100 C vs Lv40 XS Collector → Lv100 压倒性（40 场零翻盘）', () => {
  for (const c of cs) for (const x of xscs) {
    const r = winStats(c, 100, x, 40, 40);
    assert.equal(r.b, 0, `Lv100 ${c.id} 应全胜 Lv40 ${x.id}，实际败 ${r.b} 场`);
  }
});

test('验收③ Lv70 XS Collector vs Lv100 C → 真正悬念（双方都能赢）', () => {
  let totalA = 0, totalB = 0;
  for (const x of xscs) for (const c of cs) {
    const r = winStats(x, 70, c, 100, 150);
    totalA += r.a; totalB += r.b;
    const pctA = r.a / r.seeds * 100, pctB = r.b / r.seeds * 100;
    assert.ok(pctA >= 10 && pctB >= 10,
      `Lv70 ${x.id} vs Lv100 ${c.id} 应双方都能赢，实际 ${pctA.toFixed(1)}% / ${pctB.toFixed(1)}%`);
  }
  const total = totalA + totalB;
  const winRate = totalA / total * 100;
  assert.ok(winRate >= 30 && winRate <= 70,
    `XS Collector 综合胜率 ${winRate.toFixed(1)}% 应接近五五（悬念）`);
});

test('验收④ 同等级 C vs XS Collector → 高稀有度压倒性（40 场零翻盘）', () => {
  for (const c of cs) for (const x of xscs) {
    const r = winStats(x, 50, c, 50, 40);
    assert.equal(r.b, 0, `Lv50 ${x.id} 应全胜 ${c.id}，实际败 ${r.b} 场`);
  }
});

test('验收⑤ 同档对抗：实力接近的卡双方都能赢（12 档 × 100 场）', () => {
  for (let t = 0; t < RARITY_LIST.length; t++) {
    const pair = CARDS.filter(c => c.rarity === t);
    if (pair.length !== 2) continue;
    const r = winStats(pair[0], 50, pair[1], 50, 200);
    const pctB = r.b / r.seeds * 100;
    assert.ok(pctB >= 5, `tier ${RARITY_LIST[t]}：${pair[1].id} 应能赢 ${pair[0].id}，实际 ${pctB.toFixed(1)}%`);
    const pctA = r.a / r.seeds * 100;
    assert.ok(pctA >= 5, `tier ${RARITY_LIST[t]}：${pair[0].id} 应能赢 ${pair[1].id}，实际 ${pctA.toFixed(1)}%`);
  }
});

test('验收⑥ Battle Power 接近的卡双方都能赢', () => {
  // BP 接近 = 同档卡（Lv50 档内 BP 差 ≤ 8%）+ 跨等级等 p 对（C@Lv100 vs XS-C@Lv70）
  const bps = CARDS.map(c => ({ card: c, bp: battlePower(buildUnit(c, 50)) }));
  const pairs = [];
  for (let i = 0; i < bps.length; i++) {
    for (let j = i + 1; j < bps.length; j++) {
      const a = bps[i], b = bps[j];
      if (a.card.rarity !== b.card.rarity) continue;
      const gap = Math.abs(a.bp - b.bp) / Math.min(a.bp, b.bp);
      if (gap <= 0.08) pairs.push({ a: a.card, lvlA: 50, b: b.card, lvlB: 50, gap });
    }
  }
  for (const c of cs) for (const x of xscs) {
    const bpC = battlePower(buildUnit(c, 100));
    const bpX = battlePower(buildUnit(x, 70));
    pairs.push({ a: c, lvlA: 100, b: x, lvlB: 70, gap: Math.abs(bpC - bpX) / Math.min(bpC, bpX) });
  }
  assert.ok(pairs.length >= 8, `应存在至少 8 组 BP 接近的卡对，实际 ${pairs.length}`);
  for (const p of pairs) {
    const r = winStats(p.a, p.lvlA, p.b, p.lvlB, 300);
    const pctA = r.a / r.seeds * 100, pctB = r.b / r.seeds * 100;
    assert.ok(pctA >= 5 && pctB >= 5,
      `BP 接近 (差 ${(p.gap * 100).toFixed(1)}%) ${p.a.id} vs ${p.b.id} 应双方都能赢（非 100:0），实际 ${pctA.toFixed(1)}% / ${pctB.toFixed(1)}%`);
  }
});

test('验收⑦ 大差距匹配长期不翻盘（Lv100 vs Lv20 抽查）', () => {
  for (let i = 0; i < 12; i++) {
    const a = CARDS[i * 2 % 24], b = CARDS[(i * 5 + 3) % 24];
    if (a.rarity === b.rarity) continue;
    const r = winStats(a, 100, b, 20, 30);
    assert.equal(r.b, 0, `Lv100 ${a.id} vs Lv20 ${b.id} 不应翻盘`);
  }
});
