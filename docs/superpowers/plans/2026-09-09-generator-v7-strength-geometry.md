# Generator V7 Strength Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repository rules prohibit subagents.

**Goal:** Build and empirically validate Generator V7 so level is the primary strength dimension, rarity is secondary, seed selects style rather than total power, and BattlePower measures real general strength.

**Architecture:** Additive TargetTheta feeds a seed-invariant mechanic skeleton and a content-only marginal-value solver. A separate sparse battle graph supplies Bradley-Terry EmpiricalTheta truth, sensitivity evidence, and a holdout-calibrated BattlePower V4 before an independently gated default switch.

**Tech Stack:** Browser-loaded CommonJS-compatible JavaScript, Node test runner, deterministic canonical battle engine/AI, JSON audit artifacts, Playwright browser QA.

**Spec:** `docs/superpowers/specs/2026-09-09-generator-v7-strength-geometry-design.md`

## Global Constraints

- Baseline and frozen V6 semantics: `09fd48fb10c70f28ad65b7392457335a7d4d1afe`.
- Do not modify Naming V3, match randomness, initiative, replay semantics, or one-action-per-living-unit-per-round.
- Generator/solver/model must not run battles, AI, opponent selection, Monte Carlo, or BattlePower.
- Battle engine must not read TargetTheta, level, rarity, generation budget, or BattlePower as combat authority.
- Default remains V6 until all hard gates pass; default switch is the final independent commit.
- Every production behavior follows red-green-refactor; generated JSON is produced only by committed deterministic scripts.

---

### Task 1: Freeze V6 baseline and sensitivity truth

**Files:** Create `scripts/audit-stat-sensitivity-v7.js`, `qa/v6-stat-sensitivity-baseline.json`; modify no V6 generator file.

**Interfaces:** `runSensitivityAudit({version, cards, opponents, matchSeeds}) -> artifact`; direct perturbations never regenerate the card.

- [x] Write a failing test proving central perturbations change only the requested stat and mirrored scoring counts battles independently.
- [x] Run the focused test and confirm failure because the sensitivity API does not exist.
- [x] Implement the shared sensitivity runner over ATK, MAX_HP, DEF, RES, SPD, ACC, EVA, CRIT, PEN, HEAL_POWER, and ENERGY_REGEN.
- [x] Generate the V6 artifact with diverse opponents, multiple Match Seeds, team-side counts, median/p25/p75 delta-theta summaries, and exact baseline commit.
- [x] Run focused tests and inspect the artifact against existing V6 level, rarity, seed-dispersion, and BattlePower evidence.

### Task 2: Implement canonical Strength Geometry

**Files:** Create `src/strength-geometry-v7.js`, `tests/strength-geometry-v7.test.js`, `scripts/audit-v7-geometry.js`, `qa/v7-strength-geometry.json`; add browser load order without changing defaults.

**Interfaces:** `levelScoreV7(level)`, `rarityScoreV7(rarity)`, `targetThetaV7(level, rarity)`, `assertStrengthGeometryV7()`.

- [x] Write failing tests for all anchor values, strict convex increments, anchor zero, span inequalities, Lv100 C over Lv40 XC, and near parity of Lv70 XC/Lv100 C.
- [x] Verify red because V7 geometry is absent.
- [x] Implement the canonical 16/1.70 formula and fixed rarity table with strict input validation.
- [x] Generate the geometry artifact and run the focused tests green.

### Task 3: Build empirical battle graph and Bradley-Terry truth

**Files:** Create `src/empirical-strength-v7.js`, `scripts/build-v7-battle-graph.js`, `scripts/fit-v7-empirical-strength.js`, `tests/empirical-strength-v7.test.js`, `qa/v7-empirical-strength.json`.

**Interfaces:** `fitBradleyTerryV7(nodes, edges) -> {cards, metrics}`; graph edges store independent mirrored battle outcomes and card-family split.

- [x] Write failing synthetic-graph tests for ordering, additive shift invariance, draws, standard errors, connectedness, and seed-family split isolation.
- [x] Verify red, then implement deterministic sparse graph construction and regularized Bradley-Terry fitting.
- [x] Prove the fitter on synthetic known-theta data before connecting real canonical AI battles.
- [x] Emit per-card id/seed/level/rarity/targetTheta/empiricalTheta/error/games/W/L/D and graph methodology.

### Task 4: Implement content-only model, style genome, skeleton, and solver

**Files:** Create `calibration/reference-world-v7.json`, `src/style-genome-v7.js`, `src/strength-model-v7.js`, `src/solver-v7.js`, `src/gen-v7.js`, `tests/gen-v7.test.js`, `tests/strength-model-v7.test.js`.

**Interfaces:** `styleGenomeV7(seed)`, `mechanicSkeletonV7(seed)`, `predictThetaV7(card)`, `marginalValueV7(card, knob)`, `solveCardV7(skeleton, genome, targetTheta)`, `generateCardV7(opts)`.

- [x] Write failing tests for seed-only structure/fingerprint invariance, content-only model invariance under metadata edits, contextual marginal values, and forbidden dependency absence.
- [x] Implement seed-only skeleton construction with deterministic scalability retries and no level/rarity input.
- [x] Implement interacting model terms for throughput, mitigation, sustain, reliability, control, economy, cooldown, periodic, and trigger value using the reference world.
- [x] Implement per-knob finite-difference coordinate solving with strength error as first priority and style/legality/degeneracy tie-breakers.
- [x] Verify deterministic valid cards, no universal scalar, convergence median <=0.06/p95 <=0.12, and no runtime battle/AI/BP call.

### Task 5: Calibrate reality and seed dispersion

**Files:** Create `scripts/calibrate-strength-model-v7.js`, `scripts/audit-v7-product-strength.js`, `scripts/audit-v7-seed-dispersion.js`, `qa/v7-product-strength.json`, `qa/v7-target-reality-calibration.json`, `qa/v7-seed-dispersion.json`, `qa/v7-matchup-residuals.json`.

**Interfaces:** audits consume generated cards and canonical AI battles; runtime source consumes only committed content-only coefficients.

- [x] Build train/validation/test card-family splits and a connected mixed-style graph.
- [x] Fit model coefficients on train, choose on validation, and report final metrics on untouched test.
- [x] Measure every specified product scenario with 40-100 cards per side population, 8-20 paired seeds, mirroring, Wilson intervals, and side counts.
- [x] Record gap buckets and matchup residuals; retain 80/20 and 90/10 same-tier examples.
- [x] Iterate only model/solver within permitted geometry bounds until every hard reality and dispersion gate passes.

### Task 6: Establish multi-axis combat sensitivity

**Files:** Modify `src/components.js`, `src/effects.js`, `src/status-runtime.js`, `src/engine.js`, `src/ai.js`, `src/numerical-knowledge.js` only where baseline evidence proves necessary; create `qa/v7-stat-sensitivity.json`, `qa/v7-axis-sensitivity.json`, `qa/v7-panel-diversity.json`, and focused tests.

**Interfaces:** absent optional V7 stats resolve to neutral 100; RECOVERY changes cooldown readiness only.

- [ ] Use the V6 baseline to identify weak independent axes before adding fields.
- [ ] Write failing engine tests for each retained neutral-100 stat and exact legacy replay equality when fields are absent.
- [ ] Implement only evidence-backed POTENCY, CONTROL_POWER/TENACITY, RECOVERY, or BARRIER_POWER with bounded/diminishing behavior.
- [ ] Run direct empirical perturbations without re-solving and require six axes >=45% of ATK, ATK <=2x peer median, and no axis >35% normalized share.
- [ ] Re-run numerical coverage and semantic audits with zero undocumented active fields.

### Task 7: Calibrate independent BattlePower V4

**Files:** Create `src/battlepower-v4.js`, `scripts/audit-battlepower-v4.js`, `tests/battlepower-v4.test.js`, `qa/v7-battlepower-reality.json`.

**Interfaces:** `battlePowerV4(card) -> {power, predictedTheta, features}` reads content only and uses a monotonic display transform anchored near 1000 at Lv50 A.

- [ ] Write failing tests that metadata/target/budget/empirical edits cannot change BP, real content edits do, and solver never calls BP.
- [ ] Fit static features against train EmpiricalTheta and freeze coefficients before holdout evaluation.
- [ ] Report overall/within-level/within-rarity correlations, near/large-gap ordering, strong inversions, and worst residuals.
- [ ] Require holdout Spearman >=0.90, large-gap ordering >=95%, and strong inversion <=2%.

### Task 8: Generate V7 presets and full release evidence

**Files:** Create `scripts/migrate-presets-v7.js`, `src/presets-v7.js`, `content/presets-v7.json`, `content/presets-v7.js`, `tests/presets-v7.test.js`, `scripts/benchmark-gen-v7.js`, `qa/v7-performance.json`, `qa/v7-preset-matrix.json`.

**Interfaces:** `SYSTEM_PRESETS_V7` contains exactly 60 frozen cards while `SYSTEM_PRESETS` remains V6.

- [ ] Write failing preset tests for 60 cards, 12 rarities x5, positional Naming V3 equality, validity, unique ids, and required behavior-label coverage.
- [ ] Generate deterministic V7 presets from frozen seeds/names and validate content.
- [ ] Run full preset battle matrix, 3v3 smoke, side-bias analysis, and 1000-card benchmark (median <10 ms, p95 <25 ms).
- [ ] Re-run all product, empirical, sensitivity, BattlePower, diversity, and legacy gates without changing the default.

### Task 9: Add CI product gate and perform final default switch

**Files:** Create `scripts/gate-v7-product.js`, `tests/v7-product-gate.test.js`; modify `package.json`, `index.html`, `src/gen-v7.js`, `src/presets.js`, `src/card-ui.js`, `src/app.js`, `scripts/static-check.js`.

**Interfaces:** `npm run gate:v7-product`; `diagnostics:legacy` retains `gate:v6-strength`; `verify:release` runs V7 gate.

- [ ] Write and run failing deterministic regression tests for geometry, 100-vs-40, 40XC-vs-100C, 70XC-vs-100C smoke, same-level extreme rarity, solver convergence, fingerprint invariance, content-only BP, and legacy reproduction.
- [ ] Add the V7 gate while leaving product defaults on V6; run all hard gates and full audits.
- [ ] Only after every result is green, commit the pre-switch implementation and evidence.
- [ ] In a separate final commit, switch normal generation, `SYSTEM_PRESETS`, UI creation/regeneration, and presentation measurement to V7; move V6 gate to legacy diagnostics.
- [ ] Run real desktop/mobile browser flow: load, generate V7, add to library, start battle, reload persistence, no console errors or horizontal overflow.

### Task 10: Documentation, manifest, release verification, and Git closeout

**Files:** Create `docs/NUMERICAL-ARCHITECTURE-V7.md`, `docs/GENERATOR-V7-DESIGN.md`, `docs/V7-DELIVERY-REPORT.md`; modify `README.md`, `docs/ARCHITECTURE.md`, `RELEASE-NOTES.md`, generated numerical reference, `AGENTS.md`, `RELEASE-MANIFEST.json`.

**Interfaces:** delivery report maps every Definition-of-Done item to an authoritative artifact and real-battle metric.

- [ ] Document fixed-budget failure, dynamic marginal value, TargetTheta, style, solver, EmpiricalTheta, residuals, and BP separation.
- [ ] Include all required V6/V7 geometry, product case, level reality, seed dispersion, stat sensitivity, and BattlePower comparison tables from artifacts.
- [ ] Regenerate numerical reference, coverage, manifest, and inspect the complete scoped diff.
- [ ] Run `npm test`, `npm run verify`, and `npm run verify:release`; do not claim completion unless all required artifacts and gates pass.
- [ ] Commit authorized files, push `origin/main`, wait for GitHub Verify and Pages success, and report OLD_HEAD/NEW_HEAD/commit chain/status/ahead-behind/push/CI.
