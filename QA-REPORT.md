# Final QA Report

Release candidate: `NUMERICAL // 数值对战实验室` v1.0.0

## Automated verification

Fresh source-tree verification command:

```bash
npm run verify
```

Result: **97 / 97 tests passed**, static architecture checks passed.

Generated capability counts at verification time:

- Parameters: 91
- Effects: 18
- Conditions: 27
- Targets: 8
- Events: 28
- Damage types: 8
- Example units: 20
- Example skills: 63
- Example statuses: 33

The static gate checks deterministic runtime constraints, forbidden dynamic execution, runtime network scripts, vendored parser/license presence, effect resolvers, content validation and component-catalog coverage.

## Stress and determinism

`qa/stress-results.json` records the release stress run.

- Default composition, 200 matches: A 55.5% / B 44.5%, 0 draws.
- Swapped sides, 200 matches: A 44.0% / B 56.0%, 0 draws.
- Combined composition win rate: **55.75%**.
- 6v6: completed 50 matches without runtime failure.
- 1v6 and 6v1: completed 20 matches each without runtime failure.
- Determinism: 25 paired deterministic cases reproduced exactly.

These are smoke/balance metrics for the bundled sample content, not a claim that every possible custom content pack is competitively balanced.

## Browser QA

`qa/browser-results.json` records the interactive browser pass for the current Acorn-based offline runtime.

Verified items include:

- Engine self-test deterministic.
- Formula layer reports `ACORN 8.15.0 / OFFLINE`.
- 8 combat cards visible in the default 4v4 battle.
- Four actions can be queued and resolved.
- Battle log grows after resolution.
- Editor exposes three skills for the selected unit.
- Invalid formula is visibly rejected and valid formula restores the OK state.
- 50-match UI simulation renders aggregate metrics.
- Rules/architecture guide renders the generated component definitions.
- 390px viewport renders 8 cards with body width equal to viewport width; no horizontal overflow.
- No page JavaScript errors were recorded in the browser pass.

Screenshots:

- `qa/desktop.png`
- `qa/mobile.png`

Both screenshots were manually inspected before packaging.

## Environment note

A later raw `chromium --headless file://...` CLI smoke attempt in this sandbox stalled in Chromium's Linux process/DBus environment before it could produce a new screenshot. This is an environment-specific launcher issue; the recorded interactive browser QA above is for the current offline Acorn runtime, and the web app does not require DBus or a browser automation service at runtime.
