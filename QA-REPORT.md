# QA 报告 — v1.2.0

发布候选：`数值对战实验室` v1.2.0（玩家向 UI + 战力评分 + 稀有度扩展 + 数值系统审计）

## 自动化验证

新源码树验证命令：

```bash
npm run verify
```

结果：**166 / 166 测试通过**，静态架构检查通过（v1.2.0 版本门禁 + manifest 审计 72 文件）。

生成能力计数（verify 时）：

- 参数：91
- 效果：18
- 条件：27
- 目标：8
- 事件：28
- 伤害类型：8
- 示例实体：20
- 示例技能：63
- 示例状态：33

## 战力校准（v1.2 新增门禁）

`scripts/power-calibration.js`（同定位镜像正反位 + train/validation 完全分离）：

```text
Spearman (calibration split) = 0.741
Spearman (VALIDATION split)  = 0.776   (target >= 0.75, audit stop >= 0.70)
rarity mean monotonic = YES  (large-sample statistical distribution)
CALIBRATION PASS ✔
```

## Generator 平衡（v1.2 深度重调）

`docs/GENERATOR-BALANCE-v1.2.md` 记录：

- 第一回合秒杀率：**0.0%**（目标 <5%）
- 僵局率：**1.7%**（目标 <5%）
- 战斗时长中位数：**8 回合**（目标 6–9）
- 稀有度统计分布：均值单调（C 0.31 → XS典藏 0.88）

## 浏览器 QA

`qa/browser-results.json` 记录交互式浏览器通过项。

### 桌面 1440×1000（真实 Chromium）

- 默认导航为玩家向：对战 / 卡牌 / 生成卡牌 / 玩法说明；高级实验室收纳右上角。
- **新手流程可独立玩通**：打开网页 → 生成卡牌 → 加入我的卡牌 → 立即对战 →
  选技能 → 点目标 → 结算回合 → 自动演算到结束 → 战斗完成。
- 手动对战与自动推演（暂停/继续/下一步/1×/2×/4×）均可用。
- 卡牌库本地持久化（加入/改名/复制种子/同种子再生成/删除）。
- 高级实验室全部可用：数值编辑 / 批量模拟 / 规则架构 / 对局重放 / 计算详情 / JSON。
- 全中文、无 NaN/Infinity、无 JS 错误（仅 favicon 404 可忽略）。

### 移动 390×844（真实 Chromium）

- 无横向溢出（`document.documentElement.scrollWidth === innerWidth === 390`）。
- 对战/卡牌/生成/帮助均可操作；无 NaN、无 JS 错误。

## 环境附注

- 运行时完全离线（Acorn 8.15.0 / OFFLINE），无 CDN/服务器/登录。
- `qa/desktop.png` 与 `qa/mobile.png` 为本次交互 QA 截图（可选生成）。
