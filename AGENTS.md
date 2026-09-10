# AGENTS.md — 给 Coding Agent 的仓库入口

> 这是 `数值卡牌 · 自动 PK`（numerical-battle-lab）的工作指引。

## 项目是什么

一个**多数值自动卡牌 PK 游戏**：选两张卡 → 调等级（1–100）→ 开始战斗 → 看谁赢。
不做生成器、不做技能系统、不做多队伍、不做沙盒编辑。旧版本全部在 Git 历史里，当前产品树只维护这一个版本。

## 三套核心实力系统

1. **Level** — 第一维度，超指数成长：`g(L) = exp(0.02143L + 0.0002253L²)`
2. **Rarity** — 第二维度，12 档（C…XS Collector），纯指数：`rarityMul(t) = exp(ln6/11·t)`，C→XS Collector = 6 倍
3. **Battle Power** — 只读最终属性的透明线性加权，**不参与战斗**，只是给玩家的综合实力数字

最终属性 = 基准 × 卡牌形状 × `g(L)×rarityMul(稀有度)`。

## 关键设计约定（改动前必读）

- **卡牌只读**：`src/cards.js` 固定 24 张卡（12 档 × 2 张），玩家不生成/导入/编辑卡。
- **形状归一化**：每张卡的“战斗强度” `hp·atk²/(atk+def)` 与百分比属性都收窄在窄带内，
  稀有度差距**只由 rarityMul 表达**。因此：
  - 同级 C vs XS Collector = 6 倍 → 压倒性；
  - Lv70 XS Collector vs Lv100 C（p 相等 ≈81.1）→ 悬念；
  - 同档对抗互有胜负。
  调平衡时改某张卡的 base/百分比即可，**不要**改曲线或加系统。
- **确定性**：战斗内所有随机必须走 `src/battle.js` 的 Mulberry32 PRNG。禁止 `Math.random()`。
  同 Match Seed → 完全相同的对局。
- **先模拟后播放**：`simulate()` 生成完整事件列表，UI 只按 慢/快/瞬 的延迟回放。
  播放速度绝不能改变回合/命中/暴击/伤害/胜者。
- **1v1 only**：没有队伍、没有多目标。

## 数值公式（src/power.js 与 src/battle.js）

- 命中率 = clamp(0.90 + (ACC−EVA)×0.004, 0.45, 0.99)
- 基础伤害 = ATK² / (ATK + DEF×(1−PEN))，再 × 波动(±volatility) × 暴击(×critDmg)
- Battle Power 权重见 `src/power.js::battlePower`，调权重要同时跑 `npm test` 看排序测试。

## 常用命令

```bash
npm test          # node:test 全量测试（零依赖）
npm run verify    # 静态检查（文件集合=期望清单）+ 全量测试 + 产品实战验收 + BattlePower 审计
npm run serve     # 本地静态服务器 http://127.0.0.1:8774
```

## 修改卡牌/数值后的检查清单

1. `npm test`（BP 排序、确定性、验收匹配全部要绿）
2. `npm run verify`（含 `scripts/battlepower-audit.js`：Lv50 循环赛胜率与 BP 排名 Spearman 相关 ≥ 0.85）
3. 如果改了 `index.html` 的 script 标签或新增/删除文件，同步更新 `scripts/static-check.js` 的期望清单
