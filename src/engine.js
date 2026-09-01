(function (root) {
  'use strict';
  const NCB = root.NCB = root.NCB || {};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const round2=v=>Math.round(v*100)/100;

  function deriveSeed(n) {
    const x = (Number(n)||1) >>> 0;
    return `gen5,${(x>>>16)&0xffff},${x&0xffff},${(x*1103+17)&0xffff},${(x*7919+97)&0xffff}`;
  }

  function evalFormula(expr, scope) {
    if (typeof NCB.evaluateExpression !== 'function') throw new Error('Formula VM not loaded');
    return Number(NCB.evaluateExpression(String(expr ?? '0'), scope));
  }

  class BattleEngine {
    constructor(config) {
      this.config = {seed:config.seed || 'gen5,1,2,3,4', teamA:config.teamA.slice(), teamB:config.teamB.slice()};
      this.prng = new NCB.Gen5PRNG(this.config.seed);
      this.round = 1;
      this.log = [];
      this.history = [];
      this.seq = 0;
      this._procContext = null;
      this._procLimit = 16;
      this.teams = {
        A: this.buildTeam('A', this.config.teamA),
        B: this.buildTeam('B', this.config.teamB),
      };
      this.kernel = new NCB.EventKernel({maxDepth:48, discover:(target,event,source)=>this.discoverHandlers(target,event,source)});
      this.processRoundStart(true);
    }
    buildTeam(teamId, ids) {
      return {id:teamId, entities:ids.map((templateId,i)=>{
        const def = NCB.UNIT_DEFS[templateId];
        if (!def) throw new Error(`Unknown unit ${templateId}`);
        const stats = {...def.stats};
        if (stats.HEAL_TAKEN === undefined) stats.HEAL_TAKEN = 100;
        return {id:`${teamId}${i+1}`,templateId,name:def.name,role:def.role,description:def.description,teamId,
          maxHp:stats.MAX_HP,hp:stats.MAX_HP,stats,skills:def.skills.slice(),statuses:[],shield:0,energy:Math.min(2,stats.ENERGY_MAX),cooldowns:{},alive:true,wards:{},
          resistances:{...(def.resistances||{})},affinities:{...(def.affinities||{})},immunities:{...(def.immunities||{})},tags:[...(def.tags||[])]};
      })};
    }
    entity(id) {
      const e=[...this.teams.A.entities,...this.teams.B.entities].find(x=>x.id===id);
      if (!e) throw new Error(`Unknown entity ${id}`); return e;
    }
    enemyTeam(teamId){return teamId==='A'?'B':'A';}
    getLiving(teamId){return this.teams[teamId].entities.filter(e=>e.hp>0);}
    hasStatus(entityOrId,statusId){const e=typeof entityOrId==='string'?this.entity(entityOrId):entityOrId;return e.statuses.some(s=>s.id===statusId);}
    status(entityOrId,statusId){const e=typeof entityOrId==='string'?this.entity(entityOrId):entityOrId;return e.statuses.find(s=>s.id===statusId);}
    discoverHandlers(target,event,source) {
      if (!target || !target.statuses) return [];
      const out=[];
      const applyEventModifier=(relay,mod,stacks,data)=>NCB.applyModifierOperation(relay,mod,{battle:this,source:target,actor:target,target:source,stacks,data,extra:data});
      for (const s of target.statuses) {
        const def=NCB.STATUS_DEFS[s.id]; if(!def) continue;
        if(event==='ModifyDamageTaken' && def.incomingMultPerStack){out.push({id:`status:${s.id}:incoming`,event,callback:({relay})=>Number(relay)*(1+def.incomingMultPerStack*s.stacks)});}
        if(event==='ModifyDamageDealt' && def.outgoingMultPerStack){out.push({id:`status:${s.id}:outgoing`,event,callback:({relay})=>Number(relay)*(1+def.outgoingMultPerStack*s.stacks)});}
        for(const [index,mod] of (def.eventModifiers||[]).entries()){
          if(mod.event!==event)continue;
          out.push({id:`status:${s.id}:event:${index}`,event,priority:mod.priority||0,order:mod.order,callback:({relay,data})=>{
            if(mod.condition&&!NCB.conditionMatches(mod.condition,{battle:this,source:target,actor:target,target:source,skill:data?.skill,effect:data?.effect,...(data||{})}))return relay;
            return applyEventModifier(relay,mod,s.stacks||1,data);
          }});
        }
      }
      return out;
    }
    getStat(entityId,statId) {
      const e=this.entity(entityId); let base=Number(e.stats[statId]||0);
      const definition=NCB.UNIT_DEFS[e.templateId];
      const rawScope={...e.stats,MAX_HP:e.maxHp,HP:e.hp,HP_PCT:e.maxHp?e.hp/e.maxHp:0,MISSING_HP:e.maxHp-e.hp,ENERGY:Number(e.energy||0)};
      const passives=[];
      for(const [index,passive] of (definition?.passives||[]).entries()){
        if(passive.stat!==statId)continue;
        if(passive.condition&&!NCB.conditionMatches(passive.condition,{battle:this,source:e,target:e}))continue;
        passives.push({statusId:'passive',sourceId:e.templateId,index,stacks:1,mod:{...passive,operation:passive.operation||passive.op||'add'}});
      }
      base=NCB.applyModifierBand(base,passives,{battle:this,source:e,target:e,scope:rawScope});
      const statusMods=NCB.collectStatModifiers(e,statId,NCB.STATUS_DEFS,{battle:this,source:e});
      base=NCB.applyStatModifierBand(base,statusMods,{battle:this,source:e,target:e,scope:rawScope});
      return round2(Number(this.kernel.run('ModifyStat',e,base,null,{statId})));
    }
    statusFlags(e){const flags={}; for(const s of e.statuses){Object.assign(flags,NCB.STATUS_DEFS[s.id]?.flags||{});} return flags;}
    getResource(entityOrId,resource){
      const e=typeof entityOrId==='string'?this.entity(entityOrId):entityOrId;const id=String(resource||'').toUpperCase();
      if(id==='ENERGY')return Number(e.energy||0);if(id==='HP')return Number(e.hp||0);return Number(e.stats[id]||0);
    }
    resourceMax(entityOrId,resource){
      const e=typeof entityOrId==='string'?this.entity(entityOrId):entityOrId;const id=String(resource||'').toUpperCase();
      if(id==='ENERGY')return Number(e.stats.ENERGY_MAX??Infinity);if(id==='HP')return Number(e.maxHp??Infinity);
      const cap=e.stats[`${id}_MAX`];return cap===undefined?Infinity:Number(cap);
    }
    setResource(entityOrId,resource,value){
      const e=typeof entityOrId==='string'?this.entity(entityOrId):entityOrId;const id=String(resource||'').toUpperCase();const max=this.resourceMax(e,id);const next=clamp(Number(value)||0,0,max);
      if(id==='ENERGY')e.energy=next;else if(id==='HP'){e.hp=next;this.defeatIfNeeded(e);}else e.stats[id]=next;return next;
    }
    changeResource(entityOrId,resource,delta,data={}){const e=typeof entityOrId==='string'?this.entity(entityOrId):entityOrId;const id=String(resource||'').toUpperCase();let amount=Number(delta||0);if(amount>0)amount=Number(this.kernel.run('ModifyResourceGain',e,amount,null,{resource:id,...data}));return this.setResource(e,id,this.getResource(e,id)+amount);}
    skillCosts(entityOrSkill,maybeSkill){
      const entity=maybeSkill?(typeof entityOrSkill==='string'?this.entity(entityOrSkill):entityOrSkill):null;const skill=maybeSkill||entityOrSkill;
      const totals=new Map();const add=(resource,amount,allowLethal=false)=>{const id=String(resource||'ENERGY').toUpperCase(),n=Math.max(0,Number(amount||0));if(!n)return;const prev=totals.get(id)||{amount:0,allowLethal:false};prev.amount+=n;prev.allowLethal=prev.allowLethal||!!allowLethal;totals.set(id,prev);};
      add('ENERGY',skill.cost||0);for(const cost of skill.costs||[])add(cost.resource,cost.amount,cost.allowLethal);return [...totals].map(([resource,v])=>{let amount=v.amount;if(entity)amount=Math.max(0,Number(this.kernel.run('ModifyResourceCost',entity,amount,null,{skill,resource})));return{resource,amount:round2(amount),allowLethal:v.allowLethal};});
    }
    canPaySkillCosts(entityOrId,skill){const e=typeof entityOrId==='string'?this.entity(entityOrId):entityOrId;return this.skillCosts(e,skill).every(c=>c.resource==='HP'&&!c.allowLethal?this.getResource(e,c.resource)>c.amount:this.getResource(e,c.resource)>=c.amount);}
    paySkillCosts(entityOrId,skill){
      const e=typeof entityOrId==='string'?this.entity(entityOrId):entityOrId;const costs=this.skillCosts(e,skill);if(!costs.every(c=>c.resource==='HP'&&!c.allowLethal?this.getResource(e,c.resource)>c.amount:this.getResource(e,c.resource)>=c.amount))return false;
      for(const c of costs)this.changeResource(e,c.resource,-c.amount,{skill,cost:true});return true;
    }
    getLegalSkills(entityId){const e=this.entity(entityId); if(e.hp<=0||this.statusFlags(e).stun)return[];return e.skills.map(id=>NCB.SKILL_DEFS[id]).filter(s=>{
      if(!s)return false;if(!this.canPaySkillCosts(e,s))return false;if(s.requirements&&!NCB.conditionMatches(s.requirements,{battle:this,source:e,actor:e,target:e}))return false;if((e.cooldowns[s.id]||0)>0)return false;if(this.statusFlags(e).silence && s.kind!=='damage')return false;return true;
    });}
    getValidTargets(actorId,skillId){const actor=this.entity(actorId),skill=NCB.SKILL_DEFS[skillId];if(!skill)return[];
      const selector=NCB.TARGET_COMPONENTS?.[skill.target];if(!selector||typeof selector.select!=='function')return[];
      const selectorCtx={battle:this,actor,skill};let targets=(selector.select(selectorCtx)||[]).filter(Boolean);
      const enemyMode=typeof selector.enemy==='function'?selector.enemy(selectorCtx):selector.enemy;
      if(enemyMode){const guards=targets.filter(e=>this.statusFlags(e).guard);if(guards.length)targets=guards;}
      if(skill.targetRequirements)targets=targets.filter(target=>NCB.conditionMatches(skill.targetRequirements,{battle:this,source:actor,actor,target,skill}));
      return targets;
    }
    scopeFor(actor,target,extra={}){const scope={};const symbol=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9_]/g,'_');const allSignalTokens=new Set();for(const [statusId,def] of Object.entries(NCB.STATUS_DEFS||{})){allSignalTokens.add(statusId);for(const tag of def.tags||[])allSignalTokens.add(tag);}for(const def of Object.values(NCB.UNIT_DEFS||{}))for(const tag of def.tags||[])allSignalTokens.add(tag);for(const token of allSignalTokens){scope[`STATUS_${symbol(token)}`]=0;scope[`TARGET_STATUS_${symbol(token)}`]=0;scope[`TAG_${symbol(token)}`]=0;scope[`TARGET_TAG_${symbol(token)}`]=0;}const addEntitySignals=(entity,prefix='')=>{if(!entity)return;for(const tag of entity.tags||[])scope[`${prefix}TAG_${symbol(tag)}`]=1;for(const inst of entity.statuses||[]){const def=NCB.STATUS_DEFS[inst.id]||{};const stacks=Number(inst.stacks||1);for(const token of [inst.id,...(def.tags||[])]){const key=`${prefix}STATUS_${symbol(token)}`;scope[key]=Number(scope[key]||0)+stacks;}}};
      for(const key of Object.keys(actor?.stats||{}))scope[key]=this.getStat(actor.id,key);if(target)for(const key of Object.keys(target.stats||{}))scope[`TARGET_${key}`]=this.getStat(target.id,key);addEntitySignals(actor,'');addEntitySignals(target,'TARGET_');Object.assign(scope,{
      MAX_HP:actor.maxHp,HP:actor.hp,HP_PCT:actor.hp/actor.maxHp,MISSING_HP:actor.maxHp-actor.hp,ENERGY:this.getResource(actor,'ENERGY'),
      TARGET_HP:target?.hp||0,TARGET_MAX_HP:target?.maxHp||0,TARGET_HP_PCT:target?target.hp/target.maxHp:0,
      STACKS:1,EVENT_DAMAGE:0,EVENT_HP_DAMAGE:0,EVENT_SHIELD_DAMAGE:0,CONSUMED_STACKS:0,...extra
    });return scope;}
    applyStatus(targetId,statusId,opts={}){const e=this.entity(targetId),def=NCB.STATUS_DEFS[statusId];if(!def||e.hp<=0)return false;
      const result=NCB.applyStatusInstance(e,def,opts,this.prng);
      if(!result.applied){this.pushLog({kind:'resist',targetId,statusId,text:`${e.name} 抵抗 ${def.name}`});return false;}
      this.pushLog({kind:'status',targetId,statusId,stacks:result.instance.stacks,text:`${e.name} 获得 ${def.name}`});
      const entry=this.log[this.log.length-1];let source=null;if(opts.sourceId){try{source=this.entity(opts.sourceId);}catch(_){}}
      if(def.periodic?.snapshot==='apply'){
        const snapSource=source||e;
        const snapScope=this.scopeFor(snapSource,e,{STACKS:result.instance.stacks});
        result.instance.data=result.instance.data||{};
        result.instance.data.periodicSnapshots=(def.periodic.effects||[]).map(effect=>effect.formula?Number(evalFormula(effect.formula,snapScope)):null);
      }
      const payload={eventId:entry.id,statusId,stacks:result.instance.stacks,tags:def.tags||[]};
      this.runStatusTriggers('afterStatusApplied',e,source,payload);
      if(source&&source.id!==e.id)this.runStatusTriggers('afterStatusInflicted',source,e,payload);
      return true;
    }
    removeStatus(targetId,statusId,sourceId){const e=this.entity(targetId),inst=e.statuses.find(s=>s.id===statusId);if(!inst)return false;e.statuses=e.statuses.filter(s=>s.id!==statusId);this.pushLog({kind:'status-remove',targetId,statusId,text:`${e.name} 移除 ${NCB.STATUS_DEFS[statusId]?.name||statusId}`});const entry=this.log[this.log.length-1];let source=null;if(sourceId){try{source=this.entity(sourceId);}catch(_){}}this.runStatusTriggers('afterStatusRemoved',e,source,{eventId:entry.id,statusId,stacks:inst.stacks,tags:NCB.STATUS_DEFS[statusId]?.tags||[]});return true;}
    pushLog(entry){this.log.push({id:++this.seq,round:this.round,...entry});}
    runStatusTriggers(eventName,subject,other,payload={}){
      if(!subject)return;
      const parent=this._procContext;
      const proc=parent||{depth:0,seen:new Set(),halted:false};
      if(proc.depth>=this._procLimit){
        if(!proc.halted){proc.halted=true;this.pushLog({kind:'system',text:`触发链上限 ${this._procLimit}：后续反应已停止`});}
        return;
      }
      const eventId=payload.eventId??this.seq;
      const executeTrigger=(sourceKey,label,trigger,index,stacks=1)=>{
        if(trigger.event!==eventName)return;
        const signature=`${eventId}|${subject.id}|${sourceKey}|${index}`;
        if(proc.seen.has(signature))return;
        const ctx={battle:this,source:subject,actor:subject,target:other,tags:payload.tags||[],damageType:payload.damageType,event:payload};
        if(trigger.condition&&!NCB.conditionMatches(trigger.condition,ctx))return;
        proc.seen.add(signature);
        let targets=[];
        if(trigger.target==='self')targets=[subject];
        else if(trigger.target==='all-allies')targets=this.getLiving(subject.teamId);
        else if(trigger.target==='all-enemies')targets=this.getLiving(this.enemyTeam(subject.teamId));
        else if(trigger.target==='random-ally'){const allies=this.getLiving(subject.teamId);if(allies.length)targets=[this.prng.sample(allies)];}
        else if(trigger.target==='random-enemy'){const enemies=this.getLiving(this.enemyTeam(subject.teamId));if(enemies.length)targets=[this.prng.sample(enemies)];}
        else if(other)targets=[other];
        if(!targets.length)return;
        const pseudo={id:`trigger:${sourceKey}:${index}`,name:label,kind:'trigger',target:'enemy',cost:0,cooldown:0,priority:0,accuracy:1,damageType:'true',formula:'0'};
        const previous=this._procContext;
        this._procContext={depth:proc.depth+1,seen:proc.seen,halted:proc.halted};
        for(const target of targets)for(const effect of trigger.effects||[])this.resolveEffect(subject,target,pseudo,effect,{STACKS:stacks,EVENT_DAMAGE:Number(payload.damage||0),EVENT_HP_DAMAGE:Number(payload.hpDamage||0),EVENT_SHIELD_DAMAGE:Number(payload.shieldDamage||0),EVENT_WARD_DAMAGE:Number(payload.wardDamage||0),TRIGGER_EVENT:eventName});
        proc.halted=this._procContext.halted;
        this._procContext=previous;
      };
      for(const inst of subject.statuses.slice()){
        const def=NCB.STATUS_DEFS[inst.id]; if(!def?.triggers)continue;
        for(const [index,trigger] of def.triggers.entries())executeTrigger(`status:${inst.id}`,def.name,trigger,index,inst.stacks);
      }
      const unitDef=NCB.UNIT_DEFS[subject.templateId];
      for(const [index,trigger] of (unitDef?.triggers||[]).entries())executeTrigger(`unit:${subject.templateId}`,unitDef.name,trigger,index,1);
    }
    heal(sourceId,targetId,amount,label='治疗'){const target=this.entity(targetId);if(target.hp<=0)return 0;const source=this.entity(sourceId);const sourcePower=this.getStat(sourceId,'HEAL_POWER')/100;const takenPower=this.getStat(targetId,'HEAL_TAKEN')/100;let value=Math.max(0,Number(amount)*sourcePower);value=Number(this.kernel.run('ModifyHealDealt',source,value,target,{tags:['heal'],label}));value*=takenPower;value=Number(this.kernel.run('ModifyHealTaken',target,value,source,{tags:['heal'],label}));const final=Math.max(0,Math.floor(value));const before=target.hp;target.hp=Math.min(target.maxHp,target.hp+final);const gained=target.hp-before;if(gained){this.pushLog({kind:'heal',sourceId,targetId,amount:gained,text:`${target.name} 恢复 ${gained} HP`,trace:[`${label}: ${round2(amount)}`,`治疗强度 ×${round2(sourcePower)}`,`受疗属性 ×${round2(takenPower)}`,`事件修正后: ${round2(value)}`,`最终: ${gained}`]});const entry=this.log[this.log.length-1];const payload={eventId:entry.id,heal:gained,amount:gained,tags:['heal']};this.runStatusTriggers('afterHealTaken',target,source,payload);if(source.id!==target.id)this.runStatusTriggers('afterHealDealt',source,target,payload);}return gained;}
    defeatIfNeeded(target,sourceId){if(target.hp<=0&&target.alive){target.hp=0;target.alive=false;this.pushLog({kind:'defeat',targetId:target.id,sourceId,text:`${target.name} 被击倒`});const entry=this.log[this.log.length-1];let source=null;if(sourceId){try{source=this.entity(sourceId);}catch(_){}}this.kernel.run('EntityDefeated',target,true,source,{sourceId});this.runStatusTriggers('afterDefeated',target,source,{eventId:entry.id,tags:['defeat']});if(source&&source.id!==target.id)this.runStatusTriggers('afterKill',source,target,{eventId:entry.id,tags:['kill']});}}
    applyDamage({sourceId,targetId,amount,tags=[],damageType=null,traceLabel='伤害',canReflect=true}){
      const source=sourceId?this.entity(sourceId):null,target=this.entity(targetId);if(target.hp<=0)return{hpDamage:0,shieldDamage:0,wardDamage:0,total:0};
      let v=Math.max(0,Number(amount));const trace=[`${traceLabel}: ${round2(v)}`];
      if(source){const out=Number(this.kernel.run('ModifyDamageDealt',source,v,target,{tags}));if(out!==v)trace.push(`输出修正: ${round2(v)} → ${round2(out)}`);v=out;}
      const inc=Number(this.kernel.run('ModifyDamageTaken',target,v,source,{tags}));if(inc!==v)trace.push(`承伤修正: ${round2(v)} → ${round2(inc)}`);v=inc;
      v=Math.max(0,Math.floor(v));const resolvedType=damageType||tags.find(tag=>NCB.DAMAGE_TYPES?.[tag])||null;let wardDamage=0;if(resolvedType&&target.wards){const pool=Math.max(0,Number(target.wards[resolvedType]||0));wardDamage=Math.min(pool,v);if(wardDamage){target.wards[resolvedType]=pool-wardDamage;v-=wardDamage;trace.push(`${NCB.DAMAGE_TYPES[resolvedType]?.name||resolvedType}护符吸收: ${wardDamage}`);}}const shieldDamage=Math.min(target.shield,v);if(shieldDamage){target.shield-=shieldDamage;v-=shieldDamage;trace.push(`屏障吸收: ${shieldDamage}`);}
      const hpDamage=Math.min(target.hp,v);target.hp-=hpDamage;const total=wardDamage+shieldDamage+hpDamage;trace.push(`HP 伤害: ${hpDamage}`);
      this.pushLog({kind:'damage',sourceId,targetId,amount:total,hpDamage,shieldDamage,wardDamage,damageType:resolvedType,tags:[...tags],text:`${source?source.name:'效果'} → ${target.name}: ${total} 伤害`,trace});
      const logEntry=this.log[this.log.length-1];
      if(source&&hpDamage>0){const ls=clamp(this.getStat(source.id,'LIFESTEAL'),0,60)/100;if(ls>0)this.heal(source.id,source.id,hpDamage*ls,'吸血');}
      if(canReflect&&source&&hpDamage>0&&source.hp>0){let ratio=0;for(const s of target.statuses){const d=NCB.STATUS_DEFS[s.id];if(d?.reflectPerStack)ratio+=d.reflectPerStack*s.stacks;}if(ratio>0)this.applyDamage({sourceId:target.id,targetId:source.id,amount:hpDamage*ratio,tags:['reflect','true'],traceLabel:'反伤',canReflect:false});}
      if(total>0){const eventPayload={damage:total,hpDamage,shieldDamage,wardDamage,damageType:resolvedType,tags:[...tags],eventId:logEntry.id};this.runStatusTriggers('afterDamageTaken',target,source,eventPayload);if(source)this.runStatusTriggers('afterDamageDealt',source,target,eventPayload);}
      this.defeatIfNeeded(target,sourceId);return{hpDamage,shieldDamage,wardDamage,total,logEntry};
    }
    getResistance(entityId,damageType){
      const e=this.entity(entityId);
      const base=Number(e.resistances?.[damageType]||0);
      const mods=NCB.collectResistanceModifiers(e,damageType,NCB.STATUS_DEFS,{battle:this,source:e});
      const band=NCB.applyResistanceModifierBand(base,mods,{battle:this,source:e,target:e,extra:{damageType}});
      return Number(this.kernel.run('ModifyResistance',e,band,null,{damageType}));
    }
    previewDamageComponent(sourceId,targetId,component){
      const source=sourceId?this.entity(sourceId):null,target=this.entity(targetId);const type=component.type||'physical';const typeDef=NCB.DAMAGE_TYPES[type]||NCB.DAMAGE_TYPES.physical;
      const amount=Math.max(0,Number(component.amount||0));const penetration=clamp(Number(component.penetration||0),0,1);
      const requestedDefense=component.ignoreDefense?null:(component.defenseStat==='none'?null:(component.defenseStat??typeDef.defenseStat));
      const defense=requestedDefense?this.getStat(target.id,requestedDefense):0;const effectiveDefense=defense*(1-penetration);const mitigation=requestedDefense?100/(100+Math.max(0,effectiveDefense)):1;
      const bypassResistance=component.ignoreResistance||typeDef.ignoresResistance;const rawResistance=bypassResistance?0:this.getResistance(target.id,type);const typePen=clamp(Number(component.typePenetration||0),0,1);const resistance=bypassResistance?0:clamp(rawResistance-typePen,-0.75,0.85);const sourceBonus=source?1+Number(source.damageBonuses?.[type]||0):1;let finalDamage=amount*sourceBonus*mitigation*(1-resistance);
      if(component.minDamage!==undefined)finalDamage=Math.max(Number(component.minDamage)||0,finalDamage);if(component.maxDamage!==undefined)finalDamage=Math.min(Math.max(0,Number(component.maxDamage)||0),finalDamage);
      return{type,amount,defenseStat:requestedDefense,defense,effectiveDefense,mitigation,resistance,sourceBonus,finalDamage};
    }
    applyDamagePacket({sourceId,targetId,components,tags=[],traceLabel='伤害包',canReflect=true}){
      const target=this.entity(targetId);const rows=[];let hpDamage=0,shieldDamage=0,wardDamage=0,total=0,affinityHealing=0;
      for(const component of components||[]){if(target.hp<=0)break;const preview=this.previewDamageComponent(sourceId,targetId,component);const trace=[`${traceLabel} / ${NCB.DAMAGE_TYPES[preview.type]?.name||preview.type}: ${round2(preview.amount)}`];if(preview.defenseStat)trace.push(`${preview.defenseStat}: ${round2(preview.defense)} / 穿透 ${(Number(component.penetration||0)*100).toFixed(0)}%`,`护甲系数: ${round2(preview.mitigation)}`);if(!NCB.DAMAGE_TYPES[preview.type]?.ignoresResistance)trace.push(`${NCB.DAMAGE_TYPES[preview.type]?.name||preview.type}抗性: ${(preview.resistance*100).toFixed(0)}%`);trace.push(`类型结算: ${round2(preview.finalDamage)}`);
        const applied=this.applyDamage({sourceId,targetId,amount:preview.finalDamage,tags:[...tags,preview.type],damageType:preview.type,traceLabel:`${NCB.DAMAGE_TYPES[preview.type]?.name||preview.type}`,canReflect});if(applied.logEntry){applied.logEntry.trace=[...trace,...(applied.logEntry.trace||[])];applied.logEntry.damageType=preview.type;}rows.push({...preview,...applied});hpDamage+=applied.hpDamage;shieldDamage+=applied.shieldDamage;wardDamage+=applied.wardDamage||0;total+=applied.total;
        const affinity=clamp(Number(target.affinities?.[preview.type]||0),0,1);if(affinity>0&&applied.hpDamage>0&&target.hp>0){const heal=Math.min(target.maxHp-target.hp,Math.floor(applied.hpDamage*affinity));if(heal>0){target.hp+=heal;affinityHealing+=heal;this.pushLog({kind:'affinity',sourceId:target.id,targetId:target.id,amount:heal,damageType:preview.type,text:`${target.name} 从${NCB.DAMAGE_TYPES[preview.type]?.name||preview.type}亲和中恢复 ${heal} HP`});}}
      }
      return{components:rows,hpDamage,shieldDamage,wardDamage,total,affinityHealing};
    }
    skillAccuracy(actor,target,skill,effect={}){const raw=Number(this.kernel.run('ModifyAccuracy',actor,Number(effect.accuracy??skill.accuracy??1),target,{skill,effect}));return clamp(raw,0.05,1.5);}
    skillHits(actor,target,skill,effect={}){const raw=Number(this.kernel.run('ModifyHits',actor,Number(effect.hits??skill.hits??1),target,{skill,effect}));return Math.max(1,Math.min(32,Math.floor(raw)));}
    skillCritChance(actor,target,skill,effect={}){if(effect.canCrit===false)return 0;const raw=Number(this.kernel.run('ModifyCritChance',actor,this.getStat(actor.id,'CRIT')+(skill.critBonus||0),target,{skill,effect}));return clamp(raw/100,0,.8);}
    skillPenetration(actor,target,skill,effect={}){const raw=Number(this.kernel.run('ModifyPenetration',actor,this.getStat(actor.id,'PEN')+(skill.penetrationBonus||0),target,{skill,effect}));return clamp(raw/100,0,.95);}
    evaluateFormula(expr,actor,target,ctx={}){return evalFormula(expr,this.scopeFor(actor,target,ctx));}
    accuracyCheck(actor,target,skill,effect={}){const acc=this.getStat(actor.id,'ACC');const ignoreEvasion=effect.ignoreEvasion??skill.ignoreEvasion??false;const eva=ignoreEvasion?0:this.getStat(target.id,'EVA');const base=this.skillAccuracy(actor,target,skill,effect);const chance=clamp(base*(100+acc)/(100+acc+eva*.85),.05,.995);const hit=this.prng.random()<chance;return{hit,chance};}
    computeDamage(actor,target,skill,effect={},extraScope={}){const scope=this.scopeFor(actor,target,extraScope);const accuracy=effect.canMiss===false?{hit:true,chance:1}:this.accuracyCheck(actor,target,skill,effect);if(!accuracy.hit)return{miss:true,trace:[`命中率: ${(accuracy.chance*100).toFixed(1)}% → MISS`]};
      const critChance=this.skillCritChance(actor,target,skill,effect);const crit=critChance>0&&this.prng.random()<critChance;const critMult=crit?this.getStat(actor.id,'CRIT_DMG')/100:1;const basePen=this.skillPenetration(actor,target,skill,effect);
      const defs=effect.components||skill.damageComponents||[{type:effect.damageType||skill.damageType||'physical',formula:effect.formula||skill.formula,penetration:effect.penetration,typePenetration:effect.typePenetration}];const componentTrace=[];const components=defs.map(c=>{const formula=c.formula||effect.formula||skill.formula;const base=Math.max(0,evalFormula(formula,scope))*Number(c.multiplier??1)*Number(effect.spreadMultiplier??skill.spreadMultiplier??1);const varianceMin=Number(c.varianceMin??effect.varianceMin??skill.varianceMin??1),varianceMax=Number(c.varianceMax??effect.varianceMax??skill.varianceMax??1);const lo=Math.min(varianceMin,varianceMax),hi=Math.max(varianceMin,varianceMax);const variance=lo===hi?lo:lo+this.prng.random()*(hi-lo);const raw=base*critMult*variance;componentTrace.push(`公式: ${formula}`,`基础: ${round2(base)}`,`随机倍率: ×${round2(variance)}`);return{type:c.type||effect.damageType||skill.damageType||'physical',amount:raw,penetration:c.penetration??basePen,typePenetration:c.typePenetration??Number(skill.typePenetrationBonus||0)/100,formula,variance,ignoreDefense:c.ignoreDefense??effect.ignoreDefense??skill.ignoreDefense,ignoreResistance:c.ignoreResistance??effect.ignoreResistance??skill.ignoreResistance,defenseStat:c.defenseStat??effect.defenseStat??skill.defenseStat,minDamage:c.minDamage??effect.minDamage??skill.minDamage,maxDamage:c.maxDamage??effect.maxDamage??skill.maxDamage};});
      const damage=components.reduce((sum,c)=>sum+this.previewDamageComponent(actor.id,target.id,c).finalDamage,0);
      return{components,damage,crit,trace:[`命中率: ${(accuracy.chance*100).toFixed(1)}%`,...componentTrace,`暴击: ${crit?'是':'否'} ×${round2(critMult)}`]};}
    resolveEffect(actor,target,skill,effect,ctx={}){
      target=effect.effectTarget==='actor'?actor:target;
      if(!target||target.hp<=0)return;
      if(effect.type!=='conditional'&&effect.condition&&!NCB.conditionMatches(effect.condition,{battle:this,source:actor,actor,target,skill,...ctx}))return;
      const component=NCB.EFFECT_COMPONENTS?.[effect.type];
      if(!component||typeof component.resolve!=='function')throw new Error(`Unknown or non-executable effect component: ${effect.type}`);
      return component.resolve({engine:this,actor,target,skill,effect,ctx});
    }
    useSkill(action){const actor=this.entity(action.actorId),skill=NCB.SKILL_DEFS[action.skillId];if(!skill||actor.hp<=0)return;const legal=this.getLegalSkills(actor.id).some(s=>s.id===skill.id);if(!legal){this.pushLog({kind:'skip',actorId:actor.id,text:`${actor.name} 无法使用 ${skill.name}`});return;}
      const valid=this.getValidTargets(actor.id,skill.id);let primary=valid.find(t=>t.id===action.targetId)||valid[0];if(!primary)return;if(!this.paySkillCosts(actor,skill)){this.pushLog({kind:'skip',actorId:actor.id,text:`${actor.name} 无法支付 ${skill.name} 的资源消耗`});return;}if(skill.cooldown){const cd=Math.max(0,Number(this.kernel.run('ModifyCooldown',actor,skill.cooldown,null,{skill})));actor.cooldowns[skill.id]=Math.floor(cd)+1;}
      this.pushLog({kind:'action',actorId:actor.id,skillId:skill.id,targetId:primary.id,text:`${actor.name} 使用 ${skill.name}`});
      const selector=NCB.TARGET_COMPONENTS?.[skill.target],selectorCtx={battle:this,actor,skill};const multi=typeof selector?.multi==='function'?selector.multi(selectorCtx):selector?.multi;
      const targets=multi?valid.slice():[primary];for(const target of targets){const effectCtx={LAST_HIT:false,LAST_CRIT:false,LAST_DAMAGE:0,LAST_HP_DAMAGE:0,LAST_SHIELD_DAMAGE:0,LAST_KILL:false};for(const effect of skill.effects||[])this.resolveEffect(actor,target,skill,effect,effectCtx);}
    }
    processRoundStart(initial=false){for(const team of ['A','B'])for(const e of this.getLiving(team)){if(!initial){for(const k of Object.keys(e.cooldowns))e.cooldowns[k]=Math.max(0,e.cooldowns[k]-1);e.energy=clamp(e.energy+this.getStat(e.id,'ENERGY_REGEN'),0,e.stats.ENERGY_MAX);const def=NCB.UNIT_DEFS[e.templateId]||{};for(const [resource,amount] of Object.entries(def.resourceRegens||{}))this.changeResource(e,resource,amount);
          for(const inst of e.statuses.slice()){
            const statusDef=NCB.STATUS_DEFS[inst.id],upkeep=statusDef?.upkeep;if(!upkeep||upkeep.timing&&upkeep.timing!=='roundStart')continue;
            const resource=String(upkeep.resource||'ENERGY').toUpperCase(),amount=Math.max(0,Number(upkeep.amount||0))*(upkeep.perStack?Math.max(1,inst.stacks||1):1);const available=this.getResource(e,resource);const payable=resource==='HP'&&!upkeep.allowLethal?available>amount:available>=amount;
            if(payable){this.changeResource(e,resource,-amount);this.pushLog({kind:'upkeep',sourceId:e.id,targetId:e.id,statusId:inst.id,text:`${e.name} 维持 ${statusDef.name}: ${resource} -${round2(amount)}`});}
            else{this.pushLog({kind:'upkeep-fail',sourceId:e.id,targetId:e.id,statusId:inst.id,text:`${e.name} 无法维持 ${statusDef.name}`});this.removeStatus(e.id,inst.id,e.id);}
          }
          for(const effect of def.roundStart||[])this.resolveEffect(e,e,{id:`round-start:${e.templateId}`,name:'回合开始',kind:'trigger',formula:'0'},effect,{});this.runStatusTriggers('roundStart',e,null,{eventId:++this.seq,tags:['round-start']});}}
      if(!initial)this.pushLog({kind:'system',text:`第 ${this.round} 回合开始`});}
    processTurnEnd(){
      for(const teamId of ['A','B']){
        for(const e of this.teams[teamId].entities){
          if(e.hp<=0)continue;
          this.runStatusTriggers('roundEnd',e,null,{eventId:++this.seq,tags:['round-end']});
          for(const s of e.statuses.slice()){
            const def=NCB.STATUS_DEFS[s.id];
            if(def?.periodic?.timing==='turnEnd'){
              let source=e;
              if(s.sourceId){try{source=this.entity(s.sourceId);}catch(_){source=e;}}
              const pseudo={id:`status:${s.id}`,name:def.name,kind:'status',target:'enemy',cost:0,cooldown:0,priority:0,accuracy:1,damageType:'true',formula:'0'};
              for(const [effectIndex,periodicEffect] of (def.periodic.effects||[]).entries()){
                let effect=periodicEffect;
                const snap=s.data?.periodicSnapshots?.[effectIndex];
                if(def.periodic.snapshot==='apply'&&Number.isFinite(snap))effect={...periodicEffect,formula:String(snap)};
                this.resolveEffect(source,e,pseudo,effect,{STACKS:s.stacks,STATUS_ID:s.id});
              }
            }else{
              const tick=def?.turnEnd;
              if(tick){const stacks=tick.perStack?s.stacks:1;if(tick.type==='damagePctMaxHp')this.applyDamage({sourceId:s.sourceId,targetId:e.id,amount:e.maxHp*tick.pct*stacks,tags:['dot','true'],traceLabel:def.name,canReflect:false});else if(tick.type==='damagePctCurrentHp')this.applyDamage({sourceId:s.sourceId,targetId:e.id,amount:Math.max(tick.min||1,e.hp*tick.pct*stacks),tags:['dot','true'],traceLabel:def.name,canReflect:false});else if(tick.type==='healPctMaxHp')this.heal(s.sourceId||e.id,e.id,e.maxHp*tick.pct*stacks,def.name);}
            }
            if(s.duration!==null)s.duration--;
          }
          e.statuses=e.statuses.filter(s=>(s.duration===null||s.duration>0)&&e.hp>0);
        }
      }
    }
    orderActions(actions){const normalized=[];for(const [i,a] of actions.entries()){let actor;try{actor=this.entity(a.actorId);}catch{continue;}if(actor.hp<=0)continue;const skill=NCB.SKILL_DEFS[a.skillId];if(!skill)continue;const basePriority=a.overridePriority??skill.priority??0;const priority=Number(this.kernel.run('ModifyPriority',actor,basePriority,null,{skill,action:a}));normalized.push({...a,id:`r${this.round}-${i}`,order:200,priority,speed:this.getStat(actor.id,'SPD')});}return NCB.sortActions(normalized,this.prng);}
    resolveRound(actions){if(this.outcome().ended)return;const ordered=this.orderActions(actions);const record=actions.map(a=>({...a}));for(const a of ordered){if(this.outcome().ended)break;this.useSkill(a);}this.processTurnEnd();this.history.push(record);if(!this.outcome().ended){this.round++;this.processRoundStart(false);}return this.outcome();}
    outcome(){const a=this.getLiving('A').length,b=this.getLiving('B').length;if(a&&b)return{ended:false};if(!a&&!b)return{ended:true,winner:'draw'};return{ended:true,winner:a?'A':'B'};}
    serializableSnapshot(){return{seed:this.config.seed,rng:this.prng.getSeed(),round:this.round,teams:Object.fromEntries(['A','B'].map(t=>[t,this.teams[t].entities.map(e=>({id:e.id,templateId:e.templateId,hp:e.hp,shield:e.shield,energy:e.energy,stats:{...e.stats},statuses:e.statuses.map(s=>({...s,data:s.data?{...s.data}:undefined})),cooldowns:{...e.cooldowns},alive:e.alive,wards:{...(e.wards||{})},resistances:{...e.resistances},affinities:{...e.affinities},immunities:{...e.immunities},tags:[...(e.tags||[])]}))])),outcome:this.outcome(),log:this.log.map(x=>({...x,trace:x.trace?x.trace.slice():undefined}))};}
    exportReplay(){return{version:1,seed:this.config.seed,teamA:this.config.teamA.slice(),teamB:this.config.teamB.slice(),rounds:this.history.map(r=>r.map(a=>({...a})))};}
  }

  function createBattle(config){return new BattleEngine(config);}

  function expectedHitChance(engine,actor,target,skill,effect={}){
    if(effect.canMiss===false)return 1;
    const acc=engine.getStat(actor.id,'ACC'),eva=(effect.ignoreEvasion??skill.ignoreEvasion)?0:engine.getStat(target.id,'EVA'),base=engine.skillAccuracy(actor,target,skill,effect);
    return clamp(base*(100+acc)/(100+acc+eva*.85),.22,.995);
  }

  function expectedDamageUtility(engine,actor,target,skill,effect={},ctx={}){
    const scope=engine.scopeFor(actor,target,ctx);
    const hit=expectedHitChance(engine,actor,target,skill,effect);
    const critChance=engine.skillCritChance(actor,target,skill,effect);
    const expectedCrit=1+critChance*(engine.getStat(actor.id,'CRIT_DMG')/100-1);
    const basePen=engine.skillPenetration(actor,target,skill,effect);
    const defs=effect.components||skill.damageComponents||[{type:effect.damageType||skill.damageType||'physical',formula:effect.formula||skill.formula,penetration:effect.penetration,typePenetration:effect.typePenetration}];
    let perHit=0;
    for(const c of defs){
      const formula=c.formula||effect.formula||skill.formula;
      const varianceMin=Number(c.varianceMin??effect.varianceMin??skill.varianceMin??1),varianceMax=Number(c.varianceMax??effect.varianceMax??skill.varianceMax??1);const expectedVariance=(varianceMin+varianceMax)/2;
      const base=Math.max(0,evalFormula(formula,scope))*Number(c.multiplier??1)*Number(effect.spreadMultiplier??skill.spreadMultiplier??1)*expectedCrit*expectedVariance;
      perHit+=engine.previewDamageComponent(actor.id,target.id,{type:c.type||effect.damageType||skill.damageType||'physical',amount:base,penetration:c.penetration??basePen,typePenetration:c.typePenetration??Number(skill.typePenetrationBonus||0)/100,ignoreDefense:c.ignoreDefense??effect.ignoreDefense??skill.ignoreDefense,ignoreResistance:c.ignoreResistance??effect.ignoreResistance??skill.ignoreResistance,defenseStat:c.defenseStat??effect.defenseStat??skill.defenseStat,minDamage:c.minDamage??effect.minDamage??skill.minDamage,maxDamage:c.maxDamage??effect.maxDamage??skill.maxDamage}).finalDamage;
    }
    const hits=engine.skillHits(actor,target,skill,effect);
    const expected=perHit*hits*hit;
    const effective=Math.min(target.hp+target.shield,expected);
    let utility=effective;
    if(expected>=target.hp+target.shield)utility+=target.maxHp*.38;
    if(target.hp/target.maxHp<.35)utility*=1.10;
    return utility;
  }

  function statusUtility(engine,actor,target,effect){
    const def=NCB.STATUS_DEFS[effect.status]; if(!def)return 0;
    const existing=engine.status(target,def.id); const stacks=existing?.stacks||0;
    if(stacks>=(def.maxStacks||1)&&def.stacking!=='refresh')return 2;
    let value=def.kind==='debuff'?20:16;
    if(def.flags?.stun)value+=44;
    if(def.flags?.silence)value+=28;
    if(def.periodic)value+=def.kind==='debuff'?22:18;
    if(def.incomingMultPerStack||def.outgoingMultPerStack)value+=18;
    if(def.modifiers?.some(m=>['DEF','RES','ATK','SPD','HEAL_TAKEN'].includes(m.stat)))value+=15;
    if(def.resistanceMods?.length)value+=12;
    if(def.upkeep){
      const amount=Math.max(0,Number(def.upkeep.amount||0));
      value-=amount*(String(def.upkeep.resource||'ENERGY').toUpperCase()==='HP'?8:4);
    }
    if(def.duration===null)value+=8;
    const chance=effect.chance===undefined?1:Number(effect.chance);
    return value*chance;
  }

  function effectUtility(engine,actor,target,skill,effect,ctx={}){
    target=effect.effectTarget==='actor'?actor:target;
    if(!target)return 0;
    if(effect.type!=='conditional'&&effect.condition&&!NCB.conditionMatches(effect.condition,{battle:engine,source:actor,actor,target,skill,...ctx}))return 0;
    const component=NCB.EFFECT_COMPONENTS?.[effect.type];
    if(!component||typeof component.estimate!=='function')return 0;
    return Number(component.estimate({engine,actor,target,skill,effect,ctx,helpers:{effectUtility,expectedDamageUtility,statusUtility}})||0);
  }


  function skillScore(engine,actor,skill,target,difficulty,plannerRng){
    const selector=NCB.TARGET_COMPONENTS?.[skill.target],selectorCtx={battle:engine,actor,skill};const multi=typeof selector?.multi==='function'?selector.multi(selectorCtx):selector?.multi;
    const targets=multi?engine.getValidTargets(actor.id,skill.id):[target];
    let score=0;
    for(const t of targets){const effectCtx={};for(const effect of skill.effects||[])score+=effectUtility(engine,actor,t,skill,effect,effectCtx);}
    for(const cost of engine.skillCosts(actor,skill)){const weight=cost.resource==='HP'?0.18:cost.resource==='ENERGY'?3:4;score-=Number(cost.amount||0)*weight;}
    score-=Number(skill.cooldown||0)*1.5;
    if(score<=0)score=2;
    if(difficulty==='easy')score*=.65+plannerRng.random()*.75;
    else if(difficulty==='normal')score*=.9+plannerRng.random()*.2;
    else score*=.985+plannerRng.random()*.03;
    return score;
  }

  function planAI(engine,teamId,difficulty='normal'){
    const actions=[];const plannerRng=engine.prng.clone();const warmup=engine.round*7+(teamId==='B'?3:0);for(let i=0;i<warmup;i++)plannerRng.next();
    for(const actor of engine.getLiving(teamId)){
      const skills=engine.getLegalSkills(actor.id);if(!skills.length)continue;let best=null;
      for(const skill of skills){for(const target of engine.getValidTargets(actor.id,skill.id)){const score=skillScore(engine,actor,skill,target,difficulty,plannerRng);if(!best||score>best.score)best={score,actorId:actor.id,skillId:skill.id,targetId:target.id};}}
      if(best)actions.push({actorId:best.actorId,skillId:best.skillId,targetId:best.targetId});
    }
    return actions;
  }


  function replayBattle(replay){const e=createBattle({seed:replay.seed,teamA:replay.teamA,teamB:replay.teamB});for(const r of replay.rounds){if(e.outcome().ended)break;e.resolveRound(r);}return e;}

  function runSimulation(opts){
    const battles=Math.max(1,Math.min(5000,opts.battles||100));
    let winsA=0,winsB=0,draws=0,totalRounds=0,totalDamage=0,totalDamageA=0,totalDamageB=0,totalHealingA=0,totalHealingB=0,totalSurvivorsA=0,totalSurvivorsB=0,misses=0,resistedStatuses=0;
    const damageByType=Object.fromEntries(Object.keys(NCB.DAMAGE_TYPES||{}).map(k=>[k,0]));
    const skillUsage={},statusApplications={};
    for(let i=0;i<battles;i++){
      const e=createBattle({seed:deriveSeed((opts.seedBase||1)+i),teamA:opts.teamA,teamB:opts.teamB});
      let guard=0;
      while(!e.outcome().ended&&guard++<(opts.maxRounds||50))e.resolveRound([...planAI(e,'A',opts.difficultyA||'normal'),...planAI(e,'B',opts.difficultyB||'normal')]);
      const o=e.outcome();if(!o.ended)draws++;else if(o.winner==='A')winsA++;else if(o.winner==='B')winsB++;else draws++;
      totalRounds+=Math.min(e.round,opts.maxRounds||50);
      for(const row of e.log){
        if(row.kind==='damage'){const source=row.sourceId?e.entity(row.sourceId):null;const value=row.hpDamage||0;totalDamage+=value;if(source?.teamId==='A')totalDamageA+=value;else if(source?.teamId==='B')totalDamageB+=value;if(row.damageType)damageByType[row.damageType]=(damageByType[row.damageType]||0)+value;}
        if(row.kind==='heal'){const source=row.sourceId?e.entity(row.sourceId):null;if(source?.teamId==='A')totalHealingA+=row.amount||0;else if(source?.teamId==='B')totalHealingB+=row.amount||0;}
        if(row.kind==='action'&&row.skillId)skillUsage[row.skillId]=(skillUsage[row.skillId]||0)+1;
        if(row.kind==='status'&&row.statusId)statusApplications[row.statusId]=(statusApplications[row.statusId]||0)+1;
        if(row.kind==='miss')misses++;
        if(row.kind==='resist')resistedStatuses++;
      }
      totalSurvivorsA+=e.getLiving('A').length;totalSurvivorsB+=e.getLiving('B').length;
    }
    return{battles,winsA,winsB,draws,winRateA:winsA/battles,winRateB:winsB/battles,avgRounds:round2(totalRounds/battles),avgDamage:round2(totalDamage/battles),avgDamageA:round2(totalDamageA/battles),avgDamageB:round2(totalDamageB/battles),avgHealingA:round2(totalHealingA/battles),avgHealingB:round2(totalHealingB/battles),avgSurvivorsA:round2(totalSurvivorsA/battles),avgSurvivorsB:round2(totalSurvivorsB/battles),damageByType,skillUsage,statusApplications,misses,resistedStatuses};
  }


  NCB.BattleEngine=BattleEngine;NCB.createBattle=createBattle;NCB.planAI=planAI;NCB.estimateSkillUtility=skillScore;NCB.replayBattle=replayBattle;NCB.runSimulation=runSimulation;NCB.deriveSeed=deriveSeed;
  // Single Source of Truth for preview math (v1.2): expose the pure expected-value
  // calculators so BattlePower / UI previews reuse EXACTLY the engine's own formulas
  // (accuracy/crit/penetration/defense mitigation/resistance/multi-hit) and cannot drift.
  NCB.expectedDamageUtility=expectedDamageUtility;
  NCB.effectUtility=effectUtility;
  NCB.statusUtility=statusUtility;
  NCB.expectedHitChance=expectedHitChance;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
