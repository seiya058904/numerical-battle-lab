# Generator v3 implementation plan

Goal: simple monochrome creation and AI spectator sandbox over the existing deterministic DSL.
Spec: user supplied codex pl(1).txt, sections 0–41.
Baseline: b590eb7b8bf75642d25d964bf7551b2a7dc7f256; clean working tree.

Architecture: retain Skill execution and frozen v1/v2 generation. Add Action adapters and an independent v3 composer; canonical AI evaluates effects rather than archetypes. Presentation translates data into short Chinese descriptions. Playback timing never enters canonical state.

- [ ] A: record npm test / verify baseline and inspect registries, engine, AI, generator and UI.
- [ ] B: test and implement Action pack compatibility and legal-action API; bounded rounds recorded in replay.
- [ ] C: test and implement independent seeded weighted grammar, 2–6 actions, monotone rarity budget, status/resource programs and structural fingerprints in src/gen-v3.js.
- [ ] D: test canonical legal AI choices for damage, sustain, conditions and resources; preserve legacy difficulty planners for diagnostics.
- [ ] E: select both cards, preserve advanced team sizes, autoplay, pause, step, speed, exact restart.
- [ ] F/G: presentation adapter and monochrome UI; complete card JSON editing with validation and persistence.
- [ ] H: 3000-card diversity audit, deterministic battles/replays, desktop/mobile flows; update docs and local commit.

Success criteria: all correctness tests pass; every generated card validates; all 2–6 action counts and DSL effect families appear; no compulsory damage kit; same seed reproduces; large rarity gaps favor higher budgets; bounded sustain draws; no mobile overflow or normal formula leakage. Statistical fairness is diagnostic only. No dependency updates, deployment or remote push.
