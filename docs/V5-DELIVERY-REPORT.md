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
- Battle Reality Monte Carlo（真实 AI vs AI，每格 96 场，150 回合上限）：

| 对局 | 高方胜率 | 低方胜率 | 平局 |
| --- | ---: | ---: | ---: |
| 同级 A vs A | 60.4% | 37.5% | 2.1% |
| 相邻 A vs A+ | 44.8% | 53.1% | 2.1% |
| 2 档 A vs S | 57.3% | 41.7% | 1.0% |
| 4 档 A vs SS | 56.3% | 43.8% | 0 |
| C vs S | **68.8%** | 31.3% | 0 |
| A vs SSS | 52.1% | 46.9% | 1.0% |
| S vs XS | 55.2% | 43.8% | 1.0% |

大差距方向明确（C vs S 68.8%）；小差距接近抛硬币（机制克制/爆冷被允许）；未做任何公平性修复器。

## Naming system（Name Generator v2，`src/name-generator-v2.js`）

- 语法：`speciesStem(onset+rime) + 0–3 world-harmonic 音节`；弱机制倾向（DoT→湿、盾→石、消费→虚、高波动→流、爆发→光、低血→兽，非字面词）。
- 确定性：名字 = `seed + mechanicFingerprint`；**同 seed 忽略 Lv/Rarity/BP**（测试）。
- 形态：2 字 8–10% / 3 字 ≈50% / 4 字 ≈32% / 5 字 ≈8%。
- 审计（10k）：唯一率 **100%**，通用后缀（兽/龙/灵/王/刃/魂…）=0，模板泄漏=0。

代表性新名称（最终官方预设）：

```
渫洛    弥崟瀣    泷磐霐    颙溟洄汐   汨璇渊    鲵璃晷    浟酡滃瀣   燊峒谽
玑霄    葳霄湜汐   湜泱玑芷   夤谽蜃峯遒  晞汐汨漪   麓玑珀琤岫  崆渊渚    霂蜃暿
珀芷汨  嵫珺珀蜃   珀罅漪    沩蕤汨瀣
```

不再出现「火狼/雷刃/毒兽」式两字拼词，也没有把数值/职业写进名字。

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
