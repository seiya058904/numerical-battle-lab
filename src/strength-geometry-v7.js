// Generator v7 canonical additive latent strength geometry.
(function(root){
  'use strict';
  const N=root.NCB=root.NCB||{};
  const LEVEL_SPAN=16;
  const LEVEL_EXPONENT=1.70;
  const RARITY_SCORE_V7=Object.freeze([
    ['C',0.00],['C_PLUS',0.27],['B',0.61],['B_PLUS',1.03],
    ['A',1.52],['A_PLUS',2.10],['S',2.76],['SS',3.52],
    ['SSS',4.38],['SSS_COLLECTOR',5.35],['XS',6.42],['XS_COLLECTOR',7.60],
  ].map(Object.freeze));
  const rarityMap=Object.freeze(Object.fromEntries(RARITY_SCORE_V7));

  function levelScore(level){
    if(!Number.isInteger(level)||level<1||level>100)throw new Error('level must be an integer from 1 to 100');
    return LEVEL_SPAN*Math.pow((level-1)/99,LEVEL_EXPONENT);
  }
  function rarityScore(rarity){
    const id=typeof N.toV2RarityId==='function'?N.toV2RarityId(rarity):String(rarity);
    if(rarityMap[id]===undefined)throw new Error('unknown rarity: '+rarity);
    return rarityMap[id];
  }
  const ANCHOR=levelScore(50)+rarityScore('A');
  function targetTheta(level,rarity){return levelScore(level)+rarityScore(rarity)-ANCHOR;}

  function assertGeometry(){
    const fullLevelSpan=levelScore(100)-levelScore(1);
    const fullRaritySpan=rarityScore('XS_COLLECTOR')-rarityScore('C');
    const levelGap40To100=levelScore(100)-levelScore(40);
    const levelGap70To100=levelScore(100)-levelScore(70);
    const increments=RARITY_SCORE_V7.slice(1).map((row,i)=>row[1]-RARITY_SCORE_V7[i][1]);
    const convexRarity=increments.every((value,i)=>i===0||value>increments[i-1]);
    const ok=fullLevelSpan>=2*fullRaritySpan&&levelGap40To100-fullRaritySpan>=4.5&&fullRaritySpan>=levelGap70To100&&convexRarity;
    return {ok,fullLevelSpan,fullRaritySpan,levelGap40To100,levelGap70To100,convexRarity,anchor:ANCHOR};
  }

  N.LEVEL_SPAN_V7=LEVEL_SPAN;
  N.LEVEL_EXPONENT_V7=LEVEL_EXPONENT;
  N.RARITY_SCORE_V7=RARITY_SCORE_V7;
  N.STRENGTH_ANCHOR_V7=ANCHOR;
  N.levelScoreV7=levelScore;
  N.rarityScoreV7=rarityScore;
  N.targetThetaV7=targetTheta;
  N.assertStrengthGeometryV7=assertGeometry;
  if(typeof module!=='undefined')module.exports=N;
})(typeof globalThis!=='undefined'?globalThis:window);
