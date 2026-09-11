/* =========================================================
   tests/product-acceptance.test.js — 96 卡产品关键实战验收
   ========================================================= */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CARDS, RARITY_LIST } = require('../src/cards.js');
const { simulate } = require('../src/battle.js');

const tier = (t) => CARDS.filter(c => c.rarity === t);
const cs = tier(0);
const xscs = tier(11);

function winStats(cardA, lvlA, cardB, lvlB, seeds, base = 700000) {
  let a = 0, b = 0, d = 0;
  for (let s = 0; s < seeds; s++) {
    const r = simulate(cardA, lvlA, cardB, lvlB, base + s * 104729);
    if (r.winner === 0) a++;
    else if (r.winner === 1) b++;
    else d++;
  }
  return { a, b, d, seeds };
}

test('验收① Lv100 C vs Lv40 C → Lv100 压倒性', () => {
  for (const high of cs) for (const low of cs) {
    const r = winStats(high, 100, low, 40, 24);
    assert.equal(r.b, 0, `${high.id} Lv100 不应输给 Lv40 ${low.id}`);
  }
});

test('验收② Lv100 C vs Lv40 XS Collector → Lv100 压倒性', () => {
  for (const c of cs) for (const x of xscs) {
    const r = winStats(c, 100, x, 40, 24);
    assert.equal(r.b, 0, `Lv100 ${c.id} 不应输给 Lv40 ${x.id}`);
  }
});

test('验收③ Lv55 XS Collector vs Lv100 C → 全 96 卡扩展后仍保持 45%–65% 悬念锚点', () => {
  let xWins = 0, cWins = 0, draws = 0;
  for (const x of xscs) for (const c of cs) {
    const r = winStats(x, 55, c, 100, 80);
    xWins += r.a; cWins += r.b; draws += r.d;
  }
  const total = xscs.length * cs.length * 80;
  const xRate = xWins / total * 100;
  assert.ok(xWins > 0 && cWins > 0, '悬念锚点必须双方都有胜局');
  assert.ok(xRate >= 45 && xRate <= 65,
    `XS Collector 综合胜率 ${xRate.toFixed(1)}% 应在 45%–65%；draw=${draws}`);
});

test('验收④ 同等级 C vs XS Collector → 高稀有度压倒性', () => {
  for (const x of xscs) for (const c of cs) {
    const r = winStats(x, 50, c, 50, 24);
    assert.equal(r.b, 0, `Lv50 ${x.id} 不应输给 Lv50 ${c.id}`);
  }
});

test('验收⑤ 同档 8 卡全组合：任意卡对双方都保留至少 5% 胜率', () => {
  for (let t = 0; t < RARITY_LIST.length; t++) {
    const cards = tier(t);
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const r = winStats(cards[i], 50, cards[j], 50, 80);
        const pctA = r.a / r.seeds * 100;
        const pctB = r.b / r.seeds * 100;
        assert.ok(pctA >= 5 && pctB >= 5,
          `${RARITY_LIST[t]} ${cards[i].id} vs ${cards[j].id} 过于单边：${pctA.toFixed(1)}% / ${pctB.toFixed(1)}%`);
      }
    }
  }
});

test('验收⑦ 大差距匹配长期不翻盘（Lv100 vs Lv20 动态抽查）', () => {
  const n = CARDS.length;
  for (let i = 0; i < 24; i++) {
    const a = CARDS[(i * 7) % n];
    const b = CARDS[(i * 13 + 5) % n];
    if (a.rarity === b.rarity) continue;
    const r = winStats(a, 100, b, 20, 30);
    assert.equal(r.b, 0, `Lv100 ${a.id} vs Lv20 ${b.id} 不应翻盘`);
  }
});

test('验收⑧ 同等级相邻档：高档总体更强，S 以上优势明显', () => {
  for (let lo = 0; lo < RARITY_LIST.length - 1; lo++) {
    const hi = lo + 1;
    let highWins = 0, lowWins = 0, total = 0;
    for (const h of tier(hi)) for (const l of tier(lo)) {
      const r = winStats(h, 50, l, 50, 30, 880000);
      highWins += r.a; lowWins += r.b; total += r.seeds;
    }
    const pctHi = highWins / total * 100;
    assert.ok(pctHi >= 55,
      `${RARITY_LIST[hi]} vs ${RARITY_LIST[lo]} 高档应总体更强，实际 ${pctHi.toFixed(1)}%`);
    if (lo >= 5) assert.ok(pctHi >= 90,
      `S 以上相邻档 ${RARITY_LIST[hi]} vs ${RARITY_LIST[lo]} 高档应明显占优，实际 ${pctHi.toFixed(1)}%`);
    assert.ok(highWins > lowWins, `tier ${hi} 应总体胜过 tier ${lo}`);
  }
});

test('验收⑨ Collector 跳升：SSS Collector / XS Collector 对前档明显更强', () => {
  for (const [lo, hi] of [[8, 9], [10, 11]]) {
    let highWins = 0, total = 0;
    for (const h of tier(hi)) for (const l of tier(lo)) {
      const r = winStats(h, 50, l, 50, 30, 990000);
      highWins += r.a; total += r.seeds;
    }
    const pctHi = highWins / total * 100;
    assert.ok(pctHi >= 90,
      `${RARITY_LIST[hi]} vs ${RARITY_LIST[lo]} Collector 应明显强，实际 ${pctHi.toFixed(1)}%`);
  }
});
