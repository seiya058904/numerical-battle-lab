# 卡牌稀有度 / 等级 / 随机数值生成 — Generator

本文件描述引擎内新加入的“卡牌生成器”子系统（`src/power.js`、`src/gen-stats.js`、
`src/gen-skills.js`、`src/generator.js`、`src/gen-balance.js`）。它不是战斗引擎，而是
**在既有组件语言之上的一层预算分配层**：稀有度决定总实力预算，等级决定当前实力比例，
职业决定分配倾向，种子决定分配差异。生成结果是一张可编译、可上场的卡（unit + 3 个
skill + passives/statuses/triggers + PowerAudit）。

## 稀有度

唯一排序（`NCB.RARITY_ORDER`）：

`C < C+ < B < B+ < A < A+ < S < SS < SSS`

`NCB.RARITY_RPI` 提供统一实力坐标系（spec 1 / 33）：

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
- `CardPower = RPI * LevelFactor * QualityFactor`（`NCB.computeCardPower`）。
- `NumericScale = sqrt(CardPower/100)`；`GenerationBudget = 1000 * NumericScale`（`NCB.generationBudget`）。
- 例：C Lv100 => 预算 1000；SSS Lv100 => ~1439。SSS 核心数值约为 C 的 sqrt(2.07)≈1.44 倍，
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

- 每张标准卡固定 **3 个主动 Skill**（30% / 30% / 40% 预算，第三个可作 Ultimate），
  稀有度不决定技能数量。
- `NCB.SKILL_RECIPES`：有限可装配技能套件（单体/横扫/连击/穿刺/火矢/灼烧/治疗/屏障/
  虚弱/易伤/坚守/迅捷），每个 recipe 只是数据程序，指向既有 `EFFECT_COMPONENTS`。
- 统一强度曲线：`RealSkillCost = RawEffectPower * TargetFactor * ReliabilityFactor *
  FrequencyFactor * TempoFactor * PenetrationFactor`（`NCB.refSkillCost`）。
  - TargetFactor：self 0.85 / single 1 / 2-6 targets 1.55-3.05（`NCB.SKILL_FACTORS.targetMulti`）。
    **self 0.85 真正进入成本**：`targetCount === 0`（self）按 nullish 默认处理为 1 再查表，
    不会把 0 强转成 1 导致 self 折扣丢失。
  - ReliabilityFactor = accuracy（100%=1, 95%=0.95, 90%=0.90, 80%=0.80, 70%=0.70, 50%=0.50 下限）。
  - FrequencyFactor = cooldown（CD0=1, CD1=0.82, CD2=0.68, CD3=0.57, CD4=0.49）。
  - TempoFactor = 1.05^priority（priority 高有溢价，低有折扣）。
  - PenetrationFactor = `1 + max(0,p)/100*0.5`（p = recipe 的 `penetrationBonus`）。
- `NCB.skillCoefficient(budget, recipe)` 反解出公式系数（`ATK * c` / `MAX_HP * c`），
  使该技能的参考成本贴合分配给它的预算。
- **穿透是显式成本**：recipe 统一用 `penetrationBonus` 字段（无 `penBonus` 别名）；生成卡
  的 skill 定义会携带该字段，引擎 `skillPenetration` 才会真正生效。穿透越高 → 参考成本越
  高 → 同预算下系数越低，预算不会被“免费”膨胀。

## 生成流程（spec 27-29）

`NCB.generateCard({rarity, level, archetype, seed, tags?})` 完整执行：

`rarity -> RPI -> LevelFactor -> QualityFactor -> CardPower -> GenerationBudget -> split
-> archetype weights -> seeded jitter -> normalize -> cost convert -> recipe pick ->
budget scale -> compile -> PowerAudit`（Monte Carlo 校准在 `scripts/gen-mc.js`）。

- **Seeded Random**：一律使用 `Gen5PRNG`（内核已有、确定性、离线），禁止 `Math.random`。
  相同 `seed+rarity+level+archetype+generatorVersion` 永远生成同一张卡。
- **Generator Version**：`NCB.CARD_GENERATOR_VERSION = 1`；旧卡记录自己生成时的版本，
  未来改 Cost Table / 预算 / 曲线时升到 VERSION 2，旧 Seed 不会突然变成另一张卡。
  传入不支持的版本（如 `999`）直接**抛错拒绝**，绝不静默产出 v1 卡却标注 v999。

## 生成身份（Card Identity）

卡 ID 与技能 ID 前缀**不是只 hash seed**——否则同一 seed 不同稀有度/等级/职业会撞 ID。

- `NCB.canonicalGenerationIdentity(opts)` → 稳定字符串：
  `v1|seed=..|rarity=..|level=..|archetype=..`（tags 存在时追加 `|tags=..`，tags 先排序）。
  等级经 `normalizeLevel` 校验，版本必须为 1。
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
```

Skills 只保存程序组件，不保存角色专属 JS。

## PowerAudit（spec 31）

`card.powerAudit` 记录：`totalBudget`、各 bucket 的 `allocated/spent`
（primary / secondary / skills / passive）以及 `unspent`。让人类和 AI 都能回答
“为什么这张卡这么强”，而不是只看到一堆最终数字。

## 使用示例（Node 或浏览器控制台）

```js
const card = NCB.generateCard({rarity:'A', level:80, archetype:'Assassin', seed:'my-seed-1'});
const pack = NCB.assembleCardPack(card);          // {units, skills, statuses}
const ok = NCB.validateContentPack(pack).ok;       // 编译门禁
NCB.deployCard(card);                              // 注册进 NCB.UNIT_DEFS/SKILL_DEFS
const battle = NCB.createBattle({seed:'gen5,1,2,3,4', teamA:[card.id], teamB:['vanguard']});
```

## 参考线（spec 3，非硬性）

`ExpectedWin(A,B) = PA^3/(PA^3+PB^3)`（`NCB.expectedWinRate`）。SSS vs C ≈ 90%；
A 对 C 约 74%（spec 文字写 ~78-82%，实际按公式为 ~73.7% —— 公式是权威定义，文字是参考线）。
`npm run gen-mc` 输出生成卡对局的真实胜率与参考线的对比，供后续校准。
