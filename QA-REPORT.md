# QA 报告 — v1.2.2

发布候选：`数值对战实验室` v1.2.2（统计验收方法与数据泄漏修正，validation correctness patch）

## 自动化验证

新源码树验证命令：

```bash
npm run verify
```

结果：**全量测试通过**，静态架构检查通过（v1.2.2 版本门禁 + manifest 审计）。

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

## 战力校准（v1.2.2 无泄漏三分离门禁）

`scripts/power-calibration.js`：TRAIN / VALIDATION / FINAL_TEST 三套 seed 完全分离；
`fitBattlePowerWeights()` 只在 **TRAIN** 拟合；**VALIDATION** 按 Spearman + similar-BP
fairness（只用 VALIDATION 内部 disjoint pairs）选模型；**FREEZE**；**FINAL_TEST** 只做
holdout 评估，全程不参与拟合/选择/调阈值（§2-6）。

```text
Spearman VALIDATION: fitted 0.807 · committed 0.727 · balanced 0.698
similar-BP fairness (VALIDATION-internal pairs): fitted 0.566 · committed 0.512
SELECTED (validation, no FINAL): fitted -> {offense 0.25, durability 0.60, tempo 0.05, ...}
--- MODEL FREEZED ---
Spearman FINAL_TEST (frozen model, holdout): 0.785   (target >= 0.70)
pairwise ordering: train 0.800 · validation 0.825 · FINAL 0.761  (final >= 0.75)
similar-BP fairness: train 0.670 · validation 0.608 · FINAL 0.543  (ideal ~0.50)
win-probability (fitted on TRAIN, b0=0.027 b1=1.309):
  FINAL holdout: Brier 0.214 · LogLoss 0.621 · ECE 0.191 (n=75)
adjacent-rarity matrix: allDirectionCorrect YES · strictMonotonic YES · hardInversions 0
CALIBRATION PASS ✔
```

## 相邻稀有度矩阵（v1.2.2 matched-card bootstrap）

`scripts/adjacent-rarity-matrix.js`：11 组 × 7 Archetype（含 Support）× 48 matched seeds
× 8 局/向；CI 由 **matched-card bootstrap**（统计单位 = 独立生成卡 pair，不是单场 battle）
给出；胜率为 **conditional win rate（排除平局）**，drawRate 单独报告。

```text
ALL ADJACENT DIRECTION CORRECT (conditional): YES
hard inversions (<40%): 0
Support 每档 conditional 0.66-0.76 EXPECTED（v1.2.1 的“反转”实为 Support 镜像
stalemate 平局——v1.2.2 将平局单独报告，不再把平局误计为高阶败）
数据: independentSeedCount=48, generatedCardCount=7392, pairCount(cell)=48
```

## Matched-Seed Rarity Test（v1.2.2 新增，§10/§11）

`scripts/matched-rarity-test.js`：同 seed/archetype/level 生成 C..XS 保持相同
composition 结构，只变 rarity budget。

```text
Causal (matched)   : 11 组 conditional 0.75-0.85 全部 EXPECTED，hard inversions 0
Population (random): 11 组 conditional 0.57-0.64 全部 EXPECTED，hard inversions 0
```

## Health Metrics（v1.2.2 n=2000 + 95% CI + 分位）

`scripts/health-metrics.js`：n=2000 同稀有度镜像 1v1，point estimate + Wilson 95% CI。

```text
one-shot : point 0.00%  95%CI [0.00-0.19]   (gate < 5%)  ✔
stalemate: point 6.40%  95%CI [5.41-7.56]   (gate < 5%)  ✗ 见下
rounds   : P50 9 · P75 13 · P90 25 · P95 40  (median 6-10) ✔
per-arch stalemate: Support 30.9% · Tank 8.0% · Balanced 3.8% · Controller 2.1% ·
                    Bruiser/Assassin/Mage 0.0%
```

> **stalemate 6.40% [5.41-7.56] 超出 §20 point<5% 门禁**：独立审计 §20/§21 预期此情形
> （n=300 的 4.7% 统计误差足以让真实率 >5%），要求提高 n 并如实报告，且明确“长尾
> 不是 blocker”。诊断（sustain-scale 扫描 720-1300）表明 Support 镜像是结构性
> heal/shield sustain 循环，单一旋钮无法修复；按 §22 “rarity 健康则不继续过度调数值”，
> v1.2.2 不重调 Generator v2，将其作为已文档化发现记录（后续轮次的最小 sustain/
> composition 调整），不隐藏、不误标为通过。§24 完成标准 A-E（rarity/FINAL/fixture）
> 全部满足。

## 统计口径（v1.2.2 修正）

- `rarityStrictMonotonic` / `rarityTrendAcceptable` 分离报告。
- FINAL_TEST 完全未参与模型选择（`modelSelectionUsedSplits = ['TRAIN','VALIDATION']`）。
- Pairwise / Similar-BP 拆成 train / validation / final，主报 final。
- 全部脚本用 `Object.keys(N.ARCHETYPES)`（7 个，含 Support）。
- 平局（stalemate）单独报告，不混入胜率。
- BattlePower 口径：1v1 通用强度排序指标；3 主评分维度 + 4 诊断维度。
- UI 移除精确预估胜率百分比 → `战力较高 / 战力接近 / 战力较低`（`card-ui.bpRelation`）。

## Generator 平衡（v1.2 深度重调 + v1.2.1 保留 + v1.2.2 冻结）

`docs/GENERATOR-BALANCE-v1.2.md` 记录：

- 第一回合秒杀率：**0.0%**（目标 <5%）
- 战斗时长中位数：**9 回合**（目标 6–10）
- v1.2.2 **冻结 Generator v2**：rarity（matched + population）均健康、无 hard
  inversion，故不做数值重调；stalemate 发现如实记录。

## v1 历史 fixture（v1.2.2 真正锚定历史 commit）

`tests/fixtures/generator-v1.1.0.json`：**189 张**旧卡 sha256(canonicalGeneratedCard)
锁定，**由 v1.1.0 历史 commit `19ca5a443fcccd418d421a648f29a900098f55f8` 的临时
worktree 实际生成**（`scripts/generate-v1-fixture.js --historical-ref ... --src-dir ...`，
golden 不可自动再生成）；`tests/v1-fixture.test.js` 只做 current-v1 vs golden 比对。

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
