# Generator v6 — Final Level × Rarity Strength Contract

## Product contract

```text
Level × Rarity -> ExpectedStrength -> total available strength
Seed           -> allocation profile and mechanic topology
Mechanics      -> how strength is expressed
Match Seed     -> what happens in one battle
```

Generator v6 is the product default. Versions 1–5 remain explicit legacy paths.

## Three independent layers

1. **Generation** (`budget-v6.js`, `budget-price.js`, `gen-v6.js`) is a pure deterministic function of canonical data, seed, level, and rarity. It cannot call the battle engine, AI, BattlePower, an opponent, or Monte Carlo.
2. **Measurement** (`battlepower-v3.js`) reads real card content only. It never reads level, rarity, seed, ExpectedStrength, generation budget, opponents, or match results.
3. **Reality** (`strength-audit-v6.js` and audit scripts) runs canonical-AI battles after populations have been generated.

## ExpectedStrength

```text
ExpectedStrength = 1000 × LevelScale(level) × RarityStrengthScale(rarity)
LevelScale(L) = 0.10 + 0.90 × ((L - 1) / 99)^0.95
```

Rarity multipliers are C 1.0, C+ 1.3, B 1.7, B+ 2.2, A 2.8, A+ 3.5, S 4.4, SS 5.5, SSS 6.8, SSS Collector 8.3, XS 10, and XS Collector 12. The full Lv100 span is therefore 1000–12000 strength units (12×), not the obsolete 2870-unit comment from an earlier design draft.

## Seed allocation

`allocateBudgetV6()` creates a bounded, normalized seed-only profile across offense, durability, sustain, control, tempo, economy, reliability, and triggers. Every share remains between 2% and 55%; the profile sums to 1. Level and rarity never select a build family.

The profile directly shapes ATK, MAX_HP, DEF, RES, SPD, accuracy, evasion, crit, penetration, lifesteal, healing, resources, action families, statuses, passives, and triggers. Same seed produces the same topology at every tier; numeric magnitudes alone change.

## Viability without a fighter template

Each structure receives one deterministic path to victory: direct damage, DoT, consume combo, reflection, or resource detonation. Remaining actions follow its allocation. There is no universal `突袭 + 重击` pair. A deterministic safety path is part of structure generation, not a tier-dependent repair.

## Pricing and reconciliation

`budgetPriceCardV6()` estimates effective combat value from card content. Damage pricing includes ATK, coefficient, frequency, affordability, accuracy, targets, crit, penetration, conditions, repeats, and AI usability. Durability includes HP, DEF, RES, EVA, and resistance. Sustain, control, tempo, economy, reliability, periodic effects, passives, and triggers are charged by expected magnitude and frequency.

The generator builds a seed-defined raw card and uses deterministic magnitude bisection to reconcile the priced content to ExpectedStrength. Numeric scaling does not change topology or naming. Generation fails if absolute deviation exceeds 5%. This is a generation-budget reconciliation, not a BattlePower clamp and not a combat simulation.

## Correct empirical method

Every matchup uses the same paired Match Seed twice:

```text
low as Team A  vs high as Team B
high as Team A vs low as Team B
```

Each battle is scored separately. Reports include pair count, battle count, higher/lower wins, draws, Team A/B rates, and a Wilson 95% interval for the higher-strength win rate. The corrected pre-refactor baseline is preserved in `qa/v6-strength-baseline-corrected.json`.

## Frozen evidence

- 100 same-tier Lv50 A cards: panel distributions and priced-strength convergence in `qa/v6-seed-dispersion.json`.
- 300-card independent BattlePower correlation: Spearman 0.931 in `qa/v6-battlepower-correlation.json`.
- 1000-card generation: see the current median/p95 in `qa/v6-performance.json` (sub-millisecond on the release machine).
- 20 cards per sampled tier × 10 paired Match Seeds: corrected level/rarity/cross audits.
- 60 presets: 1770 unordered mirrored matchups, 3540 battles in `qa/v6-preset-matchup-matrix.json`.

## Frozen boundaries

Naming V3, v1–v5 deterministic legacy, battle PRNG/initiative/replay, multi-team selection, and the battle engine are unchanged by this strength-system switch.
