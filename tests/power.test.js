/* =========================================================
   tests/power.test.js — Level / Rarity / Battle Power 秩序
   ========================================================= */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CARDS, RARITY_LIST } = require('../src/cards.js');
const { gLevel, rarityMul, buildUnit, battlePower } = require('../src/power.js');

const LEVELS = [1, 25, 50, 75, 100];
const tiers = RARITY_LIST.map((_, t) => CARDS.filter(c => c.rarity === t));

test('Level 曲线：单调递增，Lv100/Lv40 巨大差距', () => {
  let prev = 0;
  for (let L = 1; L <= 100; L++) {
    const g = gLevel(L);
    assert.ok(g > prev, `gLevel(${L}) 必须严格递增`);
    prev = g;
  }
  assert.ok(gLevel(100) / gLevel(40) >= 20, `g(100)/g(40) = ${gLevel(100) / gLevel(40)} 应 ≥ 20`);
});

test('Rarity 表：单调递增，C=1，XS Collector=13.20，Collector 跳升明显', () => {
  const EXPECTED = [1.00, 1.15, 1.35, 1.60, 1.90, 2.30, 2.90, 3.75, 4.90, 6.60, 9.10, 13.20];
  let prev = 0;
  for (let i = 0; i < 12; i++) {
    const m = rarityMul(i);
    assert.ok(m > prev, `rarityMul(${i}) 必须严格递增`);
    assert.equal(Math.round(m * 100) / 100, EXPECTED[i], `rarityMul(${i}) 应为 ${EXPECTED[i]}，实际 ${m}`);
    prev = m;
  }
  // Collector 对前一普通档必须是清楚可感知的跳跃
  assert.ok(rarityMul(9) / rarityMul(8) >= 1.3, `SSS Collector 对 SSS 应有明显跳升: ${rarityMul(9) / rarityMul(8)}`);
  assert.ok(rarityMul(11) / rarityMul(10) >= 1.4, `XS Collector 对 XS 应有明显跳升: ${rarityMul(11) / rarityMul(10)}`);
});

test('同 p 悬念设计：g(55) × XS Collector ≈ g(100)（Lv55 XS-C ≈ Lv100 C）', () => {
  const ratio = gLevel(55) * rarityMul(11) / gLevel(100);
  assert.ok(ratio >= 1.0 && ratio <= 1.1, `g(55)*rar(11)/g(100) = ${ratio} 应 ≈ 1.045`);
});

test('buildUnit：数值符合公式且随等级增长（非递减；10 级窗口严格增长）', () => {
  const card = CARDS[0];
  let prevHp = 0, prevAtk = 0, prevDef = 0, prevSpd = 0;
  for (let L = 1; L <= 100; L++) {
    const u = buildUnit(card, L);
    assert.ok(Number.isFinite(u.maxHp) && u.maxHp > 0);
    assert.ok(u.hp === u.maxHp, '满血单位 HP == maxHp');
    // 取整可能导致低数值平台，但绝不下降
    assert.ok(u.maxHp >= prevHp && u.atk >= prevAtk && u.def >= prevDef && u.spd >= prevSpd,
      `Lv${L} 属性不应下降`);
    prevHp = u.maxHp; prevAtk = u.atk; prevDef = u.def; prevSpd = u.spd;
  }
  // 10 级窗口内必须严格增长（低等级取整平台不会超过几级）
  for (let L = 1; L <= 90; L += 10) {
    const a = buildUnit(card, L);
    const b = buildUnit(card, L + 10);
    assert.ok(b.maxHp > a.maxHp && b.atk > a.atk && b.def > a.def && b.spd > a.spd,
      `Lv${L} → Lv${L + 10} 属性必须严格增长`);
  }
});

test('Battle Power：每张卡随等级严格增长', () => {
  for (const c of CARDS) {
    let prev = -1;
    for (let L = 1; L <= 100; L++) {
      const bp = battlePower(buildUnit(c, L));
      assert.ok(Number.isFinite(bp) && bp > 0, `${c.id} Lv${L} BP 非法`);
      assert.ok(bp > prev, `${c.id} BP 必须随等级严格增长 (Lv${L - 1}:${prev} → Lv${L}:${bp})`);
      prev = bp;
    }
  }
});

test('Battle Power：同等级稀有度层级 — 各档均值严格递增', () => {
  for (const L of LEVELS) {
    const means = tiers.map(t => t.reduce((s, c) => s + battlePower(buildUnit(c, L)), 0) / t.length);
    for (let i = 0; i < means.length - 1; i++) {
      assert.ok(means[i] < means[i + 1],
        `Lv${L} tier${i} 均值 ${Math.round(means[i])} 应 < tier${i + 1} ${Math.round(means[i + 1])}`);
    }
  }
});

test('Battle Power：同等级相隔 ≥2 档时高阶每张卡都更高', () => {
  for (const L of LEVELS) {
    for (let i = 0; i < tiers.length; i++) {
      for (let j = i + 2; j < tiers.length; j++) {
        const mx = Math.max(...tiers[i].map(c => battlePower(buildUnit(c, L))));
        const mn = Math.min(...tiers[j].map(c => battlePower(buildUnit(c, L))));
        assert.ok(mx < mn,
          `Lv${L} tier${i} 最高 ${mx} 应 < tier${j} 最低 ${mn}`);
      }
    }
  }
});

test('Battle Power 关键产品量级：Lv100 C > Lv40 XS Collector', () => {
  const cs = tiers[0];
  const xscs = tiers[11];
  for (const c of cs) {
    for (const x of xscs) {
      const bpHigh = battlePower(buildUnit(c, 100));
      const bpLow = battlePower(buildUnit(x, 40));
      assert.ok(bpHigh > bpLow, `Lv100 ${c.id} (${bpHigh}) 应 > Lv40 ${x.id} (${bpLow})`);
    }
  }
});
