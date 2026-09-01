# Sub-Plan 4: 15-Step Card Generator Pipeline
**Goal:** Turn `{rarity,level,archetype,seed,tags?}` into a compiled, combat-ready card (unit + 3 skills + optional passives/statuses/triggers) plus a PowerAudit, deterministic per seed+version.
**Architecture:** `src/generator.js` (IIFE) or host — combines power.js (CardPower/budget/split), gen-stats.js (allocatePrimary/secondary, archetype), gen-skills.js (recipes + cost/units within Active Skill budget), then emits a content unit that passes NCB.validateContentPack and can fight in a real battle. Includes PER-GENERATOR VERSION and seed string.
**Tests:** `tests/generator.test.js`; load order kernel->components->content->status-runtime->validator->formula->effects->engine->power->gen-stats->gen-skills->generator (note effects/engine needed to actually fight).

## Constraint highlights (spec 27-31)
- 15-step flow: rarity->RPI->LevelFactor->QualityFactor->CardPower->GenerationBudget->split->archetype weights->jitter->normalize->cost convert->recipe choose->budget scale->compile->power estimate->MC (MC is Plan 5).
- Determinism: same seed+rarity+level+archetype+generatorVersion => identical card. Never Math.random; use Gen5PRNG seeded streams.
- CARD_GENERATOR_VERSION=1.
- Card schema: id,seed,generatorVersion,rarity,level,quality,archetype,powerIndex,generationBudget,stats,resources,resistances,tags,skills[],passives[],statuses[],triggers[].
- PowerAudit: total budget + per-bucket (primary/secondary/skills/passive) + per-stat BP breakdown.
- Quality only reallocates, never changes total internals.

## Task 1: seeded stream derivation (per-subsystem + version)
**Produces:** NCB.generatorSeedStream(seed, chance) -> Gen5PRNG clone offset by a per-use salt; NCB.CARD_GENERATOR_VERSION=1.
- [ ] Step1 test: two draws same salt equal; different salt differ; version==1.
- [ ] Step2 FAIL; Step3 impl (append to generator.js) using Gen5PRNG; Step4 PASS; Step5 commit `feat(gen): versioned seeded streams`

## Task 2: generateCard() orchestration
**Produces:** NCB.generateCard({rarity,level,archetype,seed,tags?,generatorVersion?}) -> {id,seed,generatorVersion,rarity,level,quality,archetype,powerIndex,generationBudget,stats,resources:{ENERGY,...},stats extras,resistances,tags,skills[],passives[],statuses[],triggers[],powerAudit}.
- [ ] Step1 test: generate C Lv100 Balanced and SSS Lv100 Assassin from fixed seeds; assert: same input same output; stats.MAX_HP>=600; exactly 3 skills; every skill passes a targeted EFFECT_COMPONENTS/condition reference; powerAudit has primary/secondary/skills/passive buckets summing ~= generationBudget; validated via NCB.validateContentPack({units:{cardid:unit},skills:createdSkillsMap,statuses:{}}).ok===true; ATK/DEF/etc within conversions; SSS MAX_HP > C MAX_HP.
- [ ] Step2 run -> FAIL; Step3 implement generateCard (append to generator.js) — compose: quality=qualityFactor(seed); cardPower=computeCardPower; budget=generationBudget; split=splitBudget; primary=allocatePrimary({budget:split.primary,archetype,seed}); secondary=allocateSecondary({budget:split.secondary,seed}); choose skills via recipe pick filling split.activeSkills with refSkillCost checks; assemble unit object with skills ids + stats + a minimal `cost` of 1/2/2 and cooldown from recipe; build skill defs in a map; statuses referenced must resolve to STATUS_DEFS (add none in v1, or inline minimal ones in the pack); powerAudit=audit().
- [ ] Step4 run -> PASS; Step5 commit `feat(gen): generateCard pipeline`
- [ ] Step6: validate generated card CAN FIGHT: create a battle with generated unit vs default unit, resolve rounds, assert no throw and log contains action entries. (This requires engine load order.)

## Task 3: PowerAudit
**Produces:** NCB.powerAudit(card) -> {totalBudget,buckets:{primary:{total,by:{MAX_HP:bp,..}},secondary:{total,by:{}},skills,passive},unspent}. 
- [ ] Step1 test: sum(by)<=bucket total and total budget ~ generationBudget; Step2 FAIL; Step3 audit accumulating spend during generateCard; Step4 PASS; Step5 commit `feat(gen): power audit`.
