(function(root){
  'use strict';
  const N=root.NCB,legacy=N.planAI;
  function resourceValue(engine,who,resource,amount){
    const current=engine.getResource(who,resource),max=engine.resourceMax(who,resource);
    const effective=amount>0?Math.min(amount,Math.max(0,max-current)):-Math.min(-amount,current);
    const demand=who.skills.reduce((sum,id)=>sum+engine.skillCosts(who,N.SKILL_DEFS[id]).filter(c=>c.resource===resource).reduce((n,c)=>n+c.amount,0),0);
    return effective*(4+Math.min(12,demand));
  }
  function value(engine,actor,target,skill,e,ctx={},depth=0){
    if(depth>5||!target)return 0;
    // Virtual status state persists across effects; formula locals remain scoped.
    const predicted=ctx._statuses||(ctx._statuses={});
    target=e.effectTarget==='actor'?actor:target;
    const condition=()=>N.conditionMatches(e.condition,{battle:engine,source:actor,actor,target,skill,...ctx});
    if(e.type!=='conditional'&&e.condition&&!condition())return 0;
    const sum=xs=>(xs||[]).reduce((n,x)=>n+value(engine,actor,target,skill,x,ctx,depth+1),0);
    const friendly=target.teamId===actor.teamId;
    if(e.type==='conditional')return sum(condition()?e.then:e.else);
    if(e.type==='repeat'){
      let n=0;const times=Math.max(0,Math.min(32,Math.floor(Number(e.times||1))));
      // Match resolver scope: each child receives its own repeat context.
      for(let i=0;i<times;i++)for(const child of e.effects||[])n+=value(engine,actor,target,skill,child,{...ctx,REPEAT_INDEX:i},depth+1);
      return n;
    }
    if(e.type==='gain'||e.type==='resource'){
      const who=e.type==='gain'||e.resourceTarget==='actor'?actor:target;
      return resourceValue(engine,who,e.resource,e.amount)*(who.teamId===actor.teamId?1:-1);
    }
    if(e.type==='convertResource'){
      const who=e.resourceTarget==='target'?target:actor,spend=Math.min(engine.getResource(who,e.from),e.amount);
      return (resourceValue(engine,who,e.to,spend*(e.ratio??1))+resourceValue(engine,who,e.from,-spend))*(who.teamId===actor.teamId?1:-1);
    }
    if(e.type==='emitEvent'){
      const who=e.eventSubject==='actor'?actor:target;
      const triggers=[...(N.UNIT_DEFS[who.templateId].triggers||[]),...who.statuses.flatMap(s=>N.STATUS_DEFS[s.id]?.triggers||[])];
      return triggers.filter(t=>t.event===e.event&&(!t.condition||N.conditionMatches(t.condition,{battle:engine,source:who,target:actor}))).reduce((n,t)=>n+(t.effects||[]).reduce((v,x)=>v+value(engine,who,t.target==='self'?who:actor,skill,x,{},depth+1),0),0);
    }
    if(e.type==='status'||e.type==='toggleStatus'){
      const def=N.STATUS_DEFS[e.status];if(!def)return 0;
      const existing=engine.status(target,e.status),key=target.id+':'+e.status;
      const stacks=predicted[key]?.stacks??existing?.stacks??0;
      if(e.type==='toggleStatus'&&stacks)return def.kind==='buff'?-15:15;
      const added=Math.max(0,Math.min(e.stacks||1,(def.maxStacks||1)-stacks));
      const remaining=predicted[key]?.duration??existing?.duration??0;
      const duration=e.duration??def.duration??3;
      if(!added&&remaining>=duration-1)return 0;
      predicted[key]={stacks:Math.min(def.maxStacks||1,stacks+(e.stacks||1)),duration};
      let score=N.statusUtility(engine,actor,target,e)*(added||.25);
      if(def.periodic)score+=Math.min(3,duration)*(def.periodic.effects||[]).reduce((n,x)=>n+value(engine,actor,target,{...skill,formula:'0'},x,{STACKS:predicted[key].stacks},depth+1),0);
      if(def.eventModifiers?.length)score+=12;
      if(def.triggers?.length)score+=12;
      return score*((def.kind==='debuff')!==friendly?1:-1);
    }
    if(e.type==='consumeStatus'){
      const key=target.id+':'+e.status,available=predicted[key]?.stacks??engine.status(target,e.status)?.stacks??0;
      const consumed=e.stacks==='all'?available:Math.min(available,e.stacks||1);ctx.CONSUMED_STACKS=consumed;predicted[key]={...predicted[key],stacks:available-consumed};
      return -consumed*3;
    }
    let score=N.effectUtility(engine,actor,target,skill,e,ctx);
    if(e.type==='damage'){
      if(friendly)score=-Math.abs(score);
      else {
        const raw=engine.evaluateFormula(e.formula||skill.formula||'0',actor,target,ctx);
        // expected value under the action's variance window (VOLATILITY-aware: use midpoint)
        const vmin=Number(e.varianceMin??skill.varianceMin??1),vmax=Number(e.varianceMax??skill.varianceMax??1);
        const evMultiplier=(vmin+vmax)/2;
        const damageEV=Math.min(target.hp,raw*evMultiplier);
        const missingFactor=Math.max(0,Math.min(1,(actor.maxHp-actor.hp)/actor.maxHp));
        // entity LIFESTEAL: hitting an enemy also heals the attacker (bounded by missing HP)
        const ls=Math.max(0,Math.min(0.6,Number(actor.stats?.LIFESTEAL||0)/100));
        const lsValue=damageEV*ls*missingFactor;
        // drain / recoil from the action data
        const drainValue=damageEV*(Number(e.drainRatio??skill.drainRatio??0))*missingFactor;
        const recoilCost=damageEV*(Number(e.recoilRatio??skill.recoilRatio??0));
        // bounded expected self-harm from the actor's OWN afterDamageTaken triggers
        // (prevents the 'action repeatedly self-damages via its own counter' blindness)
        let selfHarm=0;
        for(const inst of recoilCost>0?(actor.statuses||[]):[]){
          const def=N.STATUS_DEFS[inst.id];if(!def||!def.triggers)continue;
          for(const t of def.triggers){
            if(t.event!=='afterDamageTaken'||t.target!=='source')continue;
            for(const te of t.effects||[])if(te.type==='damage'){
              const counter=Math.max(0,engine.evaluateFormula(te.formula||'0',actor,actor,{}));
              selfHarm+=Math.min(counter,Math.max(0,recoilCost)); // bounded: at most the incoming damage
            }
          }
        }
        score+=lsValue+drainValue-recoilCost-selfHarm;
      }
    }
    if(e.type==='heal'||e.type==='shield'||e.type==='ward'||e.type==='cooldownReduce'||e.type==='cleanse')score*=friendly?1:-1;
    if(e.type==='ward'){
      const relevant=engine.getLiving(engine.enemyTeam(target.teamId)).some(enemy=>enemy.skills.some(id=>JSON.stringify(N.SKILL_DEFS[id]).includes('"'+(e.damageType||'arcane')+'"')));
      if(!relevant)score*=.05;
    }
    return score;
  }
  function scoreAction(engine,actor,skill,target){
    const selector=N.TARGET_COMPONENTS[skill.target],multi=typeof selector.multi==='function'?selector.multi({battle:engine,actor,skill}):selector.multi;
    const targets=multi?engine.getValidTargets(actor.id,skill.id):[target];
    let score=targets.reduce((n,t)=>{const ctx={};return n+(skill.effects||[]).reduce((s,e)=>s+value(engine,actor,t,skill,e,ctx),0);},0);
    for(const cost of engine.skillCosts(actor,skill))score-=cost.amount*(cost.resource==='HP'?1+2*(1-actor.hp/actor.maxHp):3);
    score-=Number(skill.cooldown||0)*1.5;
    score+=Math.max(-2,Math.min(3,Number(skill.priority||0)))*Math.max(0,score)*.025;
    return Number.isFinite(score)?score:-1e9;
  }
  function planCanonicalAI(engine,teamId){
    const out=[];
    for(const actor of engine.getLiving(teamId)){
      let best;
      for(const skill of engine.getLegalActions(actor.id))for(const target of engine.getValidTargets(actor.id,skill.id)){
        const score=scoreAction(engine,actor,skill,target);
        if(!best||score>best.score)best={score,actorId:actor.id,skillId:skill.id,targetId:target.id};
      }
      if(best){const {score,...action}=best;out.push(action);}
    }
    return out;
  }
  Object.assign(N,{planCanonicalAI,scoreAction});
  N.planAI=(engine,team,difficulty='canonical')=>difficulty==='canonical'?planCanonicalAI(engine,team):legacy(engine,team,difficulty);
})(typeof globalThis!=='undefined'?globalThis:window);
