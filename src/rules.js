(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};

  // Damage types are plugins. New types can be added without touching the engine.
  const DAMAGE_TYPES=Object.create(null);
  function registerDamageType(id,spec){
    DAMAGE_TYPES[id]={id,name:id,defenseStat:'RES',...spec};
    return DAMAGE_TYPES[id];
  }
  registerDamageType('physical',{name:'物理',defenseStat:'DEF'});
  registerDamageType('arcane',{name:'奥术',defenseStat:'RES'});
  registerDamageType('fire',{name:'火焰',defenseStat:'RES'});
  registerDamageType('frost',{name:'寒霜',defenseStat:'RES'});
  registerDamageType('lightning',{name:'雷电',defenseStat:'RES'});
  registerDamageType('toxic',{name:'毒素',defenseStat:'RES'});
  registerDamageType('bleed',{name:'流血',defenseStat:'DEF'});
  registerDamageType('true',{name:'真实',defenseStat:null,ignoresResistance:true});

  function conditionMatches(condition,ctx={}){
    if(!condition)return true;
    if(Array.isArray(condition))return condition.every(c=>conditionMatches(c,ctx));
    if(condition.all)return condition.all.every(c=>conditionMatches(c,ctx));
    if(condition.any)return condition.any.some(c=>conditionMatches(c,ctx));
    if(condition.not)return !conditionMatches(condition.not,ctx);
    const component=NCB.CONDITION_COMPONENTS?.[condition.type];
    if(!component||typeof component.test!=='function')return false;
    return !!component.test(condition,ctx);
  }

  NCB.DAMAGE_TYPES=DAMAGE_TYPES;
  NCB.registerDamageType=registerDamageType;
  NCB.conditionMatches=conditionMatches;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
