# FINAL-REPORT — NUMERICAL // 数值对战实验室

**Status:** v1.0.1 baseline · all final gates green · competencies verified in this environment

## 1. 项目最终结构

纯离线、单机、确定性的多实体回合制数值战斗系统。网页以“卡片”呈现实体，但卡牌只是
Presentation Adapter；核心只处理 `CombatEntity + Skill + Formula + Modifier + Effect +
Condition + Target + Event + Status + Resource + Damage Component`。

```
NUMERICAL-BATTLE-LAB-v1.0.0/
├── index.html                 # 单页离线入口（无 CDN / 无服务器 / 无登录）
├── styles.css                 # 纯文本黑白功能优先 UI
├── package.json               # npm test / verify / catalog 脚本
├── src/
│   ├── kernel.js              # Gen5PRNG(Showdown) + EventKernel + action 排序
│   ├── components.js          # 组件注册表（参数/Effect/Condition/Target/Event/Modifier）
│   ├── rules.js               # 架构/能力/公式常量 知识面（Guide 视图读取）
│   ├── content.js             # 20 实体 / 63 技能 / 33 状态 / 默认阵容
│   ├── status-runtime.js      # 状态运行时（叠层/sustain/净化/驱散/触发器）
│   ├── validator.js           # 内容编译门禁（路径化错误）
│   ├── formula.js             # Acorn 8.15.0 + 严格白名单解释层
│   ├── effects.js             # Effect 执行器与 AI estimate（注册表）
│   ├── engine.js              # BattleEngine（伤害管线/目标/资源/AI/模拟/replay）
│   └── app.js                 # Web UI（对战/编辑器/模拟/规则/replay 导入导出）
├── scripts/
│   ├── generate-catalog.js    # 从组件注册表生成 md + json 目录
│   ├── static-check.js        # 静态架构门禁
│   └── stress-check.js        # 平衡/确定性/异常阵容压力门禁
├── tests/                     # engine.test.js + formula.test.js
├── docs/                      # ARCHITECTURE / COMPONENT-CATALOG(md+json) / PLUGIN-API / CONTENT-AUTHORING
├── qa/                        # browser-results / stress-results / desktop.png / mobile.png
├── third_party/               # acorn + pokemon-showdown 许可证溯源
├── vendor/acorn-8.15.0.js     # 随包锁定的 AST 解析器
├── THIRD_PARTY_NOTICES.md
└── .gitignore                 # （本次新增）
```

工作区：`D:\xia zai\AI project\pk\2\NUMERICAL-BATTLE-LAB-v1.0.0`（已 `git init`，
基线提交 `adec7c4`。MTP：源来自 `D:\下载\NUMERICAL-BATTLE-LAB-v1.0.0.zip`，兄弟目录
`pk\1` 仅作只读参考，未改动）。

## 2. 测试总数

- **98** 个自动化测试，全部通过（`node --test`）。
- 覆盖：确定性、modifier 顺序、公式验证/执行、目标查询、触发顺序、触发循环保护、
  资源原子支付、状态叠层、sustain、伤害分量、ward/shield、净化/驱散/夺取、多段、
  miss/crit 上下文、击杀事件、replay、AI RNG 分离、重放复现、内容校验、插件扩展、
  组件目录、普通镜像平衡等。
- 本次新增 1 个测试：`default 4v4 mirror combined rate stays within the competitive band`。

## 3–9. 能力面计数（`generate-catalog.js` 从注册表生成，单一数据源）

| 维度 | 数量 |
|---|---|
| Numeric / Rule 参数 | **91** |
| Effect 组件 | **18** |
| Condition 组件 | **27** |
| Target 组件 | **8**（含通用 Query Target） |
| Event 插入点 | **28** |
| Damage Type | **8**（注册式，可扩展） |
| Demo Entity | **20** |
| Demo Skill | **63** |
| Demo Status | **33** |

## 10. 借用/参考的成熟项目

- **Pokémon Showdown (MIT)**：确定性 Gen5 PRNG 算法、行动排序/平局语义、relay-event
  内核——随包保留许可证与固定审计 commit（`third_party/pokemon-showdown/`）。
- **Acorn 8.15.0 (MIT)**：随包 vendor 的表达式 AST 解析器（`vendor/`），由严格白名单
  解释层执行，零 `eval/new Function`、完全离线、Node/浏览器同一语义。
- 仅作机制/架构参考，不复制受限制源码：Cataclysm-DDA（复合 damage unit）、Wesnoth
  （weapon special 修改面）、ToME（多资源/Sustain/抗性穿透）、Freeciv/Unciv
  （Requirement+Effect 数据化）、Smogon 伤害计算器（分段结算）、XMage/Forge（触发/
  替换/常驻效果架构）。详见 `THIRD_PARTY_NOTICES.md`。

## 11. 哪些区域是自写"胶水/专有"代码

- **公式 DSL 白名单解释层**（`formula.js`）：Acorn 提供 AST，白名单遍历与纯粹求值、
  变量白名单、有限数校验是项目自写的安全薄层。
- **Damage 管线**（`engine.js` computeDamage/applyDamagePacket）：公式→命中→暴击→
  复合分量→防御/穿透→Ward/Shield→HP→汲取/反噬 的组装，以及伤害类型注册表。
- **状态运行时**（`status-runtime.js`）：叠层策略、sustain 维持判定、净化/驱散/夺取。
- **通用战术 AI 与效用量化**（`effects.js` estimate + `engine.js` skillScore/planAI）：
  全部基于预期伤害/治疗/护盾/状态/资源收益，没有以技能 ID 特判；AI 使用独立确定性
  RNG 流（`plannerRng=engine.prng.clone()`），不污染 canonical 战斗 RNG。
- **Web UI 绑定层**（`app.js`）：引擎之上的展示/编辑/模拟/导入导出胶水。

## 12. 已知限制

- 战斗按 priority/speed 顺序**顺序结算**（非同步分片）；相同/镜像阵容下先手方约
  -2~6 个百分点（机制特性，已通过普通/镜像测试确认非缺陷）。
- 默认演示内容（20 实体）是"组件语言示范组合"，不承诺任意自定义内容包都平衡；
  平衡目标只针对默认 4v4 普通/镜像（本次已调到 59.5%）。
- 单一进程内多生成本地，无网络多人/服务端/持久化存取（按既定范围刻意不做）。
- 数值引擎成熟但**专注于规则深度**：不包含美术/动画；UI 为纯文本黑白功能优先。
- 编辑器的"高级组件"仍需以 JSON 程序块编辑（Damage Components / Target Query /
  Requirements / Effects / Modifiers / Triggers 均公开可编辑），尚无表单化向导式
  装配、撤销/重做、跨版本内容迁移。这是下一步最适合扩展的产品面。

## 13. 下一步可扩展方向

- **Form 化组件装配器**：把 Skill/Status 的组件程序做成可视化表单（condition 树、
  modifier 带、damage component）并生成内容包，强化"构建套件"易用性。
- **插值/曲线数值**、多帧快速模拟、matchup 矩阵（成本允许时）。
- 更多机制样板（清单内已具备多数：Burn→detonate、Poison 递增、盾墙、Ward 专精、
  Rage/Soul/Chrono/HP 经济、Sustain、反击、夺取、净化、多段、斩杀、缺血增幅、抗性
  削减、资源封锁、团队光环、死亡触发器、状态转移、伤害转化等），按需以**新示例
  内容**而非硬编码加入。
- **内容版本化与迁移**：素材包 schema version 管理，平滑升级自定义内容。

---

## 验证门禁（本环境重测）

```
ALL TESTS PASS        ✔ 98/98
STATIC CHECK PASS     ✔ 静态门禁通过（91 参数 / 18 Effect）
CONTENT COMPILE PASS  ✔ validateContentPack + verify 全部通过
DETERMINISM PASS      ✔ replay 精确复现；25 个成对确定性案例一致
BROWSER QA PASS       ✔ Chromium 1440×1000：无 JS 错误、无横向溢出、对战/AI/编辑器/
                        模拟(500局)/规则/replay 全部可用；无效公式提示错误
MOBILE QA PASS        ✔ Chromium 390×844：无横向溢出、对战可打到胜负、无 NaN/错误
BALANCE SMOKE PASS    ✔ 默认 4v4 镜像 combined 59.5%（40–60% 带内）
```

附注：浏览器控制台仅有 1 条 `favicon.ico` 404（非引擎错误，可忽略）。