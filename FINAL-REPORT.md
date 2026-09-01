# FINAL-REPORT — 数值对战实验室

**Status:** v1.2.0 · all final gates green · competencies verified in this environment

## 1. 项目最终结构

纯离线、单机、确定性的多实体回合制数值战斗系统。网页以“卡片”呈现实体，但卡牌只是
Presentation Adapter；核心只处理 `CombatEntity + Skill + Formula + Modifier + Effect +
Condition + Target + Event + Status + Resource + Damage Component`。

```
NUMERICAL-BATTLE-LAB-v1.0.0/
├── index.html                 # 单页离线入口（玩家向导航 + 高级实验室）
├── styles.css                 # 移动优先 + 12 稀有度卡框/典藏标记
├── package.json               # v1.2.0 · npm test / verify / manifest / gen-mc
├── src/
│   ├── kernel.js              # Gen5PRNG(Showdown) + EventKernel + action 排序
│   ├── components.js          # 组件注册表（参数/Effect/Condition/Target/Event/Modifier）
│   ├── rules.js               # 架构/能力/公式常量 知识面
│   ├── content.js             # 20 实体 / 63 技能 / 33 状态 / 默认阵容
│   ├── status-runtime.js      # 状态运行时
│   ├── validator.js           # 内容编译门禁
│   ├── formula.js             # Acorn 8.15.0 + 严格白名单解释层
│   ├── effects.js             # Effect 执行器与 AI estimate
│   ├── engine.js              # BattleEngine（伤害管线/目标/资源/AI/模拟/replay）
│   ├── power.js               # 稀有度 RPI（v1 9 档 + v1.2 12 档 v2 坐标）+ LevelFactor + GenerationBudget
│   ├── gen-stats.js           # 职业原型 + Primary/Secondary 数值分配（可传 v2 conversion）
│   ├── gen-skills.js          # 统一技能费用曲线 + 有限可装配配方库（v1）
│   ├── generator.js           # v1 生成器（冻结）+ ExpectedWin 参考
│   ├── gen-names.js           # 【v1.2】确定性中文名称生成器
│   ├── gen-v2.js              # 【v1.2】Generator v2：Composition Grammar + 组合约束 + 被动/触发预算
│   ├── battlepower.js         # 【v1.2】战力评分（7 维几何聚合 + describeSkill）
│   ├── card-ui.js             # 【v1.2】卡牌展示适配器（SVG 卡图 + 稀有度 + 六维 + 技能描述）
│   └── app.js                 # 【v1.2】玩家向 UI（对战/卡牌/生成卡牌/玩法说明 + 高级实验室）
├── scripts/
│   ├── generate-catalog.js    # 从组件注册表生成 md + json 目录
│   ├── static-check.js        # 静态架构门禁（v1.2.0 版本门禁 + manifest 审计）
│   ├── generate-manifest.js   # RELEASE-MANIFEST 生成器
│   ├── power-calibration.js   # 【v1.2】战力 Monte Carlo 校准（train/validation 分离）
│   └── gen-mc.js              # 蒙特卡洛期望胜率冒烟
├── tests/                     # engine/formula/power/gen-*/generator/battlepower/
│                             #   gen-names/gen-v2/card-library/card-ui ... 166 tests
├── docs/                      # ARCHITECTURE / CATALOG / PLUGIN-API / AUTHORING / GENERATOR
│   ├── GENERATOR-BALANCE-v1.2.md   # 【v1.2】Generator v2 平衡报告
│   └── BALANCE-AUDIT-v1.2.md       # 【v1.2】Showdown MoveData 审计 + Smogon 单一事实源
├── qa/                        # browser-results / stress-results / power-calibration.json
├── third_party/               # acorn + pokemon-showdown 许可证溯源
├── vendor/acorn-8.15.0.js     # 随包锁定的 AST 解析器
├── THIRD_PARTY_NOTICES.md
└── .gitignore
```

工作区：`D:\xia zai\AI project\pk\2\NUMERICAL-BATTLE-LAB-v1.0.0`。
**OLD HEAD** `19ca5a443fcccd418d421a648f29a900098f55f8` → **NEW HEAD** `427a7f7`
（v1.2.0 提交，main 分支，Verify + Pages 工作流均 PASS）。

## 2. 测试总数

- **166** 个自动化测试，全部通过（`node --test` / `npm run verify`）。
- v1.1.0 基线 133 个测试全部保留；v1.2.0 新增 33 个：
  - `power-v12.test.js`（4）：12 稀有度顺序、新 RPI、别名映射、v2 RPI 非倍率。
  - `gen-names.test.js`（4）：中文名确定性、定位风格差异、数据驱动、改名不动 id。
  - `gen-v2.test.js`（14）：v2 确定性 + 中文名、v1 向后兼容（逐字节）、v1/v2 不同、
    版本拒绝、12 稀有度预算递增、validateContentPack 编译、composition grammar、
    被动预算真实消耗、带被动/触发的实战无 NaN、改名不动 id、powerAudit 诚实、
    **组合约束回归（≥2 伤害 / ≤1 治疗 / ≤1 护盾 / ≤1 状态）**、
    **触发连锁回归（recurring 事件不放伤害）**、**健康对局回归（秒杀/僵局率）**。
  - `battlepower.test.js`（8）：确定性、只读、稀有度无关、高稀有度趋势更高、
    expectedWinRate 有界/不对称、C Lv100 ≈ 10000、describeSkill 中文可读、
    describeSkill 通用。
  - `card-library.test.js`（3）：生成卡 JSON 持久化无损往返、改名持久化 + 稳 id、
    卡牌库增删改往返。

## 3. v1.2.0 玩家化与数值系统

### 玩家向 UI（默认体验）

- 默认导航：对战 / 卡牌 / 生成卡牌 / 玩法说明。
- 高级实验室（数值编辑/批量模拟/规则架构/对局重放/计算详情/JSON）收纳右上角。
- 默认全中文；HP/ATK/DEF/RES/SPD 显示「中文+缩写」；默认隐藏内部 ID。
- 新手流程：生成卡牌 → 加入卡牌库 → 选卡与难度 → 开始对战 → 选技能 → 点目标 → 结算回合。
- 手动对战 + 自动推演（暂停/继续/下一步/1×/2×/4×）；默认 1 VS 1，更多设置 1–6。
- 卡牌库本地持久化；生成页只暴露 稀有度/等级/定位/Seed(可选)/随机生成。

### 稀有度扩展 + Generator v2

- 12 档稀有度（C..XS 典藏），旧 9 档 RPI 数值不变；v1 生成器冻结。
- Generator v2：Composition Grammar + 组合约束；被动/触发预算真实消耗。
- **深度平衡重调**（`docs/GENERATOR-BALANCE-v1.2.md`）：秒杀率 0%、
  僵局率 <2%、中位数 8 回合、稀有度统计分布单调。

### 战力评分（`src/battlepower.js`）

- 7 维几何聚合（进攻/生存/续航/节奏/功能/经济/稳定），权重 MC 拟合。
- 只读最终数据；不把稀有度当伤害倍率；绝不进入战斗结算。
- Monte Carlo 校准（`scripts/power-calibration.js`）：同定位镜像正反位 +
  train/validation 完全分离；**Validation Spearman = 0.776（≥0.75 发布目标）**、
  稀有度均值单调 = YES。

### 审计

- `docs/BALANCE-AUDIT-v1.2.md`：Showdown MoveData 旋钮审计（已有/值得补/不适合）、
  StatStage 结论、TypeInteractionMatrix 结论、Smogon damage-calc 单一事实源。
- `docs/GENERATOR-BALANCE-v1.2.md`：Generator v2 平衡报告。

## 4. 借用/参考的成熟项目

- **Pokémon Showdown (MIT)**：确定性 Gen5 PRNG、行动排序、relay-event 内核。
- **Acorn 8.15.0 (MIT)**：随包 vendor 的表达式 AST 解析器。
- 仅作机制参考：Cataclysm-DDA / Wesnoth / ToME / Freeciv-Unciv / Smogon。
  详见 `THIRD_PARTY_NOTICES.md`。

## 5. 已知限制

- 战斗按 priority/speed 顺序结算（顺序非分片）；相同/镜像阵容先手方约 -2~6 个百分点。
- 单机本地，无网络多人/服务端/云存档；卡牌库存在浏览器本地存储。
- 生成卡镜像自愈组合可能打满 maxRounds（draw），由 maxRounds 兜底不挂起。
- 战力是排序/预估指标，UI 中标注「预估胜率」。

## 6. 验证门禁（本环境重测）

```
ALL TESTS PASS        ✔ 166/166
STATIC CHECK PASS     ✔ 91 参数 / 18 Effect / v1.2.0 版本门禁 / manifest 审计（72 文件）
POWER CALIBRATION     ✔ validation Spearman 0.776（≥0.75）+ rarity monotonic YES
GENERATOR BALANCE     ✔ 秒杀 0% / 僵局 <2% / 中位数 8 回合
BROWSER QA DESKTOP    ✔ Chromium 1440×1000：全中文、新手流程可独立玩通、
                        卡牌库/生成/帮助/高级实验室全部可用、无 JS 错误
BROWSER QA MOBILE     ✔ Chromium 390×844：无横向溢出、无 NaN
```

附注：浏览器控制台仅有 1 条 `favicon.ico` 404（非引擎错误，可忽略）。
