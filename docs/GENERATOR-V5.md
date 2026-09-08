# Generator v5 — Level × Rarity 强度体系 + 物种命名 + 对局随机语义

> 生效版本：本仓库当前默认生成器。v1/v2/v3/v4 全部保留为 legacy 兼容（逐字节复现历史输出）。

## 1. 强度哲学（五个独立但一致的支柱）

```
Level      = 这张卡处在哪一个成长尺度          （LevelScale）
Rarity     = 在这个成长尺度内允许的实力 min–max （PowerEnvelope）
Seed       = 卡牌在稀有度区间内的个体位置 + 机制结构（deterministicQualityPercentile + structure）
Mechanics  = 它如何使用这些实力（打法/克制/爆冷）
BattlePower= 它最终实际有多强（BattlePower v3 真实估算，绝不读稀有度/等级）
Name       = 它在世界中的身份（Name Generator v2，同 seed 同名）
```

**核心不变量（测试守护）**：

- 同等级下：`max(低稀有度) < min(高稀有度)` —— 低稀有度卡牌的真实综合实力**不能**穿透高稀有度区间。
- `C+ Lv100` 永远不会 `BattlePower ≥ A+ Lv100`（跨种子回归测试）。
- 同 seed 只改 Lv/Rarity：`mechanicFingerprint` 完全相同（机制不被强度改写）。
- BattlePower 是真实测量：改 ATK/HP/系数会真实改变它；不是 rarity 查表，不是 clamp。
- 允许爆冷：同 BP 或弱克制的对局中弱卡可以赢；极端差距下弱卡可以 0% 胜率。随机只来自真实战斗系统。

## 2. LevelScale（power-v5.js）

```
LevelScale(L) = 0.10 + 0.90 * ((L-1)/99)^0.95
Lv1≈0.10 · Lv10≈0.19 · Lv25≈0.33 · Lv50≈0.56 · Lv75≈0.78 · Lv100=1.00
```

Level 定义该等级允许存在的**整体数值尺度**；它不是单属性线性乘数，而是包络缩放基准。

## 3. Rarity PowerEnvelope（power-v5.js）

Lv100 权威区间（其他等级 = Lv100 区间 × LevelScale(level)）：

| Rarity | Lv100 Min | Lv100 Max |
| --- | ---: | ---: |
| C | 1000 | 1040 |
| C+ | 1050 | 1100 |
| B | 1110 | 1160 |
| B+ | 1170 | 1230 |
| A | 1240 | 1300 |
| A+ | 1310 | 1380 |
| S | 1390 | 1460 |
| SS | 1470 | 1540 |
| SSS | 1550 | 1620 |
| SSS 典藏 | 1630 | 1690 |
| XS | 1700 | 1760 |
| XS 典藏 | 1770 | 1840 |

`PowerEnvelope(level, rarity) → {min, target, max}`；`targetPower = lerp(min,max,q)`，q 取包络内 5%–95% 内区间（防整数取整越界）。

## 4. v5 生成管线（gen-v5.js）

```
Seed
 ↓
生成结构（同 v4 结构哲学：FAMILIES/条件/目标/资源/触发；PRNG 只吃 seed，不吃 Lv/Rarity）
 ↓
Mechanic Fingerprint（不随强度变化）
 ↓
LevelScale + PowerEnvelope → targetPower
 ↓
生成初始数字
 ↓
BattlePower v3 测量
 ↓
有界确定性校准（bisection on 强度连续统 k：只缩放 ATK/MAX_HP/DEF/RES/SPD，
  不碰 cooldown/cost/resource/status/duration/离散结构）→ 落入包络
 ↓
物种专名（Name Generator v2）
 ↓
输出 v5 卡
```

校准是**真实的数值缩放**，不是显示 clamp：数值真的变了，BP 真的因此落在包络内。

## 5. BattlePower v3（battlepower-v3.js）

- 只读真实 `stats / actions / formulas / statuses / triggers / passives`。
- **绝不**读取 `rarity / level / generationBudget / quality / MatchSeed`。
- 同一份真实数字 → 同一 BP，无论贴什么稀有度标签（测试证明）。
- 分层特征：offense / durability / sustain / utility / economy / tempo / reliability。
- v4 旧卡继续用 BattlePower v2（legacy）；v5 卡显示/诊断一律用 v3。

## 6. Name Generator v3（name-generator-v3.js）

- 名字是 **Presentation Identity**：只由 `seed` 决定（`originSeed ?? seed ?? id`），
  绝不读稀有度/等级/BP/stats/Action/status/resource/role/机制指纹。
- 六个纯语音家族（ROUND / AGILE / HEAVY / SLEEK / WILD / ANCIENT）只提供不同发音轮廓，
  由 Seed PRNG 决定，与战斗机制无关，不出现在 UI。
- 长度：2 字 10% / 3 字 70% / 4 字 20% / 5 字禁止；全部字符来自 canonical 常用字符池。
- 校验：2–4 字、只允许 canonical 字符、字符互不重复、禁用泛化怪物后缀（兽/龙/王…）、
  禁用已知名称（皮卡丘/妙蛙/安娜…）；失败整体重 roll（≤64 次），绝不拼接修补。
- `generateSpeciesNameV3` 是纯确定性 base name；`createNameRegistrarV3` 处理批量碰撞
  （整体重新生成，不追加数字/字符）。
- 官方 60 预设使用**人工定稿名称**（scripts/apply-preset-names-v3.js），只改 name/displayName，
  其余字段与 fingerprint 逐字节不变。
- v1（gen-names.js）与 v2（name-generator-v2.js）保留为 legacy 兼容。

## 7. 对局随机语义（app.js / kernel.js）

- **确定性保留**：同 `MatchSeed + 相同输入` = 完全相同结果（Replay/调试/测试依赖）。
- **普通「开始对战」「重开」每局新 MatchSeed**：`crypto.getRandomValues`（fallback：Date.now+计数器+会话熵，不用 Math.random）。
- **高级复现**：Replay / 高级实验室「同种子重放(复现)」使用固定种子。
- **有界随机先手（Initiative）**：同 Priority 层内 `initiative = SPD × jitter`，jitter∈[0.85,1.15]，读取对局 PRNG：
  - 同速 ≈50/50；小速度优势（85v80）≈60–70%；大差距（120v50）100% 先手。
  - Priority 永远压过随机 SPD；无界分布被禁用。
- **BattlePower 与 MatchSeed 严格分离**：单局随机只影响单局轨迹，不影响卡牌实力。

## 8. 多人显式编队（app.js）

- `selectedTeams = {A:[cardId...], B:[cardId...]}`，按卡牌 ID 存储（不受卡池顺序变化影响）。
- 1v1 默认最简界面；高级设置调整人数后每个槽位独立选卡/换卡。
- **绝不自动补卡**：未填满时「开始对战」disabled，并提示「还需选择 N 张卡牌」。
- 返回选卡保留阵容；重开保留阵容但换新种子。
- 允许同一张卡在一队出现多次（[X,X,X]）。

## 9. 官方预设迁移（scripts/migrate-presets-v5.js）

- `content/presets-v5.json` = 60 张新官方预设；`presets-v4.json` 保留为 legacy fixture。
- 每张卡：**保留结构/mechanicFingerprint/seed/rarity/level**，仅重命名（Name v2）+ 数值重校准到包络。
- 60/60 落入 Level×Rarity 包络，名字 60/60 唯一。
