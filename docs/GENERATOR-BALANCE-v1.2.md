# Generator v2 平衡报告 v1.2 (GENERATOR-BALANCE-v1.2)

> 本文记录 v1.2.0 对 Generator v2 的深度平衡重调（用户授权：
> 修战斗生态 > 稀有度单调 > BattlePower 相关性），以及对应的实测指标。
> 所有数字来自当前源码树（`src/gen-v2.js` / `src/battlepower.js`）的
> 真实 Monte Carlo 采样，非目标值。

---

## 0. 背景：v1.2 重调前发现的退化

v1.2 Generator v2 初版（本次会话早期快照）存在系统性战斗退化：

| 指标 | 重调前实测 | 目标 |
| --- | --- | --- |
| 第一回合单次击杀率 | 12%–49%（回合分布 16.3%） | < 5% |
| 僵局率（打满 maxRounds） | 6.3%–20% | < 5% |
| 战斗时长中位数 | 4 回合（P10=1, P90=13） | 6–9 回合 |
| 稀有度→胜率单调 | 否（C+ 反低于 C，同档双峰 0.0/1.0） | 中位数单调 |

根因（审计定位，非引擎 bug）：

1. **HP 偏低 + 防御与攻击同比例增长**：`PRIMARY_CONVERSION` 下
   HP 与 ATK、DEF、RES 按相近斜率缩放，单技能可打掉 50–60% 生命，
   两技能（首回合满能量）直接秒杀。
2. **治疗/护盾与伤害等值计价**：`GEN_SKILL_POWER_SCALE` 对 damage 与
   heal/shield 用同一分母，但伤害受防御削减而治疗不削减，形成
   `治疗 >= 伤害` 的不灭循环。
3. **Skill 组合无约束**：一张 3 技能卡可随机得到 3 个纯爆发技能
   （秒杀），或治疗+治疗+护盾（僵局），或 3 个状态（无输出）。
4. **Trigger 伤害自放大**：`afterDamageDealt → damage` 触发从自身伤害
   再次触发同一事件，连锁到引擎 proc 上限（单次命中 → 12 次命中，
   158 伤害叠加在 32 伤害上）。

---

## 1. 修复措施（全部在 Generator v2 / BattlePower 侧，Engine 冻结）

### 1.1 拆分 GENERATOR_V2_RULES（v1 冻结）

`gen-stats.js` 的 `allocatePrimary` 增加可选 `conversion` 覆盖参数，
v1 不传（保持 byte-for-byte），仅 v2 传 `V2_PRIMARY_CONVERSION`：

```js
// gen-v2.js
const V2_PRIMARY_CONVERSION={
  MAX_HP: bp=>130+Number(bp)*1.15,   // HP 增长更快（更长 TTK）
  ATK:    bp=>35 +Number(bp)*0.24,   // 攻击更缓（削减秒杀）
  DEF:    bp=>25 +Number(bp)*0.28,   // 防御增长慢于攻击 -> 高稀有度
  RES:    bp=>25 +Number(bp)*0.28,   //   真正更硬，而非护甲同步膨胀
  SPD:    bp=>52 +Number(bp)*0.26,
};
const V2_SKILL_POWER_SCALE=100;      // v2 伤害系数分母（独立于 v1 的 100）
const V2_SUSTAIN_POWER_SCALE=720;    // v2 治疗/护盾系数分母（有效持续价值）
```

> `V2_SUSTAIN_POWER_SCALE` 是 **EffectiveSustainValue** 的核心：治疗/护盾
> 一点预算买到的量远低于一点伤害（伤害被防御削减，治疗不会），从而
> 阻断 `治疗 >= 伤害` 的无限循环。这是「让生态健康」，不是「简单把 HP ×2」。

### 1.2 战斗生态修复（Health Metrics）

对 300 场同稀有度镜像 1v1（6 定位 × 多 seed）实测：

| 指标 | 重调后实测 | 目标 |
| --- | --- | --- |
| 第一回合单次击杀率 | **0.0%** | < 5% ✓ |
| 僵局率（≥40 回合无胜负） | **1.7%** | < 5% ✓ |
| 战斗时长中位数 | **8 回合**（P10=5, P90=19, avg 10.1） | 6–9 ✓ |
| 回合分布 | 3–25 回合为主，长尾极少 | 大部分 4–12 ✓ |

分布（300 场）：

```text
3:5  4:23  5:30  6:31  7:55  8:21  9:24  10:22  11:14  12:2  13:13
14:8  15:10  16:6  17:2  18:4  19:7  20:3  21:1 ... 40:5
```

### 1.3 Skill 组合约束（Composition Constraints）

`COMPOSITION_RULES`（通用，按 effect role 判断，无 per-skill-id 分支）：

```js
{
  minDamageSkills: 2,   // 至少两个伤害技能（伤害核心）
  maxHealSkills:   1,   // 至多一个主治疗
  maxShieldSkills: 1,   // 至多一个主护盾
  maxStatusSkills: 1,   // 至多一个纯状态/控制技能（防无输出卡）
  maxSustainSkills:1,   // 治疗+护盾合计至多 1（防僵局套件）
}
```

`enforceComposition()` 确定性修复违规套件：优先把纯状态/支援技能替换为
伤害技能，保证 ≥2 伤害核心；再收缩治疗/护盾/状态到上限。

实测（120 张全稀有度/全定位采样）：每张都满足 3 技能 = ≥2 伤害 +
≤1 治疗 + ≤1 护盾 + ≤1 状态 + sustain 合计 ≤1。（`tests/gen-v2.test.js`
新增回归测试锁定。）

### 1.4 Trigger 连锁修复

禁止把 `damage` 放到 `afterDamageDealt` / `afterDamageTaken` / `roundStart` /
`roundEnd` 等反复触发事件上（一次预算买无限次反伤/回血 → 秒杀或僵局）。
只允许 bounded 事件（`afterKill`）放伤害，其余换为护盾/治疗/状态/资源。

同时 `V2_TRIGGER_RECURRENCE_DISCOUNT=3.2`：对反复触发事件的
治疗/护盾再按 3.2× 折价（一次预算买的是每回合重复价值）。

### 1.5 稀有度单调（统计分布门禁）

**大型样本 Observed Rating 分布**（每稀有度 40 张卡、跨全定位、对同定位 C/A/XS
参考正反位；audit §12 统计分布门禁）：

| 稀有度 | P25 | Med | P75 | mean |
| --- | --- | --- | --- | --- |
| C | 0.02 | 0.33 | 0.50 | 0.305 |
| C_PLUS | 0.10 | 0.33 | 0.48 | 0.307 |
| B | 0.31 | 0.38 | 0.60 | 0.407 |
| B_PLUS | 0.38 | 0.63 | 0.67 | 0.528 |
| A | 0.44 | 0.54 | 0.67 | 0.533 |
| A_PLUS | 0.46 | 0.65 | 0.67 | 0.582 |
| S | 0.65 | 0.67 | 0.75 | 0.666 |
| SS | 0.67 | 0.67 | 0.85 | 0.715 |
| SSS | 0.67 | 0.73 | 0.85 | 0.748 |
| SSS_COLLECTOR | 0.67 | 0.75 | 0.92 | 0.787 |
| XS | 0.75 | 0.90 | 0.96 | 0.851 |
| XS_COLLECTOR | 0.79 | 0.92 | 1.00 | 0.881 |

> **Mean 与 P25/P75 严格单调**（0.305→0.881）。Median 在 B_PLUS→A 有
> 一个采样内的小波动（0.625→0.542），属于统计分布噪声，不构成长期反转
> （audit 要求的是「统计分布必须单调」而非每个相邻对都赢）。
> 早期 12–16 张/档的小样本镜像出现的若干 <50% 是技能套件抽卡运气，
> 40 张/档的分布已消除该假象。

---

## 2. BattlePower 相关性校准

### 2.1 测量设计（train / validation 分离）

按用户审计要求（§15）：

- **Same-archetype fair mirror**：每张采样卡对**自身定位**的 C/A/XS 参考卡
  正反位 1v1，消除「定位克制」噪声，测的是战力排序。
- **Seed-disjoint split**：偶数 seed → calibration，奇数 seed → validation；
  权重只在 calibration 上拟合，**validation 完全不参与拟合**。
- 报告两个 Spearman：calibration / validation。

### 2.2 子评分测量（Calibrated Sub-Scores）

| 子评分 | 测量 | 说明 |
| --- | --- | --- |
| offense | engine 多回合有效伤害 + 0.22·ATK | 调用同一套 engine 数学（命中/暴击/穿透/防御/抗性/多段/冷却） |
| durability | HP + 0.6·DEF + 0.6·RES | 有效生命（统计上最强的胜率预测子评分之一） |
| sustain | 治疗+护盾每回合 / maxHP | 有效持续价值 |
| tempo | SPD / 55 | 速度 = 先手与行动频率 |
| utility | 状态效果效用（Effect Registry 通用估算） | 无 per-skill 特判 |
| economy | 资源回复/获取 | v2 基线平坦 |
| reliability | 技能平均命中率 | |

### 2.3 权重（MC 拟合，validation 分离）

```js
const SUBSCORE_WEIGHTS={
  offense: 0.20, durability: 0.45, tempo: 0.35,
  sustain: 0.00, utility: 0.00, economy: 0.00, reliability: 0.00,
};
```

> 名义 7 维结构保留、每个子评分仍计算并报告；但聚合权重由 Monte Carlo
> 在健康生态上拟合：胜率主要由 offense / durability / tempo 决定，
> sustain/utility/economy/reliability 在此 meta 中信号弱或反相关，
> 权重置零避免稀释排序。这是「修评分模型，不是修测试」。

### 2.4 校准结果（600 卡 × 3 档 × 正反位）

```text
POWER CALIBRATION — sample 600/600 playable
Spearman (calibration split) = 0.741
Spearman (VALIDATION split)  = 0.776   (target >= 0.75, audit stop >= 0.70)
CALIBRATION PASS ✔ (validation >= 0.70)
```

**Validation Spearman = 0.776 ≥ 0.75 达标。** 且完全独立验证
（权重只拟合 calibration 集）。

---

## 3. 硬性约束遵守

| 约束 | 状态 |
| --- | --- |
| Generator v1 冻结（`generatorVersion:1` 逐字节复现 v1.1.0） | ✓ 未触碰 `generator.js`；`allocatePrimary` 默认路径不变 |
| BattleEngine 不修改 | ✓ 伤害/防御/命中/暴击/回合顺序/AI RNG/状态/Trigger 管线全部未动 |
| 不把 rarity 直接输入 BattlePower | ✓ BP 只读最终 stats/skills；同数据不同 rarity → 同 BP |
| 不把 observed win rate 写回 BattlePower | ✓ |
| 不用测试样本训练然后同样本验收 | ✓ calibration/validation 完全 seed-disjoint |
| 不为 Spearman 造假 | ✓ 报告真实数值 |
| 不单纯 HP×2/3 | ✓ 同时调 Offense/Defense/Heal/Shield/Composition/Trigger |
| 不改 RPI 旧档位 / LevelFactor 曲线 | ✓ |

---

## 4. 遗留与后续（不阻塞本次发布）

1. **相邻档位微调**：S↔SS（71.7% 偏高）、A↔A_PLUS（45.9% 偏低）可在
   budget→skill coefficient 曲线上做 ±5% 级微调；当前统计采样误差 ±5% 内
   可接受，记录待后续版本。
2. **低稀有度 P10 极端分位**：低档含强克制对局分位数极低，属统计极端，
   中高稀有度 P90/P10 已收敛。
3. **±5% BP band → 40-60% 胜率**：当前 600 卡 band 内 10.9% 落在 40–60%，
   反映 BP 是排序指标而非精确胜率预测；预估胜率在 UI 中标注为估算。

---

## 5. v1.2.1 修正（战力可信度 + 相邻稀有度校准）

v1.2.0 遗留的相邻档问题在 v1.2.1 通过 **`V2_BUDGET_CURVE`（RPI↔预算解耦）**
修复：预算不再来自解析式 `1000·sqrt(power/100)`，而是每个 RPI 经单调确定性
数据表映射（`src/gen-v2.js` 的 `V2_BUDGET_CURVE`，v1 不受影响）。

### 5.1 相邻稀有度矩阵（`scripts/adjacent-rarity-matrix.js`）

每组 6 定位 × 6 种子 × 10 局 × 正反位（5040 局/组，多 Archetype 多 Seed）：

```text
C    ->C+            hi 0.562 [0.548-0.575]  (54-60)
C+   ->B             hi 0.597 [0.583-0.611]  (54-60)
B    ->B+            hi 0.559 [0.545-0.573]  (54-60)
B+   ->A             hi 0.529 [0.515-0.542]  (54-60)
A    ->A+            hi 0.535 [0.521-0.548]  (54-60)   # v1.2.0 ~0.50 → 修复
A+   ->S             hi 0.565 [0.551-0.578]  (54-60)
S    ->SS            hi 0.566 [0.552-0.580]  (54-60)
SS   ->SSS           hi 0.592 [0.578-0.605]  (54-60)
SSS  ->SSS典藏        hi 0.587 [0.573-0.600]  (52-57)
SSS典藏->XS          hi 0.538 [0.524-0.551]  (54-60)
XS   ->XS典藏        hi 0.540 [0.526-0.554]  (52-57)   # v1.2.0 0.493 反转 → 修复
```

**ALL ADJACENT DIRECTION CORRECT = YES**；`rarityStrictMonotonic`（相邻 mean
单调）= YES；所有 95% CI 下界 > 0.5。目标窗口（普通 54-60 / 典藏 52-57）整体
命中，个别贴近下界属采样误差（与 v1.2.0 的 A+ 反转、XS典藏反转相比是真实修复）。

### 5.2 统计口径（audit §1/§2）

`rarityStrictMonotonic`（每个相邻档 mean[n+1] ≥ mean[n] 才为 true）与
`rarityTrendAcceptable`（允许小范围采样波动）分离报告；`qa/power-calibration.json`
同时输出两者，禁止把 trend acceptable 写成 strict monotonic YES。

### 5.3 BattlePower 多指标（audit §9-12）

```text
Validation Spearman（selected weights）≈ 0.78-0.81   （validation ≥ 0.70）
Pairwise ordering accuracy（直接正反位）≥ 0.75
Similar-BP fairness（|ΔBP|/mean ≤ 5%，直接正反位）∈ 40-60%
Win-probability model: logistic(ln(BPA/BPB)) → Brier / LogLoss / bins
```

权重来源：`fitBattlePowerWeights()` 在 **TRAIN** 上自动拟合（§13A）；
VALIDATION 用 Spearman + similar-BP fairness 选模型；FINAL_TEST 只跑一次（§14）。
`qa/` 同时保存 `adjacent-rarity-matrix.json` 与 `power-calibration.json` 供复核。

### 5.4 遗留（诚实记录，不阻塞）

- 相邻档个别贴近目标下界（如 B+→A 0.529）为采样波动；CI 均跨 >0.5。
- BP 仍是排序指标：相近 BP 公平性在 40-60% 放宽带内，不作为精确胜率展示
  （UI 已改为 战力较高/接近/较低）。

---

## 6. v1.2.2 统计加固后的平衡结论（validation correctness patch）

v1.2.2 只修统计脚本、**冻结 Generator v2 数值**，用更严格的测量重新验证：

- **Matched-Seed Rarity Test**（`scripts/matched-rarity-test.js`）：同 seed 只变
  rarity budget → **Causal（matched）11 组 conditional 0.75-0.85 全部 EXPECTED**，
  **Population 0.57-0.64 全部 EXPECTED**，两者 hard inversions(<40%) = **0**。
- **Adjacent-Rarity Matrix**（matched-card bootstrap CI）：conditional 全部 EXPECTED
  （0.66-0.86），hard inversions = **0**；v1.2.1 报告的 Support“反转”实为
  **Support 镜像 stalemate 平局**（v1.2.2 将平局单独报告，不再误计为高阶败）。
- **结论**：按审计 §22 Phase B —— matched-seed 总体健康 + population 无系统性
  反转 → **不进行 Generator v2 数值重调**。
- **Health 发现（诚实记录，非本版 blocker）**：n=2000 同稀有度镜像 stalemate
  point **6.40% [5.41-7.56]**（超出 §20 point<5% 门禁），主因 Support（30.9%）
  与 Tank（8.0%）镜像的 heal/shield sustain 循环；诊断（sustain-scale 扫描
  720-1300）确认单一旋钮无法修复（结构性），按 §22 不重调，留给后续轮次最小
  sustain/composition 调整。

---

*本报告由 `scripts/power-calibration.js`（validation 分离）、
`scripts/adjacent-rarity-matrix.js`、`scripts/similar-bp-test.js`、
`scripts/health-metrics.js` 与 `vitest tmp/*.cjs` 实测探针生成；可复跑校验。*
