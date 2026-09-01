# 数值对战实验室

一个完全离线、纯单机、确定性的多实体回合制数值战斗系统。网页用“卡片”展示实体，但卡牌只是 Presentation；核心只处理 `CombatEntity + Skill + Formula + Modifier + Effect + Condition + Target + Event + Status`。

项目目标不是不断给角色写特殊逻辑，而是维护一套固定的“数值战斗语言”：普通新角色、技能、状态只调整参数并组合组件；只有真正新增规则原语时才扩插件注册表。

**v1.2.0 已改为玩家向 UI**：默认导航 = 对战 / 卡牌 / 生成卡牌 / 玩法说明；
数值编辑 / 批量模拟 / 规则架构 / 对局重放 / 计算详情 / JSON 导入导出 收纳在右上角
「高级实验室」。默认全中文、默认 1 VS 1、新手流程（生成卡牌 → 加入卡牌库 →
选卡选难度 → 开始对战 → 选技能 → 点目标 → 结算回合）无需知道 Seed/JSON/公式/ID。

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
- **生成卡牌（Generator v2）**：12 档稀有度（C..XS 典藏版）、等级 1..100、7 种定位、
  确定性中文名称、Composition Grammar 技能组合、被动/触发预算真实消耗。
- **战力评分（BattlePower）**：7 维几何聚合（进攻/生存/续航/节奏/功能/经济/稳定），
  复用引擎期望值数学；展示用指标，不进入战斗结算。
- **卡牌库**：本地持久化，可查看/选择/删除/同种子再生成/复制种子/改名。
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

- `docs/NUMERIC-COMPONENT-CATALOG.md` — 人类可读的全部旋钮、Effect、Condition、Target、Event 说明。
- `docs/numeric-component-catalog.json` — AI / 工具可直接读取的机器目录。
- `docs/PLUGIN-API.md` — 插件接口。
- `docs/ARCHITECTURE.md` — 内核边界与 canonical pipeline。
- `docs/CONTENT-AUTHORING.md` — 如何只拼组件、不改引擎地创建新内容。

## 验证

```bash
npm test
npm run verify
```

`verify` 会重新生成组件目录、执行全部 Node 行为测试和静态架构门禁。静态门禁拒绝：canonical `Math.random()`、`eval/new Function`、外部 runtime script、角色/状态 ID 泄漏进 Engine、遗留硬编码公式 fallback、无 resolver 的 Effect，以及无效内置内容。
