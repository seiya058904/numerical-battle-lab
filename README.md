# 数值对战实验室

一个完全离线、纯单机、确定性的多实体回合制数值战斗系统。网页用“卡片”展示实体，但卡牌只是 Presentation；核心只处理 `CombatEntity + Skill + Formula + Modifier + Effect + Condition + Target + Event + Status`。

项目目标不是不断给角色写特殊逻辑，而是维护一套固定的“数值战斗语言”：普通新角色、技能、状态只调整参数并组合组件；只有真正新增规则原语时才扩插件注册表。

**当前产品：Simple Outside, Deep Inside。** 极简黑白卡牌 + 高维数值内核 + AI 自动观战 + 自由创造沙盒。

核心循环：**直接选两张系统预设开战**，或创造自己的卡 → 保存 → 选择左右双方（每人 1–6 个槽位，每个槽位独立选卡，未填满不能开始，绝不自动补卡）→ 开始自动对战 → 观察 → 修改或换卡 → 再战。
内置 **60 张系统预设**（12 档稀有度 × 精确 5 张、全面覆盖 Lv.10–100，每个等级带 ≥4 张），开箱即可玩，无需先建卡。预设为只读，可对战 / 复制到「我的卡牌」。
默认 **1 VS 1**，双方使用同一个 canonical utility AI。暂停、继续、下一步、1×/2×/4× 与重开直接可用；
普通「开始对战」与「重开」每局都会生成**新的对局随机种子**（相同阵容 + 新随机轨迹），精确复现走 Replay / 高级实验室「同种子重放」。
没有经验、货币、升级、抽卡、关卡或解锁；等级只是 1–100 的自由生成参数。

卡面上的 **「战力」是玩家观察卡牌综合实力的参考数值**（v6/v5 用独立的 BattlePower v3 估算；v4 旧卡仍用 BattlePower v2），**不参与**任何战斗计算。对战中每个实体单独显示稀有度 / 等级 / 战力。

**Generator v6 是当前默认生成器，v1–v5 保留为显式 legacy。** 强度体系遵循 Level × Rarity Strength Contract：
**Level × Rarity 共同决定 ExpectedStrength 与总实力预算；Seed 只决定预算在攻击、耐久、恢复、控制、节奏、资源、可靠性和触发器之间如何分配；机制决定打法与克制；Match Seed 决定单局结果。**
生成器是纯确定性函数，不运行战斗、不调用 AI 或 BattlePower；BattlePower 和 canonical-AI Monte Carlo 分别是独立的 Measurement 与 Reality 层。
同 seed 的卡无论 Lv/Rarity 怎么变，**机制指纹与物种专名都不变**——只是数值强度按包络校准。
**命名体系（Name Generator v3）**：卡名是可直接朗读、好记的原创物种专名（如 米洛、咕拉奇、维洛恩、莫里亚姆…），
由 6 个纯语音家族（ROUND/AGILE/HEAVY/SLEEK/WILD/ANCIENT）以 2/3/4 字 = 10/70/20 生成，
5 字禁止；名字只由 Seed 决定，绝不读稀有度/等级/BP/机制。官方 60 预设使用人工定稿名称。
**对局随机**：同 Priority 层内，SPD 决定先手概率（initiative = SPD × jitter∈[0.85,1.15]，读取对局 PRNG），
小速度优势是概率优势、大速度差距固定先手；命中/暴击/波动照旧全部来自对局 seed，Replay 精确可复现。

**Generator v4 完全取消职业**：先生成一个独立的随机个体 → 几十个真实变量共同决定它的战斗表现 → 事后用 Behavior Analyzer 描述特点（如「高波动 · 后期成长 · 吸血」）。攻击只是 Action 的一种，允许多治疗、多护盾、纯状态和没有直接伤害的卡。
**Battle Wear / 战斗损耗**让治疗互打的长局也自然收敛，几乎不会拖到 maxRounds 平局。
数值、行动、资源、状态和公式可在卡牌的「编辑」中修改完整 JSON，保存前校验。高级实验室保留数值编辑、批量模拟、组件目录、Trace 和 Replay。
移动端观战按**事件逐帧**讲故事：血条逐事件同步、每实体单浮动数字队列、暂停/单步/1×/2×/4×。

参阅 [Generator v6 设计](docs/GENERATOR-V6-DESIGN.md)、[v6 交付报告](docs/V6-DELIVERY-REPORT.md) 与 [Generator v5 legacy](docs/GENERATOR-V5.md)。

## 直接运行

可以直接双击 `index.html`。最终运行时没有 CDN、服务器、登录或网络依赖。

如浏览器对 `file://` 本地存储策略较严格，也可在目录内运行：

```bash
python -m http.server 8765
```

然后打开 `http://127.0.0.1:8765/`。

## 当前能力

- 1–6 vs 1–6 同时在场，支持不对称人数；默认玩家向 **1 VS 1**（更多对战设置可调 1–6）。
- 20 个示例实体、63 个示例技能、33 个状态；它们只是组件语言的示范组合，不是引擎上限。
- **生成卡牌（Generator v6，Classless，默认）**：12 档稀有度、任意整数等级 1..100、无职业先验、
  连续随机预算分配、2–6 个可变行动、个体级随机（VOLATILITY/LUCK）、时间成长/疲劳（RAMP/FATIGUE/ENDURANCE）、
  Battle Wear 长局收敛、物种专名（Name Generator v3）、复合效果、条件、资源循环与状态事件程序。
  强度由 **ExpectedStrength(Level, Rarity) → Seed allocation → budget-priced card** 决定；同 seed 的机制指纹与名称跨 Lv/Rarity 完全不变，主面板和机制幅度按同一总预算调和至 ±5% 内。
  显式 `generatorVersion: 1|2|3|4|5` 继续复现 legacy。
- **战力评分（BattlePower v3，v6/v5 measurement）**：只读真实 stats/actions/formulas 的静态综合实力估算；
  绝不读取稀有度/等级、绝不 clamp、绝不因对局种子变化。v4 旧卡继续用 BattlePower v2。
- **对局随机语义**：普通「开始/重开」每局新 seed；同 seed 精确复现；Replay 逐步重现原局；
  SPD 先手为有界随机（Priority 优先 → SPD×jitter → 确定性兜底）。
- **Behavior Analyzer（特征分析器）**：生成完成后事后分析卡牌特点（2–4 标签 + 一句话摘要），
  取代职业展示；纯 Presentation，不参与生成与 AI 决策。
- **卡牌库 + 选择器**：本地持久化；Card Browser 全屏选卡（稀有度 chips / 任意等级区间 / 特点标签 / 名称&行动搜索、
  12 张分批渲染、详情直选左右），替换长下拉；可查看/选择/删除/同种子再生成/复制种子/改名。
- 90+ 个有文档的通用数值/规则旋钮，涵盖 Stat、资源、命中、暴击、随机伤害、穿透、复合伤害、抗性、亲和、护符、状态、目标查询、事件 Modifier、Trigger、持续技能等。
- 8 种注册式 Damage Type；可通过插件增加新类型。
- 复合 Damage Packet：一个伤害效果可包含多个 Damage Component，每个分量独立拥有类型、公式、倍率、随机区间、防御轴、穿透、抗性绕过、最小/最大伤害等。
- 任意 Stat / 任意命名 Resource；`X_MAX` 可定义新的资源上限，公式上下文自动暴露动态 Stat/Resource。
- 多资源原子成本、资源回复/转换、HP 施法成本、Sustain 每回合维护费用。
- 稳定 Modifier band：`SET → ADD → MULTIPLY → CAP → FINAL`；Modifier 值本身也可以是公式。
- Status：stack / refresh / replace、DoT / HoT、snapshot/live、免疫、抗性 Modifier、Event Modifier、Trigger、Sustain、净化、驱散、Buff 夺取、状态消费/引爆。
- Target Query：关系 + Condition + 排序 + 数量 + selection mode，避免大量固定目标类型。
- 命中/闪避、Priority/Speed、暴击、技能级随机伤害、技能汲取/反噬、护盾、类型 Ward、吸血、反伤、冷却、群体技能。
- Detailed Calculation Trace、Replay JSON、确定性复现。
- 通用战术 AI 与 1–5000 局 Monte Carlo 模拟器；AI 与真实战斗使用同一 Formula/Effect pipeline。
- 数值编辑器、内容 JSON 导入导出、localStorage 保存。

## 公式系统

`src/formula.js` 使用随包固定的 **Acorn 8.15.0**（MIT）作为成熟 AST 解析器，再由项目的严格白名单解释层执行允许的纯表达式。解析器完全离线，不依赖 CDN，也不使用 `eval` / `new Function`。这种拆分避免继续维护手写语法解析器，同时保留可审计的战斗 DSL。

支持：

```text
+ - * / % ^
< <= > >= == !=
and / or / !
condition ? yes : no
min max abs floor ceil round sqrt log log2 log10 exp pow sign clamp
```

同时支持注册纯函数插件。`and / or / not / ^` 在进入 Acorn 前只做确定性的语法规范化；执行层仅接受数字/布尔常量、变量、白名单算术/比较/逻辑/三元节点和直接白名单函数调用。赋值、对象成员访问、数组/对象、构造器、用户定义函数、动态代码和随机函数全部拒绝。所有战斗随机必须走 canonical PRNG。

## 成熟项目吸收

- **Pokémon Showdown (MIT)**：直接派生/泛化 Gen5 PRNG、Priority/Speed 排序与 relay-event 核心语义。
- **Cataclysm-DDA**：参考 `damage_instance / damage_unit` 的复合伤害、逐分量穿透与抗性设计。
- **Wesnoth**：参考 weapon special 对 damage / attacks / chance_to_hit 的通用修改面。
- **ToME 类大型 RPG**：参考多资源、Sustain、抗性/穿透、资源循环。
- **Freeciv / Unciv**：参考 Requirement + Effect 的数据化组合。
- **Pokémon Move/Condition 数据面**：参考 base power、accuracy、priority、crit、multihit、recoil、drain、target、secondary、ignore/override 等大量标准旋钮。

只有 Pokémon Showdown 的 MIT 代码/算法被明确派生并随包保留许可证；其他项目作为机制/架构参考，不复制其受限制代码。

## 数值语言 / AI 文档

- **Canonical Numerical Knowledge Registry** — `src/numerical-knowledge.js`（所有参数/效果/条件/事件/公式变量的唯一真源；游戏内「数值百科」与自动文档都从这里派生）。
- `docs/CARD-NUMERICAL-REFERENCE.md` — **自动生成**的完整数值参考（GENERATED FROM CANONICAL，勿手改；`npm run numerical-reference` 重新生成）。
- `AGENTS.md` — Coding Agent 入口：改卡牌生成/平衡/AI/BP/公式/预设前先读 registry，含「需求→参数」映射。
- `docs/NUMERIC-COMPONENT-CATALOG.md` — 人类可读的全部旋钮、Effect、Condition、Target、Event 说明。
- `docs/numeric-component-catalog.json` — AI / 工具可直接读取的机器目录。
- `docs/PLUGIN-API.md` — 插件接口。
- `docs/ARCHITECTURE.md` — 内核边界与 canonical pipeline。
- `docs/CONTENT-AUTHORING.md` — 如何只拼组件、不改引擎地创建新内容。

最新产品审计、已修问题、真实浏览器证据与剩余局限：[最终愿景审计报告](docs/FINAL-VISION-REPORT.md)。

## 验证

```bash
npm test
npm run verify
```

`verify` 会重新生成组件目录、执行全部 Node 行为测试和静态架构门禁。静态门禁拒绝：canonical `Math.random()`、`eval/new Function`、外部 runtime script、角色/状态 ID 泄漏进 Engine、遗留硬编码公式 fallback、无 resolver 的 Effect，以及无效内置内容。

## v4 验证与诊断

- `npm test`：规则正确性、legacy fixture（v1/v2/v3）、Action、AI、生成多样性、稀有度/等级方向、安全边界、v4 契约与预设。
- `npm run verify`：测试、内容目录和静态架构/清单检查（manifest 覆盖全部 tracked 文件）。
- `npm run diversity:v4`：生成 10,000 张 v4 卡，将覆盖统计写入 `qa/diversity-v4.json`。
- `npm run calibration:v4`：BattlePower v2 与 canonical AI 实战实力的经验校准 → `qa/power-v4-calibration.json`（Spearman / pairwise / rarity 中位数趋势）。
- `node scripts/audit-v4-battles.js 3000`：3000 场随机 1v1 长局统计 → `qa/v4-long-battles.json`（maxRounds rate / 回合分位）。
- `node scripts/audit-v4-presets.js`：60 张预设对手面板实战审计 → `qa/v4-preset-audit.json` + `docs/V4-PRESET-TABLE.md`。
- `node qa/browser-v4.js`：Playwright 真实 Chromium 手机 390×844 + 桌面流程与截图 → `qa/browser-v4.json`。
- `npm run numerical-reference`：从 canonical registry 重新生成 `docs/CARD-NUMERICAL-REFERENCE.md`。
- `npm run audit:numerical-coverage`：数值知识覆盖审计（60 预设 + 10000 v4 卡，`undocumentedActiveFields` 必须为 0）。
- `npm run audit:numerical-semantics`：参数扰动验证（ATK/LIFESTEAL/VOLATILITY/RAMP/FATIGUE/HEAL_POWER 文档描述 == 引擎行为）。
- `node qa/browser-knowledge.js`：数值百科 UI QA（390×844，搜索/弹层/详情 ⓘ/无 overflow/无 console error）。
- `node qa/browser-multi.js`：多人显式编队 + 新种子/重开语义 QA（无自动补卡、未填满禁止开始、返回保留阵容）。
- `npm run audit:power-envelope`：v5 强度审计（包络/等级梯子/稀有度梯子/C+ vs A+ 跨种子回归/跨稀有度 Monte Carlo）→ `qa/power-envelope-v5.json`。
- `npm run audit:presets-v5`：v5 预设审计（60 张全部落入包络、名字唯一、结构自洽）→ `qa/presets-v5-audit.json`。
- `npm run audit:naming`：Name Generator v3 审计（10k 唯一率、生僻字=0、禁用后缀=0、长度分布）→ `qa/naming-v3-audit.json`。
- `npm run verify:release`：verify + `npm run diversity`。仓库清单按 Git 暂存区内容生成；提交新文件后先 `npm run manifest`。
