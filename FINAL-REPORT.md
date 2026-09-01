# FINAL-REPORT — NUMERICAL // 数值对战实验室

**Status:** v1.1.0 baseline · all final gates green · competencies verified in this environment

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
│   ├── power.js               # 【v1.1】稀有度 RPI + LevelFactor + CardPower + GenerationBudget + QualityFactor
│   ├── gen-stats.js           # 【v1.1】职业原型 + Primary/Secondary 数值分配（种子抖动/费用表）
│   ├── gen-skills.js          # 【v1.1】统一技能费用曲线 + 有限可装配配方库（13 配方）
│   ├── generator.js           # 【v1.1】15 步卡牌流水线 + schema + powerAudit + assembleCardPack + deployCard
│   ├── gen-balance.js         # 【v1.1】ExpectedWin 立方公式 + 稀有度对阵参考
│   └── app.js                 # Web UI（对战/编辑器/模拟/规则/replay 导入导出）
├── scripts/
│   ├── generate-catalog.js    # 从组件注册表生成 md + json 目录
│   ├── static-check.js        # 静态架构门禁
│   ├── stress-check.js        # 平衡/确定性/异常阵容压力门禁
│   └── gen-mc.js              # 【v1.1】蒙特卡洛期望胜率冒烟（报告性质，非硬性门禁）
├── tests/                     # engine.test.js + formula.test.js
│                             #   + power/gen-stats/gen-skills/generator/gen-balance.test.js
├── docs/                      # ARCHITECTURE / COMPONENT-CATALOG(md+json) / PLUGIN-API / CONTENT-AUTHORING
│   └── GENERATOR.md           # 【v1.1】卡牌生成子系统作者使用文档
├── qa/                        # browser-results / stress-results / desktop.png / mobile.png
├── third_party/               # acorn + pokemon-showdown 许可证溯源
├── vendor/acorn-8.15.0.js     # 随包锁定的 AST 解析器
├── THIRD_PARTY_NOTICES.md
└── .gitignore                 # （本次新增）
```

工作区：`D:\xia zai\AI project\pk\2\NUMERICAL-BATTLE-LAB-v1.0.0`（已 `git init`，
基线提交 `adec7c4`，v1.0.1 提交 `6ab621d`，卡牌生成子系统提交
`3984cff/ccf6a6f/13f52c7/a4c6600/26cac80/8252d6c`。MTP：源来自
`D:\下载\NUMERICAL-BATTLE-LAB-v1.0.0.zip`，兄弟目录 `pk\1` 仅作只读参考，未改动）。

## 2. 测试总数

- **133** 个自动化测试，全部通过（`node --test`）。
- 覆盖：确定性、modifier 顺序、公式验证/执行、目标查询、触发顺序、触发循环保护、
  资源原子支付、状态叠层、sustain、伤害分量、ward/shield、净化/驱散/夺取、多段、
  miss/crit 上下文、击杀事件、replay、AI RNG 分离、重放复现、内容校验、插件扩展、
  组件目录、普通镜像平衡等。
- v1.0.1 新增 1 个测试：`default 4v4 mirror combined rate stays within the competitive band`。
- **v1.1.0 新增 35 个测试**（卡牌生成子系统，含本次加固回归）：
  - `power.test.js`（8）：RPI 顺序、LevelFactor 曲线采样、CardPower/GenerationBudget
    与规范示例一致、预算分区求和为 1、Qual<arity>Factor 种子确定性；新增
    `normalizeLevel` 严格 1..100 校验（拒绝 0/-1/101/999/1.5/NaN/Infinity/"abc"）、
    `levelFactor` 对非法等级抛错而非静默钳制。
  - `gen-stats.test.js`（6）：原型匹配规范、注册表可扩展；主属性 base+BP*K 校准带；
    allocatePrimary 种子确定/保预算/保原型形态；二次属性费用表与上限。
  - `gen-skills.test.js`（6）：refSkillCost 目标/命中/CD 因子；target 因子表匹配规范；
    SKILL_RECIPES 为有限且经校验的配方库；recipeBaseCost 有限为正；新增 self
    TargetFactor 0.85 真正进入 `refSkillCost`（`targetCount=0`）、穿透提升参考成本
    （penetrationBonus 统一字段）。
  - `generator.test.js`（12）：同种子确定性、schema 字段与约束、SSS 输出 > C、A Lv50 ≈
    C Lv100 关系、validateContentPack 编译通过、真实对战可 resolve、powerAudit 诚实、
    原型形态差异；新增生成身份（同元组同 ID / 异稀有度/等级/职业异 ID / 版本拒绝 999、
    同种子异稀有度部署共存）、`generateCard` 等级严格校验、穿透技能实际造成更高伤害。
  - `gen-balance.test.js`（3）：ExpectedWin 立方公式（canonical）、零/非有限防护、
    expectedRarityWin 使用 RPI。

## 2.5 卡牌稀有度 / 等级 / 随机数值生成子系统（v1.1 新增）

实现规范《卡牌稀有度 / 等级 / 随机数值生成规范 v1.0》要求的引擎级生成能力，核心贯
彻：**稀有度只发放"实力预算"，绝不写 `if(rarity==='SSS')...*2`**；同稀有度可产出不
同属性结构；"随机生成"= 用种子 PRNG 把**固定预算**按步骤拆分，而非随机撒数字。

- **Power 层（`power.js`）**：`RARITY_ORDER`（C→SSS，9 档）+ `RARITY_RPI`
  {100,108,118,129,141,154,169,187,207}；`levelFactor` 曲线（base .40 / scale .60 /
  denom 99 / exp .92）；`computeCardPower` + `generationBudget`；质量因子
  `[0.97,1.03]`；预算分区（primary .52 / secondary .13 / activeSkills .25 /
  passiveTrigger .10）；`seedHash`（FNV-1a）+ `qualityFactor`（Gen5PRNG 种子驱动）。
- **Stat 层（`gen-stats.js`）**：7 种职业原型（Tank/Balanced/Assassin/Mage/...，权重
  和 1）+ `registerArchetype` 可扩展；主属性 `allocatePrimary`＝把主预算按原型模板用
  种子抖动（±12%）后重归一化；次属性用费用表贪心购买（+1%）并保持在上限内。属性转
  换为 `BASE + BP*K` 注册表（归一化调整以匹配引擎出力带，结构保持规范）。
- **Skill 层（`gen-skills.js`）**：统一费用曲线 `refSkillCost`（目标数/命中/CD/优先级
  因子，随机目标×0.9、条件目标×0.85）；13 个**有限可装配配方**（strike/heavy/cleave/
  flurry/pierce/fire-bolt/ember/heal/shield/weaken/enfeeble/fortify/haste），装载时对
  `EFFECT_COMPONENTS`/`DAMAGE_TYPES`/`STATUS_DEFS` 校验。
- **Generator 层（`generator.js`）**：`CARD_GENERATOR_VERSION=1`；`generatorSeedStream`
  派生种子流；`generateCard(opts)` 15 步流水线产出完整卡 schema（id/seed/rarity/level/
  quality/archetype/powerIndex/generationBudget/stats/resources/resistances/tags/
  skills[3]/passives/statuses/triggers/powerAudit/name）；`powerAudit` 诚实汇报预算落位
  （buckets 求和 = 总预算）；`assembleCardPack` 组装出能通过 `validateContentPack` 的
  `{units,skills,statuses}`；`deployCard` 把卡部署为可入战实体。
- **Balance 层（`gen-balance.js`）**：`expectedWinRate(pA,pB)=pA³/(pA³+pB³)`（canonical，
  带零/非有限防护）；`expectedRarityWin`。该公式**只作参考**——低级 vs 高级实测胜率因
  属性与技能预算同步放大而**系统性高于**参考（校准发现，见下）。
- **整包绩效门禁**：以上各层均有独立测试；`validateContentPack` 编译通过；generateCard
  同种子严格确定；生成卡可投入真实 BattleEngine 作战。作者文档见 `docs/GENERATOR.md`；
  蒙特卡洛冒烟见 `scripts/gen-mc.js`（`npm run gen-mc`，报告性质，非硬性门禁）。

## 2.6 生成卡身份 / 预算不变式加固（review 修复）

针对已确认的 6 个问题做了最小范围加固，未改稀有度 RPI / LevelFactor 曲线 / 平衡：

1. **生成卡身份碰撞**：`cardId` 不再只 hash seed，改为对规范身份
   `canonicalGenerationIdentity(opts)`（含 generatorVersion + seed + rarity + level +
   archetype + 排序后 tags）hash。同种子不同稀有度/等级/职业 → 不同 ID 且技能 ID 不碰撞；
   `deployCard` 可同种子不同稀有度并存（不覆盖）。`generatorVersion:999` 直接抛错拒绝，
   绝不静默产出 v1 卡却标注 v999。
2. **等级严格 1..100**：`normalizeLevel` 是校验（整数、1..100），仅 `undefined` 默认 100；
   0/-1/101/999/1.5/NaN/Infinity/"abc" 一律抛错。杜绝元数据等级与 `levelFactor` 数值不一致。
3. **Self TargetFactor 集成**：`refSkillCost` 用 `targetCount ?? 1`，self 0.85 真正进入成本。
4. **穿透穿透食谱**：recipe 统一 `penetrationBonus`（去掉 `penBonus` 别名），生成卡 skill
   定义携带该字段，成本模型新增 Penetration 因子（穿透高 → 参考成本高 → 同预算系数低）。
5. **删除假绿色断言**：`generator.test.js` 的 `assert.ok(...#>#|| true)` 移除，改为结构断言
   + 多种子均值。
6. **v1.1.0 版本一致性**：`package.json.version === RELEASE-MANIFEST.json.version === 1.1.0`，
   由 `scripts/static-check.js` 静态门禁强制；`RELEASE-MANIFEST.json` 由
   `scripts/generate-manifest.js` 从 `git ls-files` 生成，涵盖全部 git 跟踪文件
   （含部署文件 `.nojekyll` 与 `.github/workflows/verify.yml`），不存在“看着完整却漏文件”。

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
- **生成卡 ""（空种子）会产出完全相同的卡**：`generateCard` 默认 seed 为空串，因此
  不带 seed 的两次调用产出两张同构卡（确定性是特性）。这本身不缺陷，但意味着用户若
  想"每次随机不同"必须显式传 seed（如时间戳/计数）。
- **完全相同且带自愈/急疾技能组的两张生成卡在 1v1 会互刷不死（stalemate）**：当对局
  双方是同一（或镜像）skill 配方集（如 heal+haste+cleave）时，双方可无限自愈到对局
  轮次上限，`outcome.ended` 为 false、以 draw 收束。这是**已纳入上界的饱和行为**——
  `runSimulation`/`resolveRound` 的 `maxRounds` 兜底保证不会无限挂起；任何 1v1 若想
  必有胜负，应避免 pair 出镜像自愈组合，或交由多实体阵容与 maxRounds 处理。
- **卡牌生成平衡是"参考 + 实测"模型**：ExpectedWin 立方公式取为 canonical 参考，但
  高级稀有度实测胜率系统性高于参考（属性与技能预算同步超线性放大）。`gen-mc` 报告
  此差异为校准发现，属符合范围的报告项而非硬性带内门禁。

## 13. 下一步可扩展方向

- **Form 化组件装配器**：把 Skill/Status 的组件程序做成可视化表单（condition 树、
  modifier 带、damage component）并生成内容包，强化"构建套件"易用性。
- **插值/曲线数值**、多帧快速模拟、matchup 矩阵（成本允许时）。
- 更多机制样板（清单内已具备多数：Burn→detonate、Poison 递增、盾墙、Ward 专精、
  Rage/Soul/Chrono/HP 经济、Sustain、反击、夺取、净化、多段、斩杀、缺血增幅、抗性
  削减、资源封锁、团队光环、死亡触发器、状态转移、伤害转化等），按需以**新示例
  内容**而非硬编码加入。
- **内容版本化与迁移**：素材包 schema version 管理，平滑升级自定义内容。
- **卡牌生成扩面（v1.1 之后）**：`generateCard` 的 passiveTrigger 预算当前自动置 0
  （powerAudit 如实汇报 `spent 0`）——v1.1 只生成主动技能；被动/触发是明确的下一步。
  此外可按需扩展配方库、职业原型、质量因子区间到更多稀有度/存档落地方案。

---

## 验证门禁（本环境重测）

```
ALL TESTS PASS        ✔ 133/133
STATIC CHECK PASS     ✔ 静态门禁通过（91 参数 / 18 Effect）+ v1.1.0 version 门禁 + manifest 审计
CONTENT COMPILE PASS  ✔ validateContentPack + verify 全部通过
DETERMINISM PASS      ✔ replay 精确复现；25 个成对确定性案例一致；generateCard 同种子严格一致
BROWSER QA PASS       ✔ Chromium 1440×1000：无 JS 错误、无横向溢出、对战/AI/编辑器/
                        模拟(500局)/规则/replay 全部可用；无效公式提示错误
GENERATOR BROWSER QA  ✔ 6 个生成模块在浏览器加载；generateCard/assembleCardPack/
                        validateContentPack/确定性有效（对战 resolve 见已知限制说明）
MOBILE QA PASS        ✔ Chromium 390×844：无横向溢出、对战可打到胜负、无 NaN/错误
BALANCE SMOKE PASS    ✔ 默认 4v4 镜像 combined 59.5%（40–60% 带内）
```

附注：浏览器控制台仅有 1 条 `favicon.ico` 404（非引擎错误，可忽略）。