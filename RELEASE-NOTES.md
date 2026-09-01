# Release Notes — v1.2.0

`数值对战实验室` is a fully offline, single-player, deterministic, multi-entity turn-based numerical combat system presented as a card-style web interface.

## Core idea

Cards are presentation only. The engine works with generic combat entities and a reusable numerical combat language:

`Formula + Modifier + Effect + Condition + Target + Event + Status + Resource + Damage Component`.

Ordinary content is composed from registered primitives and parameters instead of character-specific engine branches.

## v1.2.0 highlights — 玩家化 UI + 战力评分 + 稀有度扩展 + 数值系统审计

### Player-facing UI (default experience)

- **默认导航改为玩家向**：对战 / 卡牌 / 生成卡牌 / 玩法说明。
- **高级实验室后置**：数值编辑 / 批量模拟 / 规则架构 / 对局重放 / 计算详情 / JSON 导入导出
  收纳在右上角「高级实验室」，功能全部保留，不因改 UI 而删除任何能力。
- **默认全中文**：`我方 / 对手 / 上场 / 选择行动 / 回合 / 战斗记录 / 伤害 / 治疗 / 无消耗 /
  对局重放 / 计算详情`；HP/ATK/DEF/RES/SPD 显示为「中文 + 缩写」（生命 HP 等）；
  默认隐藏内部 ID，仅高级视图展示。
- **新手流程**：生成卡牌 → 加入卡牌库 → 选卡与对手难度 → 开始对战 → 选技能 → 点目标 → 结算回合。
- **两种对战模式**：手动对战（玩家操控我方技能，AI 操控对手）与自动推演（双方 AI，
  支持 暂停 / 继续 / 下一步 / 1× / 2× / 4× 速度）。引擎保持确定性，UI 回放计算好的回合日志。
- **默认 1 VS 1**：选卡 → 对手难度（简单/普通/困难）→ 大按钮「开始对战」；
  1–6 vs 1–6 放在「更多对战设置」。
- **卡牌展示适配器**（`src/card-ui.js`）：纯 CSS/SVG 卡图占位（无外部图片资源）、
  名称、稀有度徽章与卡框、Lv、战力、定位、六维基础属性、技能名与中文描述、标签。
- **稀有度 12 档视觉**：每种稀有度有独立卡框与徽章；典藏版使用边框样式 + 徽章文字 +
  小图形（不只靠颜色区分，色盲玩家也能分辨）。
- **卡牌库**：本地持久化，可查看 / 选择 / 删除 / 同种子再生成 / 复制种子 / 改名；
  无账号、无服务器、无云、无商城、无抽卡。
- **生成卡牌页**：玩家只看到 稀有度 / 等级 / 类型定位 / Seed(可选) / 随机生成；
  Seed 默认自动随机，仅高级模式手动指定；生成后展示真实卡牌 + 加入我的卡牌 / 立即对战 / 再次生成。

### 战力评分 (BattlePower, `src/battlepower.js`)

- 7 维几何聚合：进攻 / 生存 / 续航 / 节奏 / 功能 / 经济 / 稳定，
  权重由 Monte Carlo 在健康生态上拟合（train/validation 完全分离）。
- 进攻子评分调用同一套引擎数学（公式/命中/暴击/穿透/防御/抗性/多段/冷却/资源）。
- 战力只是展示指标，永不进入战斗结算；不把稀有度当作伤害倍率。
- `describeSkill` 统一数据驱动中文技能描述。

### 稀有度扩展 + Generator v2

- 稀有度扩展到 12 档（C..XS 典藏），旧 9 档 RPI 数值不变；Generator v1 输出逐字节冻结。
- Generator v2：Composition Grammar（主效果 + 副效果 + 目标 + 条件 + 成本 + 冷却 +
  命中 + 伤害类型 + 标签），替换 13 条硬编码配方；被动/触发预算真实消耗。
- **深度平衡重调**（详见 `docs/GENERATOR-BALANCE-v1.2.md`）：消除首回合秒杀、
  治疗/护盾僵局、同档双峰与稀有度反转；战斗时长中位数 8 回合、秒杀率 0%、僵局率 <2%。
- `scripts/power-calibration.js`：同定位镜像正反位 + train/validation 分离，
  验证集 Spearman ≥ 0.70（当前实测 ~0.75-0.78）。

### 审计文档

- `docs/BALANCE-AUDIT-v1.2.md`：Pokémon Showdown MoveData 旋钮逐项审计
  （已有 / 值得补 / 不适合本项目），StatStage 与 TypeInteractionMatrix 结论，
  Smogon damage-calc 单一事实源对齐。
- `docs/GENERATOR-BALANCE-v1.2.md`：Generator v2 平衡报告（健康指标 / 稀有度 / BP）。

### 版本与质量

- `package.json` / `RELEASE-MANIFEST.json` / 静态门禁版本 = **1.2.0**。
- 全部既有测试保留并新增：稀有度顺序、Generator v1 向后兼容、Generator v2 确定性、
  中文名确定性、战力确定性 / 只读 / 稀有度无关、被动预算消耗、组合约束回归、
  触发连锁回归、健康对局回归、卡牌持久化等。
- 浏览器 QA：桌面 1440×1000 与移动 390×844 全中文、新手流程可独立玩通。

## Start

Double-click `index.html`, or serve the folder with any static server. See `README.md` for details.

## Changelog — v1.1.0 (card generation + hardening)

（见上一版本发布说明；v1.1.0 的 13 条硬编码配方、Generator v1 与 v1.2 的
12 档稀有度扩展、Generator v2 与战力评分见上方 v1.2.0 概览。）
