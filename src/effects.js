(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const round2=v=>Math.round(Number(v||0)*100)/100;

  function install(id,resolve,estimate){
    const current=NCB.EFFECT_COMPONENTS?.[id]||{id,name:id};
    NCB.registerEffectComponent(id,{...current,resolve,estimate});
  }


  install('emitEvent',
    ({engine,actor,target,effect})=>{
      if(!NCB.EVENT_COMPONENTS?.[effect.event])throw new Error(`Unknown event component: ${effect.event}`);
      const subject=effect.eventSubject==='actor'?actor:target;const other=subject.id===actor.id?target:actor;
      engine.pushLog({kind:'event',sourceId:actor.id,targetId:subject.id,eventName:effect.event,text:`${actor.name} 发射事件 ${effect.event}`});
      const entry=engine.log[engine.log.length-1];
      engine.runStatusTriggers(effect.event,subject,other,{eventId:entry.id,tags:effect.tags||[],...(effect.payload||{})});
    },
    ()=>0
  );

  install('conditional',
    ({engine,actor,target,skill,effect,ctx})=>{
      const ok=NCB.conditionMatches(effect.condition,{battle:engine,source:actor,actor,target,skill,...ctx});
      for(const nested of ok?(effect.then||[]):(effect.else||[])) engine.resolveEffect(actor,target,skill,nested,ctx);
    },
    ({engine,actor,target,skill,effect,ctx,helpers})=>{
      const ok=NCB.conditionMatches(effect.condition,{battle:engine,source:actor,actor,target,skill,...ctx});
      return (ok?(effect.then||[]):(effect.else||[])).reduce((sum,nested)=>sum+helpers.effectUtility(engine,actor,target,skill,nested,ctx),0);
    }
  );

  install('repeat',
    ({engine,actor,target,skill,effect,ctx})=>{
      const times=Math.max(0,Math.min(32,Math.floor(Number(effect.times||1))));
      for(let i=0;i<times;i++) for(const nested of effect.effects||[]) engine.resolveEffect(actor,target,skill,nested,{...ctx,REPEAT_INDEX:i});
    },
    ({engine,actor,target,skill,effect,ctx,helpers})=>Math.max(0,Math.min(32,Number(effect.times||1)))*(effect.effects||[]).reduce((sum,nested)=>sum+helpers.effectUtility(engine,actor,target,skill,nested,ctx),0)
  );

  install('damage',
    ({engine,actor,target,skill,effect,ctx})=>{
      const hits=engine.skillHits(actor,target,skill,effect);
      let anyHit=false,anyCrit=false,total=0,hpDamage=0,shieldDamage=0,wardDamage=0;
      const aliveBefore=target.hp>0;
      for(let hit=1;hit<=hits;hit++){
        if(target.hp<=0)break;
        const d=engine.computeDamage(actor,target,skill,effect,ctx);
        if(d.miss){
          engine.pushLog({kind:'miss',sourceId:actor.id,targetId:target.id,text:`${actor.name} 的 ${skill.name}${hits>1?` [${hit}/${hits}]`:''} 未命中 ${target.name}`,trace:d.trace});
          continue;
        }
        anyHit=true; anyCrit=anyCrit||!!d.crit;
        const applied=engine.applyDamagePacket({
          sourceId:actor.id,targetId:target.id,components:d.components,
          tags:[skill.id,...(effect.tags||[])],
          traceLabel:`${skill.name}${hits>1?` [${hit}/${hits}]`:''} ${d.crit?'[暴击]':''}`,
          canReflect:effect.canReflect!==false,
        });
        total+=applied.total; hpDamage+=applied.hpDamage; shieldDamage+=applied.shieldDamage; wardDamage+=applied.wardDamage||0;
        const first=applied.components.find(x=>x.logEntry)?.logEntry;
        if(first)first.trace=[...d.trace,...(first.trace||[])];
      }
      ctx.LAST_HIT=anyHit; ctx.LAST_CRIT=anyCrit; ctx.LAST_DAMAGE=total; ctx.LAST_HP_DAMAGE=hpDamage;
      ctx.LAST_SHIELD_DAMAGE=shieldDamage; ctx.LAST_WARD_DAMAGE=wardDamage; ctx.LAST_KILL=aliveBefore&&target.hp<=0;
      const drainRatio=Math.max(0,Number(effect.drainRatio??skill.drainRatio??0));if(drainRatio>0&&hpDamage>0&&actor.hp>0)engine.heal(actor.id,actor.id,hpDamage*drainRatio,`${skill.name} 汲取`);
      const recoilRatio=Math.max(0,Number(effect.recoilRatio??skill.recoilRatio??0));if(recoilRatio>0&&hpDamage>0&&actor.hp>0)engine.applyDamage({sourceId:actor.id,targetId:actor.id,amount:hpDamage*recoilRatio,tags:['recoil','true',skill.id],traceLabel:`${skill.name} 反噬`,canReflect:false});
    },
    ({engine,actor,target,skill,effect,ctx,helpers})=>helpers.expectedDamageUtility(engine,actor,target,skill,effect,ctx)
  );

  install('heal',
    ({engine,actor,target,skill,effect,ctx})=>engine.heal(actor.id,target.id,engine.evaluateFormula(effect.formula||skill.formula,actor,target,ctx),skill.name),
    ({engine,actor,target,skill,effect,ctx})=>{
      const raw=Math.max(0,engine.evaluateFormula(effect.formula||skill.formula,actor,target,ctx));
      const final=raw*(engine.getStat(actor.id,'HEAL_POWER')/100)*(engine.getStat(target.id,'HEAL_TAKEN')/100);
      const gained=Math.min(target.maxHp-target.hp,Math.max(0,final));
      return gained*(target.hp/target.maxHp<.35?1.5:1.08);
    }
  );

  install('shield',
    ({engine,actor,target,effect,ctx})=>{
      const raw=effect.formula!==undefined?engine.evaluateFormula(effect.formula,actor,target,ctx):Number(effect.amount||0);
      const amount=Math.max(0,Math.floor(Number(engine.kernel.run('ModifyShield',target,raw,actor,{effect})))); if(amount<=0)return;
      target.shield=Math.min(target.maxHp,target.shield+amount);
      engine.pushLog({kind:'shield',sourceId:actor.id,targetId:target.id,amount,text:`${target.name} 获得 ${amount} 屏障`});
    },
    ({engine,actor,target,effect,ctx})=>{
      const raw=Math.max(0,effect.formula!==undefined?engine.evaluateFormula(effect.formula,actor,target,ctx):Number(effect.amount||0));
      return Math.min(raw,Math.max(0,target.maxHp-target.shield))*.68;
    }
  );

  install('ward',
    ({engine,actor,target,effect,ctx})=>{
      const damageType=effect.damageType||'arcane'; if(!NCB.DAMAGE_TYPES[damageType])return;
      const raw=effect.formula!==undefined?engine.evaluateFormula(effect.formula,actor,target,ctx):Number(effect.amount||0);
      const amount=Math.max(0,Math.floor(Number(engine.kernel.run('ModifyWard',target,raw,actor,{effect,damageType})))); if(amount<=0)return;
      target.wards=target.wards||{};
      target.wards[damageType]=Math.min(target.maxHp,Math.max(0,Number(target.wards[damageType]||0))+amount);
      engine.pushLog({kind:'ward',sourceId:actor.id,targetId:target.id,amount,damageType,text:`${target.name} 获得 ${amount} ${NCB.DAMAGE_TYPES[damageType]?.name||damageType}护符`});
    },
    ({engine,actor,target,effect,ctx})=>{
      const raw=Math.max(0,effect.formula!==undefined?engine.evaluateFormula(effect.formula,actor,target,ctx):Number(effect.amount||0));
      const current=Number(target.wards?.[effect.damageType||'arcane']||0);
      return Math.min(raw,Math.max(0,target.maxHp-current))*.72;
    }
  );

  install('status',
    ({engine,actor,target,effect})=>{
      if(effect.chance!==undefined&&engine.prng.random()>=Number(effect.chance))return;
      const opts={stacks:effect.stacks||1,sourceId:actor.id};
      if(Object.prototype.hasOwnProperty.call(effect,'duration'))opts.duration=effect.duration;
      engine.applyStatus(target.id,effect.status,opts);
    },
    ({engine,actor,target,effect,helpers})=>helpers.statusUtility(engine,actor,target,effect)
  );

  install('toggleStatus',
    ({engine,actor,target,effect})=>{
      if(engine.hasStatus(target,effect.status))engine.removeStatus(target.id,effect.status,actor.id);
      else{
        const opts={stacks:effect.stacks||1,sourceId:actor.id};
        if(Object.prototype.hasOwnProperty.call(effect,'duration'))opts.duration=effect.duration;
        engine.applyStatus(target.id,effect.status,opts);
      }
    },
    ({engine,actor,target,effect,helpers})=>{
      const def=NCB.STATUS_DEFS[effect.status]; if(!def)return 0;
      if(engine.hasStatus(target,effect.status))return def.kind==='debuff'?18:.5;
      return helpers.statusUtility(engine,actor,target,{...effect,chance:1});
    }
  );

  install('consumeStatus',
    ({engine,actor,target,effect,ctx})=>{
      const inst=engine.status(target,effect.status);
      const wanted=effect.stacks==='all'?Number(inst?.stacks||0):Math.max(0,Math.floor(Number(effect.stacks||1)));
      const consumed=Math.min(Number(inst?.stacks||0),wanted);
      ctx.CONSUMED_STACKS=consumed; ctx.CONSUMED_STATUS=effect.status;
      if(consumed<=0)return;
      inst.stacks-=consumed;
      if(inst.stacks<=0)engine.removeStatus(target.id,effect.status,actor.id);
      engine.pushLog({kind:'consume',sourceId:actor.id,targetId:target.id,statusId:effect.status,stacks:consumed,text:`${actor.name} 消耗 ${target.name} 的 ${NCB.STATUS_DEFS[effect.status]?.name||effect.status} ×${consumed}`});
    },
    ({engine,target,effect,ctx})=>{
      const inst=engine.status(target,effect.status);
      const stacks=effect.stacks==='all'?Number(inst?.stacks||0):Math.min(Number(inst?.stacks||0),Number(effect.stacks||1));
      ctx.CONSUMED_STACKS=stacks; ctx.CONSUMED_STATUS=effect.status; return stacks*8;
    }
  );

  install('cleanse',
    ({engine,actor,target,effect})=>{
      const tags=effect.tags||[];
      const matches=target.statuses.filter(inst=>{const def=NCB.STATUS_DEFS[inst.id];return def?.kind==='debuff'&&(!tags.length||tags.some(tag=>(def.tags||[]).includes(tag)));}).slice(0,effect.count||1);
      for(const inst of matches)engine.removeStatus(target.id,inst.id,actor.id);
      engine.pushLog({kind:'cleanse',sourceId:actor.id,targetId:target.id,text:`${target.name} 净化 ${matches.length} 个负面状态`});
    },
    ({target,effect})=>{const tags=effect.tags||[];return target.statuses.filter(inst=>{const def=NCB.STATUS_DEFS[inst.id];return def?.kind==='debuff'&&(!tags.length||tags.some(tag=>(def.tags||[]).includes(tag)));}).slice(0,effect.count||1).length*32;}
  );

  install('dispel',
    ({engine,actor,target,effect})=>{
      const tags=effect.tags||[],kind=effect.kind||'buff';
      const matches=target.statuses.filter(inst=>{const def=NCB.STATUS_DEFS[inst.id];return def?.kind===kind&&(!tags.length||tags.some(tag=>(def.tags||[]).includes(tag)));}).slice(0,effect.count||1).map(inst=>({...inst,data:inst.data?{...inst.data}:undefined}));
      for(const inst of matches){
        engine.removeStatus(target.id,inst.id,actor.id);
        if(effect.transfer==='actor'&&actor.hp>0)engine.applyStatus(actor.id,inst.id,{duration:inst.duration,stacks:inst.stacks,sourceId:actor.id,ignoreImmunity:true,data:inst.data});
      }
      engine.pushLog({kind:'dispel',sourceId:actor.id,targetId:target.id,text:`${actor.name} 驱散 ${target.name} 的 ${matches.length} 个${kind==='buff'?'增益':'状态'}${effect.transfer==='actor'?'并夺取':''}`});
    },
    ({target,effect})=>{const tags=effect.tags||[],kind=effect.kind||'buff';const count=target.statuses.filter(inst=>{const def=NCB.STATUS_DEFS[inst.id];return def?.kind===kind&&(!tags.length||tags.some(tag=>(def.tags||[]).includes(tag)));}).slice(0,effect.count||1).length;return count*(effect.transfer==='actor'?38:25);}
  );

  install('convertResource',
    ({engine,actor,target,effect})=>{
      const who=effect.resourceTarget==='target'?target:actor,amount=Math.max(0,Number(effect.amount||0));
      const spend=Math.min(engine.getResource(who,effect.from),amount); if(spend<=0)return;
      const ratio=Number(effect.ratio??1);
      engine.changeResource(who,effect.from,-spend); engine.changeResource(who,effect.to,spend*ratio);
      engine.pushLog({kind:'resource',sourceId:actor.id,targetId:who.id,text:`${who.name}: ${effect.from} -${round2(spend)} → ${effect.to} +${round2(spend*ratio)}`});
    },
    ({engine,actor,target,effect})=>{const who=effect.resourceTarget==='target'?target:actor;const spend=Math.min(engine.getResource(who,effect.from),Number(effect.amount||0));return spend*Number(effect.ratio??1)*8-spend*2;}
  );

  install('resource',
    ({engine,actor,target,effect})=>engine.changeResource(effect.resourceTarget==='actor'?actor:target,effect.resource,Number(effect.amount||0)),
    ({actor,target,effect})=>{const who=effect.resourceTarget==='actor'?actor:target;return Number(effect.amount||0)*(who.teamId===actor.teamId?10:-10);}
  );

  install('gain',
    ({engine,actor,effect})=>engine.changeResource(actor,effect.resource,Number(effect.amount||0)),
    ({effect})=>Number(effect.amount||0)*9
  );

  install('energy',
    ({engine,target,effect})=>engine.changeResource(target,'ENERGY',Number(effect.amount||0)),
    ({actor,target,effect})=>Number(effect.amount||0)*(target.teamId===actor.teamId?12:-12)
  );

  install('cooldownReduce',
    ({target,effect})=>{for(const id of Object.keys(target.cooldowns))target.cooldowns[id]=Math.max(0,target.cooldowns[id]-Number(effect.amount||1));},
    ({target,effect})=>Object.values(target.cooldowns).reduce((a,b)=>a+Math.min(Number(b)||0,Number(effect.amount||1)),0)*11
  );

  install('selfDamagePct',
    ({engine,actor,effect})=>engine.applyDamage({sourceId:actor.id,targetId:actor.id,amount:actor.maxHp*clamp(Number(effect.pct||0),0,10),tags:['recoil','true'],traceLabel:'反噬',canReflect:false}),
    ({actor,effect})=>-actor.maxHp*Number(effect.pct||0)*.7
  );

  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
