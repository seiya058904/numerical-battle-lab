# Generator V7 — Numerical Architecture

> Status: V7 is fully implemented, but the product default is still V6. The
> final default switch is gated on the Reality acceptance items, which are not
> all met yet (see `docs/V7-DELIVERY-REPORT.md`).
> Baseline: V6 frozen at `09fd48fb10c70f28ad65b7392457335a7d4d1afe`.

Generator V7 replaces the V6 "fixed budget, allocation profile" contract with a
two-stage architecture: **additive latent TargetTheta** defines the world
geometry (Level first, Rarity second), and a **content-only marginal-value
solver** adjusts individual numeric knobs until the card's *predicted general
strength* lands on TargetTheta. A separate **empirical reality chain** measures
the true long-run strength of real canonical-AI battles (Bradley-Terry), and a
**BattlePower V4** estimator is calibrated against that reality, independently of
the strength model.

## Layer map

```
World geometry          src/strength-geometry-v7.js
                        LevelScore = 16 * ((level-1)/99)^1.70
                        RarityScore (12 tiers, C=0 … XS_COLLECTOR=7.60)
                        TargetTheta = LevelScore + RarityScore - anchor(Lv50 A)
                        QA/generation metadata ONLY — the engine never reads it.

Seed style              src/style-genome-v7.js
                        8 soft axes (pressure/endurance/sustain/control/tempo/
                        economy/reliability/triggers) from the seed hash only.

Mechanic skeleton       src/gen-v7.js
                        seed-only action family skeleton (victoryPath, resource,
                        damage type, duration, status policy, trigger event).
                        Fingerprint invariant across level/rarity.

Content model           src/strength-model-v7.js
                        predicts general strength from stats/actions/effects/
                        statuses/triggers; honors the One Action Rule; shape
                        vector + ridge calibration correction. Never reads
                        identity/budget/empirical labels.

Iso-power solver        src/solver-v7.js
                        per-knob finite-difference marginal value; never a
                        universal scalar; no battles/AI/BP at generation time.

Generator               src/gen-v7.js
                        generateCardV7({seed,level,rarity}) is deterministic;
                        generateCardByVersion() default → v7 after final switch;
                        explicit generatorVersion 1..6 stay legacy.

Reality chain           src/empirical-strength-v7.js
                        sparse connected battle graph (mirrored sides, multiple
                        fixed Match Seeds, seed-family splits), regularized
                        Bradley-Terry fit, linear alignment on train families.

BattlePower v4          src/battlepower-v4.js
                        independent content-only estimator, ridge-calibrated
                        against holdout EmpiricalTheta; display power monotone
                        in predicted theta, anchored near 1000 at Lv50 A.
```

## Data flow

```
generateCardV7(seed, level, rarity)
  ├─ seed → styleGenomeV7 (soft preferences)
  ├─ seed → mechanicSkeletonV7 (invariant structure)
  ├─ buildUnsolvedCard → stats/actions/statuses/triggers
  ├─ solveCardV7: predictTheta vs TargetTheta; adjust one knob at a time
  └─ validateContentPack → valid frozen card

Reality chain (release evidence, offline):
  build-v7-battle-graph.js 15 12 100
    180 cards (15 seed families x 12 tiers), ~1560 edges, 12 paired Match
    Seeds/edge, mirrored sides → 37,440 canonical-AI battles
  fit-v7-empirical-strength.js
    regularized Bradley-Terry → EmpiricalTheta + standard error + W/L/D
  calibrate-strength-model-v7.js
    ridge shape correction (train/validation/test family splits) → committed
    calibration/strength-model-v7.json (+ browser embed)
  audit-v7-seed-dispersion.js  → p95-p5 dispersion, matchup residuals
  audit-v7-product-strength.js → product hard gates A-F with Wilson CIs
  audit-stat-sensitivity-v7.js 7 8 8 3 → multi-axis sensitivity + side bias
  audit-battlepower-v4.js       → train/validate/freeze BPv4 coefficients,
                                  holdout reality report
  migrate-presets-v7.js         → 60 canonical presets-v7 (Naming V3 frozen)
  audit-v7-presets.js           → preset battle matrix + 3v3 smoke
  benchmark-gen-v7.js 1000      → median < 10 ms, p95 < 25 ms
```

## Combat-axis semantics (Phase 6, frozen)

Neutral-100 optional axes activated only where the V6 baseline proved them
independent: `POTENCY` (periodic/trigger/detonation output), `CONTROL_POWER`
vs `TENACITY` (logit control contest, bounded duration), `BARRIER_POWER`
(shield/ward magnitude), `RECOVERY` (cooldown readiness only — never extra
actions). Missing fields resolve to neutral 100 so v1-v6 battle/replay behavior
is byte-identical (114-test regression).

## Frozen contracts

- One Action opportunity per living unit per round (One Action Rule) — all
  strength models, BattlePower and AI estimates respect it; six-action streams
  are never summed.
- Deterministic canonical PRNG only; identical seed/card/actions/state → exact
  replay. Naming V3, match randomness, initiative, explicit 1-6 team selection,
  duplicates allowed, no autofill — all frozen.
- Battle engine never reads Level/Rarity/TargetTheta/budget/BattlePower as a
  combat authority.
- BattlePower V4 never reads Level/Rarity/Seed/TargetTheta/budget/empirical
  labels at runtime; it is a pure function of card content.
