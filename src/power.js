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
  // Level is strictly validated as an integer in 1..100 (only undefined defaults to 100);
  // out-of-range/non-finite/non-integer values are rejected, never silently clamped.
  function normalizeLevel(level){
    if(level===undefined)return 100;
    const n=Number(level);
    if(!Number.isFinite(n))throw new Error('level must be a finite number, got '+String(level));
    if(!Number.isInteger(n))throw new Error('level must be an integer 1..100, got '+String(level));
    if(n<1||n>100)throw new Error('level must be 1..100, got '+String(level));
    return n;
  }
  function levelFactor(level){
    const L=POWER_RULES.levelFormula;
    const lv=normalizeLevel(level);
    const t=(lv-1)/L.denominator;
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
  // v1.2: same CardPower model but using the extended (12-rarity) RPI coordinate.
  function computeCardPowerV2({rarity,level,quality}){
    const q=Number(quality);
    if(!Number.isFinite(q)||q<POWER_RULES.qualityRange[0]||q>POWER_RULES.qualityRange[1])
      throw new Error('quality '+q+' out of ['+POWER_RULES.qualityRange.join(',')+']');
    const power=rpiV2(rarity)*levelFactor(level)*q;
    if(!Number.isFinite(power))throw new Error('non-finite CardPowerV2');
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
  // ---- v1.2 extended rarity tables (review/spec 9) ----
  // v1 keeps its canonical 9-rarity table untouched (RARITY_ORDER/RARITY_RPI) so
  // generator v1 stays fully backward compatible. v1.2 adds three new rarities on
  // top of the existing nine WITHOUT changing any old RPI value (the old 9 use the
  // same numeric targets as v1; only new ids follow the new naming scheme).
  // Legacy v1 alt-forms map to the new ids for v2 dispatch.
  const RARITY_ALIAS={'C+':'C_PLUS','B+':'B_PLUS','A+':'A_PLUS','C_PLUS':'C_PLUS','B_PLUS':'B_PLUS','A_PLUS':'A_PLUS'};
  const RARITY_V2_ORDER=['C','C_PLUS','B','B_PLUS','A','A_PLUS','S','SS','SSS','SSS_COLLECTOR','XS','XS_COLLECTOR'];
  const RARITY_V2_RPI={C:100,C_PLUS:108,B:118,B_PLUS:129,A:141,A_PLUS:154,S:169,SS:187,SSS:207,SSS_COLLECTOR:218,XS:232,XS_COLLECTOR:245};
  const V2_RARITY_DISPLAY={
    C:'C','C_PLUS':'C+',B:'B','B_PLUS':'B+',A:'A','A_PLUS':'A+',S:'S',SS:'SS',SSS:'SSS',
    'SSS_COLLECTOR':'SSS 典藏版',XS:'XS','XS_COLLECTOR':'XS 典藏版',
  };
  function toV2RarityId(rarity){
    if(rarity==null)return'C';
    const s=String(rarity);
    if(RARITY_V2_RPI[s]!==undefined)return s;
    const alias=RARITY_ALIAS[s];
    if(alias&&RARITY_V2_RPI[alias]!==undefined)return alias;
    throw new Error('unknown rarity: '+s);
  }
  function rpiV2(rarity){const id=toV2RarityId(rarity);return RARITY_V2_RPI[id];}
  NCB.RARITY_ALIAS=Object.freeze({...RARITY_ALIAS});
  NCB.RARITY_V2_ORDER=RARITY_V2_ORDER.slice();
  NCB.RARITY_V2_RPI=Object.freeze({...RARITY_V2_RPI});
  NCB.V2_RARITY_DISPLAY=Object.freeze({...V2_RARITY_DISPLAY});
  NCB.toV2RarityId=toV2RarityId;
  NCB.rpiV2=rpiV2;
  // ---- end v1.2 extended rarity ----

  NCB.RARITY_ORDER=RARITY_ORDER.slice();
  NCB.RARITY_RPI=Object.freeze({...RARITY_RPI});
  NCB.POWER_RULES=POWER_RULES;
  NCB.rpiOf=rpiOf;
  NCB.rarityOrder=()=>RARITY_ORDER.slice();
  NCB.computeCardPowerV2=computeCardPowerV2;
  NCB.normalizeLevel=normalizeLevel;
  NCB.levelFactor=levelFactor;
  NCB.computeCardPower=computeCardPower;
  NCB.numericScale=numericScale;
  NCB.generationBudget=generationBudget;
  NCB.splitBudget=splitBudget;
  NCB.seedHash=seedHash;
  NCB.qualityFactor=qualityFactor;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);