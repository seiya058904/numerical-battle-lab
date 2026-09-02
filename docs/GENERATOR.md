# 卡牌稀有度 / 等级 / 随机数值生成 — Generator

本文件描述引擎内新加入的“卡牌生成器”子系统（`src/power.js`、`src/gen-stats.js`、
`src/gen-skills.js`、`src/generator.js`、`src/gen-names.js`、`src/gen-v2.js`、
`src/battlepower.js`、`src/gen-balance.js`）。它不是战斗引擎，而是
**在既有组件语言之上的一层预算分配层**：稀有度决定总实力预算，等级决定当前实力比例，
职业决定分配倾向，种子决定分配差异。生成结果是一张可编译、可上场的卡（unit + 3 个
skill + passives/statuses/triggers + PowerAudit）。

**v1.2 概览**：稀有度扩展到 12 档（C..XS 典藏版），新增 Generator v2
（Composition Grammar 技能组合、被动/触发预算真实消耗、确定性中文名称）与
战力评分 BattlePower（展示指标，不进入战斗结算）。Generator v1 保持逐字节冻结
（`generatorVersion:1` 复现 v1.1.0 卡）。

## 稀有度

v1 唯一排序（`NCB.RARITY_ORDER`）：`C < C+ < B < B+ < A < A+ < S < SS < SSS`。

v1.2 扩展排序（`NCB.RARITY_V2_ORDER`，旧 9 档 RPI 数值不变）：

`C < C+ < B < B+ < A < A+ < S < SS < SSS < SSS典藏 < XS < XS典藏`

`NCB.RARITY_RPI`（v1，未改动）与 `NCB.RARITY_V2_RPI`（v1.2 扩展）提供统一实力坐标系：

| 稀有度 | RPI | 相对 C |
|---|---:|---:|
| C   | 100 | 1.00x |
| C+  | 108 | 1.08x |
| B   | 118 | 1.18x |
| B+  | 129 | 1.29x |
| A   | 141 | 1.41x |
| A+  | 154 | 1.54x |
| S   | 169 | 1.69x |
| SS  | 187 | 1.87x |
| SSS | 207 | 2.07x |
| SSS 典藏版 | 218 | 2.18x |
| XS  | 232 | 2.32x |
| XS 典藏版 | 245 | 2.45x |

稀有度**不决定机制**（任何稀有度都能用暴击/吸血/多段/护盾/状态/Trigger/Sustain/多资源/
复合伤害/Target Query/任意公式），只决定**总战斗数值预算**。禁止 `if(rarity==='SSS')*=2`
这类直改伤害的代码；强度必须来自“可分配预算更多”。

## 等级（Level 1..100，全稀有度统一）

`NCB.levelFactor(level) = 0.40 + 0.60 * ((level-1)/99)^0.92`

Lv1=0.40, Lv50≈0.714, Lv100=1.00。禁止“C 只能升 50 / SSS 升 120”这类叠加稀有度优势的设计。

**等级是校验，不是钳制**：`NCB.normalizeLevel(level)`（`power.js`）要求严格整数 1..100。
只有 `opts.level === undefined` 才默认 100；`0 / -1 / 101 / 999 / 1.5 / NaN / Infinity /
"abc"` 等一律抛错（`level must be an integer in 1..100`），绝不静默钳制——否则元数据等级与
实际 `levelFactor` 数值会产生不一致的卡。

## 总实力

- `QualityFactor`：`NCB.qualityFactor(seed)` 由 seed 确定性生成，范围 `0.97..1.03`（±3%）。
- `CardPower = RPI * LevelFactor * QualityFactor`（`NCB.computeCardPower` / v1.2 `computeCardPowerV2`）。
- `NumericScale = sqrt(CardPower/100)`；`GenerationBudget = 1000 * NumericScale`（`NCB.generationBudget`，v1 公式）。
- **v1.2.1（v2-only）**：Generator v2 不再用解析式预算，而是
  `NCB.v2GenerationBudget({rarity,level,quality}) = 1000 * V2_BUDGET_CURVE[rarity] * sqrt(levelFactor*quality)`。
  `V2_BUDGET_CURVE` 是单调、确定性、数据驱动的 RPI→预算表（`src/gen-v2.js`），
  使真实相邻稀有度镜像胜率落在审计目标（普通 54-60%、典藏 52-57%），
  v1 的 `generationBudget` 公式未动。
- 例：C Lv100 => 预算 1000；XS 典藏 Lv100 => ~1645。高端核心数值约为 C 的 ~1.65 倍，
  剩余差距来自技能倍率/防御/状态/资源/Trigger 等共同产生。

## 预算分区（`NCB.POWER_RULES.budgetPartitions`，可调）

| 系统 | 占比 |
|---|---:|
| Primary Stats | 52% |
| Secondary Stats | 13% |
| Active Skill Budget | 25% |
| Passive/Trigger Budget | 10% |

`NCB.splitBudget(budget)` 按此拆分。

## Primary Stats（spec 9-10）

固定五个：`MAX_HP, ATK, DEF, RES, SPD`。BP->stat 使用注册表 `NCB.PRIMARY_CONVERSION`，
结构为 `BASE + BP * K`。**注意**：spec 例值（MAX_HP=600+BP*30 等）会产出比既有演示内容
高约 40 倍的数值、导致生成卡无法与内置单位同台对战，因此本仓库把该注册表校准到既有引擎
数值带（MAX_HP ~90-250、ATK ~40-100、DEF ~30-85、SPD ~55-95）。结构保持 `BASE+BP*K`，
改这里可整体重缩放生成卡强度。

**v1.2（Generator v2 only）**：v2 使用独立的 `V2_PRIMARY_CONVERSION`
（HP 增长更快、DEF/RES 增长更慢于攻击，见 `docs/GENERATOR-BALANCE-v1.2.md`），
通过 `allocatePrimary({conversion})` 覆盖，v1 不传该参数保持冻结。

## 职业 Archetype（`NCB.ARCHETYPES`，可 `registerArchetype`）

Balanced / Tank / Bruiser / Assassin / Mage / Support / Controller，权重和为 1，只决定预算
分配倾向。分配时每个属性乘以 `1 + U(-12%,+12%)` 抖动后重新归一化（`NCB.allocatePrimary`），
因此随机只改变“预算怎么分”，不改变“总预算是多少”。

## Secondary Stats（spec 13-16）

`NCB.SECONDARY_BASELINE`（ACC=88,EVA=3,CRIT=5,CRIT_DMG=140,...）、`NCB.SECONDARY_COST`
（每 +1% 的 BP 成本：ACC2/EVA4/CRIT3/CRIT_DMG1/PEN2.5/...）、`NCB.SECONDARY_BOUNDS`
（ACC 50-99、EVA 0-40、CRIT 0-60、CRIT_DMG 125-250、PEN 0-60、LIFESTEAL 0-50、REFLECT 0-40...）。
`NCB.allocateSecondary({budget,seed})` 用 seeded 贪心购买 +1% 增量直到预算耗尽，始终落在
硬边界内。随机生成器不是随机数值，而是“随机决定把有限预算花在哪里”。

## 技能也是预算组件（spec 17-23）

### Generator v1（冻结）

- 每张标准卡固定 **3 个主动 Skill**（30% / 30% / 40% 预算，第三个可作 Ultimate），
  稀有度不决定技能数量。
- `NCB.SKILL_RECIPES`：有限可装配技能套件（单体/横扫/连击/穿刺/火矢/灼烧/治疗/屏障/
  虚弱/易伤/坚守/迅捷），每个 recipe 只是数据程序，指向既有 `EFFECT_COMPONENTS`。
- 统一强度曲线：`RealSkillCost = RawEffectPower * TargetFactor * ReliabilityFactor *
  FrequencyFactor * TempoFactor * PenetrationFactor`（`NCB.refSkillCost`）。

### Generator v2（v1.2，默认）

- **Composition Grammar**（`src/gen-v2.js`）：技能由 主效果 + 副效果 + 目标 + 条件 +
  成本 + 冷却 + 命中 + 伤害类型 + 标签 组合而成，替换 v1 的 13 条硬编码配方。
  `GRAMMAR_PRIMARY`（14 种主效果）与 `GRAMMAR_SECONDARY`（10 种副效果）都是数据。
- **技能组合约束**：每套 3 技能保证 ≥2 伤害核心、至多 1 治疗 / 1 护盾 / 1 纯状态、
  sustain 合计 ≤1（防秒杀/僵局套件，见 `docs/GENERATOR-BALANCE-v1.2.md`）。
- **治疗/护盾按有效持续价值计价**：`V2_SUSTAIN_POWER_SCALE=720`（治疗与伤害不同价）。
- **被动/Trigger 预算真实消耗**：`generatePassivesAndTriggers` 生成 1-2 个被动/触发，
  `powerAudit` 的 passive bucket `spent > 0`；触发只放 bounded 事件（`afterKill`）的伤害，
  反复事件（roundStart/roundEnd/afterDamageTaken/afterDamageDealt）只放护盾/治疗/状态/资源。
- **确定性中文名称**：`NCB.generateDisplayName({seed,archetype,rarity,level})`
  （`src/gen-names.js`）从字根池数据驱动生成；编辑 `displayName` 不改变卡 ID/身份。

## 生成流程（spec 27-29）

`NCB.generateCardByVersion({rarity, level, archetype, seed, tags?, generatorVersion?})`
完整执行（version 1 → v1 精确复现；version 2 / 缺省 → v2）：

`rarity -> RPI -> LevelFactor -> QualityFactor -> CardPower -> GenerationBudget -> split
-> archetype weights -> seeded jitter -> normalize -> cost convert -> compose/recipe ->
budget scale -> compile -> PowerAudit`（Monte Carlo 校准在 `scripts/power-calibration.js`）。

- **Seeded Random**：一律使用 `Gen5PRNG`（内核已有、确定性、离线），禁止 `Math.random`。
  相同 `seed+rarity+level+archetype+generatorVersion` 永远生成同一张卡。
- **Generator Version**：`NCB.CARD_GENERATOR_VERSION = 1`（v1 冻结）、
  `NCB.CARD_GENERATOR_VERSION_V2 = 2`（v1.2 默认）。旧卡记录自己生成时的版本。
  传入不支持的版本（如 `999`）直接**抛错拒绝**，绝不静默产出 v1 卡却标注 v999。

## 生成身份（Card Identity）

卡 ID 与技能 ID 前缀**不是只 hash seed**——否则同一 seed 不同稀有度/等级/职业会撞 ID。

- `NCB.canonicalGenerationIdentity(opts)`（v1）/ `canonicalGenerationIdentityV2(opts)`（v2）
  → 稳定字符串：`v1|seed=..|rarity=..|level=..|archetype=..`（tags 存在时追加 `|tags=..`，
  tags 先排序）。等级经 `normalizeLevel` 校验，版本必须匹配。
- `NCB.cardId(identity)` = `'gen_' + hash8(identity)`。
- 保证：相同完整元组 → 相同卡 + 相同 ID；稀有度/等级/职业/版本任一不同 → ID 不同。
- 生成卡的 skill 定义也以同一身份派生，不同卡之间技能 ID 不会碰撞，`deployCard`
  可同种子不同稀有度共存（先部署的卡不被覆盖）。

## Card Numeric Schema（spec 30）

```text
id  seed  generatorVersion  rarity  level  quality  archetype
powerIndex  generationBudget
stats  resources  resistances  tags
skills[]  passives[]  statuses[]  triggers[]
name/displayName
```

Skills 只保存程序组件，不保存角色专属 JS。

## PowerAudit（spec 31）

`card.powerAudit` 记录：`totalBudget`、各 bucket 的 `allocated/spent`
（primary / secondary / skills / passive）以及 `unspent`。让人类和 AI 都能回答
“为什么这张卡这么强”，而不是只看到一堆最终数字。

## 战力评分 BattlePower（v1.2.1，1v1 通用强度排序指标）

`NCB.battlePower(card)`（`src/battlepower.js`）用几何聚合计算：

```text
PowerRatio = exp(Σ weight[i] * ln(SubScore[i] / Reference[i]))
BattlePower = round(10000 * PowerRatio)
```

- **口径（v1.2.1）**：BattlePower 是 **1v1 通用强度排序指标**，不是任意 matchup 的
  精确胜率；普通 UI 不显示精确百分比，用 `战力较高 / 战力接近 / 战力较低`
  （`card-ui.bpRelation`）或仅显示战力数字。
- **3 主评分维度 + 4 诊断维度**：进攻（engine 多回合有效伤害 + ATK 下限）、
  生存（有效生命 HP+DEF/RES）、节奏（速度）为**主评分**；续航（治疗+护盾）、
  功能（状态效用）、经济（资源）、稳定（命中率）为**诊断维度**（仍计算并显示，
  当前 ~0 权重）。
- 权重来源：`scripts/power-calibration.js` 的 `fitBattlePowerWeights()` 在 **TRAIN**
  上自动拟合；VALIDATION 按 Spearman + similar-BP fairness 选模型；FINAL_TEST 只跑一次。
  发布权重 `{offense 0.22, durability 0.45, tempo 0.25, ...}`（shipped `src/battlepower.js`）。
- **BattlePower 是展示指标**：只读最终卡数据，永不进入战斗结算，不把稀有度当伤害倍率；
  相同最终数据（即使稀有度/等级标签不同）→ 相同战力。

## 使用示例（Node 或浏览器控制台）

```js
const card = NCB.generateCardByVersion({rarity:'A', level:80, archetype:'Assassin', seed:'my-seed-1'});
const bp = NCB.battlePower(card).power;                 // 展示战力
const pack = NCB.assembleCardPackV2(card);              // {units, skills, statuses}
const ok = NCB.validateContentPack(pack).ok;            // 编译门禁
NCB.deployCardV2(card);                                 // 注册进 NCB.UNIT_DEFS/SKILL_DEFS
const battle = NCB.createBattle({seed:'gen5,1,2,3,4', teamA:[card.id], teamB:['vanguard']});
```

## 参考线（spec 3，非硬性）

`NCB.expectedWinRate(powerA, powerB)`（Elo 型展示估算，`src/battlepower.js`）用于 UI 预估胜率。
`npm run gen-mc` 输出生成卡对局的真实胜率与参考线的对比，供后续校准。
