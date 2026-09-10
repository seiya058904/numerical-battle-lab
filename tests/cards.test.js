/* =========================================================
   tests/cards.test.js — 内置卡库结构
   ========================================================= */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CARDS, RARITY_LIST } = require('../src/cards.js');

test('卡库：24 张卡，12 档稀有度每档恰好 2 张', () => {
  assert.equal(CARDS.length, 24);
  assert.equal(RARITY_LIST.length, 12);
  assert.equal(RARITY_LIST[0], 'C');
  assert.equal(RARITY_LIST[RARITY_LIST.length - 1], 'XS Collector');
  for (let t = 0; t < RARITY_LIST.length; t++) {
    const pair = CARDS.filter(c => c.rarity === t);
    assert.equal(pair.length, 2, `稀有度 ${RARITY_LIST[t]} 应有 2 张`);
  }
});

test('卡库：id 唯一且非空', () => {
  const ids = new Set();
  for (const c of CARDS) {
    assert.ok(c.id && typeof c.id === 'string', 'id 必须非空字符串');
    assert.ok(!ids.has(c.id), `id 重复: ${c.id}`);
    ids.add(c.id);
  }
});

test('卡库：所有数值字段合法（有限、范围内、无 NaN）', () => {
  for (const c of CARDS) {
    for (const k of ['hp', 'atk', 'def', 'spd']) {
      assert.ok(Number.isFinite(c.base[k]), `${c.id}.base.${k} 必须有限`);
      assert.ok(c.base[k] > 0 && c.base[k] <= 2.5, `${c.id}.base.${k} 超范围: ${c.base[k]}`);
    }
    assert.ok(c.acc >= 50 && c.acc <= 180, `${c.id}.acc`);
    assert.ok(c.eva >= 30 && c.eva <= 180, `${c.id}.eva`);
    assert.ok(c.crit >= 0 && c.crit <= 0.5, `${c.id}.crit`);
    assert.ok(c.critDmg >= 1 && c.critDmg <= 2.5, `${c.id}.critDmg`);
    for (const k of ['pen', 'lifesteal', 'hpRegen', 'volatility']) {
      assert.ok(Number.isFinite(c[k]), `${c.id}.${k} 必须有限`);
      assert.ok(c[k] >= 0 && c[k] <= 0.5, `${c.id}.${k} 超范围: ${c[k]}`);
    }
    assert.ok(c.name && c.role && c.desc, `${c.id} 缺少名称/角色/描述`);
  }
});

test('卡库：稀有度颜色表覆盖全部 12 档', () => {
  const colors = require('../src/cards.js').RARITY_COLOR;
  for (const r of RARITY_LIST) {
    assert.ok(colors[r], `缺少稀有度颜色: ${r}`);
  }
});
