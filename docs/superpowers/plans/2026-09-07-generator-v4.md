# Generator v4 Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development or superpowers:executing-plans. The user approved this design on 2026-09-07.

**Goal:** complete classless deterministic generation, actual time/random mechanics, useful BP, event playback, and 60 curated cards with mobile selection.

**Architecture:** retain the offline NCB modules and canonical engine. Add separate presentation snapshots/player and a shared card browser. Freeze curated schema data with an offline script wrapper, keeping file:// support.

**Tech Stack:** existing JavaScript, Node test runner, static HTML/CSS; no new dependencies.

**Spec:** user attachment `C:/Users/admin/.codex/attachments/935d4176-fe41-45c9-b0e2-3d6689268eca/pasted-text.txt`, including supplement A–AI, which overrides original preset restrictions.

## Global Constraints

- Preserve v1/v2/v3 deterministic reproduction, replay, validator, safe formula VM, canonical PRNG, and Advanced Lab.
- No archetype prior in v4; tags are post-hoc presentation only. BP never affects combat.
- Exactly 60 curated presets, 12 rarities × 5; all ten level buckets >=4; per-rarity span >=50; low/high volatility in every rarity.
- Mobile 390×844 first; black/white; no new services, external AI, dependencies or unrelated features.
- Preserve existing commits and untracked selector work. Commit and normal push authorized after verification; never force push.

## Task 1: generation and combat mathematics

Files: src/gen-v4.js, src/engine.js, src/effects.js, src/ai.js, src/behavior.js, src/battlepower-v2.js; related tests and diagnostic scripts.

- [ ] Reproduce gaps using tests: normalized primary allocations sum to budget; local status definitions drive behavior/BP; real healing actions still converge; legacy replays unchanged.
- [ ] Implement normalized continuous allocations and rarity strength, independent useful random/time parameters, honest recursive mechanism analysis and AI expectations.
- [ ] Run relevant tests, 10000-card diversity, 3000 canonical battles, BP calibration; record actual values and denominators including draws and similar-BP cases.

## Task 2: atomic presentation

Files: src/battle-presentation.js, src/engine.js (presentation hook only, coordinate with Task 1), src/app.js, styles.css, tests/presentation.test.js.

Interface: engine optional capturePresentation flag; frames carry seq/group/row/snapshot. Presentation player owns displayed snapshot, pending queue, speed and pause; engine remains authoritative.

- [ ] Test captured intermediate HP/shield/status, single float per entity, final snapshot equality, PRNG/replay parity.
- [ ] Capture state at each actual mutation and action/event boundary, independent from canonical replay data.
- [ ] Drain frames on a single timeout; step consumes one action/event group; pause completes current frame; tab/restart cancels stale scheduling.

## Task 3: shared browser and detail

Files: src/card-browser.js, src/card-ui.js, src/app.js, index.html, styles.css, tests/card-browser.test.js.

Interface: filterCards(cards, filters) returns matching sorted cards; CardBrowser mounts into a container with onSelect/onDetail callbacks and 12-item pagination. CardDetail uses immutable presentation metadata.

- [ ] Test rarity, arbitrary level bounds, behavior and name/action search intersections, clear filters and ordering.
- [ ] Replace primary battle selects with two selection slots and full-screen browser; use same browser for library; selected detail returns to setup.
- [ ] Display core stats, BP, 2–4 tags, actions, detailed stats and expandable formulas; preserve copy/edit/delete and legacy localStorage.

## Task 4: curated content

Files: scripts/select-v4-presets.js, scripts/audit-v4-presets.js, content/presets-v4.json, content/presets-v4.js, src/presets.js, tests/presets.test.js.

- [ ] Generate >=6000 candidates with explicit rejection accounting, select distinct mechanics and time/random profiles under all distribution constraints.
- [ ] Inspect each selected card, record evidence-based design notes, schema-only adjustments if necessary and provenance with curationVersion.
- [ ] Freeze full schema plus precomputed BP; validate each card and run opponent panel, long-fight, duplicate and unusable-action audits.

## Task 5: verification and release

Files: qa v4 evidence, README.md, docs/GENERATOR-V4.md, docs/GENERATOR-V4-REPORT.md, architecture/catalog/manifest and release notes.

- [ ] Real Chromium mobile and desktop browser flows, screenshots, all timeline speeds/pause/step, filter/search/detail, overflow, console and performance measurements.
- [ ] Full npm test, manifest generation, npm run verify; inspect final diff; scoped commits; normal fast-forward push; verify live remote parity.

## Baseline

Remote bac01ac180714e3897e471b9928627c7fa659f26; starting local 94c7f4f081927271cf09beddc50b758593c0b4db, 5 commits ahead. 233 tests passed. verify failed because manifest omitted qa/power-v4-calibration.json. Existing untracked scripts/select-v4-presets.js retained.
