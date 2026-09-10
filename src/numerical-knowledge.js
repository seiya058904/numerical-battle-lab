// Numerical Knowledge System — canonical, machine-readable knowledge registry.
//
// One Parameter, One Definition (§1). This module is a SINGLE canonical source
// that enriches the live component registries (PARAMETER_CATALOG / EFFECT /
// CONDITION / TARGET / EVENT / MODIFIER_OPERATIONS) with rich human + AI
// semantics, plus the Formula Symbol / Function reference. Everything else
// (game 数值百科, docs/CARD-NUMERICAL-REFERENCE.md, coverage audits) is derived
// from it. It never duplicates a second parallel catalog: it reads the existing
// registries and augments them in place (falling back to defaults when an entry
// already exists, so plugins keep working).
//
// Rules enforced by consumers (tests/audits):
//   - every field used by Generator v4 / the 60 presets / the engine must have
//     an entry (coverage audit FAILs otherwise)
//   - every entry must carry higherEffect/lowerEffect/direction/summary
//     (no hollow "疲劳率。" descriptions)
//   - the generated reference is stamped GENERATED FROM CANONICAL ...
(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};

  // ---------- helpers ----------
  const KNOWN_PARAM_DETAILS={}; // id -> {summary,higherEffect,lowerEffect,direction,battleEffect,interactions,aiMeaning,battlePowerMeaning,examples,tuningGuidance,userIntentExamples,readBy,writtenBy,affects,doesNotAffect,introducedIn,generatorSupport,engineSupport}

  function def(id,d){
    KNOWN_PARAM_DETAILS[id]={direction:'contextual',introducedIn:4,generatorSupport:true,engineSupport:true,...d};
  }

  // ---------- v4 individual variables (§7) + Battle Wear (§8) ----------
  def('MAX_HP',{
    nameZh:'最大生命',summary:'决定实体可承受的总生命伤害；也是大量治疗、护盾、自伤公式的比例基准。',
    higherEffect:'更肉：能承受更多伤害，放大基于 MAX_HP 的治疗/护盾/自伤。',
    lowerEffect:'更脆：更快被击倒，基于 MAX_HP 的比例效果更弱。',
    direction:'positive',battleEffect:'进入伤害 HP 结算、治疗上限、护盾/护符公式、Battle Wear 最大生命衰减的基准。',
    interactions:['DEF','RES','HEAL_POWER','shield','Battle Wear'],
    aiMeaning:'AI 把生存潜力计入效用；高 HP 支持拖长线。',
    battlePowerMeaning:'BattlePower v2 的 durability feature 主要来自 HP+DEF+RES。',
    examples:['MAX_HP=120：脆皮','MAX_HP=500：坦克'],
    tuningGuidance:'若卡"太脆/太肉"，先调 MAX_HP 与 DEF/RES 的配合，不要直接改全局伤害倍率。',
    userIntentExamples:['更肉','更能扛','血厚'],
    readBy:['engine damage pipeline','formula scope','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['HP pool','heal/shield scaling','wear decay base'],doesNotAffect:['accuracy','crit','speed']});
  def('ATK',{
    nameZh:'攻击强度',summary:'多数直接伤害、DoT、反击等公式可以引用的基础进攻属性。',
    higherEffect:'依赖 ATK 的伤害、反击、部分状态伤害提高。',
    lowerEffect:'这些 Action 的实际威力下降。',
    direction:'positive',battleEffect:'作为公式变量进入伤害/治疗/护盾公式；RAMP 会动态放大它。',
    interactions:['CRIT','CRIT_DMG','PEN','DEF','RES','RAMP_RATE','damage formula'],
    aiMeaning:'AI 以 ATK 为主的期望伤害评估进攻选项。',
    battlePowerMeaning:'BattlePower v2 offense feature 直接读取 ATK。',
    examples:['ATK=50：普通','ATK=300：高攻'],
    tuningGuidance:'若"输出太低"，先检查 ATK 与 Action 系数；若"后期成长不明显"，不要只加 ATK，先查 RAMP。',
    userIntentExamples:['攻击更高','输出更强'],
    readBy:['engine formula scope','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['damage formulas','DoT','reflect'],doesNotAffect:['HP','DEF','SPD']});
  def('DEF',{
    nameZh:'物理防御',summary:'降低使用 DEF 防御轴的伤害（physical / bleed 等）。',
    higherEffect:'对物理轴伤害的有效减伤更高。',
    lowerEffect:'更怕物理伤害。',
    direction:'positive',battleEffect:'进入防御轴：伤害乘 100/(100+DEF(1-PEN))。',
    interactions:['RES','PEN','damageType','DAMAGE_TYPE'],
    aiMeaning:'AI 评估物理攻击对高 DEF 目标的价值更低。',
    battlePowerMeaning:'BattlePower v2 durability 含 DEF×0.6。',
    examples:['DEF=50：标准','DEF=475：超高甲'],
    tuningGuidance:'提高 DEF 对抗物理伤害；PEN 会削弱其收益。',
    userIntentExamples:['更抗物理','防御高'],
    readBy:['engine defense axis','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['physical/bleed damage taken'],doesNotAffect:['elemental damage taken','accuracy']});
  def('RES',{
    nameZh:'法术抗性',summary:'降低使用 RES 防御轴的元素/奥术伤害（arcane/fire/frost/lightning/toxic）。',
    higherEffect:'对元素/奥术伤害的有效减伤更高。',
    lowerEffect:'更怕元素伤害。',
    direction:'positive',battleEffect:'进入 RES 防御轴（物理轴仍看 DEF）。',
    interactions:['DEF','PEN','damageType','RES_PEN'],
    aiMeaning:'AI 评估元素攻击对高 RES 目标的价值更低。',
    battlePowerMeaning:'BattlePower v2 durability 含 RES×0.6。',
    examples:['RES=50：标准','RES=363：元素免疫塔'],
    tuningGuidance:'提高 RES 对抗元素伤害；typePenetration 会削弱其收益。',
    userIntentExamples:['更抗元素','抗性高'],
    readBy:['engine defense axis','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['elemental damage taken'],doesNotAffect:['physical damage taken','accuracy']});
  def('SPD',{
    nameZh:'速度',summary:'同优先级下决定行动先后顺序。',
    higherEffect:'更多先手：同 priority 时排在前面。',
    lowerEffect:'更晚行动，容易被先手压制。',
    direction:'positive',battleEffect:'进入行动排序的 speed 值；同 priority 时按 SPD 排序。',
    interactions:['PRIORITY','ModifyPriority'],
    aiMeaning:'AI 将 SPD 计入节奏；高速卡倾向抢占先手。',
    battlePowerMeaning:'BattlePower v2 tempo feature = SPD/55 + priority 奖励。',
    examples:['SPD=55：标准','SPD=380：极速'],
    tuningGuidance:'提高 SPD 强化先手；PRIORITY 是比 SPD 更强的顺序旋钮。',
    userIntentExamples:['更快','先手'],
    readBy:['engine action ordering','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['action order'],doesNotAffect:['damage','accuracy']});
  def('CRIT',{
    nameZh:'暴击率',summary:'增加可暴击伤害段的暴击概率（%）。',
    higherEffect:'更多暴击，配合 CRIT_DMG 提高期望伤害。',
    lowerEffect:'更少暴击，输出更平。',
    direction:'positive',battleEffect:'与技能 critBonus、ModifyCritChance 叠加后决定暴击随机。',
    interactions:['CRIT_DMG','CRIT_BONUS','CAN_CRIT','ModifyCritChance'],
    aiMeaning:'AI 以 crit 期望倍率评估伤害。',
    battlePowerMeaning:'BattlePower v2 hitEV = accChance × critEV。',
    examples:['CRIT=20：普通','CRIT=50：高暴击'],
    tuningGuidance:'提高 CRIT 增加爆发；CRIT_DMG 决定暴击的实际倍率。',
    userIntentExamples:['更会暴击','高暴击'],
    readBy:['engine crit resolution','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['critical hit chance'],doesNotAffect:['hit chance','damage variance']});
  def('LIFESTEAL',{
    nameZh:'吸血',summary:'按造成的 HP 伤害回复施法者生命（%）。与 Action 自带 drainRatio 是两条独立路径。',
    higherEffect:'打出的伤害回血更多，越打越站。',
    lowerEffect:'回复更少。',
    direction:'positive',battleEffect:'在 applyDamage 后按 hpDamage×LIFESTEAL/100 走统一治疗管线；被护盾完全吸收的伤害不产生吸血。',
    interactions:['drainRatio','HEAL_POWER','HEAL_TAKEN','damage'],
    aiMeaning:'AI 将 LIFESTEAL 视为输出附带续航（offense 的 bonus sustain）。',
    battlePowerMeaning:'BattlePower v2 sustain 含 agg.dmg×lifesteal。',
    examples:['LIFESTEAL=0：无','LIFESTEAL=25：每次伤害回 25%'],
    tuningGuidance:'若"吸血不明显"先确认 Action 是否真的造成 HP 伤害（护盾吸收的不吸血）。',
    userIntentExamples:['吸血','越打越站'],
    readBy:['engine applyDamage lifesteal path','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['post-damage healing'],doesNotAffect:['base damage']});
  def('HEAL_POWER',{
    nameZh:'治疗强度',summary:'放大自身施放的治疗（%）。',
    higherEffect:'自己的治疗更强。',
    lowerEffect:'治疗更弱。',
    direction:'positive',battleEffect:'治疗公式结果 × HEAL_POWER/100，再经目标 HEAL_TAKEN 与 Battle Wear 受疗衰减。',
    interactions:['HEAL_TAKEN','Battle Wear','heal'],
    aiMeaning:'AI 以 HEAL_POWER 放大治疗效用估计。',
    battlePowerMeaning:'BattlePower v2 sustain 读取 healPow。',
    examples:['HEAL_POWER=100：标准','HEAL_POWER=180：强治疗'],
    tuningGuidance:'若"治疗型卡拖得太久"，可下调 HEAL_POWER 或依赖 Battle Wear；不要直接设计新机制。',
    userIntentExamples:['治疗更强','回复更多'],
    readBy:['engine heal pipeline','canonical AI','BattlePower v2'],writtenBy:['Generator v4','Advanced Editor'],affects:['own healing output'],doesNotAffect:['damage','shield']});
  def('HEAL_TAKEN',{
    nameZh:'受疗倍率',summary:'控制自己收到治疗的倍率（%）。',
    higherEffect:'收到更多治疗。',
    lowerEffect:'更难被治疗（可用于重伤/禁疗）。',
    direction:'positive',battleEffect:'治疗结算 × HEAL_TAKEN/100。',
    interactions:['HEAL_POWER','Battle Wear','heal'],
    aiMeaning:'AI 降低对低 HEAL_TAKEN 目标的治疗价值。',
    battlePowerMeaning:'BattlePower v2 sustain 读取 taken。',
    examples:['HEAL_TAKEN=100：标准','HEAL_TAKEN=50：受疗减半'],
    tuningGuidance:'降低 HEAL_TAKEN 让卡更难被奶起来；提高则更吃治疗。',
    userIntentExamples:['更难被治疗','治疗减半'],
    readBy:['engine heal pipeline','canonical AI','BattlePower v2'],writtenBy:['Generator v4','Advanced Editor'],affects:['healing received'],doesNotAffect:['shield','damage']});
  def('PEN',{
    nameZh:'通用穿透',summary:'按比例忽略目标 DEF/RES（%）。',
    higherEffect:'更容易打穿高防目标。',
    lowerEffect:'对高防目标的伤害更低。',
    direction:'positive',battleEffect:'在防御轴阶段扣减有效防御：(1-PEN)。',
    interactions:['DEF','RES','PENETRATION_BONUS','TYPE_PENETRATION'],
    aiMeaning:'AI 提高对高防目标的攻击价值估计。',
    battlePowerMeaning:'BattlePower v2 mitigation 使用 (1-pen)。',
    examples:['PEN=0：无穿透','PEN=50：忽略一半防御'],
    tuningGuidance:'提高 PEN 打穿坦克；typePenetration 额外穿透类型抗性。',
    userIntentExamples:['穿透','无视防御'],
    readBy:['engine penetration','canonical AI','BattlePower v2'],writtenBy:['Generator v4','Advanced Editor'],affects:['effective defense'],doesNotAffect:['type resistance']});
  def('ACC',{
    nameZh:'命中',summary:'提高技能命中概率。',
    higherEffect:'更少未命中，尤其对高闪避目标。',
    lowerEffect:'更容易 miss。',
    direction:'positive',battleEffect:'进入命中公式：ACC 对 EVA；canMiss=false 的段强制 100%。',
    interactions:['EVA','CAN_MISS','ModifyAccuracy'],
    aiMeaning:'AI 将命中率计入期望伤害。',
    battlePowerMeaning:'BattlePower v2 hitEV 含 accChance。',
    examples:['ACC=100：标准','ACC=140：高命中'],
    tuningGuidance:'提高 ACC 对抗闪避卡；对必中技能无效。',
    userIntentExamples:['更准','必中'],
    readBy:['engine accuracy resolution','canonical AI','BattlePower v2'],writtenBy:['Generator v4','Advanced Editor'],affects:['hit chance'],doesNotAffect:['crit','damage']});
  def('EVA',{
    nameZh:'闪避',summary:'降低敌方可闪避技能的命中率。',
    higherEffect:'更少被打中（闪避流）。',
    lowerEffect:'更容易被命中。',
    direction:'positive',battleEffect:'作为命中公式的防守输入；canMiss=false 时无效。',
    interactions:['ACC','CAN_MISS'],
    aiMeaning:'AI 降低对高闪避目标的攻击价值。',
    battlePowerMeaning:'BattlePower v2 hitEV 含 eva。',
    examples:['EVA=5：标准','EVA=45：高闪避'],
    tuningGuidance:'提高 EVA 强化回避；面对必中技能无效。',
    userIntentExamples:['更会闪','闪避高'],
    readBy:['engine accuracy resolution','canonical AI','BattlePower v2'],writtenBy:['Generator v4','Advanced Editor'],affects:['enemy hit chance'],doesNotAffect:['damage','crit']});
  def('CRIT_DMG',{
    nameZh:'暴击倍率',summary:'决定暴击时伤害倍率（%）。',
    higherEffect:'暴击更痛。',
    lowerEffect:'暴击收益更低。',
    direction:'positive',battleEffect:'暴击触发后将伤害结果 × CRIT_DMG/100。',
    interactions:['CRIT','CRIT_BONUS'],
    aiMeaning:'AI 用 CRIT_DMG 计算暴击期望。',
    battlePowerMeaning:'BattlePower v2 critEV = 1+CRIT/100×(CRIT_DMG/100-1)。',
    examples:['CRIT_DMG=150：标准','CRIT_DMG=200：暴击双倍'],
    tuningGuidance:'提高 CRIT_DMG 强化暴击爆发；需要配合 CRIT 才有收益。',
    userIntentExamples:['暴击更痛'],
    readBy:['engine crit resolution','canonical AI','BattlePower v2'],writtenBy:['Generator v4','Advanced Editor'],affects:['critical damage'],doesNotAffect:['crit chance']});
  def('ENERGY_REGEN',{
    nameZh:'能量回复',summary:'每回合恢复标准能量。',
    higherEffect:'技能循环更快、更稳定。',
    lowerEffect:'技能更缺资源。',
    direction:'positive',battleEffect:'回合开始增加 ENERGY。',
    interactions:['ENERGY_MAX','resourceRegens','RESOURCE_GAIN_MOD'],
    aiMeaning:'AI 以资源再生评估技能可用频率。',
    battlePowerMeaning:'BattlePower v2 economy feature 读取 regen。',
    examples:['ENERGY_REGEN=2：标准','ENERGY_REGEN=5：快速循环'],
    tuningGuidance:'若"资源循环从不形成有效结果"，先检查是否有消费者，再调回复。',
    userIntentExamples:['资源循环更快','不缺能量'],
    readBy:['engine resource regen','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['resource income'],doesNotAffect:['damage']});

  def('RES_PEN',{
    nameZh:'法术穿透',summary:'Stat-only V7 的魔法伤害穿透：按比例忽略目标的 RES。',
    higherEffect:'魔法伤害部分的有效 RES 更低。',lowerEffect:'更依赖物理穿透 PEN。',direction:'positive',
    battleEffect:'Stat-only V7 战斗中魔法伤害部分的有效防御 = RES×(1 - RES_PEN/100)，上限 80%。',
    interactions:['PEN','RES','DEF'],aiMeaning:'无（stat-only V7 无技能 AI）。',battlePowerMeaning:'GeneralStrength 通过 mitigation 项计入其输出贡献。',
    examples:['RES_PEN=0：无穿透','RES_PEN=50：忽略一半 RES'],tuningGuidance:'与 PEN 构成物理/魔法双穿透；不要同时堆满两者以免溢出伤害。',
    userIntentExamples:['打高 RES 目标更强'],readBy:['Stat-only V7 battle'],writtenBy:['Generator V7'],affects:['effective RES'],doesNotAffect:['DEF','physical damage'],introducedIn:7});

  def('HP_REGEN',{
    nameZh:'每回合回复',summary:'Stat-only V7 的被动生存：每回合回复 MAX_HP 的百分比。',
    higherEffect:'长局中存活能力显著上升。',lowerEffect:'更依赖吸血或其他回复。',direction:'positive',
    battleEffect:'回合开始按 MAX_HP×HP_REGEN/100×(HEAL_POWER/100)×(HEAL_TAKEN/100) 回复，上限为 MAX_HP。',
    interactions:['MAX_HP','HEAL_POWER','HEAL_TAKEN','LIFESTEAL'],aiMeaning:'无（stat-only V7 无技能 AI）。',battlePowerMeaning:'GeneralStrength 的 sustain 项计入其长期生存贡献。',
    examples:['HP_REGEN=0：无回复','HP_REGEN=5：每回合回 5% MAX_HP'],tuningGuidance:'与 LIFESTEAL 共用 HEAL_POWER/HEAL_TAKEN 调节；过高会让对局永不结束，受 MAX_HP 与回合上限约束。',
    userIntentExamples:['每回合回血','被动续航'],readBy:['Stat-only V7 battle'],writtenBy:['Generator V7'],affects:['HP per round'],doesNotAffect:['damage'],introducedIn:7});

  def('TOUGHNESS',{
    nameZh:'坚韧',summary:'Stat-only V7 的固定伤害减免，独立于 DEF/RES。',
    higherEffect:'受到的最终伤害明显降低。',lowerEffect:'几乎没有额外减伤。',direction:'positive',
    battleEffect:'对最终伤害乘以 (1 - TOUGHNESS/100)，有界 0–30%。',
    interactions:['DEF','RES','MAX_HP'],aiMeaning:'无（stat-only V7 无技能 AI）。',battlePowerMeaning:'GeneralStrength 的 mitigation 项计入其减伤贡献。',
    examples:['TOUGHNESS=0：无减伤','TOUGHNESS=20：最终伤害 ×0.8'],tuningGuidance:'有 30% 上界防止 God Stat；与 DEF/RES 乘算时收益递减。',
    userIntentExamples:['更抗打'],readBy:['Stat-only V7 battle'],writtenBy:['Generator V7'],affects:['final damage'],doesNotAffect:['crit chance','hit chance'],introducedIn:7});

  def('CRIT_RES',{
    nameZh:'暴击抵抗',summary:'Stat-only V7 中降低受到的暴击额外伤害。',
    higherEffect:'面对暴击流的有效承伤更高。',lowerEffect:'暴击威胁更大。',direction:'positive',
    battleEffect:'敌方暴击时的额外倍率乘以 (1 - CRIT_RES/100)，有界 0–50%。',
    interactions:['CRIT','CRIT_DMG','EVA'],aiMeaning:'无（stat-only V7 无技能 AI）。',battlePowerMeaning:'GeneralStrength 的 critEV 项按目标视角计入减伤。',
    examples:['CRIT_RES=0：无抵抗','CRIT_RES=50：暴击加成减半'],tuningGuidance:'只削减暴击部分，不保护普通命中，克制暴击构筑。',
    userIntentExamples:['不怕暴击'],readBy:['Stat-only V7 battle'],writtenBy:['Generator V7'],affects:['crit damage taken'],doesNotAffect:['non-crit damage'],introducedIn:7});

  def('POTENCY',{
    nameZh:'效能',summary:'V7 的非直接数值输出轴，放大周期、触发与引爆伤害，不放大普通直接攻击。',
    higherEffect:'DoT、状态周期伤害与触发伤害更强，但高值收益逐渐饱和。',lowerEffect:'非直接输出更弱。',direction:'positive',
    battleEffect:'以 100 为中性值，通过有界响应曲线进入 kind=trigger/status 或带 dot/periodic/trigger/detonation 标签的伤害。',
    interactions:['ATK','periodic','trigger','damage formula'],aiMeaning:'AI 在周期与触发效用估计中使用同一 POTENCY 响应。',battlePowerMeaning:'BattlePower V4 从内容特征估计其长期非直接输出。',
    examples:['POTENCY=100：中性','POTENCY=150：强化非直接效果'],tuningGuidance:'只在卡确有周期/触发消费者时提高；不要把普通直伤标成 periodic 来绕过 ATK。',
    userIntentExamples:['强化 DoT','强化触发伤害'],readBy:['engine computeDamage','canonical AI','Strength Model V7'],writtenBy:['Generator V7','Advanced Editor'],affects:['periodic damage','trigger damage','detonation'],doesNotAffect:['ordinary direct damage'],introducedIn:7});
  def('CONTROL_POWER',{
    nameZh:'控制强度',summary:'V7 敌对控制/弱化的进攻轴，与目标 TENACITY 在 logit 概率空间对抗。',
    higherEffect:'敌对非 DoT 状态更易成功，持续时间最多提高到 1.50 倍。',lowerEffect:'控制更易被抵抗，持续时间最低约 0.60 倍。',direction:'positive',
    battleEffect:'logit(finalChance)=logit(baseChance)+K×contest；双方有效值相等时 finalChance 精确等于 baseChance。',interactions:['TENACITY','STATUS_CHANCE','STATUS_DURATION'],
    aiMeaning:'AI 使用经对抗修正的 chance 与 bounded duration 估计控制价值。',battlePowerMeaning:'BattlePower V4 读取内容中的控制频率、成功率与该属性。',
    examples:['CONTROL_POWER=100 vs TENACITY=100：保持基础概率'],tuningGuidance:'通过 CONTROL_POWER/TENACITY 配对调节，不要直接添加必中控制。',
    userIntentExamples:['控制更稳','更容易沉默'],readBy:['status effect resolver','canonical AI','Strength Model V7'],writtenBy:['Generator V7','Advanced Editor'],affects:['hostile non-DoT status chance','bounded status duration'],doesNotAffect:['DoT chance','friendly buffs'],introducedIn:7});
  def('TENACITY',{
    nameZh:'韧性',summary:'V7 控制抗性轴，抵抗敌方 CONTROL_POWER。',higherEffect:'敌方控制与弱化更难命中且持续更短。',lowerEffect:'更容易受到控制。',direction:'positive',
    battleEffect:'作为 control contest 的防守输入；对友方增益和 DoT 状态不生效。',interactions:['CONTROL_POWER','STATUS_CHANCE','STATUS_DURATION'],
    aiMeaning:'AI 评估对高 TENACITY 目标施加控制的期望收益更低。',battlePowerMeaning:'BattlePower V4 将其作为长期控制抗性内容特征。',
    examples:['TENACITY=100：中性'],tuningGuidance:'控制抗性过强时先检查 contest 曲线和 1.50/0.60 duration bound。',userIntentExamples:['更抗控制'],
    readBy:['status effect resolver','canonical AI','Strength Model V7'],writtenBy:['Generator V7','Advanced Editor'],affects:['enemy control chance','enemy control duration'],doesNotAffect:['damage mitigation','DoT'],introducedIn:7});
  def('RECOVERY',{
    nameZh:'恢复速度',summary:'V7 冷却准备轴；影响技能何时再次可用，但不增加每回合行动次数。',higherEffect:'较长冷却技能更快再次就绪，高值有界饱和。',lowerEffect:'冷却准备更慢。',direction:'positive',
    battleEffect:'每回合 cooldownProgress += recoveryRate；跨整数部分减少 cooldown，100 的 rate 精确为 1。',interactions:['COOLDOWN','cooldownProgress','ONE Action opportunity'],
    aiMeaning:'AI 以 recoveryRate 调整技能长期使用频率。',battlePowerMeaning:'BattlePower V4 从 cooldown 与 RECOVERY 的交互估计节奏。',
    examples:['RECOVERY=100：legacy 一回合减 1'],tuningGuidance:'不得用 RECOVERY 生成额外行动；只调整 readiness。',userIntentExamples:['冷却更快'],
    readBy:['engine round start','canonical AI','Strength Model V7'],writtenBy:['Generator V7','Advanced Editor'],affects:['cooldown readiness'],doesNotAffect:['actions per round'],introducedIn:7});
  def('BARRIER_POWER',{
    nameZh:'屏障强度',summary:'V7 Shield/Ward/Barrier 的独立输出轴，100 为中性。',higherEffect:'屏障与类型护符数值提高，高值有界饱和。',lowerEffect:'屏障类效果更弱。',direction:'positive',
    battleEffect:'效果公式结果先乘 barrierRate，再进入 ModifyShield/ModifyWard 和容量上限。',interactions:['shield','ward','MAX_HP'],
    aiMeaning:'AI 以相同 barrierRate 估计屏障即时效用。',battlePowerMeaning:'BattlePower V4 从屏障频率、公式与 BARRIER_POWER 估计防护。',
    examples:['BARRIER_POWER=100：公式原值'],tuningGuidance:'用它调屏障专精，避免继续让 MAX_HP 单独 double-dip。',userIntentExamples:['护盾更厚','护符更强'],
    readBy:['shield effect','ward effect','canonical AI','Strength Model V7'],writtenBy:['Generator V7','Advanced Editor'],affects:['shield amount','ward amount'],doesNotAffect:['base HP','healing'],introducedIn:7});

  // ---------- Battle Wear concept (§8) ----------
  def('VOLATILITY',{
    nameZh:'波动性',summary:'控制这张卡牌的伤害与部分随机效果在平均值附近波动的幅度。',
    higherEffect:'同一行动不同回合之间的结果差异越大（例如 0.60–1.55 的宽区间）。',
    lowerEffect:'输出越稳定，更接近期望值（例如 0.95–1.05）。',
    direction:'positive',battleEffect:'参与 damage variance 的实际随机倍率计算：把 (varianceMax-varianceMin)/2 的半宽乘以 VOLATILITY。',
    interactions:['LUCK','CRIT','varianceMin','varianceMax'],
    aiMeaning:'AI 按期望值评估；高波动意味着实际结果不确定性更高，不直接增加平均伤害。',
    battlePowerMeaning:'BattlePower v2 主要按期望值计算，并对极高波动给予有限稳定性折扣（reliability feature）。',
    examples:['VOLATILITY=0.3：非常稳定','VOLATILITY=1.0：正常','VOLATILITY=2.5：高度随机'],
    tuningGuidance:'如果反馈"高波动卡太稳定"，优先提高 VOLATILITY 或加宽 varianceMin/Max；不要先改基础 ATK。',
    userIntentExamples:['让攻击更不稳定','增加赌博感','同一个技能每回合伤害不要一样'],
    readBy:['engine damage variance resolver','canonical AI','BattlePower v2','Behavior Analyzer'],
    writtenBy:['Generator v4','Advanced Editor'],affects:['damage variance'],doesNotAffect:['nominal midpoint','accuracy','crit chance']});
  def('LUCK',{
    nameZh:'幸运',summary:'不是直接加伤害，而是改变随机分布的偏移：更容易抽到区间上半还是下半。',
    higherEffect:'正数时结果偏向区间上半（略高于期望），负数时偏向下半。',
    lowerEffect:'接近 0 时分布对称，等于普通均匀随机。',
    direction:'mixed',battleEffect:'改变均值：E[X] = mid - half + 2*half*u，其中 u=(1+luck)/(2+luck)（正）或 1/(2-luck)（负）。',
    interactions:['VOLATILITY','varianceMin','varianceMax'],
    aiMeaning:'AI 将 LUCK 偏移并入期望值计算（risk-adjusted EV）。',
    battlePowerMeaning:'BattlePower v2 将 LUCK 偏移写入伤害期望（evMid）。',
    examples:['LUCK=0.3：偏向高值','LUCK=-0.3：偏向低值','LUCK=0：对称'],
    tuningGuidance:'提高 LUCK 增加稳定的偏置收益；降低使卡牌更"背运"。与 VOLATILITY 组合可制造高风险高回报或稳定偏置。',
    userIntentExamples:['让输出稳定偏强','制造运气成分','轻微正向修正随机'],
    readBy:['engine damage variance resolver','canonical AI','BattlePower v2'],writtenBy:['Generator v4','Advanced Editor'],affects:['damage distribution mean'],doesNotAffect:['hit chance','crit chance']});
  def('ENDURANCE',{
    nameZh:'耐力',summary:'决定这张卡在长期战斗中的损耗抗性：越高越晚进入疲劳，Battle Wear 影响越小。',
    higherEffect:'明显更晚进入疲劳，能拖更长战线。',
    lowerEffect:'更早疲劳，长时间战斗更快崩溃。',
    direction:'positive',battleEffect:'推迟 wearStart（约 18+ENDURANCE×0.34 回合）、减缓 terminal max-HP decay 的斜率，并提高 wearResist。',
    interactions:['FATIGUE_RATE','FATIGUE_START','Battle Wear','HEAL_TAKEN'],
    aiMeaning:'AI 对高 ENDURANCE 卡给予更高的长期价值估计，对低 ENDURANCE 卡偏向速决。',
    battlePowerMeaning:'BattlePower v2 的 wearResist feature 随 ENDURANCE 上升。',
    examples:['ENDURANCE=24：低耐力（早疲劳）','ENDURANCE=50：标准','ENDURANCE=98：近乎无限耐力'],
    tuningGuidance:'如果"所有卡后期都突然崩溃"，先检查 Battle Wear 与生成分布，不要简单全局改 FATIGUE_RATE；若单卡太能拖，降低该卡 ENDURANCE。',
    userIntentExamples:['更耐久','能拖长战','别那么容易累'],
    readBy:['engine applyBattleWear','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['fatigue onset','terminal pressure speed','wear resistance'],doesNotAffect:['direct damage','hit chance']});
  def('RAMP_START',{
    nameZh:'成长开始回合',summary:'开始进入成长曲线的战斗回合阈值：在此之前没有 RAMP 加成。',
    higherEffect:'成长开始得越晚，前期越弱。',
    lowerEffect:'成长开始得越早，前期就越接近后期强度。',
    direction:'negative',battleEffect:'回合 r 时 RAMP 因子 = 1 + max(0, r - RAMP_START) × RAMP_RATE，之后受 RAMP_CAP 封顶。',
    interactions:['RAMP_RATE','RAMP_CAP','ROUND','BATTLE_TURN'],
    aiMeaning:'AI 读取当前回合已成长的有效属性；没有搜索未来回合，不能保证主动等待成长。',
    battlePowerMeaning:'BattlePower v2 的 outlook 在几个时间点采样 timeFactor，RAMP_START 越早评分越高。',
    examples:['RAMP_START=7：约第 8 回合起成长明显','RAMP_START=999：永不成长'],
    tuningGuidance:'如果"后期卡不够明显"，优先检查 RAMP_START/RAMP_RATE/RAMP_CAP，不要先改基础 ATK 或 rarity budget。',
    userIntentExamples:['提高后期成长','让这张卡越打越强','减少前期强度、增加后期强度'],
    readBy:['engine dynamic stats','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['late-game effective stats'],doesNotAffect:['early-game stats']});
  def('RAMP_RATE',{
    nameZh:'成长速度',summary:'每回合 RAMP 的成长幅度：数值越高后期成长越快。',
    higherEffect:'后期成长速度更快。',
    lowerEffect:'成长更缓慢。',
    direction:'positive',battleEffect:'与 RAMP_START 一起决定第 r 回合的成长因子（见 RAMP_START）。',
    interactions:['RAMP_START','RAMP_CAP','ROUND'],
    aiMeaning:'更高的 RAMP_RATE 提升卡牌后期期望输出/属性。',
    battlePowerMeaning:'BattlePower v2 outlook 随 RAMP_RATE 提升。',
    examples:['RAMP_RATE=0.02：每回合 +2% 成长','RAMP_RATE=0：无成长'],
    tuningGuidance:'提高 RAMP_RATE 加速后期成长；结合 RAMP_CAP 限制上限。',
    userIntentExamples:['后期成长更快','越打越强更明显'],
    readBy:['engine dynamic stats','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['late-game effective stats'],doesNotAffect:['early-game stats']});
  def('RAMP_CAP',{
    nameZh:'成长上限',summary:'RAMP 加成的上限倍率：成长不会超过这个值。',
    higherEffect:'成长峰值更高，后期更强。',
    lowerEffect:'成长峰值更低，后期更接近前期。',
    direction:'positive',battleEffect:'clamp(RAMP 因子, 1, RAMP_CAP)。',
    interactions:['RAMP_START','RAMP_RATE'],
    aiMeaning:'RAMP_CAP 决定后期价值的天花板。',
    battlePowerMeaning:'BattlePower v2 的 timeFactor 用 RAMP_CAP 封顶。',
    examples:['RAMP_CAP=1.4：最多 +40%','RAMP_CAP=1：无成长'],
    tuningGuidance:'抬高 RAMP_CAP 让后期更强；过高的 RAMP_CAP 会让"后期成长"掩盖疲劳。',
    userIntentExamples:['后期更强','成长峰值更高'],
    readBy:['engine dynamic stats','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['late-game effective stats'],doesNotAffect:['early-game stats']});
  def('FATIGUE_START',{
    nameZh:'疲劳开始回合',summary:'开始进入疲劳曲线的战斗回合阈值：在此之前没有 FATIGUE 衰减。',
    higherEffect:'疲劳开始得越晚，能撑越久。',
    lowerEffect:'疲劳开始得越早，长局越弱。',
    direction:'negative',battleEffect:'回合 r 时 FATIGUE 因子 = max(FATIGUE_CAP, 1 - max(0, r - FATIGUE_START) × FATIGUE_RATE)。',
    interactions:['FATIGUE_RATE','FATIGUE_CAP','ENDURANCE','ROUND'],
    aiMeaning:'AI 对早疲劳卡给予较低长期价值，偏向速决。',
    battlePowerMeaning:'BattlePower v2 outlook 随 FATIGUE_START 提前而下降。',
    examples:['FATIGUE_START=10：第 10 回合后开始衰减','FATIGUE_START=999：永不疲劳'],
    tuningGuidance:'若"爆发卡后期仍太强"，可提前 FATIGUE_START 或提高 FATIGUE_RATE；若"所有卡后期都突然崩溃"，先查 Battle Wear 与生成分布。',
    userIntentExamples:['越打越弱','前期强势后期无力'],
    readBy:['engine dynamic stats','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['late-game effective stats'],doesNotAffect:['early-game stats']});
  def('FATIGUE_RATE',{
    nameZh:'疲劳速度',summary:'每回合 FATIGUE 的衰减幅度：数值越高长局衰弱越快。',
    higherEffect:'长局衰弱更快。',
    lowerEffect:'角色更耐久。',
    direction:'positive',battleEffect:'与 FATIGUE_START 一起决定第 r 回合的疲劳因子（见 FATIGUE_START）。',
    interactions:['FATIGUE_START','FATIGUE_CAP','ENDURANCE'],
    aiMeaning:'更高的 FATIGUE_RATE 压低后期期望价值。',
    battlePowerMeaning:'BattlePower v2 outlook 随 FATIGUE_RATE 下降。',
    examples:['FATIGUE_RATE=0.02：每回合 -2%','FATIGUE_RATE=0：不疲劳'],
    tuningGuidance:'若"爆发卡后期仍然太强"可检查 FATIGUE_START/FATIGUE_RATE；若所有卡后期崩溃，不要简单提高 FATIGUE_RATE，先查 Battle Wear。',
    userIntentExamples:['后期变弱','疲劳','打完前期就没力'],
    readBy:['engine dynamic stats','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['late-game effective stats'],doesNotAffect:['early-game stats']});
  def('FATIGUE_CAP',{
    nameZh:'疲劳下限',summary:'FATIGUE 衰减的下限倍率：再疲劳也不会低于这个值。',
    higherEffect:'疲劳后保留更多战力（更耐久）。',
    lowerEffect:'疲劳后战力更低（更容易被终结）。',
    direction:'positive',battleEffect:'clamp(FATIGUE 因子, FATIGUE_CAP, 1)。',
    interactions:['FATIGUE_START','FATIGUE_RATE','Battle Wear'],
    aiMeaning:'FATIGUE_CAP 决定长期战的最低战力平台。',
    battlePowerMeaning:'BattlePower v2 的 timeFactor 用 FATIGUE_CAP 作下限。',
    examples:['FATIGUE_CAP=0.5：最低保留 50%','FATIGUE_CAP=1：不衰减'],
    tuningGuidance:'抬高 FATIGUE_CAP 保留后期战力；过低会让卡在长局彻底无力。',
    userIntentExamples:['疲劳后仍有战力','不要完全崩盘'],
    readBy:['engine dynamic stats','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['late-game effective stats'],doesNotAffect:['early-game stats']});

  // ---------- Battle Wear concept (§8) ----------
  def('BATTLE_WEAR',{
    nameZh:'战斗损耗',category:'长期机制',summary:'战斗时间长期增长产生的自然压力，不是普通 Action，也不是隐藏作弊：它让治疗型卡在超长局中最终也无法无限维持。',
    higherEffect:'—（这是一个系统机制而非可调属性；其强度由 ENDURANCE 与时间共同决定）。',
    lowerEffect:'—',
    direction:'contextual',battleEffect:'随 ROUND 增长：①受疗效率经 wearHealFactor 逐步下降；②约 12 回合后启动不可完全恢复的最大生命衰减（terminal pressure，穿过护盾/护符，属于疲劳而非攻击）。',
    interactions:['ROUND','ENDURANCE','FATIGUE_RATE','HEAL_TAKEN','shield','ward'],
    aiMeaning:'AI 在长局中降低治疗/护盾的效用估计，因为后续会被 Battle Wear 侵蚀。',
    battlePowerMeaning:'BattlePower v2 通过 ENDURANCE→wearResist feature 表达抗损耗能力。',
    examples:['第 5 回合：无影响','第 25 回合：治疗开始下降','第 40+ 回合：最大生命开始衰减'],
    tuningGuidance:'如果"治疗卡拖得太久"，先检查 HEAL_POWER/HEAL_TAKEN/ENDURANCE/FATIGUE/AI heal utility，不要直接设计新的全局伤害机制。',
    userIntentExamples:['为什么治疗卡最后也会死','长局为什么越来越危险'],
    readBy:['engine applyBattleWear','canonical AI','BattlePower v2'],writtenBy:['engine (systemic)'],affects:['healing effectiveness','max HP','late-game pressure'],doesNotAffect:['round 1-10 fights']});

  // ---------- damage types ----------
  const DAMAGE_TYPE_HUMAN={
    physical:'物理：使用 DEF 作为防御轴，对应护符类型 physical。',
    arcane:'奥术：使用 RES 作为防御轴，对应护符类型 arcane。',
    fire:'火焰：使用 RES 作为防御轴，对应护符类型 fire。',
    frost:'冰霜：使用 RES 作为防御轴，对应护符类型 frost。',
    lightning:'雷电：使用 RES 作为防御轴，对应护符类型 lightning。',
    toxic:'剧毒：使用 RES 作为防御轴，对应护符类型 toxic。',
    bleed:'流血：使用 DEF 作为防御轴，对应护符类型 bleed。',
    true:'真实：无视防御轴与类型抗性（true damage）。'
  };
  const KNOWN_DAMAGE_TYPES=Object.freeze(DAMAGE_TYPE_HUMAN);

  // ---------- formula symbols (§20) ----------
  const KNOWN_FORMULA_SYMBOLS={
    ATK:{what:'当前有效攻击（含 modifier band 与 RAMP/FATIGUE 动态值）',context:'施法者',example:'ATK * 1.4'},
    DEF:{what:'当前有效防御',context:'施法者',example:'ATK * 100 / (100 + DEF)'},
    RES:{what:'当前有效抗性',context:'施法者',example:'ATK * 100 / (100 + RES)'},
    SPD:{what:'当前有效速度',context:'施法者',example:'SPD * 0.5'},
    ACC:{what:'命中值（配合 EVA 计算命中率）',context:'施法者',example:'100 + ACC'},
    EVA:{what:'闪避值（作为命中公式的防守输入）',context:'施法者（目标用 TARGET_EVA）',example:'100 / (100 + EVA)'},
    CRIT:{what:'暴击率（%）',context:'施法者',example:'CRIT / 100'},
    CRIT_DMG:{what:'暴击倍率（%）',context:'施法者',example:'CRIT_DMG / 100'},
    PEN:{what:'通用穿透（%）',context:'施法者',example:'PEN / 100'},
    MAX_HP:{what:'最大生命',context:'施法者',example:'MAX_HP * 0.1'},
    HP:{what:'当前生命',context:'施法者',example:'MISSING_HP / MAX_HP'},
    HP_PCT:{what:'当前生命比例 0–1',context:'施法者',example:'HP_PCT < 0.5'},
    MISSING_HP:{what:'已损失生命 = MAX_HP - HP',context:'施法者',example:'MISSING_HP * 0.5'},
    TARGET_HP:{what:'目标当前生命',context:'目标',example:'TARGET_HP'},
    TARGET_MAX_HP:{what:'目标最大生命',context:'目标',example:'TARGET_MAX_HP'},
    TARGET_HP_PCT:{what:'目标当前生命比例 0–1',context:'目标',example:'TARGET_HP_PCT < 0.3'},
    TARGET_DEF:{what:'目标防御',context:'目标',example:'TARGET_DEF'},
    TARGET_RES:{what:'目标抗性',context:'目标',example:'TARGET_RES'},
    STACKS:{what:'当前状态层数',context:'状态',example:'ATK * STACKS'},
    CONSUMED_STACKS:{what:'本次 consumeStatus 消费的层数',context:'状态消费',example:'ATK * CONSUMED_STACKS'},
    EVENT_DAMAGE:{what:'事件中的原始伤害值',context:'事件',example:'EVENT_DAMAGE * 0.5'},
    EVENT_HP_DAMAGE:{what:'事件中的 HP 伤害值',context:'事件',example:'EVENT_HP_DAMAGE'},
    EVENT_SHIELD_DAMAGE:{what:'事件中的护盾伤害值',context:'事件',example:'EVENT_SHIELD_DAMAGE'},
    EVENT_WARD_DAMAGE:{what:'事件中的护符伤害值',context:'事件',example:'EVENT_WARD_DAMAGE'},
    LAST_DAMAGE:{what:'最近一次伤害值',context:'事件/触发',example:'LAST_DAMAGE * 0.2'},
    LAST_HP_DAMAGE:{what:'最近一次 HP 伤害值',context:'事件/触发',example:'LAST_HP_DAMAGE'},
    LAST_SHIELD_DAMAGE:{what:'最近一次护盾伤害值',context:'事件/触发',example:'LAST_SHIELD_DAMAGE'},
    LAST_WARD_DAMAGE:{what:'最近一次护符伤害值',context:'事件/触发',example:'LAST_WARD_DAMAGE'},
    LAST_HIT:{what:'是否最近一次命中（0/1）',context:'事件/触发',example:'LAST_HIT ? ATK : 0'},
    LAST_CRIT:{what:'是否最近一次暴击（0/1）',context:'事件/触发',example:'LAST_CRIT ? ATK * 1.5 : ATK'},
    LAST_KILL:{what:'是否最近一次击杀（0/1）',context:'事件/触发',example:'LAST_KILL ? 1 : 0'},
    REPEAT_INDEX:{what:'repeat 循环的当前下标（0 起）',context:'repeat',example:'REPEAT_INDEX'},
    MODIFIER_VALUE:{what:'modifier 的参数值（在 modifier 公式内可用）',context:'modifier',example:'MODIFIER_VALUE * STACKS'},
    RAGE:{what:'怒气资源当前量',context:'资源',example:'RAGE * 1'},
    ENERGY:{what:'能量资源当前量',context:'资源',example:'ENERGY * 1'},
    SOUL:{what:'魂力资源当前量',context:'资源',example:'SOUL * 1'},
    CHRONO:{what:'时能资源当前量',context:'资源',example:'CHRONO * 1'},
    ROUND:{what:'当前全局回合数（从 1 起）',context:'战斗',example:'ATK * (1 + ROUND * 0.015)'},
    BATTLE_TURN:{what:'当前行动轮次（与 ROUND 同义，可读）',context:'战斗',example:'MAX_HP * max(0.4, 1 - BATTLE_TURN * 0.01)'},
    pi:{what:'圆周率 π',context:'常量',example:'pi'},
    e:{what:'自然常数 e',context:'常量',example:'e'},
    PI:{what:'圆周率 π（大写）',context:'常量',example:'PI'},
    E:{what:'自然常数 e（大写）',context:'常量',example:'E'}
  };
  const KNOWN_FORMULA_FUNCTIONS={
    min:'取最小值：min(a,b,...)',
    max:'取最大值：max(a,b,...)',
    abs:'绝对值：abs(x)',
    floor:'向下取整：floor(x)',
    ceil:'向上取整：ceil(x)',
    round:'四舍五入：round(x, digits=0)',
    sqrt:'平方根：sqrt(x)',
    log:'自然对数：log(x)',
    log2:'以 2 为底对数：log2(x)',
    log10:'以 10 为底对数：log10(x)',
    exp:'指数：exp(x)',
    pow:'幂：pow(x,y)',
    sign:'符号：sign(x)（-1/0/1）',
    clamp:'钳制：clamp(value, min, max)'
  };
  const KNOWN_RUNTIME_STATE={
    'current HP':'战斗实时生命（不是卡牌永久属性）',
    'current resource':'战斗实时资源（ENERGY/RAGE/SOUL/CHRONO 等）',
    'current shield':'战斗实时通用护盾',
    'wear':'战斗实时磨损（_wear 0–1），由 Battle Wear 累积',
    'current cooldown':'技能当前剩余冷却',
    'statuses':'实体当前状态实例（含层数/剩余时间）',
    'energy':'实体当前能量',
    'alive':'实体是否存活'
  };

  // ---------- effect extra knowledge (§13-14) ----------
  const EFFECT_EXTRA={
    damage:{summary:'对目标造成伤害：命中→随机倍率→暴击→复合伤害包→防御/抗性→Ward/Shield/HP→汲取/反噬。',direction:'positive',higherEffect:'伤害更高',lowerEffect:'伤害更低'},
    heal:{summary:'根据公式产生治疗，应用 HEAL_POWER（施法者）与 HEAL_TAKEN（目标），并经 Battle Wear 受疗衰减。',direction:'positive',higherEffect:'回复更多',lowerEffect:'回复更少'},
    shield:{summary:'增加通用伤害吸收层，先于 HP 承受所有类型伤害。',direction:'positive',higherEffect:'吸收更多',lowerEffect:'吸收更少'},
    ward:{summary:'增加指定伤害类型的专用吸收层，在该类型伤害结算时先于通用护盾消耗。',direction:'positive',higherEffect:'吸收更多该类型伤害',lowerEffect:'吸收更少'},
    status:{summary:'按概率/免疫规则施加可叠层状态（DoT/Buff/控制等）。',direction:'positive',higherEffect:'更容易/更强地施加',lowerEffect:'更弱'},
    toggleStatus:{summary:'在存在/不存在之间切换一个状态，用于维持型（Sustain）技能。',direction:'contextual'},
    consumeStatus:{summary:'消费指定状态层数并把数量写入 CONSUMED_STACKS 供后续公式读取（引爆/换资源）。',direction:'contextual',higherEffect:'消耗更多层数',lowerEffect:'更少'},
    cleanse:{summary:'按标签移除负面状态。',direction:'contextual'},
    dispel:{summary:'按类型和标签移除状态，可转移给施法者。',direction:'contextual'},
    resource:{summary:'给目标增加或减少任意资源。',direction:'contextual'},
    gain:{summary:'给施法者增加任意资源（资源生产者）。',direction:'positive'},
    energy:{summary:'兼容旧内容的 ENERGY 资源变化组件。',direction:'contextual'},
    convertResource:{summary:'从一种资源扣除并按比例转化为另一资源（资源循环核心）。',direction:'contextual'},
    cooldownReduce:{summary:'减少目标全部已存在冷却。只在有冷却技能时才真正有价值。',direction:'contextual'},
    selfDamagePct:{summary:'按施法者最大生命造成不可反射的自伤（自残/血法）。',direction:'negative',higherEffect:'自伤更多（更危险）',lowerEffect:'更少'},
    conditional:{summary:'根据通用 Condition 树执行 then 或 else 分支。',direction:'contextual'},
    repeat:{summary:'重复执行子效果块 N 次（多段/连击）；引擎和 canonical AI 均按从 0 起的 REPEAT_INDEX 逐次求值，子效果局部上下文与实际结算保持一致。',direction:'positive'},
    emitEvent:{summary:'发射已注册 Trigger Event，让状态/被动通过统一事件链响应。',direction:'contextual'}
  };
  const KNOWN_CONDITIONS={
    hpPctAbove:'施法者生命比例高于 X',
    hpPctBelow:'施法者生命比例低于 X',
    targetHpPctAbove:'目标生命比例高于 X',
    targetHpPctBelow:'目标生命比例低于 X（典型斩杀/处决门控）',
    hasStatus:'施法者具有某状态',
    missingStatus:'施法者缺少某状态',
    targetHasStatus:'目标具有某状态',
    targetMissingStatus:'目标缺少某状态',
    resourceAtLeast:'施法者某资源 ≥ X',
    targetResourceAtLeast:'目标某资源 ≥ X',
    resourceIs:'施法者某资源等于 X',
    statusStacksAtLeast:'某状态层数 ≥ X',
    targetStatusStacksAtLeast:'目标某状态层数 ≥ X',
    sourceTag:'来源具有某标签',
    targetTag:'目标具有某标签',
    statusTag:'状态具有某标签',
    targetStatusTag:'目标状态具有某标签',
    consumedStacksAtLeast:'本次消费层数 ≥ X',
    lastHit:'上次攻击命中',
    lastCrit:'上次攻击暴击',
    lastKill:'上次攻击击杀',
    dealtDamageAtLeast:'本次造成伤害 ≥ X',
    dealtHpDamageAtLeast:'本次造成 HP 伤害 ≥ X',
    tag:'实体具有某标签',
    damageType:'伤害类型为 X',
    livingAlliesAtMost:'存活友方 ≤ X',
    livingEnemiesAtMost:'存活敌方 ≤ X'
  };
  const KNOWN_EVENTS={
    ModifyStat:'属性修正（Modifier band）',ModifyAccuracy:'命中修正',ModifyHits:'段数修正',ModifyCritChance:'暴击修正',
    ModifyPenetration:'穿透修正',ModifyDamageDealt:'输出倍率',ModifyDamageTaken:'承伤倍率',ModifyHealDealt:'治疗输出倍率',
    ModifyHealTaken:'受疗倍率',ModifyResourceCost:'资源费用修正',ModifyResourceGain:'资源获得修正',ModifyCooldown:'冷却修正',
    ModifyShield:'护盾获得修正',ModifyWard:'护符获得修正',ModifyResistance:'抗性修正',ModifyPriority:'行动优先级修正',
    EntityDefeated:'实体被击败',afterDamageTaken:'受到伤害后',afterDamageDealt:'造成伤害后',afterHealTaken:'受到治疗后',
    afterHealDealt:'造成治疗后',afterDefeated:'被击败后',afterKill:'击杀后',afterStatusApplied:'状态被施加后',
    afterStatusInflicted:'状态被施加给他人后',afterStatusRemoved:'状态被移除后',command:'指令（语义信号，不伪造 afterKill）',
    roundStart:'回合开始',roundEnd:'回合结束'
  };
  const KNOWN_TARGETS={
    self:'自己',
    ally:'单个友方',
    enemy:'单个敌方',
    'all-allies':'全体友方',
    'all-enemies':'全体敌方',
    'random-ally':'随机友方',
    'random-enemy':'随机敌方',
    query:'目标查询（关系+条件+排序+数量+模式）'
  };
  const KNOWN_MOD_OPS={
    set:'设定：把当前值直接设为参数值。',
    add:'加法：在 SET 后增加固定值。',
    addPerStack:'每层加法：每层状态增加固定值。',
    multiply:'乘法：对 SET+ADD 结果乘算。',
    multiplyPerStack:'每层倍率：×(1+value×stacks)。',
    compoundPerStack:'每层复合倍率：×value^stacks。',
    min:'上限：把结果限制为不高于参数值。',
    max:'下限：把结果限制为不低于参数值。'
  };

  // ---------- assemble the canonical registry ----------
  function buildKnowledge(){
    const params={};
    const cat=NCB.PARAMETER_CATALOG||{};
    for(const [id,entry] of Object.entries(cat)){
      const extra=KNOWN_PARAM_DETAILS[id]||{};
      params[id]={id,category:extra.category||entry.category||'plugin',type:entry.kind||'number',unit:entry.unit||'',
        defaultValue:entry.defaultValue,range:entry.range,editable:true,
        nameZh:extra.nameZh||entry.name||id,nameEn:id,
        summary:extra.summary||entry.human||'',higherEffect:extra.higherEffect||'',
        lowerEffect:extra.lowerEffect||'',direction:extra.direction||'contextual',
        battleEffect:extra.battleEffect||entry.effect||'',interactions:extra.interactions||[],
        aiMeaning:extra.aiMeaning||entry.ai||'',battlePowerMeaning:extra.battlePowerMeaning||'',
        examples:extra.examples||[],tuningGuidance:extra.tuningGuidance||'',
        userIntentExamples:extra.userIntentExamples||[],readBy:extra.readBy||[],writtenBy:extra.writtenBy||[],
        affects:extra.affects||[],doesNotAffect:extra.doesNotAffect||[],
        introducedIn:extra.introducedIn,generatorSupport:extra.generatorSupport,engineSupport:extra.engineSupport};
    }
    // ensure the v4 individual vars + battle wear always present even if not in catalog
    for(const id of ['VOLATILITY','LUCK','ENDURANCE','RAMP_START','RAMP_RATE','RAMP_CAP','FATIGUE_START','FATIGUE_RATE','FATIGUE_CAP','BATTLE_WEAR']){
      if(!params[id])params[id]=buildParamFallback(id);
    }
    // dynamic resources: any X (and X_MAX / X_REGEN) used by content resolves to
    // the generic resource knowledge, so the coverage audit stays clean (§9).
    const RESOURCE_GENERIC={
      category:'资源',type:'number',unit:'point/round',defaultValue:0,range:'0–1000',editable:true,
      summary:'任意命名资源（ENERGY/RAGE/SOUL/CHRONO 或未来自定义）：通过 X_MAX 定义上限、resourceRegens.X 定义每回合回复；公式上下文自动暴露该资源。',
      higherEffect:'该资源的储量/回复更高，驱动更多资源消耗型行动。',
      lowerEffect:'资源更紧张，行动频率受限。',
      direction:'positive',
      battleEffect:'参与资源成本支付、资源 gain/convert/upkeep，并作为公式变量（如 RAGE * 2）参与计算。',
      interactions:['RESOURCE_MAX','RESOURCE_REGEN','CONVERT_RATIO','RESOURCE_COST','RESOURCE_COST_MOD','RESOURCE_GAIN_MOD'],
      aiMeaning:'AI 评估资源充足的行动优先级更高；资源不足时避免高成本行动。',
      battlePowerMeaning:'BattlePower v2 的 economy feature 读取 ENERGY_REGEN 与资源产出。',
      examples:['SOUL_MAX=8 + resourceRegens.SOUL=1：每回合回 1 魂力，上限 8','RAGE：怒气，战斗中获得/消耗'],
      tuningGuidance:'提高资源上限/回复强化循环；若“资源循环从不形成有效结果”先检查是否有消费者。',
      userIntentExamples:['资源循环','让这张卡靠资源运转','消耗资源爆发'],
      readBy:['engine resource pipeline','canonical AI','BattlePower v2','Behavior Analyzer'],writtenBy:['Generator v4','Advanced Editor'],affects:['resource pool','action frequency','formula variables'],doesNotAffect:['HP','DEF','accuracy']};
    const RESOURCE_NAMES=Object.create(null);
    const content=typeof require==='function'?safeRequire('content/presets-v4.json'):null;
    if(content&&content.cards){
      for(const c of content.cards){
        for(const key of Object.keys(c.stats||{}))if(/_MAX$|_REGEN$/.test(key))RESOURCE_NAMES[key.replace(/_(MAX|REGEN)$/,'')]=true;
        for(const key of Object.keys(c.resources||{}))RESOURCE_NAMES[key]=true;
        for(const key of Object.keys(c.resourceRegens||{}))RESOURCE_NAMES[key]=true;
      }
    }
    for(const r of ['ENERGY','RAGE','SOUL','CHRONO'])RESOURCE_NAMES[r]=true;
    for(const r of Object.keys(RESOURCE_NAMES)){
      if(!params[r])params[r]={id:r,...RESOURCE_GENERIC,nameZh:r,nameEn:r};
      if(!params[r+'_MAX'])params[r+'_MAX']={id:r+'_MAX',...RESOURCE_GENERIC,nameZh:r+'上限',nameEn:r+'_MAX',summary:r+' 的资源上限（通过 X_MAX 定义任意资源）。'};
      if(!params[r+'_REGEN'])params[r+'_REGEN']={id:r+'_REGEN',...RESOURCE_GENERIC,nameZh:r+'回复',nameEn:r+'_REGEN',summary:r+' 每回合自然回复量（resourceRegens 数据驱动）。'};
    }
    const effects={};for(const [id,e] of Object.entries(NCB.EFFECT_COMPONENTS||{})){const ex=EFFECT_EXTRA[id]||{};effects[id]={id,human:ex.summary||e.human||'',fields:e.fields||[],direction:ex.direction||'contextual',higherEffect:ex.higherEffect||'',lowerEffect:ex.lowerEffect||''};}
    const conditions={};for(const id of Object.keys(NCB.CONDITION_COMPONENTS||{}))conditions[id]={id,human:KNOWN_CONDITIONS[id]||''};
    const events={};for(const id of Object.keys(NCB.EVENT_COMPONENTS||{}))events[id]={id,human:KNOWN_EVENTS[id]||''};
    const targets={};for(const id of Object.keys(NCB.TARGET_COMPONENTS||{}))targets[id]={id,human:KNOWN_TARGETS[id]||''};
    const modifierOps={};for(const [id,m] of Object.entries(NCB.MODIFIER_OPERATIONS||{}))modifierOps[id]={id,name:m.name||id,human:KNOWN_MOD_OPS[id]||m.human||'',phase:m.phase||''};
    return{params,effects,conditions,events,targets,modifierOps,
      formulaSymbols:KNOWN_FORMULA_SYMBOLS,formulaFunctions:KNOWN_FORMULA_FUNCTIONS,
      damageTypes:KNOWN_DAMAGE_TYPES,runtimeState:KNOWN_RUNTIME_STATE};
  }
  function safeRequire(p){try{return require(require('node:path').resolve(__dirname,'..',p));}catch(_){return null;}}
  function buildParamFallback(id){
    const d=KNOWN_PARAM_DETAILS[id]||{};
    return{id,category:d.category||'v4',type:'number',unit:'',defaultValue:undefined,range:'any',editable:true,
      nameZh:d.nameZh||id,nameEn:id,summary:d.summary||'',higherEffect:d.higherEffect||'',lowerEffect:d.lowerEffect||'',
      direction:d.direction||'contextual',battleEffect:d.battleEffect||'',interactions:d.interactions||[],
      aiMeaning:d.aiMeaning||'',battlePowerMeaning:d.battlePowerMeaning||'',examples:d.examples||[],
      tuningGuidance:d.tuningGuidance||'',userIntentExamples:d.userIntentExamples||[],readBy:d.readBy||[],writtenBy:d.writtenBy||[],
      affects:d.affects||[],doesNotAffect:d.doesNotAffect||[],introducedIn:d.introducedIn,generatorSupport:d.generatorSupport,engineSupport:d.engineSupport};
  }

  let _cache=null;
  NCB.NUMERICAL_KNOWLEDGE=function(){if(!_cache)_cache=buildKnowledge();return _cache;};
  NCB.knowledgeSearch=function(query){
    const q=String(query||'').trim().toLowerCase();if(!q)return[];
    const k=NCB.NUMERICAL_KNOWLEDGE();const out=[];
    const push=(kind,id,entry)=>{if(!entry)return;const hay=[id,entry.nameZh,entry.nameEn,entry.summary,entry.higherEffect,entry.lowerEffect,entry.aiMeaning,entry.tuningGuidance,entry.battleEffect,(entry.human||''),(entry.fields||[]).join(' ')].join(' ').toLowerCase();if(hay.includes(q))out.push({kind,id,nameZh:entry.nameZh||entry.human||id,nameEn:entry.nameEn||id,summary:entry.summary||entry.human||''});};
    for(const [id,e] of Object.entries(k.params))push('参数',id,e);
    for(const [id,e] of Object.entries(k.effects))push('效果',id,e);
    for(const [id,e] of Object.entries(k.conditions))push('条件',id,e);
    for(const [id,e] of Object.entries(k.events))push('事件',id,e);
    for(const [id,e] of Object.entries(k.targets))push('目标',id,e);
    for(const [id,e] of Object.entries(k.modifierOps))push('修饰',id,e);
    for(const [id,e] of Object.entries(k.formulaSymbols))push('公式变量',id,{nameZh:id,nameEn:id,summary:e.what,human:e.what});
    for(const [id,e] of Object.entries(k.formulaFunctions))push('公式函数',id,{nameZh:id,nameEn:id,summary:e,human:e});
    for(const [id,e] of Object.entries(k.damageTypes))push('伤害类型',id,{nameZh:id,nameEn:id,summary:e,human:e});
    return out;
  };
  NCB.knowledgeLookup=function(id){
    const k=NCB.NUMERICAL_KNOWLEDGE();
    if(k.params[id])return{kind:'参数',entry:k.params[id]};
    // dynamic resources: SOUL/RAGE/CHRONO/<custom> resolve to the generic resource entries
    if(id==='SOUL'||id==='RAGE'||id==='CHRONO'||id.endsWith('_MAX')||id.endsWith('_REGEN')){
      const base=id.endsWith('_MAX')||id.endsWith('_REGEN')?id.slice(0,-4):id;
      const e=k.params[id]||k.params[base+'_MAX']||k.params[base+'_REGEN']||k.params['RESOURCE_MAX']||k.params['RESOURCE_REGEN'];
      if(e)return{kind:'参数',entry:e};
    }
    if(k.effects[id])return{kind:'效果',entry:k.effects[id]};
    if(k.conditions[id])return{kind:'条件',entry:k.conditions[id]};
    if(k.events[id])return{kind:'事件',entry:k.events[id]};
    if(k.targets[id])return{kind:'目标',entry:k.targets[id]};
    if(k.modifierOps[id])return{kind:'修饰',entry:k.modifierOps[id]};
    if(k.formulaSymbols[id])return{kind:'公式变量',entry:{id,nameZh:id,nameEn:id,summary:k.formulaSymbols[id].what,human:k.formulaSymbols[id].what}};
    if(k.formulaFunctions[id])return{kind:'公式函数',entry:{id,nameZh:id,nameEn:id,summary:k.formulaFunctions[id],human:k.formulaFunctions[id]}};
    if(k.damageTypes[id])return{kind:'伤害类型',entry:{id,nameZh:id,nameEn:id,summary:k.damageTypes[id],human:k.damageTypes[id]}};
    return null;
  };
  // Coverage helper: every KEY used anywhere on a card resolves to a knowledge entry.
  // ---------- v5 Level × Rarity strength system (Generator v5) ----------
  // These are SYSTEM concepts, not card stats: they describe how Level, Rarity,
  // Seed and BattlePower compose the card's strength. The coverage audit checks
  // card stats/effects; these entries exist so the 百科 and the generated
  // reference can explain the v5 power model honestly.
  def('LevelScale',{
    nameZh:'等级尺度',summary:'v5 权威等级强度曲线：LevelScale(L)=0.10+0.90·((L-1)/99)^0.95。决定该等级允许存在的整体数值尺度。',
    higherEffect:'等级越高，同稀有度卡牌的综合实力尺度越大；Lv1≈0.10、Lv100=1.00。',
    lowerEffect:'低等级卡牌整体数值尺度更小。',
    direction:'positive',battleEffect:'不直接参与单场战斗公式；它定义 Generator v5 生成时该等级的目标强度尺度。',
    interactions:['PowerEnvelope','targetPower','Level'],aiMeaning:'AI 不读取它；它是生成期概念。',
    battlePowerMeaning:'v5 中 Lv100 的稀有度区间 × LevelScale(level) 得到该等级的 PowerEnvelope。',
    examples:['Lv1≈0.10','Lv50≈0.56','Lv100=1.00'],tuningGuidance:'若"等级差距不明显"，先检查 LevelScale 曲线，不要直接改全局伤害。',
    userIntentExamples:['等级没用','低等级太强'],readBy:['Generator v5','Power Envelope v1'],writtenBy:['power-v5.js'],affects:['generation strength scale'],doesNotAffect:['battle formulas']});
  def('PowerEnvelope',{
    nameZh:'稀有度实力包络',summary:'v5 权威规则：Level 决定尺度，Rarity 决定该尺度内允许的综合实力 min–max。同等级下低稀有度上限 < 高稀有度下限。',
    higherEffect:'更高稀有度拥有严格更高的实力区间（max(低) < min(高)）。',
    lowerEffect:'低稀有度被限制在较低区间，不能因随机 Seed 穿透高稀有度。',
    direction:'contextual',battleEffect:'不直接参与战斗；它约束 Generator v5 的 targetPower。',
    interactions:['LevelScale','targetPower','BattlePower v3'],aiMeaning:'AI 不读取。',
    battlePowerMeaning:'BattlePower v3 是真实卡牌实力测量；Generator 把包络目标烤进真实数值，因此测量值自然落在区间内（不是显示 clamp）。',
    examples:['C Lv100:1000–1040','A+ Lv100:1310–1380','XS 典藏 Lv100:1770–1840'],tuningGuidance:'调整稀有度强度应改包络表，而不是在 BP 上加 rarity 数字。',
    userIntentExamples:['C+ 战力超过 A+','稀有度没意义'],readBy:['Generator v5','audits'],writtenBy:['power-v5.js'],affects:['generation target strength'],doesNotAffect:['battle formulas']});
  def('targetPower',{
    nameZh:'目标战力',summary:'Generator v5 为每张卡确定的综合实力目标：包络 min–max 内由 Seed 决定个体位置（lerp 内区间）。',
    higherEffect:'目标越高，生成数值的绝对尺度越大。',
    lowerEffect:'目标越低，生成数值尺度越小。',
    direction:'contextual',battleEffect:'生成期目标；BattlePower v3 校准使实际战力接近它。',
    interactions:['PowerEnvelope','deterministicQualityPercentile','BattlePower v3'],aiMeaning:'AI 不读取。',
    battlePowerMeaning:'校准后的 BattlePower v3 ≈ targetPower，且严格落在包络内。',
    examples:['C Lv100 目标约 1012','A+ Lv100 目标约 1345'],tuningGuidance:'不要直接改它；改包络表或质量百分位映射。',
    userIntentExamples:[],readBy:['Generator v5'],writtenBy:['power-v5.js'],affects:['generation strength'],doesNotAffect:['battle formulas']});
  def('deterministicQualityPercentile',{
    nameZh:'确定性质量百分位',summary:'v5 中 Seed 的唯一职责之一：在稀有度包络内部决定个体位置（0–1），不再能跨越稀有度。',
    higherEffect:'百分位高 → 卡牌在包络内偏上限。',
    lowerEffect:'百分位低 → 卡牌在包络内偏下限。',
    direction:'contextual',battleEffect:'只影响生成期 targetPower。',
    interactions:['targetPower','PowerEnvelope'],aiMeaning:'AI 不读取。',
    battlePowerMeaning:'同稀有度内个体差异的来源；不同 Seed 只移动包络内位置。',
    examples:['q=0.1 → 偏下限','q=0.9 → 偏上限'],tuningGuidance:'若同稀有度个体差异过大/过小，调整百分位到包络的映射区间。',
    userIntentExamples:['同稀有度强弱太悬殊'],readBy:['Generator v5'],writtenBy:['power-v5.js'],affects:['individual strength'],doesNotAffect:['battle formulas']});
  def('StochasticInitiative',{
    nameZh:'随机先手（Initiative）',summary:'同 Priority 层内，SPD 决定先手概率而非绝对顺序：initiative = SPD × jitter，jitter∈[0.85,1.15]，读取对局 PRNG。',
    higherEffect:'SPD 优势提高先手概率；差距足够大时固定先手。',
    lowerEffect:'慢速卡有爆冷先手机会，但不能跨越极大 SPD 差距。',
    direction:'contextual',battleEffect:'每回合行动排序的第二键（Priority 之后、确定性兜底之前），全部来自对局 seed 的 PRNG，Replay 可复现。',
    interactions:['SPD','Priority','Match Seed'],aiMeaning:'AI 按期望效用决策，不读取 initiative 本身。',
    battlePowerMeaning:'不影响 BattlePower；它只影响单场对局的先后轨迹。',
    examples:['同速≈50/50','85v80≈60–70%','120v50≈100%'],tuningGuidance:'调整先手随机性应改 jitter 区间，不要改 SPD 属性本身。',
    userIntentExamples:['谁永远先手','先手太固定'],readBy:['BattleEngine orderActions'],writtenBy:['kernel.js'],affects:['action ordering'],doesNotAffect:['damage','BattlePower']});
  def('MatchSeed',{
    nameZh:'对局种子',summary:'每场普通对战的随机种子：固定 seed + 相同输入 = 完全相同结果（确定性保留）；普通"开始/重开"每局生成新 seed。',
    higherEffect:'新 seed → 新的命中/暴击/波动/先后轨迹。',
    lowerEffect:'同 seed → 精确复现同一局。',
    direction:'contextual',battleEffect:'驱动 BattleEngine.prng 的全部单局随机（先手、命中、暴击、波动、状态）。',
    interactions:['StochasticInitiative','Replay'],aiMeaning:'AI 计划使用 prng 克隆的预热流，不改变主随机序列。',
    battlePowerMeaning:'BattlePower 不读取 Match Seed——卡牌实力与单局随机严格分离。',
    examples:['普通开始=新 seed','高级"同种子重放"=固定 seed'],tuningGuidance:'若玩家抱怨"每局一样"，是旧 UI 复用固定 seed；现在普通路径每局新 seed。',
    userIntentExamples:['每次对战都一样','重开没变化'],readBy:['BattleEngine','Replay'],writtenBy:['app.js'],affects:['single-battle randomness'],doesNotAffect:['card generation','BattlePower']});

  NCB.knowledgeCoverageGaps=function(card){
    const k=NCB.NUMERICAL_KNOWLEDGE();const gaps=[];
    const check=(kind,id,where)=>{if(!id)return;if(kind==='param'&&!k.params[id]&&!k.params[id+'_MAX']&&!k.params[id+'_REGEN'])gaps.push(where+': unknown param '+id);};
    for(const [key] of Object.entries(card.stats||{}))check('param',key,'stats.'+key);
    for(const [key] of Object.entries(card.resources||{}))check('param',key,'resources.'+key);
    for(const [key] of Object.entries(card.resourceRegens||{}))check('param',key,'resourceRegens.'+key);
    const walk=(e,where)=>{for(const x of e||[]){if(x.type&&!k.effects[x.type])gaps.push(where+': unknown effect '+x.type);if(x.condition&&!k.conditions[x.condition.type])gaps.push(where+': unknown condition '+x.condition.type);if(x.effects)walk(x.effects,where);if(x.then)walk(x.then,where);if(x.else)walk(x.else,where);}};
    for(const a of card.actions||[])walk(a.effects,'action.'+a.name);
    for(const s of card.statuses||[]){if(s.periodic)walk(s.periodic.effects,'status.'+s.id+'.periodic');if(s.triggers)for(const t of s.triggers){if(!k.events[t.event])gaps.push('status.'+s.id+'.trigger: unknown event '+t.event);walk(t.effects,'status.'+s.id+'.trigger.'+t.event);}if(s.eventModifiers)for(const m of s.eventModifiers){if(!k.events[m.event])gaps.push('status.'+s.id+'.eventModifier: unknown event '+m.event);}}
    for(const t of card.triggers||[]){if(!k.events[t.event])gaps.push('trigger: unknown event '+t.event);walk(t.effects,'trigger.'+t.event);}
    return gaps;
  };
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
