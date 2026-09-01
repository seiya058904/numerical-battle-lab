# Sub-Plan 5: Determinism + ExpectedWin Monte Carlo Calibration
**Goal:** Prove generator determinism end-to-end and provide the ExpectedWin reference curve (`ExpectedWin(A,B)=PA^3/(PA^3+PB^3)`) used as a non-binding MC target.
**Architecture:** `src/gen-balance.js` (IIFE) exposing NCB.expectedWinRate(pA,pB) and a calibration helper; plus `tests/generator.test.js` additions and a `scripts/gen-mc.js` smoke runner. Depends on power.js (RARITY_RPI) and engine.js for real battles.

## Constraints (spec 3, 28, 29, 32)
- ExpectedWin(A,B)=PA^3/(PA^3+PB^3); reference: up-1 rarity ~56-58%, up-2 ~63-67%, up-3 ~70-75%, up-4 ~78-82%, SSS vs C ~90%. NOT a hard requirement per matchup — reference line only.
- Determinism: same seed/rarity/level/archetype/generatorVersion always yields identical card; replay it in engine and re-fight to identical final state.
- AI RNG must not pollute canonical battle RNG (already guaranteed by engine.prng.clone() in planAI).
- Only budget reallocation, never direct rarity*2 boosts.

## Task 1: expectedWinRate reference
**Produces:** NCB.expectedWinRate(pA,pB).
- [ ] Step1 test: expectedWinRate(100,100)==0.5; expectedWinRate(207,100) ~0.90 (assert >0.88); expectedWinRate(141,100) between 0.78-0.82 (up-4); expectedWinRate(108,100) ~0.56 (up-1): assert 0.54-0.58.
- [ ] Step2 FAIL; Step3 impl in gen-balance.js (1-line formula + non-finite guard); Step4 PASS; Step5 commit `feat(gen-balance): expected win reference`.

## Task 2: end-to-end determinism (card gen -> engine fight -> replay)
- [ ] Step1 test: generate same card twice; start two battles with each vs identical opponent+seed; resolve same number of scripted rounds; snapshots deep-equal. Also replayBattle(exportReplay()) reproduces final state.
- [ ] Step2 FAIL; Step3 ensure generator fully deterministic (no shared mutable state, no Math.random) — likely already true, this task hardens; Step4 PASS; Step5 commit `test(gen): end-to-end determinism`.

## Task 3: Monte Carlo smoke + calibration runner (scripts/gen-mc.js)
- [ ] Step1: create scripts/gen-mc.js: for (rarityA,rarityB) pairs C/A/SSS and level pairs {1,50,100}, generate both sides' cards, run NCB.runSimulation({battles:60,seedBase:*,}) forward+swapped, print winRateA and expectedWinRate for comparison. Assert sim does not crash and winRateA stays finite (report-only, no hard band).
- [ ] Step2 run node scripts/gen-mc.js -> prints table; Step3 add to package.json scripts: "mc":"node scripts/gen-mc.js"; Step4 run -> passes; Step5 commit `feat(gen-balance): MC smoke runner`.
