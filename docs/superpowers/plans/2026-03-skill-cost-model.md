# Sub-Plan 3: Skill Component Cost Model
**Goal:** Define the unified skill-power curve so generator skills can be budget-scored: `RealSkillCost = RawEffectPower x TargetFactor x ReliabilityFactor x FrequencyFactor x TempoFactor`. Provides a finite assemblable skill kit for the generator to combine.
**Architecture:** `src/gen-skills.js` (IIFE), depends on `power.js` and `gen-stats.js` (for archetype typing) and the existing ENB EFFECT_COMPONENTS/condition registries. Exposes SKILL_FACTORS (target/accuracy/cooldown), RARITY_BOUNDS note, SKILL_RECIPES (finite set: single-hit, aoe-hit, heal, shield, multihit, status-debuff, support-buff), `NCB.refSkillCost(opts)`.
**Tests:** `tests/gen-skills.test.js`; load order kernel->power->gen-stats->gen-skills.

## Constraints (spec 20-24, 17-19)
- RawEffectPower is a data estimate (not battle formula).
- TargetFactor: self 0.85, singleAlly 1, singleEnemy 1, and 2/3/4/5/6 targets = 1.55/2.00/2.40/2.75/3.05; all = target count actual; random = x0.9; conditional filtered = x0.85.
- ReliabilityFactor = accuracy (95%=0.95,90%=0.90,80%=0.80,70%=0.70,50%=0.50 min, 100%=1.0).
- FrequencyFactor by cooldown: CD0=1, CD1=0.82, CD2=0.68, CD3=0.57, CD4=0.49 (longest cd cheaper per use -> stronger single hit allowed).
- TempoFactor: priority >0 slight premium (x1.05 per +1), priority <0 discount (x0.95 per -1).
- Variance range is BUDGETED (not free): wider range should not raise average; treat variance as reliability-neutral in v1 but clamp.
- Every rarity can use any mechanism; rarity only gives budget (spec 1, 25). Skills define component COST only, never id-based boosts.

## Task 1: SKILL_FACTORS tables + refSkillCost
**Produces:** NCB.SKILL_FACTORS target/accuracy/cooldown/priority; NCB.refSkillCost({rawPower,targetCount,accuracy,cooldown,priority}).
- [ ] Step1: failing test
```js
const test=require('node:test');const assert=require('node:assert/strict');
function load(){global.NCB={};require('../src/kernel.js');require('../src/power.js');require('../src/gen-stats.js');require('../src/gen-skills.js');return global.NCB;}
test('refSkillCost combines target/accuracy/cooldown factors',()=>{const N=load();
  const single=N.refSkillCost({rawPower:1.5,targetCount:1,accuracy:1.0,cooldown:0});
  const aoe=N.refSkillCost({rawPower:0.75,targetCount:6,accuracy:1.0,cooldown:0});
  assert.ok(aoe>single,'aoe 6 targets at 0.75 base costs more than single 1.5');
  const crit=N.refSkillCost({rawPower:1.2,accuracy:0.7,cooldown:0});
  assert.ok(crit<single+1e-9,'low accuracy lowers long-term cost');
  const cd2=N.refSkillCost({rawPower:2.0,accuracy:1.0,cooldown:2});
  assert.ok(Math.abs(cd2-N.refSkillCost({rawPower:2.0,accuracy:1.0,cooldown:2}))<1e-9);
  assert.deepEqual(N.SKILL_FACTORS.target,[0.85,1,1,1.55,2.0,2.4,2.75,3.05]); // index==targetCount up to 6? index0=self
});});
```
- [ ] Step2: run -> FAIL
- [ ] Step3: implement `src/gen-skills.js`
```js
(function(root){'use strict';const NCB=root.NCB=root.NCB||{};
const SKILL_FACTORS={
  target:[0.85,1,1], // [self, singleAlly/singleEnemy index1]
```
  targetMulti(n){return n>=6?3.05+0.15*(n-6):([0.85,1,1.55,2.0,2.4,2.75][n]??1);},
  accuracy:{1:1,0.95:0.95,0.9:0.9,0.8:0.8,0.7:0.7,0.5:0.5},
  cooldown:{0:1,1:0.82,2:0.68,3:0.57,4:0.49},
  priority:p=>1.05**Math.max(-3,Math.min(3,p||0)),
};
function refSkillCost({rawPower,targetCount,accuracy,cooldown,priority}){
  const t=SKILL_FACTORS.targetMulti(targetCount||1);
  const r=SKILL_FACTORS.accuracy[accuracy]??accuracy??1;
  const c=SKILL_FACTORS.cooldown[cooldown]??1;
  const p=SKILL_FACTORS.priority(priority||0);
  const cost=Math.max(0,Number(rawPower))*t*r*c*p;
  if(!Number.isFinite(cost))throw new Error('non-finite skill cost');
  return Math.round(cost*1000)/1000;
}
NCB.SKILL_FACTORS=SKILL_FACTORS;NCB.refSkillCost=refSkillCost;
if(typeof module!=='undefined')module.exports=NCB;})(typeof globalThis!=='undefined'?globalThis:window);
```
- [ ] Step4: run -> PASS
- [ ] Step5: commit `feat(gen): skill factor cost model`

## Task 2: SKILL_RECIPES (finite assemblable kit)
**Produces:** NCB.SKILL_RECIPES (array of recipe defs mapping to EFFECT_COMPONENTS: single-hit, aoe-hit, multihit, heal, shield, status-debuff(none/fire/frost/toxic), support-buff, some with condition/sustain tags).
- [ ] Step1: failing test: assert NCB.SKILL_RECIPES length>=8, each has {id,target,kind,effects,basePower}, and every recipe's effect.type exists in NCB.EFFECT_COMPONENTS (require components.js). (require '../src/components.js' in load)
- [ ] Step2: run -> FAIL
- [ ] Step3: implement SKILL_RECIPES referencing existing EFFECT_COMPONENTS types {damage,heal,shield,status,conditional,repeat}; validate each against EFFECT_COMPONENTS at load (throw if unknown type).
- [ ] Step4: run -> PASS; Step5: commit `feat(gen): finite skill recipe kit`
