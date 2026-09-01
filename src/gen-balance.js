(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  // ExpectedWin(A,B) = PA^3 / (PA^3 + PB^3)  (spec 3). Reference line for MC calibration,
  // NOT a hard per-matchup requirement. P is a side's comprehensive Power (e.g. RARITY_RPI).
  function expectedWinRate(pA,pB){
    const a=Math.max(0,Number(pA)),b=Math.max(0,Number(pB));
    if(!Number.isFinite(a)||!Number.isFinite(b))throw new Error('non-finite power in expectedWinRate');
    if(a===0&&b===0)return 0.5;
    if(a===0)return 0;
    if(b===0)return 1;
    const pa=Math.pow(a,3),pb=Math.pow(b,3);
    return pa/(pa+pb);
  }
  // Reference expected win between two rarities at a given level (uses RPI as P).
  function expectedRarityWin(rarityA,rarityB){
    return expectedWinRate(NCB.rpiOf(rarityA),NCB.rpiOf(rarityB));
  }
  NCB.expectedWinRate=expectedWinRate;
  NCB.expectedRarityWin=expectedRarityWin;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);