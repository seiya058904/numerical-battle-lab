const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','card-ui'])require('../src/'+f+'.js');
const N=global.NCB;

// ExpectedStrength is the Level × Rarity strength anchor: strictly monotone in
// both level and rarity (this is what makes Level/Rarity dominate, by construction).
test('v6 ExpectedStrength is monotone in rarity at fixed level',()=>{
  let prev=-1;
  for(const r of N.RARITY_V2_ORDER){
    const v=N.expectedStrengthV6(50,r);
    assert.ok(v>prev,`ExpectedStrength(50,${r})=${v} not > ${prev}`);
    prev=v;
  }
});
test('v6 ExpectedStrength is monotone in level at fixed rarity',()=>{
  let prev=-1;
  for(const L of [1,10,25,50,75,100]){
    const v=N.expectedStrengthV6(L,'A');
    assert.ok(v>prev,`ExpectedStrength(${L},A)=${v} not > ${prev}`);
    prev=v;
  }
  assert.ok(N.expectedStrengthV6(100,'A')>=N.expectedStrengthV6(1,'A')*8, 'Lv100 must be far above Lv1');
});

// The budget contract must close: total must equal the allocated (no free strength).
test('v6 budget allocation sums exactly to total',()=>{
  for(const seed of ['bd-a','bd-b','bd-c']){
    const {shares,total}=N.allocateBudgetV6(1000,seed,'x');
    const sum=Object.values(shares).reduce((a,b)=>a+b,0);
    assert.ok(Math.abs(sum-total)<0.05,`shares ${sum} != total ${total} for ${seed}`);
  }
});

// Generated card: budget contract fields present, id/fingerprint deterministic, finite.
test('v6 generation: stable identity, budget contract, finite numbers',()=>{
  const a=N.generateCardV6({seed:'det-v6',rarity:'A',level:50});
  const b=N.generateCardV6({seed:'det-v6',rarity:'A',level:50});
  assert.equal(a.id,b.id);
  assert.equal(a.mechanicFingerprint,b.mechanicFingerprint);
  assert.equal(a.generatorVersion,6);
  assert.equal(a.generationStrengthBudget,b.generationStrengthBudget);
  assert.ok(Number.isFinite(a.stats.ATK)&&a.stats.ATK>0);
  assert.ok(Number.isFinite(a.stats.MAX_HP)&&a.stats.MAX_HP>0);
  assert.ok(a.strengthLedger&&a.strengthLedger.totalBudget===a.generationStrengthBudget);
  assert.ok(Number.isFinite(N.battlePowerV3(a).power)&&N.battlePowerV3(a).power>0);
});

// Structural invariance: same seed, changing level/rarity keeps mechanic fingerprint.
test('v6 structural invariance across level and rarity',()=>{
  for(const seed of ['vi-a','vi-b']){
    const base=N.generateCardV6({seed,rarity:'C',level:25});
    const hi=N.generateCardV6({seed,rarity:'XS_COLLECTOR',level:100});
    assert.equal(base.mechanicFingerprint,hi.mechanicFingerprint,'same seed must preserve exact mechanic topology');
    assert.equal(base.name,hi.name,'Naming V3 must depend on seed, not tier');
    assert.equal(base.generatorVersion,6);
    assert.equal(hi.generatorVersion,6);
    assert.ok(hi.strengthLedger.totalBudget>base.strengthLedger.totalBudget, 'higher tier must have larger budget');
    assert.ok(hi.strengthLedger.totalBudget>base.strengthLedger.totalBudget*1.5,'budget gap must be material');
  }
});

test('v6 generation is pure and never invokes battle, AI, or BattlePower measurement',()=>{
  const blocked=['createBattle','planAI','battlePowerV3'];
  const saved=Object.fromEntries(blocked.map(key=>[key,N[key]]));
  for(const key of blocked)N[key]=()=>{throw new Error('forbidden generation dependency: '+key);};
  try{
    const card=N.generateCardV6({seed:'pure-v6',rarity:'A',level:50});
    assert.equal(card.generatorVersion,6);
    assert.ok(card.actions.length>=2);
  } finally {for(const key of blocked)N[key]=saved[key];}
});

test('v6 generated allocation is diverse, normalized, and reconciled within five percent',()=>{
  const cards=Array.from({length:24},(_,i)=>N.generateCardV6({seed:'allocation-'+i,rarity:'A',level:50}));
  const profiles=new Set();
  const panels=new Set();
  for(const card of cards){
    const profile=card.allocationProfile;
    assert.ok(profile&&Object.keys(profile).length>=7);
    assert.ok(Math.abs(Object.values(profile).reduce((a,b)=>a+b,0)-1)<0.002);
    for(const value of Object.values(profile))assert.ok(value>=0.02&&value<=0.55,`bounded allocation share ${value}`);
    profiles.add(Object.values(profile).map(v=>v.toFixed(3)).join(','));
    panels.add(['ATK','MAX_HP','DEF','RES','SPD'].map(key=>card.stats[key]).join(','));
    const priced=N.budgetPriceCardV6(card).total;
    const deviation=Math.abs(priced-card.expectedStrength)/card.expectedStrength;
    assert.ok(deviation<=0.05,`priced ${priced}, expected ${card.expectedStrength}, deviation ${deviation}`);
  }
  assert.ok(profiles.size>=20,'seed must materially vary allocation profiles');
  assert.ok(panels.size>=16,'same-tier primary panels must materially vary');
});

test('v6 reconciliation reaches extreme high-tier utility builds without weakening the contract',()=>{
  const card=N.generateCardV6({seed:'nk-audit-v6-2855',rarity:'XS_COLLECTOR',level:85});
  const priced=N.budgetPriceCardV6(card).total;
  assert.ok(Math.abs(priced-card.expectedStrength)/card.expectedStrength<=.05,`${priced} vs ${card.expectedStrength}`);
});

test('v6 viability is a constraint, not a universal two-strike template',()=>{
  const cards=Array.from({length:30},(_,i)=>N.generateCardV6({seed:'victory-path-'+i,rarity:'A',level:50}));
  assert.ok(cards.some(card=>!card.actions.some(a=>a.name==='突袭')||!card.actions.some(a=>a.name==='重击')),
    'not every card may contain both canonical fighter strikes');
  assert.ok(cards.every(card=>JSON.stringify({actions:card.actions,statuses:card.statuses,triggers:card.triggers}).includes('damage')||JSON.stringify(card.actions).includes('consumeStatus')),
    'every card needs a deterministic path to victory');
});

// Independent measurement: the estimator is independent of the budget model (different math).
test('v6 battlePowerV3 is an independent estimator that rises with real numbers',()=>{
  const c=N.generateCardV6({seed:'indep',rarity:'B',level:50});
  const base=N.battlePowerV3(c).power;
  const hi=JSON.parse(JSON.stringify(c));hi.stats.ATK*=3;hi.stats.MAX_HP*=2;
  assert.ok(N.battlePowerV3(hi).power>base,'stronger numbers must raise BP');
});

test('v6 is the normal generator default while v5 remains explicit legacy',()=>{
  const normal=N.generateCard({seed:'default-v6',rarity:'A',level:50});
  const dispatched=N.generateCardByVersion({seed:'default-v6-dispatch',rarity:'A',level:50});
  assert.equal(normal.generatorVersion,6);
  assert.equal(dispatched.generatorVersion,6);
  const legacyA=N.generateCardByVersion({seed:'legacy-v5',rarity:'A',level:50,generatorVersion:5});
  const legacyB=N.generateCardV5({seed:'legacy-v5',rarity:'A',level:50,generatorVersion:5});
  assert.deepEqual(legacyA,legacyB);
});

test('v6 cards use BattlePower v3 only at the presentation boundary',()=>{
  const card=N.generateCard({seed:'v6-ui-power',rarity:'A',level:50});
  assert.equal(N.battlePowerOf(card),Math.round(N.battlePowerV3(card).power));
});
