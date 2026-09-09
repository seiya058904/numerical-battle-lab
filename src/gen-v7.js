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
    const victoryPath=pick(random,['direct','burst','dot','drain','control','resource','tempo','reflect']);
    const count=pick(random,[2,3,3,3,4,4,4,5,5,6]);
    const pool=['direct','burst','dot','drain','control','barrier','sustain','resource','tempo','cleanse','dispel','reflect'];
    const actionFamilies=[victoryPath];
    while(actionFamilies.length<count)actionFamilies.push(pick(random,pool));
    if(!actionFamilies.some(family=>DAMAGE_FAMILIES.has(family)))actionFamilies[1]='direct';
    return {version:7,retry,scalable:true,victoryPath,actionFamilies,damageType:pick(random,Object.keys(N.DAMAGE_TYPES)),resource:pick(random,['RAGE','SOUL','CHRONO']),duration:2+random.random(4),statusPolicy:pick(random,['stack','refresh','replace']),triggerEvent:pick(random,['roundStart','roundEnd','afterDamageTaken','afterDamageDealt','afterKill'])};
  }
  function mechanicSkeletonV7(seed){
    for(let retry=0;retry<8;retry++){const candidate=skeletonCandidate(String(seed??''),retry);if(candidate.actionFamilies.length>=2&&candidate.actionFamilies.length<=6&&candidate.actionFamilies.some(family=>DAMAGE_FAMILIES.has(family)))return candidate;}
    throw new Error('v7 seed-only skeleton is not scalable');
  }
  function baseStats(genome,random){
    return {MAX_HP:round(850*(.7+.65*genome.endurance)),ATK:round(85*(.7+.65*genome.pressure)),DEF:round(75*(.65+.75*genome.endurance)),RES:round(75*(.65+.75*genome.endurance)),SPD:round(90*(.7+.65*genome.tempo)),
      ACC:round(80+45*genome.reliability),EVA:round(8+42*genome.reliability),CRIT:round(5+30*genome.pressure),CRIT_DMG:round(140+55*genome.pressure),PEN:round(4+35*genome.pressure),LIFESTEAL:round(18*genome.sustain),HEAL_POWER:round(75+80*genome.sustain),HEAL_TAKEN:100,
      ENERGY_MAX:8,ENERGY_REGEN:round(1+4*genome.economy),VOLATILITY:round(.35+2.1*random.random()),LUCK:round(-.7+1.4*random.random()),ENDURANCE:Math.round(100*genome.endurance),RAMP_START:8,FATIGUE_START:45,RAMP_RATE:round(.003+.014*genome.triggers),FATIGUE_RATE:.004,RAMP_CAP:round(1.08+.28*genome.triggers),FATIGUE_CAP:.92};
  }
  function buildUnsolvedCard(seed,rarity,level,skeleton,genome){
    const identity=`v7|seed=${seed}|rarity=${rarity}|level=${level}`,id=N.cardId(identity),random=randomFor(seed,'v7-numbers');
    const statusId=id+':periodic',buffId=id+':stance',stats=baseStats(genome,random);stats[skeleton.resource]=2;stats[skeleton.resource+'_MAX']=8;
    const damage=(coefficient=.9,extra={})=>({type:'damage',damageType:skeleton.damageType,formula:`ATK * ${round(coefficient)}`,varianceMin:.88,varianceMax:1.12,...extra});
    const periodic={id:statusId,name:'蚀印',kind:'debuff',maxStacks:4,stacking:skeleton.statusPolicy,duration:skeleton.duration,periodic:{timing:'turnEnd',snapshot:'dynamic',effects:[damage(.18,{canMiss:false,canCrit:false,canReflect:false})]}};
    const stance={id:buffId,name:'调律',kind:'buff',maxStacks:1,stacking:'refresh',duration:skeleton.duration,modifiers:[{stat:pick(random,['ATK','DEF','RES','SPD']),operation:'multiply',value:1.08}]};
    const makeAction=(family,index)=>{
      const action={id:id+':a'+index,name:'',kind:'utility',target:'self',cost:random.random(3),cooldown:random.random(3),priority:random.random(5)-2,accuracy:round(.78+.2*genome.reliability),effects:[]};
      switch(family){
        case 'direct':action.name='精确打击';action.kind='damage';action.target='enemy';action.effects=[damage(.75+genome.pressure)];break;
        case 'burst':action.name='裂变突袭';action.kind='damage';action.target='enemy';action.cooldown=2;action.effects=[damage(.55+genome.pressure*.55,{hits:2})];break;
        case 'dot':action.name='蚀印扩散';action.kind='status';action.target='enemy';action.effects=[{type:'status',status:statusId,stacks:1+random.random(2),duration:skeleton.duration,chance:round(.65+.3*genome.reliability)}];break;
        case 'drain':action.name='汲取';action.kind='damage';action.target='enemy';action.effects=[damage(.65+genome.pressure*.7,{drainRatio:round(.08+.22*genome.sustain)})];break;
        case 'control':action.name='压制';action.kind='damage';action.target='enemy';action.effects=[damage(.45+genome.pressure*.45),{type:'status',status:pick(random,['slow','weak','silence','vulnerable']),stacks:1,duration:1+Math.round(2*genome.control),chance:round(.25+.55*genome.control)}];break;
        case 'barrier':action.name='屏障';action.kind='shield';action.effects=[{type:pick(random,['shield','ward']),damageType:skeleton.damageType,formula:`MAX_HP * ${round(.08+.2*genome.endurance)}`}];break;
        case 'sustain':action.name='再生';action.kind='heal';action.target='ally';action.effects=[{type:'heal',formula:`MAX_HP * ${round(.06+.18*genome.sustain)}`}];break;
        case 'resource':action.name='蓄能轰击';action.kind='damage';action.target='enemy';action.effects=[{type:'gain',resource:skeleton.resource,amount:2+random.random(3)},damage(.5+genome.pressure*.5)];break;
        case 'tempo':action.name='先制';action.kind='damage';action.target='enemy';action.cooldown=0;action.priority=2+Math.round(3*genome.tempo);action.effects=[damage(.5+genome.pressure*.55)];break;
        case 'cleanse':action.name='净化';action.target='ally';action.effects=[{type:'cleanse',count:1+random.random(2)}];break;
        case 'dispel':action.name='破除';action.target='enemy';action.effects=[{type:'dispel',count:1+random.random(2)}];break;
        case 'reflect':action.name='反射架势';action.kind='status';action.effects=[{type:'status',status:buffId,duration:skeleton.duration}];break;
      }
      return action;
    };
    const actions=skeleton.actionFamilies.map(makeAction);
    const triggers=[{id:id+':pressure-backbone',event:'roundStart',target:'all-enemies',effects:[damage(20,{damageType:'true',canReflect:false})]}];
    if(skeleton.victoryPath==='reflect'||genome.triggers>.72)triggers.push({event:'afterDamageTaken',target:'source',effects:[damage(.18+.35*genome.triggers,{canReflect:false})]});
    if(genome.sustain>.75)triggers.push({event:skeleton.triggerEvent,target:'self',effects:[{type:'heal',formula:`MAX_HP * ${round(.015+.035*genome.sustain)}`}]});
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
