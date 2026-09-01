# Sub-Plan 1: Rarity / Power / Level / Quality / Budget Model

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or inline execution. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a pure, seeded-deterministic module to the NCB engine that defines the unified rarity coordinate system: Rarity Power Index (RPI), LevelFactor, QualityFactor, CardPower, NumericScale/GenerationBudget, and the fixed budget partition ratios — all from one `POWER_RULES` registry.

**Architecture:** A new `src/power.js` (IIFE, same pattern as `src/components.js`) exposing `NCB.POWER_RULES`, `NCB.computeCardPower`, `NCB.generationBudget`, `NCB.splitBudget`, `NCB.rarityOrder`, `NCB.rpiOf`, `NCB.levelFactor`. It depends only on `kernel.js` (for `NCB.Gen5PRNG`, to derive a deterministic quality factor) — no other engine modules.

**Tech Stack:** Plain ES5-style IIFE matching the existing runtime; `node --test`. Load order in tests: `kernel.js` → `power.js`.

## Global Constraints (copied verbatim from spec §1, §5, §6, §7, §8, §33)

- Rarity order (the **only** order): `C < C+ < B < B+ < A < A+ < S < SS < SSS`.
- RPI fixed: `C=100, C+=108, B=118, B+=129, A=141, A+=154, S=169, SS=187, SSS=207`.
- Level bounds: all rarities `Level 1..100`, single modulo curve for all.
- `LevelFactor = 0.40 + 0.60 * ((Level-1)/99)^0.92`; LF(1)=0.400, LF(100)=1.000.
- `QualityFactor` range `0.97..1.03`.
- `CardPower = RPI * LevelFactor * QualityFactor`.
- `NumericScale = sqrt(CardPower / 100)`.
- `GenerationBudget = 1000 * NumericScale`.
- Budget partition ratios (must be registry values, tunable): Primary 52%, Secondary 13%, Active Skill 25%, Passive/Trigger 10%.
- No rarity may use a different level cap; no `if (rarity === X) *= 2` in any code.

---

### Task 1: POWER_RULES registry + rarity lookup

**Files:**
- Create: `src/power.js`
- Test: `tests/power.test.js`

**Interfaces:**
- Produces: `NCB.RARITY_RPI` (object `{C:100,...SSS:207}`), `NCB.RARITY_ORDER` (array, ascending), `NCB.rpiOf(rarity)`, `NCB.rarityOrder()`.

- [ ] **Step 1: Write the failing test**

```js
// tests/power.test.js
const test=require('node:test');
const assert=require('node:assert/strict');
function load(){global.NCB={};require('../src/kernel.js');require('../src/power.js');return global.NCB;}
test('rarity order is the single ascending order and RPI matches spec',()=>{
  const N=load();
  assert.deepEqual(N.RARITY_ORDER,['C','C+','B','B+','A','A+','S','SS','SSS']);
  assert.deepEqual(N.RARITY_RPI,{C:100,'C+':108,B:118,'B+':129,A:141,'A+':154,S:169,SS:187,SSS:207});
  assert.equal(N.rpiOf('C'),100);
  assert.equal(N.rpiOf('SSS'),207);
  // every parent step is a superset in power (monotonic)
  for(let i=1;i<N.RARITY_ORDER.length;i++){
    assert.ok(N.RARITY_RPI[N.RARITY_ORDER[i]]>N.RARITY_RPI[N.RARITY_ORDER[i-1]],`${N.RARITY_ORDER[i]} must be stronger than ${N.RARITY_ORDER[i-1]}`);
  }
});
test('unknown rarity throws',()=>{const N=load();assert.throws(()=>N.rpiOf('ZZZ'),/unknown rarity/);});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `node --test tests/power.test.js` → FAIL (Cannot find module, or functions undefined).

- [ ] **Step 3: Implement `src/power.js`**

```js
(function(root){
  'use strict';
  const NCB=root.NCB=NCB||{};
  const RARITY_ORDER=['C','C+','B','B+','A','A+','S','SS','SSS'];
  const RARITY_RPI={C:100,'C+':108,B:118,'B+':129,A:141,'A+':154,S:169,SS:187,SSS:207};
  function rpiOf(rarity){
    const v=RARITY_RPI[rarity];
    if(v===undefined)throw new Error(`unknown rarity: ${rarity}`);
    return v;
  }
  NCB.RARITY_ORDER=RARITY_ORDER.slice();
  NCB.RARITY_RPI=Object.freeze({...RARITY_RPI});
  NCB.rpiOf=rpiOf;
  NCB.rarityOrder=()=>RARITY_ORDER.slice();
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
```

- [ ] **Step 4: Run test — expect PASS** (`node --test tests/power.test.js`)

- [ ] **Step 5: Commit**

```bash
git add tests/power.test.js src/power.js
git commit -m "feat(power): rarity order + RPI registry"
```

---

### Task 2: LevelFactor curve + CardPower + GenerationBudget

**Files:**
- Modify: `src/power.js`
- Test: `tests/power.test.js:add`

**Interfaces:**
- Produces: `NCB.levelFactor(level)`, `NCB.computeCardPower({rarity,level,quality})`, `NCB.numericScale(power)`, `NCB.generationBudget(power)`, `NCB.POWER_RULES` (object with `levelFormula`, `qualityRange`, `numericScaleBase`, `budgetBase`, `budgetPartitions`).

- [ ] **Step 1: Write the failing test (append to `tests/power.test.js`)**

```js
test('LevelFactor matches the spec curve at sample points',()=>{
  const N=load();
  const expect={1:0.400,10:0.466,20:0.531,30:0.594,40:0.655,50:0.714,60:0.773,70:0.830,80:0.888,90:0.944,100:1.000};
  for(const [lv,v] of Object.entries(expect)){
    assert.ok(Math.abs(N.levelFactor(Number(lv))-v)<0.005,`LF(${lv}) = ${N.levelFactor(Number(lv))}, want ~${v}`);
  }
});
test('CardPower and GenerationBudget match spec examples',()=>{
  const N=load();
  // C Lv100 quality 1.0 => power 100 => budget 1000
  assert.equal(N.computeCardPower({rarity:'C',level:100,quality:1}),100);
  assert.equal(N.generationBudget(100),1000);
  // A Lv50 ~= C Lv100 (spec §5)
  const a50=N.computeCardPower({rarity:'A',level:50,quality:1});
  assert.ok(Math.abs(a50-100.7)<1,'A Lv50 power ~100.7, got '+a50);
  // SSS Lv100 budget ≈ 1439 (§7)
  assert.ok(Math.abs(N.generationBudget(N.computeCardPower({rarity:'SSS',level:100,quality:1}))-1439)<3);
  // LevelFactor monotonic + within [0.4,1]
  for(let lv=2;lv<=100;lv++)assert.ok(N.levelFactor(lv)>N.levelFactor(lv-1));
  assert.equal(N.levelFactor(100),1);
});
test('budget partition uses registerable ratios summing to 1',()=>{
  const N=load();
  const s=N.splitBudget(1000);
  assert.deepEqual(s,{primary:520,secondary:130,activeSkills:250,passiveTrigger:100});
  const sum=['primary','secondary','activeSkills','passiveTrigger'].reduce((a,k)=>a+N.POWER_RULES.budgetPartitions[k],0);
  assert.ok(Math.abs(sum-1)<1e-9);
});

- [ ] **Step 2: Run these — expect the new tests FAIL**

- [ ] **Step 3: Implement, appending to `src/power.js`**

```js
  const POWER_RULES={
    levelFormula:{base:0.40,scale:0.60,denominator:99,exponent:0.92}, // LF = base + scale*((L-1)/99)^exp
    qualityRange:[0.97,1.03],
    numericScaleBase:100,   // NumericScale = sqrt(power/100)
    budgetBase:1000,        // budget = 1000 * scale
    budgetPartitions:{primary:0.52,secondary:0.13,activeSkills:0.25,passiveTrigger:0.10},
  };
  function levelFactor(level){
    const L=POWER_RULES.levelFormula;
    const t=Math.max(0,Math.min(99,(Number(level)||1)-1))/L.denominator;
    return L.base+L.scale*Math.pow(t,L.exponent);
  }
  function computeCardPower({rarity,level,quality}){
    const q=Number(quality);
    if(!Number.isFinite(q)||q<POWER_RULES.qualityRange[0]||q>POWER_RULES.qualityRange[1])
      throw new Error(`quality ${q} out of [0.97,1.03]`);
    const power=rpiOf(rarity)*levelFactor(level)*q;
    if(!Number.isFinite(power))throw new Error('non-finite CardPower');
    return power;
  }
  function numericScale(power){return Math.sqrt(Math.max(0.01,Number(power))/POWER_RULES.numericScaleBase);}
  function generationBudget(power){return POWER_RULES.budgetBase*numericScale(power);}
  function splitBudget(budget){
    const b=Number(budget),p=POWER_RULES.budgetPartitions;
    const round=x=>Math.round(x*10)/10;
    return{primary:round(b*p.primary),secondary:round(b*p.secondary),activeSkills:round(b*p.activeSkills),passiveTrigger:round(b*p.passiveTrigger)};
  }
  NCB.POWER_RULES=POWER_RULES;
  NCB.levelFactor=levelFactor;
  NCB.computeCardPower=computeCardPower;
  NCB.numericScale=numericScale;
  NCB.generationBudget=generationBudget;
  NCB.splitBudget=splitBudget;
```

- [ ] **Step 4: Run full `tests/power.test.js` — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tests/power.test.js src/power.js
git commit -m "feat(power): LevelFactor + CardPower + GenerationBudget + partitions"
```

---

### Task 3: Deterministic QualityFactor from a seed string

**Files:**
- Modify: `src/power.js`
- Test: `tests/power.test.js:add`

**Interfaces:**
- Produces: `NCB.qualityFactor(seed)` — deterministic, returns a number in `[0.97,1.03]`, identical for the same seed, using a seeded Gen5PRNG (never `Math.random`).

- [ ] **Step 1: Write the failing test**

```js
test('qualityFactor is seeded-deterministic and in range',()=>{
  const N=load();
  const a=N.qualityFactor('A_ASSASSIN_20260901_000134');
  const b=N.qualityFactor('A_ASSASSIN_20260901_000134');
  assert.equal(a,b,'same seed must give same quality');
  assert.ok(a>=0.97&&a<=1.03,a);
  assert.notEqual(N.qualityFactor('X1'),N.qualityFactor('X2'),'different seeds differ');
  // many distinct stable draws stay inside range
  for(let i=0;i<200;i++){const q=N.qualityFactor('s'+i);assert.ok(q>=0.97&&q<=1.03,q);}
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement in `src/power.js`**

```js
  function qualityFactor(seed){
    // Derive a stable 16-bit seed from the seed string (deterministic, offline).
    let h=2166136261>>>0;
    for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    const sd=h>>>0;
    const prng=new NCB.Gen5PRNG(`gen5,${(sd>>>0)&0xffff},${(sd>>>16)&0xffff},1,2`);
    const lo=prng.random(9700,10301)/10000; // 0.97..1.03 with ~4 digits
    return lo;
  }
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(power): deterministic seeded qualityFactor"
```