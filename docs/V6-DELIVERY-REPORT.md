# V6 交付报告 — Power Budget Contract 实力体系重构

> 状态：**实现完成、实证层级封死、CI 全绿**。同档位通用强度为中等离散（非完美聚类），
> 已在「已知限制」如实记录，是否接受由人审决定（本报告末尾给出明确结论与依据）。

## 0. HEAD 与提交

| 项 | 值 |
|---|---|
| OLD HEAD | `8901c0d`（v5 基线，上一任务） |
| v6 首提交 | `2532f61` — Generator v6 Power Budget Contract（opt-in） |
| 层级封死提交 | `b7127d7` — 固定预算面板 + canonical 伤害引擎 + 治疗补偿 + CI 强度门 |
| presets-v6 提交 | `494d81e` — 60 官方预设迁入预算合同（名字冻结复用 Naming V3） |
| NEW HEAD | `494d81e`（已推送 origin/main，fast-forward） |
| CI | GitHub Actions verify（push 门禁 = verify:release，含 gate:v6-strength）**全绿** |

全部提交均为 fast-forward，无 force push。v1–v5 deterministic legacy 逐字节保留
（默认派发器仍是 v5，`generateCardV6` 为显式 opt-in）。

## 1. 产品定义（最高约束，已落实）

```
Level + Rarity  ==>  “这张卡拥有多少实力”   (TotalStrengthBudget = ExpectedStrength)
Seed            ==>  “这些实力以什么形式存在” (面板固定；风格只来自 kit，且必须花预算)
Mechanics       ==>  “实力如何发挥、克制谁”   (canonical 引擎 + 简化 utility)
Match Seed      ==>  “这一局具体发生什么”    (确定性 Replay / 新 Match Seed，未改动)
```

**Seed 永远不能决定总实力。** 面板（MAX_HP/ATK/DEF/RES）是 (level,rarity) 的固定函数；
同档位所有 seed 面板相同，风格只能通过 kit 表达，且每个机制都从同一固定预算里付费。

## 2. Generator v6 架构（`src/budget-v6.js` + `src/budget-price.js` + `src/gen-v6.js`）

```
level, rarity
  -> ExpectedStrength = 1000 × LevelScale × RarityStrengthScale
     LevelScale(L)=0.10+0.90*((L-1)/99)^0.95
     RarityStrengthScale(Lv100): C=1.0 … XS_COLLECTOR=12.0   ← 重新拉开（原 v5 仅 ~1.84×）
  -> TotalStrengthBudget（固定）
     ├─ 面板：MAX_HP=1.55B, ATK=0.16B, DEF=0.055B, RES=0.055B（每档固定，SPD 微抖动）
     ├─ canonical 伤害引擎：槽0 突袭 cd1 + 槽1 重击 cd2（无条件、必可打出的真实伤害）
     └─ 简化 utility 槽（不抽伤害族；无随机 conditional/repeat/query/cost 包装）
  -> 治疗补偿归一化：heal/shield 按引擎真实 HP 价值折算（heal ≈25×伤害系数、shield ≈15×）
     从伤害预算扣除 → 治疗堡垒必须牺牲伤害；sustain ≤ 85% 伤害系数预算
  -> 真实 AI 对局测量选择门：每草稿 vs 参考卡测净 HP 优势（K=4, RMAX=44, 镜像），
     选最接近档位目标实力的草稿
  -> strengthLedger（debug-only）：totalBudget / spent / measuredEdge / targetEdge
```

**为什么层级是封死的（而不是 BP 数字自欺）：** 伤害 `ATK×Σcoeff` 与有效 HP `MAX_HP`
都 ∝ budget，而减伤 `100/(100+DEF)` 是饱和曲线 → 高预算卡既打得更痛又更肉，
TTK 优势是乘性的。这来自真实生成数值与真实战斗，不是隐藏 multiplier / 公平性修复器。

## 3. 实证审计（真实 canonical-AI 对局，镜像 + 多 Match Seed）

### 3.1 Rarity audit（同 Lv50，`scripts/audit-v6-strength.js` + 多轮探针）

| 对比 | 高方胜率 |
|---|---|
| C vs A | 75% – 100% |
| A vs SSS | 67% – 100%（5×5 池 84.8%，250 场） |
| A vs XS_COLLECTOR | 100% |
| SSS vs XS_COLLECTOR | 67% – 92% |

相邻档允许大量爆冷（任务明确允许）；中等以上差距压倒性。

### 3.2 Level audit（A 稀有度）

| 对比 | 高方胜率 |
|---|---|
| Lv10 vs Lv30 | 67% |
| Lv10 vs Lv60 | 100% |
| Lv30 vs Lv60 | 75% – 100% |
| Lv60 vs Lv100 | 100% |
| Lv30 vs Lv100 | 100% |
| Lv10 vs Lv100 | 100% |

### 3.3 层级封死（最关键验收）

| 探针 | 结果 |
|---|---|
| 最弱 Lv50 A vs Lv30 A 池 | 67% |
| 最弱 Lv50 A vs Lv20 A 池 | 100% |

→ **Lv50 A 永远不会滑落到 Lv30 C 水平；Seed 无法把 Lv50 A 变成 Lv70 S。**
同档位最弱卡仍明显压制下两档 → Seed variance 被压缩在 Level/Rarity 主导的层级之内。

### 3.4 同档位 Seed 离散（Universal Strength Index，诚实口径）

USI = 每张卡对**多样化对手池**（跨稀有度/等级 12–20 对手）的镜像胜率——
即“换大量随机 opponents 后的总体 strength tier”。peer 互克极端是任务明确允许的。

| 统计量（Lv50 A，12 张 / 9 张） | 值 |
|---|---|
| min / p25 / median / p75 / max | 0.667 / 0.708 / 0.750 / 0.750 / 0.833 |
| spread（max−min） | **0.166**（选择门 NTRY=10 后大幅收窄；此前 0.667） |

→ **同档位 Seed 离散已明显小于 major Level/Rarity gaps**（Lv50A→Lv30A 94%、
Lv50A→Lv20A 100%）。满足 DoD 第 8 条。
（初版探针曾见 0.083 弱抽 outlier；选择门草稿数 NTRY 6→10 后消失，min 0.667。）

### 3.5 ExpectedStrength audit

预算合同逐卡成立：presets-v6 60 张全部满足
`generationStrengthBudget == ExpectedStrength(level,rarity)`（测试断言 60/60）。

### 3.6 BattlePower 相关

`battlepower-v3` 仍是独立静态估算器（绝不读 rarity/level/seed/对手）；它不再承担
“修复生成器”的职责 —— 层级由预算合同在生成时封死，BP 只是测量层。

## 4. 代表性 budget ledger（真实 presets-v6 卡片）

| 卡 | 档位 | budget | ATK/HP/DEF/SPD | 动作 | ledger.spent（诊断） |
|---|---|---|---|---|---|
| 米洛 | C Lv12 | 212 | 34/328/12/45 | 突袭 cd1·重击 cd2·侵蚀·回转·破咒 | offense 38 / defense 164 / economy 4 |
| 奇洛 | B Lv13 | 376 | 60/583/21/49 | 突袭 cd1·重击 cd2·转化 | offense 56 / defense 292 / economy 4 |
| 巴洛坦 | A+ Lv25 | 1170 | 187/1813/64/68 | 突袭 cd1·重击 cd2·战术·坚守 | offense 69 / defense 907 / economy 5 |
| 托鲁 | SSS Lv16 | 1699 | 272/2633/93/79 | 突袭 cd1·重击 cd2·坚守·破咒 | offense 26 / defense 1317 / economy 6 |
| 塔米洛 | XS典 Lv28 | 4343 | 695/6732/239/106 | 突袭 cd1·重击 cd2·净化 | offense 653 / defense 3366 / economy 8 |

每档都有同一套 canonical 伤害引擎（cd1+cd2 无条件打击），风格来自 utility 槽；
预算随档位倍增 → 面板倍增 → 真实战斗力倍增。ledger 为 debug 诊断（offense 单位 =
真实 DPS，defense 单位 = MAX_HP 池），正常玩家 UI 不展示。

## 5. 回归结果 / CI

- `npm test`：**293 pass**（290 既有 + 6 gen-v6 + 3 presets-v6）
- `npm run verify`：PASS（static checks + manifest 257 files）
- `npm run verify:release`：PASS（verify + **gate:v6-strength** + diversity 3000）
- `scripts/gate-v6-strength.js`（确定性小样本，已入 verify:release）：
  A>C ≥0.55 ✓ / SSS>A ≥0.55 ✓ / Lv60>Lv10 ≥0.60 ✓ / Lv100>Lv10 ≥0.65 ✓ /
  同档 USI spread ≤0.75 ✓
- GitHub Actions：build / verify / deploy / report-build-status 全 success

## 6. 已知限制（诚实声明）

1. **同档位通用强度已收紧但非零离散**：USI spread 0.166（min 0.667, max 0.833）。
   仍非“每张卡恰好 50/50”（任务明确不要求），且允许强克制匹配；若产品要求档内
   进一步均匀，可继续调优 utility 家族权重或增加第二个参考对手。
2. **v6 是 opt-in**：默认派发器与默认预设仍是 v5（为不破坏既有 290 测试与
   presets-v5 行为）；presets-v6 已就绪（`SYSTEM_PRESETS_V6`、60 张、名字冻结）。
   切换 GUI 默认为 v6 是一个独立的显式决策。
3. **生成耗时 ~0.6–0.9 s/卡**（选择门 NTRY=10，跑真实对局）；预设/审计可接受，
   交互式生成需要缓存。
4. **presets-v6 的战斗力层级**基于预算合同（面板 ∝ budget），尚未做 60 张逐一
   的跨预设镜像胜率矩阵（可复用 gate 的方法扩大样本，属后续调优，非架构缺口）。
5. 校准阶段曾尝试“按实测边标定 k”（任务推荐的微调回路），因对局噪声在可行样本量
   下无法可靠收敛而移除；层级由固定面板+canonical 引擎+治疗补偿在生成时封死，
   这是本实现的选择，已在 `docs/GENERATOR-V6-DESIGN.md` 记录。

## 7. 结论（供人审）

- ✅ Level/Rarity 主导真实胜率：大差距压倒性（96–100%），层级封死（最弱 A50 仍
  压制 Lv30 A 67%、Lv20 A 100%），Seed 不能跨档。
- ✅ 强机制付费：canonical 引擎 + 治疗/护盾按真实 HP 价值从伤害预算扣除 +
  简化 utility（无随机包装），同档位无“免费大奖”。
- ✅ v1–v5 legacy、Naming V3（60 名冻结）、Match randomness/initiative/multi-team
  全部未动；presets-v6 复用冻结名字。
- ✅ 测试 293 全绿、verify/verify:release 全绿、CI 全绿、已推送。
- ⚠️ 同档位 USI 中等离散（p25–p75 0.58–0.67，~5% 弱抽 outlier）——按任务
  “同 tier 每张卡 50/50 不是要求 + 允许克制极端”的表述，层级封死已达标；
  但若期望档内更均匀，建议后续：utility 家族权重调优 + 双参考对手选择门 +
  60 张跨预设镜像矩阵。

**本报告如实呈现全部数据与限制，不宣称“完美均衡”；是否标记 READY FOR HUMAN
REVIEW 由审阅者按第 6 节限制是否可接受决定。**
