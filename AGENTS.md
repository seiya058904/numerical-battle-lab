# AGENTS.md — Numerical Battle Lab

## 项目与入口

当前产品是「数值卡牌 · 自动 PK」：选择两张固定卡牌、调整等级、模拟 seeded 1v1 战斗并回放。正式入口为本 Git 根的 `index.html`；目录名中的旧版本号不代表当前产品版本。产品约束见 `PRODUCT.md`，交互与视觉约定见 `DESIGN.md`，玩法及验证说明见 `README.md`。

- `src/cards.js`：96 张只读卡牌、12 档稀有度；`LEGACY_CARDS` 保留原始 24 张 BP 参考卡。
- `src/power.js`：等级曲线、显式稀有度倍率表、最终属性和 Battle Power。
- `src/battle.js`：Mulberry32 确定性模拟，返回完整事件列表。
- `src/app.js`、`styles.css`、`assets/`：交互、回放与展示；`index.html` 按顺序加载上述四个模块。
- `tests/`、`scripts/`：Node 测试、产品验收、BP 审计和本地服务器。

## 运行与验证

在 Git 根运行；纯静态站点，测试零依赖，无安装或 build 步骤：

```bash
npm run serve     # http://127.0.0.1:8774
npm test          # node:test 全量测试
npm run verify    # 静态文件集合检查 + 测试 + 产品验收 + BP 审计
```

`.github/workflows/verify.yml` 在 main push / PR 上运行 `npm run verify`，使用 Node 22。Pages 从 main 根目录发布；保留 `index.html`、`.nojekyll`、`site.webmanifest`、图标和所有正式资源路径。UI 修改需实际浏览器检查主流程、移动布局、控制台和减弱动态；播放结果不能只凭构建或静态测试判断。

## 不变量

- 仅 1v1、固定卡库；不引入生成器、导入/编辑卡牌、技能、队伍或沙盒系统。
- HP/ATK/DEF/SPD 由卡牌形状、`gLevel` 和 `RARITY_MULT` 决定；其余八项属性为固定卡牌值。形状保持窄带归一化，稀有度差距由显式倍率表表达，不以新公式拟合替换该表。保留同档双方胜机、相邻档梯度和 Collector 跳升等现有验收语义。
- 战斗随机只走 `src/battle.js` 的 PRNG，禁止 `Math.random()`。同卡对、等级和 Match Seed 必须产生相同完整事件。
- 先模拟、后播放；慢/快/瞬只改变回放延迟。开始战斗默认换新 Seed，明确输入的 Seed 和同 Seed 重播保持既有语义。
- BP 只读取最终属性，不读身份、等级、稀有度或当前 HP，不参与战斗或强制胜者；它是综合评价，不是胜率。具体公式、参考属性和倍率以源码及 README 为准，不因展示整理改变。
- 保留中文 UI、蓝红队伍语义、全部属性、日志、简报、键盘操作和 `prefers-reduced-motion`。

## BP 评价边界

`scripts/bp-evaluation.js` 是冻结清单与 SHA-256 的来源，`scripts/battlepower-audit.js` 执行门槛。深度审计继续使用 24 张 `LEGACY_CARDS`；96 张全卡池另由产品验收的轻量循环赛覆盖，扩卡不得改写冻结参考集。

V2/V3 保留池已永久转为历史回归。V4 使用新的等级组合与 seeds，排除参与拟合的修复卡对；校准、修复、保留及回归角色不可混用。已被观察的卡牌身份不能宣称从未见过；保留池一旦用于调参即永久转为回归集。

保留近/中/远 BP 分组、数量与类别覆盖、双方胜机、远 BP 总体得分和有序组合比例门槛。全共同对手是最终回归，不用于拟合：Lv25/55/100 rho≥0.90，每 seed 聚合 22 对手与双座位，以 512 个配对差计算 t 区间，显著差门槛为 1 个百分点。常数、Level×Rarity、反向负面对照应按预期原因失败；不得删历史池或降低门槛使失败转绿。

## 仓库卫生与修改范围

`scripts/static-check.js` 要求已跟踪文件集合与 `EXPECTED_FILES` 完全一致，并禁止旧系统路径。新增或删除正式文件需同时核查该清单和入口引用；不为整理任务重构源码或修改测试预期。

`.playwright-cli/` 是可再生成浏览器产物；截图、trace、临时报告放仓库外。`.workbuddy/` 含本地历史记忆，`.codebase-memory/` 含本地索引，二者忽略不等于可以无条件删除。外层旧扩卡 ZIP 属历史交付，未经内容与唯一性核查不得删除。保持用户现有工作、正式资产与历史价值；只改授权范围，提交前检查 diff、状态及适用验证。
