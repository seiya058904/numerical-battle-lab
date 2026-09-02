# 平衡审计报告 v1.2 (BALANCE-AUDIT-v1.2.md)

> 本报告回答 v1.2 规范第 23–24 节：对 Pokémon Showdown 的 MoveData 旋钮做
> 逐项审计（已有 / 值得补 / 不适合本项目），并说明 StatStage、TypeInteractionMatrix
> 与 Smogon damage-calc 单一事实源的对齐结论。另附 v1.2 数值生态实测（配合
> `docs/GENERATOR-BALANCE-v1.2.md`）。

---

## 1. Pokémon Showdown MoveData 旋钮审计

审计基准：Pokémon Showdown 技能/攻击数据面（basePower / accuracy / priority /
target / multihit / critRatio / drain / recoil / secondary / boosts /
offensive/defensive stat / ignoreDefense / ignoreAccuracy / evasiveness /
ignoreImmunity / flags）。

| MoveData 旋钮 | 本项目状态 | 说明 |
| --- | --- | --- |
| `basePower`（基础威力） | 已有 | 公式层 `formula` 系数 + `multiplier` + `spreadMultiplier` |
| `accuracy`（命中率） | 已有 | 技能 `accuracy` + 双方 `ACC`/`EVA` 结算，`expectedHitChance` |
| `priority`（先制度） | 已有 | 技能 `priority`，参与 `refSkillCost` Tempo 与回合排序 |
| `target`（目标） | 已有 | `TARGET_COMPONENTS`：self/ally/enemy/all/random/query |
| `multihit`（多段） | 已有 | 技能 `hits` + `skillHits` + 每段独立判定 |
| `critRatio`（暴击率） | 已有 | `CRIT` 属性 + `skillCritChance` + `critBonus` + `canCrit` |
| `drain`（吸血） | 已有 | `LIFESTEAL` / `drainRatio` 效果 |
| `recoil`（反噬） | 已有 | `recoilRatio` / `selfDamagePct` 效果 |
| `secondary`（副效果） | 已有 | 效果 `effects[]` 多段组合（状态/吸血/护盾等） |
| `boosts`（属性增减） | 部分 | 状态 Modifier 可增/减属性；v1.2 未用 Showdown 的 ±N 快速写法 |
| `offensive/defensive stat override` | 已有 | 伤害组件 `defenseStat`（DEF/RES/none）、`ignoreDefense` |
| `ignoreDefense` / `ignoreResistance` | 已有 | 技能/组件 `ignoreDefense` / `ignoreResistance` |
| `ignoreAccuracy`（无视命中率） | 部分 | `canMiss:false` 覆盖；v1.2 保留 |
| `evasiveness`（闪避） | 已有 | `EVA` + `ignoreEvasion` |
| `ignoreImmunity`（无视免疫） | 已有 | 伤害类型免疫/抗性结算 + `ignoreResistance` |
| `flags`（contact/sound/punch 等） | 已有 | `tags[]` 通用标签（strike/heavy/aoe/…），不绑定 Showdown 枚举 |
| `selfSwitch` / `forceSwitch`（换人） | 不适合本项目 | 本项目无“换人”概念；用 target query + 群体/随机目标替代 |
| `moveFlags` 全枚举 | 不适合本项目 | 标签系统已泛化，不复制特定枚举值 |
| `pp` / `ppMax`（技能次数） | 不适合本项目 | 本项目用资源/冷却，不用 PP |
| `sideConditions`（场地状态） | 值得补（可选） | 目前无场地层；如未来加，按数据化 registry 做 |
| `weather/terrain` | 不适合本项目 | 数值战斗实验室无环境系统 |
| `type effectiveness 图表` | 见 §3 | 本项目用数值抗性/亲和，不做硬编码克制表 |

**结论**：Showdown 的伤害/命中/暴击/多段/吸血/反噬/副效果/无视防御旋钮
均已在本项目以数据化形式存在（单一注册表，无角色专属分支）。
不值得为 v1.2 新增场地/换人/PP 类机制。

---

## 2. StatStage (-6..+6) 审计

**背景**：Showdown 用 `statStage`（-6..+6 快速增减属性）。本项目已有
`Modifier` 管线（`SET → ADD → MULTIPLY → CAP → FINAL`），技能/状态通过
Modifier 或状态 Modifier 实现属性增减。

**结论（spec 23）**：StatStage 作为**可选的注册表化标准增减语言**保留为
“值得补”项——它不替代 Modifier，而是给内容作者一个便捷的 ±N 层写法。
**v1.2 未引入**硬编码的 StatStage 结算，以避免与现有 Modifier 双轨漂移；
如未来实现，将作为 `MODIFIER_OPERATIONS` 之上的纯注册表抽象（`statStage` →
一组 `add` Modifier），不进 BattleEngine。

---

## 3. TypeInteractionMatrix 审计

**背景**：Showdown 的 `typeChart`（超能克格斗、火克草…）是固定属性克制表。

**结论（spec 23）**：本项目用**数值抗性/亲和**（`resistances` / `affinities` /
`immunities`，支持负数弱点与按伤害类型），是更连续、可数据化的替代；
不引入固定克制矩阵。v1.2 审计结论：**不增加 TypeInteractionMatrix**。
（当前生成卡 `resistances` 为空，未来内容作者可按类型注册抗性。）

---

## 4. Smogon damage-calc 单一事实源（spec 24）

**背景**：Smogon 的 damage calculator 是社区“预期伤害”基准。本项目要求
**实际伤害 / AI 预期伤害 / 战力评分预览 / UI 技能预估** 共用同一套引擎数学，
避免公式漂移。

**现状**：

- `expectedDamageUtility`（`src/engine.js`）是引擎自身的确定性期望值计算器，
  使用与实战完全相同的：公式求值器 + 命中率 + 暴击 + 穿透 + 防御减伤 +
  抗性 + 多段命中 + 资源成本。
- AI 决策（`planAI`）用 `skillScore` → `effectUtility` → `expectedDamageUtility`。
- 战力评分 `battlepower.js` 的 offense 子评分复用 `skillPerRoundByKind` →
  `NCB.effectUtility`，即**同一个**期望值计算器。
- UI 技能预估（`describeSkill`）给出中文人类描述（系数/目标/伤害类型），
  不另起一套伤害公式。

**结论**：实际伤害、AI 预期伤害、战力评分预览、UI 技能预估四者共享
`expectedDamageUtility` / `effectUtility` / `expectedHitChance`（Single Source
of Truth），无公式漂移。回归测试覆盖确定性复现（`qaSelfTest` 与
确定性测试）。

---

## 5. v1.2 数值生态实测摘要

配合 `docs/GENERATOR-BALANCE-v1.2.md`（完整表）：

| 指标 | 实测 | 目标 |
| --- | --- | --- |
| 第一回合秒杀率 | 0.0% | <5% ✓ |
| 僵局率 | 1.7% | <5% ✓ |
| 战斗时长中位数 | 8 回合 | 6–9 ✓ |
| BattlePower Validation Spearman | ~0.75–0.78 | ≥0.70 停止线 / ≥0.75 发布目标 ✓ |
| 相邻稀有度镜像 | 多数 54–62% | 54–60%（±采样）≈ |

平衡重调全部在 **Generator v2 / BattlePower 评分** 侧完成；
BattleEngine（伤害/防御/命中/暴击/回合顺序/AI/状态/Trigger/Modifier）冻结未动；
Generator v1 输出逐字节冻结。

---

## 6. v1.2.1 统计口径与战力可信度修正（CALIBRATION-AUDIT §1-14）

独立代码审计发现 v1.2.0 的 `rarityMonotonic`（容忍 -0.03）把 trend 写成 monotonic，
且 BP 的“7 维聚合/精确胜率”口径过载。v1.2.1 修正：

| 审计项 | v1.2.0 | v1.2.1 |
| --- | --- | --- |
| 稀有度单调 | `rarityMonotonic`（容忍 0.03） | `rarityStrictMonotonic` + `rarityTrendAcceptable` 分离，如实报告 |
| 相邻档矩阵 | 未建 | `scripts/adjacent-rarity-matrix.js`：11 组、多 Archetype/Seed、正反位、95% CI |
| BP 口径 | “7 维聚合 / 精确胜率” | 1v1 通用强度排序指标；3 主评分维度 + 4 诊断维度 |
| 精确胜率 | UI 潜在的 64% 类表述 | 移除；改为 战力较高/接近/较低（`card-ui.bpRelation`） |
| Spearman | validation 0.776 | 保留（TRAIN/VALIDATION/FINAL_TEST 三分离，§14） |
| 相近 BP 测试 | ladder band（10.9% in band） | `scripts/similar-bp-test.js`：随机 pair ≤5% 直接正反位 |
| 胜率模型 | 拍脑袋 Elo scale | logistic(ln(BPA/BPB)) 拟合 + Brier/LogLoss/bins（§12） |
| 权重来源 | 注释暗示脚本拟合 | `fitBattlePowerWeights()` 真实在 TRAIN 上拟合（§13A） |
| v1 防漂移 | dispatcher 自比较 | `tests/fixtures/generator-v1.1.0.json` sha256 锁定（§15） |

v1.2.1 实测门禁（配合 `qa/adjacent-rarity-matrix.json`、`qa/power-calibration.json`）：
- 相邻档 11 组 allDirectionCorrect = YES，strictMonotonic = YES（CI 下界全部 > 0.5）。
- Health metrics：one-shot 0%、stalemate <5%、median 8 回合（§16 保留）。
- Validation Spearman（selected weights）≥ 0.70，FINAL_TEST 一次报告。
- Pairwise ordering accuracy（direct 正反位）≥ 0.75。
- Similar-BP fairness（|ΔBP|/mean ≤ 5%）higher-BP 胜率在 40–60%。
- 以上数字全部来自确定性种子 + 同定位镜像/正反位测量，无手工挑选。

---

## 7. v1.2.2 统计验收方法与数据泄漏修正

独立审计发现 v1.2.1 存在两类统计问题，v1.2.2 修复（产品功能全冻结）：

| 问题 | v1.2.1 | v1.2.2 |
| --- | --- | --- |
| FINAL_TEST 泄漏 | `fairnessFor(VALIDATION,FINAL,...)` 参与 `pick()` 选模型 | 模型选择只用 TRAIN+VALIDATION；FINAL 全程不参与拟合/选择/调阈值，FREEZE 后才评估 |
| Pairwise/SimilarBP | `pairwise(VALIDATION,FINAL)`、`similarBP(VALIDATION,FINAL)` | 拆为 train/validation/final，各 split 内部 disjoint pairs，Release 主报 final |
| WinProbabilityModel | fit+Brier/LogLoss 同批（in-sample） | logistic 只在 TRAIN 拟合；VALIDATION sanity；FINAL 只算 Brier/LogLoss/bins/ECE |
| Archetype 覆盖 | SimilarBP 硬编码 6 个（漏 Support） | 全部 `Object.keys(N.ARCHETYPES)`（7 个，含 Support） |
| Adjacent CI | 把 5040 battle 当独立样本（pseudo-replication） | **matched-card bootstrap**：统计单位 = 独立生成卡 pair；报告 battle/generatedCard/seed/pair 计数 |
| Matched-seed | 无 | 新增 **Matched Rarity Ladder**（同 seed/arch/level 只变 rarity budget），区分 Causal vs Population |
| 平局处理 | 平局计入高阶败（0/0 胜率拉低） | **conditional win rate（排除平局）+ drawRate 单独报告** |
| v1 fixture | 从当前源码生成 | 必须从历史 commit 19ca5a4 worktree 生成（`--historical-ref` 保护），golden 不可自动再生成 |
| Health n | 300（stalemate 4.7% 离阈值太近） | 2000-3000，point estimate + 95% CI + P50/P75/P90/P95（按 Archetype） |

v1.2.2 关键测量结论（见 `qa/adjacent-rarity-matrix.json`、`qa/matched-rarity-test.json`）：
- **matched-seed（causal）稀有度效应健康**：11 组相邻档 conditional win rate 全部
  EXPECTED（0.68-0.81），无 <40% hard inversion → 高稀有度仅提升 rarity 确实变强。
- **Support 的“反转”实为 stalemate 平局**：Support 自愈镜像常打满 maxRounds
  （matched drawRate 可到 ~48%），v1.2.1 把平局记 0/0 胜率导致假反转；排除平局后
  Support matched conditional ≈ 0.78（真正变强）。据此 **不需要 Generator 重调**。
- **Population Strength** 独立报告：不同随机 seed 的高阶总体更强（整体 EXPECTED），
  archetype 条件化逐项可见，不做 aggregate 掩盖。

*审计依据：`src/engine.js`、`src/gen-skills.js`、`src/gen-v2.js`、
`src/battlepower.js`、`src/card-ui.js`、`scripts/power-calibration.js`、
`scripts/adjacent-rarity-matrix.js`、`scripts/matched-rarity-test.js`、
`scripts/similar-bp-test.js`、`scripts/health-metrics.js`、
`scripts/generate-v1-fixture.js`、`docs/GENERATOR-BALANCE-v1.2.md`、
`tests/fixtures/generator-v1.1.0.json`。*
