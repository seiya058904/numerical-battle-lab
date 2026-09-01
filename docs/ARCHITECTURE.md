# Architecture

## 1. Boundary

The canonical runtime is a **headless deterministic combat engine**. The browser renders entities as cards, but “card” is not an engine primitive.

```text
Content Pack
  ├─ CombatEntity definitions
  ├─ Skills
  └─ Status programs
        ↓
Validator / Component Registries
        ↓
BattleEngine
  Action → ordered queue → Effect registry → Event kernel
       → Formula / Modifier / Target / Condition components
       → state commit → Trigger programs → terminal check
        ↓
Canonical State + Structured Log + Replay Actions
        ↓
Browser UI / AI / Simulator
```

`src/engine.js` and `src/effects.js` are forbidden from knowing concrete unit or status IDs. New ordinary content is authored as data. A new engine branch is justified only when the game language genuinely gains a new primitive.

## 2. Determinism

Gameplay randomness is owned by the Pokémon Showdown-derived Gen5 PRNG in `src/kernel.js`. `Math.random()` is forbidden in canonical runtime source.

For a compatible content pack:

```text
same setup + same seed + same ordered actions = same state/log/outcome
```

AI look-ahead uses a cloned planner RNG, so thinking about an action does not consume gameplay randomness. Replay stores the seed, teams and player/AI actions; replay verification reconstructs the battle through the same engine.

## 3. Action ordering

Actions are normalized, then ordered deterministically by:

1. action priority,
2. effective speed,
3. deterministic tie information.

Priority/speed can be modified through the shared event-modifier system. No UI timing, wall clock or animation state participates in resolution.

## 4. Registries are the schema source of truth

`src/components.js` owns reusable registries for:

- parameters,
- effects,
- conditions,
- targets,
- events,
- damage types,
- modifier operations,
- formula functions through the plugin API.

The content validator reads these registries. The generated files `docs/NUMERIC-COMPONENT-CATALOG.md` and `docs/numeric-component-catalog.json` are therefore documentation projections of executable capabilities, not separately maintained lists.

## 5. Formula pipeline

The shipped parser is vendored **Acorn 8.15.0**. `src/formula.js` performs:

```text
Formula text
  → tiny syntax normalization (`and/or/not/^`)
  → Acorn AST
  → AST node/operator/symbol/function whitelist
  → pure local evaluator
  → finite Number result
```

Allowed execution is intentionally much smaller than JavaScript. Assignment, member access, arrays/objects, constructors, dynamic code and random functions are rejected before resolution. Formula plugins can add named pure functions, but content cannot provide executable JavaScript.

This design uses a mature parser while retaining strict, deterministic semantics for the battle DSL.

## 6. Formula scope

The scope is rebuilt from explicit battle context. It exposes standard values such as `ATK`, `HP_PCT`, `TARGET_HP`, event damage and status stacks, plus dynamic stats/resources using canonical names. The scope contains only primitive numbers/booleans.

## 7. Modifier pipeline

Derived values use one deterministic operation band:

```text
SET → ADD → MULTIPLY → CAP → FINAL
```

Modifier definitions are data. Formula-driven values are evaluated through the same formula adapter. Stable ordering is explicit; object/map iteration order is not used as a semantic tiebreaker.

## 8. Damage packet

A `damage` effect can contain one or more independent components. Each component may define:

- damage type,
- formula / multiplier,
- defense stat,
- penetration and type penetration,
- defense/resistance/evasion bypass,
- accuracy and crit behavior,
- deterministic random variance,
- min/max clamps,
- drain/recoil,
- reflection permissions.

Each component travels through the same damage pipeline. Shield, typed Ward and HP commitment are separate layers and emit structured trace data.

## 9. Conditions and targets

Conditions are composable registry components rather than skill-specific `if` statements. Targeting likewise uses reusable components and a generic Target Query:

```text
relation + filters/conditions + sort + limit + selection mode
```

This supports single, all, lowest-HP, guard-constrained, automatic and future plugin targets without expanding a central target switch for every skill.

## 10. Status programs and events

A status can contribute modifiers, event modifiers, periodic effects, sustain upkeep and triggers. Trigger names are validated against the Event Registry. The generic `emitEvent` effect lets content/plugins compose new event programs without teaching BattleEngine a content ID.

The event kernel uses relay semantics: a proposed numeric/event payload can be transformed by ordered modifiers before the final effect commits.

## 11. State, logs and replay

The canonical battle state contains gameplay-relevant entity state, cooldowns, resources, statuses, shields/wards, round, PRNG state and outcome. Full UI state is not canonical.

Logs are structured projections from resolution. Detailed traces record formulas, modifiers, mitigation, RNG-related outcomes and before/after values. Replay actions are authoritative; logs can be regenerated.

## 12. UI and simulator

`src/app.js` is an adapter. It may edit content, choose actions, render logs, persist drafts and run simulations, but it cannot directly mutate combat semantics.

`runSimulation` creates normal battles and normal AI plans repeatedly. Balance statistics therefore exercise the same engine used by the playable UI.

## 13. Static architecture gates

`npm run verify` regenerates the component catalog, runs behavioral tests and then checks structural invariants including:

- no canonical `Math.random()`,
- no `eval/new Function`,
- no network runtime scripts,
- required vendored parser and licenses,
- no concrete unit/status IDs in engine/effect runtime,
- every registered effect has an executable resolver,
- bundled content compiles through the validator,
- component catalog remains above the expected coverage floor.
