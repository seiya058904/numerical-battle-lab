// Budget v6 — Total Strength Budget Contract for Generator v6.
//
// The v6 product definition (max constraint):
//   Level + Rarity  ==>  HOW MUCH total strength ("实力").
//   Seed            ==>  WHAT FORM that strength takes (allocation / style).
//   Mechanics       ==>  how the strength plays out (matchup / upset).
//
// THIS FILE is the single source of truth for the total-strength budget. Seed
// may only RE-AL LOCATE a fixed total; it can never change the total. A card is
// therefore bounded to its (Level × Rarity) strength tier by construction, not
// by post-hoc stat-scaling of an already over-budget structure.
//
// ExpectedStrength(level,rarity) = LevelScale(level) × RarityStrengthScale(rarity)
//   Lv100 anchor: C=1.00 ... XS_COLLECTOR=12.00 (WIDENED vs the narrow v5 BP band,
//   so large rarity gaps yield large real budget gaps -> real win dominance).
//
// Two independent layers stay separate (no self-fulfilling audit):
//   1. budget-price.js   — prices mechanics for GENERATION (this file's currency).
//   2. battlepower-v3.js — independent static MEASUREMENT (reads real numbers).
//   3. empirical audits  — the Reality layer.
(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};

  // ---- LevelScale (v6) ----
  // Lv1≈0.10, Lv10≈0.19, Lv25≈0.34, Lv50≈0.57, Lv75≈0.80, Lv100=1.00.
  // Clear perceptual separation at every quarter. A card below Lv50 is clearly
  // weaker than a card above Lv50 because the TOTAL budget (not just BP) is lower.
  function levelScale(level){
    const L=NCB.normalizeLevel(level);
    const t=(L-1)/99;
    return 0.10+0.90*Math.pow(t,0.95);
  }

  // ---- RarityStrengthScale (v6, WIDENED) ----
  // Canonical Lv100 total-strength multiplier per rarity (entry order must match
  // NCB.RARITY_V2_ORDER). C=1.00 ... XS_COLLECTOR=12.00. This is the total-strength
  // currency of a card: a C and an XS_COLLECTOR at the same level differ by 12x
  // REAL available strength, not just a display band.
  const RARITY_STRENGTH_LV100=[
    ['C',             1.00],
    ['C_PLUS',        1.30],
    ['B',             1.70],
    ['B_PLUS',        2.20],
    ['A',             2.80],
    ['A_PLUS',        3.50],
    ['S',             4.40],
    ['SS',            5.50],
    ['SSS',           6.80],
    ['SSS_COLLECTOR', 8.30],
    ['XS',           10.00],
    ['XS_COLLECTOR', 12.00],
  ];
  const RARITY_STRENGTH={};
  for(const [id,v] of RARITY_STRENGTH_LV100)RARITY_STRENGTH[id]=v;

  function rarityStrengthScale(rarity){
    const id=NCB.toV2RarityId(rarity);
    const v=RARITY_STRENGTH[id];
    if(v===undefined)throw new Error('unknown rarity: '+id);
    return v;
  }

  // ---- ExpectedStrength(level,rarity) ----
  // Positive monotone in level and rarity; the pre-generation strength tier.
  // STRENGTH_ANCHOR maps the dimensionless curve to the strength-unit currency that
  // budget-price.js prices in: Lv100 C == 1000 units (the documented reference
  // anchor). Rarity WIDENS multiplicatively: Lv100 XS_COLLECTOR == 12000 units, so
  // large rarity gaps are large REAL budget gaps (not the narrow 1840 of v5 BP).
  const STRENGTH_ANCHOR=1000;
  function expectedStrength(level,rarity){
    const lv=NCB.normalizeLevel(level);
    const id=NCB.toV2RarityId(rarity);
    const s=STRENGTH_ANCHOR*levelScale(lv)*rarityStrengthScale(id);
    if(!Number.isFinite(s)||s<=0)throw new Error('non-finite ExpectedStrength');
    return Math.round(s*100)/100;
  }

  // ---- Budget category allocation ----
  // Seed splits `total` across 8 spend categories with the constraint that the
  // shares always sum to `total`. Re-allocation only; the total never changes.
  // `flavor` is a code-path salt so different random aspects use different streams.
  const CATEGORIES=['offense','durability','sustain','control','tempo','economy','reliability','triggers'];
  function seededPRNG(seed,salt){
    const h=NCB.seedHash(String(seed==null?'':seed)+':'+salt);
    return new NCB.Gen5PRNG('gen5,'+((h>>>0)&0xffff)+','+((h>>>16)&0xffff)+',6,6');
  }
  // Returns { shares:{offense,defense,...}, total } where sum(shares)==total.
  function allocateBudget(total,seed,salt){
    const prng=seededPRNG(seed,'budget:'+(salt||'classless'));
    // A bounded heavy-tailed profile: extreme builds occur, but no category may
    // consume the whole card and every card retains enough reliability to function.
    // The 0.15 floor keeps normalized shares above 2%; the cubic tail still
    // permits a dominant category around 50% without producing 99/1 builds.
    let profile=CATEGORIES.map(()=>0.15+Math.pow(prng.random(),3));
    const sumW=profile.reduce((a,b)=>a+b,0);
    profile=profile.map(v=>v/sumW);
    const shares={};
    let acc=0;
    for(let i=0;i<CATEGORIES.length;i++){
      const share=i===CATEGORIES.length-1
        ? (total-acc)                       // last takes the exact remainder
        : Math.round(total*profile[i]*10)/10;
      shares[CATEGORIES[i]]=share;
      acc+=share;
    }
    // force exact: last category absorbs the rounding residual (could be tiny negative)
    if(shares[CATEGORIES[CATEGORIES.length-1]]<0){
      // shift from a well-endowed category to keep it non-negative
      const rich=CATEGORIES.reduce((best,c)=>shares[c]>shares[best]?c:best,CATEGORIES[0]);
      const need=-shares[CATEGORIES[CATEGORIES.length-1]];
      shares[rich]-=need;shares[CATEGORIES[CATEGORIES.length-1]]=0;
    }
    const normalized={};for(let i=0;i<CATEGORIES.length;i++)normalized[CATEGORIES[i]]=profile[i];
    return {shares,total,profile:normalized};
  }

  // ---- ledger type helpers ----
  function emptyLedger(total){
    const spent={};for(const c of CATEGORIES)spent[c]=0;
    return {totalBudget:total,expectedStrength:total,spent,unspent:total,overBudget:0,calibrationDelta:0,version:6};
  }
  function closeLedger(ledger){
    ledger.unspent=Math.round((ledger.totalBudget-Object.values(ledger.spent).reduce((a,b)=>a+b,0))*100)/100;
    ledger.overBudget=Math.round(Math.max(0,-ledger.unspent)*100)/100;
    ledger.unspent=Math.max(0,ledger.unspent);
    return ledger;
  }

  NCB.BUDGET_V6_VERSION=6;
  NCB.STRENGTH_ANCHOR_V6=STRENGTH_ANCHOR;
  NCB.CATEGORIES=CATEGORIES.slice();
  NCB.LEVEL_SCALE_V6=levelScale;
  NCB.RARITY_STRENGTH_LV100=Object.freeze({...RARITY_STRENGTH});
  NCB.rarityStrengthScaleV6=rarityStrengthScale;
  NCB.expectedStrengthV6=expectedStrength;
  NCB.allocateBudgetV6=allocateBudget;
  NCB.budgetLedgerV6=emptyLedger;
  NCB.closeBudgetLedgerV6=closeLedger;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
