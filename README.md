# ⚔️ 数值卡牌 · 自动 PK

**Pick two cards. Set their levels. Let the numbers settle the fight.**

一场由等级、稀有度与十二项战斗属性驱动的自动对战实验。玩家决定对手和参数，系统模拟战斗，再以具有节奏的视觉演出回放结果。

**[▶ Play the battle lab](https://seiya058904.github.io/numerical-battle-lab/)** · [Three-step guide](#三步开战) · [Combat rules](#during-combat) · [Verification](#run-and-verify)

<img width="740" alt="Numerical Battle Lab fantasy card artwork" src="https://github.com/user-attachments/assets/7ca1b5eb-2d0e-47a2-bd7f-1e668e39ee11" />


## 三步开战

1. **选卡**：蓝方、红方分别选择一张固定卡牌。
2. **设定等级**：Lv 1–100；观察 HP、攻击、防御、速度和 Battle Power 随之变化。
3. **开始战斗**：系统先完整模拟，再按「慢 / 快 / 瞬」播放事件，查看胜者、日志与战后简报。

无需注册。直接打开 [`index.html`](index.html)，或在本地启动 `npm run serve` 后访问 `http://127.0.0.1:8774/`。

## What determines a match

**Level and Rarity influence combat attributes. BP does not.** It is an observational score computed *after* final attributes are known, never an extra hidden damage multiplier.

| Dimension | What it changes |
| --- | --- |
| **Level** | 从 Lv1 到 Lv100 的非线性成长，显著影响核心属性 |
| **Rarity** | 12 档离散稀有度倍率，从 C 到 XS Collector |
| **12 attributes** | HP、ATK、DEF、SPD、命中、闪避、暴击率、暴伤、穿透、吸血、再生、波动 |
| **Battle Power** | 对当前最终属性作只读综合评价，不介入伤害计算或强制决定胜负 |
| **Match Seed** | 同卡、同等级和同 Seed 可重现同一完整战斗事件序列 |

卡库为 **96 张固定卡牌**（12 档 × 8 张），不包含自由编辑卡牌或额外技能编辑器。BP 是辅助比较指标，**不是胜率百分比**。

### 稀有度阶梯

| C | C+ | B | B+ | A | A+ | S | SS | SSS | SSS Collector | XS | XS Collector |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.00× | 1.15× | 1.35× | 1.60× | 1.90× | 2.30× | 2.90× | 3.75× | 4.90× | 6.60× | 9.10× | 13.20× |

不同档位有不同材质与徽章层次，Collector 增加更明显的装饰结构；所有档位共享可读的战力与生命信息。

## During combat

```text
再生 → 命中 / 闪避 → 暴击 → 防御 / 穿透 → 实际伤害 → 吸血 → 下一回合
```

SPD 影响行动先后，随机性统一由确定性 PRNG 驱动。慢/快/瞬只改变回放等待时间，**不会改变伤害、RNG 或胜负**。

视觉层包括方向攻击光束、暴击与回复反馈、生命残影、分回合战斗日志与结果统计。支持 `prefers-reduced-motion`，关闭繁复运动时保留核心战斗信息。

<details>
<summary><strong>📐 Numerical reference (for readers who want the model)</strong></summary>

The level multiplier is `g(L) = exp(0.02143·L + 0.0002253·L²)`; the four scaled core stats follow the card's base values and shape, multiplied by `g(L) × rarityMul`. Rarity uses the explicit table above, not an interpolated formula. An illustrative damage term is `ATK² / (ATK + DEF×(1−PEN))` before critical and variance factors.

Exact source of truth: [`src/power.js`](src/power.js) and [`src/battle.js`](src/battle.js). The BP audit's historical pools are deliberately separated from current full-card regression; **no BP score is a human win-rate estimate**.

</details>

## Run and verify

本项目是零运行时依赖的静态 Web 项目，使用 Node 内置测试工具。

```bash
npm run serve    # Local server at 127.0.0.1:8774
npm test         # Node regression suite
npm run verify   # Static checks + tests + product/BP audits
```

| Source | Responsibility |
| --- | --- |
| [`src/cards.js`](src/cards.js) | 固定卡库和稀有度定义 |
| [`src/power.js`](src/power.js) | 等级、属性与 BP 评价 |
| [`src/battle.js`](src/battle.js) | 确定性战斗模拟 |
| [`src/app.js`](src/app.js) | 用户界面和回放流程 |
| [`tests/`](tests/) | 数值与战斗契约测试 |

计算与视觉边界以 [`PRODUCT.md`](PRODUCT.md)、[`DESIGN.md`](DESIGN.md) 和 [`AGENTS.md`](AGENTS.md) 为准。BP 的深度校准方法和历史回归门槛在源码及测试中维护，不将自动模拟的观察结果伪装成真实玩家胜率。
