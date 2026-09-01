# Release Notes — v1.0.0

`NUMERICAL // 数值对战实验室` is a fully offline, single-player, deterministic, multi-entity turn-based numerical combat system presented as a card-style web interface.

## Core idea

Cards are presentation only. The engine works with generic combat entities and a reusable numerical combat language:

`Formula + Modifier + Effect + Condition + Target + Event + Status + Resource + Damage Component`.

Ordinary content is composed from registered primitives and parameters instead of character-specific engine branches.

## Included release content

- 1–6 vs 1–6 simultaneous combat.
- 20 example entities.
- 63 example skills.
- 33 statuses.
- 91 documented parameters/rule axes.
- 18 registered effects.
- 27 conditions.
- 8 target components including generic query targeting.
- 28 event hooks.
- 8 damage types.
- Multi-component typed damage, resistance, penetration, wards, shields, drain, recoil, reflection and deterministic random variance.
- Arbitrary stats and named resources, multi-resource costs, conversion and sustain upkeep.
- Formula-driven modifiers with stable `SET → ADD → MULTIPLY → CAP → FINAL` ordering.
- Status stacking, periodic effects, trigger chains, cleanse/dispel/steal, sustain and stack consumption/detonation.
- Generic tactical AI.
- Deterministic replay and detailed calculation trace.
- 1–5000 match Monte Carlo simulation from the web UI.
- Human-readable and machine-readable component catalogs.
- Fully offline browser runtime.

## Mature upstream work reused or adapted

- Pokémon Showdown (MIT): deterministic Gen 5 PRNG arithmetic, action ordering/tie semantics and relay-event concepts.
- Acorn 8.15.0 (MIT): vendored expression AST parser used by the restricted offline formula DSL.

Other mature projects are documented as design references in `THIRD_PARTY_NOTICES.md`; their source is not redistributed unless explicitly stated there.

## Start

Double-click `index.html`, or serve the folder with any static server. See `README.md` for details.

## Changelog — v1.0.1 (balance hardening)

- **Default 4v4 showcase rebalanced.** The default B-side lineup moved its duplicated
  ranged slot from a second `ranger` to a `warden` (protector / counterattack deck), which
  removes a redundant shared unit and adds a defensive control archetype to the demo.
  Mirror (正反位) combined win rate moved from ~61–66% (one-sided) to **59.5%**, inside the
  40–60% acceptance band, verified across multiple seed bases. No engine, AI or numeric
  scaling changes — it is pure content composition (the kit's intended authoring path).
- **New regression test:** `default 4v4 mirror combined rate stays within the competitive
  band` locks in the combined-rate acceptance metric (currently 98 total tests).
- **Repo hygiene:** added `.gitignore`; replaced the non-functional `.git` shell with a real
  git repository; regenerated `RELEASE-MANIFEST.json` to track only shipped files.
