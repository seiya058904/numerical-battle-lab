// BattlePower v4 — independent content-only general-strength estimator for
// Generator v7 cards.
//
// Contract (spec: Task 7):
//   * NEVER reads Level, Rarity, Seed, TargetTheta, ExpectedStrength, a
//     generation budget, EmpiricalTheta or any battle result. It is a pure
//     function of the card's real numbers: stats, actions, effects, statuses,
//     triggers, resources, passives, damage types.
//   * Is a SEPARATE measurement model from StrengthModelV7: it does not call
//     predictThetaV7 / predictRealityThetaV7 / strengthFeaturesV7. Its feature
//     set and aggregation are its own, so its correlation with reality is an
//     independent validation of the content -> strength relationship.
//   * Honors the One Action Rule: each living unit has ONE action opportunity
//     per round, so action throughput is modeled via AI usability (best action
//     full, others discounted) instead of summing six action streams.
//   * The frozen ridge coefficients in calibration/battlepower-v4.json were
//     fitted on train seed families only, selected on validation and evaluated
//     on untouched test seed families (scripts/audit-battlepower-v4.js).
//     Runtime source only consumes that committed artifact.
//   * Display power is a monotone transform of predictedTheta anchored near
//     1000 at Lv50 A (theta 0).
(function(root){
  'use strict';
  const N=root.NCB=root.NCB||{};
  let MODEL=null;
  if(typeof module!=='undefined'&&module.exports){try{MODEL=require('../calibration/battlepower-v4.json');}catch(_){MODEL=null;}}
  else MODEL=N.BATTLEPOWER_V4_CALIBRATION||null;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const num=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const scopeFor=card=>{
    const s=card.stats||{},hp=Math.max(1,num(s.MAX_HP,1000)),atk=Math.max(0,num(s.ATK,0));
    return {...s,ATK:atk,MAX_HP:hp,HP:hp*.6,HP_PCT:.6,MISSING_HP:hp*.4,
      ENERGY:Math.min(num(s.ENERGY_MAX,8),4),ROUND:12,BATTLE_TURN:12,STACKS:2,CONSUMED_STACKS:2,
      TARGET_HP:600,TARGET_MAX_HP:1000,TARGET_HP_PCT:.6,EVENT_DAMAGE:atk};
  };
  function evaluate(formula,card){try{return Math.max(0,num(N.evaluateExpression(String(formula??'0'),scopeFor(card)),0));}catch(_){return 0;}}
  const responsiveRate=value=>{const x=Math.max(.01,num(value,100)/100);return clamp(1+1.5*Math.tanh(Math.log(x)),.25,2.5);};
  const axisRate=value=>{const x=Math.max(0,num(value,100))/100;return 2*x/(1+x);};
  const STATUS_CONTROL_WEIGHT={stun:1,silence:.65,slow:.4,frozen:.55,root:.45,weak:.3,poison:.12,burn:.12,bleed:.12};

  // ---- content feature extraction (independent of strength-model-v7) ----
  function effectValue(card,effect,w,depth,statusDefs){
    // Returns {offense, periodic, heal, barrier, control, economy} in absolute
    // formula-value units; caller applies accuracy/crit/mitigation/frequency.
    const out={offense:0,periodic:0,heal:0,barrier:0,control:0,economy:0};
    if(depth>7)return out;
    const add=part=>{for(const k of Object.keys(out))out[k]+=part[k]||0;};
    if(effect.type==='conditional'){add(effectValue(card,effect.then,w*.55,depth+1,statusDefs));add(effectValue(card,effect.else,w*.45,depth+1,statusDefs));return out;}
    if(effect.type==='repeat'){add(effectValue(card,effect.effects,w*clamp(num(effect.times,1),1,16),depth+1,statusDefs));return out;}
    const isPeriodicConsumer=effect.tags&&(effect.tags.includes('periodic')||effect.tags.includes('trigger')||effect.tags.includes('potency'));
    if(effect.type==='damage'){
      const components=effect.components||[{formula:effect.formula,multiplier:1}];
      const amount=components.reduce((sum,component)=>sum+evaluate(component.formula??effect.formula,card)*num(component.multiplier,1),0);
      const hits=clamp(num(effect.hits,1),1,32);
      const target=isPeriodicConsumer?'periodic':'offense';
      out[target]+=amount*hits*w;
      if(num(effect.drainRatio,0)>0)out.heal+=amount*hits*num(effect.drainRatio,0)*w;
      if(effect.recoilRatio)out.offense-=amount*hits*num(effect.recoilRatio,0)*w;
    }else if(effect.type==='heal'){out.heal+=evaluate(effect.formula,card)*w;}
    else if(effect.type==='shield'||effect.type==='ward'){out.barrier+=evaluate(effect.formula,card)*w;}
    else if(effect.type==='gain'||effect.type==='resource'){out.economy+=num(effect.amount,1)*w;}
    else if(effect.type==='convertResource'){out.economy+=num(effect.amount,1)*w;}
    else if(effect.type==='cooldownReduce'){out.economy+=num(effect.amount,1)*1.5*w;}
    else if(effect.type==='status'||effect.type==='toggleStatus'){
      const def=statusDefs.get(effect.status)||{};
      const duration=clamp(num(effect.duration??def.duration,2),1,6),chance=clamp(num(effect.chance,1),0,1);
      const controlWeight=def.flags?.stun?1:def.flags?.silence?.65:(def.kind==='debuff'?STATUS_CONTROL_WEIGHT[effect.status]??.3:.08);
      const tenacityFactor=.4+.6*responsiveRate(card.stats?.TENACITY);
      const contest=clamp(2/(1+Math.exp(-(num(card.stats?.CONTROL_POWER,100)-100)/60)),.5,1.5)/tenacityFactor;
      out.control+=controlWeight*duration*chance*w*contest;
      if(def.periodic?.effects){
        const periodic=effectValue(card,def.periodic.effects,w*duration*chance,depth+1,statusDefs);
        out.periodic+=periodic.offense+periodic.periodic;out.heal+=periodic.heal;out.barrier+=periodic.barrier;
      }
      if(def.turnEnd?.type==='damagePctMaxHp')out.periodic+=num(card.stats?.MAX_HP,1000)*num(def.turnEnd.pct,0)*duration*chance*w;
      if(def.turnEnd?.type==='healPctMaxHp')out.heal+=num(card.stats?.MAX_HP,1000)*num(def.turnEnd.pct,0)*duration*chance*w;
    }else if(effect.type==='cleanse'||effect.type==='dispel'){out.control+=1.5*w;}
    if(effect.effects)add(effectValue(card,effect.effects,w,depth+1,statusDefs));
    return out;
  }
  function actionValueV4(card,action){
    const s=card.stats||{},statusDefs=new Map([...(card.statuses||[]).map(st=>[st.id,st]),...Object.entries(N.STATUS_DEFS||{})]);
    const raw={offense:0,periodic:0,heal:0,barrier:0,control:0,economy:0};
    for(const effect of action.effects||[]){const part=effectValue(card,effect,1,0,statusDefs);for(const k of Object.keys(raw))raw[k]+=part[k];}
    const accuracy=clamp(num(action.accuracy,1)*(100+num(s.ACC,100))/(100+num(s.ACC,100)+(num(s.EVA,0)+30)*.85),.22,.995);
    const critChance=clamp((num(s.CRIT,0)+num(action.critBonus,0))/100,0,.95);
    const critEV=1+critChance*Math.max(0,num(s.CRIT_DMG,150)/100-1);
    const penetration=clamp((num(s.PEN,0)+num(action.penetrationBonus,0))/100,0,.95);
    const physicalMit=100/(100+100*(1-penetration));
    const magicalMit=100/(100+100*(1-penetration));
    const dmgType=action.effects?.find(e=>e.type==='damage')?.damageType||'physical';
    const mitigation=['physical','bleed'].includes(dmgType)?physicalMit:magicalMit;
    const recovery=Math.max(.25,responsiveRate(s.RECOVERY));
    const cooldownFreq=1/(1+Math.max(0,num(action.cooldown,0))/recovery);
    const regen=Math.max(.1,num(s.ENERGY_REGEN,2)),cost=Math.max(0,num(action.cost,0));
    const resourceFreq=cost?clamp(regen/(cost*1.4),.05,1):1;
    const frequency=cooldownFreq*resourceFreq;
    const potency=Math.max(.1,responsiveRate(s.POTENCY));
    const healPower=Math.max(.1,num(s.HEAL_POWER,100)/100);
    const barrierPower=Math.max(.1,responsiveRate(s.BARRIER_POWER));
    return {offense:raw.offense*accuracy*critEV*mitigation*frequency,
      periodic:raw.periodic*potency*mitigation*frequency,
      heal:raw.heal*healPower*frequency,barrier:raw.barrier*barrierPower*frequency,
      control:raw.control*frequency,economy:raw.economy*frequency};
  }
  function features(card){
    const s=card.stats||{},actions=card.actions||card.skills||[];
    const totals={offense:0,periodic:0,heal:0,barrier:0,control:0,economy:0};
    const perAction=actions.map(action=>{
      const value=actionValueV4(card,action);
      const rank=value.offense+value.periodic+value.heal+value.barrier+value.control*2+value.economy*2;
      return {value,rank};
    });
    // One Action Rule + canonical AI usage: best action full, others discounted.
    perAction.sort((a,b)=>b.rank-a.rank);
    perAction.forEach((row,i)=>{const w=i===0?1:.35;for(const k of Object.keys(totals))totals[k]+=row.value[k]*w;});
    const triggerFreq={roundStart:1,roundEnd:1,afterDamageTaken:.7,afterDamageDealt:.7,afterKill:.1,afterStatusInflicted:.5,command:.4};
    let triggerOffense=0,triggerHeal=0,triggerBarrier=0,triggerControl=0;
    const statusDefs=new Map([...(card.statuses||[]).map(st=>[st.id,st]),...Object.entries(N.STATUS_DEFS||{})]);
    for(const trigger of card.triggers||[]){
      const freq=triggerFreq[trigger.event]??.35;
      const value={offense:0,periodic:0,heal:0,barrier:0,control:0,economy:0};
      for(const effect of trigger.effects||[]){const part=effectValue(card,effect,1,0,statusDefs);for(const k of Object.keys(value))value[k]+=part[k];}
      triggerOffense+=(value.offense+value.periodic)*freq;triggerHeal+=value.heal*freq;triggerBarrier+=value.barrier*freq;triggerControl+=value.control*freq;
    }
    const defenseMix=.4; // physical+bleed share of the reference world
    const mitigation=defenseMix*(1+num(s.DEF,0)/100)+(1-defenseMix)*(1+num(s.RES,0)/100);
    const incomingHit=clamp(100/(100+num(s.EVA,0)*.85),.25,1);
    const resistance=Object.entries(card.resistances||{}).reduce((sum,[type,value])=>sum+(type===card.skeleton?.damageType?num(value):0)*.4,0);
    const tenacityFactor=.4+.6*responsiveRate(s.TENACITY);
    const endurance=Math.max(1,num(s.MAX_HP,1)*mitigation*(1-clamp(resistance,-.75,.85))/incomingHit*tenacityFactor);
    const sustain=Math.max(0,totals.heal)+Math.max(0,totals.barrier)+triggerHeal+triggerBarrier;
    const economy=Math.max(0,num(s.ENERGY_REGEN,2)*1.2+totals.economy*2);
    const tempo=(num(s.SPD,100)-100)/100+Math.max(0,...actions.map(a=>num(a.priority,0)))/20+Math.min(.25,Math.max(0,responsiveRate(s.RECOVERY)-1)*.15);
    const reliability=(num(s.ACC,100)-100)/100+(100-num(s.EVA,0))/100+clamp(num(s.CRIT,0)/100,0,1);
    const potencyRate=responsiveRate(s.POTENCY),barrierRate=responsiveRate(s.BARRIER_POWER),recoveryRate=responsiveRate(s.RECOVERY);
    const count=Math.max(1,actions.length);
    const avgCooldown=actions.reduce((sum,a)=>sum+num(a.cooldown,0),0)/count;
    const attackTotal=totals.offense+totals.periodic;
    const log1=value=>Math.log(1+Math.max(0,value));
    return {features:[
      log1(totals.offense),log1(totals.periodic),log1(totals.heal+1),log1(totals.barrier+1),
      Math.log(1+Math.max(0,endurance)),Math.log(1+Math.max(0,sustain)),
      totals.control*2,Math.log(1+Math.max(0,economy)),tempo,reliability,
      log1(triggerOffense+1),log1(triggerHeal+triggerBarrier+1),triggerControl,
      log1(attackTotal),Math.log(Math.max(.25,attackTotal/Math.max(1,endurance))),
      Math.min(1,actions.length/6),avgCooldown,potencyRate,barrierRate,recoveryRate,
      log1(num(s.MAX_HP,1)),log1(Math.max(0,Math.max(num(s.DEF,0),num(s.RES,0)))),
    ],attackTotal,endurance,sustain};
  }
  const FEATURE_NAMES=['logDirectThroughput','logPeriodicThroughput','logHealThroughput','logBarrierThroughput',
    'logEndurance','logSustain','controlValue','logEconomy','tempo','reliability',
    'logTriggerOffense','logTriggerSurvival','triggerControl','logAttackTotal','attackEnduranceBalance',
    'actionCountNorm','averageCooldown','potencyRate','barrierRate','recoveryRate',
    'logMaxHp','logDefenseMix'];
  function battlePowerV4(card){
    if(!card)return{power:0,predictedTheta:0,features:null};
    const {features:vector}=features(card);
    if(!MODEL||!Array.isArray(MODEL.coefficients))return{power:0,predictedTheta:0,features:vector,model:'missing'};
    let predictedTheta=num(MODEL.intercept,0);
    for(let i=0;i<Math.min(vector.length,MODEL.coefficients.length);i++){
      predictedTheta+=((vector[i]-num(MODEL.means?.[i],0))/Math.max(1e-9,num(MODEL.scales?.[i],1)))*MODEL.coefficients[i];
    }
    const gain=num(MODEL.displayGain,.28);
    const power=Math.max(1,Math.round(1000*Math.exp(gain*predictedTheta)));
    return{power,predictedTheta,features:vector,model:MODEL.schemaVersion||1};
  }
  function displayThetaV4(theta){return Math.max(1,Math.round(1000*Math.exp(.28*theta)));}

  N.BATTLEPOWER_V4_FEATURE_NAMES=FEATURE_NAMES.slice();
  N.battlePowerV4FeaturesV4=card=>features(card).features;
  N.battlePowerV4=battlePowerV4;
  N.battlePowerV4DisplayTheta=displayThetaV4;
  N.BATTLEPOWER_V4_VERSION=4;
  if(typeof module!=='undefined')module.exports=N;
})(typeof globalThis!=='undefined'?globalThis:window);
