# Final vision audit — inspection before changes

Baseline: 74d8925d8afc332e62cb18de5bb35e40df528003; clean checkout; local origin/main same. No push authorized.

| Area | Finding / severity | Decision |
|---|---|---|
| Product vision | Classless v4, offline creation/spectating, no metagame | Preserve |
| Numerical depth | 111 registry parameters; coverage is documentation coverage, not proof every parameter has a semantic test | Run coverage and perturbation audits; disclose limits |
| Generator | Continuous primary allocation, 15 action families, individual time/random variables | Preserve seeded output |
| Engine | Atomic frames; baseline browser proves HP sync, pause, step, finish; legacy fixture suite passes | Preserve combat rules |
| Canonical AI | P1 repeat estimator drops REPEAT_INDEX; P2 own counter is charged even on safe attacks without incoming self-damage | Reproduce with exact score/decision tests; repair generic planner |
| BattlePower | P2 presentation cache keys omit legacy skills/model inputs; model remains static heuristic | Fix invalidation; run calibration, do not alter cards to fit BP |
| Presets | 60 frozen curated cards, 12 x 5 | Run all-card panel; preserve identities unless actual defect proven |
| Mobile UX | P1 encyclopedia has no visible close/back; existing QA bypasses via DOM removal. No Escape/focus containment | Implement reversible overlay close and keyboard focus behavior; real-control regression |
| Visual design | P2 mobile filters consume ~550px before first card; rarity classes have no corresponding frame differentiation | Compact optional behavior filters; monochrome tier strokes; preserve card structure |
| Knowledge / tutorial | Existing ordered tutorial already covers 12 topics. Registry reference has many sparse legacy entries | Improve readable stat labels and close/navigation; document sparse coverage honestly |
| Architecture | engine.js retains legacy planner, ai.js is canonical; this distinction missing from entry map | Clarify onboarding instead of merging compatibility paths |
| Performance | Desktop Chrome mobile emulation baseline: navigation 197ms, picker 55ms, battle start 18ms (single local run) | Repeat after changes; no physical-device claim |

Success: targeted regressions fail before/pass after; full prescribed suites/audits; 390x844 and desktop screenshots opened; at least 15 actual UI matches over 12+ curated cards; no generation/replay mutation; final diff reviewed and manifest regenerated from staged files.
