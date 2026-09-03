# QA 报告 — v1.2.3

发布候选：`数值对战实验室` v1.2.3（BattlePower Release Consistency + Sustain Health Fix）

## 自动化验证

新源码树验证命令：

```bash
npm run verify        # 快速：catalog + 全量单测 + static check
npm run verify:release # 正式版本：verify + health(n=3000) + adjacent + calibration + matched + similar-BP
```

结果：**全量测试通过（181）**，静态架构检查通过（v1.2.3 版本门禁 + manifest 审计）。

生成能力计数（verify 时）：

- 参数：91
- 效果：18
- 条件：27
- 目标：8
- 事件：28
- 伤害类型：8
- 示例实体：20
- 示例技能：63
- 示例状态：33

## 战力校准（v1.2.3 唯一模型注册表 + NEW FINAL HOLDOUT）

`src/battlepower-model.js` 是 **BattlePower 唯一 Source of Truth**（`BATTLE_POWER_MODEL_VERSION
= MODEL_V123` + `BATTLE_POWER_WEIGHTS` + 确定性 `modelHash`）；`src/battlepower.js`、
UI、校准、测试全部读取同一模型。校准流程：
`TRAIN → fit → VALIDATION → choose（每候选 buildPairsForModel 独立造 pair）→ FREEZE →
NEW_FINAL_V123（全新种子，从未用过）→ only eval`。

```text
fitBattlePowerWeights (TRAIN): {offense 0.20, durability 0.55, tempo 0.25, ...}  trainSpearman 0.890
Spearman VALIDATION: fitted 0.865 · shipped 0.740 · balanced 0.734
similar-BP fairness (VALIDATION-internal, per-model random pairs):
  fitted 0.641 · shipped 0.567 · balanced 0.542
SELECTED (validation, no FINAL): shipped = MODEL_V123
selectedModelHash=1ddb2797 shippedModelHash=1ddb2797 hashesEqual=YES
--- MODEL FREEZED ---
Spearman NEW_FINAL (frozen model, holdout): 0.815   (target >= 0.70)  ✔
pairwise ordering: train 0.929 · validation 0.886 · NEW_FINAL 0.957  (final >= 0.75)  ✔
similar-BP (canonical similar-bp-test, random pairs 140):
  |dBP|/mean<=5% higher-BP win 0.534  (ideal 45-55%, relaxed 40-60%)  ✔
  buckets: 0-2% 0.466 · 2-5% 0.603 · 5-10% 0.548 · 10-20% 0.722 · 20+% 0.890 (单调)
win-probability (fitted TRAIN, b0=0.168 b1=1.487):
  NEW_FINAL holdout: Brier 0.195 · LogLoss 0.580 · ECE 0.228 (n=74)
adjacent-rarity matrix: allDirectionCorrect YES · strictMonotonic YES · hardInversions 0
CALIBRATION PASS ✔
```

**模型一致性（§1/§5）**：shipped 权重 = `{offense 0.30, durability 0.40, tempo 0.22,
sustain/utility/economy/reliability 0.02}`，与 selected 完全一致（hash 相等）；静态测试
`tests/battlepower-model.test.js` 强制 `selectedModelHash === shippedModelHash`。

## 相邻稀有度矩阵（v1.2.3 重验，matched-card bootstrap）

`scripts/adjacent-rarity-matrix.js`：11 组 × 7 Archetype（含 Support）× 48 matched seeds
× 8 局/向；CI 由 **matched-card bootstrap**（统计单位 = 独立生成卡 pair）给出；胜率为
**conditional win rate（排除平局）**，drawRate 单独报告。

```text
ALL ADJACENT DIRECTION CORRECT (conditional): YES
hard inversions (<40%): 0
每档 OVERALL conditional ≈ 0.78-0.89 全部 EXPECTED；draws 4-7%
数据: independentSeedCount=48, generatedCardCount=7392, pairCount(cell)=48
```

## Matched-Seed Rarity Test（v1.2.3 重验，§10/§11）

`scripts/matched-rarity-test.js`：同 seed/archetype/level 生成 C..XS 保持相同
composition 结构，只变 rarity budget。

```text
Causal (matched)   : 11 组 conditional 0.785-0.892 全部 EXPECTED，hard inversions 0
Population (random): 11 组 conditional 0.585-0.683 全部 EXPECTED，hard inversions 0
数据: independentSeedCount=48, generatedCardCount=4032, pairCount(cell)=48
```

## Health Metrics（v1.2.3 n=3000 + sustain fix）

`scripts/health-metrics.js`：n=3000 同稀有度镜像 1v1，point estimate + Wilson 95% CI，
报告 overall / 7 archetype / 12 rarity / archetype×rarity。

```text
one-shot : point 0.00%  95%CI [0.00-0.13]   (gate < 5%)  ✔
stalemate: point 0.97%  95%CI [0.67-1.38]   (gate < 5%, target < 4%)  ✔
rounds   : P50 8 · P75 11 · P90 15 · P95 19  (median 6-10)  ✔
per-arch stalemate: Support 6.3% (<10%) · Tank 0.2% (<7%) · Balanced 0.2% ·
                    Bruiser/Assassin/Mage/Controller 0.0%
per-rarity stalemate: 12 档全部 0.0-3.6% ✔
```

**Sustain 修复（§7-§13）**：v1.2.2 的 stalemate 6.40% [5.41-7.56]（Support 镜像 30.9%）
本轮通过 Generator v2 **sustain composition** 真正修复：
- 每卡记录 `sustainLoad / expectedDPS / expectedSelfSustain / pressureRatio`（anti-stall
  diagnostics，Generator-only，绝不进 BattleEngine）。
- per-archetype `V2_SUSTAIN_CEILING` + `V2_PRESSURE_FLOOR`；超限重新组合（移除 recurring
  sustain trigger → utility/resource/status；heal+shield 同现时 shield→damage 保留 heal；
  pressure 不足时慢速 damage→快速 damage）。按 Effect/Tag 判断，无 per-archetype 数值倍率。
- `V2_TRIGGER_RECURRENCE_DISCOUNT` 3.2→6.0（recurring 价值此前低估）、heal 技能 cooldown
  1→2、`V2_SUSTAIN_POWER_SCALE` 720→1100（组合级，非全局 nerf Heal）。
- **Support 仍然是 Support**：healKeep ~44%、P50 14 / P90 30（可拖长战斗），但 mirror
  stalemate 30.9% → **6.3%**。

## 统计口径（v1.2.3 修正）

- **BattlePower 唯一 Source of Truth**：`src/battlepower-model.js`（MODEL_V123）；calibration
  与线上完全一致（§1）。
- **NEW FINAL HOLDOUT**：旧 FINAL_TEST 与中间 NEW_FINAL_2026_09 种子均已公开，v1.2.3 用
  **NEW_FINAL_V123**（全新种子空间）作最终 holdout（§2/§19）。
- **Candidate fairness 模型错位修复**：`buildPairsForModel(cards, model)` 每个候选用自己的
  weights 重新算全部卡 BP、判断高低/close pair、构造 pair（§3/§4）；指标全部
  `scoreRow(row, model)` 显式接受模型，不再读旧缓存 `row.battlePower`（§6）。
- FINAL 完全未参与模型选择（`modelSelectionUsedSplits = ['TRAIN','VALIDATION']`）。
- 全部脚本用 `Object.keys(N.ARCHETYPES)`（7 个，含 Support）；平局单独报告。
- UI 移除精确预估胜率百分比 → `战力较高 / 战力接近 / 战力较低`（`card-ui.bpRelation`）。

## Generator 平衡（v1.2 深度重调 + v1.2.1/1.2.2 保留 + v1.2.3 sustain fix）

`docs/GENERATOR-BALANCE-v1.2.md` 记录：

- 第一回合秒杀率：**0.0%**（目标 <5%）
- 僵局率：**0.97% [0.67-1.38]**（目标 <4% ✔，硬门禁 <5% ✔；v1.2.2 为 6.40% 超标）
- 战斗时长中位数：**8 回合**（目标 6–10）
- v1.2.3 未动 RPI / Budget Curve / BattleEngine / Generator v1；只修 Generator v2
  sustain composition（SustainLoad + ceiling + recurrence cost）。

## v1 历史 fixture（v1.2.3 provenance 可机器验证）

`tests/fixtures/generator-v1.1.0.json`：**189 张**旧卡 sha256(canonicalGeneratedCard)
锁定，**由 v1.1.0 历史 commit `19ca5a443fcccd418d421a648f29a900098f55f8` 的临时
worktree 实际生成**；fixture 顶部 provenance：
`historicalCommit / historicalTree (ad4e2a9d…) / generatorBlobSha (228e65b9…) /
generatedAtToolVersion (v1.2.3)`（无动态时间，可复现）。工具
`scripts/generate-v1-fixture.js` 现在执行 `git -C <srcDir> rev-parse HEAD` 严格等于
19ca5a4 且 `git status --porcelain` 为空，否则拒绝（§16）；189 张内容与 hash 不变
（§18），`tests/v1-fixture.test.js` 断言 provenance 字段。

## 浏览器 QA

`qa/browser-results.json` 记录交互式浏览器通过项。

### 桌面 1440×1000（真实 Chromium）

- 默认导航为玩家向：对战 / 卡牌 / 生成卡牌 / 玩法说明；高级实验室收纳右上角。
- **新手流程可独立玩通**：打开网页 → 生成卡牌 → 加入我的卡牌 → 立即对战 →
  选技能 → 点目标 → 结算回合 → 自动演算到结束 → 战斗完成。
- 手动对战与自动推演（暂停/继续/下一步/1×/2×/4×）均可用。
- 卡牌库本地持久化（加入/改名/复制种子/同种子再生成/删除）。
- 高级实验室全部可用：数值编辑 / 批量模拟 / 规则架构 / 对局重放 / 计算详情 / JSON。
- 全中文、无 NaN/Infinity、无 JS 错误（仅 favicon 404 可忽略）。

### 移动 390×844（真实 Chromium）

- 无横向溢出（`document.documentElement.scrollWidth === innerWidth === 390`）。
- 对战/卡牌/生成/帮助均可操作；无 NaN、无 JS 错误。

## 环境附注

- 运行时完全离线（Acorn 8.15.0 / OFFLINE），无 CDN/服务器/登录。
- `qa/desktop.png` 与 `qa/mobile.png` 为本次交互 QA 截图（可选生成）。
