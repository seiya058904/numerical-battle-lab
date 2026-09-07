# Generator v4 — Classless Dynamic Generation 交付报告

> 产品目标：**不要生成一个“职业”，要生成一个“个体”。** 随机不是混乱，而是可复现的个体差异。
> 移动端观战按事件讲故事，而不是把整个回合的数字同时砸到屏幕上。

---

## 1. Git

- **Baseline / origin/main**: `bac01ac`（`feat(ui): add system presets and show rarity/level/BattlePower in battle`）
- **内容主提交（稳定锚点）**: `94c7f4f` → 本轮在新提交中收尾（见 §Git 构建），全程继续在 `main`，0 behind / ahead-only
- **Push**: fast-forward，无 force push。收尾后本地与远端 0/0。
- **本地接手基线**: 接手时工作树已含另一 AI 的 v4 实现（5 个已提交 feat(v4) + 未提交的预设/浏览器/展示重构）。本轮负责收尾：修 gen-v3 默认派发测试、修复 browser QA 的 404（缺 favicon）、补齐文档/报告/manifest、跑完整验证、整理提交并推送。

## 2. 生成层：完全取消职业

- v4 生成输入 **没有 `archetype`**（传入即 throw，测试覆盖）；identity 不含
  `Balanced/Tank/Bruiser/Assassin/Mage/Support/Controller`。
- 创建页面删除「类型定位」；卡面不显示职业字符。
- Primary 采用**连续随机确定性预算分配**（`allocatePrimaryV4`），sum 精确等于预算；
  无 7 种预置比例。
- Action family 加权只依赖**已生成的真实数值**（CRIT/HEAL_POWER/DEF/ENERGY_REGEN…），
  是概率相关，永不白名单。
- `scripts/diversity-audit-v4.js`（10000 卡）证明 classless：identity 无 archetype 词汇、0 职业引用。
- legacy v1/v2/v3 完整保留：`generateCardByVersion(1|2|3)` 仍逐字节复现历史（
  `Generator v1 matches the v1.1.0 historical fixture` 测试通过）。

## 3. 个体层随机参数（§8）

- `VOLATILITY` / `LUCK` 进入伤害期望与方差；`CONSISTENCY` 收敛为 VOLATILITY 的反相（不制造无作用字段）。
- 全部随机走 canonical Gen5PRNG：同 battle seed 精确复现 variance / crit / hit / status / target / LUCK（
  `VOLATILITY widens damage variance; LUCK biases the distribution; same battle seed reproduces exactly` 测试通过）。

## 4. 时间层（§10–13）

- Formula scope 增加可读 `ROUND` / `BATTLE_TURN`（安全白名单解释层，无 eval；
  `ROUND and BATTLE_TURN are readable in formulas` 测试通过）。
- 每卡真实参与战斗的 `ENDURANCE / RAMP_START/RATE/CAP / FATIGUE_START/RATE/CAP`。
- 10,000 卡时间画像分布：stable 1799 · fatigue 3833 · ramp 2746 · mixed 1622 —— 四种时间行为都覆盖。

## 5. 长局收敛 Battle Wear（§14–19）

- `applyBattleWear` 逐实体、按 ROUND+ENDURANCE+FATIGUE 增长；受疗效率随 `_wear` 下降；
  约 12 回合后启动**不可完全恢复的最大生命衰减**；wear 伤害穿透护盾/护符。
- 硬化测试通过：`real extreme sustain AI cannot offset terminal wear`
  （MAX_HP×100 治疗 + ×0.01 承伤也不能拖到 maxRounds）、
  `sustain plus reduction cannot round wear damage to zero forever`、
  `Battle Wear forces convergence: heal-vs-heal ends before maxRounds`。
- legacy 回放经 `rulesVersion` 隔离：`legacy battles retain HP over long idle rounds` 通过（v1/v2/v3 不变）。

### 3000 场随机 v4 1v1（`scripts/audit-v4-battles.js 3000`，结果写入 `qa/v4-long-battles.json`）

| 指标 | 值 |
|---|---|
| 样本 | 3000 · maxRounds 100 |
| median 回合 | 5 |
| P90 / P95 / max | 61 / 69 / 88 |
| **maxRounds rate** | **0.000（0%）< 1% 目标** |
| draw rate | 1.17% |
| ≤3 回合 rate | 41.3% |
| >40 回合 rate | 26.5% |

> 大量治疗/盾卡不再普遍打到 maxRounds；收敛压力真实有效。

## 6. Behavior Analyzer（§29–32，§61）

- 纯事后分析：generate → finalize → analyze。tags（2–4）+ summary。
- 60 张预设各自得到:如「高波动 · 后期成长 · 吸血」等，卡面上无职业。
- **tags 不参与生成、不参与 AI 决策**（AI 只读真实 stats/actions/state）；`analyzeBehavior` 只作 Presentation。
- 旧 v3 卡保留 `archetype` 数据字段，UI 改用 Behavior 描述。

## 7. BattlePower v2（§20–27）

`power ≈ round(base × mechanicFactor)`，base=generationBudget（RPI×levelFactor×quality），递归抽取机制特征 vs 参考卡。

### 硬门槛测试（全部通过）

- **同 seed + Lv50，12 rarity 严格递增**：C 389 → C_PLUS 453 → B 547 → B_PLUS 659 → A 802 → A_PLUS 969 → S 1175 → SS 1455 → SSS 1821 → SSS典藏 2049 → XS 2344 → XS典藏 2640。
- **同 seed + 同 rarity（A）level ladder 递增**：Lv10 351 → Lv30 591 → Lv50 873 → Lv70 1225 → Lv90 1623。
- **大小额差不平塌**：XS_COLLECTOR > C×1.3，且 40 对样本不塌缩成少数相同整数（≥50 不同值）。
- **机制递归提升战力**：同属性加 crit/lifesteal/ramp/repeat/consume → BP 提升 >1.1×。
- **引擎零引用**：`engine.js` 不出现 battlePowerV2/.power（display-only，§27）。

### 经验校准（`npm run calibration:v4` → `qa/power-v4-calibration.json`）

| 指标 | 值 | §26 建议目标 |
|---|---|---|
| Spearman（BP vs canonical AI Elo） | **0.765** | ≥0.80 |
| pairwise ordering accuracy | **0.807** | ≥0.85 |
| nCards / pairs | 72 / 1256 | — |

**真实值与原因（未伪造 PASS）**：BP v2 是静态 generic-strength 估计，而经验实力来自
battle seed 随机 + canonical AI 取舍 +  matchup 机制克制，天然含噪声；同级对局被大量
「机制克制 > 数值强弱」冲向相关均值。0.765 属于显著相关（§72 要求满足），方向正确
（rarity 中位数右移），但未达 0.80/0.85 建议线。已如实记录；未强行改写 BP 以免破坏
**严格单调的 rarity/level 梯子硬测试**（§23/§72 为硬要求）。

## 8. 系统预设（补充 §Q–Z，覆盖原 §44–56）

- **来源流程**：v4 候选生成 → 自动筛选 → 规则审查 →（无需数值微调）→ 冻结为正式内容。
- **候选与筛选**（`qa/v4-curation.json`）：
  - 生成候选 **9,600**，筛选后合格 **2,907**；
  - 按 slot 淘汰：time-profile 不符 1,588 · 缺 high-volatility 1,347 · 缺 ramp 1,346 ·
    缺 low-volatility 1,128 · 缺 fatigue 1,198 · resource-without-consumer 293 · cooldown-without-consumer 6；
  - 60 格全选（12 rarity×5）；**adjustedCards = 0** —— 精选结果已天然满足设计目标，无需 schema 微调；
    规则审查结论："No numerical tuning needed for selected candidates"。
- **冻结内容**：`content/presets-v4.json`（719 KB，60 张完整 canonical Card Schema）+ `content/presets-v4.js`（file:// 包装）。
  每张带 `originSeed / generatorVersion:4 / curated / curationVersion / designNote` provenance。
- **禁止专属引擎代码**：所有预设仅由 Schema（stats/actions/effects/conditions/statuses/triggers/
  resources/formula/time vars）表达。60 张全部 `generatorVersion:4`，全部通过 `validateContentPack`。

### 数量 / 稀有度 / 等级（`tests/presets.test.js`）

- 总数 **60**；12 rarity × **精确 5**。
- 每个等级十位带 **6 张**（≥4 要求）：10–19:6 · 20–29:6 · … · 90–99:6 · 100:6。
- 每 rarity 内 5 张等级跨度 ≥50（实测 span 72–80），覆盖 low/mid-low/mid/mid-high/high。
- 每 rarity 至少 1 低波动 + 1 高波动；整体行为标签、时间画像、波动充分分散。
- 名称唯一、id 唯一、mechanicFingerprint 无重复（audit errors 为空，nearDuplicates 为空）。
- 卡牌选择器/库不使用职业分组，可按稀有度/等级/特点筛。

### 预设审计（`scripts/audit-v4-presets.js` → `qa/v4-preset-audit.json`）

- 60 张 × 6 对手（同级/相近/上下 rarity）+ 镜像 = 420 场，全部由 canonical AI 实战。
- **errors: []**（无近重复、无 hard cap、无 resource-without-consumer、无废 Action）。
- 每张附 designNote，解释「为什么保留这张卡」（非职业，是展示动机）。

## 9. Mobile Presentation Timeline（§33–42，补充 §A–AB）

- Engine 增 `capturePresentation` 可选帧捕获：每次实际 HP/shield/status 变更或 action/event 边界
  记一帧 `{index, group, row, snapshot}`。UI 单 timeout 逐帧播放。
- 血条**逐事件同步**；每实体单 `combat-float-slot` 浮动数字队列（不重叠）。
- **Pause**：当前帧完成后停住，不偷偷推进 display state；queue 保留已算好结果。
- **Step**：推进一个 action/event group（不整轮几十 Trigger 一次砸出）。
- **Speed 1×/2×/4×**：只调整 timeline 调度，不改 engine 数学。
- 时间线最终 display 状态 == engine 最终状态（测试 `final display equals final engine`）。
- Playwright 390×844（Chromium mobile emulation）：**30/30 项通过**，无横向 overflow、无 console error，
  截图 `qa/v4-mobile-battle-1.png`、`qa/v4-mobile-battle-timeline.png`、`qa/v4-mobile-presets.png`、`qa/v4-desktop-battle.png`。

## 10. 测试与验证

- **`npm test`**：243 passed / 0 failed（含 v1/v2/v3 fixture、v4、presentation、card-browser、
  battlepower-v2、calibration-v4、v4-contracts、presets）。
- **`npm run verify`**：generate-catalog + npm test + static-check 通过（manifest 已含全部 tracked 文件）。
- **`npm run diversity:v4`**（10000 卡）：100% 唯一 mechanic fingerprint、0 重复；时间/波动/标签/等级/稀有度全覆盖；
  convergence probes（250 场）0 次 hard-cap。
- **`npm run calibration:v4`**（72/pairs 1256）：Spearman 0.765、pairwise 0.807、rarity 中位数右移（如上）。
- **预设审计**：60×7=420 场实战，无 hard cap / 无重复 / 无废 Action。
- **3000 场长局**：maxRounds rate 0%。
- **浏览器 QA**：30/30 项，390×844 + 桌面 1440×1000，截图存档，修复了缺 favicon 导致的 404。

## 11. 已知局限（如实报告）

1. **BP 经验校准未达 §26 建议线**（Spearman 0.765、pairwise 0.807 vs 建议 0.80/0.85）。
   已如实记录原因；为保护严格单调梯子硬测试未强行改动 BP 模型，可后续迭代权重。
2. **browser-v4 的 `playwright` 依赖全局安装**（项目未把 playwright 放入 devDependencies）；
   脚本在 CI/无全局 playwright 环境需 `npm i -D playwright` 后才可跑。
3. `presets.test.js` 复制用例保留一行 `copy.archetype`（v4 卡均为 undefined，断言等价通过），
   属无害残留，不影响断言语义。
4. 60 张预设 `adjustedCards=0` —— 说明精选已足够，但也意味着本轮没有针对极端卡做过
   进一步"雕琢式"手调；若未来要更强表达某些极端原型，可在保持 Schema 的前提下继续微调。
5. 「相似卡牌」（补充 §AA）本轮未实现（optional，判 clean）。