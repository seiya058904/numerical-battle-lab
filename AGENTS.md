# AGENTS.md — 给 Coding Agent 的仓库入口

> 这是 `数值对战实验室`（Numerical Battle Lab）的工作指引。进入本仓库后，请先读这里。

## 项目是什么

完全离线、纯单机、确定性的多实体回合制数值战斗系统。网页用“卡片”展示实体，但卡牌只是
Presentation；核心只处理 `CombatEntity + Skill + Formula + Modifier + Effect + Condition +
Target + Event + Status + Resource`。产品形态是「本地创造沙盒 + AI 自动观战」。

## Numerical System Source of Truth（必须先读）

**在改动任何卡牌生成、平衡、AI 评估、BattlePower、战斗公式、预设、高级编辑器之前，先读：**

1. **Canonical Numerical Knowledge Registry** — `src/numerical-knowledge.js`
   （+ 底层注册表 `src/components.js` 的 `PARAMETER_CATALOG` / EFFECT / CONDITION / TARGET /
   EVENT / MODIFIER_OPERATIONS）。这是所有参数/效果/条件/事件/公式变量的**唯一真源**：
   `NCB.NUMERICAL_KNOWLEDGE()` 返回完整 registry；`NCB.knowledgeSearch()` /
   `NCB.knowledgeLookup()` 提供查询。
2. **自动生成的参考文档** — `docs/CARD-NUMERICAL-REFERENCE.md`
   （**GENERATED FROM CANONICAL — DO NOT HAND EDIT**，由 `npm run numerical-reference` 重新生成）。
3. **相关引擎测试** — `tests/*.test.js`，尤其是 `tests/numerical-knowledge.test.js`
   （覆盖 registry、搜索、60 预设零缺口、扰动验证）。

**不要凭变量名字猜语义。** 每个参数都应能从 registry 找到：它是什么、谁读取它、调高/调低
会怎样、和什么交互、AI/BattlePower 如何理解、用户提什么需求时改它（tuningGuidance /
userIntentExamples）。

## 常见需求 → 应改什么（来自 registry 的 tuningGuidance）

| 用户说 | 应检查 | 不要首先改 |
|---|---|---|
| “卡牌后期成长还不明显” | `RAMP_START` / `RAMP_RATE` / `RAMP_CAP` / `ROUND` / Battle Wear | 基础 `ATK` 或 rarity budget |
| “高波动卡还是太稳定” | `VOLATILITY` / `LUCK` / `varianceMin` / `varianceMax` / canonical PRNG | 全局伤害倍率 |
| “治疗卡拖得太久” | `HEAL_POWER` / `HEAL_TAKEN` / `ENDURANCE` / `FATIGUE` / Battle Wear / AI heal utility | 设计新的全局伤害机制 |
| “爆发卡后期仍然太强” | `FATIGUE_START` / `FATIGUE_RATE` / `FATIGUE_CAP` | 全局改基础数值 |
| “所有卡后期都突然崩溃” | Battle Wear 与生成分布 | 简单提高 `FATIGUE_RATE` |
| “资源循环从不形成有效结果” | resource consumer / `CONVERT_RATIO` / `RESOURCE_GAIN_MOD` | 直接加资源 |

## 关键约束（改动前必读）

- **确定性**：战斗内所有随机必须走 canonical PRNG（`Gen5PRNG`，`kernel.js`）。禁止 `Math.random()`。
  同 `battle seed + card seed + actions + battle state` 必须精确复现。
- **公式安全**：`src/formula.js` 用随包固定的 Acorn 解析 + 严格白名单解释层，**禁止 `eval` / `new Function`**。
- **v1/v2/v3 legacy**：`generateCardByVersion(1|2|3)` 必须逐字节复现历史版本；不要破坏
  Replay 兼容、deterministic reproduction、validator、Advanced Lab。
- **Generator v4 无职业**：v4 不接受 `archetype` 输入；identity 不得含职业词汇。Behavior
  Analyzer（`src/behavior.js`）是**事后**分析，纯 Presentation，**AI 与引擎不得读取 tags**。
- **BattlePower 唯一真源**：展示/诊断用 `battlePowerV2(card).power`（v4 卡）；引擎**不得**读取
  `.power`。系统预设的 `presentation.power` 必须等于 canonical（60/60 一致性测试保护）。
- **预设无专属引擎代码**：系统预设（`content/presets-v4.json`）只能由统一 Card Schema 表达；
  禁止 `if (card.id === ...) damage *= 2`。
- **数值知识强制**：任何新增/修改的 Generator 字段、Effect、Condition、Event、Formula 符号，
  都必须在 `src/numerical-knowledge.js` 有完整解释，否则 `scripts/audit-numerical-coverage.js`
  会 FAIL（`undocumentedActiveFields = 0` 是硬要求）。

## 常用命令

```bash
npm test                       # 全量 Node 行为测试（含 v1-v5、预设、数值知识、随机/先手）
npm run verify                 # catalog + 全量测试 + 静态架构/清单门禁
npm run verify:release         # verify + diversity
npm run diversity:v4           # 10000 张 v4 卡多样性审计 → qa/diversity-v4.json
npm run calibration:v4         # BattlePower v2 经验校准 → qa/power-v4-calibration.json
npm run migrate:presets-v5     # 从 presets-v4 迁移生成 content/presets-v5.{json,js}
npm run audit:power-envelope   # v5 强度审计：包络/等级/稀有度/跨稀有度 Monte Carlo → qa/power-envelope-v5.json
npm run audit:presets-v5       # v5 预设审计：包络表/唯一名/结构一致性 → qa/presets-v5-audit.json
npm run audit:naming           # Name Generator v3 审计（10k 唯一率/生僻字/禁用后缀/长度分布）→ qa/naming-v3-audit.json
npm run audit:empirical-strength # BP/稀有度 vs 真实胜率的大样本实证审计 → qa/empirical-strength.json
npm run numerical-reference    # 从 canonical registry 重新生成 docs/CARD-NUMERICAL-REFERENCE.md
node scripts/audit-v4-battles.js 3000   # 3000 场长局统计 → qa/v4-long-battles.json
node scripts/audit-v4-presets.js        # 60 预设实战审计 → qa/v4-preset-audit.json + docs/V4-PRESET-TABLE.md
node scripts/audit-numerical-coverage.js  # 数值知识覆盖审计（缺口=0，含 v4+v5 样本）
node scripts/audit-numerical-semantics.js # 参数扰动验证（文档描述 == 引擎行为）
node qa/browser-v4.js          # 真实 Chromium 移动/桌面 QA（需 playwright + 127.0.0.1:8774 静态服务）
node qa/browser-knowledge.js   # 数值百科 UI QA（同上）
node qa/browser-multi.js       # 多人显式编队 + 新种子/重开语义 QA（同上）
npm run manifest               # 重新生成 RELEASE-MANIFEST.json（提交新文件后必须）
```

提交新文件/修改后：先 `git add`，再 `npm run manifest`，暂存清单并 `npm run verify`。

## 架构地图（最短路径）

- `src/kernel.js` — Gen5PRNG + EventKernel + 行动排序（Priority → 随机先手 Initiative → 确定性兜底）
- `src/components.js` — 参数/效果/条件/目标/事件/修饰操作注册表（canonical 底层）
- `src/engine.js` — BattleEngine（伤害管线/资源/旧难度 AI/模拟/replay/Battle Wear/presentation frames）
- `src/ai.js` — 当前 canonical AI：`planAI(engine, team, "canonical")`；默认观战用它。非 canonical 难度显式保留旧 planner。不要仅修改 engine.js 内的 legacy skillScore。
- `src/formula.js` — Acorn + 白名单表达式解释层
- `src/gen-v4.js` — Generator v4（legacy：classless、连续预算、个体变量、时间机制）
- `src/gen-v5.js` — **Generator v5（默认）**：结构先于强度；同 seed 结构跨等级/稀有度不变；
  先生成结构 → 算 LevelScale → 算 Rarity PowerEnvelope → targetPower → battlepower-v3 有界校准
- `src/power-v5.js` — **Power Envelope v1**：LevelScale + 12 稀有度包络（min/target/max）+ 质量百分位
- `src/battlepower-v2.js` — BattlePower v2（legacy v4 估算器）
- `src/battlepower-v3.js` — **BattlePower v3（v5 canonical）**：只读真实数值、绝不读稀有度/等级/clamp
- `src/name-generator-v2.js` — **Name Generator v2（legacy）**：旧物种命名语法（保留兼容）
- `src/name-generator-v3.js` — **Name Generator v3（默认）**：可读音节语素命名；6 个纯语音家族
  （ROUND/AGILE/HEAVY/SLEEK/WILD/ANCIENT），2/3/4 字 = 10/70/20，5 字禁止；名字只由
  `seed` 决定（不看稀有度/等级/BP/机制指纹）；官方 60 预设为人工定稿名称（apply-preset-names-v3）
- `src/behavior.js` — Behavior Analyzer（事后 tags/summary，Presentation only）
- `src/numerical-knowledge.js` — **Canonical Numerical Knowledge Registry**（本文件）
- `src/card-browser.js` / `src/card-ui.js` / `src/app.js` — 卡牌浏览/详情/玩家 UI（多人显式编队 selectedTeams；普通对局新 seed；重开=新局）
- `content/presets-v4.json`(+`.js`) — 60 张 v4 冻结预设（legacy 兼容 fixture）
- `content/presets-v5.json`(+`.js`) — **60 张 v5 官方预设**（新名字 + 全部落入 Level×Rarity 包络，mechanicFingerprint 保留）
- `scripts/migrate-presets-v5.js` — v4→v5 预设迁移（重命名 + 数值重校准，结构不变）
- `scripts/audit-v5-strength.js` / `audit-presets-v5.js` / `audit-naming-v3.js` / `apply-preset-names-v3.js` — v5 强度/预设/命名审计
- `scripts/audit-*.js` — 多样性/长局/预设/数值知识/语义审计
- `docs/GENERATOR-V4*.md` / `docs/CARD-NUMERICAL-REFERENCE.md` / `docs/V4-PRESET-*.md` — 文档

## 审计证据的边界

- 数值 coverage 零缺口只证明字段可查，不能证明所有参数都有扰动测试；当前语义审计覆盖 ATK、LIFESTEAL、VOLATILITY、RAMP、FATIGUE、HEAL_POWER 六条。
- AI 的当前状态效用不是多回合搜索。长局、条件链、资源与伤害 EV 的近似局限见 `docs/FINAL-VISION-AUDIT.md`。
- 卡面缓存由 `cardPresentationSignature` 统一失效；修改 schema / 战力权重后，验证 metadata 与 canonical 计算一致。
