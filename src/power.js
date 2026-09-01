(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  // Unified rarity coordinate system (spec 1, 33). Single ascending order.
  const RARITY_ORDER=['C','C+','B','B+','A','A+','S','SS','SSS'];
  const RARITY_RPI={C:100,'C+':108,B:118,'B+':129,A:141,'A+':154,S:169,SS:187,SSS:207};
  function rpiOf(rarity){const v=RARITY_RPI[rarity];if(v===undefined)throw new Error('unknown rarity: '+rarity);return v;}
  const POWER_RULES={
    levelFormula:{base:0.40,scale:0.60,denominator:99,exponent:0.92},
    qualityRange:[0.97,1.03],
    numericScaleBase:100,
    budgetBase:1000,
    budgetPartitions:{primary:0.52,secondary:0.13,activeSkills:0.25,passiveTrigger:0.10},
  };
  // LevelFactor = 0.40 + 0.60*((L-1)/99)^0.92 ; LF(1)=0.4, LF(100)=1
  function levelFactor(level){
    const L=POWER_RULES.levelFormula;
    const t=Math.max(0,Math.min(99,(Number(level)||1)-1))/L.denominator;
    return L.base+L.scale*Math.pow(t,L.exponent);
  }
  function computeCardPower({rarity,level,quality}){
    const q=Number(quality);
    if(!Number.isFinite(q)||q<POWER_RULES.qualityRange[0]||q>POWER_RULES.qualityRange[1])
      throw new Error('quality '+q+' out of ['+POWER_RULES.qualityRange.join(',')+']');
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
  // Deterministic offline hash for seeding (FNV-1a 32-bit).
  function seedHash(seed){let h=2166136261>>>0;const s=String(seed==null?'':seed);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
  // QualityFactor in [0.97,1.03], reproducible for the same seed.
  function qualityFactor(seed){
    const sd=seedHash(seed);
    const prng=new NCB.Gen5PRNG('gen5,'+((sd>>>0)&0xffff)+','+((sd>>>16)&0xffff)+',1,2');
    return prng.random(9700,10301)/10000;
  }
  NCB.RARITY_ORDER=RARITY_ORDER.slice();
  NCB.RARITY_RPI=Object.freeze({...RARITY_RPI});
  NCB.POWER_RULES=POWER_RULES;
  NCB.rpiOf=rpiOf;
  NCB.rarityOrder=()=>RARITY_ORDER.slice();
  NCB.levelFactor=levelFactor;
  NCB.computeCardPower=computeCardPower;
  NCB.numericScale=numericScale;
  NCB.generationBudget=generationBudget;
  NCB.splitBudget=splitBudget;
  NCB.seedHash=seedHash;
  NCB.qualityFactor=qualityFactor;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);