# Generator v3 — 产品重构验证报告

> 本轮产品目标：**Simple Outside, Deep Inside.** 极简黑白卡牌 + 高维数值内核 + AI 自动对战观战 + 自由创造沙盒。
> 这是对既有确定性战斗内核的一次方向重构，不是重写：Formula / Effect / Condition / Target / Event / Status / Resource 等通用组件全部保留。

## 1. Git 基线

- **OLD HEAD**: `b590eb7` `manifest: refresh .github/workflows/verify.yml size entry`（分支 `main`）
- **NEW HEAD**: `1ef06f1`（内容主提交 `3fc145a` + 文档哈希跟进提交；工作树保持干净，仅包含本轮 v3 文件）
- **本地未提交基线**：接手时工作树已含上一轮 v3 实现（未提交），本报告基于该实现做完整验证并整理提交。

## 2. 修改文件

### 新增（本轮）
- `src/ai.js` — canonical utility AI（通用效用评分，无 archetype 硬编码分支）
- `src/gen-v3.js` — Generator v3（seed 确定性、2–6 Action、机制指纹、rarity 预算缩放）
- `scripts/diversity-audit.js` — 3000 样本多样性审计
- `tests/actions-v3.test.js` — Action 模型
- `tests/ai-v3.test.js` — AI 行为
- `tests/gen-v3.test.js` — Generator v3
- `tests/v3-safety.test.js` — 多样性 + rarity 方向 + 安全边界
- `docs/GENERATOR-V3.md` — Generator v3 架构文档
- `docs/GENERATOR-V3-REPORT.md` — 本验证报告
- `docs/superpowers/plans/2026-09-07-generator-v3.md` — 执行计划
- `qa/*`（`browser-v3.json`, `diversity-v3.json` 及桌面/移动截图）— QA 产物

### 修改
- `src/engine.js` — `getLegalActions` 别名；Action 堆叠顺序；`maxRounds`（默认 100，范围 1–1000，到界判 Draw）；`_effectWork` 每轮 8192 次递归上限；replay **v2**（内嵌 `content` 定义 + `maxRounds`）与 `restoreReplayContent`；`runSimulation` 默认 canonical AI
- `src/validator.js` — 非有限数 / 循环 JSON / 超限结构工作（100k 节点/深度 32）/ 爆炸 repeat 的拒绝
- `src/validator.js` — 循环检测与安全遍历前置
- `src/card-ui.js` — Presentation Adapter（`presentCard` / `describeAction`）；黑白极简卡面（去掉战力数字、内部系数）；行动列表
- `src/app.js` — 默认 **AI vs AI 自动观战** + 暂停/单步/调速/重开；默认 1v1；删除对手难度；等级自由整数输入；高级设置收纳 1–6 人数与最大回合；卡牌 JSON 编辑；演示卡
- `index.html` — 脚本顺序加 `ai.js` / `gen-v3.js`；黑白 light 主题元数据
- `styles.css` — 黑白极简主题
- `README.md` — 新方向 + v3 验证说明
- `docs/ARCHITECTURE.md` — 追加 §14 Generator v3 与 Action 边界
- `docs/GENERATOR.md` — 标记为 Legacy 历史文档
- `package.json` — `verify:release` 改为 `verify + diversity`；`diversity` 脚本；`diagnostics:legacy` 保留旧公平性工具但退出码不阻断发布
- `tests/engine.test.js` — 公平性 band 断言降级为诊断输出
- `tests/gen-v2.test.js` — 删除 v2 硬 Gate（≥2 damage / heal≤1 / shield≤1 / sustain 上限），改为诊断输出

## 3. Action 架构说明

- Skill（技能）在底层引擎中是稳定的可执行结构，**保留不动**（§7：功能正确性高于机械重命名）。
- 产品层新增 **Action（行动）** 概念，`getCardActions(card)` 同时接受 `actions` 或 `skills` 两种 schema 并做适配。
- `BattleEngine.getLegalActions(entityId)` 别名既有合法性 Skill 程序 —— **没有系统级注入的默认普通攻击**。
- Generator v3 每张卡生成 **2–6 个 Action**，权重分布 `[2,3,3,3,3,4,4,4,4,5,6]`（3–4 最常见，2 与 5–6 较稀有）。攻击只是 Action 的其中一种；允许多治疗、多护盾、纯状态、无直接伤害的卡。
- `assembleCardPack` 把 Actions 翻译为底层 Skill schema，并纳入引用的 status / affinity / resource regen。保存的卡保留其生成版本，同 seed 再生成尊重版本。

## 4. Generator v3 说明

- 目标：生成**大量结构、数值、机制明显不同但全部合法**的卡，**不是平衡**卡（§11）。
- 保留 deterministic seed、同 seed 复现、schema validation、replay 兼容、v1/v2 legacy 复现（`generateCardByVersion(1|2)` 不改）。
- `scale = RPI/100 * levelFactor(level) * qualityFactor(seed)`；`generationBudget = 1000 * scale`；Primary 属性 / Action 系数 / 被动与 Trigger 幅度随该 budget 线性缩放。**Rarity 从不作为 Engine 内伤害标签加成**。
- 机制覆盖（每张独立组合）：damage / recoil / heal / shield / ward / status / toggleStatus / dot / consumeStatus(蚀爆) / cleanse / dispel / resource gain / convertResource / cooldownReduce / selfDamagePct / conditional(条件分支) / repeat / emitEvent；Damage Components / 多伤害类型 / 穿透 / crit bonus / variance / resource 依赖公式 / 目标 query / 多资源与 HP cost / Priority / Cooldown。
- **不再调用 v2 的 `enforceComposition()` / `enforceSustainCeiling()` / pressure-floor / sustain-ceiling**（这些只留在显式 `generatorVersion:2` 的 legacy 路径）。生成过程不偷偷把合法卡改得更接近标准输出构筑。
- `mechanicFingerprint`：剔除 id/标签/数值/seed，保留公式符号与分支结构，同结构不同数值归为相近指纹。
- 安全边界：每张卡组装后 `validateContentPack` 校验；Effect 递归上限 8192/轮 `_effectWork`；maxRounds 兜底（纯防御镜像判 Draw 合法，Generator 不"修复"）；canonical 随机仍用 Gen5PRNG；replay v2 内嵌 content 可跨页面复现。

## 5. AI 说明

- 默认双方使用同一个 **canonical utility AI**（`planCanonicalAI`）；保留 easy/normal/hard 旧难度仅作实验室调用，`planAI(team,'canonical')` 为默认。
- 枚举合法 Action × 合法 Target，从 **Action 数据** 计算效用评分，**无 archetype 硬编码分支**（archetype 只影响生成概率偏好，不影响决策分支）。
- 效用项：预计直接伤害（含防御/抗性/暴击/穿透）、击杀与收割价值、治疗价值与**过量治疗惩罚**、Shield 容量、Status/Stack 价值（最多看 3 个周期 tick）、Consume 结算、Cleanse/Dispel、资源收益（受资源上限与行动需求钳制）与消耗、Cooldown、Action Priority、条件分支（当前战场状态）、emitEvent 触发链（有界）、重复状态避免。
- AI 为**无副作用规划**：在计划阶段不消耗 battle RNG、不改变战场状态（测试断言 snapshot 不变）；AI vs AI 确定性可复现。
- **限制**：这是有界启发式规划器，不是穷举 minimax，无法精确预测对手全部选择与全部事件链；允许较次但合法、不越界的选择。

## 6. Rarity 数值关系

- 保留 12 档体系，RPI 单调 `C=100 → XS_COLLECTOR=245`：`C 100, C+ 108, B 118, B+ 129, A 141, A+ 154, S 169, SS 187, SSS 207, SSS典藏 218, XS 232, XS典藏 245`。
- 同 level 下 budget、Primary 属性、Action 系数、被动/Trigger 幅度随 RPI 上升（测试：跨 12 档 budget 单调增、fingerprint 不变、关键基础值不低于前一档）。
- 大跨度 C vs XS 的实际镜像对抗 sanity probe：`{"high":25,"low":0,"draw":23}` —— 高 rarity 明显占优（25 胜 0 负 23 平）。不要求精确胜率，不反向拟合 Generator。

## 7. Diversity Audit 数据（`npm run diversity`，3000 样本，已写入 `qa/diversity-v3.json`）

```
samples: 3000
actionCounts:  {2:265, 3:1084, 4:1126, 5:250, 6:275}          # 3–4 最常见，2/5–6 较稀有
effectCoverage: heals/status/shield/damage/gain/conditional/repeat/cleanse/dispel/consumeStatus/toggleStatus/convertResource/ward/selfDamagePct/cooldownReduce/emitEvent/resource  → 17 种
conditionCoverage: hpPctBelow/targetHpPctBelow/resourceAtLeast/targetHasStatus/missingStatus → 5 种
eventCoverage: afterKill/afterDamageTaken/afterDamageDealt/roundStart/roundEnd/ModifyDamageTaken → 6 种
damageTypeCoverage: physical/toxic/bleed/lightning/fire/arcane/true/frost → 8 种
resourceCoverage: RAGE/SOUL/CHRONO/ENERGY/HP → 5 种
statusInteractionCoverage: stack/refresh/replace/dynamic/apply/toggle/consume/targetHas/missing → 10 项
targetCoverage: self/enemy/ally/query(query:enemy/query:ally)/source → 7 项
triggerCoverage: roundStart/roundEnd/afterDamageTaken/afterDamageDealt/afterKill → 5 项
uniqueFingerprints: 3000     uniqueActionStructures: 7628     duplicateRate: 0
nonDamage: 1227     multiHeal: 79     multiShield: 262     multiStatus: 562
```

3000 个不同指纹、0 重复 —— 未集中成"两个攻击+一个辅助"式伪多样性；多治疗/多护盾/多状态/无攻击卡全部真实出现。

## 8. UI 改动（黑白极简）

- 整体黑白 / 浅灰背景 / 黑线粗轮廓 / 少量识别性灰阶；去掉霓虹、彩色 rarity 大框、复杂渐变。
- 卡面：名称、Lv、稀有度、HP/攻击/防御/速度，+ 一句话战斗风格摘要 + 行动列表；**不显示 coefficient/formula/BattlePower**（Presentation Adapter 压缩内部数据）。高级编辑可看完整 JSON 与全部数值。
- 战斗观战：左方 VS 右方，`开始/暂停/继续/下一步/1×/2×/4×/重开`；默认纯 AI 自动；手动接管与"编辑左方卡牌"收进「实验控制」高级区域。
- 对手难度删除；等级改为自由整数输入(1–100)；Seed 收进高级折叠区；创建页极简（稀有度/等级/定位/随机生成）。
- 战斗记录讲"战斗故事"：`黑潮兽 使用【撕咬】 → 白岩兽受到 84 伤害`，点"计算详情"才展开公式/系数/暴击等内部明细；普通日志只渲染最近 200 行。
- 卡牌库 = 本地保存的创作结果，含 编辑/复制/删除/立即对战/同种子再生成；无收集奖励。
- 高级实验室完整保留：数值编辑、Formula、JSON、Trace、Replay、批量模拟、内容架构、组件目录。

## 9. 删除 / 降级了哪些旧公平性 Gate

- `verify:release` 不再运行 `health-metrics / adjacent-rarity-matrix / matched-rarity-test / power-calibration / similar-bp-test`（它们改为 `diagnostics:legacy`，退出码不作为 v3 发布阻断）。
- `tests/gen-v2.test.js`：删除"每卡 ≥2 个伤害技能 / heal≤1 / shield≤1 / status≤1 / heal+shield≤1 / one-shot<5% / stalemate<5%" 的 release blocker 断言 → 改为诊断输出。
- `tests/engine.test.js`：默认 4v4 的 competitive band（38–62%）与 mirror band（40–60%）→ 改为诊断，不再作为断言。
- Generator v3 完全不调用 `enforceComposition` / `enforceSustainCeiling` / pressure-floor / sustain-ceiling。
- 以上统计仍可继续跑（诊断工具），**不阻止 release**。

## 10. 自动测试结果

- `npm test`：**193 passed / 0 failed / 0 skipped**（含全部规则正确性、legacy fixture、Action、AI、生成多样性、rarity 方向、安全边界）。
- `npm run verify`：**static checks: PASS · 91 parameters · 18 effects · v1.2.3 manifest audited (86 files)**；193 测试全过。
- `npm run diversity`：3000 样本，exit 0。
- End-to-end probe（本报告作者复测）：
  - 1v1 AI vs AI（A rarity Lv37）：4 回合分出胜负，replay snapshot 完全一致，无 NaN。
  - 3v3 AI vs AI（B rarity Lv20）：5 回合分出胜负，253 条日志，replay 一致，无 NaN/Infinity。

## 11. Browser QA（Playwright，Chromium，桌面 1440×1000 + 移动 390×844）

`qa/browser-v3.json` 25 项检查全部通过、`errors: []`，覆盖：

- 页面身份、任意等级 37、无公式泄漏、两卡保存、刷新持久化、复制、非法 JSON 拒绝、完整卡编辑保存
- 正常创建流程**无难度选项**、默认 1v1、暂停稳定、单步推进并保持暂停、调速、继续推进、重开恢复双方
- 自动对战到终局、高级 3v3 保留并可结算
- 桌面无横向溢出；移动端 3v3 / 1v1 / 创建 / 卡牌库均无横向溢出；无页面错误

截图：`qa/v3-battle-desktop.png`、`qa/v3-battle-mobile.png`、`qa/v3-create-desktop.png`、`qa/v3-create-mobile.png`。

## 12. 已知限制

- AI 是有界启发式规划器，能稳定产出有趣战术，但非全局最优（胜负仍有运/克制因素，这是设计意图）。
- 某些极端卡可能造成秒杀 / 长时间 / 强克制 / Draw，但受 maxRounds + `_effectWork` 8192 + validator 结构性安全上限 + replay 界限约束，**不会挂死浏览器**。
- `tests/gen-v2.test.js` 的 v2 组合测试中保留了几个仅计算但不再断言的局部变量（cosmetic，不影响正确性）。
- generator 默认版本为 v3；旧浏览器缓存中的 v2 卡在保存后仍按 v2 复现（够合理，未做强制迁移）。

## 13. Ready for Human Review

**是。** 外部极简、内部高维差分、AI 自动对战可观赏、创建/选择/观察为主行为；193 测试 + verify + diversity + browser(mobile/desktop) 全部通过，工作树整理后干净，符合 §38 完成标准。