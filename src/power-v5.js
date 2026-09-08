// Power Envelope v1 — Level × Rarity strength system for Generator v5.
//
// Architecture of strength (the single source of truth for v5 budgets):
//
//   Level  -> overall numerical magnitude the card lives at (LevelScale).
//   Rarity -> the min/max of comprehensive strength allowed AT that level
//             (PowerEnvelope). Higher rarity = strictly higher allowed band.
//   Seed   -> only a deterministic position INSIDE the rarity envelope
//             (quality percentile), plus which mechanics the card rolls.
//   Mechanics -> how the card spends that strength (style / matchup / upset).
//   BattlePower -> a real estimator of the actual card's comprehensive value
//             (see battlepower-v3.js); it must land inside the envelope because
//             the generator bakes the envelope target into real numbers, never
//             because the display clamps or looks up rarity.
//
// HARD INVARIANT: for a fixed Lv, the rarity bands are strictly disjoint and
// ascending:
//     max(lower rarity) < min(next rarity)
// so a low-rarity card can never be generated with real comprehensive strength
// above a higher-rarity card's band at the same level.
(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};

  // ---- LevelScale (user-specified, authoritative) ----
  // LevelScale(L) = 0.10 + 0.90 * ((L-1)/99)^0.95
  // Lv1≈0.10, Lv10≈0.19, Lv25≈0.33, Lv50≈0.56, Lv75≈0.78, Lv100=1.00
  function levelScale(level){
    const L=NCB.normalizeLevel(level);
    const t=(L-1)/99;
    return 0.10+0.90*Math.pow(t,0.95);
  }

  // Lv100 comprehensive-power bands per rarity (strict disjoint ascending).
  // These are the calibrated, authoritative coordinates for the whole system.
  // Entry order must match NCB.RARITY_V2_ORDER exactly.
  const RARITY_V2_ENVELOPE_LV100=[
    ['C',            1000,1040],
    ['C_PLUS',       1050,1100],
    ['B',            1110,1160],
    ['B_PLUS',       1170,1230],
    ['A',            1240,1300],
    ['A_PLUS',       1310,1380],
    ['S',            1390,1460],
    ['SS',           1470,1540],
    ['SSS',          1550,1620],
    ['SSS_COLLECTOR',1630,1690],
    ['XS',           1700,1760],
    ['XS_COLLECTOR', 1770,1840],
  ];
  const ENVELOPE={};
  for(const [id,lo,hi] of RARITY_V2_ENVELOPE_LV100)ENVELOPE[id]={min:lo,max:hi};
  // Keep the human display names for docs/UI tables.
  const RARITY_V2_ENVELOPE_LV100_BY_ID=Object.freeze(ENVELOPE);

  // PowerEnvelope(level, rarity) -> {min, target, max}
  //   min/max = Lv100 band × LevelScale(level)  (the comprehensive-strength scale)
  //   target  = midpoint of the band at that level (calibration anchor).
  function powerEnvelope(level,rarity){
    const lv=NCB.normalizeLevel(level);
    const id=NCB.toV2RarityId(rarity);
    const band=RARITY_V2_ENVELOPE_LV100_BY_ID[id];
    if(!band)throw new Error('unknown rarity: '+id);
    const s=levelScale(lv);
    const min=band.min*s,max=band.max*s,target=(band.min+band.max)/2*s;
    return {min,target,max};
  }
  // Level at which a Lv100 min would exceed another band's Lv100 max — not used,
  // kept here only to state the invariant in code.
  function bandsStrictlyDisjoint(){ // proof helper used by tests
    for(let i=1;i<RARITY_V2_ENVELOPE_LV100.length;i++){
      const prev=RARITY_V2_ENVELOPE_LV100[i-1],cur=RARITY_V2_ENVELOPE_LV100[i];
      if(!(prev[2]<cur[1]))return false;
    }
    return true;
  }

  // deterministicQualityPercentile(seed) -> [0,1], fully seed-deterministic.
  // This is the ONLY place a seed moves a card within its rarity band. It must
  // never be large enough to escape the band (it can't by construction — the
  // band is fixed and only this lerp index changes).
  function deterministicQualityPercentile(seed){
    const h=NCB.seedHash(String(seed==null?'':seed)+':v5quality');
    const prng=new NCB.Gen5PRNG('gen5,'+((h>>>0)&0xffff)+','+((h>>>16)&0xffff)+',9,7');
    return prng.random(); // 0..1
  }
  // deterministicTargetPower(level,rarity,seed) = a deterministic point strictly
  // INSIDE the rarity band. The quality percentile is mapped into an inner range
  // (5%..95% of the band) so the converged integer BattlePower stays robustly
  // within [min,max] after rounding — the calibration is real (no clamp), and a
  // card is never accidentally pushed to/below its own band minimum or above its
  // band maximum.
  function targetPower(level,rarity,seed){
    const env=powerEnvelope(level,rarity);
    const q=deterministicQualityPercentile(seed);
    const spread=env.max-env.min;
    const pos=0.05+0.90*q; // inner fraction of the band
    return Math.round((env.min+spread*pos)*100)/100;
  }

  NCB.LEVEL_SCALE_VERSION=1;
  NCB.POWER_ENVELOPE_VERSION=1;
  NCB.RARITY_V2_ENVELOPE_LV100=RARITY_V2_ENVELOPE_LV100_BY_ID;
  NCB.levelScale=levelScale;
  NCB.powerEnvelope=powerEnvelope;
  NCB.bandsStrictlyDisjoint=bandsStrictlyDisjoint;
  NCB.deterministicQualityPercentile=deterministicQualityPercentile;
  NCB.targetPower=targetPower;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);