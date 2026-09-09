# CARD-NUMERICAL-REFERENCE — 卡牌数值知识参考

> **GENERATED FROM CANONICAL NUMERICAL KNOWLEDGE REGISTRY. DO NOT HAND EDIT.**
> 唯一真源：`src/numerical-knowledge.js`（+ `src/components.js` 注册表）。生成：`npm run numerical-reference`。
> 玩家向说明在游戏内「数值百科」；本文件服务开发者 / Coding Agent / Content AI。

## 0. 覆盖率总览

| 类别 | 已文档化 |
|---|---:|
| 参数 Card Stats / Resources | 116 |
| 效果 Effect types | 18 |
| 条件 Conditions | 27 |
| 目标 Targets | 8 |
| 事件 Events | 29 |
| 修饰操作 Modifier ops | 8 |
| 公式变量 Formula symbols | 43 |
| 公式函数 Formula functions | 14 |
| 伤害类型 Damage types | 8 |

## 1. 卡牌参数（Card Stats / Resources）

| 字段 | 中文名 | 方向 | 它是什么 | 调高会怎样 | 调低会怎样 | 谁读取 | 交互 |
|---|---|---|---|---|---|---|---|
| MAX_HP | 最大生命 | positive | 决定实体可承受的总生命伤害；也是大量治疗、护盾、自伤公式的比例基准。 | 更肉：能承受更多伤害，放大基于 MAX_HP 的治疗/护盾/自伤。 | 更脆：更快被击倒，基于 MAX_HP 的比例效果更弱。 | engine damage pipeline / formula scope / canonical AI / BattlePower v2 / Behavior Analyzer | DEF / RES / HEAL_POWER / shield / Battle Wear |
| ATK | 攻击强度 | positive | 多数直接伤害、DoT、反击等公式可以引用的基础进攻属性。 | 依赖 ATK 的伤害、反击、部分状态伤害提高。 | 这些 Action 的实际威力下降。 | engine formula scope / canonical AI / BattlePower v2 / Behavior Analyzer | CRIT / CRIT_DMG / PEN / DEF / RES / RAMP_RATE / damage formula |
| DEF | 物理防御 | positive | 降低使用 DEF 防御轴的伤害（physical / bleed 等）。 | 对物理轴伤害的有效减伤更高。 | 更怕物理伤害。 | engine defense axis / canonical AI / BattlePower v2 / Behavior Analyzer | RES / PEN / damageType / DAMAGE_TYPE |
| RES | 法术抗性 | positive | 降低使用 RES 防御轴的元素/奥术伤害（arcane/fire/frost/lightning/toxic）。 | 对元素/奥术伤害的有效减伤更高。 | 更怕元素伤害。 | engine defense axis / canonical AI / BattlePower v2 / Behavior Analyzer | DEF / PEN / damageType / RES_PEN |
| SPD | 速度 | positive | 同优先级下决定行动先后顺序。 | 更多先手：同 priority 时排在前面。 | 更晚行动，容易被先手压制。 | engine action ordering / canonical AI / BattlePower v2 / Behavior Analyzer | PRIORITY / ModifyPriority |
| ACC | 命中 | positive | 提高技能命中概率。 | 更少未命中，尤其对高闪避目标。 | 更容易 miss。 | engine accuracy resolution / canonical AI / BattlePower v2 | EVA / CAN_MISS / ModifyAccuracy |
| EVA | 闪避 | positive | 降低敌方可闪避技能的命中率。 | 更少被打中（闪避流）。 | 更容易被命中。 | engine accuracy resolution / canonical AI / BattlePower v2 | ACC / CAN_MISS |
| CRIT | 暴击率 | positive | 增加可暴击伤害段的暴击概率（%）。 | 更多暴击，配合 CRIT_DMG 提高期望伤害。 | 更少暴击，输出更平。 | engine crit resolution / canonical AI / BattlePower v2 / Behavior Analyzer | CRIT_DMG / CRIT_BONUS / CAN_CRIT / ModifyCritChance |
| CRIT_DMG | 暴击倍率 | positive | 决定暴击时伤害倍率（%）。 | 暴击更痛。 | 暴击收益更低。 | engine crit resolution / canonical AI / BattlePower v2 | CRIT / CRIT_BONUS |
| PEN | 通用穿透 | positive | 按比例忽略目标 DEF/RES（%）。 | 更容易打穿高防目标。 | 对高防目标的伤害更低。 | engine penetration / canonical AI / BattlePower v2 | DEF / RES / PENETRATION_BONUS / TYPE_PENETRATION |
| LIFESTEAL | 吸血 | positive | 按造成的 HP 伤害回复施法者生命（%）。与 Action 自带 drainRatio 是两条独立路径。 | 打出的伤害回血更多，越打越站。 | 回复更少。 | engine applyDamage lifesteal path / canonical AI / BattlePower v2 / Behavior Analyzer | drainRatio / HEAL_POWER / HEAL_TAKEN / damage |
| HEAL_POWER | 治疗强度 | positive | 放大自身施放的治疗（%）。 | 自己的治疗更强。 | 治疗更弱。 | engine heal pipeline / canonical AI / BattlePower v2 | HEAL_TAKEN / Battle Wear / heal |
| HEAL_TAKEN | 受疗倍率 | positive | 控制自己收到治疗的倍率（%）。 | 收到更多治疗。 | 更难被治疗（可用于重伤/禁疗）。 | engine heal pipeline / canonical AI / BattlePower v2 | HEAL_POWER / Battle Wear / heal |
| POTENCY | 效能 | positive | V7 的非直接数值输出轴，放大周期、触发与引爆伤害，不放大普通直接攻击。 | DoT、状态周期伤害与触发伤害更强，但高值收益逐渐饱和。 | 非直接输出更弱。 | engine computeDamage / canonical AI / Strength Model V7 | ATK / periodic / trigger / damage formula |
| CONTROL_POWER | 控制强度 | positive | V7 敌对控制/弱化的进攻轴，与目标 TENACITY 在 logit 概率空间对抗。 | 敌对非 DoT 状态更易成功，持续时间最多提高到 1.50 倍。 | 控制更易被抵抗，持续时间最低约 0.60 倍。 | status effect resolver / canonical AI / Strength Model V7 | TENACITY / STATUS_CHANCE / STATUS_DURATION |
| TENACITY | 韧性 | positive | V7 控制抗性轴，抵抗敌方 CONTROL_POWER。 | 敌方控制与弱化更难命中且持续更短。 | 更容易受到控制。 | status effect resolver / canonical AI / Strength Model V7 | CONTROL_POWER / STATUS_CHANCE / STATUS_DURATION |
| RECOVERY | 恢复速度 | positive | V7 冷却准备轴；影响技能何时再次可用，但不增加每回合行动次数。 | 较长冷却技能更快再次就绪，高值有界饱和。 | 冷却准备更慢。 | engine round start / canonical AI / Strength Model V7 | COOLDOWN / cooldownProgress / ONE Action opportunity |
| BARRIER_POWER | 屏障强度 | positive | V7 Shield/Ward/Barrier 的独立输出轴，100 为中性。 | 屏障与类型护符数值提高，高值有界饱和。 | 屏障类效果更弱。 | shield effect / ward effect / canonical AI / Strength Model V7 | shield / ward / MAX_HP |
| ENERGY_MAX | 能量上限 | contextual | 标准技能资源池上限。 |  |  |  |  |
| ENERGY_REGEN | 能量回复 | positive | 每回合恢复标准能量。 | 技能循环更快、更稳定。 | 技能更缺资源。 | engine resource regen / canonical AI / BattlePower v2 / Behavior Analyzer | ENERGY_MAX / resourceRegens / RESOURCE_GAIN_MOD |
| RESOURCE_MAX | 自定义资源上限 | contextual | 任意资源 X 通过 X_MAX 定义上限。 |  |  |  |  |
| RESOURCE_REGEN | 自定义资源回复 | contextual | 任意资源每回合的自然回复。 |  |  |  |  |
| BASE_FORMULA | 基础公式 | contextual | 技能数值的主公式。 |  |  |  |  |
| FORMULA_MULTIPLIER | 公式倍率 | contextual | 在单个 damage component 上额外乘算。 |  |  |  |  |
| DAMAGE_TYPE | 伤害类型 | contextual | 决定使用哪条防御轴、抗性、护符和亲和。 |  |  |  |  |
| SKILL_ACCURACY | 技能基础命中 | contextual | 技能自身命中系数。 |  |  |  |  |
| PRIORITY | 行动优先级 | contextual | 高于速度的行动顺序层。 |  |  |  |  |
| COOLDOWN | 冷却 | contextual | 技能再次使用前等待回合数。 |  |  |  |  |
| RESOURCE_COST | 资源费用 | contextual | 技能消耗任意资源。 |  |  |  |  |
| HP_COST | 生命费用 | contextual | 把生命作为施法成本。 |  |  |  |  |
| HITS | 攻击段数 | contextual | 同一伤害效果重复结算的段数。 |  |  |  |  |
| CRIT_BONUS | 技能暴击加成 | contextual | 只影响当前技能的暴击概率。 |  |  |  |  |
| PENETRATION_BONUS | 技能穿透加成 | contextual | 只影响当前技能的防御穿透。 |  |  |  |  |
| TYPE_PENETRATION | 类型穿透 | contextual | 忽略目标对应伤害类型的一部分抗性。 |  |  |  |  |
| CAN_CRIT | 允许暴击 | contextual | 决定伤害段能否暴击。 |  |  |  |  |
| CAN_MISS | 允许未命中 | contextual | 决定是否执行命中判定。 |  |  |  |  |
| CAN_REFLECT | 允许反射 | contextual | 决定该伤害是否可触发反伤链。 |  |  |  |  |
| SECONDARY_CHANCE | 附加效果概率 | contextual | 控制状态/次级效果触发概率。 |  |  |  |  |
| TARGET_MODE | 目标模式 | contextual | 决定技能可选目标集合。 |  |  |  |  |
| TARGET_RELATION | 目标关系 | contextual | 定义候选目标与施法者的关系。 |  |  |  |  |
| TARGET_FILTER | 目标过滤条件 | contextual | 使用通用 Condition 树筛选候选目标。 |  |  |  |  |
| TARGET_SORT | 目标排序 | contextual | 决定自动目标的排序依据。 |  |  |  |  |
| TARGET_ORDER | 目标排序方向 | contextual | 控制目标排序升序或降序。 |  |  |  |  |
| TARGET_LIMIT | 目标数量上限 | contextual | 限制查询结果最多保留多少目标。 |  |  |  |  |
| TARGET_SELECTION | 目标选择模式 | contextual | 决定查询结果由玩家选一个、自动取第一或全部应用。 |  |  |  |  |
| TARGET_REQUIREMENT | 目标条件 | contextual | 进一步过滤合法目标。 |  |  |  |  |
| REQUIREMENT | 施放条件 | contextual | 控制技能是否进入 LegalActions。 |  |  |  |  |
| RECOIL_RATIO | 反噬倍率 | contextual | 按生命或伤害产生自伤成本。 |  |  |  |  |
| DRAIN_RATIO | 汲取倍率 | contextual | 把本技能实际造成的 HP 伤害按比例转为施法者治疗。 |  |  |  |  |
| DAMAGE_VARIANCE_MIN | 随机伤害下限 | contextual | 每个伤害分量在暴击前乘上的确定性随机倍率下限。 |  |  |  |  |
| DAMAGE_VARIANCE_MAX | 随机伤害上限 | contextual | 每个伤害分量的随机倍率上限。 |  |  |  |  |
| IGNORE_DEFENSE | 忽略防御 | contextual | 让对应 Damage Component 跳过 DEF/RES 等防御轴。 |  |  |  |  |
| IGNORE_RESISTANCE | 忽略类型抗性 | contextual | 让对应 Damage Component 跳过目标类型抗性。 |  |  |  |  |
| IGNORE_EVASION | 忽略闪避 | contextual | 命中公式忽略目标 EVA。 |  |  |  |  |
| DEFENSE_STAT | 防御属性选择 | contextual | 指定该伤害分量使用哪个目标 Stat 作为防御轴。 |  |  |  |  |
| MIN_DAMAGE | 最小伤害钳制 | contextual | 给单个伤害分量设置结算前的最低伤害。 |  |  |  |  |
| MAX_DAMAGE | 最大伤害钳制 | contextual | 给单个伤害分量设置结算前的最高伤害。 |  |  |  |  |
| SPREAD_MULTIPLIER | 群体伤害倍率 | contextual | 群攻时统一调节每个目标伤害。 |  |  |  |  |
| SHIELD_AMOUNT | 通用屏障量 | contextual | 所有类型伤害前的通用吸收层。 |  |  |  |  |
| WARD_AMOUNT | 类型护符量 | contextual | 只吸收指定 damage type。 |  |  |  |  |
| RESISTANCE | 类型抗性 | contextual | 按伤害类型降低或放大最终伤害。 |  |  |  |  |
| AFFINITY | 类型亲和 | contextual | 受到匹配类型 HP 伤害后恢复一部分生命。 |  |  |  |  |
| IMMUNITY | 状态免疫 | contextual | 按状态标签抵抗施加。 |  |  |  |  |
| STATUS_CHANCE | 状态施加率 | contextual | 技能附加 Status 的成功概率。 |  |  |  |  |
| STATUS_DURATION | 持续时间 | contextual | 状态保留回合数。 |  |  |  |  |
| STATUS_STACKS | 施加层数 | contextual | 一次施加增加/设置的层数。 |  |  |  |  |
| MAX_STACKS | 最大层数 | contextual | 状态最多可积累层数。 |  |  |  |  |
| STACKING_POLICY | 叠层策略 | contextual | 决定重复施加如何处理。 |  |  |  |  |
| STAT_ADD | 属性加值 | contextual | 对任意 Stat 添加固定值。 |  |  |  |  |
| STAT_MULTIPLIER | 属性倍率 | contextual | 对任意 Stat 乘算。 |  |  |  |  |
| RESISTANCE_MOD | 抗性修正 | contextual | 临时改变某类型或全部抗性。 |  |  |  |  |
| DAMAGE_DEALT_MULT | 输出倍率 | contextual | 修改最终输出伤害。 |  |  |  |  |
| DAMAGE_TAKEN_MULT | 承伤倍率 | contextual | 修改目标最终收到的伤害。 |  |  |  |  |
| ACCURACY_MOD | 命中修正 | contextual | 临时修改技能基础命中。 |  |  |  |  |
| HITS_MOD | 段数修正 | contextual | 临时改变技能攻击次数。 |  |  |  |  |
| CRIT_CHANCE_MOD | 暴击修正 | contextual | 临时改变技能暴击率。 |  |  |  |  |
| PENETRATION_MOD | 穿透修正 | contextual | 临时改变技能穿透。 |  |  |  |  |
| EVENT_PRIORITY | 事件优先级 | contextual | 决定多个同类 Modifier 的结算顺序。 |  |  |  |  |
| HEAL_DEALT_MULT | 治疗输出事件倍率 | contextual | 在治疗公式和治疗强度之后进一步修改施法者产生的治疗。 |  |  |  |  |
| HEAL_TAKEN_EVENT_MULT | 受疗事件倍率 | contextual | 在目标受疗属性之外进一步修改本次收到的治疗。 |  |  |  |  |
| RESOURCE_COST_MOD | 资源费用修正 | contextual | 修改某类技能资源费用。 |  |  |  |  |
| RESOURCE_GAIN_MOD | 资源获得修正 | contextual | 修改资源回复与效果产生的资源量。 |  |  |  |  |
| COOLDOWN_MOD | 冷却修正 | contextual | 修改技能使用后写入的冷却。 |  |  |  |  |
| SHIELD_MOD | 屏障获得修正 | contextual | 修改本次获得的通用屏障量。 |  |  |  |  |
| WARD_MOD | 类型护符获得修正 | contextual | 修改本次获得的类型护符量。 |  |  |  |  |
| RESISTANCE_EVENT_MOD | 抗性事件修正 | contextual | 在基础抗性与状态抗性带之后修正最终类型抗性。 |  |  |  |  |
| PRIORITY_MOD | 行动优先级修正 | contextual | 临时修改技能在队列中的优先级。 |  |  |  |  |
| TRIGGER_CHANCE | 触发概率 | contextual | 控制被动反应发生概率。 |  |  |  |  |
| TRIGGER_LIMIT | 触发链上限 | contextual | 限制反射/反击等递归链深度。 |  |  |  |  |
| PERIOD | 周期间隔 | contextual | DoT/HoT 每隔多少回合触发。 |  |  |  |  |
| SNAPSHOT_MODE | 快照模式 | contextual | 决定周期效果使用施加时还是每跳实时属性。 |  |  |  |  |
| UPKEEP_AMOUNT | 维持费用 | contextual | Sustain 每回合支付的资源。 |  |  |  |  |
| CONVERT_RATIO | 资源转换率 | contextual | 一种资源转为另一种资源的比例。 |  |  |  |  |
| CONSUME_STACKS | 状态消费量 | contextual | 从目标状态中消费层数。 |  |  |  |  |
| REPEAT_TIMES | 效果重复次数 | contextual | 重复执行一个效果块。 |  |  |  |  |
| CONDITION_BRANCH | 条件分支 | contextual | 依据通用条件选择 then/else 效果块。 |  |  |  |  |
| VOLATILITY | 波动性 | positive | 控制这张卡牌的伤害与部分随机效果在平均值附近波动的幅度。 | 同一行动不同回合之间的结果差异越大（例如 0.60–1.55 的宽区间）。 | 输出越稳定，更接近期望值（例如 0.95–1.05）。 | engine damage variance resolver / canonical AI / BattlePower v2 / Behavior Analyzer | LUCK / CRIT / varianceMin / varianceMax |
| LUCK | 幸运 | mixed | 不是直接加伤害，而是改变随机分布的偏移：更容易抽到区间上半还是下半。 | 正数时结果偏向区间上半（略高于期望），负数时偏向下半。 | 接近 0 时分布对称，等于普通均匀随机。 | engine damage variance resolver / canonical AI / BattlePower v2 | VOLATILITY / varianceMin / varianceMax |
| ENDURANCE | 耐力 | positive | 决定这张卡在长期战斗中的损耗抗性：越高越晚进入疲劳，Battle Wear 影响越小。 | 明显更晚进入疲劳，能拖更长战线。 | 更早疲劳，长时间战斗更快崩溃。 | engine applyBattleWear / canonical AI / BattlePower v2 / Behavior Analyzer | FATIGUE_RATE / FATIGUE_START / Battle Wear / HEAL_TAKEN |
| RAMP_START | 成长开始回合 | negative | 开始进入成长曲线的战斗回合阈值：在此之前没有 RAMP 加成。 | 成长开始得越晚，前期越弱。 | 成长开始得越早，前期就越接近后期强度。 | engine dynamic stats / canonical AI / BattlePower v2 / Behavior Analyzer | RAMP_RATE / RAMP_CAP / ROUND / BATTLE_TURN |
| RAMP_RATE | 成长速度 | positive | 每回合 RAMP 的成长幅度：数值越高后期成长越快。 | 后期成长速度更快。 | 成长更缓慢。 | engine dynamic stats / canonical AI / BattlePower v2 / Behavior Analyzer | RAMP_START / RAMP_CAP / ROUND |
| RAMP_CAP | 成长上限 | positive | RAMP 加成的上限倍率：成长不会超过这个值。 | 成长峰值更高，后期更强。 | 成长峰值更低，后期更接近前期。 | engine dynamic stats / canonical AI / BattlePower v2 / Behavior Analyzer | RAMP_START / RAMP_RATE |
| FATIGUE_START | 疲劳开始回合 | negative | 开始进入疲劳曲线的战斗回合阈值：在此之前没有 FATIGUE 衰减。 | 疲劳开始得越晚，能撑越久。 | 疲劳开始得越早，长局越弱。 | engine dynamic stats / canonical AI / BattlePower v2 / Behavior Analyzer | FATIGUE_RATE / FATIGUE_CAP / ENDURANCE / ROUND |
| FATIGUE_RATE | 疲劳速度 | positive | 每回合 FATIGUE 的衰减幅度：数值越高长局衰弱越快。 | 长局衰弱更快。 | 角色更耐久。 | engine dynamic stats / canonical AI / BattlePower v2 / Behavior Analyzer | FATIGUE_START / FATIGUE_CAP / ENDURANCE |
| FATIGUE_CAP | 疲劳下限 | positive | FATIGUE 衰减的下限倍率：再疲劳也不会低于这个值。 | 疲劳后保留更多战力（更耐久）。 | 疲劳后战力更低（更容易被终结）。 | engine dynamic stats / canonical AI / BattlePower v2 / Behavior Analyzer | FATIGUE_START / FATIGUE_RATE / Battle Wear |
| BATTLE_WEAR | 战斗损耗 | contextual | 战斗时间长期增长产生的自然压力，不是普通 Action，也不是隐藏作弊：它让治疗型卡在超长局中最终也无法无限维持。 | —（这是一个系统机制而非可调属性；其强度由 ENDURANCE 与时间共同决定）。 | — | engine applyBattleWear / canonical AI / BattlePower v2 | ROUND / ENDURANCE / FATIGUE_RATE / HEAL_TAKEN / shield / ward |
| ENERGY | ENERGY | positive | 任意命名资源（ENERGY/RAGE/SOUL/CHRONO 或未来自定义）：通过 X_MAX 定义上限、resourceRegens.X 定义每回合回复；公式上下文自动暴露该资源。 | 该资源的储量/回复更高，驱动更多资源消耗型行动。 | 资源更紧张，行动频率受限。 | engine resource pipeline / canonical AI / BattlePower v2 / Behavior Analyzer | RESOURCE_MAX / RESOURCE_REGEN / CONVERT_RATIO / RESOURCE_COST / RESOURCE_COST_MOD / RESOURCE_GAIN_MOD |
| SOUL | SOUL | positive | 任意命名资源（ENERGY/RAGE/SOUL/CHRONO 或未来自定义）：通过 X_MAX 定义上限、resourceRegens.X 定义每回合回复；公式上下文自动暴露该资源。 | 该资源的储量/回复更高，驱动更多资源消耗型行动。 | 资源更紧张，行动频率受限。 | engine resource pipeline / canonical AI / BattlePower v2 / Behavior Analyzer | RESOURCE_MAX / RESOURCE_REGEN / CONVERT_RATIO / RESOURCE_COST / RESOURCE_COST_MOD / RESOURCE_GAIN_MOD |
| SOUL_MAX | SOUL上限 | positive | SOUL 的资源上限（通过 X_MAX 定义任意资源）。 | 该资源的储量/回复更高，驱动更多资源消耗型行动。 | 资源更紧张，行动频率受限。 | engine resource pipeline / canonical AI / BattlePower v2 / Behavior Analyzer | RESOURCE_MAX / RESOURCE_REGEN / CONVERT_RATIO / RESOURCE_COST / RESOURCE_COST_MOD / RESOURCE_GAIN_MOD |
| SOUL_REGEN | SOUL回复 | positive | SOUL 每回合自然回复量（resourceRegens 数据驱动）。 | 该资源的储量/回复更高，驱动更多资源消耗型行动。 | 资源更紧张，行动频率受限。 | engine resource pipeline / canonical AI / BattlePower v2 / Behavior Analyzer | RESOURCE_MAX / RESOURCE_REGEN / CONVERT_RATIO / RESOURCE_COST / RESOURCE_COST_MOD / RESOURCE_GAIN_MOD |
| RAGE | RAGE | positive | 任意命名资源（ENERGY/RAGE/SOUL/CHRONO 或未来自定义）：通过 X_MAX 定义上限、resourceRegens.X 定义每回合回复；公式上下文自动暴露该资源。 | 该资源的储量/回复更高，驱动更多资源消耗型行动。 | 资源更紧张，行动频率受限。 | engine resource pipeline / canonical AI / BattlePower v2 / Behavior Analyzer | RESOURCE_MAX / RESOURCE_REGEN / CONVERT_RATIO / RESOURCE_COST / RESOURCE_COST_MOD / RESOURCE_GAIN_MOD |
| RAGE_MAX | RAGE上限 | positive | RAGE 的资源上限（通过 X_MAX 定义任意资源）。 | 该资源的储量/回复更高，驱动更多资源消耗型行动。 | 资源更紧张，行动频率受限。 | engine resource pipeline / canonical AI / BattlePower v2 / Behavior Analyzer | RESOURCE_MAX / RESOURCE_REGEN / CONVERT_RATIO / RESOURCE_COST / RESOURCE_COST_MOD / RESOURCE_GAIN_MOD |
| RAGE_REGEN | RAGE回复 | positive | RAGE 每回合自然回复量（resourceRegens 数据驱动）。 | 该资源的储量/回复更高，驱动更多资源消耗型行动。 | 资源更紧张，行动频率受限。 | engine resource pipeline / canonical AI / BattlePower v2 / Behavior Analyzer | RESOURCE_MAX / RESOURCE_REGEN / CONVERT_RATIO / RESOURCE_COST / RESOURCE_COST_MOD / RESOURCE_GAIN_MOD |
| CHRONO | CHRONO | positive | 任意命名资源（ENERGY/RAGE/SOUL/CHRONO 或未来自定义）：通过 X_MAX 定义上限、resourceRegens.X 定义每回合回复；公式上下文自动暴露该资源。 | 该资源的储量/回复更高，驱动更多资源消耗型行动。 | 资源更紧张，行动频率受限。 | engine resource pipeline / canonical AI / BattlePower v2 / Behavior Analyzer | RESOURCE_MAX / RESOURCE_REGEN / CONVERT_RATIO / RESOURCE_COST / RESOURCE_COST_MOD / RESOURCE_GAIN_MOD |
| CHRONO_MAX | CHRONO上限 | positive | CHRONO 的资源上限（通过 X_MAX 定义任意资源）。 | 该资源的储量/回复更高，驱动更多资源消耗型行动。 | 资源更紧张，行动频率受限。 | engine resource pipeline / canonical AI / BattlePower v2 / Behavior Analyzer | RESOURCE_MAX / RESOURCE_REGEN / CONVERT_RATIO / RESOURCE_COST / RESOURCE_COST_MOD / RESOURCE_GAIN_MOD |
| CHRONO_REGEN | CHRONO回复 | positive | CHRONO 每回合自然回复量（resourceRegens 数据驱动）。 | 该资源的储量/回复更高，驱动更多资源消耗型行动。 | 资源更紧张，行动频率受限。 | engine resource pipeline / canonical AI / BattlePower v2 / Behavior Analyzer | RESOURCE_MAX / RESOURCE_REGEN / CONVERT_RATIO / RESOURCE_COST / RESOURCE_COST_MOD / RESOURCE_GAIN_MOD |

## 2. 效果组件（Effects）

| 类型 | 说明 | 方向 | 字段 |
|---|---|---|---|
| damage | 对目标造成伤害：命中→随机倍率→暴击→复合伤害包→防御/抗性→Ward/Shield/HP→汲取/反噬。 | positive | formula / components / hits / accuracy / varianceMin / varianceMax / canCrit / canMiss / canReflect / ignoreDefense / ignoreResistance / ignoreEvasion / defenseStat / minDamage / maxDamage / drainRatio / recoilRatio / tags |
| heal | 根据公式产生治疗，应用 HEAL_POWER（施法者）与 HEAL_TAKEN（目标），并经 Battle Wear 受疗衰减。 | positive | formula |
| shield | 增加通用伤害吸收层，先于 HP 承受所有类型伤害。 | positive | formula |
| ward | 增加指定伤害类型的专用吸收层，在该类型伤害结算时先于通用护盾消耗。 | positive | damageType / formula / amount |
| status | 按概率/免疫规则施加可叠层状态（DoT/Buff/控制等）。 | positive | status / chance / duration / stacks |
| toggleStatus | 在存在/不存在之间切换一个状态，用于维持型（Sustain）技能。 | contextual | status / duration / stacks |
| consumeStatus | 消费指定状态层数并把数量写入 CONSUMED_STACKS 供后续公式读取（引爆/换资源）。 | contextual | status / stacks |
| cleanse | 按标签移除负面状态。 | contextual | tags / count |
| dispel | 按类型和标签移除状态，可转移给施法者。 | contextual | kind / tags / count / transfer |
| resource | 给目标增加或减少任意资源。 | contextual | resource / amount / resourceTarget |
| gain | 给施法者增加任意资源（资源生产者）。 | positive | resource / amount |
| energy | 兼容旧内容的 ENERGY 资源变化组件。 | contextual | amount |
| convertResource | 从一种资源扣除并按比例转化为另一资源（资源循环核心）。 | contextual | from / to / amount / ratio / resourceTarget |
| cooldownReduce | 减少目标全部已存在冷却。只在有冷却技能时才真正有价值。 | contextual | amount |
| selfDamagePct | 按施法者最大生命造成不可反射的自伤（自残/血法）。 | negative | pct |
| conditional | 根据通用 Condition 树执行 then 或 else 分支。 | contextual | condition / then / else |
| repeat | 重复执行子效果块 N 次（多段/连击）；引擎和 canonical AI 均按从 0 起的 REPEAT_INDEX 逐次求值，子效果局部上下文与实际结算保持一致。 | positive | times / effects |
| emitEvent | 发射已注册 Trigger Event，让状态/被动通过统一事件链响应。 | contextual | event / eventSubject / tags / payload |

## 3. 条件组件（Conditions）

| 类型 | 含义 |
|---|---|
| hpPctAbove | 施法者生命比例高于 X |
| hpPctBelow | 施法者生命比例低于 X |
| targetHpPctAbove | 目标生命比例高于 X |
| targetHpPctBelow | 目标生命比例低于 X（典型斩杀/处决门控） |
| hasStatus | 施法者具有某状态 |
| missingStatus | 施法者缺少某状态 |
| targetHasStatus | 目标具有某状态 |
| targetMissingStatus | 目标缺少某状态 |
| resourceAtLeast | 施法者某资源 ≥ X |
| targetResourceAtLeast | 目标某资源 ≥ X |
| resourceIs | 施法者某资源等于 X |
| statusStacksAtLeast | 某状态层数 ≥ X |
| targetStatusStacksAtLeast | 目标某状态层数 ≥ X |
| sourceTag | 来源具有某标签 |
| targetTag | 目标具有某标签 |
| statusTag | 状态具有某标签 |
| targetStatusTag | 目标状态具有某标签 |
| consumedStacksAtLeast | 本次消费层数 ≥ X |
| lastHit | 上次攻击命中 |
| lastCrit | 上次攻击暴击 |
| lastKill | 上次攻击击杀 |
| dealtDamageAtLeast | 本次造成伤害 ≥ X |
| dealtHpDamageAtLeast | 本次造成 HP 伤害 ≥ X |
| tag | 实体具有某标签 |
| damageType | 伤害类型为 X |
| livingAlliesAtMost | 存活友方 ≤ X |
| livingEnemiesAtMost | 存活敌方 ≤ X |

## 4. 目标组件（Targets）

| 类型 | 含义 |
|---|---|
| self | 自己 |
| ally | 单个友方 |
| enemy | 单个敌方 |
| all-allies | 全体友方 |
| all-enemies | 全体敌方 |
| random-ally | 随机友方 |
| random-enemy | 随机敌方 |
| query | 目标查询（关系+条件+排序+数量+模式） |

## 5. 事件 / Modifier（Events）

| 事件 | 含义 |
|---|---|
| ModifyStat | 属性修正（Modifier band） |
| ModifyAccuracy | 命中修正 |
| ModifyHits | 段数修正 |
| ModifyCritChance | 暴击修正 |
| ModifyPenetration | 穿透修正 |
| ModifyDamageDealt | 输出倍率 |
| ModifyDamageTaken | 承伤倍率 |
| ModifyHealDealt | 治疗输出倍率 |
| ModifyHealTaken | 受疗倍率 |
| ModifyResourceCost | 资源费用修正 |
| ModifyResourceGain | 资源获得修正 |
| ModifyCooldown | 冷却修正 |
| ModifyShield | 护盾获得修正 |
| ModifyWard | 护符获得修正 |
| ModifyResistance | 抗性修正 |
| ModifyPriority | 行动优先级修正 |
| EntityDefeated | 实体被击败 |
| afterDamageTaken | 受到伤害后 |
| afterDamageDealt | 造成伤害后 |
| afterHealTaken | 受到治疗后 |
| afterHealDealt | 造成治疗后 |
| afterDefeated | 被击败后 |
| afterKill | 击杀后 |
| afterStatusApplied | 状态被施加后 |
| afterStatusInflicted | 状态被施加给他人后 |
| afterStatusRemoved | 状态被移除后 |
| command | 指令（语义信号，不伪造 afterKill） |
| roundStart | 回合开始 |
| roundEnd | 回合结束 |

## 6. Modifier 操作（band 顺序：SET → ADD → MULTIPLY → CAP → FINAL）

| 操作 | 含义 |
|---|---|
| set | 设定：把当前值直接设为参数值。 |
| add | 加法：在 SET 后增加固定值。 |
| addPerStack | 每层加法：每层状态增加固定值。 |
| multiply | 乘法：对 SET+ADD 结果乘算。 |
| multiplyPerStack | 每层倍率：×(1+value×stacks)。 |
| compoundPerStack | 每层复合倍率：×value^stacks。 |
| min | 上限：把结果限制为不高于参数值。 |
| max | 下限：把结果限制为不低于参数值。 |

## 7. 公式变量（Formula Symbols）

| 符号 | 它是什么 | 可用上下文 | 示例 |
|---|---|---|---|
| ATK | 当前有效攻击（含 modifier band 与 RAMP/FATIGUE 动态值） | 施法者 | `ATK * 1.4` |
| DEF | 当前有效防御 | 施法者 | `ATK * 100 / (100 + DEF)` |
| RES | 当前有效抗性 | 施法者 | `ATK * 100 / (100 + RES)` |
| SPD | 当前有效速度 | 施法者 | `SPD * 0.5` |
| ACC | 命中值（配合 EVA 计算命中率） | 施法者 | `100 + ACC` |
| EVA | 闪避值（作为命中公式的防守输入） | 施法者（目标用 TARGET_EVA） | `100 / (100 + EVA)` |
| CRIT | 暴击率（%） | 施法者 | `CRIT / 100` |
| CRIT_DMG | 暴击倍率（%） | 施法者 | `CRIT_DMG / 100` |
| PEN | 通用穿透（%） | 施法者 | `PEN / 100` |
| MAX_HP | 最大生命 | 施法者 | `MAX_HP * 0.1` |
| HP | 当前生命 | 施法者 | `MISSING_HP / MAX_HP` |
| HP_PCT | 当前生命比例 0–1 | 施法者 | `HP_PCT < 0.5` |
| MISSING_HP | 已损失生命 = MAX_HP - HP | 施法者 | `MISSING_HP * 0.5` |
| TARGET_HP | 目标当前生命 | 目标 | `TARGET_HP` |
| TARGET_MAX_HP | 目标最大生命 | 目标 | `TARGET_MAX_HP` |
| TARGET_HP_PCT | 目标当前生命比例 0–1 | 目标 | `TARGET_HP_PCT < 0.3` |
| TARGET_DEF | 目标防御 | 目标 | `TARGET_DEF` |
| TARGET_RES | 目标抗性 | 目标 | `TARGET_RES` |
| STACKS | 当前状态层数 | 状态 | `ATK * STACKS` |
| CONSUMED_STACKS | 本次 consumeStatus 消费的层数 | 状态消费 | `ATK * CONSUMED_STACKS` |
| EVENT_DAMAGE | 事件中的原始伤害值 | 事件 | `EVENT_DAMAGE * 0.5` |
| EVENT_HP_DAMAGE | 事件中的 HP 伤害值 | 事件 | `EVENT_HP_DAMAGE` |
| EVENT_SHIELD_DAMAGE | 事件中的护盾伤害值 | 事件 | `EVENT_SHIELD_DAMAGE` |
| EVENT_WARD_DAMAGE | 事件中的护符伤害值 | 事件 | `EVENT_WARD_DAMAGE` |
| LAST_DAMAGE | 最近一次伤害值 | 事件/触发 | `LAST_DAMAGE * 0.2` |
| LAST_HP_DAMAGE | 最近一次 HP 伤害值 | 事件/触发 | `LAST_HP_DAMAGE` |
| LAST_SHIELD_DAMAGE | 最近一次护盾伤害值 | 事件/触发 | `LAST_SHIELD_DAMAGE` |
| LAST_WARD_DAMAGE | 最近一次护符伤害值 | 事件/触发 | `LAST_WARD_DAMAGE` |
| LAST_HIT | 是否最近一次命中（0/1） | 事件/触发 | `LAST_HIT ? ATK : 0` |
| LAST_CRIT | 是否最近一次暴击（0/1） | 事件/触发 | `LAST_CRIT ? ATK * 1.5 : ATK` |
| LAST_KILL | 是否最近一次击杀（0/1） | 事件/触发 | `LAST_KILL ? 1 : 0` |
| REPEAT_INDEX | repeat 循环的当前下标（0 起） | repeat | `REPEAT_INDEX` |
| MODIFIER_VALUE | modifier 的参数值（在 modifier 公式内可用） | modifier | `MODIFIER_VALUE * STACKS` |
| RAGE | 怒气资源当前量 | 资源 | `RAGE * 1` |
| ENERGY | 能量资源当前量 | 资源 | `ENERGY * 1` |
| SOUL | 魂力资源当前量 | 资源 | `SOUL * 1` |
| CHRONO | 时能资源当前量 | 资源 | `CHRONO * 1` |
| ROUND | 当前全局回合数（从 1 起） | 战斗 | `ATK * (1 + ROUND * 0.015)` |
| BATTLE_TURN | 当前行动轮次（与 ROUND 同义，可读） | 战斗 | `MAX_HP * max(0.4, 1 - BATTLE_TURN * 0.01)` |
| pi | 圆周率 π | 常量 | `pi` |
| e | 自然常数 e | 常量 | `e` |
| PI | 圆周率 π（大写） | 常量 | `PI` |
| E | 自然常数 e（大写） | 常量 | `E` |

## 8. 公式函数（Formula Functions）

| 函数 | 说明 |
|---|---|
| min | 取最小值：min(a,b,...) |
| max | 取最大值：max(a,b,...) |
| abs | 绝对值：abs(x) |
| floor | 向下取整：floor(x) |
| ceil | 向上取整：ceil(x) |
| round | 四舍五入：round(x, digits=0) |
| sqrt | 平方根：sqrt(x) |
| log | 自然对数：log(x) |
| log2 | 以 2 为底对数：log2(x) |
| log10 | 以 10 为底对数：log10(x) |
| exp | 指数：exp(x) |
| pow | 幂：pow(x,y) |
| sign | 符号：sign(x)（-1/0/1） |
| clamp | 钳制：clamp(value, min, max) |

## 9. 伤害类型（Damage Types）

| 类型 | 说明 |
|---|---|
| physical | 物理：使用 DEF 作为防御轴，对应护符类型 physical。 |
| arcane | 奥术：使用 RES 作为防御轴，对应护符类型 arcane。 |
| fire | 火焰：使用 RES 作为防御轴，对应护符类型 fire。 |
| frost | 冰霜：使用 RES 作为防御轴，对应护符类型 frost。 |
| lightning | 雷电：使用 RES 作为防御轴，对应护符类型 lightning。 |
| toxic | 剧毒：使用 RES 作为防御轴，对应护符类型 toxic。 |
| bleed | 流血：使用 DEF 作为防御轴，对应护符类型 bleed。 |
| true | 真实：无视防御轴与类型抗性（true damage）。 |

## 10. 战斗实时状态（Runtime State，非卡牌永久属性）

| 状态 | 说明 |
|---|---|
| current HP | 战斗实时生命（不是卡牌永久属性） |
| current resource | 战斗实时资源（ENERGY/RAGE/SOUL/CHRONO 等） |
| current shield | 战斗实时通用护盾 |
| wear | 战斗实时磨损（_wear 0–1），由 Battle Wear 累积 |
| current cooldown | 技能当前剩余冷却 |
| statuses | 实体当前状态实例（含层数/剩余时间） |
| energy | 实体当前能量 |
| alive | 实体是否存活 |

## 11. 计算链（Damage / Heal / Time / Randomness）

```text
ATK → Damage Formula → Accuracy/Hit → Variance(×VOLATILITY,LUCK) → Crit → Defense/PEN → Type Resistance → Ward → Shield → HP → Lifesteal/Triggers
Heal Formula → HEAL_POWER → HEAL_TAKEN → Battle Wear Heal Factor → Missing-HP Cap → Actual Healing
ROUND → RAMP / FATIGUE → Dynamic Stats
ROUND → Battle Wear → Healing reduction → Terminal pressure (max-HP decay)
battle seed → hit → variance → LUCK distribution → crit → other random effects (deterministic replay)
```
