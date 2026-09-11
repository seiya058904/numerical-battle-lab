/* =========================================================
   numerical-battle-lab · src/power.js
   实力体系：Level（第一维度） × Rarity（第二维度） → 最终属性
   Battle Power：只读最终属性的展示型综合数字，不参与战斗。
   ========================================================= */
(function (global) {
  'use strict';

  const C = (typeof module !== 'undefined' && module.exports) ? require('./cards.js') : global.NCB;
  const { RARITY_LIST, CARDS } = C;

  // 基准属性（p=1 时的参考值；C Lv100 的 p≈81.1257）
  const BASE = { hp: 1200, atk: 200, def: 150, spd: 20 };

  // ---- Level 曲线：超指数增长 ----
  // g(1)=1.02  g(40)=3.38  g(70)=13.52  g(100)=81.12
  // Lv100 / Lv40 = 24 倍属性差 → 实力差距巨大
  function gLevel(level) {
    return Math.exp(0.02143 * level + 0.0002253 * level * level);
  }

  // ---- Rarity 表：显式倍率（C=1.00 → XS Collector=13.20）----
  // Rarity 越高，相邻档之间实力提升越明显；
  // Collector 档（SSS Collector / XS Collector）对前一普通档有明显跳升感。
  // 产品目标：Lv55 XS Collector 的 p = g(55)×13.20 ≈ 84.8 ≈ Lv100 C 的 p ≈ 81.1 → 悬念
  const RARITY_MULT = [1.00, 1.15, 1.35, 1.60, 1.90, 2.30, 2.90, 3.75, 4.90, 6.60, 9.10, 13.20];

  function rarityMul(tier) {
    return RARITY_MULT[tier];
  }

  // 各档位稀有度乘数（调试/展示用）
  const RARITY_TABLE = RARITY_LIST.map((name, i) => ({
    name, tier: i, mult: Math.round(rarityMul(i) * 1000) / 1000
  }));

  // ---- 由固定卡牌 + 等级构建最终单位 ----
  function buildUnit(card, level) {
    const p = gLevel(level) * rarityMul(card.rarity);
    return {
      cardId: card.id,
      name: card.name,
      role: card.role,
      rarity: card.rarity,
      rarityName: RARITY_LIST[card.rarity],
      level,
      maxHp: Math.round(BASE.hp * card.base.hp * p),
      hp: Math.round(BASE.hp * card.base.hp * p),
      atk: Math.round(BASE.atk * card.base.atk * p),
      def: Math.round(BASE.def * card.base.def * p),
      spd: Math.round(BASE.spd * card.base.spd * p),
      acc: card.acc,
      eva: card.eva,
      crit: card.crit,
      critDmg: card.critDmg,
      pen: card.pen,
      lifesteal: card.lifesteal,
      hpRegen: card.hpRegen,
      volatility: card.volatility
    };
  }

  // ---- Battle Power：固定参考属性下的预期输出 × 有限生存能力 ----
  // Seven logarithmically spaced reference ATKs cover the supported scale range.
  // References are constants, not opponents selected by card identity or BP.
  // Reference DEF=8*ATK, HP=6*ATK, SPD=ATK/10, ACC=110, EVA=104,
  // PEN=.05 and expected crit multiplier=1.06. Coefficients fit calibration only.
  // Healing contributes at most 5x survival; initiative multiplier is .75..1.25.
  // Regeneration uses 50% availability: it runs before the action and cannot heal full HP.
  // Geometric averaging prevents the largest reference from dominating the score.
  // Volatility has zero mean and is neutral here; tail risk is not represented.
  const BP_REFERENCES = [2, 20, 200, 2000, 20000, 200000, 2000000];
  function battlePower(u) {
    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
    const hit = clamp(.90 + (u.acc - 104) * .004, .45, .99);
    const incomingHit = clamp(.90 + (110 - u.eva) * .004, .45, .99);
    const critMean = 1 + u.crit * (u.critDmg - 1);
    let logPower = 0;
    for (const ref of BP_REFERENCES) {
      const output = u.atk * u.atk / (u.atk + ref * 8 * Math.max(.05, 1 - u.pen)) * hit * critMean;
      const incoming = ref * ref / (ref + u.def * .95) * incomingHit * 1.06;
      const healing = Math.min(output, ref * 6) * u.lifesteal + 0.5 * u.maxHp * u.hpRegen;
      const survival = u.maxHp / incoming * (1 + 4 * healing / (incoming + healing));
      const initiative = 1 + .5 * (u.spd / (u.spd + ref / 10) - .5);
      logPower += Math.log(Math.round(Math.sqrt(output * survival * ref) * initiative));
    }
    return Math.round(Math.exp(logPower / BP_REFERENCES.length));
  }

  function fmt(n) {
    return Math.round(n).toLocaleString('en-US');
  }

  const STAT_LABELS = {
    maxHp: '生命', atk: '攻击', def: '防御', spd: '速度',
    acc: '命中', eva: '闪避', crit: '暴击率', critDmg: '暴击伤害',
    pen: '穿透', lifesteal: '吸血', hpRegen: '每回合回复', volatility: '波动'
  };

  // 展示用属性行（12 项）
  function statRows(u) {
    return [
      ['maxHp', fmt(u.maxHp)],
      ['atk', fmt(u.atk)],
      ['def', fmt(u.def)],
      ['spd', fmt(u.spd)],
      ['acc', String(u.acc)],
      ['eva', String(u.eva)],
      ['crit', (u.crit * 100).toFixed(0) + '%'],
      ['critDmg', (u.critDmg * 100).toFixed(0) + '%'],
      ['pen', (u.pen * 100).toFixed(0) + '%'],
      ['lifesteal', (u.lifesteal * 100).toFixed(0) + '%'],
      ['hpRegen', (u.hpRegen * 100).toFixed(1) + '%'],
      ['volatility', (u.volatility * 100).toFixed(0) + '%']
    ];
  }

  const API = { BASE, gLevel, rarityMul, RARITY_TABLE, buildUnit, battlePower, fmt, STAT_LABELS, statRows, CARDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NCB = Object.assign(global.NCB || {}, API);
})(typeof window !== 'undefined' ? window : globalThis);
