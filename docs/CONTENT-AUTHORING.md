# Content Authoring

The normal rule is: **compose components; do not edit the engine.**

## 1. Unit definition

A unit is static data. Typical shape:

```js
{
  id: 'example-vanguard',
  name: 'Example Vanguard',
  role: 'frontline',
  description: 'Example only',
  stats: {
    MAX_HP: 520,
    ATK: 82,
    DEF: 70,
    RES: 48,
    SPD: 54,
    ACC: 0.92,
    EVA: 0.05,
    CRIT: 0.10,
    CRIT_DMG: 1.5,
    ENERGY_MAX: 100
  },
  resources: { ENERGY: 40 },
  resourceRegen: { ENERGY: 12 },
  resistances: { physical: 0.05 },
  skills: ['example-strike']
}
```

Stats/resources are intentionally open-ended. A new numeric stat/resource does not require a new `CombatEntity` class field if the generic pipeline can already consume it.

## 2. Skill definition

A normal skill is a program assembled from parameters and effects:

```js
{
  id: 'example-strike',
  name: 'Example Strike',
  target: 'enemy',
  costs: { ENERGY: 25 },
  cooldown: 1,
  priority: 0,
  accuracy: 0.95,
  formula: 'ATK * 1.15 + SPD * 0.2',
  damageType: 'physical',
  penetrationBonus: 0.12,
  varianceMin: 0.95,
  varianceMax: 1.05,
  effects: [
    { type: 'damage' },
    { type: 'status', status: 'example-mark', duration: 2, condition: {type:'lastHit'} }
  ]
}
```

The base formula and generic knobs are merely defaults consumed by `damage`; an explicit `damageComponents` array can override them per component for hybrid attacks.

## 3. Composite damage

```js
{
  type: 'damage',
  components: [
    { damageType:'physical', formula:'ATK * 0.7', defenseStat:'DEF' },
    { damageType:'fire', formula:'ATK * 0.35', defenseStat:'RES', typePenetrationBonus:0.15 }
  ]
}
```

Do not create “hybridDamageEffect”. Composition is the feature.

## 4. Formula language

Examples:

```text
ATK * 1.2 + sqrt(SPD)
TARGET_MAX_HP * 0.025 * STACKS
TARGET_HP_PCT < 0.35 ? ATK * 2 : ATK
clamp(EVENT_HP_DAMAGE * 0.12, 0, 80)
```

Available functions are listed in the generated component catalog. The parser is Acorn 8.15.0 behind a restrictive AST whitelist. Do not put JavaScript statements, member access, arrays/objects or random calls in formulas.

Use the canonical PRNG-bearing game components when chance is required.

## 5. Requirements / conditions

Skill legality and conditional branches use the same reusable condition registry. Conditions can be composed with `all`, `any` and negation components instead of writing custom JavaScript.

Examples include HP thresholds, resources, tags, statuses, last-hit/crit/kill context and plugin conditions.

## 6. Target Query

Use a simple target component for common cases. Use `query` when selection is compositional:

```js
{
  type: 'query',
  relation: 'enemy',
  where: [{type:'alive'}],
  sortBy: 'HP_PCT',
  direction: 'asc',
  limit: 2,
  mode: 'all'
}
```

The exact executable fields and options are documented in `NUMERIC-COMPONENT-CATALOG.md`.

## 7. Status definition

A status is also a data program. It can contain:

- stacking policy (`stack`, `refresh`, `replace`),
- duration / persistence,
- stat modifiers,
- event modifiers,
- periodic effects,
- reactive triggers,
- status tags and immunities,
- sustain upkeep.

Prefer tags for families such as buff/debuff/poison/control instead of naming specific statuses inside the engine.

## 8. Triggers and events

Trigger event names must exist in the Event Registry. A trigger can then run ordinary effects with ordinary target components and conditions.

For genuinely new event vocabulary, add it through the plugin manifest. The generic `emitEvent` effect can publish it. Do not add a one-off `if (skill.id === ...)` branch.

## 9. Plugins

A plugin is appropriate only when the desired mechanic cannot be represented by existing components. See `PLUGIN-API.md`.

A plugin may register new:

- parameters,
- formula functions,
- conditions,
- targets,
- effects,
- events,
- damage types,
- modifier operations.

Keep plugin resolvers deterministic and pure with respect to external IO/time.

## 10. Validation workflow

After editing content:

```bash
npm run verify
```

The validator catches unknown references, invalid formulas/symbols/functions, unregistered effect/condition/target/event types, invalid modifier operations and other schema errors before battle start.

The browser editor performs the same content-pack validation before saving or importing JSON.

## 11. Architecture smell checklist

Before changing `src/engine.js`, ask:

1. Can the mechanic be expressed with an existing Effect + Condition + Target + Modifier?
2. Can a generic parameter solve it for many future skills?
3. Is this really a new reusable primitive suitable for a plugin/registry entry?
4. Would the proposed code mention a concrete unit/skill/status ID?

If #4 is yes, the design is almost certainly wrong.
