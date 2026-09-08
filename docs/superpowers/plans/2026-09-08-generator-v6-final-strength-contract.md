# Generator v6 Final Strength Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Subagents are prohibited for this repository task.

**Goal:** Replace the provisional Generator v6 with a pure deterministic Level x Rarity total-strength budget system, preserve diverse seed-defined builds, validate it independently, and make v6 the product default.

**Architecture:** `expectedStrengthV6(level, rarity)` fixes total available strength; a seed-only allocation profile spends it across stats and mechanics, and a generation-time price/reconciliation loop closes the budget without battles or BattlePower. Static BattlePower and paired canonical-AI Monte Carlo remain independent measurement and reality layers.

**Tech Stack:** CommonJS JavaScript, Node test runner, deterministic Gen5PRNG, browser UI, GitHub Actions.

**Spec:** User-approved “Numerical Battle Lab — Generator v6 最终实力体系重构与产品切换” attachment, reflected in `docs/GENERATOR-V6-DESIGN.md` and `docs/V6-DELIVERY-REPORT.md` during Task 7.

## Global Constraints

- Work from `main` commit `5d330b91416b2362135a458b810d8cf67a0e9118` and preserve v1-v5 deterministic behavior.
- Do not change Naming V3, battle randomness/initiative, or multi-team selection.
- Generation must not call `createBattle`, `planAI`, `resolveRound`, BattlePower, an opponent, or Monte Carlo.
- BattlePower must not read level, rarity, seed, expected strength, generation budget, opponent, or match result.
- Same seed must preserve name and mechanic fingerprint across level and rarity; only magnitudes may change.
- Every priced stat and mechanic must consume budget; reconciliation tolerance is at most 5 percent.
- Full empirical results use paired side mirroring, per-battle scoring, and Wilson 95 percent confidence intervals.
- Do not use subagents.
- Final scope includes commit, push, and GitHub Actions verification as explicitly authorized by the specification.

---

### Task 1: Correct paired empirical scoring and preserve the pre-refactor baseline

**Files:**
- Create: `src/strength-audit-v6.js`
- Create: `tests/strength-audit-v6.test.js`
- Modify: `scripts/audit-v6-strength.js`
- Modify: `scripts/gate-v6-strength.js`
- Create: `qa/v6-strength-baseline-corrected.json`

**Interfaces:**
- Produces: `scoreMirroredPair(low, high, seed, fight)` and Wilson interval summaries with `pairCount`, `battleCount`, side wins, strength wins, draws, rates, and `ci95`.

- [ ] Write literal tests proving split mirror results score one high win out of two, not two, and proving side/rate/count accounting.
- [ ] Run `node --test tests/strength-audit-v6.test.js` and confirm the old behavior fails.
- [ ] Implement the shared paired scorer with the same seed for both sides and Wilson intervals.
- [ ] Run the focused test and the corrected audit against untouched `5d330b9` generation.
- [ ] Save the required rarity and level matchup matrix as `qa/v6-strength-baseline-corrected.json` before editing generator behavior.

### Task 2: Implement seed allocation and pure deterministic generation

**Files:**
- Modify: `src/budget-v6.js`
- Modify: `src/budget-price.js`
- Rewrite: `src/gen-v6.js`
- Modify: `tests/gen-v6.test.js`

**Interfaces:**
- Produces: bounded normalized `allocationProfile`; `budgetPriceCardV6(card)`; `reconcileBudgetV6(card, expectedStrength, allocationProfile)`; pure `generateCardV6(opts)`.

- [ ] Add failing tests for allocation bounds/diversity, exact total, same-seed topology invariance, panel diversity, priced-strength tolerance, viable noncanonical victory paths, and absence of battle/BattlePower calls during generation.
- [ ] Run `node --test tests/gen-v6.test.js` and record expected failures.
- [ ] Generate seed-only structures and allocate offense, durability, sustain, control, tempo, economy, reliability, and trigger/passive budgets.
- [ ] Price stats, action magnitude/frequency/reliability/targets, sustain, control, economy, passives, and triggers independently from BattlePower.
- [ ] Reconcile over/under budget by changing the build’s own dominant category while retaining topology and identity.
- [ ] Remove reference opponents, measured-edge selection, fixed two-strike construction, and generator-time battle/BattlePower calls.
- [ ] Run focused tests until green, then benchmark 1000 cards and capture median/p95.

### Task 3: Validate invariants, legacy compatibility, and product defaults

**Files:**
- Modify: `src/gen-v6.js`
- Modify: `src/presets.js`
- Modify: `src/card-ui.js`
- Modify: `src/app.js`
- Modify: `tests/generator.test.js`
- Modify: `tests/gen-v6.test.js`
- Modify: `tests/presets.test.js`
- Modify: `tests/presets-v6.test.js`
- Modify: `tests/card-library.test.js`

**Interfaces:**
- Produces: default `generateCard`/`generateCardByVersion` v6 dispatch while explicit versions 1-5 remain legacy; `SYSTEM_PRESETS` points to frozen v6.

- [ ] Add failing assertions for exact fingerprint equality, same-seed name equality, default v6 generation/presets/UI, 60 valid v6 cards, and explicit v5 legacy fixture equality.
- [ ] Run the focused tests and confirm failures precede implementation.
- [ ] Switch default generator, preset source, regeneration, and v6 BattlePower display paths without changing explicit legacy dispatch.
- [ ] Regenerate/freeze 60 v6 presets while retaining all 60 Naming V3 names.
- [ ] Run focused tests and `npm test`.

### Task 4: Build independent full audits and release gate

**Files:**
- Modify: `scripts/audit-v6-strength.js`
- Modify: `scripts/gate-v6-strength.js`
- Create: `scripts/audit-v6-budget.js`
- Create: `scripts/audit-v6-performance.js`
- Modify: `package.json`
- Create/update: `qa/v6-strength-final.json`, `qa/v6-level-strength.json`, `qa/v6-rarity-strength.json`, `qa/v6-expected-strength.json`, `qa/v6-seed-dispersion.json`, `qa/v6-budget-distribution.json`, `qa/v6-preset-matchup-matrix.json`, `qa/v6-battlepower-correlation.json`, `qa/v6-performance.json`

**Interfaces:**
- Produces: corrected empirical artifacts and CI gate consumed by `npm run verify:release`.

- [ ] Add deterministic audit-contract tests for every required bucket and artifact field.
- [ ] Run tests and confirm missing outputs fail.
- [ ] Implement sufficient sampled populations and paired match seeds, Wilson intervals, monotonic-gap summaries, ExpectedStrength correlation, seed dispersion, panel/budget distributions, same-tier matchup diversity, preset matrix, BattlePower correlation, and performance statistics.
- [ ] Tune only the generation budget curve/pricing/reconciliation where independent results miss gates; never tune the audit scorer.
- [ ] Run full audits and keep honest outputs, including any residual uncertainty.
- [ ] Wire the corrected small CI gate into `verify:release` and run it.

### Task 5: Browser acceptance of the v6 product switch

**Files:**
- Modify only if a reproduced UI defect requires it: `src/app.js`, `src/card-ui.js`, `src/card-browser.js`
- Update: browser QA evidence under `qa/`

**Interfaces:**
- Consumes: v6 default generator and presets.
- Produces: real-browser evidence that normal creation, presets, details, battle, and multi-team flows use v6.

- [ ] Start the local static server and run the existing browser QA at desktop and mobile viewports.
- [ ] Verify a newly generated card and default preset cards report `generatorVersion === 6` through real UI flows.
- [ ] Reproduce any UI regression, add the narrowest automated test first, fix it, and rerun affected browser flows.

### Task 6: Release documentation, version, and manifest

**Files:**
- Modify: `README.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/GENERATOR-V6-DESIGN.md`, `docs/V6-DELIVERY-REPORT.md`, `RELEASE-NOTES.md`, `package.json`, `RELEASE-MANIFEST.json`

**Interfaces:**
- Produces: one consistent release story declaring v6 current and v5 legacy, with corrected evidence only.

- [ ] Update the release version according to repository convention.
- [ ] Remove or label invalid pair-level win-rate claims and fix all 2.87x/2870 versus 12x/12000 drift.
- [ ] Document code paths for strength source hierarchy, eight real allocation examples, panel/budget distributions, win-rate/CI tables, seed dispersion, matchup diversity, performance, and product defaults.
- [ ] Stage only authorized files, regenerate the manifest, and inspect the scoped diff.

### Task 7: Final verification, commit, push, and CI

**Files:**
- Verify all changed files and generated evidence.

**Interfaces:**
- Produces: exact old/new HEAD, commit chain, push result, and GitHub Actions result.

- [ ] Run `git diff --check`, focused tests, `npm test`, `npm run verify`, `npm run verify:release`, audits, and browser acceptance with fresh outputs.
- [ ] Confirm all 34 Definition of Done items against code or evidence; report any unmet item instead of claiming readiness.
- [ ] Inspect `git status`, staged diff, manifest, remote/ahead-behind, and authorized file list.
- [ ] Commit the implementation and generated evidence, push `main`, and wait for the resulting GitHub Actions run to finish.
- [ ] Report `GENERATOR V6 — READY FOR HUMAN REVIEW` only if every gate is proven green.
