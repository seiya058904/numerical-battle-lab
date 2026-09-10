# V7 Delivery Report

> STATUS: **BLOCKED** — the reference-scale root cause is fixed and verified
> (solver saturation and convergence now pass), but the Mechanism Ranking Gate
> fails, so per spec §30 the Solver/Full-Reality stage was **not** entered, the
> product default was **not** switched and nothing was pushed as a completed V7
> release.
>
> Every number below comes from an actual run of the committed scripts against
> the committed artifacts. Nothing is estimated or invented.

## Convergence round 3 — causal variance decomposition (user decision gate)

**The question this round had to answer: is the ~6.6 theta same-tier spread
"real mechanism value" or "seed randomly drawing strong/weak action numbers"?**
A deterministic counterfactual experiment on the official 96 unsolved Lv50 A
dataset (shared graph, 768 edges, 8 opponents/card, same 3 paired Match Seeds per
variant, 4,608 mirrored battles each, all BT-converged) gives the answer:

| variant | what changed | p95−p5 | variance reduction | Spearman(C0, Ck) |
|---|---|---|---|---|
| C0 | baseline | **6.642** | — | — |
| C1 | cost/cooldown/priority → per-slot medians | **7.356** | −5.3% | 0.920 |
| C2 | damage/heal/barrier coeffs, accuracy, chance, drainRatio, gain → medians | **6.150** | +15.7% | 0.962 |
| C3 | C1 + C2 | **6.214** | +21.3% | 0.899 |
| C4 | scalar bundles deterministically permuted (i ← donor i+1) | **6.386** | +13.4% | 0.801 (donor: **0.229**) |

**Decision gate verdict: C3 spread reduction = 6.4% ≤ 40% → hypothesis not
supported → continue Mechanism-Aware StrengthModel; no action-numeric solver
prototype.** Readings:

* Normalising both scheduling and magnitudes leaves ~6.2 theta of 6.64 (≈79% of
  the variance): the spread is dominated by mechanic topology, not by drawn
  numbers.
* C1 (scheduling) *raised* the spread — random scheduling partially equalised
  classes; it is neither the driver nor a promising knob.
* C4 is the strongest causal signal: after swapping the scalar bundles, ranking
  correlates 0.801 with the original cards but only 0.229 with the donor cards —
  strength stays with the skeleton, not the numbers.
* Q4: pure mechanic topology still produces **≈6.2 theta** — large, so the
  StrengthModel must genuinely learn mechanism value.

### Q1 — official 96-card mechanism ranking (three splits)

`qa/v7-mechanism-ranking-96.json`; real spread p95−p5 = 6.642.

| model | overall | seed-family test (official) | random test (reference) | mechanism-family holdout (stress) |
|---|---|---|---|---|
| predictTheta | −0.222 | **−0.226** | −0.727 | −0.453 |
| predictReality (committed ridge) | −0.144 | **−0.248** | +0.064 | −0.262 |
| BattlePower V4 | −0.183 | **−0.059** | −0.673 | −0.197 |

Spread ratios (predicted/real on test): predictTheta 0.11 (crushed), predictReality
0.91, BPv4 0.55. **All three models fail the ≥0.85 gate and mostly rank at ~0 or
negatively on the official seed-family test.** The gate is untouched and the
Solver/Full-Reality stage stays closed.

### Q5 — why the solver mostly adjusts HP (utilization audit)

`qa/v7-solver-utilization.json`, 1000 cards, 5,525 adjustments (5.5/card):

| knob | adjusted% | first-selected% | adjustments | theta share | marginal median | kept-initial% |
|---|---|---|---|---|---|---|
| MAX_HP | 76.3 | **62.1** | 2,005 | **0.379** | 3.20 | 24 |
| ATK | 65.9 | 0.0 | 1,645 | 0.312 | 3.17 | 34 |
| ACC | 89.0 | 37.1 | 1,580 | 0.289 | 3.14 | 11 |
| HEAL_POWER | 23.5 | 0.0 | 247 | 0.018 | 1.23 | 77 |
| PEN | 4.8 | 0.0 | 48 | 0.002 | 0.64 | 95 |
| DEF / RES / SPD / EVA / CRIT / ENERGY_REGEN | **0.0** | 0.0 | **0** | 0.000 | — | 100 |

Diagnosis: it is **not** a pure greedy-degeneracy story — MAX_HP's marginal is
genuinely the largest (it feeds both endurance and sustain, since heal/barrier
formulas scale with MAX_HP), so picking it first (62%) is rational. But the model
has a **sensitivity imbalance: 6 of 11 knobs are dead** (DEF/RES/SPD/EVA/CRIT/
ENERGY_REGEN never selected because their marginals are ~100× smaller than the
top three and can never win the greedy score), so the iso-power surface is
effectively driven by three knobs. Any future action-numeric extension must fix
this imbalance first, otherwise it would just add more dead knobs.

### Q6 — parameter classification

Full table in `docs/V7-MECHANISM-ATTRIBUTION.md`. Summary: damage/heal/barrier
coefficients, periodic magnitude, drainRatio, effect chance and accuracy are
continuous, monotonic, strength-only → safe continuous marginal-value knobs; cost
and cooldown are discrete but monotonic → borderline; **priority is discrete,
non-monotonic and identity/behavior-affecting (it changes AI action choice and
initiative order) → NOT a strength knob**; shield/ward kind, control status
flavour, stacks and all structural fields (family set, effects topology,
statuses, triggers, targets, damage type, resource) are Frozen Identity.

### Q7 — seed identity invariants (proposal, not approved)

Frozen Identity (never touched): action family set/count, victory path, targets,
trigger topology, status identity, conditionals, periodic topology, resource
mechanic, damage type, signature action, shield-vs-ward kind, control flavour.
Shape-Preserving Numeric Freedom: per-mechanism relative shape kept, only
family/global scaling allowed. Free Strength Scalars: absolute magnitudes that
change no relative shape or identity.

### Q8 — recommendation

**A — mainly fix the StrengthModel** (with D-style support: then evaluate a
bounded, shape-preserving numeric freedom, not free per-action knobs). The C0-C4
evidence rules out B: scalar numbers explain ≤21% of the variance and the C4
donor test (0.229) shows strength does not follow the numbers; ~6.2 theta of
topology-driven spread remains, which only a mechanism-aware model can capture.

## Convergence round 2 — root causes, fixes, and what still blocks

### Root Cause Before (measured on the inherited code)

```text
referenceGeneralPower            300   (measured correct value: 26,056.676 — an 87x miss)
unsolved base card prediction    +28.6 theta vs target 0
solver result                    ATK ~ 3, MAX_HP ~ 530, HEAL_POWER = 52.73 for EVERY seed
mechanism model spread           1.11 theta   (real battle spread 3.35 -> 6.26 theta)
mechanism Spearman(model, real)  -0.046  (predictTheta) / -0.065 (calibrated)
seed dispersion p95-p5           3.0 - 8.4 theta per tier (bar: <= 1.0)
Target -> Reality Spearman       0.8892  (bar: >= 0.95)
```

### After (this round, verified)

| Gate | Result |
|---|---|
| Reference scale (`calibrate:v7-reference`) | **PASS** — `referenceGeneralPower` 300 → **26,056.676** (median of 256 deterministic unsolved Lv50 A cards); median predictTheta **0.000**, p5 −0.454 / p95 0.359 |
| Solver saturation (`audit:v7-solver-saturation`, 1000 cards) | **PASS** — every knob **0.00%** bound-hit (was: ATK/MAX_HP/HEAL_POWER ~100%); the ACC collapse (7.9% at the cap) was removed by a bound-headroom rule in knob selection |
| Solver convergence (same 1000 cards) | **PASS** — median abs error **0.0002**, p95 **0.038**, median 5 iterations, all converged, all packs valid |
| Product gate (`gate:v7-product`) | **PASS** — 24/24 on the corrected scale (Lv100 vs Lv40 100%, Lv100 C vs Lv40 XC 100%, Lv70 XC vs Lv100 C 46.9%, Lv70 XS vs Lv100 C 35.9%, same-level C vs XC 100%) |
| Mechanism Ranking Gate (spec §30: ≥0.80 required, ≥0.85 target) | **FAIL** — held-out (unseen mechanism families) Spearman **0.49–0.54** vs required **0.85** |

### Why the mechanism gate still fails — measured, not guessed

Dataset: 48 unsolved Lv50 A cards, balanced sparse mirrored graph, 432 edges,
2,592 battles, BT converged, **draw rate 1.9%** (decisive), real spread
**p95−p5 = 6.264 theta** (`qa/v7-mechanism-labels.json`, `qa/v7-mechanism-ranking.json`).
Labels are cached by content hash, so model iterations cost no battles.

1. **All candidate models are blind to it.** Overall Spearman: `predictTheta`
   −0.187, `predictRealityTheta` (with the committed ridge correction) −0.065,
   and **BattlePower V4 −0.043**. BPv4's 0.953 was measured on *solved* cards
   (where level/rarity-driven stat magnitudes dominate); on same-tier unsolved
   cards it has no mechanism signal either.
2. **The obvious suspect was disproved causally.** `barrierType` split the
   population cleanly (ward n=26 mean +0.97 vs shield n=22 mean −1.15 — a 2.12θ
   gap), but a controlled same-card swap measured **shield 15 / ward 14 / 11
   draws — no effect**. The correlation is a confound: `pick()` consumes a PRNG
   draw, which shifts every downstream action's randomly drawn numbers.
3. **A refined engine-accurate structural feature set is not enough.** Features
   built around real availability (cooldown counted down by RECOVERY, energy
   affordability), the signature action's sustained value, sustain-vs-damage
   races and kill-time reach best single-feature |ρ| = **0.453** (`dpsToEhp`) and
   held-out family Spearman **0.49–0.54** at every ridge strength
   (`scripts/explore-v7-mechanism-features-v2.js`).
4. **The remaining variance is dominated by randomly drawn action numbers.**
   `meanCooldown` (−0.327), `meanCost` (+0.147) and `meanAvailability` (+0.172)
   carry most of the modellable signal: the skeleton draws `cooldown 1..5`,
   `cost 0..6` and `priority -2..3` per action from one shared PRNG stream, so
   pure randomness moves a card's per-round throughput by up to ~6x. Spec §34
   says the solver owns "**Mechanic Skeleton + Style Genome + TargetTheta →
   numbers**" — cooldowns, costs and priorities are exactly such numbers, yet
   they are currently drawn randomly instead of being solved. That is the
   identified next lever: give the solver those numeric knobs (and the per-action
   coefficients) so iso-power is reached by tuning numbers, **without** shrinking
   mechanism variety (which spec §7 forbids).

### Not done, by design

Per spec §30, a mechanism-ranking result below 0.80 forbids entering the
Solver/Full-Reality stage, so the 37,440-battle graph was **not** re-run and the
default switch was **not** performed. Artifact provenance for this state:

| Artifact group | Built with |
|---|---|
| `qa/v7-reference-scale.json`, `qa/v7-solver-saturation.json`, `qa/v7-mechanism-labels.json`, `qa/v7-mechanism-ranking.json`, `content/presets-v7.*` | corrected reference scale (current code) |
| `qa/v7-battle-graph.json`, `v7-empirical-strength.json`, `v7-seed-dispersion.json`, `v7-matchup-residuals.json`, `v7-product-strength.json`, `v7-stat-sensitivity.json`, `v7-axis-sensitivity.json`, `v7-battlepower-reality.json` | pre-fix build — retained deliberately as the "Root Cause Before" evidence recorded above; they will be regenerated once the mechanism gate passes |

---

## Convergence round 1 — inherited state

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
