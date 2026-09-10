/* =========================================================
   numerical-battle-lab · src/battle.js
   简单自动 PK：每回合双方各行动一次，SPD 决定先后手。
   流程：再生 → 命中 → 暴击 → 防御/穿透 → 伤害 → 吸血 → 下回合。
   全部随机走内部确定性 PRNG（Mulberry32），同 Match Seed → 同战斗。
   ========================================================= */
(function (global) {
  'use strict';

  const P = (typeof module !== 'undefined' && module.exports) ? require('./power.js') : global.NCB;
  const { buildUnit, fmt } = P;

  const MAX_ROUNDS = 120; // 超时兜底：双方仍存活时按 HP 比例判定

  // 确定性 PRNG：Mulberry32。seed 为 32 位无符号整数。
  function createRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  }

  // 命中率：90% 基准，命中-闪避差 每 1 点 ±0.4%，夹在 45%–99%
  function hitChance(attacker, defender) {
    return clamp(0.90 + (attacker.acc - defender.eva) * 0.004, 0.45, 0.99);
  }

  // 基础伤害：ATK²/(ATK+DEF_eff)。
  // 当 ATK/DEF 随 Level×Rarity 同比例放大时，整体随总 scale 线性增长（等级体系成立）；
  // 单独堆 ATK 时边际收益略高于线性（ATK 仍受 DEF 上限约束，无病态二次增长）。
  function baseDamage(attacker, defender) {
    const defEff = defender.def * Math.max(0.05, 1 - attacker.pen);
    return attacker.atk * attacker.atk / (attacker.atk + defEff);
  }

  // 一方行动一次。事件通过 add 回调输出（携带双方 HP 快照）。
  function act(unit, foe, rng, add) {
    // 再生（回合开始）
    if (unit.hpRegen > 0 && unit.hp < unit.maxHp) {
      const heal = Math.max(1, Math.round(unit.maxHp * unit.hpRegen));
      const before = unit.hp;
      unit.hp = Math.min(unit.maxHp, unit.hp + heal);
      add(`　${unit.name} 再生，恢复 ${fmt(unit.hp - before)} HP`, 'heal');
    }
    // 命中 / 闪避
    if (rng() > hitChance(unit, foe)) {
      add(`　${foe.name} 闪避了 ${unit.name} 的攻击！`, 'miss');
      return;
    }
    // 伤害：ATK²/(ATK+DEF×修正) × 随机波动 × 暴击
    let dmg = baseDamage(unit, foe);
    dmg *= 1 + (rng() * 2 - 1) * unit.volatility;   // 波动
    const isCrit = rng() < unit.crit;               // 暴击
    if (isCrit) dmg *= unit.critDmg;
    dmg = Math.max(1, Math.round(dmg));
    const dealt = Math.min(dmg, foe.hp);
    foe.hp = Math.max(0, foe.hp - dmg);
    add(`　${unit.name} 对 ${foe.name} 造成 ${fmt(dealt)} 伤害${isCrit ? '（暴击！）' : ''}`, isCrit ? 'crit' : 'hit');
    // 吸血
    if (unit.lifesteal > 0 && dealt > 0 && unit.hp < unit.maxHp) {
      const heal = Math.min(Math.max(1, Math.round(dealt * unit.lifesteal)), unit.maxHp - unit.hp);
      unit.hp += heal;
      add(`　${unit.name} 吸取 ${fmt(heal)} HP`, 'heal');
    }
    if (foe.hp <= 0) {
      foe.alive = false;
      add(`💀 ${foe.name} 倒下了！`, 'death');
    }
  }

  // ---- 完整模拟：先确定结果，再生成事件列表 ----
  // 返回 { winner, events, seed, rounds, a, b }
  //   winner: 0 = A 胜, 1 = B 胜, -1 = 平局
  function simulate(cardA, levelA, cardB, levelB, seed) {
    const rng = createRng(seed);
    const A = buildUnit(cardA, levelA);
    const B = buildUnit(cardB, levelB);
    A.alive = true;
    B.alive = true;
    const events = [];
    let round = 0;

    const add = (text, cls) => {
      events.push({
        round,
        text,
        cls,
        hpA: A.hp, maxA: A.maxHp,
        hpB: B.hp, maxB: B.maxHp,
        aliveA: A.alive, aliveB: B.alive
      });
    };

    add(`⚔ 战斗开始 — ${A.name} Lv.${A.level} [${A.rarityName}] VS ${B.name} Lv.${B.level} [${B.rarityName}] · MatchSeed ${seed}`, 'sys');

    while (A.alive && B.alive && round < MAX_ROUNDS) {
      round++;
      // SPD 决定先后手（按速度占比掷骰）
      const goFirst = rng() < A.spd / (A.spd + B.spd) ? A : B;
      const goSecond = goFirst === A ? B : A;
      act(goFirst, goSecond, rng, add);
      if (A.alive && B.alive) act(goSecond, goFirst, rng, add);
    }

    // 判定胜者
    let winner;
    if (!A.alive) winner = 1;
    else if (!B.alive) winner = 0;
    else {
      const rA = A.hp / A.maxHp;
      const rB = B.hp / B.maxHp;
      if (Math.abs(rA - rB) < 0.01) winner = -1;
      else winner = rA > rB ? 0 : 1;
    }

    add(
      winner === 0 ? `🏆 ${A.name}（Lv.${A.level} ${A.rarityName}）获胜` :
      winner === 1 ? `🏆 ${B.name}（Lv.${B.level} ${B.rarityName}）获胜` :
      '⚖ 平局（回合上限，按剩余生命比例判定）',
      winner === -1 ? 'draw' : 'sys'
    );

    return { winner, events, seed, rounds: round, a: A, b: B };
  }

  // ---- 事件回放（纯逻辑）：与播放速度无关 ----
  // applyFn(event, index) 由 UI 提供；delayFn 只决定两次应用之间的等待。
  // 无论 delay 是 0、45ms 还是 120ms，事件序列与最终状态完全一致。
  function applyEvents(events, applyFn, delayFn) {
    return (async () => {
      for (let i = 0; i < events.length; i++) {
        applyFn(events[i], i);
        await delayFn(i, events[i]);
      }
    })();
  }

  const API = { createRng, hitChance, baseDamage, simulate, applyEvents, MAX_ROUNDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NCB = Object.assign(global.NCB || {}, API);
})(typeof window !== 'undefined' ? window : globalThis);
