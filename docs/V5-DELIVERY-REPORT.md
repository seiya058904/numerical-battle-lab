# V5 交付报告 — Level × Rarity 强度体系 + 物种命名 + 对局随机语义 + 多人显式编队

> 版本：v1.4.0（Generator v5 默认；v1/v2/v3/v4 legacy 保留）。基线 HEAD：`f397ffc`。

## Git

```
OLD HEAD:      f397ffc3f8673c5fed18e16f94022e79c89b90e3
NEW HEAD:      <commit>
commits:       1（本地提交；未 push）
git status:    clean after commit
```

## Power system（v5 强度体系）

- **LevelScale**（`src/power-v5.js`）：`LevelScale(L)=0.10+0.90·((L-1)/99)^0.95`；
  Lv1≈0.10 / Lv10≈0.19 / Lv25≈0.33 / Lv50≈0.56 / Lv75≈0.78 / Lv100=1.00（测试校验）。
- **Rarity PowerEnvelope**：Lv100 区间（其余等级 = ×LevelScale）——12 档严格不相交且递增
  （`max(低) < min(高)`，测试在 Lv1/10/25/50/75/100 全部校验）。
- **v5 管线**（`src/gen-v5.js`）：先生成结构（mechanicFingerprint 与 Lv/Rarity 无关）
  → 算 targetPower（包络内 5%–95% 由 seed 质量百分位定位）→ 初始数字 → BattlePower v3 测量
  → 有界确定性校准（对 ATK/MAX_HP/DEF/RES/SPD 强度连续统做 bisection；cooldown/cost/resource/status/离散结构不动）。
- **BattlePower v3**（`src/battlepower-v3.js`）：只读真实 stats/actions/formulas 的静态估算；
  不读稀有度/等级/generationBudget；不 clamp；不随对局种子变化。v4 旧卡继续用 BattlePower v2。
- **为什么不再出现 C+ > A+ 倒挂**：v4 中 `BP = generationBudget × mechanicFactor`（±4.5× 漂移）；
  v5 中 BP 是真实测量，强度由包络 target 通过校准烤进真实数值，因此低稀有度永远进不了高稀有度区间。

## Rarity audit（Lv100）

| Rarity | 包络 min–max | 样本 min BP | 样本 max BP |
| --- | ---: | ---: | ---: |
| C | 1000–1040 | 1001 | 1036 |
| C+ | 1050–1100 | 1052 | 1099 |
| B | 1110–1160 | 1113 | 1159 |
| B+ | 1170–1230 | 1174 | 1228 |
| A | 1240–1300 | 1242 | 1298 |
| A+ | 1310–1380 | 1311 | 1379 |
| S | 1390–1460 | 1392 | 1459 |
| SS | 1470–1540 | 1473 | 1539 |
| SSS | 1550–1620 | 1552 | 1619 |
| SSS 典藏 | 1630–1690 | 1633 | 1688 |
| XS | 1700–1760 | 1702 | 1757 |
| XS 典藏 | 1770–1840 | 1773 | 1839 |

## Level audit（同 seed 同稀有度）

`A` 稀有度，seed=`level-audit`：

```
Lv1 → 125   Lv10 → 241   Lv25 → 419   Lv50 → 704   Lv75 → 983   Lv100 → 1255
```

严格递增；Lv100/Lv1 ≈ 10×（等级真正有意义）。

## Explicit regression（C+ Lv100 vs A+ Lv100）

- 跨种子 BP：250 个 seed，C+ 最大 = **1099** < A+ 最小 = **1312**（测试 + 审计）。
- Battle Reality：见下方「BattlePower Reality」大样本实证（数千场 canonical AI 对战）。

## BattlePower Reality（BP 与真实胜率对齐）

BLOCKER 1 修复：BattlePower v3 升级为 v3.1 —— 加入 **AI-usability 折扣**（AI 主要打最优
Action，其余 Action 只计 0.35）、**真实条件概率**（hpPctBelow/resourceAtLeast/targetHasStatus
按分布估计，不再固定 0.6/0.4）、**资源可支付性** 限制行动频率、并降低对原始 HP/DEF 的权重
（Battle Wear 按 maxHp 比例结算，纯肉度不等于真实强度）。包络/等级/稀有度体系不变。

大样本实证（canonical AI vs AI，150 回合上限；`scripts/empirical-strength-audit.js`，
完整数据 `qa/empirical-strength.json`，1000 卡池 / 2400 场确定性对局）：

| BP 差距分桶 | 场数 | 高 BP 胜率 | 低 BP 胜率 | 平局 |
| --- | ---: | ---: | ---: | ---: |
| tiny ≤1.05 | 343 | 50.4% | 48.7% | 0.9% |
| small 1.05–1.15 | 596 | 52.9% | 46.1% | 1.0% |
| medium 1.15–1.25 | 442 | **56.8%** | 41.4% | 1.8% |
| medium-large 1.25–1.40 | 441 | **59.2%** | 39.9% | 0.9% |
| large 1.40–1.60 | 415 | 55.2% | 43.4% | 1.4% |
| very-large ≥1.60 | 163 | 57.7% | 39.9% | 2.5% |

| 稀有度差距分桶 | 场数 | 高稀有度胜率 | 低稀有度胜率 | 平局 |
| --- | ---: | ---: | ---: | ---: |
| same | 185 | 51.9% | 47.6% | 0.5% |
| 1 档 | 355 | 49.6% | 49.3% | 1.1% |
| 2 档 | 349 | **54.4%** | 45.0% | 0.6% |
| 3–4 档 | 576 | **55.6%** | 42.5% | 1.9% |
| 5–7 档 | 583 | **59.2%** | 40.0% | 0.9% |
| 8+ 档 | 352 | 55.7% | 42.0% | 2.3% |

趋势成立：BP 差距与稀有度差距增大 → 高方胜率**总体**单调上升（BP：tiny 50.4% → small 52.9%
→ medium 56.8% → medium-large 59.2%，large/very-large 保持 55–58%；稀有度：same/1 档 ≈50%
→ 2 档 54.4% → 3–4 档 55.6% → 5–7 档 59.2%）。大差距不再是抛硬币（>55%），小差距（相邻/
同档）允许机制克制爆冷。未做任何公平性修复器。极高端偶有回摆（large 55.2% < medium-large
59.2%、8+ 55.7% < 5–7 59.2%）属抽样噪声与跨结构克制，整体「越大差距越占优」成立。
（注：修复前 medium 桶 51.6%，修复后 ≥56%。）

## Naming system（Name Generator v3，`src/name-generator-v3.js`）

- 名字是 **Presentation Identity**：只由 `seed`（`originSeed ?? seed ?? id`）决定，
  绝不读稀有度/等级/BP/stats/Action/status/resource/role/机制指纹（测试：改 stats/actions/fingerprint 不改名）。
- 六个纯语音家族（ROUND / AGILE / HEAVY / SLEEK / WILD / ANCIENT）只提供发音轮廓，由 Seed PRNG 决定，不与机制绑定。
- 长度：2 字 10% / 3 字 70% / 4 字 20% / **5 字禁止**；全部字符来自 canonical 常用字符池。
- 校验：2–4 字、只允许 canonical 字符、字符互不重复、禁用泛化怪物后缀（兽/龙/王/鬼/魔/妖/神/仙/狼/虎/鹰/蛇/虫/鱼/犬/猫）、
  禁用已知名称（皮卡丘/妙蛙/安娜/莉莉…）；失败整体重 roll（≤64），绝不拼接修补。
- `generateSpeciesNameV3` 纯确定性 base name；`createNameRegistrarV3` 批量碰撞时整体重新生成（`|collision:N`），不追加数字。
- 官方 60 预设使用**人工定稿名称**（`scripts/apply-preset-names-v3.js`，只改 name/displayName，fingerprint 60/60 不变）。
- v1（gen-names.js）与 v2（name-generator-v2.js）保留为 legacy 兼容。
- 审计（10k，`qa/naming-v3-audit.json`）：registeredUnique=**10000**、commonCharacterRate=**100%**、
  rareCharacterCount=**0**、forbiddenSuffix=**0**、repeatedCharacter=**0**、5-char=**0**；
  长度 2 字 7.3% / 3 字 68.8% / 4 字 23.9%（碰撞重 roll 的轻微偏差，规格允许）。

## 最终官方预设名称（60/60 人工定稿）

```
00 米洛    01 咕拉奇   02 诺米亚   03 布鲁米   04 啵洛安   05 莫里亚姆
06 咪诺拉   07 波奇姆   08 阿米洛   09 布洛奇安
10 奇洛    11 卡维克   12 迪诺克   13 提拉奇   14 皮鲁特   15 比洛克
16 希诺特   17 维拉诺克  18 卡迪诺   19 奇米克亚
20 克塔    21 塔鲁克   22 格洛恩   23 古罗德   24 达鲁姆   25 巴洛坦
26 摩格恩   27 博鲁克   28 格鲁安德  29 塔洛克恩
30 洛菲    31 维洛恩   32 赛米亚   33 伊诺安   34 艾洛维   35 泽鲁亚
36 希拉恩   37 诺维姆   38 维米诺亚  39 赛拉维恩
40 托鲁    41 巴奇洛   42 布拉姆   43 咕鲁克   44 鲁米塔   45 莫洛奇
46 拉迪安   47 卡诺拉   48 鲁奇恩塔  49 卡米洛安
50 洛兰    51 奥兰姆   52 阿鲁恩   53 欧拉诺   54 伊赛诺   55 塔米洛
56 维赛安   57 赛鲁恩   58 阿鲁诺德  59 奥维兰恩
```

全部：60/60 唯一、无生僻字、无泛化怪物后缀、无「属性+动物」模板、可直接朗读。

## Preset migration

- `content/presets-v5.json`：**60/60** 新官方预设；`presets-v4.json` 保留为 legacy fixture。
- 全部重新命名（Name v2）；全部落入 Level×Rarity 包络（严格 60/60）；名字 60/60 唯一。
- **mechanicFingerprint 保留**（4 张旧卡在 v4 数据里存储的指纹本来就过期，本次重算为实际结构）；
- 深渊的「血性猛击受伤可用」人工修复通过迁移保留（v4 fixture 与 v5 预设均验证：血性猛击实际被使用、造成 HP 伤害、不再 69 回合 0 伤害）。

## Match Randomness（对局随机语义）

- 普通「开始对战」「重开」：每局 **新 MatchSeed**（`crypto.getRandomValues`；fallback=Date.now+计数器+会话熵，不用 Math.random）。
- 「重开」= 相同阵容 + 新 seed（browser-multi QA 验证 config 中 seed 变化而阵容不变）。
- 固定 seed 精确复现（测试：同 seed → 相同 snapshot/log）。
- Replay 逐步重现原局（测试：original snapshot === replayed snapshot）。
- 400 个新 seed 同一对战：≥50 种不同行动序列。

## Initiative（有界随机先手，`src/kernel.js`）

排序规则：`Priority → initiative(SPD×jitter∈[0.85,1.15]) → 确定性兜底`；roll 来自对局 PRNG（Replay 安全）。

实测先手率：

```
50 vs 50  → 51.2%
60 vs 50  → 93.0%
85 vs 80  → 70.0%
80 vs 50  → 100%
120 vs 50 → 100%
150 vs 50 → 100%
```

Priority 永远压过随机 SPD；无界分布未使用；极慢角色不可能随机抢过极快角色。

## Team Selection（多人显式编队，`src/app.js`）

- `selectedTeams = {A:[cardId...], B:[cardId...]}`（按卡牌 ID，不随卡池顺序漂移）。
- 1v1 最简；调整人数后每槽独立选卡/换卡；**0 自动填充**。
- 未填满 → 「开始对战」disabled + 提示「还需选择 N 张卡牌」。
- 允许同卡重复（[X,X,X]）；返回保留阵容；重开保留阵容换新 seed。
- browser-multi QA（21 项）验证：3v2 显式 [a,b,c]/[d,e] 精确进入 engine.config；5 实体进战斗；无横向溢出。

## Browser QA

- `qa/browser-v4.js`：33/33 通过（390×844 + 桌面 + file:// + 无 console error）。
- `qa/browser-knowledge.js`：18/18 通过。
- `qa/browser-multi.js`：21/21 通过。
- `qa/browser-vision.js`：15/15 真实观战播放至最终帧（使用 v5 新名字，如 渫洛/弥崟瀣/晞汐汨漪…）。

## Verification（真实结果）

```
npm test              → 282/282 PASS, 0 fail
npm run verify        → PASS（catalog + 282 tests + static checks, v1.4.0 manifest audited 233 files）
npm run verify:release→ exit 0（verify + diversity 3000 样本）
audit:power-envelope  → envelopeFailures=0, levelOk, rarityOk, C+<A+ 跨种子 PASS
audit:presets-v5      → 60/60 入包络, 唯一名 60/60, 结构自洽 60/60
audit:naming          → 10k 唯一率 100%, 后缀/模板泄漏 0
audit:numerical-coverage → undocumentedActiveFields=0（v4+v5 样本）
```

## Regression

- 确定性固定 seed：PASS；Replay：PASS；普通新局随机变化：PASS；多人显式选择：PASS。
- v1/v2/v3/v4 生成器逐字节兼容保留；数值知识覆盖零缺口；canonical AI 未改。

## Known limitations

- 长续航对局仍是已知限制（v5 预设部分对局以 Battle Wear 收束）；未做公平性修正。
- BattlePower v3 是静态估算，不承诺精确胜率；机制克制允许弱卡爆冷（小差距接近五五开）。
- 卡图仍是程序化占位级黑白插画（未做新美术系统）。
- canonical AI 仍为单步期望效用，无多回合搜索。

**READY FOR HUMAN REVIEW**
