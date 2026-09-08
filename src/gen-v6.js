// Generator v6 — pure Level x Rarity total-strength budget generation.
(function(root){
  'use strict';
  const N=root.NCB;
  const round=v=>Math.round((Number(v)||0)*1000)/1000;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const clone=value=>JSON.parse(JSON.stringify(value));
  function rng(seed,salt){return new N.Gen5PRNG(N.deriveSeed(N.seedHash(String(seed)+'|'+salt)));}
  function pick(prng,list){return list[prng.random(list.length)];}
  function roll(prng,percent){return prng.random(100)<percent;}
  function seedToken(seed){return /archetype|Balanced|Tank|Bruiser|Assassin|Mage|Support|Controller/.test(seed)?Array.from(seed,c=>c.codePointAt(0).toString(16)).join('-'):seed;}

  function normalizedProfile(seed){
    const allocation=N.allocateBudgetV6(1,seed,'profile');
    const profile={...allocation.profile};
    const sum=Object.values(profile).reduce((a,b)=>a+b,0);
    for(const key of Object.keys(profile))profile[key]=round(profile[key]/sum);
    const keys=Object.keys(profile),delta=round(1-Object.values(profile).reduce((a,b)=>a+b,0));
    profile[keys.at(-1)]=round(profile[keys.at(-1)]+delta);
    return profile;
  }

  function buildStructure(opts={}){
    const seed=String(opts.seed??''),rarity=N.toV2RarityId(opts.rarity),level=N.normalizeLevel(opts.level);
    const identity=`v6|seed=${seedToken(seed)}|rarity=${rarity}|level=${level}`;
    const id=N.cardId(identity),prng=rng(seed,'v6-structure'),profile=normalizedProfile(seed);
    const damageType=pick(prng,Object.keys(N.DAMAGE_TYPES));
    const resource=pick(prng,['RAGE','SOUL','CHRONO']);
    const dotId=id+':dot',stanceId=id+':stance',duration=2+prng.random(4);
    const count=pick(prng,[2,3,3,3,4,4,4,5,5,6]);
    const dominant=Object.entries(profile).sort((a,b)=>b[1]-a[1])[0][0];
    const victoryKinds=dominant==='control'?['dot','consume','direct']:dominant==='triggers'?['reflect','dot','direct']:dominant==='economy'?['detonate','consume','direct']:['direct','dot','consume','reflect','detonate'];
    const victory=pick(prng,victoryKinds);
    return {id,identity,seed,rarity,level,profile,damageType,resource,dotId,stanceId,duration,count,victory};
  }

  function baseStats(st){
    const p=st.profile,prng=rng(st.seed,'v6-panel');
    const jitter=span=>1+(prng.random()*2-1)*span;
    const stats={
      MAX_HP:round((90+1150*p.durability+520*p.sustain)*jitter(.12)),
      ATK:round((24+230*p.offense+55*p.reliability)*jitter(.12)),
      DEF:round((8+135*p.durability)*jitter(.15)),
      RES:round((8+110*p.durability+35*p.control)*jitter(.15)),
      SPD:round((28+150*p.tempo+35*p.reliability)*jitter(.12)),
      ACC:round(72+27*p.reliability+8*p.tempo),EVA:round(5+45*p.tempo),
      CRIT:round(4+55*p.offense),CRIT_DMG:round(135+90*p.offense),PEN:round(4+50*p.offense),
      LIFESTEAL:round(35*p.sustain),HEAL_POWER:round(90+90*p.sustain),HEAL_TAKEN:100,
      ENERGY_MAX:8,ENERGY_REGEN:round(1+5*p.economy),VOLATILITY:round(.2+Math.pow(rng(st.seed,'iv').random(),2)*2.8),
      LUCK:round(-.9+rng(st.seed,'iv2').random()*1.8),ENDURANCE:Math.round(rng(st.seed,'end').random()*100),
      RAMP_START:9,FATIGUE_START:45,RAMP_RATE:round(.006+.025*p.triggers),FATIGUE_RATE:.006,RAMP_CAP:round(1.1+.5*p.triggers),FATIGUE_CAP:.9,
    };
    stats[st.resource]=2;stats[st.resource+'_MAX']=8;
    return stats;
  }

  function damageEffect(st,coeff){return {type:'damage',damageType:st.damageType,formula:'ATK * '+round(coeff),varianceMin:.88,varianceMax:1.12,penetration:round(st.profile.offense*.5)};}
  function action(st,index,family){
    const p=st.profile,prng=rng(st.seed,'v6-action-'+index),id=st.id+':a'+index;
    const reliability=clamp(.72+p.reliability*.5,.72,.99),cooldown=prng.random(4),priority=prng.random(5)-2;
    const a={id,name:'',kind:'utility',target:'self',cost:roll(prng,35)?1:0,cooldown,priority,accuracy:round(reliability),effects:[]};
    switch(family){
      case 'direct':a.name=pick(prng,['斩击','穿刺','轰击']);a.kind='damage';a.target='enemy';a.effects=[damageEffect(st,.35+2.1*p.offense)];break;
      case 'dot':a.name='侵蚀';a.kind='status';a.target='enemy';a.effects=[{type:'status',status:st.dotId,stacks:1+prng.random(2),duration:st.duration,chance:round(reliability)}];break;
      case 'consume':a.name='蚀爆';a.kind='damage';a.target='enemy';a.effects=[{type:'status',status:st.dotId,stacks:1,duration:st.duration},{type:'consumeStatus',status:st.dotId,stacks:'all'},damageEffect(st,.18+.8*p.offense)];break;
      case 'detonate':a.name='聚能爆裂';a.kind='damage';a.target='enemy';a.cost=1;a.effects=[{type:'gain',resource:st.resource,amount:round(1+5*p.economy)},damageEffect(st,.2+.7*p.offense)];a.effects[1].formula+=` + ${st.resource} * ${round(2+18*p.economy)}`;break;
      case 'heal':a.name='复苏';a.kind='heal';a.target='ally';a.effects=[{type:'heal',formula:'MAX_HP * '+round(.025+.42*p.sustain)}];break;
      case 'shield':a.name='坚守';a.kind='shield';a.target='self';a.effects=[{type:'shield',formula:'MAX_HP * '+round(.025+.36*p.sustain)}];break;
      case 'control':a.name='封锁';a.kind='status';a.target='enemy';a.effects=[{type:'status',status:pick(prng,['weak','slow','vulnerable','silence']),stacks:1,duration:1+Math.round(3*p.control),chance:round(.25+.7*p.control)}];break;
      case 'tempo':a.name='抢攻';a.kind='damage';a.target='enemy';a.cooldown=0;a.priority=2+Math.round(4*p.tempo);a.effects=[damageEffect(st,.16+.65*p.offense)];break;
      case 'economy':a.name='蓄能';a.effects=[{type:'gain',resource:st.resource,amount:round(1+7*p.economy)}];break;
      case 'cooldown':a.name='回转';a.target='ally';a.effects=[{type:'cooldownReduce',amount:1+Math.round(2*p.tempo)}];break;
      case 'cleanse':a.name='净化';a.target='ally';a.effects=[{type:'cleanse',count:1+Math.round(2*p.control)}];break;
      case 'dispel':a.name='破咒';a.target='enemy';a.effects=[{type:'dispel',count:1+Math.round(2*p.control)}];break;
      case 'stance':a.name='战意';a.kind='status';a.effects=[{type:'toggleStatus',status:st.stanceId,duration:st.duration}];break;
      default:a.name='斩击';a.kind='damage';a.target='enemy';a.effects=[damageEffect(st,.3+.8*p.offense)];
    }
    if(a.target!=='self'&&roll(prng,25)){const relation=a.target==='enemy'?'enemy':'ally';a.target='query';a.targetQuery={relation,sortBy:{kind:'hpPct',key:'SPD'},order:family==='heal'?'asc':'desc',limit:1,mode:'first'};}
    return a;
  }

  function chooseFamilies(st){
    const prng=rng(st.seed,'v6-families'),p=st.profile;
    const weighted=[];
    const add=(name,weight)=>{for(let i=0;i<Math.max(1,Math.round(weight*30));i++)weighted.push(name);};
    add('direct',p.offense);add('heal',p.sustain);add('shield',p.sustain+p.durability/2);add('control',p.control);add('tempo',p.tempo);add('economy',p.economy);add('cooldown',p.tempo/2);add('cleanse',p.control/3);add('dispel',p.control/3);add('stance',p.triggers);
    const families=[st.victory];while(families.length<st.count)families.push(pick(prng,weighted));return families;
  }

  function buildRawCard(st){
    const stats=baseStats(st),families=chooseFamilies(st),actions=families.map((family,i)=>action(st,i,family));
    const p=st.profile,prng=rng(st.seed,'v6-extras');
    const statuses=[
      {id:st.dotId,name:'侵蚀',kind:'debuff',maxStacks:3+prng.random(4),stacking:pick(prng,['stack','refresh']),duration:st.duration,periodic:{timing:'turnEnd',snapshot:pick(prng,['apply','dynamic']),effects:[damageEffect(st,.04+.45*(p.offense+p.control))]}},
      {id:st.stanceId,name:'战意',kind:'buff',maxStacks:2,stacking:'refresh',duration:st.duration,modifiers:[{stat:pick(prng,['ATK','DEF','SPD']),operation:'addPerStack',value:round(2+28*p.triggers)}]},
    ];
    const triggers=[];
    if(st.victory==='reflect'||p.triggers>.16)triggers.push({event:'afterDamageTaken',target:'source',effects:[{...damageEffect(st,.06+.75*p.triggers),canReflect:false}]});
    if(p.sustain>.14)triggers.push({event:pick(prng,['roundStart','roundEnd']),target:'self',effects:[{type:pick(prng,['heal','shield']),formula:'MAX_HP * '+round(.01+.12*p.sustain)}]});
    const passives=p.triggers>.1?[{stat:pick(prng,['ATK','DEF','SPD']),operation:'add',value:round(2+30*p.triggers),condition:{type:'hpPctBelow',value:.5}}]:[];
    const card={id:st.id,identity:st.identity,seed:st.seed,generatorVersion:6,rarity:st.rarity,level:st.level,name:'',displayName:'',stats,actions,statuses,triggers,passives,resourceRegens:{[st.resource]:1},resources:{ENERGY:{max:8,regen:stats.ENERGY_REGEN},[st.resource]:{max:8,regen:1}},resistances:{[st.damageType]:round(.01+.12*p.durability)},affinities:{[st.damageType]:round(.01+.12*p.offense)},allocationProfile:{...p},_shapeLevel:1,_shape:{id:st.id,count:st.count,type:st.damageType,resource:st.resource,victory:st.victory}};
    const referenced=N.assembleCardPack(card).statuses;card.statuses=card.statuses.filter(status=>referenced[status.id]);return card;
  }

  function scaleFormula(formula,factor){
    if(typeof formula!=='string')return formula;
    return formula.replace(/(\*\s*)(-?(?:\d+(?:\.\d+)?|\.\d+))/g,(_,prefix,value)=>prefix+round(Number(value)*factor));
  }
  function scaleCard(base,factor){
    const card=clone(base),s=card.stats;
    for(const key of ['MAX_HP','ATK','DEF','RES','SPD','PEN','LIFESTEAL'])s[key]=Math.max(1,round(s[key]*factor));
    s.CRIT=clamp(round(s.CRIT*Math.sqrt(factor)),1,95);s.EVA=clamp(round(s.EVA*Math.sqrt(factor)),1,85);
    const walk=effects=>{for(const effect of effects||[]){if(effect.formula)effect.formula=scaleFormula(effect.formula,factor);for(const component of effect.components||[])if(component.formula)component.formula=scaleFormula(component.formula,factor);if(effect.effects)walk(effect.effects);if(effect.then)walk(effect.then);if(effect.else)walk(effect.else);}};
    for(const action of card.actions)walk(action.effects);for(const status of card.statuses){walk(status.periodic?.effects);for(const trigger of status.triggers||[])walk(trigger.effects);for(const modifier of status.modifiers||[])if(Number.isFinite(modifier.value))modifier.value=round(modifier.value*factor);}
    for(const trigger of card.triggers)walk(trigger.effects);for(const passive of card.passives){if(Number.isFinite(passive.value))passive.value=round(passive.value*factor);if(passive.formula)passive.formula=scaleFormula(passive.formula,factor);}
    return card;
  }

  function reconcileBudgetV6(base,target){
    let lo=.02,hi=64,best=null,bestDeviation=Infinity;
    while(hi<4096&&N.budgetPriceCardV6(scaleCard(base,hi)).total<target)hi*=2;
    for(let i=0;i<36;i++){
      const factor=(lo+hi)/2,card=scaleCard(base,factor),price=N.budgetPriceCardV6(card),deviation=Math.abs(price.total-target)/target;
      if(deviation<bestDeviation){best={card,price,factor};bestDeviation=deviation;}
      if(price.total<target)lo=factor;else hi=factor;
    }
    return {...best,deviation:bestDeviation};
  }

  function generateCardV6(opts={}){
    if(opts.generatorVersion!==undefined&&opts.generatorVersion!==6)throw new Error('unsupported generatorVersion: '+opts.generatorVersion);
    if('archetype' in opts)throw new Error('Generator v6 is classless: archetype is not a valid input');
    const seed=String(opts.seed??''),rarity=N.toV2RarityId(opts.rarity),level=N.normalizeLevel(opts.level),target=N.expectedStrengthV6(level,rarity);
    const st=buildStructure({seed,rarity,level}),raw=buildRawCard(st),result=reconcileBudgetV6(raw,target),card=result.card;
    if(!result||result.deviation>.05)throw new Error(`v6 budget reconciliation failed for ${seed}: ${result?.price?.total} vs ${target}`);
    card.expectedStrength=target;card.generationStrengthBudget=target;
    const ledger=N.budgetLedgerV6(target),p=result.price;
    ledger.spent.offense=p.offense||0;ledger.spent.durability=p.defense||0;ledger.spent.sustain=p.sustain||0;ledger.spent.control=p.control||0;ledger.spent.tempo=p.tempo||0;ledger.spent.economy=p.economy||0;ledger.spent.reliability=p.reliability||0;
    ledger.pricedStrength=p.total;ledger.deviation=round((p.total-target)/target);ledger.reconciliationFactor=round(result.factor);N.closeBudgetLedgerV6(ledger);card.strengthLedger=ledger;
    card.mechanicFingerprint=N.mechanicFingerprint(card);card.presentation={mechanicFingerprint:card.mechanicFingerprint};
    const name=typeof N.generateSpeciesName==='function'?N.generateSpeciesName(card):seed;card.name=name;card.displayName=name;
    return card;
  }

  const legacyGenerate=N.generateCardByVersion,legacyV1=N.generateCard;
  Object.assign(N,{generateCardV6,buildStructureV6:buildStructure,reconcileBudgetV6,CARD_GENERATOR_VERSION_V6:6});
  N.generateCardByVersion=(opts={})=>{
    const version=opts.generatorVersion===undefined?6:opts.generatorVersion;
    if(version===6)return generateCardV6({...opts,generatorVersion:6});
    return legacyGenerate({...opts,generatorVersion:version});
  };
  // Old direct v1 authoring calls included an archetype. Keep those reproducible,
  // while the normal classless call is now the v6 product path.
  N.generateCard=(opts={})=>{
    if(opts.generatorVersion===1||(opts.generatorVersion===undefined&&Object.hasOwn(opts,'archetype')))return legacyV1({...opts,generatorVersion:1});
    if(opts.generatorVersion!==undefined&&opts.generatorVersion!==6)return legacyV1(opts);
    return generateCardV6({...opts,generatorVersion:6});
  };
  N.generateCardV6ByVersion=N.generateCardByVersion;
  if(typeof module!=='undefined')module.exports=N;
})(typeof globalThis!=='undefined'?globalThis:window);
