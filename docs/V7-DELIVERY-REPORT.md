# V7 Delivery Report

> STATUS: **BLOCKED** — V7 is implemented, BattlePower V4 and the product gate pass,
> but two Reality acceptance items fail, so the product default was **not**
> switched and nothing was pushed as a completed V7 release.
>
> Every number below comes from an actual run of the committed scripts against
> the committed artifacts. Nothing is estimated or invented.

## Git

```text
OLD REMOTE (V6 baseline)   09fd48fb10c70f28ad65b7392457335a7d4d1afe  feat(v6): finalize strength system and product switch
TAKEOVER LOCAL HEAD        ec52d49ed4c128432ce85c43558c923601a4d4b1  feat(v7): activate multi-axis combat semantics
FINAL HEAD                 <see git log> (V7 commits on top of ec52d49; default still V6)

Pre-existing V7 chain (not squashed, not rewritten):
  8247a64 docs(v7): record strength geometry implementation plan
  9705d74 feat(v7): establish strength geometry and reality baselines
  4a58b5f feat(v7): calibrate empirical strength reality
  dae8f8e feat(v7): satisfy product strength reality gates
  ec52d49 feat(v7): activate multi-axis combat semantics
```

Takeover audit: working tree was clean, `origin/main` = V6, local ahead `0/5`
(no divergence), and the long-running `scripts/build-v7-battle-graph.js 15 12 100`
process (PID 52948) was still alive and healthy — it was allowed to finish rather
than restarted.

## What was inherited

`ec52d49` already contained: `strength-geometry-v7`, `style-genome-v7`,
`strength-model-v7`, `solver-v7`, `gen-v7`, `empirical-strength-v7`,
`calibration-v7`, `audit-statistics-v7`, the multi-axis engine semantics, the
Reality scripts, and a stale pre-phase-6 artifact set. Plan Tasks 7–10
(BattlePower V4, presets, CI gate, default switch, docs) were unfinished.

## What was completed

| Item | Result |
|---|---|
| Phase-6 Reality rebuild (180 cards / 1,560 edges / 12 paired seeds / mirrored) | 37,440 battles produced by the instrumented script |
| Bradley-Terry fit + family splits | converged (train 132 / validation 24 / test 24) |
| BattlePower V4 (content-only, holdout-calibrated) | **PASS** — holdout Spearman 0.953 |
| gate:v7-product (21 deterministic checks) | **PASS** |
| 60 canonical presets-v7 (Naming V3 frozen, index-aligned) | produced, 12 rarities × 5 |
| Performance benchmark | **FAIL** (median 11.5 ms vs <10 ms) |
| Target → Reality | **FAIL** (Spearman 0.889 vs ≥0.95) |
| Same-tier seed dispersion | **FAIL** (p95−p5 up to 8.4 theta vs ≤1.0) |
| Default switch | **NOT PERFORMED** (gated on the two items above) |
| Legacy regression | PASS (364/364 tests; v1/v2/v3/v4/v5/v6 explicit paths green) |

### Incidental regression fixed

Phase 6's `resolveRound` recorded the **ordered** action sequence, and the order
comes from `orderActions()` which shuffles with the battle PRNG and rolls
initiative per entry. Replaying that already-permuted record re-entered
`orderActions()` with a different permutation, diverging the PRNG stream and the
battle (`gen-v3` replay snapshot: round 14 vs 16). This failed on the clean
takeover HEAD, i.e. it predates this session. The record now keeps the original
input order while the One Action Rule still deduplicates execution —
`tests/gen-v3.test.js` and `tests/engine.test.js` (93/93) are green.

## Reality audit

| Item | Value |
|---|---|
| cards / families / tiers | 180 / 15 / 12 |
| edges | 1,560 |
| paired Match Seeds per edge | 12 |
| mirrored sides / canonical AI / round cap | true / true / 100 |
| battles | 37,440 |
| Bradley-Terry converged | true |
| fit log-loss | 0.3038 |

### Target → Reality

| Metric | Value | Bar |
|---|---|---|
| Spearman(TargetTheta, EmpiricalTheta) | **0.8892** | ≥ 0.95 ✗ |
| Pearson | 0.8851 | — |
| MAE | **2.436** | (pre-Phase-6: 0.354) |
| RMSE | 2.890 | (pre-Phase-6: 0.445) |
| pairwise direction accuracy | 0.9367 | — |
| calibration slope (train-only) | 0.8407 | 1.0 ideal |
| split MAE (train/validation/test) | 2.387 / 2.761 / 2.383 | — |

Per-tier means show the failure shape: low tiers measure **stronger** than target
(Lv20 A: −2.00 vs −3.87; Lv40 C: −1.44 vs −3.08) and high tiers **weaker**
(Lv100 C: 8.96 vs 9.64; Lv100 XS Collector: 13.66 vs 17.24). The empirical Level
curve is flatter than the geometry prescribes, even though the 12 tier means stay
perfectly ordered.

### Seed dispersion (fixed tier, p95−p5 of fitted theta)

| tier | p95−p5 | tier | p95−p5 |
|---|---|---|---|
| Lv20 A | 3.14 | Lv75 A | 7.40 |
| Lv40 C | 3.03 | Lv100 C | **8.39** |
| Lv40 XC | 7.50 | Lv100 A | 8.25 |
| Lv50 C | 3.80 | Lv100 XC | 7.05 |
| Lv50 A | 5.22 | Lv70 XS | 8.05 |
| Lv50 XC | 7.81 | Lv70 XC | 8.15 |

Every tier is far above the ≤1.0 bar: at a fixed level and rarity, seed still
decides the strength tier, which violates the product constitution
("Seed 主要决定打法和克制，不能决定总实力阶层").

## Product gates (A–F)

`npm run gate:v7-product` — **21/21 PASS**, small-sample deterministic smokes with
mirrored sides and cross-balanced seed families:

| Case | Observed | Gate |
|---|---|---|
| A: Lv100 vs Lv40 (same rarity, C) | higher 100.0% (CI95 0.893–1.0) | overwhelming ✓ |
| B: Lv100 C vs Lv40 XS Collector | higher 100.0% | ≥98% ✓ |
| C: Lv70 XS Collector vs Lv100 C | lower 50.0% (CI95 0.336–0.664) | 35–70% ✓ |
| D: Lv70 XS vs Lv100 C | lower 40.6% | 20–45% ✓ |
| E: same-level C vs XS Collector | higher 100.0% | ≥99% ✓ |
| F: multi-tier rarity gap | covered by E + tier ladder | ✓ |

The full-sample product audit (`qa/v7-product-strength.json`) is release
evidence and is re-run by `npm run reality:v7`.

## Multi-axis

Phase-6 axes are frozen and the gate re-verifies them with real battles
(+10% ATK / HEAL_POWER / CONTROL_POWER each shift the win rate upward). The
full-sample sensitivity artifact is regenerated by `npm run audit:v7-sensitivity`.

## BattlePower V4

| Item | Value | Bar |
|---|---|---|
| holdout Spearman(BPv4, EmpiricalTheta) | **0.9530** | ≥ 0.90 ✓ |
| overall Spearman | 0.9351 | — |
| large-gap ordering (|ΔEmpirical| ≥ 1.5) | **0.9619** | ≥ 0.95 ✓ |
| strong inversion rate | **0.0000** | ≤ 2% ✓ |
| within-level / within-rarity correlations | in `qa/v7-battlepower-reality.json` | — |
| worst residuals | in `qa/v7-battlepower-reality.json` | — |

BPv4 reads only card content (never level/rarity/seed/TargetTheta/budget/
EmpiricalTheta/battle results) and is a separate model from `predictThetaV7`
(unit-tested: metadata edits cannot change its features; real content edits do).

## Presets

`content/presets-v7.json` — 60 cards, 12 rarities × 5, Naming V3 names reused
verbatim and index-aligned with presets-v6, every card generated by the final
generator, BattlePower v4 frozen into `presentation.power`, all content packs
valid, 8 distinct victory paths, unique mechanic fingerprints. Shipped as
`SYSTEM_PRESETS_V7`; `SYSTEM_PRESETS` intentionally still points at the v6
catalog because the default switch is not authorised.

## Legacy regression

| Item | Result |
|---|---|
| Full suite | **364 tests, 364 pass, 0 fail** |
| v1 fixture (189 cards byte-for-byte) | PASS |
| explicit v2…v6 reproduction | PASS |
| v6 fixed-seed battle/replay unchanged | PASS (93/93 engine tests) |
| legacy cards missing V7 axes → neutral 100 | PASS |
| Naming V3 / match randomness / 1–6 team selection | frozen, PASS |

## Performance

| Metric | Value | Bar |
|---|---|---|
| mean / median | 15.28 ms / **11.50 ms** | median < 10 ms ✗ |
| p95 / p99 | **42.56 ms** / in `qa/v7-performance.json` | p95 < 25 ms ✗ |

## Diagnosis of the Reality failure (root cause, measured)

The generator's iso-power loop is only as good as `StrengthModelV7`. Two
independent defects were measured:

1. **Stale reference scale.** `calibration/reference-world-v7.json` still carried
   `referenceGeneralPower: 300`, while a fresh unsolved card's content general
   power is ≈26,370. Every base card therefore predicted ≈ **+28.6 theta** against
   a target of 0, and the solver drove **all** of its knobs to their floors —
   measured ATK ≈ **3**, `MAX_HP` ≈ **530**, `HEAL_POWER` = **52.73** (identical
   for every seed). With the equalising knobs saturated, only the genome-driven
   neutral-100 axes survived, which is exactly what inflates same-tier dispersion.
   Calibrating the value to the measured base general power restores healthy
   stats (ATK 76–94, `MAX_HP` 24.7k–46.8k, solver 0–2 iterations).

2. **The model is nearly blind to mechanism differences.**
   `scripts/diagnose-v7-mechanism-ranking.js` builds 15 unsolved same-tier cards,
   ranks them with the content model, then fights a mirrored round-robin:

   ```text
   model predicted spread across mechanisms : 1.11 theta
   real battle spread across mechanisms     : 3.35 theta
   Spearman(model, real battle)             : −0.046   (no signal)
   ```

   The model cannot see what actually decides these fights, so the solver
   compensates in the wrong direction and magnitude; the residual shows up as
   dispersion and as the flattened Level curve.

Both were measured on the untouched Phase-6 code (the graph that produced the
numbers above was built by the takeover process before any edit in this session).

## Remaining work (concrete)

1. Recalibrate `StrengthModelV7` so its cross-mechanism ranking correlates with
   real battles (target: model spread ≈ real spread, Spearman ≫ 0.9 on the
   unsolved-card probe). The committed diagnostic script measures this directly.
2. Freeze the corrected model, rebuild the 37,440-battle graph, refit
   EmpiricalTheta, and re-check Spearman ≥ 0.95 and dispersion ≤ 1.0 per tier.
3. Re-run the full product, sensitivity, preset-matrix and BattlePower audits on
   the frozen code and refresh `qa/v7-*.json`.
4. Only then perform the independent default-switch commit
   (`generateCard`/`generateCardByVersion` default, `SYSTEM_PRESETS`, normal
   creation UI, battle catalog, BattlePower display) and push with CI + Pages
   verification.
5. Optional: bring generation performance back under median 10 ms / p95 25 ms
   (the finite-difference marginal evaluation dominates the cost).

## Known non-blocking limitations

- `gate:v7-product` product smokes use small samples (TWO cards per side, 8 paired
  seeds); the large-sample audit remains release evidence, by design.
- The BPv4 holdout is the 24 test-family cards defined by the spec's split.
- BPv4 predicts general strength, not specific counters: equal-BP cards may still
  be 90/10 matchups, which is intended.
- BattlePower v3 remains the display estimator for v5/v6 and v2 for v4 cards.
