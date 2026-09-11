/* =========================================================
   numerical-battle-lab · src/cards.js
   固定内置卡牌库：12 档稀有度 × 每档 8 张 = 96 张系统卡。
   其中前代 24 张保留为 LEGACY_CARDS，供冻结的 BP v4 审计继续使用；
   新增 72 张只使用现有 12 项属性，不引入技能、状态或隐藏倍率。

   形状约定：
   1. 核心四维保持窄带归一化，避免角色名称本身带来额外强度；
   2. 百分比属性只表达风格（重装/强攻/极速/爆发/精准/续航）；
   3. 稀有度强度仍只由 rarityMul（C=1 → XS Collector=13.20）表达。
   ========================================================= */
(function (global) {
  'use strict';

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

  // source/profile 为展示与验收元数据，不参与战斗。
  // 新卡仍只使用 base + acc/eva/crit/critDmg/pen/lifesteal/hpRegen/volatility。
  const CARDS = [
    /* ---------- C · legacy ---------- */
    { id: 'iron_guard', name: '铁盾卫兵', rarity: 0, role: '重装', desc: '高防高血的重装守卫，稳扎稳打。',
      base: { hp: 1.55, atk: 1.1, def: 1.45, spd: .85 },
      acc: 108, eva: 88, crit: .06, critDmg: 1.45, pen: 0, lifesteal: 0, hpRegen: .005, volatility: .1 },
    { id: 'axe_brute', name: '石斧蛮兵', rarity: 0, role: '狂战', desc: '攻击高于同阶的粗犷蛮兵。',
      base: { hp: 1.2, atk: 1.3, def: 1.1, spd: 1.0 },
      acc: 106, eva: 94, crit: .08, critDmg: 1.5, pen: .04, lifesteal: .07, hpRegen: 0, volatility: .18 },

    /* ---------- C+ · legacy ---------- */
    { id: 'berserker', name: '狂暴战士', rarity: 1, role: '吸血', desc: '高攻击与吸血，以战养战。',
      base: { hp: 1.1, atk: 1.32, def: .95, spd: 1.05 },
      acc: 103, eva: 96, crit: .08, critDmg: 1.5, pen: .04, lifesteal: .05, hpRegen: 0, volatility: .14 },
    { id: 'scout', name: '轻甲斥候', rarity: 1, role: '敏捷', desc: '极高机动性，靠闪避与暴击取巧。',
      base: { hp: 1.0, atk: 1.2, def: .85, spd: 1.45 },
      acc: 114, eva: 112, crit: .17, critDmg: 1.65, pen: .02, lifesteal: .03, hpRegen: 0, volatility: .12 },

    /* ---------- B · legacy ---------- */
    { id: 'stone_giant', name: '岩石巨人', rarity: 2, role: '重装', desc: '极端生命与防御，但攻击与速度贫弱。',
      base: { hp: 1.5, atk: 1.05, def: 1.3, spd: .6 },
      acc: 116, eva: 70, crit: .06, critDmg: 1.4, pen: 0, lifesteal: 0, hpRegen: .006, volatility: .06 },
    { id: 'wind_ranger', name: '疾风游侠', rarity: 2, role: '游侠', desc: '高频机动，暴击与闪避兼备。',
      base: { hp: .95, atk: 1.3, def: .8, spd: 1.5 },
      acc: 120, eva: 110, crit: .22, critDmg: 1.8, pen: .03, lifesteal: .02, hpRegen: 0, volatility: .12 },

    /* ---------- B+ · legacy ---------- */
    { id: 'corruptor', name: '腐蚀术士', rarity: 3, role: '穿透', desc: '高穿透与持续再生，稳步磨穿敌人的防线。',
      base: { hp: 1.05, atk: 1.2, def: .9, spd: .95 },
      acc: 112, eva: 92, crit: .09, critDmg: 1.5, pen: .09, lifesteal: .05, hpRegen: .008, volatility: .14 },
    { id: 'shadow_assassin', name: '幽影刺客', rarity: 3, role: '刺客', desc: '高暴击高闪避，脆皮但致命。',
      base: { hp: .85, atk: 1.35, def: .75, spd: 1.35 },
      acc: 112, eva: 110, crit: .17, critDmg: 1.75, pen: .1, lifesteal: .05, hpRegen: 0, volatility: .16 },

    /* ---------- A · legacy ---------- */
    { id: 'light_priest', name: '圣光牧师', rarity: 4, role: '再生', desc: '强大的自我恢复能力，以持久战拖垮对手。',
      base: { hp: 1.2, atk: 1.15, def: 1.1, spd: 1.0 },
      acc: 112, eva: 100, crit: .07, critDmg: 1.45, pen: 0, lifesteal: .04, hpRegen: .01, volatility: .08 },
    { id: 'heavy_knight', name: '重装骑士', rarity: 4, role: '骑士', desc: '攻守兼备的均衡骑士。',
      base: { hp: 1.35, atk: 1.15, def: 1.25, spd: .9 },
      acc: 108, eva: 92, crit: .08, critDmg: 1.5, pen: .02, lifesteal: .02, hpRegen: .006, volatility: .08 },

    /* ---------- A+ · legacy ---------- */
    { id: 'frost_mage', name: '霜冻法师', rarity: 5, role: '法师', desc: '高速高闪避，灵活机动的战场术士。',
      base: { hp: 1.0, atk: 1.25, def: .9, spd: 1.15 },
      acc: 114, eva: 98, crit: .11, critDmg: 1.55, pen: .06, lifesteal: .03, hpRegen: .005, volatility: .12 },
    { id: 'flame_mage', name: '烈焰法师', rarity: 5, role: '爆发', desc: '高倍率单体爆发，伤害波动极大。',
      base: { hp: .95, atk: 1.35, def: .85, spd: 1.0 },
      acc: 112, eva: 94, crit: .11, critDmg: 1.6, pen: .08, lifesteal: .04, hpRegen: 0, volatility: .18 },

    /* ---------- S · legacy ---------- */
    { id: 'shadow_lord', name: '暗影君主', rarity: 6, role: '爆发', desc: '极致单体爆发，配合吸血续航。',
      base: { hp: 1.0, atk: 1.35, def: .9, spd: 1.15 },
      acc: 106, eva: 106, crit: .11, critDmg: 1.6, pen: .1, lifesteal: .04, hpRegen: 0, volatility: .14 },
    { id: 'dragon_knight', name: '龙血骑士', rarity: 6, role: '吸血', desc: '高生命、吸血与再生，续航极强的战士。',
      base: { hp: 1.35, atk: 1.15, def: 1.2, spd: .95 },
      acc: 108, eva: 96, crit: .1, critDmg: 1.55, pen: .04, lifesteal: .06, hpRegen: .004, volatility: .1 },

    /* ---------- SS · legacy ---------- */
    { id: 'lava_lord', name: '熔岩领主', rarity: 7, role: '再生', desc: '高生命与再生能力，稳步消耗对手。',
      base: { hp: 1.25, atk: 1.2, def: 1.1, spd: .95 },
      acc: 106, eva: 94, crit: .09, critDmg: 1.6, pen: .06, lifesteal: .04, hpRegen: .006, volatility: .12 },
    { id: 'storm_valkyrie', name: '风暴女武神', rarity: 7, role: '极速', desc: '极高速度与暴击，机动性顶尖。',
      base: { hp: 1.0, atk: 1.3, def: .9, spd: 1.4 },
      acc: 114, eva: 112, crit: .16, critDmg: 1.65, pen: .06, lifesteal: .03, hpRegen: 0, volatility: .14 },

    /* ---------- SSS · legacy ---------- */
    { id: 'time_traveler', name: '时空旅者', rarity: 8, role: '极速', desc: '极速与高闪避，令对手难以命中。',
      base: { hp: 1.05, atk: 1.25, def: .95, spd: 1.5 },
      acc: 114, eva: 110, crit: .12, critDmg: 1.6, pen: .08, lifesteal: .04, hpRegen: .003, volatility: .12 },
    { id: 'thunder_god', name: '雷霆战神', rarity: 8, role: '爆发', desc: '高攻击与暴击，纯粹的破坏力。',
      base: { hp: 1.15, atk: 1.26, def: 1.05, spd: 1.1 },
      acc: 112, eva: 102, crit: .12, critDmg: 1.65, pen: .1, lifesteal: .02, hpRegen: 0, volatility: .15 },

    /* ---------- SSS Collector · legacy ---------- */
    { id: 'starfall_warden', name: '星陨守护者', rarity: 9, role: '坚壁', desc: '天穹的壁垒，生存能力登峰造极。',
      base: { hp: 1.4, atk: 1.12, def: 1.3, spd: .95 },
      acc: 112, eva: 98, crit: .07, critDmg: 1.5, pen: .03, lifesteal: .03, hpRegen: .004, volatility: .08 },
    { id: 'solstice_blade', name: '极昼圣剑', rarity: 9, role: '破甲', desc: '无视护甲的圣剑，攻无不克。',
      base: { hp: 1.0, atk: 1.3, def: .9, spd: 1.25 },
      acc: 112, eva: 100, crit: .15, critDmg: 1.6, pen: .14, lifesteal: .05, hpRegen: 0, volatility: .14 },

    /* ---------- XS · legacy ---------- */
    { id: 'void_devourer', name: '虚空吞噬者', rarity: 10, role: '全能', desc: '虚空的主宰，攻防续航皆臻极致。',
      base: { hp: 1.2, atk: 1.22, def: 1.1, spd: 1.2 },
      acc: 112, eva: 104, crit: .11, critDmg: 1.6, pen: .1, lifesteal: .05, hpRegen: .006, volatility: .12 },
    { id: 'primordial_dragon', name: '原初之龙', rarity: 10, role: '全能', desc: '攻防兼备、续航稳定的巨龙。',
      base: { hp: 1.3, atk: 1.18, def: 1.15, spd: 1.05 },
      acc: 110, eva: 100, crit: .1, critDmg: 1.6, pen: .08, lifesteal: .05, hpRegen: .004, volatility: .14 },

    /* ---------- XS Collector · legacy ---------- */
    { id: 'avatar_of_the_end', name: '终焉化身', rarity: 11, role: '全能', desc: '全维度均衡的顶点，攻防续航皆优。',
      base: { hp: 1.25, atk: 1.18, def: 1.15, spd: 1.25 },
      acc: 110, eva: 94, crit: .1, critDmg: 1.55, pen: .12, lifesteal: .03, hpRegen: .003, volatility: .12 },
    { id: 'origin_star', name: '起源之星', rarity: 11, role: '爆发', desc: '以极致攻击与暴击一击定胜负，穿透护甲。',
      base: { hp: 1.0, atk: 1.32, def: .95, spd: 1.3 },
      acc: 112, eva: 100, crit: .13, critDmg: 1.65, pen: .16, lifesteal: .04, hpRegen: 0, volatility: .18 },

    /* ---------- C · expansion ---------- */
    { id: 'muhammad_ali', name: '穆罕默德·阿里', source: '现实人物', profile: 'tank', rarity: 0, role: '拳王', desc: '高耐久与稳定防守，擅长把比赛拖入自己的节奏。',
      base: { hp: 1.451, atk: 1.209, def: 1.346, spd: .925 },
      acc: 106, eva: 86, crit: .05, critDmg: 1.42, pen: .01, lifesteal: 0, hpRegen: .003, volatility: .06 },
    { id: 'bruce_lee', name: '李小龙', source: '现实人物', profile: 'bruiser', rarity: 0, role: '截拳', desc: '攻守节奏紧凑，爆发与持续输出兼顾。',
      base: { hp: 1.261, atk: 1.24, def: 1.114, spd: 1.093 },
      acc: 109, eva: 96, crit: .1, critDmg: 1.55, pen: .05, lifesteal: .04, hpRegen: .001, volatility: .13 },
    { id: 'usain_bolt', name: '尤塞恩·博尔特', source: '现实人物', profile: 'speed', rarity: 0, role: '极速', desc: '以速度和闪避见长，抢占先手。',
      base: { hp: 1.051, atk: 1.324, def: .904, spd: 1.556 },
      acc: 117, eva: 111, crit: .16, critDmg: 1.62, pen: .05, lifesteal: .03, hpRegen: 0, volatility: .11 },
    { id: 'jackie_chan', name: '成龙', source: '现实人物', profile: 'assassin', rarity: 0, role: '机巧', desc: '高机动、高暴击，依靠灵活节奏制造机会。',
      base: { hp: .988, atk: 1.377, def: .883, spd: 1.367 },
      acc: 114, eva: 107, crit: .18, critDmg: 1.7, pen: .09, lifesteal: .03, hpRegen: 0, volatility: .15 },
    { id: 'sherlock_holmes', name: '夏洛克·福尔摩斯', source: '《福尔摩斯》', profile: 'precision', rarity: 0, role: '洞察', desc: '极高命中与稳定输出，波动很小。',
      base: { hp: 1.135, atk: 1.314, def: 1.051, spd: 1.219 },
      acc: 122, eva: 100, crit: .11, critDmg: 1.55, pen: .06, lifesteal: .02, hpRegen: .001, volatility: .06 },
    { id: 'mr_bean', name: '憨豆先生', source: '《憨豆先生》', profile: 'sustain', rarity: 0, role: '幸运', desc: '不擅长爆发，但意外地耐打且续航稳定。',
      base: { hp: 1.346, atk: 1.23, def: 1.219, spd: 1.009 },
      acc: 109, eva: 96, crit: .08, critDmg: 1.5, pen: .03, lifesteal: .04, hpRegen: .003, volatility: .09 },

    /* ---------- C+ · expansion ---------- */
    { id: 'rocky_balboa', name: '洛奇·巴尔博亚', source: '《洛奇》', profile: 'tank', rarity: 1, role: '硬汉', desc: '耐久突出，越拖越能体现稳定性。',
      base: { hp: 1.346, atk: 1.121, def: 1.248, spd: .858 },
      acc: 106, eva: 86, crit: .05, critDmg: 1.42, pen: .01, lifesteal: 0, hpRegen: .003, volatility: .06 },
    { id: 'michael_jordan', name: '迈克尔·乔丹', source: '现实人物', profile: 'bruiser', rarity: 1, role: '强攻', desc: '均衡而直接的进攻型数值轮廓。',
      base: { hp: 1.17, atk: 1.151, def: 1.034, spd: 1.014 },
      acc: 109, eva: 96, crit: .1, critDmg: 1.55, pen: .05, lifesteal: .04, hpRegen: .001, volatility: .13 },
    { id: 'michael_jackson', name: '迈克尔·杰克逊', source: '现实人物', profile: 'speed', rarity: 1, role: '舞步', desc: '速度与闪避突出，节奏极快。',
      base: { hp: .975, atk: 1.229, def: .839, spd: 1.443 },
      acc: 117, eva: 111, crit: .16, critDmg: 1.62, pen: .05, lifesteal: .03, hpRegen: 0, volatility: .11 },
    { id: 'indiana_jones', name: '印第安纳·琼斯', source: '《夺宝奇兵》', profile: 'assassin', rarity: 1, role: '冒险', desc: '高风险高回报，暴击与波动明显。',
      base: { hp: .917, atk: 1.277, def: .819, spd: 1.268 },
      acc: 114, eva: 107, crit: .18, critDmg: 1.7, pen: .09, lifesteal: .03, hpRegen: 0, volatility: .15 },
    { id: 'albert_einstein', name: '阿尔伯特·爱因斯坦', source: '现实人物', profile: 'precision', rarity: 1, role: '计算', desc: '命中稳定，数值波动极低。',
      base: { hp: 1.053, atk: 1.219, def: .975, spd: 1.131 },
      acc: 122, eva: 100, crit: .11, critDmg: 1.55, pen: .06, lifesteal: .02, hpRegen: .001, volatility: .06 },
    { id: 'leonardo_da_vinci', name: '列奥纳多·达·芬奇', source: '现实人物', profile: 'sustain', rarity: 1, role: '博学', desc: '攻守均衡，恢复与续航较强。',
      base: { hp: 1.248, atk: 1.141, def: 1.131, spd: .936 },
      acc: 109, eva: 96, crit: .08, critDmg: 1.5, pen: .03, lifesteal: .04, hpRegen: .003, volatility: .09 },

    /* ---------- B · expansion ---------- */
    { id: 'solid_snake', name: 'Solid Snake', source: '《Metal Gear》', profile: 'tank', rarity: 2, role: '潜行', desc: '耐久和防守出色，胜在稳定。',
      base: { hp: 1.376, atk: 1.146, def: 1.276, spd: .877 },
      acc: 106, eva: 86, crit: .05, critDmg: 1.42, pen: .01, lifesteal: 0, hpRegen: .003, volatility: .06 },
    { id: 'lara_croft', name: '劳拉·克劳馥', source: '《古墓丽影》', profile: 'bruiser', rarity: 2, role: '探险', desc: '攻击与机动兼备，正面能力均衡。',
      base: { hp: 1.196, atk: 1.176, def: 1.057, spd: 1.037 },
      acc: 109, eva: 96, crit: .1, critDmg: 1.55, pen: .05, lifesteal: .04, hpRegen: .001, volatility: .13 },
    { id: 'james_bond', name: '詹姆斯·邦德', source: '《007》', profile: 'speed', rarity: 2, role: '特工', desc: '行动速度快，命中与闪避均较高。',
      base: { hp: .997, atk: 1.256, def: .857, spd: 1.475 },
      acc: 117, eva: 111, crit: .16, critDmg: 1.62, pen: .05, lifesteal: .03, hpRegen: 0, volatility: .11 },
    { id: 'ezio_auditore', name: '艾吉奥·奥迪托雷', source: '《刺客信条》', profile: 'assassin', rarity: 2, role: '刺客', desc: '高暴击与穿透，擅长快速结束战斗。',
      base: { hp: .937, atk: 1.306, def: .837, spd: 1.296 },
      acc: 114, eva: 107, crit: .18, critDmg: 1.7, pen: .09, lifesteal: .03, hpRegen: 0, volatility: .15 },
    { id: 'john_wick', name: '约翰·威克', source: '《疾速追杀》', profile: 'precision', rarity: 2, role: '枪斗', desc: '极高命中、低波动，输出稳定。',
      base: { hp: 1.077, atk: 1.246, def: .997, spd: 1.156 },
      acc: 122, eva: 100, crit: .11, critDmg: 1.55, pen: .06, lifesteal: .02, hpRegen: .001, volatility: .06 },
    { id: 'leon_kennedy', name: '里昂·S·肯尼迪', source: '《生化危机》', profile: 'sustain', rarity: 2, role: '生存', desc: '均衡耐久与恢复，适合持久战。',
      base: { hp: 1.276, atk: 1.166, def: 1.156, spd: .957 },
      acc: 109, eva: 96, crit: .08, critDmg: 1.5, pen: .03, lifesteal: .04, hpRegen: .003, volatility: .09 },

    /* ---------- B+ · expansion ---------- */
    { id: 'geralt_rivia', name: '杰洛特', source: '《巫师》', profile: 'tank', rarity: 3, role: '猎魔', desc: '高耐久与防守，正面战稳定。',
      base: { hp: 1.332, atk: 1.11, def: 1.235, spd: .849 },
      acc: 106, eva: 86, crit: .05, critDmg: 1.42, pen: .01, lifesteal: 0, hpRegen: .003, volatility: .06 },
    { id: 'ryu', name: '隆', source: '《街头霸王》', profile: 'bruiser', rarity: 3, role: '格斗', desc: '力量与续航均衡，偏正面强攻。',
      base: { hp: 1.158, atk: 1.139, def: 1.023, spd: 1.004 },
      acc: 109, eva: 96, crit: .1, critDmg: 1.55, pen: .05, lifesteal: .04, hpRegen: .001, volatility: .13 },
    { id: 'chun_li', name: '春丽', source: '《街头霸王》', profile: 'speed', rarity: 3, role: '极速', desc: '速度与闪避突出，擅长先手压制。',
      base: { hp: .965, atk: 1.216, def: .83, spd: 1.428 },
      acc: 117, eva: 111, crit: .16, critDmg: 1.62, pen: .05, lifesteal: .03, hpRegen: 0, volatility: .11 },
    { id: 'levi_ackerman', name: '利威尔·阿克曼', source: '《进击的巨人》', profile: 'assassin', rarity: 3, role: '斩击', desc: '高暴击高机动，防御偏低。',
      base: { hp: .907, atk: 1.264, def: .811, spd: 1.254 },
      acc: 114, eva: 107, crit: .18, critDmg: 1.7, pen: .09, lifesteal: .03, hpRegen: 0, volatility: .15 },
    { id: 'tanjiro_kamado', name: '灶门炭治郎', source: '《鬼灭之刃》', profile: 'precision', rarity: 3, role: '剑士', desc: '命中稳定，输出波动较小。',
      base: { hp: 1.042, atk: 1.206, def: .965, spd: 1.119 },
      acc: 122, eva: 100, crit: .11, critDmg: 1.55, pen: .06, lifesteal: .02, hpRegen: .001, volatility: .06 },
    { id: 'link', name: '林克', source: '《塞尔达传说》', profile: 'sustain', rarity: 3, role: '勇者', desc: '攻守均衡，续航稳定。',
      base: { hp: 1.235, atk: 1.129, def: 1.119, spd: .926 },
      acc: 109, eva: 96, crit: .08, critDmg: 1.5, pen: .03, lifesteal: .04, hpRegen: .003, volatility: .09 },

    /* ---------- A · expansion ---------- */
    { id: 'iron_man', name: '钢铁侠', source: 'Marvel', profile: 'tank', rarity: 4, role: '装甲', desc: '高防高血，稳定承受正面伤害。',
      base: { hp: 1.401, atk: 1.168, def: 1.299, spd: .893 },
      acc: 106, eva: 86, crit: .05, critDmg: 1.42, pen: .01, lifesteal: 0, hpRegen: .003, volatility: .06 },
    { id: 'wonder_woman', name: '神奇女侠', source: 'DC', profile: 'bruiser', rarity: 4, role: '战士', desc: '攻守兼备，直接而强硬。',
      base: { hp: 1.218, atk: 1.198, def: 1.076, spd: 1.056 },
      acc: 109, eva: 96, crit: .1, critDmg: 1.55, pen: .05, lifesteal: .04, hpRegen: .001, volatility: .13 },
    { id: 'spider_man', name: '蜘蛛侠', source: 'Marvel', profile: 'speed', rarity: 4, role: '敏捷', desc: '速度与闪避显著领先。',
      base: { hp: 1.015, atk: 1.279, def: .873, spd: 1.503 },
      acc: 117, eva: 111, crit: .16, critDmg: 1.62, pen: .05, lifesteal: .03, hpRegen: 0, volatility: .11 },
    { id: 'batman', name: '蝙蝠侠', source: 'DC', profile: 'assassin', rarity: 4, role: '战术', desc: '高穿透与暴击，依靠精准时机取胜。',
      base: { hp: .954, atk: 1.33, def: .853, spd: 1.32 },
      acc: 114, eva: 107, crit: .18, critDmg: 1.7, pen: .09, lifesteal: .03, hpRegen: 0, volatility: .15 },
    { id: 'master_chief', name: '士官长', source: '《Halo》', profile: 'precision', rarity: 4, role: '射手', desc: '高命中、低波动，战斗非常稳定。',
      base: { hp: 1.096, atk: 1.269, def: 1.015, spd: 1.178 },
      acc: 122, eva: 100, crit: .11, critDmg: 1.55, pen: .06, lifesteal: .02, hpRegen: .001, volatility: .06 },
    { id: 'captain_america', name: '美国队长', source: 'Marvel', profile: 'sustain', rarity: 4, role: '坚韧', desc: '防守与恢复兼顾，适合长线消耗。',
      base: { hp: 1.299, atk: 1.188, def: 1.178, spd: .975 },
      acc: 109, eva: 96, crit: .08, critDmg: 1.5, pen: .03, lifesteal: .04, hpRegen: .003, volatility: .09 },

    /* ---------- A+ · expansion ---------- */
    { id: 'darth_vader', name: '达斯·维达', source: '《星球大战》', profile: 'tank', rarity: 5, role: '重压', desc: '高耐久与压迫感，速度偏慢。',
      base: { hp: 1.332, atk: 1.11, def: 1.235, spd: .849 },
      acc: 106, eva: 86, crit: .05, critDmg: 1.42, pen: .01, lifesteal: 0, hpRegen: .003, volatility: .06 },
    { id: 'monkey_d_luffy', name: '蒙奇·D·路飞', source: '《海贼王》', profile: 'bruiser', rarity: 5, role: '强攻', desc: '高攻击与续航，正面压制力强。',
      base: { hp: 1.158, atk: 1.139, def: 1.023, spd: 1.004 },
      acc: 109, eva: 96, crit: .1, critDmg: 1.55, pen: .05, lifesteal: .04, hpRegen: .001, volatility: .13 },
    { id: 'naruto_uzumaki', name: '漩涡鸣人', source: '《火影忍者》', profile: 'speed', rarity: 5, role: '忍者', desc: '速度和闪避突出，回合节奏快。',
      base: { hp: .965, atk: 1.216, def: .83, spd: 1.428 },
      acc: 117, eva: 111, crit: .16, critDmg: 1.62, pen: .05, lifesteal: .03, hpRegen: 0, volatility: .11 },
    { id: 'sasuke_uchiha', name: '宇智波佐助', source: '《火影忍者》', profile: 'assassin', rarity: 5, role: '雷切', desc: '暴击与穿透突出，偏爆发。',
      base: { hp: .907, atk: 1.264, def: .811, spd: 1.254 },
      acc: 114, eva: 107, crit: .18, critDmg: 1.7, pen: .09, lifesteal: .03, hpRegen: 0, volatility: .15 },
    { id: 'luke_skywalker', name: '卢克·天行者', source: '《星球大战》', profile: 'precision', rarity: 5, role: '绝地', desc: '命中稳定，波动很小。',
      base: { hp: 1.042, atk: 1.206, def: .965, spd: 1.119 },
      acc: 122, eva: 100, crit: .11, critDmg: 1.55, pen: .06, lifesteal: .02, hpRegen: .001, volatility: .06 },
    { id: 'ichigo_kurosaki', name: '黑崎一护', source: '《死神》', profile: 'sustain', rarity: 5, role: '死神', desc: '攻守均衡，吸血与恢复兼具。',
      base: { hp: 1.235, atk: 1.129, def: 1.119, spd: .926 },
      acc: 109, eva: 96, crit: .08, critDmg: 1.5, pen: .03, lifesteal: .04, hpRegen: .003, volatility: .09 },

    /* ---------- S · expansion ---------- */
    { id: 'hashirama_senju', name: '千手柱间', source: '《火影忍者》', profile: 'tank', rarity: 6, role: '木遁', desc: '高生命、高防守，强调稳定生存。',
      base: { hp: 1.412, atk: 1.177, def: 1.31, spd: .901 },
      acc: 106, eva: 86, crit: .05, critDmg: 1.42, pen: .01, lifesteal: 0, hpRegen: .003, volatility: .06 },
    { id: 'ryomen_sukuna', name: '两面宿傩', source: '《咒术回战》', profile: 'bruiser', rarity: 6, role: '咒王', desc: '攻击性强，兼具一定续航。',
      base: { hp: 1.228, atk: 1.208, def: 1.085, spd: 1.064 },
      acc: 109, eva: 96, crit: .1, critDmg: 1.55, pen: .05, lifesteal: .04, hpRegen: .001, volatility: .13 },
    { id: 'cloud_strife', name: '克劳德·斯特莱夫', source: '《Final Fantasy VII》', profile: 'speed', rarity: 6, role: '剑士', desc: '速度较高，攻防转换迅速。',
      base: { hp: 1.023, atk: 1.289, def: .88, spd: 1.515 },
      acc: 117, eva: 111, crit: .16, critDmg: 1.62, pen: .05, lifesteal: .03, hpRegen: 0, volatility: .11 },
    { id: 'sephiroth', name: '萨菲罗斯', source: '《Final Fantasy VII》', profile: 'assassin', rarity: 6, role: '天使', desc: '高暴击、高穿透，偏致命爆发。',
      base: { hp: .962, atk: 1.341, def: .86, spd: 1.33 },
      acc: 114, eva: 107, crit: .18, critDmg: 1.7, pen: .09, lifesteal: .03, hpRegen: 0, volatility: .15 },
    { id: 'satoru_gojo', name: '五条悟', source: '《咒术回战》', profile: 'precision', rarity: 6, role: '无下限', desc: '极高命中与稳定输出，波动低。',
      base: { hp: 1.105, atk: 1.279, def: 1.023, spd: 1.187 },
      acc: 122, eva: 100, crit: .11, critDmg: 1.55, pen: .06, lifesteal: .02, hpRegen: .001, volatility: .06 },
    { id: 'madara_uchiha', name: '宇智波斑', source: '《火影忍者》', profile: 'sustain', rarity: 6, role: '轮回', desc: '恢复与吸血兼顾，长战强势。',
      base: { hp: 1.31, atk: 1.197, def: 1.187, spd: .982 },
      acc: 109, eva: 96, crit: .08, critDmg: 1.5, pen: .03, lifesteal: .04, hpRegen: .003, volatility: .09 },

    /* ---------- SS · expansion ---------- */
    { id: 'doom_slayer', name: '毁灭战士', source: '《DOOM》', profile: 'tank', rarity: 7, role: '重装', desc: '高耐久高防守，正面战极稳。',
      base: { hp: 1.401, atk: 1.168, def: 1.3, spd: .894 },
      acc: 106, eva: 86, crit: .05, critDmg: 1.42, pen: .01, lifesteal: 0, hpRegen: .003, volatility: .06 },
    { id: 'kratos', name: '奎托斯', source: '《God of War》', profile: 'bruiser', rarity: 7, role: '战神', desc: '高攻击与吸血，持续压制。',
      base: { hp: 1.219, atk: 1.198, def: 1.076, spd: 1.056 },
      acc: 109, eva: 96, crit: .1, critDmg: 1.55, pen: .05, lifesteal: .04, hpRegen: .001, volatility: .13 },
    { id: 'bayonetta', name: '贝优妮塔', source: '《Bayonetta》', profile: 'speed', rarity: 7, role: '魔女', desc: '速度和闪避突出，先手能力强。',
      base: { hp: 1.015, atk: 1.28, def: .873, spd: 1.503 },
      acc: 117, eva: 111, crit: .16, critDmg: 1.62, pen: .05, lifesteal: .03, hpRegen: 0, volatility: .11 },
    { id: 'vergil', name: '维吉尔', source: '《Devil May Cry》', profile: 'assassin', rarity: 7, role: '次元斩', desc: '高暴击、高穿透，追求快速击杀。',
      base: { hp: .955, atk: 1.33, def: .853, spd: 1.32 },
      acc: 114, eva: 107, crit: .18, critDmg: 1.7, pen: .09, lifesteal: .03, hpRegen: 0, volatility: .15 },
    { id: 'samus_aran', name: '萨姆斯·阿兰', source: '《Metroid》', profile: 'precision', rarity: 7, role: '猎人', desc: '命中精准，伤害波动很低。',
      base: { hp: 1.097, atk: 1.269, def: 1.015, spd: 1.178 },
      acc: 122, eva: 100, crit: .11, critDmg: 1.55, pen: .06, lifesteal: .02, hpRegen: .001, volatility: .06 },
    { id: 'dante', name: '但丁', source: '《Devil May Cry》', profile: 'sustain', rarity: 7, role: '恶魔猎人', desc: '兼顾吸血、恢复与稳定输出。',
      base: { hp: 1.3, atk: 1.188, def: 1.178, spd: .975 },
      acc: 109, eva: 96, crit: .08, critDmg: 1.5, pen: .03, lifesteal: .04, hpRegen: .003, volatility: .09 },

    /* ---------- SSS · expansion ---------- */
    { id: 'ra', name: '拉', source: '埃及神话', profile: 'tank', rarity: 8, role: '太阳神', desc: '高耐久高防守，偏稳定压制。',
      base: { hp: 1.408, atk: 1.173, def: 1.306, spd: .898 },
      acc: 106, eva: 86, crit: .05, critDmg: 1.42, pen: .01, lifesteal: 0, hpRegen: .003, volatility: .06 },
    { id: 'thor_myth', name: '索尔', source: '北欧神话', profile: 'bruiser', rarity: 8, role: '雷神', desc: '正面攻击强，续航也较稳定。',
      base: { hp: 1.224, atk: 1.204, def: 1.081, spd: 1.061 },
      acc: 109, eva: 96, crit: .1, critDmg: 1.55, pen: .05, lifesteal: .04, hpRegen: .001, volatility: .13 },
    { id: 'anubis', name: '阿努比斯', source: '埃及神话', profile: 'speed', rarity: 8, role: '冥界', desc: '高速高闪避，依靠节奏压制。',
      base: { hp: 1.02, atk: 1.285, def: .877, spd: 1.51 },
      acc: 117, eva: 111, crit: .16, critDmg: 1.62, pen: .05, lifesteal: .03, hpRegen: 0, volatility: .11 },
    { id: 'zeus', name: '宙斯', source: '希腊神话', profile: 'assassin', rarity: 8, role: '雷霆', desc: '高暴击与穿透，爆发性强。',
      base: { hp: .959, atk: 1.336, def: .857, spd: 1.326 },
      acc: 114, eva: 107, crit: .18, critDmg: 1.7, pen: .09, lifesteal: .03, hpRegen: 0, volatility: .15 },
    { id: 'odin', name: '奥丁', source: '北欧神话', profile: 'precision', rarity: 8, role: '全知', desc: '高命中低波动，稳定输出。',
      base: { hp: 1.102, atk: 1.275, def: 1.02, spd: 1.183 },
      acc: 122, eva: 100, crit: .11, critDmg: 1.55, pen: .06, lifesteal: .02, hpRegen: .001, volatility: .06 },
    { id: 'hades', name: '哈迪斯', source: '希腊神话', profile: 'sustain', rarity: 8, role: '冥王', desc: '防守、吸血与恢复较均衡。',
      base: { hp: 1.306, atk: 1.194, def: 1.183, spd: .979 },
      acc: 109, eva: 96, crit: .08, critDmg: 1.5, pen: .03, lifesteal: .04, hpRegen: .003, volatility: .09 },

    /* ---------- SSS Collector · expansion ---------- */
    { id: 'tiamat', name: '提亚马特', source: '美索不达米亚神话', profile: 'tank', rarity: 9, role: '龙母', desc: '高血高防，强调整体耐久。',
      base: { hp: 1.423, atk: 1.186, def: 1.32, spd: .908 },
      acc: 106, eva: 86, crit: .05, critDmg: 1.42, pen: .01, lifesteal: 0, hpRegen: .003, volatility: .06 },
    { id: 'sun_wukong_myth', name: '孙悟空', source: '中国神话', profile: 'bruiser', rarity: 9, role: '大圣', desc: '攻击与续航兼顾，正面能力强。',
      base: { hp: 1.238, atk: 1.217, def: 1.093, spd: 1.073 },
      acc: 109, eva: 96, crit: .1, critDmg: 1.55, pen: .05, lifesteal: .04, hpRegen: .001, volatility: .13 },
    { id: 'nezha', name: '哪吒', source: '中国神话', profile: 'speed', rarity: 9, role: '三太子', desc: '速度、闪避和先手突出。',
      base: { hp: 1.031, atk: 1.3, def: .887, spd: 1.527 },
      acc: 117, eva: 111, crit: .16, critDmg: 1.62, pen: .05, lifesteal: .03, hpRegen: 0, volatility: .11 },
    { id: 'erlang_shen', name: '二郎神', source: '中国神话', profile: 'assassin', rarity: 9, role: '天眼', desc: '高暴击与穿透，爆发明确。',
      base: { hp: .97, atk: 1.351, def: .866, spd: 1.341 },
      acc: 114, eva: 107, crit: .18, critDmg: 1.7, pen: .09, lifesteal: .03, hpRegen: 0, volatility: .15 },
    { id: 'gilgamesh', name: '吉尔伽美什', source: '《吉尔伽美什史诗》', profile: 'precision', rarity: 9, role: '王者', desc: '命中稳定，输出波动低。',
      base: { hp: 1.114, atk: 1.289, def: 1.031, spd: 1.196 },
      acc: 122, eva: 100, crit: .11, critDmg: 1.55, pen: .06, lifesteal: .02, hpRegen: .001, volatility: .06 },
    { id: 'nuwa', name: '女娲', source: '中国神话', profile: 'sustain', rarity: 9, role: '创生', desc: '恢复与持久战能力突出。',
      base: { hp: 1.32, atk: 1.207, def: 1.196, spd: .99 },
      acc: 109, eva: 96, crit: .08, critDmg: 1.5, pen: .03, lifesteal: .04, hpRegen: .003, volatility: .09 },

    /* ---------- XS · expansion ---------- */
    { id: 'superman', name: '超人', source: 'DC', profile: 'tank', rarity: 10, role: '钢铁之躯', desc: '高耐久与防守，整体稳定。',
      base: { hp: 1.463, atk: 1.219, def: 1.357, spd: .933 },
      acc: 106, eva: 86, crit: .05, critDmg: 1.42, pen: .01, lifesteal: 0, hpRegen: .003, volatility: .06 },
    { id: 'saitama', name: '埼玉', source: '《一拳超人》', profile: 'bruiser', rarity: 10, role: '强攻', desc: '攻击性极强，数值轮廓直接。',
      base: { hp: 1.272, atk: 1.251, def: 1.124, spd: 1.102 },
      acc: 109, eva: 96, crit: .1, critDmg: 1.55, pen: .05, lifesteal: .04, hpRegen: .001, volatility: .13 },
    { id: 'son_goku', name: '孙悟空（卡卡罗特）', source: '《龙珠》', profile: 'speed', rarity: 10, role: '赛亚人', desc: '速度和先手突出，同时保持高输出。',
      base: { hp: 1.06, atk: 1.336, def: .912, spd: 1.569 },
      acc: 117, eva: 111, crit: .16, critDmg: 1.62, pen: .05, lifesteal: .03, hpRegen: 0, volatility: .11 },
    { id: 'vegeta', name: '贝吉塔', source: '《龙珠》', profile: 'assassin', rarity: 10, role: '王子', desc: '高暴击与穿透，偏爆发。',
      base: { hp: .996, atk: 1.389, def: .89, spd: 1.378 },
      acc: 114, eva: 107, crit: .18, critDmg: 1.7, pen: .09, lifesteal: .03, hpRegen: 0, volatility: .15 },
    { id: 'arceus', name: '阿尔宙斯', source: '《宝可梦》', profile: 'precision', rarity: 10, role: '创世', desc: '命中高、波动低，输出稳定。',
      base: { hp: 1.145, atk: 1.325, def: 1.06, spd: 1.23 },
      acc: 122, eva: 100, crit: .11, critDmg: 1.55, pen: .06, lifesteal: .02, hpRegen: .001, volatility: .06 },
    { id: 'sailor_moon', name: '水手月亮', source: '《美少女战士》', profile: 'sustain', rarity: 10, role: '月光', desc: '恢复与续航较强，适合长战。',
      base: { hp: 1.357, atk: 1.24, def: 1.23, spd: 1.018 },
      acc: 109, eva: 96, crit: .08, critDmg: 1.5, pen: .03, lifesteal: .04, hpRegen: .003, volatility: .09 },

    /* ---------- XS Collector · expansion ---------- */
    { id: 'darkseid', name: '达克赛德', source: 'DC', profile: 'tank', rarity: 11, role: '统御', desc: '高生命高防守，稳定压制。',
      base: { hp: 1.42, atk: 1.183, def: 1.317, spd: .906 },
      acc: 106, eva: 86, crit: .05, critDmg: 1.42, pen: .01, lifesteal: 0, hpRegen: .003, volatility: .06 },
    { id: 'anti_spiral', name: 'Anti-Spiral', source: '《天元突破》', profile: 'bruiser', rarity: 11, role: '反螺旋', desc: '攻击与持续输出兼备。',
      base: { hp: 1.235, atk: 1.214, def: 1.091, spd: 1.07 },
      acc: 109, eva: 96, crit: .1, critDmg: 1.55, pen: .05, lifesteal: .04, hpRegen: .001, volatility: .13 },
    { id: 'zeno_dragonball', name: '全王', source: '《龙珠》', profile: 'speed', rarity: 11, role: '至高', desc: '速度与先手极强，整体非常灵活。',
      base: { hp: 1.029, atk: 1.297, def: .885, spd: 1.523 },
      acc: 117, eva: 111, crit: .16, critDmg: 1.62, pen: .05, lifesteal: .03, hpRegen: 0, volatility: .11 },
    { id: 'azathoth', name: '阿撒托斯', source: '克苏鲁神话', profile: 'assassin', rarity: 11, role: '混沌', desc: '高暴击、高穿透、高波动。',
      base: { hp: .967, atk: 1.348, def: .864, spd: 1.338 },
      acc: 114, eva: 107, crit: .18, critDmg: 1.7, pen: .09, lifesteal: .03, hpRegen: 0, volatility: .15 },
    { id: 'doctor_manhattan', name: '曼哈顿博士', source: '《守望者》', profile: 'precision', rarity: 11, role: '量子', desc: '极高命中与低波动，数值稳定。',
      base: { hp: 1.111, atk: 1.286, def: 1.029, spd: 1.194 },
      acc: 122, eva: 100, crit: .11, critDmg: 1.55, pen: .06, lifesteal: .02, hpRegen: .001, volatility: .06 },
    { id: 'madoka_kaname', name: '鹿目圆', source: '《魔法少女小圆》', profile: 'sustain', rarity: 11, role: '圆环', desc: '恢复与续航突出，持久战强。',
      base: { hp: 1.317, atk: 1.204, def: 1.194, spd: .988 },
      acc: 109, eva: 96, crit: .08, critDmg: 1.5, pen: .03, lifesteal: .04, hpRegen: .003, volatility: .09 }

  ];

  const LEGACY_CARD_IDS = Object.freeze([
    'iron_guard',
    'axe_brute',
    'berserker',
    'scout',
    'stone_giant',
    'wind_ranger',
    'corruptor',
    'shadow_assassin',
    'light_priest',
    'heavy_knight',
    'frost_mage',
    'flame_mage',
    'shadow_lord',
    'dragon_knight',
    'lava_lord',
    'storm_valkyrie',
    'time_traveler',
    'thunder_god',
    'starfall_warden',
    'solstice_blade',
    'void_devourer',
    'primordial_dragon',
    'avatar_of_the_end',
    'origin_star'
  ]);
  const legacyIdSet = new Set(LEGACY_CARD_IDS);
  const LEGACY_CARDS = Object.freeze(CARDS.filter(c => legacyIdSet.has(c.id)));

  const API = { RARITY_LIST, RARITY_COLOR, CARDS, LEGACY_CARD_IDS, LEGACY_CARDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NCB = Object.assign(global.NCB || {}, API);
})(typeof window !== 'undefined' ? window : globalThis);
