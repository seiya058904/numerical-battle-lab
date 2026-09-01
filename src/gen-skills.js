(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  // Unified skill power curve (spec 20-23): RealSkillCost = RawEffectPower * Target * Reliability * Frequency * Tempo.
  const SKILL_FACTORS={
    targetMulti(n){const v=Number(n);if(!Number.isFinite(v))return 1;if(v>=6)return 3.05+0.15*(v-6);return [0.85,1,1.55,2.0,2.4,2.75][v]??1;},
    accuracy:{1:1,0.95:0.95,0.9:0.9,0.8:0.8,0.7:0.7,0.5:0.5},
    cooldown:{0:1,1:0.82,2:0.68,3:0.57,4:0.49},
    priority:p=>Math.pow(1.05,Math.max(-3,Math.min(3,p||0))),
    randomTargetDiscount:0.9,
    conditionalTargetDiscount:0.85,
  };
  function refSkillCost({rawPower,targetCount,accuracy,cooldown,priority}){
    const t=SKILL_FACTORS.targetMulti(targetCount||1);
    const r=SKILL_FACTORS.accuracy[accuracy]??accuracy??1;
    const c=SKILL_FACTORS.cooldown[cooldown]??1;
    const p=SKILL_FACTORS.priority(priority||0);
    const cost=Math.max(0,Number(rawPower))*t*r*c*p;
    if(!Number.isFinite(cost))throw new Error('non-finite skill cost');
    return Math.round(cost*1000)/1000;
  }
  // Finite assemblable skill kit. Each recipe is a pure data program that the
  // generator fills with a scaled formula (formulaScaling) to fit its Active Skill budget.
  // effectType must be a registered EFFECT_COMPONENT (validated at load).
  const SKILL_RECIPES=[
    {id:'strike',name:'打击',kind:'damage',target:'enemy',targetCount:1,accuracy:1,cooldown:0,priority:0,effectType:'damage',damageType:'physical',scaling:'atk',effects:[{type:'damage'}],tags:['strike']},
    {id:'heavy',name:'重击',kind:'damage',target:'enemy',targetCount:1,accuracy:0.9,cooldown:2,priority:0,effectType:'damage',damageType:'physical',scaling:'atk',effects:[{type:'damage'}],tags:['heavy']},
    {id:'cleave',name:'横扫',kind:'damage',target:'all-enemies',targetCount:3,accuracy:0.9,cooldown:2,priority:0,effectType:'damage',damageType:'physical',scaling:'atk',effects:[{type:'damage'}],tags:['aoe']},
    {id:'flurry',name:'连击',kind:'damage',target:'enemy',targetCount:1,accuracy:0.95,cooldown:1,priority:0,effectType:'damage',damageType:'physical',scaling:'atk',hits:3,effects:[{type:'damage',hits:3}],tags:['multihit']},
    {id:'pierce',name:'穿刺',kind:'damage',target:'enemy',targetCount:1,accuracy:1,cooldown:1,priority:0,effectType:'damage',damageType:'physical',scaling:'atk',effects:[{type:'damage'}],tags:['pierce'],penBonus:20},
    {id:'fire-bolt',name:'火矢',kind:'damage',target:'enemy',targetCount:1,accuracy:0.95,cooldown:0,priority:0,effectType:'damage',damageType:'fire',scaling:'atk',effects:[{type:'damage'}],tags:['fire']},
    {id:'ember',name:'灼烧',kind:'damage',target:'enemy',targetCount:1,accuracy:0.9,cooldown:1,priority:0,effectType:'damage',damageType:'fire',scaling:'atk',effects:[{type:'damage'}],tags:['fire','dot-caster']},
    {id:'heal',name:'治疗',kind:'heal',target:'ally',targetCount:1,accuracy:1,cooldown:1,priority:0,effectType:'heal',scaling:'heal',effects:[{type:'heal'}],tags:['support']},
    {id:'shield',name:'屏障',kind:'shield',target:'self',targetCount:0,accuracy:1,cooldown:2,priority:0,effectType:'shield',scaling:'shield',effects:[{type:'shield'}],tags:['defense']},
    {id:'weaken',name:'虚弱',kind:'status',target:'enemy',targetCount:1,accuracy:1,cooldown:1,priority:0,effectType:'status',scaling:'status',status:'weak',statusStacks:1,effects:[{type:'status',status:'weak',stacks:1}],tags:['debuff']},
    {id:'enfeeble',name:'易伤',kind:'status',target:'enemy',targetCount:1,accuracy:0.95,cooldown:1,priority:0,effectType:'status',scaling:'status',status:'vulnerable',statusStacks:1,effects:[{type:'status',status:'vulnerable',stacks:1}],tags:['debuff']},
    {id:'fortify',name:'坚守',kind:'status',target:'self',targetCount:0,accuracy:1,cooldown:2,priority:0,effectType:'status',scaling:'status',status:'fortified',statusStacks:1,effects:[{type:'status',status:'fortified',stacks:1}],tags:['buff']},
    {id:'haste',name:'迅捷',kind:'status',target:'ally',targetCount:1,accuracy:1,cooldown:2,priority:0,effectType:'status',scaling:'status',status:'haste',statusStacks:1,effects:[{type:'status',status:'haste',stacks:1}],tags:['buff','support']},
  ];
  for(const r of SKILL_RECIPES){
    if(!NCB.EFFECT_COMPONENTS?.[r.effectType])throw new Error('gen-skills: unknown effect type '+r.effectType);
    if(r.status&&!NCB.STATUS_DEFS?.[r.status])throw new Error('gen-skills: unknown status '+r.status);
    if(r.damageType&&!NCB.DAMAGE_TYPES?.[r.damageType])throw new Error('gen-skills: unknown damageType '+r.damageType);
  }
  // Compute the reference power of a recipe before formula scaling (used to size formulas).
  function recipeBaseCost(recipe){
    return refSkillCost({rawPower:1,targetCount:recipe.targetCount,accuracy:recipe.accuracy,cooldown:recipe.cooldown,priority:recipe.priority});
  }
  NCB.SKILL_FACTORS=SKILL_FACTORS;
  NCB.refSkillCost=refSkillCost;
  NCB.SKILL_RECIPES=SKILL_RECIPES;
  NCB.recipeBaseCost=recipeBaseCost;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);