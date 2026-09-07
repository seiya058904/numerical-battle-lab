# Generator v3

V3 is a seeded card-program composer over the existing combat DSL. It never calls v2's composition, pressure-floor or sustain-ceiling repair functions.

## Public API and compatibility

```js
const card = NCB.generateCardByVersion({seed:'my-card',level:37,rarity:'A',archetype:'Mage'});
const pack = NCB.assembleCardPack(card);
NCB.deployCard(card);
const battle = NCB.createBattle({teamA:[card.id],teamB:[card.id],maxRounds:100});
battle.resolveRound([...NCB.planAI(battle,'A'),...NCB.planAI(battle,'B')]);
```

Load `ai.js` after `engine.js`, and `gen-v3.js` after `gen-v2.js`. Explicit `generatorVersion:1` or `2` uses the original generator unchanged. V3 stores one authoritative `actions` array; `getCardActions` accepts either shape. `assembleCardPack` translates Actions to Skills and includes nested status references, affinities and resource regeneration. Saved cards retain their generation version; same-seed regeneration respects it.

## Composition

The weighted count distribution is `[2,3,3,3,3,4,4,4,4,5,6]`. Every archetype can select every primary family. Archetype adds probability weight only; no whitelist or forced damage minimum exists.

Each action independently composes a primary effect, optional secondary actor effect, optional condition/else branch, bounded repeat, target query, cost, cooldown, priority, accuracy and damage components. Damage programs use varied types, variance, penetration, crit bonus and resource-dependent formulas. Generated status programs vary stack/refresh/replace, duration, snapshot/dynamic periodic damage, event modifiers, upkeep and counter triggers. Resource conversion, HP and named-resource costs, cleanse/dispel, cooldown reduction, state consumption and emitted events use real engine resolvers.

Owned status IDs and action IDs derive from the complete card identity. Pack assembly includes only referenced statuses. Named resources also feed a formula-based passive, so resource growth has an effect even on a defensive card. No generated `REFLECT` stat is emitted: reflection lives in executable status triggers rather than an inert stat field.

## Rarity and level

`scale = RPI / 100 * levelFactor(level) * qualityFactor(seed)`

`generationBudget = 1000 * scale`

Primary stats, action coefficients and passive/trigger magnitude scale with this budget coordinate. Rarity does not enter BattleEngine damage as a label bonus. The existing 12 RPI values remain ordered from C (100) to XS collector (245). Holding seed/level/archetype fixed preserves the mechanism structure and increases the budget and primary stats. Adjacent matchup percentages are not fitted or gated. Pure sustain can still draw across a large rarity gap.

## AI

Canonical AI enumerates legal actions and targets, evaluates effects from their data, and keeps stable tie order. It considers mitigated damage and kill value, missing HP, shield capacity, matching wards, statuses over up to three ticks, duplicate state, costs, resource caps/demand, conversion, cooldown and priority. Conditions use current battlefield state; within-action status consumption shares estimated stack context. Event value follows bounded trigger programs. No archetype branching determines decisions.

This is a bounded heuristic planner, not exhaustive multi-round minimax. It cannot predict all opponent choices or every event chain exactly. Weak decisions are allowed; illegal actions, RNG mutation and unbounded planner recursion are not.

## Audit and safety

`npm run diversity` writes 3000-sample action counts, effect/condition/event/type/resource/status/target/trigger coverage, structural identities, duplicate rate and multi-support counts. Fingerprints exclude IDs, labels and numeric constants but preserve formulas' symbols/operators, branch structure and mechanisms. Coverage reports authorable generated structures, not proof that every branch fired in a battle.

The generator validates each assembled pack. Formula evaluation remains Acorn AST plus whitelist; canonical randomness remains Gen5PRNG. Effects and triggers have bounded work; maxRounds terminates defensive mirrors. Replay v2 includes content definitions and the round bound so generated battles can be imported in a fresh page.

## Player presentation

Ordinary cards show name, level, rarity, four core stats, a short style summary and action names/descriptions. Internal coefficients, formulas and IDs stay in advanced editing. Battles default to two AI-controlled cards. Advanced team counts share the same queue without positions. The single-step control advances one complete round and pauses; speed changes wall-clock delay only; restart uses exactly the same setup and seed.
