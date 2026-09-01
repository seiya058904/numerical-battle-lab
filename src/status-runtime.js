(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};

  // Status semantics adapted from the deterministic ideas in
  // mcp-tool-shop-org/ai-rpg-engine (MIT): explicit stacking policies,
  // stable modifier aggregation, and deterministic immunity handling.
  function normalizedModifiers(def){
    const out=(def.modifiers||[]).map((m,i)=>({...m,index:i}));
    for(const [stat,op,value] of def.statMods||[]){
      if(op==='mul')out.push({stat,operation:'multiply',value,index:out.length});
      else if(op==='add')out.push({stat,operation:'add',value,index:out.length});
      else if(op==='mulPerStack')out.push({stat,operation:'multiplyPerStack',value,index:out.length});
      else if(op==='addPerStack')out.push({stat,operation:'addPerStack',value,index:out.length});
    }
    return out;
  }

  function collectStatModifiers(entity,statId,statusDefs,ctx){
    const out=[];
    for(const inst of entity.statuses||[]){
      const def=statusDefs[inst.id]; if(!def)continue;
      const stacks=Math.max(1,Math.min(inst.stacks||1,def.maxStacks||Infinity));
      normalizedModifiers(def).forEach((mod,index)=>{
        if(mod.stat!==statId)return;
        if(mod.condition&&!NCB.conditionMatches(mod.condition,{...ctx,target:entity}))return;
        out.push({statusId:inst.id,sourceId:inst.sourceId||'',index,stacks,mod});
      });
    }
    out.sort((a,b)=>a.statusId.localeCompare(b.statusId)||a.index-b.index||a.sourceId.localeCompare(b.sourceId));
    return out;
  }

  // One modifier language for stats/resistances/events. SET -> ADD -> MULTIPLY -> CAP,
  // with total stable ordering inside each phase. The operation registry is plugin-extensible.
  function applyStatModifierBand(base,mods,ctx={}){return NCB.applyModifierBand(base,mods,ctx);}

  function statusImmunity(entity,def){
    let immunity=0;
    for(const tag of def.tags||[])immunity=Math.max(immunity,Number(entity.immunities?.[tag]||0));
    return Math.max(0,Math.min(1,immunity));
  }

  function applyStatusInstance(entity,def,opts={},prng){
    const hasOptDuration=Object.prototype.hasOwnProperty.call(opts,'duration');
    const hasDefDuration=Object.prototype.hasOwnProperty.call(def,'duration');
    const rawDuration=hasOptDuration?opts.duration:(hasDefDuration?def.duration:2);
    const duration=rawDuration===null?null:Math.max(1,Number(rawDuration??2));
    const stacks=Math.max(1,Number(opts.stacks??1));
    const immunity=statusImmunity(entity,def);
    if(!opts.ignoreImmunity&&immunity>=1)return {applied:false,resisted:true,immunity};
    if(!opts.ignoreImmunity&&immunity>0&&prng&&prng.random()<immunity)return {applied:false,resisted:true,immunity};
    const existing=entity.statuses.find(s=>s.id===def.id);
    const policy=def.stacking||'stack';
    if(existing){
      if(policy==='replace'){
        existing.stacks=Math.min(def.maxStacks||1,stacks);
        existing.duration=duration;
        existing.sourceId=opts.sourceId||existing.sourceId||null;
      }else if(policy==='refresh'){
        existing.duration=(existing.duration===null||duration===null)?null:Math.max(existing.duration,duration);
        if(opts.sourceId)existing.sourceId=opts.sourceId;
      }else{
        existing.stacks=Math.min(def.maxStacks||1,existing.stacks+stacks);
        existing.duration=(existing.duration===null||duration===null)?null:Math.max(existing.duration,duration);
        if(opts.sourceId)existing.sourceId=opts.sourceId;
      }
      return {applied:true,instance:existing,refreshed:true};
    }
    const instance={id:def.id,stacks:Math.min(def.maxStacks||1,stacks),duration,sourceId:opts.sourceId||null,data:{...(opts.data||{})}};
    entity.statuses.push(instance);
    return {applied:true,instance,refreshed:false};
  }

  function collectResistanceModifiers(entity,damageType,statusDefs,ctx){
    const out=[];
    for(const inst of entity.statuses||[]){
      const def=statusDefs[inst.id]; if(!def)continue;
      const stacks=Math.max(1,Math.min(inst.stacks||1,def.maxStacks||Infinity));
      for(const [index,mod] of (def.resistanceMods||[]).entries()){
        if(mod.type!==damageType&&mod.type!=='all')continue;
        if(mod.condition&&!NCB.conditionMatches(mod.condition,{...ctx,target:entity,damageType}))continue;
        out.push({statusId:inst.id,sourceId:inst.sourceId||'',index,stacks,mod});
      }
    }
    out.sort((a,b)=>a.statusId.localeCompare(b.statusId)||a.index-b.index||a.sourceId.localeCompare(b.sourceId));
    return out;
  }

  function applyResistanceModifierBand(base,mods,ctx={}){return NCB.applyModifierBand(base,mods,ctx);}

  NCB.collectStatModifiers=collectStatModifiers;
  NCB.applyStatModifierBand=applyStatModifierBand;
  NCB.collectResistanceModifiers=collectResistanceModifiers;
  NCB.applyResistanceModifierBand=applyResistanceModifierBand;
  NCB.statusImmunity=statusImmunity;
  NCB.applyStatusInstance=applyStatusInstance;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
