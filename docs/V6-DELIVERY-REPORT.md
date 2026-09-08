# Generator v6 Final Delivery Report

> Release: v1.5.0. Baseline: `5d330b91416b2362135a458b810d8cf67a0e9118`.

## Audit bug and corrected baseline

The old `hiWin()` awarded two high-side wins whenever the high card won either battle in a mirrored pair. A true 50% per-battle card therefore appeared to win 75% of pairs. The new shared scorer records both battles independently and uses the identical paired seed for both side assignments.

The untouched pre-refactor generator was remeasured and frozen in `qa/v6-strength-baseline-corrected.json`. It exposed real inversions hidden by the old metric: A vs S and A vs SS were 10/30 high-side wins, while Lv75 A vs Lv100 A was 0/30.

## Strength model and allocation

Level × Rarity sets ExpectedStrength. Seed creates a normalized eight-category allocation; it cannot change the total. The eight representative Lv50 A cards in `qa/v6-budget-distribution.json` all target 1571.91 priced units but have different profiles, panels, actions, and victory paths.

Examples include offense seed 54 (ATK 391.8 / HP 940.6), durability seed 23 (ATK 165.5 / HP 2428.6), sustain seed 11 (DoT + stance, HP 2394.9), control seed 86, tempo seed 46, economy seed 48, reliability seed 12, and trigger seed 80.

## Panel and budget distribution

For 100 Lv50 A cards:

| Stat | mean | std | p5 | p95 |
|---|---:|---:|---:|---:|
| ATK | 299.3 | 120.6 | 157.7 | 530.8 |
| MAX_HP | 1601.4 | 510.7 | 688.2 | 2395.7 |
| DEF | 129.5 | 54.7 | 58.1 | 238.6 |
| RES | 140.1 | 54.5 | 60.7 | 239.4 |
| SPD | 279.7 | 135.1 | 130.4 | 526.4 |

PricedStrength / ExpectedStrength p5, p25, p50, p75, and p95 are all 1.000 at three-decimal reporting precision; maximum absolute deviation is below the 5% contract.

## Corrected empirical strength

The final sampled audit uses 20 cards per tier and 10 paired Match Seeds per card (400 battles per bucket). Team-side rates remain near 50/50.

Rarity examples: C→C+ 65.0% [60.2, 69.5], A→A+ 60.0% [55.1, 64.7], A→S 75.0% [70.5, 79.0], C→B 95.0% [92.4, 96.7], and C→A 100% [99.0, 100].

Level examples: Lv10→20 75.0% [70.5, 79.0], Lv10→30 85.0% [81.2, 88.2], Lv10→50/75/100 100% [99.0, 100], Lv50→100 72.5% [67.9, 76.6], and Lv75→100 70.0% [65.3, 74.3]. One population bucket, Lv50→75, measured 50.0% [45.1, 54.9]; it is retained as a real residual allocation/matchup limitation rather than hidden.

Cross Level × Rarity results follow ExpectedStrength: Lv20 XS over Lv50 A 95.0%; Lv30 S over Lv60 B 67.5%; Lv40 SSS over Lv80 C 95.0%; Lv50 XS over Lv100 C 100%.

Across the full 60-preset matrix, ExpectedStrength ratio buckets rise from 59.7% at 1.00–1.34, to 72.3% at 1.35–1.99, 89.6% at 2.00–3.99, and 99.6% at 4.00+. Team A/B wins are 1760/1754.

## Seed dispersion and matchup diversity

Lv50 A universal-strength p5/p25/p50/p75/p95 is 0.333/0.500/0.583/0.667/0.875 against a 12-opponent cross-tier field. This spread is materially smaller than major-tier gaps, but is not zero. The audit also records 20 same-tier 70/30-or-stronger matchup examples, demonstrating that budget convergence did not erase counterplay.

## Independent measurement and performance

BattlePower v3 reads content only. Across 300 generated cards, ExpectedStrength and BattlePower have Spearman 0.931 (Pearson 0.717), despite using different formulas.

Generating 1000 cards takes 683.264ms total on the release machine: median 0.654ms/card and p95 0.989ms/card. Generator v6 no longer runs a battle, AI planner, opponent, Monte Carlo selection, or BattlePower.

## Default product and compatibility

Normal `generateCard()` and `generateCardByVersion()` calls produce v6. `SYSTEM_PRESETS` is the 60-card v6 catalog. UI generation, regeneration, preset selection, and BattlePower display use the v6 path. Explicit `generatorVersion: 1|2|3|4|5` remains legacy; Naming V3 names, match randomness/initiative/replay, and multi-team selection remain unchanged.

## Evidence index

The corrected baseline, final strength, level, rarity, ExpectedStrength, seed dispersion, budget distribution, preset matrix, BattlePower correlation, and performance artifacts are all stored under `qa/v6-*.json`. Final Git commit, push, CI run, and complete verification counts are reported with the release handoff after they exist.
