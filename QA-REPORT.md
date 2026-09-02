# QA 报告 — v1.2.1

发布候选：`数值对战实验室` v1.2.1（战力可信度与相邻稀有度校准）

## 自动化验证

新源码树验证命令：

```bash
npm run verify
```

结果：**全量测试通过**，静态架构检查通过（v1.2.1 版本门禁 + manifest 审计）。

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

## 战力校准（v1.2.1 三分离门禁）

`scripts/power-calibration.js`：TRAIN / VALIDATION / FINAL_TEST 三套 seed 完全分离；
`fitBattlePowerWeights()` 在 TRAIN 上自动拟合，VALIDATION 按 Spearman + similar-BP
fairness 选模型，FINAL_TEST 只跑一次（§13A/§14）。

```text
Spearman VALIDATION: fitted 0.807 · committed 0.663 · balanced 0.698
similar-BP fairness (direct <=5% battles): fitted 0.736 · committed 0.722 · balanced 0.617
SELECTED (validation): wA -> {offense 0.22, durability 0.45, tempo 0.25, ...}
Spearman FINAL_TEST (selected, run once): 0.735   (validation target >= 0.70)
pairwise ordering accuracy (direct 正反位): validation 0.750  (target >= 0.75)
similar-BP fairness (selected weights): 0.560  (ideal ~0.50)
win-probability model: b0=0.038 b1=1.319 Brier=0.212 LogLoss=0.616 n=120
CALIBRATION PASS ✔
```

## 相邻稀有度矩阵（v1.2.1 新增）

`scripts/adjacent-rarity-matrix.js`：11 组（C→C+ … XS→XS典藏），
6 定位 × 6 种子 × 10 局 × 正反位（每组 5040 局），输出 winRateHigherTier / 95% CI / n。

```text
ALL ADJACENT DIRECTION CORRECT: YES   (A→A+ 0.535, S→SS 0.566, XS→XS典藏 0.540 等)
strictMonotonic = YES (所有相邻档 mean[n+1] > mean[n]，CI 下界全部 > 0.5)
```

## 统计口径（v1.2.1 修正）

- `rarityStrictMonotonic`（相邻 mean 单调）与 `rarityTrendAcceptable`（允许采样波动）
  分离报告，禁止把 trend acceptable 写成 strict monotonic YES。
- BattlePower 口径：1v1 通用强度排序指标；3 主评分维度 + 4 诊断维度。
- UI 移除精确预估胜率百分比 → `战力较高 / 战力接近 / 战力较低`（`card-ui.bpRelation`）。

## Generator 平衡（v1.2 深度重调 + v1.2.1 保留）

`docs/GENERATOR-BALANCE-v1.2.md` 记录：

- 第一回合秒杀率：**0.0%**（目标 <5%）
- 僵局率：**1.7%**（目标 <5%）
- 战斗时长中位数：**8 回合**（目标 6–10）
- v1.2.1 `V2_BUDGET_CURVE` 修正相邻档：A→A+（0.501→0.535）、XS→XS典藏（0.493→0.540）

## v1 历史 fixture（v1.2.1 新增）

`tests/fixtures/generator-v1.1.0.json`：189 张代表旧卡 sha256(canonicalGeneratedCard)
锁定，v1 byte-for-byte 防漂移（`tests/v1-fixture.test.js`）。

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
