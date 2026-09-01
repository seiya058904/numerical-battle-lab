# Sub-Plan 2: Archetype + Primary/Secondary Stat Allocation

**Goal:** Allocate Primary/Secondary stat budgets into stats via Archetype weights + seeded jitter (normalized), then convert BP to stats via a registry conversion table.

**Architecture:** `src/gen-stats.js` (IIFE) depends on `kernel.js` and `power.js`. Exposes ARCHETYPES, PRIMARY_CONVERSION, SECONDARY_BASELINE/COST/BOUNDS, allocatePrimary, allocateSecondary, registerArchetype. Tests: `tests/gen-stats.test.js`; load order kernel -> power -> gen-stats.

## Constraints (spec 9-16, verbatim)
- PRIMARY_STAT_LIST=[MAX_HP,ATK,DEF,RES,SPD]; no bespoke duplicate attack/magic stats.
- Conv: MAX_HP=600+BP*30; ATK=60+BP*3; DEF=40+BP*2; RES=40+BP*2; SPD=85+BP*0.3.
- Archetype weights sum to 1; registerArchetype for future plugins.
- Jitter U(-12%,+12%) per stat, renormalize to sum 1 before converting to BP; total primary budget unchanged by jitter.
- Secondary baselines (percent): ACC=88 EVA=3 CRIT=5 CRIT_DMG=140 PEN=0 RES_PEN=0 HEAL_POWER=100 HEAL_TAKEN=100 SHIELD_POWER=100 STATUS_POWER=100 STATUS_RESIST=0 LIFESTEAL=0 REFLECT=0 RESOURCE_GAIN=100 RESOURCE_COST_MULT=100 COOLDOWN_RATE=100.
- Cost per +1% (BP): ACC=2 EVA=4 CRIT=3 CRIT_DMG=1 PEN=2.5 RES_PEN=2.5 HEAL_POWER=1.5 HEAL_TAKEN=2 SHIELD_POWER=1.5 STATUS_POWER=1.5 STATUS_RESIST=2 LIFESTEAL=3 REFLECT=4.
- Bounds: ACC[50,99] EVA[0,40] CRIT[0,60] CRIT_DMG[125,250] PEN[0,60] RES_PEN[0,60] LIFESTEAL[0,50] REFLECT[0,40]. No stat may exceed its bound.

## Task 1: ARCHETYPES + PRIMARY_CONVERSION + registerArchetype
**Files:** Create `src/gen-stats.js`; Test `tests/gen-stats.test.js`.
**Produces:** NCB.PRIMARY_STAT_LIST, NCB.ARCHETYPES, NCB.PRIMARY_CONVERSION, NCB.registerArchetype.

- [ ] Step 1: failing test (tests/gen-stats.test.js):
```js
const test=require('node:test');const assert=require('node:assert/strict');
function load(){global.NCB={};require('../src/kernel.js');require('../src/power.js');require('../src/gen-stats.js');return global.NCB;}
const SPEC={Balanced:{MAX_HP:.30,ATK:.25,DEF:.18,RES:.18,SPD:.09},Tank:{MAX_HP:.38,ATK:.14,DEF:.22,RES:.20,SPD:.06},Bruiser:{MAX_HP:.31,ATK:.29,DEF:.16,RES:.14,SPD:.10},Assassin:{MAX_HP:.20,ATK:.35,DEF:.10,RES:.08,SPD:.27},Mage:{MAX_HP:.23,ATK:.34,DEF:.08,RES:.17,SPD:.18},Support:{MAX_HP:.30,ATK:.14,DEF:.14,RES:.20,SPD:.22},Controller:{MAX_HP:.27,ATK:.17,DEF:.12,RES:.18,SPD:.26}};
test('archetypes match spec, sum to 1; registerArchetype extends',()=>{const N=load();assert.deepEqual(N.PRIMARY_STAT_LIST,['MAX_HP','ATK','DEF','RES','SPD']);for(const[id,w]of Object.entries(SPEC)){assert.ok(N.ARCHETYPES[id]);const s=N.PRIMARY_STAT_LIST.reduce((a,x)=>a+(N.ARCHETYPES[id][x]||0),0);assert.ok(Math.abs(s-1)<1e-9,id+' sum '+s);for(const x of N.PRIMARY_STAT_LIST)assert.ok(Math.abs((N.ARCHETYPES[id][x]||0)-(w[x]||0))<1e-9);}N.registerArchetype('Zombie',{MAX_HP:.5,ATK:.1,DEF:.1,RES:.2,SPD:.1});assert.ok(N.ARCHETYPES.Zombie);});
test('primary conversion matches spec',()=>{const N=load();const c=N.PRIMARY_CONVERSION;assert.equal(c.MAX_HP(0),600);assert.equal(c.MAX_HP(10),900);assert.equal(c.ATK(0),60);assert.equal(c.ATK(10),90);assert.equal(c.DEF(0),40);assert.equal(c.DEF(10),60);assert.equal(c.RES(0),40);assert.equal(c.RES(10),60);assert.equal(c.SPD(0),85);assert.equal(c.SPD(50),100);});
```
- [ ] Step 2: run `node --test tests/gen-stats.test.js` -> FAIL (module missing)
- [ ] Step 3: implement `src/gen-stats.js`:
```js
(function(root){'use strict';const NCB=root.NCB=root.NCB||{};
const PRIMARY_STAT_LIST=['MAX_HP','ATK','DEF','RES','SPD'];
const ARCHETYPES={Balanced:{MAX_HP:.30,ATK:.25,DEF:.18,RES:.18,SPD:.09},Tank:{MAX_HP:.38,ATK:.14,DEF:.22,RES:.20,SPD:.06},Bruiser:{MAX_HP:.31,ATK:.29,DEF:.16,RES:.14,SPD:.10},Assassin:{MAX_HP:.20,ATK:.35,DEF:.10,RES:.08,SPD:.27},Mage:{MAX_HP:.23,ATK:.34,DEF:.08,RES:.17,SPD:.18},Support:{MAX_HP:.30,ATK:.14,DEF:.14,RES:.20,SPD:.22},Controller:{MAX_HP:.27,ATK:.17,DEF:.12,RES:.18,SPD:.26}};
const PRIMARY_CONVERSION={MAX_HP:bp=>600+Number(bp)*30,ATK:bp=>60+Number(bp)*3,DEF:bp=>40+Number(bp)*2,RES:bp=>40+Number(bp)*2,SPD:bp=>85+Number(bp)*0.3};
function registerArchetype(id,weights){if(!id)throw new Error('archetype id required');if(!weights||typeof weights!=='object')throw new Error('archetype weights required');ARCHETYPES[id]={...weights};return ARCHETYPES[id];}
NCB.PRIMARY_STAT_LIST=PRIMARY_STAT_LIST.slice();NCB.ARCHETYPES=ARCHETYPES;NCB.PRIMARY_CONVERSION=PRIMARY_CONVERSION;NCB.registerArchetype=registerArchetype;
if(typeof module!=='undefined')module.exports=NCB;})(typeof globalThis!=='undefined'?globalThis:window);
```
- [ ] Step 4: run `node --test tests/gen-stats.test.js` -> PASS
- [ ] Step 5: commit `feat(gen): archetype registry + primary conversion`

## Task 2: allocatePrimary (seeded jitter + normalization + conversion)
**Files:** Modify `src/gen-stats.js`; Test `tests/gen-stats.test.js`.
**Produces:** `NCB.allocatePrimary({budget,archetype,seed})` -> `{statBP:{...}, stats:{MAX_HP,ATK,DEF,RES,SPD}, weights:{final}}`.

- [ ] Step 1: failing test
```js
test('allocatePrimary is seeded-deterministic, preserves total budget, honors archetype shape',()=>{
  const N=load();
  const a=N.allocatePrimary({budget:520,archetype:'Assassin',seed:'A1'});
  const b=N.allocatePrimary({budget:520,archetype:'Assassin',seed:'A1'});
  assert.deepEqual(a.statBP,b.statBP,'same seed same distribution');
  const tot=N.PRIMARY_STAT_LIST.reduce((s,x)=>s+a.statBP[x],0);
  assert.ok(Math.abs(tot-520)<3,'primary BP should ~equal budget, got '+tot);
  // assassin: ATK+SPD share should exceed defense share
  assert.ok(a.statBP.ATK>a.statBP.DEF,'assassin ATK('+a.statBP.ATK+')>DEF('+a.statBP.DEF+')');
  assert.ok(a.stats.ATK>=60&&a.stats.MAX_HP>=600);
  // jitter only reallocates, never changes the pool
  const c=N.allocatePrimary({budget:520,archetype:'Assassin',seed:'different'});
  const totC=N.PRIMARY_STAT_LIST.reduce((s,x)=>s+c.statBP[x],0);
  assert.ok(Math.abs(totC-520)<3);
});
test('allocatePrimary rejects unknown archetype',()=>{const N=load();assert.throws(()=>N.allocatePrimary({budget:100,archetype:'Nope',seed:'s'}),/unknown archetype/);});
```
- [ ] Step 2: run -> new tests FAIL
- [ ] Step 3: implement allocatePrimary (append to src/gen-stats.js):
```js
function allocatePrimary({budget,archetype,seed}){
  const w=ARCHETYPES[archetype];if(!w)throw new Error('unknown archetype: '+archetype);
  const prng=new NCB.Gen5PRNG(deterministicSeed(seed));
  let raw={};let sum=0;
  for(const s of PRIMARY_STAT_LIST){const j=1+(prng.random(-1200,1201)/10000);raw[s]=(w[s]||0)*j;sum+=raw[s];}
  const weight={};for(const s of PRIMARY_STAT_LIST)weight[s]=raw[s]/sum;
  const statBP={};for(const s of PRIMARY_STAT_LIST)statBP[s]=Math.round(Number(budget)*weight[s]);
  // fix rounding so BP sum equals budget exactly
  const diff=Math.round(Number(budget))-PRIMARY_STAT_LIST.reduce((x,s)=>x+statBP[s],0);statBP[PRIMARY_STAT_LIST[0]]+=diff;
  const stats={};for(const s of PRIMARY_STAT_LIST)stats[s]=PRIMARY_CONVERSION[s](statBP[s]);
  return{statBP,stats,weights:weight};
}
function deterministicSeed(seed){let h=2166136261>>>0;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return 'gen5,'+((h>>>0)&0xffff)+','+((h>>>16)&0xffff)+','+1+','+2;}
```
- [ ] Step 4: run `node --test tests/gen-stats.test.js` -> PASS
- [ ] Step 5: commit `feat(gen): allocatePrimary seeded jitter`

## Task 3: allocateSecondary (cost table + bounds)
**Files:** Modify src/gen-stats.js; Test tests/gen-stats.test.js.
**Produces:** NCB.SECONDARY_BASELINE, NCB.SECONDARY_COST, NCB.SECONDARY_BOUNDS, NCB.allocateSecondary({budget,seed}).
- [ ] Step 1: failing test
```js
test('allocateSecondary uses cost table, stays within bounds, is deterministic',()=>{
  const N=load();
  const o1=N.allocateSecondary({budget:130,seed:'S1'});
  const o2=N.allocateSecondary({budget:130,seed:'S1'});
  assert.deepEqual(o1,o2,'deterministic');
  const b=N.SECONDARY_BOUNDS;
  for(const k in o1.seconds){const v=o1.seconds[k];assert.ok(v>=b[k][0]-1e-6&&v<=b[k][1]+1e-6,k+'='+v+' bounds '+b[k]);}
  const base=N.SECONDARY_BASELINE;
  for(const k in base)if(!(k in o1.seconds))assert.equal(o1.seconds[k],base[k],k+' baseline');
});
test('secondary cost table matches spec',()=>{const N=load();assert.equal(N.SECONDARY_COST.ACC,2);assert.equal(N.SECONDARY_COST.CRIT,3);assert.equal(N.SECONDARY_COST.LIFESTEAL,3);assert.equal(N.SECONDARY_COST.REFLECT,4);});
```
- [ ] Step 2: run -> FAIL
- [ ] Step 3: implement (append to src/gen-stats.js): SECONDARY_BASELINE/COST/BOUNDS tables verbatim, then allocateSecondary:
```js
function allocateSecondary({budget,seed}){
  const prng=new NCB.Gen5PRNG(deterministicSeed('sec:'+seed));
  const out={};const keys=Object.keys(SECONDARY_BASELINE);
  for(const k of keys)out[k]=SECONDARY_BASELINE[k];
  let remaining=Math.max(0,Number(budget));
  // Greedy: repeatedly buy incremental +1% batches for a random affordable axis (bounded), until budget exhausted.
  const order=keys.slice().sort(()=>0);
  let guard=0;
  while(remaining>0&&guard++<4000){
    const affordable=keys.filter(k=>{const cost=SECONDARY_COST[k];if(!cost)return false;const next=out[k]+1;return next<=SECONDARY_BOUNDS[k][1]&&cost<=remaining;});
    if(!affordable.length)break;
    const pick=affordable[prng.random(affordable.length)];
    out[pick]+=1;remaining-=SECONDARY_COST[pick];
  }
  // round 100-around axes to 1 decimal
  for(const k of keys)out[k]=Math.round(out[k]*10)/10;
  return{seconds:out,spent:Number(budget)-remaining};
}
```
- [ ] Step 4: run `node --test tests/gen-stats.test.js` -> PASS (note: greedy may exhaust before bounds on tiny budgets; test asserts within bounds, safe)
- [ ] Step 5: commit `feat(gen): allocateSecondary cost table + bounds`
