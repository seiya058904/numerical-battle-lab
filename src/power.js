/* =========================================================
   numerical-battle-lab · src/power.js
   实力体系：Level（第一维度） × Rarity（第二维度） → 最终属性
   Battle Power：只读最终属性的展示型综合数字，不参与战斗。
   ========================================================= */
(function (global) {
  'use strict';

  const C = (typeof module !== 'undefined' && module.exports) ? require('./cards.js') : global.NCB;
  const { RARITY_LIST, CARDS } = C;

  // 基准属性（C、Lv100、p=1 时的参考值）
  const BASE = { hp: 1200, atk: 200, def: 150, spd: 20 };

  // ---- Level 曲线：超指数增长 ----
  // g(1)=1.02  g(40)=3.38  g(70)=13.52  g(100)=81.12
  // Lv100 / Lv40 = 24 倍属性差 → 实力差距巨大
  function gLevel(level) {
    return Math.exp(0.02143 * level + 0.0002253 * level * level);
  }

  // ---- Rarity 曲线：C=1.00 → XS Collector=6.00，每档 ≈ 18% 成长（纯指数）----
  // Lv70 XS Collector 的 p = 13.52 × 6.00 = 81.1 ≈ Lv100 C 的 p = 81.1 → 真正悬念
  function rarityMul(tier) {
    return Math.exp(Math.log(6) / 11 * tier);
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

  // ---- Battle Power：透明线性综合公式 ----
  // 只用于展示“综合实力”，不参与战斗、不修改伤害、不强制胜者。
  // 长期平均：BP 越高越强；实力接近时允许互有胜负。
  function battlePower(u) {
    return Math.round(
      u.maxHp * 0.30 +
      u.atk * 3.40 +
      u.def * 1.00 +
      u.spd * 14 +
      u.acc * 1.60 +
      u.eva * 1.60 +
      u.crit * 900 +
      u.critDmg * 80 +
      u.pen * 700 +
      u.lifesteal * 650 +
      u.hpRegen * 550 +
      u.volatility * 120
    );
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
