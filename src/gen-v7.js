// Generator v7 — seed-only mechanics plus content-only iso-power solving.
(function(root){
  'use strict';
  const N=root.NCB=root.NCB||{};
  const round=value=>Math.round(Number(value)*1e6)/1e6;
  const pick=(random,list)=>list[random.random(list.length)];
  const clone=value=>JSON.parse(JSON.stringify(value));
  const DAMAGE_FAMILIES=new Set(['direct','burst','dot','drain','control','resource','tempo','reflect']);
  function randomFor(seed,salt){return new N.Gen5PRNG(N.deriveSeed(N.seedHash(String(seed)+'|'+salt)));}

  function skeletonCandidate(seed,retry){
    const random=randomFor(seed,'v7-skeleton-'+retry);
    const scalableDamageTypes=Object.keys(N.DAMAGE_TYPES).filter(type=>type!=='true');
    const victoryPath=pick(random,['direct','burst','dot','drain','control','resource','tempo','reflect']);
    const count=6;
    const actionFamilies=['backbone','direct','control','barrier','sustain',victoryPath];
    if(!actionFamilies.some(family=>DAMAGE_FAMILIES.has(family)))actionFamilies[1]='direct';
    return {version:7,retry,scalable:true,victoryPath,actionFamilies,damageType:pick(random,scalableDamageTypes),resource:pick(random,['RAGE','SOUL','CHRONO']),duration:2+random.random(4),statusPolicy:pick(random,['stack','refresh','replace']),triggerEvent:pick(random,['roundStart','roundEnd','afterDamageTaken','afterDamageDealt','afterKill'])};
  }
  function mechanicSkeletonV7(seed){
    for(let retry=0;retry<8;retry++){const candidate=skeletonCandidate(String(seed??''),retry);if(candidate.actionFamilies.length>=2&&candidate.actionFamilies.length<=6&&candidate.actionFamilies.some(family=>DAMAGE_FAMILIES.has(family)))return candidate;}
    throw new Error('v7 seed-only skeleton is not scalable');
  }
  function baseStats(genome,random){
    return {MAX_HP:34000,ATK:85,DEF:75,RES:75,SPD:100,ACC:100,EVA:30,CRIT:17.5,CRIT_DMG:152,PEN:17.5,LIFESTEAL:0,HEAL_POWER:100,HEAL_TAKEN:100,
      ENERGY_MAX:10,ENERGY_REGEN:round(1+2.5*genome.economy),POTENCY:round(80+40*genome.triggers),CONTROL_POWER:round(80+40*genome.control),
      TENACITY:round(80+40*genome.reliability),RECOVERY:round(80+40*genome.tempo),BARRIER_POWER:round(80+40*genome.endurance),
      VOLATILITY:1,LUCK:0,ENDURANCE:50,RAMP_START:8,FATIGUE_START:45,RAMP_RATE:.01,FATIGUE_RATE:.004,RAMP_CAP:1.18,FATIGUE_CAP:.92};
  }
  function buildUnsolvedCard(seed,rarity,level,skeleton,genome){
    const identity=`v7|seed=${seed}|rarity=${rarity}|level=${level}`,id=N.cardId(identity),random=randomFor(seed,'v7-numbers');
    const statusId=id+':periodic',buffId=id+':stance',stats=baseStats(genome,random);stats[skeleton.resource]=2;stats[skeleton.resource+'_MAX']=8;
    const damage=(coefficient=.9,extra={})=>({type:'damage',damageType:skeleton.damageType,formula:`ATK * ${round(coefficient)}`,varianceMin:.88,varianceMax:1.12,...extra});
    const anchorFormula='55 * (ATK + 1) * (0.02 + ACC / 100) * (0.70 + PEN / 100)';
    const periodic={id:statusId,name:'蚀印',kind:'debuff',maxStacks:4,stacking:skeleton.statusPolicy,duration:skeleton.duration,periodic:{timing:'turnEnd',snapshot:'dynamic',effects:[damage(4,{canMiss:false,canCrit:false,canReflect:false,tags:['dot','periodic']})]}};
    const stance={id:buffId,name:'调律',kind:'buff',maxStacks:1,stacking:'refresh',duration:skeleton.duration,modifiers:[{stat:pick(random,['ATK','DEF','RES','SPD']),operation:'multiply',value:1.01}]};
    const makeAction=(family,index)=>{
      const action={id:id+':a'+index,name:'',kind:'utility',target:'self',cost:1+random.random(5),cooldown:1+random.random(4),priority:random.random(5)-2,accuracy:round(.72+.24*genome.reliability),effects:[]};
      switch(family){
        case 'backbone':action.name='基础攻势';action.kind='damage';action.target='enemy';action.cost=0;action.cooldown=1;action.priority=10;action.accuracy=.78;action.effects=[damage(1,{formula:anchorFormula,canMiss:true,canReflect:false,strengthAnchor:true,varianceMin:.65,varianceMax:1.35}),{type:'status',status:statusId,stacks:1,duration:skeleton.duration,chance:round(.55+.3*genome.triggers)}];break;
        case 'direct':action.name='精确打击';action.kind='damage';action.target='enemy';action.effects=[damage(24+genome.pressure*24)];break;
        case 'burst':action.name='裂变突袭';action.kind='damage';action.target='enemy';action.cooldown=3;action.effects=[damage(16+genome.pressure*16,{hits:2})];break;
        case 'dot':action.name='蚀印扩散';action.kind='status';action.target='enemy';action.effects=[{type:'status',status:statusId,stacks:1+random.random(2),duration:skeleton.duration,chance:round(.65+.3*genome.reliability)}];break;
        case 'drain':action.name='汲取';action.kind='damage';action.target='enemy';action.effects=[damage(20+genome.pressure*20,{drainRatio:round(.08+.22*genome.sustain)})];break;
        case 'control':action.name='压制';action.kind='damage';action.target='enemy';action.cost=0;action.cooldown=2;action.effects=[damage(14+genome.pressure*14),{type:'status',status:pick(random,['stun','slow','silence']),stacks:1,duration:2,chance:round(.6+.3*genome.control)}];break;
        case 'barrier':action.name='屏障';action.kind='shield';action.cost=0;action.cooldown=2;action.effects=[{type:pick(random,['shield','ward']),damageType:skeleton.damageType,formula:`MAX_HP * ${round(.58+.24*genome.endurance)}`}];break;
        case 'sustain':action.name='再生';action.kind='heal';action.target='ally';action.cost=0;action.cooldown=2;action.effects=[{type:'heal',formula:`MAX_HP * ${round(.62+.24*genome.sustain)}`}];break;
        case 'resource':action.name='蓄能轰击';action.kind='damage';action.target='enemy';action.effects=[{type:'gain',resource:skeleton.resource,amount:2+random.random(3)},damage(18+genome.pressure*20)];break;
        case 'tempo':action.name='先制';action.kind='damage';action.target='enemy';action.cooldown=1;action.priority=2+Math.round(3*genome.tempo);action.effects=[damage(18+genome.pressure*20)];break;
        case 'cleanse':action.name='净化';action.target='ally';action.effects=[{type:'cleanse',count:1+random.random(2)}];break;
        case 'dispel':action.name='破除';action.target='enemy';action.effects=[{type:'dispel',count:1+random.random(2)}];break;
        case 'reflect':action.name='反射架势';action.kind='status';action.effects=[{type:'status',status:buffId,duration:skeleton.duration}];break;
      }
      if(family!=='backbone'){
        if(action.target==='self'||action.target==='ally'){
          action.effects=action.effects.map(effect=>({...effect,effectTarget:'actor'}));
          action.target='enemy';
        }
        action.accuracy=round(.72+.24*genome.reliability);
        action.effects.unshift(damage(1,{formula:anchorFormula,canMiss:true,canReflect:false,strengthAnchor:true,varianceMin:.65,varianceMax:1.35}));
      }
      return action;
    };
    const actions=skeleton.actionFamilies.map(makeAction);
    const triggers=[{event:'afterStatusInflicted',target:'enemy',effects:[damage(120,{damageType:skeleton.damageType,canMiss:false,canCrit:false,canReflect:false,tags:['trigger','potency']})]}];
    const card={id,identity,seed,generatorVersion:7,rarity,level,name:'',displayName:'',stats,actions,statuses:[periodic,stance],triggers,passives:[],resourceRegens:{[skeleton.resource]:1},resources:{ENERGY:{max:8,regen:stats.ENERGY_REGEN},[skeleton.resource]:{max:8,regen:1}},resistances:{[skeleton.damageType]:round(.03+.12*genome.endurance)},affinities:{[skeleton.damageType]:round(.02+.08*genome.sustain)},styleGenome:clone(genome),skeleton:clone(skeleton)};
    const referenced=N.assembleCardPack(card).statuses;card.statuses=card.statuses.filter(status=>referenced[status.id]);
    return card;
  }
  function generateCardV7(opts={}){
    if(opts.generatorVersion!==undefined&&opts.generatorVersion!==7)throw new Error('unsupported generatorVersion: '+opts.generatorVersion);
    if('archetype' in opts)throw new Error('Generator v7 is classless: archetype is not a valid input');
    const seed=String(opts.seed??''),rarity=N.toV2RarityId(opts.rarity),level=N.normalizeLevel(opts.level),targetTheta=N.targetThetaV7(level,rarity);
    const genome=N.styleGenomeV7(seed),skeleton=mechanicSkeletonV7(seed),base=buildUnsolvedCard(seed,rarity,level,skeleton,genome),result=N.solveCardV7(base,genome,targetTheta),card=result.card;
    if(!result.converged)throw new Error(`v7 solver failed for ${seed}: ${result.predictedTheta} vs ${targetTheta}`);
    card.targetTheta=round(targetTheta);card.strengthModel={version:7,predictedTheta:round(result.predictedTheta),error:round(result.error)};card.solver={version:7,iterations:result.iterations,converged:result.converged,tolerance:result.tolerance,knobUpdates:result.knobUpdates};
    card.mechanicFingerprint=N.mechanicFingerprint(card);card.presentation={mechanicFingerprint:card.mechanicFingerprint};
    const name=N.generateSpeciesName?N.generateSpeciesName(card):seed;card.name=name;card.displayName=name;
    const validation=N.validateContentPack(N.assembleCardPack(card));if(!validation.ok)throw new Error(validation.errors.join('\n'));
    return card;
  }
  Object.assign(N,{mechanicSkeletonV7,buildUnsolvedCardV7:buildUnsolvedCard,generateCardV7,CARD_GENERATOR_VERSION_V7:7});
  if(typeof module!=='undefined')module.exports=N;
})(typeof globalThis!=='undefined'?globalThis:window);
