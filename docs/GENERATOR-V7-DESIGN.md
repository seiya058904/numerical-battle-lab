# Generator V7 Design

## Why V7 exists

V6 proved that a fixed Level × Rarity budget could place cards in the right
*strength tier*, but its strength was enforced by a budget/price ledger — a
measurement loop, not a combat identity. V7 keeps "Level first, Rarity second"
and adds two things V6 could not:

1. **Reality truth**: a large mirrored battle graph measured with the real
   canonical AI, fitted by Bradley-Terry into EmpiricalTheta, so every strength
   claim is verified against actual long-run combat — not a price model.
2. **Content-native strength**: an iso-power solver that tunes individual
   numeric knobs against a content-only strength model, so the card's power
   comes from what it actually does in battle.

## World geometry

`TargetTheta = LevelScore + RarityScore - (LevelScore(50) + RarityScore(A))`

- `LevelScore(level) = 16 * ((level - 1) / 99) ^ 1.70` — convex, back-loaded.
- Rarity scores `C=0 … XS_COLLECTOR=7.60` — strictly convex increments.
- Anchor `LevelScore(50) + RarityScore(A)` → Lv50 A is theta 0.
- Invariants (asserted): full level span >= 2 × full rarity span;
  (Lv40→100 level gap) − full rarity span >= 4.5 (Lv100 C ≫ Lv40 XS Collector);
  full rarity span >= Lv70→100 level gap (extreme rarity can make a real
  suspense window at 70 vs 100).
- Geometry is generation/QA metadata only. The engine never reads it.

## Seed owns form, never tier

`styleGenomeV7(seed)` produces 8 soft preference axes. `mechanicSkeletonV7(seed)`
fixes action families, victory path, damage type, resource, status policy and
trigger event — deterministically, from the seed alone, with retries that depend
only on the seed. Therefore `mechanicFingerprint` is invariant across level and
rarity for a given seed: level/rarity scale magnitudes; they never change the
kit. Same-tier seed dispersion (p95−p5 of EmpiricalTheta at fixed level/rarity)
must stay within 1.0 theta (1.2 only with documented noise evidence), while
matchup diversity keeps genuine 80/20 same-tier counters: General Strength
convergence is not pairwise 50/50.

## StrengthModelV7 (content-only)

A reference world (`calibration/reference-world-v7.json`) defines the opponent
population. The model evaluates each action's interacting throughput — accuracy,
crit, penetration, mitigation, cooldown/RECOVERY readiness, resource
affordability, POTENCY on periodic/trigger output, BARRIER_POWER on shields,
CONTROL_POWER contest vs TENACITY — then aggregates with the One Action Rule
(best action full, others discounted) and adds trigger frequency. A shape
vector feeds a ridge correction fitted on train seed families; the committed
coefficients are selected on validation and only evaluated on test.

## SolverV7 (iso-power)

Per-knob finite-difference marginal value; each iteration picks the legal knob
with the best strength-error reduction (with style/degeneracy tie-breakers) and
moves it in log space, clamped per-knob. Convergence: |predicted − TargetTheta|
<= 0.12 absolute, median <= 0.06, p95 <= 0.12. Runtime generation never invokes
battles, AI, opponents, Monte Carlo or BattlePower.

## Empirical reality

A connected sparse graph over 180 cards (15 seed families × 12 tiers) with
same-tier, same-seed-level, near-tier, cross-tier, cross-style and extreme-gap
edges; 12 paired Match Seeds per edge, mirrored sides, canonical AI, round cap
100 → 37,440 battles. Regularized Bradley-Terry fit (draws = half score) gives
EmpiricalTheta with standard error; a linear alignment (train families only)
maps it onto the TargetTheta scale. Acceptance: Spearman(Target, Empirical)
>= 0.95.

## Multi-axis policy (Phase 6)

The V6 baseline sensitivity showed ATK and MAX_HP were the only meaningful
axes. V7 activated neutral-100 optional axes only where they add independent
value, and the final multi-axis audit requires ≥ 6 independent primary axes at
≥ 45% of ATK sensitivity, ATK ≤ 2 × peer median, and no axis > 35% of
normalized primary-axis sensitivity — ATK stays important but cannot be a God
Stat.

## BattlePower V4

Independent content-only measurement model (its own feature extraction, never
`predictThetaV7`), ridge-calibrated against holdout EmpiricalTheta with
seed-family isolation. DoD: holdout Spearman ≥ 0.90; pair ordering accuracy
≥ 95% for |EmpiricalTheta gap| ≥ 1.5; strong inversion rate ≤ 2%. Display power
is a monotone transform anchored near 1000 at Lv50 A.

## Product acceptance (final product constitution)

| Case | Requirement |
|---|---|
| Lv100 vs Lv40 (same rarity) | Lv100 ≥ 99% aggregate, Wilson lower ≥ 98% |
| Lv100 C vs Lv40 XS Collector | Lv100 ≥ 98% |
| Lv70 XS Collector vs Lv100 C | lower-level side in 35–70% |
| Lv70 XS vs Lv100 C | lower-level side in 20–45% |
| same-level C vs XS Collector | higher rarity ≥ 99% |
| 5-tier rarity gap | higher rarity ≥ 95% |
| fixed Lv50 A seed dispersion | p95−p5 ≤ 1.0 theta (1.2 documented only) |

The full audit is release evidence; `gate:v7-product` is a deterministic CI
regression; `verify:release` runs the V7 gate while `gate:v6-strength` moves to
`diagnostics:legacy`.
