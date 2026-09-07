# Generator v4 — Classless Dynamic Generation

V4 completely removes the "choose a class first" mental model. A card is a fully
independent random individual: dozens of real variables jointly decide how it
fights, and only afterwards does a post-hoc Behavior Analyzer describe its nature.

Legacy v1/v2/v3 data and deterministic reproduction are untouched. Explicit
`generatorVersion: 1 | 2 | 3` still reproduces those generators byte-for-byte.

## Public API

```js
// default dispatcher is now v4 (spec §2)
const card = NCB.generateCardByVersion({seed:'my-card', level:47, rarity:'A+'});

// v4 has NO archetype input — passing one throws
// const bad = NCB.generateCardV4({archetype:'Assassin'}); // throws

const behavior = NCB.analyzeBehavior(card);  // {tags, summary} post-hoc
const bp = NCB.battlePowerV2(card);           // display-only, never read by engine
```

Load order: `gen-v4.js` after `gen-v3.js`; `behavior.js`, `battlepower-v2.js`,
`card-browser.js` and `presets.js` after `battlepower.js`/`card-ui.js`.

## 1. Classless primary allocation (§5)

No `ARCHETYPES[...]` table. `allocatePrimaryV4(budget, seed)` draws five positive
continuous weights from the seeded PRNG, normalizes them, and distributes the
rarity/level budget exactly (`sum === budget`, tested). Any ordinal shape can
appear: very high HP / very low ATK, very high ATK / very low HP, flat and even,
etc. There are no pre-baked "7 class proportions".

## 2. Individual consistency without a class (§6)

Weak correlation is derived from the *already-rolled real numbers*, never from an
`if (archetype === ...)`:
- high `CRIT` → slightly higher weight on burst / consume / high-risk action families
- high `HEAL_POWER` → slightly higher heal probability
- high `DEF` → slightly higher shield/reflect probability
- high `ENERGY_REGEN` → higher resource-consuming action probability

This is probability weighting only — never a whitelist.

## 3. Actions are pure composition (§7)

There is no "normal attack + skill". A card has only **Actions**, and attack is
just one Action kind. Every card gets 2–6 Actions (3–4 most common) composed from
the unified mechanism language: damage / heal / shield / ward / status / DoT /
consume / cleanse / dispel / resource gain / convert / cooldown / recoil / event /
toggle / conditional / repeat / target-query / multi-resource cost / HP cost /
composite damage.

## 4. Individual randomness (§8)

Each card carries real, used-by-the-engine variables:
- `VOLATILITY` — widens damage/effect variance (low ~0.95–1.05, mid ~0.8–1.2,
  high ~0.6–1.55).
- `LUCK` — shifts the *distribution* of the roll (skews toward high or low rolls),
  not a flat damage bonus.
- `CONSISTENCY` — intentionally collapsed into VOLATILITY (the inverse of it), so
  no field exists without an independent effect.

All randomness still flows through the canonical Gen5PRNG — same battle seed
reproduces the exact same damage variance / crit / hit / status / target / LUCK.

## 5. Time dynamics (§10–13)

Formulas may read `ROUND` / `BATTLE_TURN` inside the safe whitelisted expression
scope (no `eval`). Per-card time variables:
- `ENDURANCE` — real purpose: shifts wear start, terminal-pressure speed, wear-resist.
- `RAMP_START / RAMP_RATE / RAMP_CAP` — grow-stronger over rounds.
- `FATIGUE_START / FATIGUE_RATE / FATIGUE_CAP` — grow-weaker over rounds.

Combinations produce pure ramp, pure fatigue, burst-then-fatigue, weak-then-strong,
extremely stable, high-endurance, low-endurance, even simultaneous ramp+fatigue.

## 6. Battle Wear / long-match convergence (§14–19)

`applyBattleWear` is not an Action — it is natural pressure that grows with ROUND.
`ENDURANCE` gating, per-entity `_wear`:
- healing effectiveness drops (`wearHealFactor`),
- and terminal pressure applies an **irrecoverable max-HP decay** after ~12 rounds
  past the entity's wear start.

Wear damage bypasses shields/wards (it is fatigue, not an attack). Pure
heal-vs-heal / shield-vs-heal / zero-direct-damage mirrors therefore converge
instead of looping to `maxRounds`. Engine verifies via `rulesVersion` so v1/v2/v3
replays are byte-for-byte unchanged.

## 7. Behavior Analyzer — post-hoc, presentation-only (§29–32, §61)

`analyzeBehavior(card)` runs **only after** generation finalizes every stat /
action / status / trigger. It emits `tags` (2–4) + `summary`. It is pure
presentation: the canonical AI and engine never read tags (tested). Old v3 cards
still carrying `archetype` are described by the same analyzer and shown as
"高波动 · 后期成长 · …" instead of a class word.

## 8. BattlePower v2 (§20–27)

`battlePowerV2` is **static, recursive, generic-strength** and display-only:
`power ≈ round(base × mechanicFactor)`.

- `base = generationBudget` (RPI × levelFactor × quality) — this single term makes
  same-seed same-level 12-rarity BP **strictly increasing** and level ladders rise.
- `mechanicFactor` recursively extracts features (conditional→damage, repeat→shield,
  consume, DoT, triggers, lifesteal, reflect, ward, resistance, cooldown, priority,
  accuracy, crit, variance, ramp, fatigue, wear-resist, self-damage) and ratios them
  against a reference C-Lv100 v4 card.
- Rarity never enters battle math; it enters BP only through the real budget it grants.
- The engine never references `.power` (tested); BP is cached per card id and is
  cheap enough for mobile renders of 60 presets (preset power is precomputed in the
  content file).

## 9. Cards view / Battle Setup (§A–AB)

The main picker is no longer a long `<select>`. A shared `CardBrowser` + selection
slots render real card tiles with rarity / level / BP / tags / summary / actions,
filterable by rarity chips, arbitrary level bounds, behavior tags, and name/action
search, with 12-per-batch lazy rendering. Card detail offers direct "choose for
left/right".

## 10. Mobile presentation timeline (§33–42)

The engine still resolves deterministically in one pass, but when
`capturePresentation:true` it records **atomic frames** — one per actual HP/shield/
status mutation or action/event boundary. The UI plays these frames one-at-a-time:
the health bar tracks each change, only one floating number decays per entity
(`combat-float-slot`), pause completes the current frame, step advances one
action/event group, and speed (1×/2×/4×) adjusts the timeline scheduling — never
the engine math. Final displayed state always equals final engine state (tested).