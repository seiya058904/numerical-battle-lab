// Content-only predicted general-strength model for Generator v7.
(function(root){
  'use strict';
  const N=root.NCB=root.NCB||{};
  const WORLD=typeof module!=='undefined'&&module.exports?require('../calibration/reference-world-v7.json'):(N.REFERENCE_WORLD_V7||{});
  const CALIBRATION=typeof module!=='undefined'&&module.exports?require('../calibration/strength-model-v7.json'):(N.STRENGTH_MODEL_CALIBRATION_V7||{});
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const num=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const axisRate=value=>{const x=Math.max(0,num(value,100))/100;return 2*x/(1+x);};
  const responsiveRate=value=>{const x=Math.max(.01,num(value,100)/100);return clamp(1+1.5*Math.tanh(Math.log(x)),.25,2.5);};

  function scope(card){
    const s=card.stats||{},hp=Math.max(1,num(s.MAX_HP,1000)),atk=Math.max(0,num(s.ATK,0));
    return {...s,ATK:atk,MAX_HP:hp,HP:hp*.6,HP_PCT:.6,MISSING_HP:hp*.4,ENERGY:Math.min(num(s.ENERGY_MAX,8),4),ROUND:Math.round(WORLD.battleRounds||12),BATTLE_TURN:Math.round(WORLD.battleRounds||12),STACKS:2,CONSUMED_STACKS:2,TARGET_HP:(WORLD.hp||1000)*.6,TARGET_MAX_HP:WORLD.hp||1000,TARGET_HP_PCT:.6,EVENT_DAMAGE:atk};
  }
  function evaluate(formula,card){try{return Math.max(0,num(N.evaluateExpression(String(formula??'0'),scope(card)),0));}catch(_){return 0;}}
  function effectTotals(card,effects,multiplier=1,depth=0){
    const out={direct:0,periodic:0,heal:0,barrier:0,control:0,economy:0};
    if(depth>7)return out;
    const add=part=>{for(const key of Object.keys(out))out[key]+=part[key]||0;};
    const statusMap=new Map([...(card.statuses||[]).map(status=>[status.id,status]),...Object.entries(N.STATUS_DEFS||{})]);
    for(const effect of effects||[]){
      const w=multiplier*(effect.condition?.type?0.55:1);
      if(effect.type==='conditional'){add(effectTotals(card,effect.then,w*.55,depth+1));add(effectTotals(card,effect.else,w*.45,depth+1));continue;}
      if(effect.type==='repeat'){add(effectTotals(card,effect.effects,w*clamp(num(effect.times,1),1,16),depth+1));continue;}
      if(effect.type==='damage'){
        const components=effect.components||[{formula:effect.formula,multiplier:1}];
        const amount=components.reduce((sum,component)=>sum+evaluate(component.formula??effect.formula,card)*num(component.multiplier,1),0);
        out.direct+=amount*clamp(num(effect.hits,1),1,32)*w;
      }else if(effect.type==='heal')out.heal+=evaluate(effect.formula,card)*w;
      else if(effect.type==='shield'||effect.type==='ward')out.barrier+=evaluate(effect.formula,card)*w;
      else if(effect.type==='gain'||effect.type==='resource'||effect.type==='convertResource')out.economy+=num(effect.amount,1)*w;
      else if(effect.type==='cooldownReduce')out.economy+=num(effect.amount,1)*1.5*w;
      else if(effect.type==='status'||effect.type==='toggleStatus'){
        const definition=statusMap.get(effect.status)||{};
        const duration=clamp(num(effect.duration??definition.duration,2),1,6),chance=clamp(num(effect.chance,1),0,1);
        const flags=definition.flags||{};
        out.control+=(flags.stun?1:flags.silence?.65:definition.kind==='debuff'?.3:.08)*duration*chance*w*(responsiveRate((card.stats||{}).CONTROL_POWER)*100/Math.max(1,WORLD.tenacity||100));
        if(definition.periodic?.effects){const periodic=effectTotals(card,definition.periodic.effects,w*duration*chance,depth+1);out.periodic+=periodic.direct;out.heal+=periodic.heal;out.barrier+=periodic.barrier;}
      }
      if(effect.effects)add(effectTotals(card,effect.effects,w,depth+1));
    }
    return out;
  }
  function actionFrequency(card,action){
    const s=card.stats||{},recovery=Math.max(.25,responsiveRate(s.RECOVERY));
    const cooldown=Math.max(0,num(action.cooldown,0)),cooldownFrequency=1/(1+cooldown/recovery);
    const regen=Math.max(0.1,num(s.ENERGY_REGEN,2)),cost=Math.max(0,num(action.cost,0));
    const resourceFrequency=cost?clamp(regen/(cost*(WORLD.resourcePressure||1.4)),.05,1):1;
    return cooldownFrequency*resourceFrequency;
  }
  function actionValue(card,action){
    const s=card.stats||{},totals=effectTotals(card,action.effects);
    const accuracy=clamp(num(action.accuracy,1)*(100+num(s.ACC,100))/(100+num(s.ACC,100)+(WORLD.eva||30)*.85),.22,.995);
    const critChance=clamp((num(s.CRIT,0)+num(action.critBonus,0))/100,0,.95);
    const crit=1+critChance*Math.max(0,num(s.CRIT_DMG,150)/100-1);
    const penetration=clamp((num(s.PEN,0)+num(action.penetrationBonus,0))/100,0,.95);
    const physicalMitigation=100/(100+(WORLD.def||100)*(1-penetration));
    const magicMitigation=100/(100+(WORLD.res||100)*(1-penetration));
    const damageType=action.effects?.find(effect=>effect.type==='damage')?.damageType||'physical';
    const mitigation=['physical','bleed'].includes(damageType)?physicalMitigation:damageType==='true'?1:magicMitigation;
    const frequency=actionFrequency(card,action);
    const potency=Math.max(.1,responsiveRate(s.POTENCY)),healPower=Math.max(.1,num(s.HEAL_POWER,100)/100),barrierPower=Math.max(.1,responsiveRate(s.BARRIER_POWER));
    return {direct:totals.direct*accuracy*crit*mitigation*frequency,periodic:totals.periodic*potency*mitigation*frequency,
      heal:totals.heal*healPower*frequency,barrier:totals.barrier*barrierPower*frequency,control:totals.control*frequency,economy:totals.economy*frequency};
  }
  function features(card){
    const s=card.stats||{},actions=card.actions||card.skills||[];
    const total={direct:0,periodic:0,heal:0,barrier:0,control:0,economy:0};
    for(const action of actions){const value=actionValue(card,action);for(const key of Object.keys(total))total[key]+=value[key];}
    for(const trigger of card.triggers||[]){const value=effectTotals(card,trigger.effects);const frequency={roundStart:1,roundEnd:1,afterDamageTaken:.7,afterDamageDealt:.7,afterKill:.1,command:.4}[trigger.event]??.35;total.periodic+=(value.direct+value.periodic)*frequency;total.heal+=value.heal*frequency;total.barrier+=value.barrier*frequency;total.control+=value.control*frequency;}
    const actionCount=Math.max(1,actions.length);
    const anchorValues=actions.flatMap(action=>(action.effects||[]).filter(effect=>effect.strengthAnchor===true).map(effect=>evaluate(effect.formula,card)));
    const anchorThroughput=anchorValues.length?Math.max(...anchorValues):0;
    const perRoundAttack=(total.direct+total.periodic+total.control*(WORLD.actionValue||100)*.32+total.economy*2)/actionCount;
    const tacticalAttack=Math.max(0,perRoundAttack-anchorThroughput);
    const attack=Math.max(.25,anchorValues.length?anchorThroughput:perRoundAttack);
    const defenseMix=((WORLD.damageTypeMix?.physical||0)+(WORLD.damageTypeMix?.bleed||0));
    const mitigation=defenseMix*(1+num(s.DEF,0)/100)+(1-defenseMix)*(1+num(s.RES,0)/100);
    const incomingHit=clamp((WORLD.acc||100)/(WORLD.acc||100+num(s.EVA,0)*.85),.25,1);
    const resistance=Object.entries(card.resistances||{}).reduce((sum,[type,value])=>sum+(WORLD.damageTypeMix?.[type]||0)*clamp(num(value),-.75,.85),0);
    const tenacityFactor=.4+.6*responsiveRate(s.TENACITY);
    const endurance=Math.max(1,num(s.MAX_HP,1)*mitigation*(1-resistance)/incomingHit*tenacityFactor);
    const sustain=total.heal*(WORLD.battleRounds||12)*.55+total.barrier*(WORLD.battleRounds||12)*.35;
    const tempo=1+Math.tanh((num(s.SPD,100)-100)/250)*.08;
    const generalPower=Math.sqrt(Math.max(.01,(attack+tacticalAttack)*tempo)*Math.max(1,endurance+sustain));
    return {...total,anchorThroughput,tacticalAttack,attack,endurance,sustain,tempo,generalPower};
  }
  const SHAPE_FEATURE_NAMES=['directShare','periodicShare','controlShare','sustainShare','barrierShare','damageActionShare','statusActionShare','supportActionShare','triggerDensity','retaliationDamageShare','roundTriggerShare','drainActionShare','cleanseDispelShare','actionCount','averageCooldown','averagePriority','logGeneralPower','logGeneralPowerSquared','attackEnduranceBalance','defenseBalance','speedLog'];
  function shapeVector(card){
    const f=features(card),attackTotal=Math.max(1e-9,f.direct+f.periodic+f.control*(WORLD.actionValue||100)*.32),survivalTotal=Math.max(1e-9,f.endurance+f.sustain);
    const actions=card.actions||card.skills||[],count=Math.max(1,actions.length);
    const hasType=(action,type)=>JSON.stringify(action.effects||[]).includes(`\"type\":\"${type}\"`);
    const hasKey=(action,key)=>JSON.stringify(action.effects||[]).includes(`\"${key}\"`);
    const triggers=card.triggers||[],triggerCount=Math.max(1,triggers.length);
    return [f.direct/attackTotal,f.periodic/attackTotal,(f.control*(WORLD.actionValue||100)*.32)/attackTotal,f.sustain/survivalTotal,f.barrier/Math.max(1,f.heal+f.barrier),
      actions.filter(action=>hasType(action,'damage')).length/count,actions.filter(action=>hasType(action,'status')||hasType(action,'toggleStatus')).length/count,
      actions.filter(action=>hasType(action,'heal')||hasType(action,'shield')||hasType(action,'ward')).length/count,Math.min(1,triggers.length/3),
      triggers.filter(trigger=>trigger.event==='afterDamageTaken'&&hasType(trigger,'damage')).length/triggerCount,
      triggers.filter(trigger=>trigger.event==='roundStart'||trigger.event==='roundEnd').length/triggerCount,
      actions.filter(action=>hasKey(action,'drainRatio')).length/count,
      actions.filter(action=>hasType(action,'cleanse')||hasType(action,'dispel')).length/count,
      Math.min(1,actions.length/6),actions.reduce((sum,action)=>sum+num(action.cooldown,0),0)/count,
      actions.reduce((sum,action)=>sum+num(action.priority,0),0)/count/5,
      Math.log(Math.max(1e-9,f.generalPower)),Math.log(Math.max(1e-9,f.generalPower))**2,
      Math.log(Math.max(1e-9,f.attack)/Math.max(1e-9,f.endurance)),
      Math.log(Math.max(1e-9,num(card.stats?.DEF,1))/Math.max(1e-9,num(card.stats?.RES,1))),
      Math.log(Math.max(1e-9,num(card.stats?.SPD,100))/100)];
  }
  function calibrationCorrection(card){
    const vector=shapeVector(card),means=CALIBRATION.means||[],scales=CALIBRATION.scales||[],coefficients=CALIBRATION.coefficients||[];
    let value=num(CALIBRATION.intercept,0);
    for(let i=0;i<vector.length;i++)value+=((vector[i]-num(means[i],0))/Math.max(1e-9,num(scales[i],1)))*num(coefficients[i],0);
    return value;
  }
  function predictTheta(card){const value=features(card).generalPower,gain=Math.max(.1,num(WORLD.thetaRealizationGain,1));return 2*gain*Math.log(Math.max(1e-9,value)/Math.max(1e-9,WORLD.referenceGeneralPower||300));}
  function predictRealityThetaV7(card){return predictTheta(card)+calibrationCorrection(card);}
  function marginalValue(card,knob){
    if(knob.kind!=='stat')throw new Error('unsupported V7 marginal knob: '+knob.kind);
    const key=knob.key,step=Math.max(1e-6,num(knob.relativeStep,.05)),base=Math.max(1e-6,num(card.stats?.[key],0));
    const low=clone(card),high=clone(card);low.stats={...(low.stats||{}),[key]:base*(1-step)};high.stats={...(high.stats||{}),[key]:base*(1+step)};
    return (predictTheta(high)-predictTheta(low))/(2*step);
  }
  N.REFERENCE_WORLD_V7=WORLD;
  N.STRENGTH_MODEL_CALIBRATION_V7=CALIBRATION;
  N.STRENGTH_SHAPE_FEATURE_NAMES_V7=SHAPE_FEATURE_NAMES.slice();
  N.strengthFeaturesV7=features;
  N.strengthShapeVectorV7=shapeVector;
  N.strengthCalibrationCorrectionV7=calibrationCorrection;
  N.predictThetaV7=predictTheta;
  N.predictRealityThetaV7=predictRealityThetaV7;
  N.marginalValueV7=marginalValue;
  if(typeof module!=='undefined')module.exports=N;
})(typeof globalThis!=='undefined'?globalThis:window);
