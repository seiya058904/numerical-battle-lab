# 数值组件目录 / Numeric Component Catalog

这不是角色技能表，而是整个战斗系统的“积木盒”。角色、技能、状态只允许组合这些通用积木和参数；新增普通内容不应要求修改 BattleEngine。

当前固定能力面：**91 个参数旋钮 / 18 个 Effect 组件 / 27 个 Condition 组件 / 8 个 Target 组件 / 28 个 Event 插入点 / 8 个 Damage Type**。

当前内容只是示例组合：20 个实体、63 个技能、33 个状态。理论组合空间远大于这些示例。

## 设计原则

1. **角色不是代码。** 角色只提供基础 Stat、资源、技能 ID、被动组件和 Trigger 数据。
2. **技能不是函数。** 技能由 Target + Cost + Requirement + Effect[] + Formula 组合。
3. **数值不是硬编码逻辑。** 伤害、治疗、护盾、DoT、资源转换都使用公式和参数。
4. **插件只扩原语。** 只有出现全新规则原语时才注册新 Damage Type / Effect / Condition / Target / Event；普通新卡不改引擎。
5. **同一语义只实现一次。** 例如穿透、暴击、命中、状态层数都只有一个 canonical pipeline。

## 成熟项目给我们的参照

- **Pokémon Showdown**：不是靠几百个独立公式，而是 6 个基础 Stat + Move 参数（basePower、accuracy、priority、critRatio、multihit、recoil、drain 等）+ 大量 Event modifier 插入点组合出海量机制。我们的 Event/Queue/RNG 思路以它为主要成熟参考。
- **Cataclysm-DDA**：一次攻击是多个 damage unit 的集合，每个分量独立拥有类型、穿透、倍率；对应本项目 damageComponents。
- **Wesnoth**：weapon special 可以修改 damage、attacks、chance_to_hit 等攻击参数；对应本项目 Event Modifier。
- **ToME 风格 RPG**：多资源、持续技能、抗性/穿透、维持费用与资源转换；对应 Resource/Sustain/Resistance 组件。
- **Freeciv / Unciv**：Effect 与 Requirement 数据化组合；对应 Condition tree + Effect DSL。

## 实体基础

| ID | 名称 | 类型 | 单位 | 默认 | 建议范围 | 人类说明 | AI/数值含义 |
|---|---|---|---|---:|---|---|---|
| `MAX_HP` | 最大生命 | number | HP | 120 | 20–10000 | 决定实体可承受的总生命伤害。 | 提高生存时间并放大基于 MAX_HP 的治疗、护盾和伤害公式。 |
| `ATK` | 攻击强度 | number | point | 70 | 0–1000 | 多数伤害公式的主要进攻输入。 | 提高所有引用 ATK 的公式结果。 |
| `DEF` | 物理防御 | number | point | 50 | 0–1000 | 降低使用 DEF 防御轴的伤害。 | 提高对 physical/bleed 等物理轴伤害的有效减伤。 |
| `RES` | 法术抗性 | number | point | 50 | 0–1000 | 降低使用 RES 防御轴的元素/奥术伤害。 | 提高对 arcane/fire/frost/lightning/toxic 的有效减伤。 |
| `SPD` | 速度 | number | point | 70 | 0–1000 | 同优先级下决定行动先后。 | 提高队列中的 speed 排序值。 |
| `ACC` | 命中 | number | point | 100 | 0–500 | 提高技能命中概率。 | 进入 ACC 对 EVA 的命中公式。 |
| `EVA` | 闪避 | number | point | 5 | 0–500 | 降低敌方可被闪避技能的命中率。 | 作为命中公式的防守输入。 |
| `CRIT` | 暴击率 | number | % | 10 | 0–80 | 增加可暴击伤害段的暴击概率。 | 与技能 critBonus 和 ModifyCritChance 叠加。 |
| `CRIT_DMG` | 暴击倍率 | number | % | 160 | 100–500 | 决定暴击时伤害倍率。 | CRIT 触发后将伤害公式结果乘以此倍率。 |
| `PEN` | 通用穿透 | number | % | 10 | 0–95 | 按比例忽略 DEF/RES。 | 与技能 penetrationBonus 合并后减少有效防御。 |
| `LIFESTEAL` | 吸血 | number | % | 0 | 0–100 | 按造成的 HP 伤害回复施法者。 | 根据实际 HP_DAMAGE 回收生命。 |
| `HEAL_POWER` | 治疗强度 | number | % | 100 | 0–500 | 放大自身施放的治疗。 | 治疗公式结果乘以 HEAL_POWER/100。 |
| `HEAL_TAKEN` | 受疗倍率 | number | % | 100 | 0–500 | 控制收到治疗的倍率。 | 治疗结算乘以 HEAL_TAKEN/100。 |

## 资源

| ID | 名称 | 类型 | 单位 | 默认 | 建议范围 | 人类说明 | AI/数值含义 |
|---|---|---|---|---:|---|---|---|
| `ENERGY_MAX` | 能量上限 | number | point | 5 | 0–100 | 标准技能资源池上限。 | 限制 ENERGY 可存储的最大值。 |
| `ENERGY_REGEN` | 能量回复 | number | point/round | 2 | 0–100 | 每回合恢复标准能量。 | 回合开始增加 ENERGY。 |
| `RESOURCE_MAX` | 自定义资源上限 | number | point | 5 | 0–1000 | 任意资源 X 通过 X_MAX 定义上限。 | 允许 SOUL/RAGE/CHRONO 等无需改引擎。 |
| `RESOURCE_REGEN` | 自定义资源回复 | number | point/round | 0 | 0–100 | 任意资源每回合的自然回复。 | 由 resourceRegens 数据驱动。 |
| `CONVERT_RATIO` | 资源转换率 | number | ratio | 1 | 0–100 | 一种资源转为另一种资源的比例。 | convertResource 先扣 from 再按 ratio 增加 to。 |

## 技能

| ID | 名称 | 类型 | 单位 | 默认 | 建议范围 | 人类说明 | AI/数值含义 |
|---|---|---|---|---:|---|---|---|
| `BASE_FORMULA` | 基础公式 | formula | expression | ATK * 1.0 | safe expression | 技能数值的主公式。 | 在只读 scope 中计算基础伤害/治疗/护盾值。 |
| `FORMULA_MULTIPLIER` | 公式倍率 | number | × | 1 | 0–20 | 在单个 damage component 上额外乘算。 | 用于同一公式生成不同分量。 |
| `DAMAGE_TYPE` | 伤害类型 | enum | type | physical | registered type | 决定使用哪条防御轴、抗性、护符和亲和。 | 查 DAMAGE_TYPES 注册表。 |
| `SKILL_ACCURACY` | 技能基础命中 | number | ratio | 1 | 0.05–1.5 | 技能自身命中系数。 | 与 ACC/EVA 和 ModifyAccuracy 共同决定最终命中率。 |
| `PRIORITY` | 行动优先级 | number | tier | 0 | -10–10 | 高于速度的行动顺序层。 | 队列先按 priority 再按 SPD。 |
| `COOLDOWN` | 冷却 | number | round | 0 | 0–20 | 技能再次使用前等待回合数。 | 使用后写入 cooldown 状态。 |
| `RESOURCE_COST` | 资源费用 | number | point | 1 | 0–1000 | 技能消耗任意资源。 | 所有成本先验证再原子支付。 |
| `HP_COST` | 生命费用 | number | HP | 0 | 0–MAX_HP | 把生命作为施法成本。 | 默认不可支付致死成本，除非 allowLethal。 |
| `HITS` | 攻击段数 | number | hit | 1 | 1–32 | 同一伤害效果重复结算的段数。 | 每段独立命中/暴击/伤害/触发。 |
| `CRIT_BONUS` | 技能暴击加成 | number | % | 0 | -100–100 | 只影响当前技能的暴击概率。 | 叠加到角色 CRIT 再经过 ModifyCritChance。 |
| `PENETRATION_BONUS` | 技能穿透加成 | number | % | 0 | -95–95 | 只影响当前技能的防御穿透。 | 叠加到 PEN 再进入 ModifyPenetration。 |
| `TYPE_PENETRATION` | 类型穿透 | number | ratio | 0 | 0–1 | 忽略目标对应伤害类型的一部分抗性。 | 在类型抗性阶段扣减 resistance。 |
| `CAN_CRIT` | 允许暴击 | boolean | bool | true | true/false | 决定伤害段能否暴击。 | false 时直接跳过暴击随机。 |
| `CAN_MISS` | 允许未命中 | boolean | bool | true | true/false | 决定是否执行命中判定。 | false 时命中率强制为 100%。 |
| `CAN_REFLECT` | 允许反射 | boolean | bool | true | true/false | 决定该伤害是否可触发反伤链。 | 防止反射伤害再次反射形成死循环。 |
| `SECONDARY_CHANCE` | 附加效果概率 | number | ratio | 1 | 0–1 | 控制状态/次级效果触发概率。 | PRNG 判定后决定是否执行子效果。 |
| `TARGET_MODE` | 目标模式 | enum | target | enemy | registered target | 决定技能可选目标集合。 | 由 Target 组件产生合法目标。 |
| `TARGET_REQUIREMENT` | 目标条件 | condition | rule |  | condition tree | 进一步过滤合法目标。 | 使用 Condition 插件树进行筛选。 |
| `REQUIREMENT` | 施放条件 | condition | rule |  | condition tree | 控制技能是否进入 LegalActions。 | AI 与 UI 共用同一条件。 |
| `RECOIL_RATIO` | 反噬倍率 | number | ratio | 0 | 0–1 | 按生命或伤害产生自伤成本。 | 可由通用 selfDamage/resource effect 组合。 |
| `DRAIN_RATIO` | 汲取倍率 | number | ratio | 0 | 0–1 | 把本技能实际造成的 HP 伤害按比例转为施法者治疗。 | 伤害效果结算后读取 committed HP damage，使用统一治疗管线。 |
| `DAMAGE_VARIANCE_MIN` | 随机伤害下限 | number | × | 1 | 0–5 | 每个伤害分量在暴击前乘上的确定性随机倍率下限。 | 与 DAMAGE_VARIANCE_MAX 之间使用 canonical PRNG 抽样。 |
| `DAMAGE_VARIANCE_MAX` | 随机伤害上限 | number | × | 1 | 0–5 | 每个伤害分量的随机倍率上限。 | 与下限共同决定均匀随机区间，Replay 可精确复现。 |
| `IGNORE_DEFENSE` | 忽略防御 | boolean | bool | false | true/false | 让对应 Damage Component 跳过 DEF/RES 等防御轴。 | 把 defenseStat 视为 none，但仍可经过类型抗性和承伤事件。 |
| `IGNORE_RESISTANCE` | 忽略类型抗性 | boolean | bool | false | true/false | 让对应 Damage Component 跳过目标类型抗性。 | resistance 阶段强制为 0，但仍可经过防御轴。 |
| `IGNORE_EVASION` | 忽略闪避 | boolean | bool | false | true/false | 命中公式忽略目标 EVA。 | Accuracy 仍然生效，但 target EVA 当作 0。 |
| `DEFENSE_STAT` | 防御属性选择 | enum | stat | type default | DEF/RES/none/custom | 指定该伤害分量使用哪个目标 Stat 作为防御轴。 | Damage Component 可覆盖 Damage Type 的默认 defenseStat。 |
| `MIN_DAMAGE` | 最小伤害钳制 | number | HP |  | >=0 / none | 给单个伤害分量设置结算前的最低伤害。 | 防御/抗性后对 finalDamage 执行下限 clamp。 |
| `MAX_DAMAGE` | 最大伤害钳制 | number | HP |  | >=0 / none | 给单个伤害分量设置结算前的最高伤害。 | 防御/抗性后对 finalDamage 执行上限 clamp。 |
| `SPREAD_MULTIPLIER` | 群体伤害倍率 | number | × | 1 | 0–2 | 群攻时统一调节每个目标伤害。 | 作用于每个 damage component 的基础结果。 |

## 目标查询

| ID | 名称 | 类型 | 单位 | 默认 | 建议范围 | 人类说明 | AI/数值含义 |
|---|---|---|---|---:|---|---|---|
| `TARGET_RELATION` | 目标关系 | enum | relation | enemy | self/ally/enemy/any | 定义候选目标与施法者的关系。 | Query Target 的第一层候选集。 |
| `TARGET_FILTER` | 目标过滤条件 | condition | rule |  | condition tree | 使用通用 Condition 树筛选候选目标。 | 与技能/AI 共用同一 predicate registry。 |
| `TARGET_SORT` | 目标排序 | enum | sort | hpPct | hpPct/hp/maxHp/shield/stat/resource | 决定自动目标的排序依据。 | Query Target 对候选集做稳定排序。 |
| `TARGET_ORDER` | 目标排序方向 | enum | order | asc | asc/desc | 控制目标排序升序或降序。 | 与 TARGET_SORT 一起决定自动优先目标。 |
| `TARGET_LIMIT` | 目标数量上限 | number | entity | 1 | 0–99 | 限制查询结果最多保留多少目标。 | 排序/过滤后截取前 N 个。 |
| `TARGET_SELECTION` | 目标选择模式 | enum | mode | choose | choose/first/all | 决定查询结果由玩家选一个、自动取第一或全部应用。 | 影响 LegalActions 与效果展开方式。 |

## 防御

| ID | 名称 | 类型 | 单位 | 默认 | 建议范围 | 人类说明 | AI/数值含义 |
|---|---|---|---|---:|---|---|---|
| `SHIELD_AMOUNT` | 通用屏障量 | formula | HP | MAX_HP * 0.1 | >=0 | 所有类型伤害前的通用吸收层。 | 先消耗 shield 再写入 HP。 |
| `WARD_AMOUNT` | 类型护符量 | formula | HP | MAX_HP * 0.1 | >=0 | 只吸收指定 damage type。 | 匹配类型时在通用 shield 前结算。 |
| `RESISTANCE` | 类型抗性 | number | ratio | 0 | -0.75–0.85 | 按伤害类型降低或放大最终伤害。 | 类型阶段乘以 (1-resistance)。 |
| `AFFINITY` | 类型亲和 | number | ratio | 0 | 0–1 | 受到匹配类型 HP 伤害后恢复一部分生命。 | 基于实际 hpDamage 产生恢复。 |
| `IMMUNITY` | 状态免疫 | number | ratio | 0 | 0–1 | 按状态标签抵抗施加。 | 状态应用前进行 deterministic PRNG 判定。 |

## 状态

| ID | 名称 | 类型 | 单位 | 默认 | 建议范围 | 人类说明 | AI/数值含义 |
|---|---|---|---|---:|---|---|---|
| `STATUS_CHANCE` | 状态施加率 | number | ratio | 1 | 0–1 | 技能附加 Status 的成功概率。 | 先经过 chance，再经过目标 immunity。 |
| `STATUS_DURATION` | 持续时间 | number | round | 2 | 1–99 / ∞ | 状态保留回合数。 | 每轮生命周期递减；null 表示 sustain/permanent。 |
| `STATUS_STACKS` | 施加层数 | number | stack | 1 | 1–99 | 一次施加增加/设置的层数。 | 由 stacking policy 与 maxStacks 解释。 |
| `MAX_STACKS` | 最大层数 | number | stack | 1 | 1–999 | 状态最多可积累层数。 | 应用前 clamp。 |
| `STACKING_POLICY` | 叠层策略 | enum | policy | stack | stack/refresh/replace | 决定重复施加如何处理。 | stack 增层；refresh 刷新时间；replace 覆盖实例。 |
| `STAT_ADD` | 属性加值 | number | point | 0 | any | 对任意 Stat 添加固定值。 | 固定 aggregation band 的 Add 层。 |
| `STAT_MULTIPLIER` | 属性倍率 | number | × | 1 | 0–10 | 对任意 Stat 乘算。 | 在 Add 层之后进入 Multiply 层。 |
| `RESISTANCE_MOD` | 抗性修正 | number | ratio | 0 | -1–1 | 临时改变某类型或全部抗性。 | 进入 resistance modifier band。 |

## 事件

| ID | 名称 | 类型 | 单位 | 默认 | 建议范围 | 人类说明 | AI/数值含义 |
|---|---|---|---|---:|---|---|---|
| `DAMAGE_DEALT_MULT` | 输出倍率 | number | × | 1 | 0–10 | 修改最终输出伤害。 | ModifyDamageDealt relay-event。 |
| `DAMAGE_TAKEN_MULT` | 承伤倍率 | number | × | 1 | 0–10 | 修改目标最终收到的伤害。 | ModifyDamageTaken relay-event。 |
| `ACCURACY_MOD` | 命中修正 | number | add/mul/set | 0 | component op | 临时修改技能基础命中。 | ModifyAccuracy event modifier。 |
| `HITS_MOD` | 段数修正 | number | add/set | 0 | 1–32 | 临时改变技能攻击次数。 | ModifyHits event modifier。 |
| `CRIT_CHANCE_MOD` | 暴击修正 | number | % | 0 | component op | 临时改变技能暴击率。 | ModifyCritChance event modifier。 |
| `PENETRATION_MOD` | 穿透修正 | number | % | 0 | component op | 临时改变技能穿透。 | ModifyPenetration event modifier。 |
| `EVENT_PRIORITY` | 事件优先级 | number | tier | 0 | integer | 决定多个同类 Modifier 的结算顺序。 | EventKernel 按 priority/order/id 稳定排序。 |
| `HEAL_DEALT_MULT` | 治疗输出事件倍率 | number | × | 1 | 0–10 | 在治疗公式和治疗强度之后进一步修改施法者产生的治疗。 | ModifyHealDealt relay-event，可按技能标签或状态条件生效。 |
| `HEAL_TAKEN_EVENT_MULT` | 受疗事件倍率 | number | × | 1 | 0–10 | 在目标受疗属性之外进一步修改本次收到的治疗。 | ModifyHealTaken relay-event。 |
| `RESOURCE_COST_MOD` | 资源费用修正 | number | add/mul/set | 1 | component op | 修改某类技能资源费用。 | ModifyResourceCost relay-event，data.resource 提供资源类型。 |
| `RESOURCE_GAIN_MOD` | 资源获得修正 | number | add/mul/set | 1 | component op | 修改资源回复与效果产生的资源量。 | ModifyResourceGain relay-event。 |
| `COOLDOWN_MOD` | 冷却修正 | number | round | 0 | component op | 修改技能使用后写入的冷却。 | ModifyCooldown relay-event。 |
| `SHIELD_MOD` | 屏障获得修正 | number | × | 1 | component op | 修改本次获得的通用屏障量。 | ModifyShield relay-event。 |
| `WARD_MOD` | 类型护符获得修正 | number | × | 1 | component op | 修改本次获得的类型护符量。 | ModifyWard relay-event，data.damageType 提供类型。 |
| `RESISTANCE_EVENT_MOD` | 抗性事件修正 | number | ratio | 0 | component op | 在基础抗性与状态抗性带之后修正最终类型抗性。 | ModifyResistance relay-event。 |
| `PRIORITY_MOD` | 行动优先级修正 | number | tier | 0 | component op | 临时修改技能在队列中的优先级。 | ModifyPriority relay-event。 |

## 触发

| ID | 名称 | 类型 | 单位 | 默认 | 建议范围 | 人类说明 | AI/数值含义 |
|---|---|---|---|---:|---|---|---|
| `TRIGGER_CHANCE` | 触发概率 | number | ratio | 1 | 0–1 | 控制被动反应发生概率。 | 触发事件命中后通过 deterministic PRNG。 |
| `TRIGGER_LIMIT` | 触发链上限 | number | depth | 16 | 1–128 | 限制反射/反击等递归链深度。 | 超过上限后停止后续 proc。 |

## 周期效果

| ID | 名称 | 类型 | 单位 | 默认 | 建议范围 | 人类说明 | AI/数值含义 |
|---|---|---|---|---:|---|---|---|
| `PERIOD` | 周期间隔 | number | round | 1 | 1–99 | DoT/HoT 每隔多少回合触发。 | 周期调度器按 elapsed % period 执行。 |
| `SNAPSHOT_MODE` | 快照模式 | enum | mode | apply | apply/dynamic | 决定周期效果使用施加时还是每跳实时属性。 | apply 保存公式结果；dynamic 每跳重新计算。 |

## 持续技能

| ID | 名称 | 类型 | 单位 | 默认 | 建议范围 | 人类说明 | AI/数值含义 |
|---|---|---|---|---:|---|---|---|
| `UPKEEP_AMOUNT` | 维持费用 | number | resource/round | 0 | 0–1000 | Sustain 每回合支付的资源。 | 回合开始/结束检查；资源不足自动解除。 |

## 组合

| ID | 名称 | 类型 | 单位 | 默认 | 建议范围 | 人类说明 | AI/数值含义 |
|---|---|---|---|---:|---|---|---|
| `CONSUME_STACKS` | 状态消费量 | number | stack | 1 | 1–all | 从目标状态中消费层数。 | 写入 CONSUMED_STACKS 供后续公式读取。 |
| `REPEAT_TIMES` | 效果重复次数 | number | times | 1 | 0–32 | 重复执行一个效果块。 | repeat 组件逐次解析子效果。 |
| `CONDITION_BRANCH` | 条件分支 | condition | rule |  | condition tree | 依据通用条件选择 then/else 效果块。 | Condition 插件树决定分支。 |

## Effect 组件

- **damage / 伤害** — 执行命中→随机倍率→暴击→复合伤害包→防御/抗性→Ward/Shield/HP→汲取/反噬。 可配置字段：`formula`, `components`, `hits`, `accuracy`, `varianceMin`, `varianceMax`, `canCrit`, `canMiss`, `canReflect`, `ignoreDefense`, `ignoreResistance`, `ignoreEvasion`, `defenseStat`, `minDamage`, `maxDamage`, `drainRatio`, `recoilRatio`, `tags`。
- **heal / 治疗** — 根据公式产生治疗并应用治疗强度/受疗倍率。 可配置字段：`formula`。
- **shield / 屏障** — 增加通用伤害吸收层。 可配置字段：`formula`。
- **ward / 类型护符** — 增加指定伤害类型的专用吸收层。 可配置字段：`damageType`, `formula`, `amount`。
- **status / 状态** — 按概率/免疫规则施加可叠层状态。 可配置字段：`status`, `chance`, `duration`, `stacks`。
- **toggleStatus / 持续状态开关** — 在存在/不存在之间切换一个状态，用于 Sustain。 可配置字段：`status`, `duration`, `stacks`。
- **consumeStatus / 消费状态** — 消费指定状态层数并把数量写入后续公式上下文。 可配置字段：`status`, `stacks`。
- **cleanse / 净化** — 按标签移除负面状态。 可配置字段：`tags`, `count`。
- **dispel / 驱散/夺取** — 按类型和标签移除状态，可转移给施法者。 可配置字段：`kind`, `tags`, `count`, `transfer`。
- **resource / 资源变化** — 给目标增加或减少任意资源。 可配置字段：`resource`, `amount`, `resourceTarget`。
- **gain / 施法者资源变化** — 给施法者增加任意资源。 可配置字段：`resource`, `amount`。
- **energy / 能量变化** — 兼容旧内容的 ENERGY 资源变化组件。 可配置字段：`amount`。
- **convertResource / 资源转换** — 从一种资源扣除并按比例转化为另一资源。 可配置字段：`from`, `to`, `amount`, `ratio`, `resourceTarget`。
- **cooldownReduce / 冷却缩减** — 减少目标全部已存在冷却。 可配置字段：`amount`。
- **selfDamagePct / 百分比反噬** — 按施法者最大生命造成不可反射的自伤。 可配置字段：`pct`。
- **conditional / 条件分支** — 根据通用 Condition 树执行 then 或 else。 可配置字段：`condition`, `then`, `else`。
- **repeat / 重复块** — 重复执行子效果块。 可配置字段：`times`, `effects`。
- **emitEvent / 发射事件** — 发射一个已注册 Trigger Event，让状态/被动通过统一事件链响应。 可配置字段：`event`, `eventSubject`, `tags`, `payload`。

## Condition 组件

`hpPctAbove` · `hpPctBelow` · `targetHpPctAbove` · `targetHpPctBelow` · `hasStatus` · `missingStatus` · `targetHasStatus` · `targetMissingStatus` · `resourceAtLeast` · `targetResourceAtLeast` · `resourceIs` · `statusStacksAtLeast` · `targetStatusStacksAtLeast` · `sourceTag` · `targetTag` · `statusTag` · `targetStatusTag` · `consumedStacksAtLeast` · `lastHit` · `lastCrit` · `lastKill` · `dealtDamageAtLeast` · `dealtHpDamageAtLeast` · `tag` · `damageType` · `livingAlliesAtMost` · `livingEnemiesAtMost`

## Target 组件

- `self` — 选择自己作为效果目标。
- `ally` — 选择单个友方作为效果目标。
- `enemy` — 选择单个敌方作为效果目标。
- `all-allies` — 选择全体友方作为效果目标。
- `all-enemies` — 选择全体敌方作为效果目标。
- `random-ally` — 选择随机友方作为效果目标。
- `random-enemy` — 选择随机敌方作为效果目标。
- `query` — 选择目标查询作为效果目标。

## Event 插入点

- `ModifyStat` — 统一事件插入点：属性修正。
- `ModifyAccuracy` — 统一事件插入点：技能命中修正。
- `ModifyHits` — 统一事件插入点：攻击段数修正。
- `ModifyCritChance` — 统一事件插入点：暴击概率修正。
- `ModifyPenetration` — 统一事件插入点：防御穿透修正。
- `ModifyDamageDealt` — 统一事件插入点：输出伤害修正。
- `ModifyDamageTaken` — 统一事件插入点：承受伤害修正。
- `ModifyHealDealt` — 统一事件插入点：治疗输出修正。
- `ModifyHealTaken` — 统一事件插入点：治疗承受修正。
- `ModifyResourceCost` — 统一事件插入点：资源费用修正。
- `ModifyResourceGain` — 统一事件插入点：资源获得修正。
- `ModifyCooldown` — 统一事件插入点：冷却修正。
- `ModifyShield` — 统一事件插入点：屏障获得修正。
- `ModifyWard` — 统一事件插入点：类型护符获得修正。
- `ModifyResistance` — 统一事件插入点：最终抗性修正。
- `ModifyPriority` — 统一事件插入点：行动优先级修正。
- `EntityDefeated` — 统一事件插入点：实体击倒。
- `afterDamageTaken` — 标准 Trigger Event：受伤后。
- `afterDamageDealt` — 标准 Trigger Event：造成伤害后。
- `afterHealTaken` — 标准 Trigger Event：受到治疗后。
- `afterHealDealt` — 标准 Trigger Event：造成治疗后。
- `afterDefeated` — 标准 Trigger Event：被击倒后。
- `afterKill` — 标准 Trigger Event：击杀后。
- `afterStatusApplied` — 标准 Trigger Event：获得状态后。
- `afterStatusInflicted` — 标准 Trigger Event：施加状态后。
- `afterStatusRemoved` — 标准 Trigger Event：状态移除后。
- `roundStart` — 标准 Trigger Event：回合开始。
- `roundEnd` — 标准 Trigger Event：回合结束。

## 一张“卡 / 实体技能”到底能调什么？

普通技能通常只需要 6–12 个旋钮，例如：目标、费用、冷却、优先级、命中、伤害类型、公式、攻击段数、暴击加成、穿透、附加状态概率、状态持续时间。复杂技能可以再组合 Requirement、Condition、Repeat、多个 Damage Component、资源转换、状态消费、Trigger 等，但仍然只使用本目录的固定积木。

AI 工具应优先读取 `docs/numeric-component-catalog.json`，不要从角色 ID 猜规则。
