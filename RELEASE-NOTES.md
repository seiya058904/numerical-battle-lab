# Release Notes — v1.2.3

`数值对战实验室` is a fully offline, single-player, deterministic, multi-entity turn-based numerical combat system presented as a card-style web interface.

## Core idea

Cards are presentation only. The engine works with generic combat entities and a reusable numerical combat language:

`Formula + Modifier + Effect + Condition + Target + Event + Status + Resource + Damage Component`.

Ordinary content is composed from registered primitives and parameters instead of character-specific engine branches.

---

## v1.2.3 highlights — BattlePower Release Consistency + Sustain Health Fix

本轮不扩玩法。目标只解决三件事：① BattlePower 验证模型与线上模型不一致；
② Support/Tank sustain stalemate 超标；③ historical fixture 工具的历史 checkout
验证不完整。

### 1. BattlePower 唯一 Source of Truth（§1/§5/§6）

- 新增 `src/battlepower-model.js` 作为 **唯一模型注册表**：
  `BATTLE_POWER_MODEL_VERSION = MODEL_V123` + `BATTLE_POWER_WEIGHTS` +
  确定性 `modelHash`。Calibration / 浏览器 / 测试 / UI 全部读取同一模型。
- `src/battlepower.js` 不再硬编码权重，改为消费注册表（`NCB.battlePowerModel`）；
  消除 v1.2.2 “calibration selected fitted(0.25/0.60/0.05) 而线上 0.22/0.45/0.25”
  的分裂。
- `scripts/power-calibration.js`：`scoreRow(row, model)` 显式接受模型，
  不再读取旧缓存 `row.battlePower`（§6）；FINAL 报告打印并断言
  `selectedModelHash === shippedModelHash`（§5，静态测试
  `tests/battlepower-model.test.js` 强制）。

### 2. 新 FINAL HOLDOUT（§2/§19）

- 旧 FINAL_TEST 种子已公开，不再作为新模型最终门禁。
- 正确流程：`TRAIN → fit → VALIDATION → choose → FREEZE → NEW_FINAL_2026_09`
  （全新、从未使用的 seed 空间）→ final evaluation。FINAL 至少报告
  Spearman / Pairwise / Similar-BP / Brier / LogLoss / ECE。

### 3. Candidate fairness 模型错位修复（§3/§4）

- `fairnessFor()` 不再先用旧 stored BP 预选 `p.hi/p.lo` 再套 candidate weights。
- 新增 `buildPairsForModel(cards, model)`：每个候选模型用自己的
  `candidateBattlePower(card)` 重新计算所有卡 BP、重新判断高低、重新判断
  <=5% close pair、重新构造 pair 并运行 fairness——不同模型得到不同的
  close-pair population，VALIDATION 才是在真正比较模型。

### 4. Health 修复（§7-§13，真正压下去的游戏问题）

- v1.2.2 实测 stalemate 6.40% [5.41-7.56] 未过 <5% 门禁；本轮压到
  **n=3000 stalemate point 0.97% [0.67-1.38]**（目标 <4%，硬门禁 <5%）。
- **SustainLoad**（Generator-only，绝不进 BattleEngine）：每张卡记录
  `sustainLoad / expectedDPS / expectedSelfSustain / pressureRatio`（§9/§13）。
- **sustain composition ceiling**（§10）：per-archetype `V2_SUSTAIN_CEILING` +
  `V2_PRESSURE_FLOOR`；超限时**重新组合**而非砍数值——移除 recurring sustain
  trigger 换成 utility/resource/status trigger、降低 heal+shield 同现、
  慢速 damage 换快速 damage 增加 pressure；按 Effect/Tag 判断，绝无
  `if(archetype==='Support')damage*=...`。
- **recurrence cost 提高**（§12）：`V2_TRIGGER_RECURRENCE_DISCOUNT` 3.2→6.0
  （roundStart/roundEnd/afterDamage 每轮重复价值此前仍低估），配合 composition
  ceiling 一起看，不是单旋钮。
- **Support 仍然是 Support**（§11）：healKeep ~44%、可拖长战斗（P90 30），但
  mirror stalemate 降到 **6.3%**（目标 <10%）；Tank **0.2%**（目标 <7%）。
- 组合级调整：heal 技能 cooldown 1→2、`V2_SUSTAIN_POWER_SCALE` 720→1100
  （heal/shield 系数分母），BattleEngine 冻结、Generator v1 冻结。

### 5. Health 进入 release gate（§15）

- `npm run verify` 保持快速（单测 + static check）。
- 新增 `npm run verify:release`：verify + health-metrics(n=3000) +
  adjacent-rarity-matrix + BattlePower calibration + matched-rarity + Similar-BP。
  正式版本提交必须跑 `verify:release`。

### 6. Historical fixture 真正验证 checkout（§16-§18）

- `generate-v1-fixture.js` 现在执行 `git -C <srcDir> rev-parse HEAD` 并严格等于
  `19ca5a443fcccd418d421a648f29a900098f55f8`，且 `git status --porcelain` 为空，
  否则立即拒绝（不再只检查 `src/generator.js exists`）。
- fixture 顶部加入 provenance：`historicalCommit / historicalTree /
  generatorBlobSha / generatedAtToolVersion`（无动态时间，保持可复现）。
- **189 张内容与 hash 完全不变**（provenance 只增不改）；v1-fixture 测试断言
  provenance 字段。

---

## v1.2.2 highlights — 统计验收方法与数据泄漏修正（validation correctness patch）

本轮冻结产品功能（UI / 卡牌 / 卡牌库 / 新手流程 / 12 稀有度 / 战斗机制 /
Generator v1 均未改），只修正独立审计发现的统计方法与数据泄漏问题。

- **FINAL_TEST 泄漏修复**（§2）：v1.2.1 在模型选择阶段用了
  `fairnessFor(VALIDATION, FINAL, ...)`，FINAL 卡参与选模型，导致后续
  “FINAL_TEST Spearman” 不是真正 holdout。v1.2.2 改为
  `TRAIN → fit weights → VALIDATION → choose model → FREEZE → FINAL_TEST → only eval`；
  FINAL 全程不参与 fairness / Spearman / 候选选择 / 阈值 / logistic 拟合 / 权重选择。
- **VALIDATION fairness 只用 VALIDATION**（§3）：直接对战 pair 从 VALIDATION 内部
  确定性 disjoint pairs 构造，不再借 FINAL 卡；FINAL 只在模型固定后内部造 pair。
- **Pairwise / Similar-BP 三分**（§4/§5）：`pairwiseTrain/Validation/Final` 与
  `similarBPTrain/Validation/Final` 完全隔离；Release 主报 `pairwiseFinal` 与
  `similarBPFinal`。
- **WinProbabilityModel 正确 holdout**（§6）：logistic b0/b1 只在 TRAIN 拟合；
  VALIDATION 只做 sanity；FINAL 只算 Brier / LogLoss / calibration bins / ECE。
- **全部注册 Archetype**（§7）：所有脚本改用 `Object.keys(NCB.ARCHETYPES)`
  （7 个，含 Support），Similar-BP / Adjacent / Health / Calibration 全覆盖。
- **Adjacent Matrix pseudo-replication 修复**（§8/§9/§15）：CI 改用 **matched-card
  bootstrap**（统计单位 = 独立生成卡 pair，不是单场 battle）；报告
  battleCount / generatedCardCount / independentSeedCount / pairCount 分离。
- **Matched-Seed Rarity Test 新增**（§10/§11）：同 seed/archetype/level 生成
  C/C+/B/... 保持相同 skill grammar / passive/trigger blueprint / composition，
  只让 rarity budget 变化；区分 **Causal Rarity Effect（matched）** 与
  **Population Strength（独立随机 seed）**。
- **Archetype 条件化正式报告**（§12）：Overall + 7 archetype × 11 pairs，
  不用 aggregate average 隐藏反转；阈值 Hard<40% / Mild 40-48% / Neutral 48-52% /
  Expected 52-62%。
- **平局单独报告**（新发现，§14 诊断结论）：Support 高稀有度“反转”实为
  **stalemate 平局**（Support 自愈镜像常打满 maxRounds，runSimulation 把平局记为
  0/0 胜率，拖低高阶胜率）。v1.2.2 的矩阵/测试用 **conditional win rate
  （wins/(wins+losses)，排除平局）** 并单独报告 drawRate；Support matched-seed
  conditional ≈ 0.78（真正变强），no generator rebalance needed。
- **v1 历史 fixture 真正锚定历史 commit**（§17/§18）：`generate-v1-fixture.js`
  要求显式 `--historical-ref 19ca5a4...` + `--src-dir`（临时 worktree at
  19ca5a4）否则拒绝运行；golden fixture 是 immutable evidence；正常 verify
  只 current-v1 vs fixture 比对，永不自动再生成。
- **Health Metrics 提高稳定性**（§20/§21）：n 提升到 2000-3000，报告 point
  estimate + 95% CI（Wilson）与 P50/P75/P90/P95（按 Archetype）。
- **删除 tautological assertion**（§19）：`fixture.count` 断言改为精确 `189`。

---

## v1.2.1 highlights — 战力可信度与相邻稀有度校准

本轮不增加玩法、不重新设计 UI、不添加新稀有度、不修改 Generator v1；只修正
v1.2.0 独立代码审计发现的统计口径和战力可信度问题。

- **稀有度统计口径修正**：`rarityStrictMonotonic`（每个相邻档 mean[n+1] >= mean[n]
  才为 true）与 `rarityTrendAcceptable`（允许采样波动）分离报告，禁止把
  “trend acceptable” 写成 “strict monotonic YES”。
- **`adjacent-rarity-matrix`**（`scripts/adjacent-rarity-matrix.js`）：11 组相邻档
  C→C+ … XS→XS典藏，多 Archetype × 多 Seed × 正反位，每组数千局，输出
  `winRateHigherTier / 95% CI / sampleCount`；普通升级目标 54–60%，典藏 52–57%。
  v1.2.1 实测：**全部相邻档方向正确（higher tier 胜率 > 50%，CI 下界 > 0.5）**，
  修复了 A→A+（0.501→0.535）与 XS→XS典藏（0.493→0.540，原为反转）。
- **`V2_BUDGET_CURVE`（RPI 与 GenerationBudget 解耦）**：v2-only 单调预算曲线，
  由每个 RPI 经确定性数据表映射；v1 的 `generationBudget` 公式未动。
- **BattlePower 口径重定义**：明确为 **1v1 通用强度排序指标**，非任意 matchup 的
  绝对战力；文档/代码/UI 改为 **3 主评分维度（进攻/生存/节奏）+ 4 诊断维度**
  （续航/功能/经济/稳定，仍计算并显示）。
- **普通 UI 不再显示精确预估胜率百分比**：改为 `战力较高 / 战力接近 / 战力较低`
  或仅 `战力 NNNN`（`card-ui.bpRelation`）。
- **相近 BP 公平性测试**（`scripts/similar-bp-test.js`）：随机 pair
  `|ΔBP|/mean <= 5%` 直接正反位大量模拟，higher-BP 胜率理想 45–55%、放宽 40–60%，
  并按 0-2/2-5/5-10/10-20/20+% 分桶验证 BP 数字距离。
- **校准脚本可复现（§13A）**：实现 `fitBattlePowerWeights()` 在 TRAIN 上自动拟合；
  固定 TRAIN / VALIDATION / FINAL_TEST 三套 seed，VALIDATION 选模型（Spearman +
  similar-BP fairness 同时考虑），FINAL_TEST 发布前只跑一次（§14）。
- **多指标报告**：Spearman（validation ≈ 0.78-0.81）、Pairwise ordering accuracy
  （target ≥ 0.75）、Similar-BP fairness、Win-probability calibration
  （logistic(ln BP 比)，Brier / LogLoss / calibration bins）。
- **v1 历史 fixture**（`tests/fixtures/generator-v1.1.0.json`）：189 张代表旧卡
  sha256(canonicalGeneratedCard) 锁定，v1 真正 byte-for-byte 防漂移（§15）。
- **Health Metrics 保留**：one-shot 0%（<5%）、stalemate <5%、median 6–10 回合
  （v1.2.1 实测 median 8）。

---

## v1.2.0 highlights — 玩家化 UI + 战力评分 + 稀有度扩展 + 数值系统审计

### Player-facing UI (default experience)

- **默认导航改为玩家向**：对战 / 卡牌 / 生成卡牌 / 玩法说明。
- **高级实验室后置**：数值编辑 / 批量模拟 / 规则架构 / 对局重放 / 计算详情 / JSON 导入导出
  收纳在右上角「高级实验室」，功能全部保留，不因改 UI 而删除任何能力。
- **默认全中文**：`我方 / 对手 / 上场 / 选择行动 / 回合 / 战斗记录 / 伤害 / 治疗 / 无消耗 /
  对局重放 / 计算详情`；HP/ATK/DEF/RES/SPD 显示为「中文 + 缩写」（生命 HP 等）；
  默认隐藏内部 ID，仅高级视图展示。
- **新手流程**：生成卡牌 → 加入卡牌库 → 选卡与对手难度 → 开始对战 → 选技能 → 点目标 → 结算回合。
- **两种对战模式**：手动对战（玩家操控我方技能，AI 操控对手）与自动推演（双方 AI，
  支持 暂停 / 继续 / 下一步 / 1× / 2× / 4× 速度）。引擎保持确定性，UI 回放计算好的回合日志。
- **默认 1 VS 1**：选卡 → 对手难度（简单/普通/困难）→ 大按钮「开始对战」；
  1–6 vs 1–6 放在「更多对战设置」。
- **卡牌展示适配器**（`src/card-ui.js`）：纯 CSS/SVG 卡图占位（无外部图片资源）、
  名称、稀有度徽章与卡框、Lv、战力、定位、六维基础属性、技能名与中文描述、标签。
- **稀有度 12 档视觉**：每种稀有度有独立卡框与徽章；典藏版使用边框样式 + 徽章文字 +
  小图形（不只靠颜色区分，色盲玩家也能分辨）。
- **卡牌库**：本地持久化，可查看 / 选择 / 删除 / 同种子再生成 / 复制种子 / 改名；
  无账号、无服务器、无云、无商城、无抽卡。
- **生成卡牌页**：玩家只看到 稀有度 / 等级 / 类型定位 / Seed(可选) / 随机生成；
  Seed 默认自动随机，仅高级模式手动指定；生成后展示真实卡牌 + 加入我的卡牌 / 立即对战 / 再次生成。

### 战力评分 (BattlePower, `src/battlepower.js`)

- 7 维几何聚合：进攻 / 生存 / 续航 / 节奏 / 功能 / 经济 / 稳定，
  权重由 Monte Carlo 在健康生态上拟合（train/validation 完全分离）。
- 进攻子评分调用同一套引擎数学（公式/命中/暴击/穿透/防御/抗性/多段/冷却/资源）。
- 战力只是展示指标，永不进入战斗结算；不把稀有度当作伤害倍率。
- `describeSkill` 统一数据驱动中文技能描述。

### 稀有度扩展 + Generator v2

- 稀有度扩展到 12 档（C..XS 典藏），旧 9 档 RPI 数值不变；Generator v1 输出逐字节冻结。
- Generator v2：Composition Grammar（主效果 + 副效果 + 目标 + 条件 + 成本 + 冷却 +
  命中 + 伤害类型 + 标签），替换 13 条硬编码配方；被动/触发预算真实消耗。
- **深度平衡重调**（详见 `docs/GENERATOR-BALANCE-v1.2.md`）：消除首回合秒杀、
  治疗/护盾僵局、同档双峰与稀有度反转；战斗时长中位数 8 回合、秒杀率 0%、僵局率 <2%。
- `scripts/power-calibration.js`：同定位镜像正反位 + train/validation 分离，
  验证集 Spearman ≥ 0.70（当前实测 ~0.75-0.78）。

### 审计文档

- `docs/BALANCE-AUDIT-v1.2.md`：Pokémon Showdown MoveData 旋钮逐项审计
  （已有 / 值得补 / 不适合本项目），StatStage 与 TypeInteractionMatrix 结论，
  Smogon damage-calc 单一事实源对齐。
- `docs/GENERATOR-BALANCE-v1.2.md`：Generator v2 平衡报告（健康指标 / 稀有度 / BP）。

### 版本与质量

- `package.json` / `RELEASE-MANIFEST.json` / 静态门禁版本 = **1.2.0**。
- 全部既有测试保留并新增：稀有度顺序、Generator v1 向后兼容、Generator v2 确定性、
  中文名确定性、战力确定性 / 只读 / 稀有度无关、被动预算消耗、组合约束回归、
  触发连锁回归、健康对局回归、卡牌持久化等。
- 浏览器 QA：桌面 1440×1000 与移动 390×844 全中文、新手流程可独立玩通。

## Start

Double-click `index.html`, or serve the folder with any static server. See `README.md` for details.

## Changelog — v1.1.0 (card generation + hardening)

（见上一版本发布说明；v1.1.0 的 13 条硬编码配方、Generator v1 与 v1.2 的
12 档稀有度扩展、Generator v2 与战力评分见上方 v1.2.0 概览。）
