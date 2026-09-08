# Generator V7 Strength Geometry and Iso-Power Design

## Status and baseline

This design implements the user-approved Generator V7 Strength Geometry + Iso-Power Reality Contract. The frozen baseline is `09fd48fb10c70f28ad65b7392457335a7d4d1afe`; Generator v6 remains byte-for-byte legacy and stays the product default until every V7 hard gate passes.

## World geometry

V7 uses additive latent strength. `LevelScore = 16 * ((level - 1) / 99) ^ 1.70`; rarity scores are `C=0`, `C+=0.27`, `B=0.61`, `B+=1.03`, `A=1.52`, `A+=2.10`, `S=2.76`, `SS=3.52`, `SSS=4.38`, `SSS Collector=5.35`, `XS=6.42`, `XS Collector=7.60`. `TargetTheta = LevelScore + RarityScore - (LevelScore(50) + RarityScore(A))`.

The geometry is QA/generation metadata only. The battle engine must never read level, rarity, TargetTheta, a generation budget, or BattlePower as a combat multiplier. Full level span remains at least twice full rarity span; the Lv40-to-100 gap minus rarity span remains at least 4.5; full rarity span covers the Lv70-to-100 gap; both progressions are convex.

## Generation boundaries

Seed-only `StyleGenomeV7` expresses soft preferences over pressure, endurance, sustain, control, tempo, economy, reliability, and triggers. A seed-only mechanic skeleton fixes action count/families, damage types, resources, statuses, conditions, triggers, targeting, and victory path. Skeleton retry is deterministic and depends only on seed, so its mechanic fingerprint is invariant across level and rarity.

`StrengthModelV7(card)` is content-only and uses the committed reference-world population distribution. It evaluates interacting throughput, effective durability, sustain, control, readiness, resource economy, periodic power, and trigger frequency. It must not read identity metadata. Central finite differences expose context-dependent marginal strength for each adjustable knob.

`SolverV7` adjusts individual knobs, never a universal card scalar. Each iteration chooses the legal knob with the best reduction in strength error after style and degeneracy penalties. Convergence target is absolute predicted-theta error at most 0.12, median at most 0.06 and p95 at most 0.12. Runtime generation invokes no battle, AI, opponent, Monte Carlo, or BattlePower.

## Empirical truth and measurement

A connected sparse battle graph covers same-tier, near-tier, cross-style, cross-level, cross-rarity, and extreme-gap opponents using multiple fixed Match Seeds and mirrored sides. Bradley-Terry fitting produces EmpiricalTheta with uncertainty and uses card/seed-family splits to prevent leakage. Matchup residual is observed pair performance minus the fitted general-strength expectation.

BattlePower V4 is a separately calibrated, content-only static model trained against holdout EmpiricalTheta. It cannot read generation targets or empirical labels at runtime. Acceptance requires TargetTheta/EmpiricalTheta Spearman at least 0.95, BattlePower/EmpiricalTheta holdout Spearman at least 0.90, large-gap ordering at least 95%, and strong inversion rate at most 2%.

## Combat-axis policy

Sensitivity is measured through direct stat perturbation followed by real mirrored battles, never by re-solving or reading BudgetPrice/BattlePower. Existing axes are activated first. New neutral-100 fields are retained only if they provide independent value: POTENCY for periodic/trigger/detonation output, CONTROL_POWER versus TENACITY for bounded control chance/duration, BARRIER_POWER for shield/ward magnitude, and RECOVERY for cooldown readiness only. Missing fields remain neutral so v1-v6 battle and replay behavior is unchanged.

At least six independent primary axes must reach median sensitivity of 45% of ATK; ATK must not exceed twice the median of other leading axes; no axis may exceed 35% of normalized primary-axis sensitivity.

## Product acceptance

Real canonical 1v1 AI battles must prove: Lv100 over Lv40 at the same rarity has at least 99% aggregate wins and Wilson lower bound at least 98%; Lv100 C beats Lv40 XS Collector at least 98%; Lv70 XS Collector versus Lv100 C stays within 35-70% for the lower-level side; Lv70 XS stays within 20-45%; same-level C versus XS Collector gives the higher rarity at least 99%; a five-tier rarity gap gives the higher rarity at least 95%; high-end rarity and level gaps expand empirically; fixed Lv50 A seed dispersion is at most 1.0 theta (1.2 only with documented noise evidence).

The full audit is release evidence, while `gate:v7-product` is a deterministic CI regression. Generator performance targets median below 10 ms and p95 below 25 ms for 1000 cards. Naming V3, normal match randomness, replay, one-action opportunity, and explicit 1-6 team selection remain frozen; a 3v3 smoke test is added.

## Product switch and delivery

V7 supplies 60 classless presets with names identical by position to V6/V5 and coverage across burst, glass cannon, fortress, sustain, control, DoT, barrier, resource engine, tempo, reliable attack, high variance, triggers, reflect, and ramp. Only after geometry, solver, empirical reality, sensitivity, BattlePower, legacy, full-audit, and release gates pass does a final independent commit switch generation, presets, UI, and presentation to V7. V6 gate moves to `diagnostics:legacy` without deletion.

Release evidence includes every required `qa/v7-*.json` artifact, the V6 sensitivity baseline, architecture/design/delivery documentation, numerical-reference regeneration, manifest, complete tests, browser QA, push, GitHub Verify, and Pages success.
