(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};

  const symbol=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9_]/g,'_');

  function collectFormulaSymbols(pack){
    const out=new Set(NCB.FORMULA_SYMBOLS||[]);
    const units=pack.units||{},skills=pack.skills||{},statuses=pack.statuses||{};
    const resources=new Set(['ENERGY','HP']);
    for(const unit of Object.values(units)){
      for(const key of Object.keys(unit.stats||{})){
        const id=symbol(key);out.add(id);out.add(`TARGET_${id}`);
        if(!id.endsWith('_MAX')&&!['MAX_HP','ATK','DEF','RES','SPD','ACC','EVA','CRIT','CRIT_DMG','PEN','LIFESTEAL','HEAL_POWER','HEAL_TAKEN','ENERGY_REGEN'].includes(id))resources.add(id);
      }
      for(const key of Object.keys(unit.resourceRegens||{}))resources.add(symbol(key));
      for(const tag of unit.tags||[]){const t=symbol(tag);out.add(`TAG_${t}`);out.add(`TARGET_TAG_${t}`);}
    }
    function collectResources(obj){
      if(!obj||typeof obj!=='object')return;
      if(Array.isArray(obj)){for(const x of obj)collectResources(x);return;}
      for(const key of ['resource','from','to'])if(obj[key])resources.add(symbol(obj[key]));
      if(Array.isArray(obj.costs))for(const c of obj.costs)if(c?.resource)resources.add(symbol(c.resource));
      for(const v of Object.values(obj))if(v&&typeof v==='object')collectResources(v);
    }
    collectResources(skills);collectResources(statuses);
    for(const id of resources){out.add(id);out.add(`TARGET_${id}`);out.add(`${id}_MAX`);out.add(`TARGET_${id}_MAX`);}
    for(const [statusId,def] of Object.entries(statuses)){
      for(const token of [statusId,...(def.tags||[])]){
        const t=symbol(token);out.add(`STATUS_${t}`);out.add(`TARGET_STATUS_${t}`);
      }
    }
    return [...out];
  }

  function validateContentPack(pack={}){
    const errors=[],warnings=[];
    try{JSON.stringify(pack);}catch(_){return{ok:false,errors:['content must be acyclic JSON'],warnings:[]};}
    // Bound authoring input before recursive DSL traversal (including cyclic JS input).
    const pending=[[pack,0]],seen=new Set();let nodes=0;
    while(pending.length){
      const [value,depth]=pending.pop();
      if(++nodes>100000||depth>32)return{ok:false,errors:['content exceeds structural work limit'],warnings:[]};
      if(typeof value==='number'&&!Number.isFinite(value))return{ok:false,errors:['content contains non-finite number'],warnings:[]};
      if(value&&typeof value==='object'){
        if(seen.has(value))continue;seen.add(value);
        for(const child of Object.values(value))pending.push([child,depth+1]);
      }
    }
    const units=pack.units||{},skills=pack.skills||{},statuses=pack.statuses||{};
    const err=(path,msg)=>errors.push(`${path}: ${msg}`);
    const warn=(path,msg)=>warnings.push(`${path}: ${msg}`);
    const allowedSymbols=collectFormulaSymbols(pack);

    function scanFormula(formula,path){
      if(formula===undefined||formula===null||formula==='')return;
      if(typeof formula!=='string'){err(path,'formula must be a string');return;}
      if(typeof NCB.validateExpression!=='function'){err(path,'formula validator unavailable');return;}
      const result=NCB.validateExpression(formula,allowedSymbols);
      if(!result.ok)err(path,`invalid formula: ${result.error}`);
    }
    function scanModifier(mod,path){
      if(!mod||typeof mod!=='object'){err(path,'invalid modifier');return;}
      const operation=mod.operation||mod.op||'add';
      if(!NCB.MODIFIER_OPERATIONS?.[operation])err(`${path}.operation`,`unknown modifier operation ${operation}`);
      scanFormula(mod.formula,`${path}.formula`);
      scanCondition(mod.condition,`${path}.condition`);
    }
    function scanCondition(condition,path){
      if(!condition)return;
      if(Array.isArray(condition)){condition.forEach((c,i)=>scanCondition(c,`${path}[${i}]`));return;}
      if(typeof condition!=='object'){err(path,'condition must be an object');return;}
      if(condition.all){if(!Array.isArray(condition.all))err(`${path}.all`,'must be an array');else condition.all.forEach((c,i)=>scanCondition(c,`${path}.all[${i}]`));}
      if(condition.any){if(!Array.isArray(condition.any))err(`${path}.any`,'must be an array');else condition.any.forEach((c,i)=>scanCondition(c,`${path}.any[${i}]`));}
      if(condition.not)scanCondition(condition.not,`${path}.not`);
      if(condition.type&&!NCB.CONDITION_COMPONENTS?.[condition.type])err(path,`unknown condition ${condition.type}`);
      if(condition.status&&!statuses[condition.status])err(path,`unknown status ${condition.status}`);
      if(condition.damageType&&!NCB.DAMAGE_TYPES?.[condition.damageType])err(path,`unknown damageType ${condition.damageType}`);
    }
    function scanTargetQuery(query,path){
      if(!query||typeof query!=='object'){err(path,'targetQuery required for query target');return;}
      const relations=new Set(['self','ally','enemy','any']);
      const modes=new Set(['all','first']);
      const orders=new Set(['asc','desc']);
      const sortKinds=new Set(['hpPct','hp','maxHp','shield','stat','resource']);
      if(query.relation&&!relations.has(query.relation))err(`${path}.relation`,`unknown relation ${query.relation}`);
      if(query.mode&&!modes.has(query.mode))err(`${path}.mode`,`unknown mode ${query.mode}`);
      if(query.order&&!orders.has(query.order))err(`${path}.order`,`unknown order ${query.order}`);
      if(query.limit!==undefined&&(!Number.isFinite(Number(query.limit))||Number(query.limit)<0))err(`${path}.limit`,'must be a non-negative number');
      if(query.sortBy){
        if(typeof query.sortBy!=='object')err(`${path}.sortBy`,'must be an object');
        else {
          if(!sortKinds.has(query.sortBy.kind||'hpPct'))err(`${path}.sortBy.kind`,`unknown sort kind ${query.sortBy.kind}`);
          if(['stat','resource'].includes(query.sortBy.kind)&&!query.sortBy.key)err(`${path}.sortBy.key`,'required for stat/resource sort');
        }
      }
      scanCondition(query.where,`${path}.where`);
    }
    let effectWork=0;
    function scanEffect(effect,path,weight=1){
      effectWork+=weight;if(effectWork>8192){if(!errors.includes('effect work exceeds 8192'))errors.push('effect work exceeds 8192');return;}
      if(!effect||typeof effect!=='object'){err(path,'invalid effect');return;}
      if(!NCB.EFFECT_COMPONENTS?.[effect.type])err(path,`unknown effect ${effect.type}`);
      scanCondition(effect.condition,`${path}.condition`);
      scanFormula(effect.formula,`${path}.formula`);
      if(effect.status&&!statuses[effect.status])err(path,`unknown status ${effect.status}`);
      if(effect.damageType&&!NCB.DAMAGE_TYPES?.[effect.damageType])err(path,`unknown damageType ${effect.damageType}`);
      if(effect.event&&!NCB.EVENT_COMPONENTS?.[effect.event])err(path,`unknown event ${effect.event}`);
      for(const [i,c] of (effect.components||[]).entries()){
        if(c.type&&!NCB.DAMAGE_TYPES?.[c.type])err(`${path}.components[${i}]`,`unknown damageType ${c.type}`);
        scanFormula(c.formula,`${path}.components[${i}].formula`);
      }
      (effect.effects||[]).forEach((x,i)=>scanEffect(x,`${path}.effects[${i}]`,weight*(effect.type==='repeat'?Math.min(32,Math.max(1,Number(effect.times||1))):1)));
      (effect.then||[]).forEach((x,i)=>scanEffect(x,`${path}.then[${i}]`,weight));
      (effect.else||[]).forEach((x,i)=>scanEffect(x,`${path}.else[${i}]`,weight));
    }

    for(const [id,unit] of Object.entries(units)){
      if(unit.id&&unit.id!==id)warn(`units.${id}`,`id mismatch ${unit.id}`);
      if(!unit.stats||!Number.isFinite(Number(unit.stats.MAX_HP)))err(`units.${id}.stats`,'MAX_HP required');
      for(const [key,value] of Object.entries(unit.stats||{}))if(!Number.isFinite(Number(value)))err(`units.${id}.stats.${key}`,'must be finite');
      for(const [i,skillId] of (unit.skills||[]).entries())if(!skills[skillId])err(`units.${id}.skills[${i}]`,`unknown skill ${skillId}`);
      for(const [i,p] of (unit.passives||[]).entries())scanModifier(p,`units.${id}.passives[${i}]`);
      for(const [i,t] of (unit.triggers||[]).entries()){
        if(!NCB.EVENT_COMPONENTS?.[t.event])err(`units.${id}.triggers[${i}].event`,`unknown event ${t.event}`);
        scanCondition(t.condition,`units.${id}.triggers[${i}].condition`);
        (t.effects||[]).forEach((x,j)=>scanEffect(x,`units.${id}.triggers[${i}].effects[${j}]`));
      }
      for(const type of Object.keys(unit.resistances||{}))if(!NCB.DAMAGE_TYPES?.[type])err(`units.${id}.resistances`, `unknown damageType ${type}`);
      for(const type of Object.keys(unit.affinities||{}))if(!NCB.DAMAGE_TYPES?.[type])err(`units.${id}.affinities`, `unknown damageType ${type}`);
    }

    for(const [id,skill] of Object.entries(skills)){
      if(skill.id&&skill.id!==id)warn(`skills.${id}`,`id mismatch ${skill.id}`);
      if(!NCB.TARGET_COMPONENTS?.[skill.target])err(`skills.${id}.target`,`unknown target ${skill.target}`);
      if(skill.target==='query')scanTargetQuery(skill.targetQuery,`skills.${id}.targetQuery`);
      if(skill.damageType&&!NCB.DAMAGE_TYPES?.[skill.damageType])err(`skills.${id}.damageType`,`unknown damageType ${skill.damageType}`);
      scanFormula(skill.formula,`skills.${id}.formula`);
      for(const [i,c] of (skill.damageComponents||[]).entries()){
        if(c.type&&!NCB.DAMAGE_TYPES?.[c.type])err(`skills.${id}.damageComponents[${i}]`,`unknown damageType ${c.type}`);
        scanFormula(c.formula,`skills.${id}.damageComponents[${i}].formula`);
      }
      scanCondition(skill.requirements,`skills.${id}.requirements`);
      scanCondition(skill.targetRequirements,`skills.${id}.targetRequirements`);
      (skill.effects||[]).forEach((x,i)=>scanEffect(x,`skills.${id}.effects[${i}]`));
    }

    for(const [id,status] of Object.entries(statuses)){
      if(status.id&&status.id!==id)warn(`statuses.${id}`,`id mismatch ${status.id}`);
      for(const [i,m] of (status.modifiers||[]).entries())scanModifier(m,`statuses.${id}.modifiers[${i}]`);
      for(const [i,m] of (status.resistanceMods||[]).entries()){
        if(m.type!=='all'&&!NCB.DAMAGE_TYPES?.[m.type])err(`statuses.${id}.resistanceMods[${i}]`,`unknown damageType ${m.type}`);
        scanModifier(m,`statuses.${id}.resistanceMods[${i}]`);
      }
      for(const [i,m] of (status.eventModifiers||[]).entries()){
        if(!NCB.EVENT_COMPONENTS?.[m.event])err(`statuses.${id}.eventModifiers[${i}]`,`unregistered event ${m.event}`);
        scanModifier(m,`statuses.${id}.eventModifiers[${i}]`);
      }
      for(const [i,t] of (status.triggers||[]).entries()){
        if(!NCB.EVENT_COMPONENTS?.[t.event])err(`statuses.${id}.triggers[${i}].event`,`unknown event ${t.event}`);
        scanCondition(t.condition,`statuses.${id}.triggers[${i}].condition`);
        (t.effects||[]).forEach((x,j)=>scanEffect(x,`statuses.${id}.triggers[${i}].effects[${j}]`));
      }
      (status.periodic?.effects||[]).forEach((x,i)=>scanEffect(x,`statuses.${id}.periodic.effects[${i}]`));
    }
    return{ok:errors.length===0,errors,warnings,formulaSymbols:allowedSymbols};
  }

  NCB.collectFormulaSymbols=collectFormulaSymbols;
  NCB.validateContentPack=validateContentPack;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
