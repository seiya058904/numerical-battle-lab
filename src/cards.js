/* =========================================================
   numerical-battle-lab · src/cards.js
   固定内置卡牌库：12 档稀有度 × 每档 2 张 = 24 张系统卡。
   玩家不生成、不导入、不编辑卡牌 —— 这就是全部卡池。

   形状约定：
   1. 核心四维的“战斗强度” (hp·atk²/(atk+def)) 全稀有度基本恒定（≈0.75）；
   2. 百分比属性（命中/闪避/暴击/穿透/吸血/再生/波动）收窄到窄带，
      只表达卡牌“性格”（偏攻击/偏生存/偏速度/偏暴击/偏吸血），
      不制造跨档碾压。
   稀有度差距完全由 rarityMul（C=1 → XS Collector=6）表达：
   → 同级 C vs XS Collector = 6 倍碾压；
   → Lv70 XS Collector vs Lv100 C（同 p）≈ 势均力敌 → 真正悬念；
   → 同档对抗互有胜负。
   ========================================================= */
(function (global) {
  'use strict';

  // 12 档稀有度（低 → 高）
  const RARITY_LIST = [
    'C', 'C+', 'B', 'B+', 'A', 'A+',
    'S', 'SS', 'SSS', 'SSS Collector', 'XS', 'XS Collector'
  ];

  const RARITY_COLOR = {
    'C': '#8b929c',
    'C+': '#a3abb8',
    'B': '#3fae5a',
    'B+': '#2ecc71',
    'A': '#3498db',
    'A+': '#6366f1',
    'S': '#a855f7',
    'SS': '#ec4899',
    'SSS': '#f59e0b',
    'SSS Collector': '#e8590c',
    'XS': '#ffd700',
    'XS Collector': '#ff6b6b'
  };

  // 卡牌字段说明：
  //   base.hp/atk/def/spd — 相对基准（C Lv100 时 p=1）的形状乘数
  //   acc/eva            — 命中 / 闪避（百分制，等级无关）
  //   crit/critDmg       — 暴击率 / 暴击伤害（等级无关）
  //   pen                — 穿透：无视目标防御的比例
  //   lifesteal          — 吸血：造成伤害的回血比例
  //   hpRegen            — 再生：每回合回复最大生命比例
  //   volatility         — 波动：伤害随机浮动幅度（±volatility）
  const CARDS = [
    /* ---------- C ---------- */
    { id: 'iron_guard', name: '铁盾卫兵', rarity: 0, role: '重装', desc: '高防高血的重装守卫，稳扎稳打。',
      base: { hp: 1.55, atk: 1.10, def: 1.45, spd: 0.85 },
      acc: 108, eva: 88, crit: 0.06, critDmg: 1.45, pen: 0, lifesteal: 0, hpRegen: 0.005, volatility: 0.10 },
    { id: 'axe_brute', name: '石斧蛮兵', rarity: 0, role: '狂战', desc: '攻击高于同阶的粗犷蛮兵。',
      base: { hp: 1.20, atk: 1.30, def: 1.10, spd: 1.00 },
      acc: 106, eva: 94, crit: 0.08, critDmg: 1.50, pen: 0.04, lifesteal: 0.07, hpRegen: 0, volatility: 0.18 },

    /* ---------- C+ ---------- */
    { id: 'berserker', name: '狂暴战士', rarity: 1, role: '吸血', desc: '高攻击与吸血，以战养战。',
      base: { hp: 1.10, atk: 1.32, def: 0.95, spd: 1.05 },
      acc: 103, eva: 96, crit: 0.08, critDmg: 1.50, pen: 0.04, lifesteal: 0.05, hpRegen: 0, volatility: 0.14 },
    { id: 'scout', name: '轻甲斥候', rarity: 1, role: '敏捷', desc: '极高机动性，靠闪避与暴击取巧。',
      base: { hp: 1.00, atk: 1.20, def: 0.85, spd: 1.45 },
      acc: 114, eva: 112, crit: 0.17, critDmg: 1.65, pen: 0.02, lifesteal: 0.03, hpRegen: 0, volatility: 0.12 },

    /* ---------- B ---------- */
    { id: 'stone_giant', name: '岩石巨人', rarity: 2, role: '重装', desc: '极端生命与防御，但攻击与速度贫弱。',
      base: { hp: 1.50, atk: 1.05, def: 1.30, spd: 0.60 },
      acc: 116, eva: 70, crit: 0.06, critDmg: 1.40, pen: 0, lifesteal: 0, hpRegen: 0.006, volatility: 0.06 },
    { id: 'wind_ranger', name: '疾风游侠', rarity: 2, role: '游侠', desc: '高频机动，暴击与闪避兼备。',
      base: { hp: 0.95, atk: 1.30, def: 0.80, spd: 1.50 },
      acc: 120, eva: 110, crit: 0.22, critDmg: 1.80, pen: 0.03, lifesteal: 0.02, hpRegen: 0, volatility: 0.12 },

    /* ---------- B+ ---------- */
    { id: 'corruptor', name: '腐蚀术士', rarity: 3, role: '穿透', desc: '高穿透与持续再生，稳步磨穿敌人的防线。',
      base: { hp: 1.05, atk: 1.20, def: 0.90, spd: 0.95 },
      acc: 112, eva: 92, crit: 0.09, critDmg: 1.50, pen: 0.09, lifesteal: 0.05, hpRegen: 0.008, volatility: 0.14 },
    { id: 'shadow_assassin', name: '幽影刺客', rarity: 3, role: '刺客', desc: '高暴击高闪避，脆皮但致命。',
      base: { hp: 0.85, atk: 1.35, def: 0.75, spd: 1.35 },
      acc: 112, eva: 110, crit: 0.17, critDmg: 1.75, pen: 0.10, lifesteal: 0.05, hpRegen: 0, volatility: 0.16 },

    /* ---------- A ---------- */
    { id: 'light_priest', name: '圣光牧师', rarity: 4, role: '再生', desc: '强大的自我恢复能力，以持久战拖垮对手。',
      base: { hp: 1.20, atk: 1.15, def: 1.10, spd: 1.00 },
      acc: 112, eva: 100, crit: 0.07, critDmg: 1.45, pen: 0, lifesteal: 0.04, hpRegen: 0.010, volatility: 0.08 },
    { id: 'heavy_knight', name: '重装骑士', rarity: 4, role: '骑士', desc: '攻守兼备的均衡骑士。',
      base: { hp: 1.35, atk: 1.15, def: 1.25, spd: 0.90 },
      acc: 108, eva: 92, crit: 0.08, critDmg: 1.50, pen: 0.02, lifesteal: 0.02, hpRegen: 0.006, volatility: 0.08 },

    /* ---------- A+ ---------- */
    { id: 'frost_mage', name: '霜冻法师', rarity: 5, role: '法师', desc: '高速高闪避，灵活机动的战场术士。',
      base: { hp: 1.00, atk: 1.25, def: 0.90, spd: 1.15 },
      acc: 114, eva: 98, crit: 0.11, critDmg: 1.55, pen: 0.06, lifesteal: 0.03, hpRegen: 0.005, volatility: 0.12 },
    { id: 'flame_mage', name: '烈焰法师', rarity: 5, role: '爆发', desc: '高倍率单体爆发，伤害波动极大。',
      base: { hp: 0.95, atk: 1.35, def: 0.85, spd: 1.00 },
      acc: 112, eva: 94, crit: 0.11, critDmg: 1.60, pen: 0.08, lifesteal: 0.04, hpRegen: 0, volatility: 0.18 },

    /* ---------- S ---------- */
    { id: 'shadow_lord', name: '暗影君主', rarity: 6, role: '爆发', desc: '极致单体爆发，配合吸血续航。',
      base: { hp: 1.00, atk: 1.35, def: 0.90, spd: 1.15 },
      acc: 106, eva: 106, crit: 0.11, critDmg: 1.60, pen: 0.10, lifesteal: 0.04, hpRegen: 0, volatility: 0.14 },
    { id: 'dragon_knight', name: '龙血骑士', rarity: 6, role: '吸血', desc: '高生命、吸血与再生，续航极强的战士。',
      base: { hp: 1.35, atk: 1.15, def: 1.20, spd: 0.95 },
      acc: 108, eva: 96, crit: 0.10, critDmg: 1.55, pen: 0.04, lifesteal: 0.06, hpRegen: 0.004, volatility: 0.10 },

    /* ---------- SS ---------- */
    { id: 'lava_lord', name: '熔岩领主', rarity: 7, role: '再生', desc: '高生命与再生能力，稳步消耗对手。',
      base: { hp: 1.25, atk: 1.20, def: 1.10, spd: 0.95 },
      acc: 106, eva: 94, crit: 0.09, critDmg: 1.60, pen: 0.06, lifesteal: 0.04, hpRegen: 0.006, volatility: 0.12 },
    { id: 'storm_valkyrie', name: '风暴女武神', rarity: 7, role: '极速', desc: '极高速度与暴击，机动性顶尖。',
      base: { hp: 1.00, atk: 1.30, def: 0.90, spd: 1.40 },
      acc: 114, eva: 112, crit: 0.16, critDmg: 1.65, pen: 0.06, lifesteal: 0.03, hpRegen: 0, volatility: 0.14 },

    /* ---------- SSS ---------- */
    { id: 'time_traveler', name: '时空旅者', rarity: 8, role: '极速', desc: '极速与高闪避，令对手难以命中。',
      base: { hp: 1.05, atk: 1.25, def: 0.95, spd: 1.50 },
      acc: 114, eva: 110, crit: 0.12, critDmg: 1.60, pen: 0.08, lifesteal: 0.04, hpRegen: 0.003, volatility: 0.12 },
    { id: 'thunder_god', name: '雷霆战神', rarity: 8, role: '爆发', desc: '高攻击与暴击，纯粹的破坏力。',
      base: { hp: 1.15, atk: 1.26, def: 1.05, spd: 1.10 },
      acc: 112, eva: 102, crit: 0.12, critDmg: 1.65, pen: 0.10, lifesteal: 0.02, hpRegen: 0, volatility: 0.15 },

    /* ---------- SSS Collector ---------- */
    { id: 'starfall_warden', name: '星陨守护者', rarity: 9, role: '坚壁', desc: '天穹的壁垒，生存能力登峰造极。',
      base: { hp: 1.40, atk: 1.12, def: 1.30, spd: 0.95 },
      acc: 112, eva: 98, crit: 0.07, critDmg: 1.50, pen: 0.03, lifesteal: 0.03, hpRegen: 0.004, volatility: 0.08 },
    { id: 'solstice_blade', name: '极昼圣剑', rarity: 9, role: '破甲', desc: '无视护甲的圣剑，攻无不克。',
      base: { hp: 1.00, atk: 1.30, def: 0.90, spd: 1.25 },
      acc: 112, eva: 100, crit: 0.15, critDmg: 1.60, pen: 0.14, lifesteal: 0.05, hpRegen: 0, volatility: 0.14 },

    /* ---------- XS ---------- */
    { id: 'void_devourer', name: '虚空吞噬者', rarity: 10, role: '全能', desc: '虚空的主宰，攻防续航皆臻极致。',
      base: { hp: 1.20, atk: 1.22, def: 1.10, spd: 1.20 },
      acc: 112, eva: 104, crit: 0.11, critDmg: 1.60, pen: 0.10, lifesteal: 0.05, hpRegen: 0.006, volatility: 0.12 },
    { id: 'primordial_dragon', name: '原初之龙', rarity: 10, role: '全能', desc: '攻防兼备、续航稳定的巨龙。',
      base: { hp: 1.30, atk: 1.18, def: 1.15, spd: 1.05 },
      acc: 110, eva: 100, crit: 0.10, critDmg: 1.60, pen: 0.08, lifesteal: 0.05, hpRegen: 0.004, volatility: 0.14 },

    /* ---------- XS Collector ---------- */
    { id: 'avatar_of_the_end', name: '终焉化身', rarity: 11, role: '全能', desc: '全维度均衡的顶点，攻防续航皆优。',
      base: { hp: 1.25, atk: 1.18, def: 1.15, spd: 1.25 },
      acc: 110, eva: 94, crit: 0.10, critDmg: 1.55, pen: 0.12, lifesteal: 0.03, hpRegen: 0.003, volatility: 0.12 },
    { id: 'origin_star', name: '起源之星', rarity: 11, role: '爆发', desc: '以极致攻击与暴击一击定胜负，穿透护甲。',
      base: { hp: 1.00, atk: 1.32, def: 0.95, spd: 1.30 },
      acc: 112, eva: 100, crit: 0.13, critDmg: 1.65, pen: 0.16, lifesteal: 0.04, hpRegen: 0, volatility: 0.18 }
  ];

  const API = { RARITY_LIST, RARITY_COLOR, CARDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NCB = Object.assign(global.NCB || {}, API);
})(typeof window !== 'undefined' ? window : globalThis);
