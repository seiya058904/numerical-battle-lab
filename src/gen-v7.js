// Generator v7 — Stat-Only Numerical Battle.
//
// V7 cards carry only stats (no skills, statuses, triggers or resources). The
// world order is the frozen Strength Geometry: TargetTheta = LevelScore +
// RarityScore - anchor, so Level is the primary strength axis and Rarity the
// secondary. Seed produces a continuous, normalized allocation profile that
// spends the SAME total budget on a different stat shape.
//
//   Level + Rarity -> TargetTheta -> total budget B(theta)  (monotone)
//   Seed          -> normalized allocation weights w_i (continuous, no classes)
//   stat i        -> fill_i = min(1, (g * B * w_i / cost_i)^(1/p_i))
//                    with its own convex price curve cost_i * fill^p_i;
//                    the single global scale g is found by binary search so that
//                    sum(cost_i * fill_i^p_i) == B exactly (no per-card solver).
//
// Deterministic, content-only at runtime: never runs battles, never reads
// BattlePower, and never reads Level/Rarity/Seed back as a combat authority.
(function(root){
  'use strict';
  const N=root.NCB=root.NCB||{};
  const round=value=>Math.round(Number(value)*1e6)/1e6;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const clone=value=>JSON.parse(JSON.stringify(value));

  // ---- stat model: mid value at cost, convex price exponent p, soft bounds ----
  // value_i = mid_i * (g * B * w_i / cost_i)^(1/p_i), clipped to [min,max].
  // Primary axes (ATK, MAX_HP) use a low exponent (near-linear, strong level
  // scaling); secondary axes use higher exponents (diminishing, soft caps).
  const STAT_SPECS=[
    {key:'ATK',mid:320,cost:300,p:1.2,min:20,max:1600},
    {key:'MAX_HP',mid:6000,cost:300,p:1.2,min:400,max:30000},
    {key:'DEF',mid:110,cost:180,p:1.5,min:10,max:350},
    {key:'RES',mid:110,cost:180,p:1.5,min:10,max:350},
    {key:'SPD',mid:160,cost:150,p:1.5,min:30,max:350},
    {key:'ACC',mid:120,cost:90,p:1.4,min:50,max:180},
    {key:'EVA',mid:55,cost:90,p:1.4,min:0,max:120},
    {key:'CRIT',mid:40,cost:150,p:1.6,min:0,max:100},
    {key:'CRIT_DMG',mid:170,cost:120,p:1.5,min:100,max:280},
    {key:'PEN',mid:30,cost:150,p:1.6,min:0,max:90},
    {key:'RES_PEN',mid:30,cost:150,p:1.6,min:0,max:90},
    {key:'LIFESTEAL',mid:15,cost:200,p:1.7,min:0,max:40},
    {key:'HEAL_POWER',mid:110,cost:120,p:1.5,min:60,max:160},
    {key:'HEAL_TAKEN',mid:110,cost:100,p:1.5,min:60,max:160},
    {key:'HP_REGEN',mid:2,cost:300,p:1.8,min:0,max:5},
    {key:'BARRIER_POWER',mid:120,cost:150,p:1.6,min:0,max:300},
    {key:'VOLATILITY',mid:1.2,cost:60,p:1.4,min:.1,max:3},
    {key:'LUCK',mid:0,cost:45,p:1.5,min:-1,max:1},
    {key:'TOUGHNESS',mid:12,cost:240,p:1.8,min:0,max:30},
    {key:'CRIT_RES',mid:25,cost:150,p:1.7,min:0,max:60},
  ];
  const BUDGET_BASE=1260;             // B at TargetTheta 0 (Lv50 A)
  const BUDGET_GAIN=.146;             // B ~ exp(0.146*theta); bounded by soft caps

  function totalBudget(targetTheta){
    return Math.max(80,BUDGET_BASE*Math.exp(BUDGET_GAIN*targetTheta));
  }
  function allocationProfile(seed){
    const random=new N.Gen5PRNG(N.deriveSeed(N.seedHash(String(seed??'')+'|v7-stat-profile')));
    // Continuous, moderately narrow weights: every stat gets a real share while
    // shapes still differ strongly across seeds (no hardcoded classes).
    const raw=STAT_SPECS.map(()=>Math.pow(.55+.45*random.random(),1.7));
    const sum=raw.reduce((a,b)=>a+b,0)||1;
    return raw.map(value=>value/sum);
  }
  function statsFromFills(fills){
    const avgFill=fills.reduce((a,b)=>a+b,0)/Math.max(1,fills.length);
    const stats={};
    STAT_SPECS.forEach((spec,index)=>{
      let value=spec.mid*Math.pow(Math.max(0,fills[index]),1/spec.p);
      if(spec.key==='LUCK')value=clamp((fills[index]/Math.max(1e-9,avgFill)-1)*4,-1,1);
      value=clamp(value,spec.min,spec.max);
      if(spec.key==='VOLATILITY'||spec.key==='LUCK'||spec.key==='HP_REGEN')value=round(value*10)/10;
      stats[spec.key]=round(value);
    });
    return stats;
  }
  function fillsFromShares(shares,scale){
    return STAT_SPECS.map((spec,index)=>Math.max(0,shares[index]*scale));
  }
  function priceOf(fills){
    return STAT_SPECS.reduce((sum,spec,index)=>{
      const fill=Math.max(0,fills[index]);
      if(spec.key==='LUCK')return sum+spec.cost*fill; // LUCK has mid 0; price is linear in its share
      const raw=spec.mid*Math.pow(fill,1/spec.p);
      const value=clamp(raw,spec.min,spec.max);
      return sum+spec.cost*Math.pow(Math.max(1e-9,value)/spec.mid,spec.p);
    },0);
  }
  function allocate(budget,weights){
    const shares=weights.map(weight=>weight*budget);
    // find global scale g so that sum(price_i(g*share_i)) == budget
    const costOf=(g)=>priceOf(fillsFromShares(shares,g));
    let lo=0,hi=4,steps=0;
    while(costOf(hi)<budget&&steps++<60)hi*=2;
    for(let i=0;i<60;i++){
      const mid=(lo+hi)/2;
      if(costOf(mid)<budget)lo=mid;else hi=mid;
    }
    const g=(lo+hi)/2;
    const fills=fillsFromShares(shares,g);
    return {stats:statsFromFills(fills),scale:g,price:priceOf(fills)};
  }
  // The allowed one-dimensional global correction: after price-based allocation
  // all fills are scaled together so the card's GeneralPower lands exactly on the
  // tier's canonical GeneralPower. Every seed at a given Level/Rarity is thereby
  // analytically iso-power while keeping its stat shape (diversity preserved).
  function canonicalGeneralPower(budget){
    const uniform=STAT_SPECS.map(()=>1/STAT_SPECS.length);
    const {stats}=allocate(budget,uniform);
    return N.generalStrengthV7({stats}).generalPower;
  }
  function applyPowerCorrection(budget,weights){
    const base=allocate(budget,weights);
    const target=canonicalGeneralPower(budget);
    const shares=weights.map(weight=>weight*budget);
    const gpOf=fills=>N.generalStrengthV7({stats:statsFromFills(fills)}).generalPower;
    let lo=.02,hi=4;
    for(let i=0;i<60;i++){
      const mid=(lo+hi)/2;
      if(gpOf(fillsFromShares(shares,base.scale*mid))<target)lo=mid;else hi=mid;
    }
    const m=(lo+hi)/2;
    const fills=fillsFromShares(shares,base.scale*m);
    const stats=statsFromFills(fills);
    return {stats,price:priceOf(fills),scale:base.scale*m,powerCorrection:m,targetGeneralPower:target,
      generalPower:gpOf(fills)};
  }

  function generateCardV7(opts={}){
    if('archetype' in opts)throw new Error('Generator v7 is stat-only and classless: archetype is not a valid input');
    const seed=String(opts.seed??''),rarity=N.toV2RarityId(opts.rarity),level=N.normalizeLevel(opts.level);
    const targetTheta=N.targetThetaV7(level,rarity);
    const budget=totalBudget(targetTheta);
    const weights=allocationProfile(seed);
    const result=applyPowerCorrection(budget,weights);
    const identity=`v7|seed=${seed}|rarity=${rarity}|level=${level}`;
    const card={
      id:N.cardId(identity),identity,seed,rarity,level,generatorVersion:7,
      stats:result.stats,
      targetTheta:round(targetTheta),budget:round(budget),powerScale:round(result.scale,4),powerCorrection:round(result.powerCorrection,4),
    };
    card.name=typeof N.generateSpeciesName==='function'?N.generateSpeciesName(card):seed;
    card.displayName=card.name;
    card.strengthModel={version:7,generalPower:round(result.generalPower,2),battlePower:Math.round(N.battlePowerV7(card))};
    card.presentation={power:card.strengthModel.battlePower};
    card.power=card.strengthModel.battlePower;
    return card;
  }
  Object.assign(N,{STAT_SPECS_V7:STAT_SPECS.map(spec=>({...spec})),
    v7TotalBudget:totalBudget,v7AllocationProfile:allocationProfile,v7CanonicalGeneralPower:canonicalGeneralPower,
    generateCardV7,CARD_GENERATOR_VERSION_V7:7});
  if(typeof module!=='undefined')module.exports=N;
})(typeof globalThis!=='undefined'?globalThis:window);


