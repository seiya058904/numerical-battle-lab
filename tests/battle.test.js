/* =========================================================
   tests/battle.test.js — 确定性 / 终止 / 数值合法性 / 播放速度独立
   ========================================================= */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CARDS } = require('../src/cards.js');
const { BASE, gLevel } = require('../src/power.js');
const { simulate, applyEvents, createRng, hitChance, MAX_ROUNDS } = require('../src/battle.js');
const { createViewState, applyEventToState } = require('../src/app.js');

const idx = {};
CARDS.forEach(c => idx[c.id] = c);

function seed(i) { return 1000003 + i * 7919; }

function assertWinnerConsistent(result) {
  const last = result.events[result.events.length - 1];
  assert.equal(last.hpA, result.a.hp);
  assert.equal(last.hpB, result.b.hp);
  assert.equal(last.aliveA, result.a.alive);
  assert.equal(last.aliveB, result.b.alive);
  if (last.aliveA && last.aliveB) {
    assert.equal(result.rounds, MAX_ROUNDS, '双方存活只能在回合上限结算');
    // Independent integer-ratio oracle; supported HP products remain safe integers.
    const gap = last.hpA * last.maxB - last.hpB * last.maxA;
    assert.equal(result.winner, Math.abs(gap) * 100 < last.maxA * last.maxB ? -1 : gap > 0 ? 0 : 1,
      '超时胜负由剩余生命比例决定，双方存活不一定是平局');
  } else {
    assert.notEqual(last.aliveA, last.aliveB, '当前规则不会同时倒下');
    assert.equal(result.winner, last.aliveA ? 0 : 1);
    assert.equal(last.aliveA ? last.hpB : last.hpA, 0);
    assert.ok((last.aliveA ? last.hpA : last.hpB) > 0);
  }
}

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
        assertWinnerConsistent(r);
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
    assertWinnerConsistent(r);
  }
});

test('120 回合兜底：双方存活时可判蓝胜、红胜或平局', () => {
  // 合成夹具只覆盖实卡样本难以触发的引擎兜底；不加入或修改固定 96 张卡库。
  const fixture = (maxHp) => {
    const scale = gLevel(1);
    return {
      ...CARDS[0], id: 'timeout_fixture', name: '超时分支夹具', rarity: 0,
      base: { hp: maxHp / (BASE.hp * scale), atk: 1 / (BASE.atk * scale),
        def: 1 / (BASE.def * scale), spd: 1 },
      acc: 100, eva: 100, crit: 0, critDmg: 1, pen: 0,
      lifesteal: 0, hpRegen: 0, volatility: 0
    };
  };
  // 固定 Seed=0；低攻击产生 1 点有效伤害，120 回合双方均能存活。
  for (const [hpA, hpB, winner, finalA, finalB] of [
    [10000, 1000, 0, 9895, 894],
    [1000, 10000, 1, 895, 9894],
    [1000, 1000, -1, 895, 894]
  ]) {
    const r = simulate(fixture(hpA), 1, fixture(hpB), 1, 0);
    assert.equal(r.rounds, MAX_ROUNDS);
    assert.equal(r.a.alive, true);
    assert.equal(r.b.alive, true);
    assert.equal(r.winner, winner);
    assert.equal(r.a.hp, finalA);
    assert.equal(r.b.hp, finalB);
    assertWinnerConsistent(r);
    const actions = r.events.filter(e => e.cls === 'hit' || e.cls === 'miss');
    assert.equal(actions.length, MAX_ROUNDS * 2, '每回合双方各行动一次');
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      assert.equal(actions.filter(e => e.round === round).length, 2);
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

test('PRNG：uint32 两端和符号位边界符合独立算术参考向量', () => {
  // 由独立无符号 BigInt 实现核对；固定向量可发现可重复但错误的 PRNG 改动。
  const vectors = [
    [0, [1144304738, 1416247, 958946056, 627933444, 2007157716, 2340967985]],
    [0x80000000, [3524353788, 1924613307, 3365584844, 2199219949, 3602660773, 1806097541]],
    [0xFFFFFFFF, [3850105811, 813802916, 3073704848, 4054706436, 3630262831, 2315588663]]
  ];
  for (const [matchSeed, expected] of vectors) {
    const rng = createRng(matchSeed);
    assert.deepEqual(expected.map(() => rng() * 4294967296), expected);
  }
});
