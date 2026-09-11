/* =========================================================
   tests/battle.test.js — 确定性 / 终止 / 数值合法性 / 播放速度独立
   ========================================================= */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CARDS } = require('../src/cards.js');
const { simulate, applyEvents, createRng, hitChance, MAX_ROUNDS } = require('../src/battle.js');
const { createViewState, applyEventToState } = require('../src/app.js');

const idx = {};
CARDS.forEach(c => idx[c.id] = c);

function seed(i) { return 1000003 + i * 7919; }

test('确定性：同 Match Seed → 完整事件序列完全一致', () => {
  const a = idx.iron_guard, b = idx.avatar_of_the_end;
  const r1 = simulate(a, 70, b, 100, 424242);
  const r2 = simulate(a, 70, b, 100, 424242);
  assert.deepStrictEqual(r1.events, r2.events, '事件列表必须逐条一致');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r1)), JSON.parse(JSON.stringify(r2)));
  assert.equal(r1.winner, r2.winner);
});

test('确定性：不同 Match Seed 通常产生不同对局（高波动匹配）', () => {
  const a = idx.axe_brute, b = idx.flame_mage; // 波动高、实力接近
  const results = new Set();
  for (let i = 0; i < 12; i++) {
    const r = simulate(a, 50, b, 50, seed(i));
    results.add(r.winner + ':' + r.events.length + ':' + JSON.stringify(r.events.slice(-3)));
  }
  assert.ok(results.size >= 6, `12 个种子应产生至少 6 种不同事件序列，实际 ${results.size}`);
});

test('战斗终止：全部 96×96 匹配 × 3 种子 均在回合上限内结束', () => {
  for (const ca of CARDS) {
    for (const cb of CARDS) {
      for (let i = 0; i < 3; i++) {
        const r = simulate(ca, 50, cb, 50, seed(i * 31 + ca.rarity * 7 + cb.rarity));
        assert.ok(r.rounds <= MAX_ROUNDS, `${ca.id} vs ${cb.id} 超过回合上限`);
        assert.ok(!r.a.alive || !r.b.alive || r.winner === -1, '平局必须显式判定');
      }
    }
  }
});

test('数值合法：事件中无 NaN、HP 恒在 [0, maxHP] 且为整数', () => {
  const pairs = [
    [idx.iron_guard, idx.stone_giant, 50, 50],
    [idx.avatar_of_the_end, idx.origin_star, 100, 100],
    [idx.light_priest, idx.dragon_knight, 70, 70]
  ];
  for (const [a, b, la, lb] of pairs) {
    for (let i = 0; i < 10; i++) {
      const r = simulate(a, la, b, lb, seed(i));
      for (const e of r.events) {
        for (const k of ['round', 'hpA', 'maxA', 'hpB', 'maxB']) {
          assert.ok(Number.isFinite(e[k]), `${k} 出现 NaN`);
        }
        assert.ok(Number.isInteger(e.hpA) && e.hpA >= 0 && e.hpA <= e.maxA, `hpA 非法: ${e.hpA}`);
        assert.ok(Number.isInteger(e.hpB) && e.hpB >= 0 && e.hpB <= e.maxB, `hpB 非法: ${e.hpB}`);
      }
    }
  }
});

test('胜者一致性：胜者与最终存活状态、HP 吻合', () => {
  for (let i = 0; i < 40; i++) {
    const a = CARDS[i % 24], b = CARDS[(i * 7) % 24];
    const r = simulate(a, 60, b, 60, seed(i));
    const last = r.events[r.events.length - 1];
    if (r.winner === 0) {
      assert.equal(last.aliveB, false, `${a.id} 获胜但 B 未倒下`);
      assert.equal(last.hpB, 0);
      assert.equal(last.aliveA, true);
    } else if (r.winner === 1) {
      assert.equal(last.aliveA, false, `${b.id} 获胜但 A 未倒下`);
      assert.equal(last.hpA, 0);
      assert.equal(last.aliveB, true);
    } else {
      assert.equal(last.aliveA, true);
      assert.equal(last.aliveB, true);
    }
  }
});

test('命中率钳制：恒在 [0.45, 0.99]', () => {
  for (let acc = 0; acc <= 300; acc += 7) {
    for (let eva = 0; eva <= 300; eva += 11) {
      const hc = hitChance({ acc }, { eva });
      assert.ok(hc >= 0.45 && hc <= 0.99, `hitChance(${acc},${eva}) = ${hc}`);
    }
  }
});

test('播放速度独立性：慢 / 快 / 瞬 只改延迟，事件与终态完全一致', async () => {
  const a = idx.berserker, b = idx.scout;
  const base = simulate(a, 50, b, 50, 987654);

  const run = async (delayMs) => {
    const view = { applied: 0, state: createViewState() };
    await applyEvents(base.events, (e) => {
      view.applied++;
      applyEventToState(view.state, e);
    }, () => new Promise(r => setTimeout(r, delayMs)));
    return view;
  };

  const slow = await run(20);      // 慢
  const fast = await run(5);       // 快
  const instant = await run(0);    // 瞬

  for (const v of [slow, fast, instant]) {
    assert.equal(v.applied, base.events.length, '必须消费全部事件');
  }
  assert.deepStrictEqual(slow.state, instant.state, '慢与瞬的终态必须一致');
  assert.deepStrictEqual(fast.state, instant.state, '快与瞬的终态必须一致');
  assert.deepStrictEqual(slow.state, {
    round: base.events[base.events.length - 1].round,
    hpA: base.events[base.events.length - 1].hpA,
    maxA: base.events[base.events.length - 1].maxA,
    hpB: base.events[base.events.length - 1].hpB,
    maxB: base.events[base.events.length - 1].maxB,
    aliveA: base.events[base.events.length - 1].aliveA,
    aliveB: base.events[base.events.length - 1].aliveB
  });
});

test('播放速度独立性：同卡同种子 重复模拟 结果一致（回放不改变对局）', () => {
  const a = idx.time_traveler, b = idx.thunder_god;
  const r1 = simulate(a, 90, b, 90, 31337);
  const r2 = simulate(a, 90, b, 90, 31337);
  assert.deepStrictEqual(r1.events.map(e => e.text), r2.events.map(e => e.text));
  assert.equal(r1.winner, r2.winner);
});

test('PRNG：mulberry32 输出确定且在 [0,1)', () => {
  const rng = createRng(12345);
  const seq = [];
  for (let i = 0; i < 100; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, 'PRNG 输出必须在 [0,1)');
    seq.push(v);
  }
  const rng2 = createRng(12345);
  for (let i = 0; i < 100; i++) {
    assert.equal(rng2(), seq[i], '同种子 PRNG 序列必须一致');
  }
});
