// Generator v5 — Classless Dynamic Generation with the Level × Rarity Envelope.
//
// v5 keeps everything good about v4 (classless, seed-deterministic, structurally
// diverse 2–6 actions, effect/condition/target/trigger/resource language,
// individual variables, ramp/fatigue/volatility/luck) and ADDS the authoritative
// strength system:
//
//   Level  -> LevelScale magnitude (how strong the whole card may live).
//   Rarity -> PowerEnvelope min/max at that level (the allowed strength band).
//   Seed   -> only a deterministic POSITION inside the band (quality percentile)
//             plus the card's mechanic structure.
//   BattlePower -> battlepower-v3, a real estimator of the card's actual value.
//
// PIPELINE (structure first, then calibrate numbers; never delete mechanics):
//   seed -> generate STRUCTURE (mechanic fingerprint, tier-invariant) with
//           RELATIVE magnitudes -> measure battlePowerV3 base -> compute target
//           from envelope -> bounded deterministic calibration scales only
//           continuous magnitudes (stats + ATK/HP coefficients + heal/shield/dot/
//           passive magnitudes) until battlePowerV3 lands in the band. Cooldown,
//           cost, resource amounts, status stacks/durations, condition thresholds
//           (already HP-relative), priority, accuracy and discrete structure are
//           NOT altered.
//
// Structural invariance: the structure PRNG uses only `seed` (never rarity/level),
// so the same seed at C+ / A+ / Lv30 / Lv100 yields the exact same mechanic
// fingerprint and action topology. Only the numeric strength (target) differs.
(function(root){
  'use strict';
  const N=root.NCB;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const round=x=>Math.round(x*100)/100;
  function rng(seed){return new N.Gen5PRNG(N.deriveSeed(N.seedHash(String(seed))))}
  const LEGACY_WORDS=/archetype|Balanced|Tank|Bruiser|Assassin|Mage|Support|Controller/;
  const PRIMARY_COSTS={MAX_HP:.5,ATK:1.3,DEF:1.1,RES:1.1,SPD:1.5};

  // ---- structure generation (tier-invariant; same as v4 shape philosophy) ----
  function buildStructure(opts){
    const seed=String(opts.seed??''),rarity=N.toV2RarityId(opts.rarity),level=N.normalizeLevel(opts.level);
    const seedToken=LEGACY_WORDS.test(seed)?Array.from(seed,c=>c.codePointAt(0).toString(16)).join('-'):seed;
    const identity=`v5|seed=${seedToken}|rarity=${rarity}|level=${level}`;
    if(LEGACY_WORDS.test(identity))throw new Error('v5 identity must not contain archetype vocabulary');
    const id=N.cardId(identity),r=rng(seed+'|v5');
    const pick=a=>a[r.random(a.length)],roll=p=>r.random(100)<p;
    const damageTypes=Object.keys(N.DAMAGE_TYPES),type=pick(damageTypes),resource=pick(['RAGE','SOUL','CHRONO']);
    const dotId=id+':dot',buffId=id+':stance';
    const duration=2+r.random(4);
    // RELATIVE strength units for the shape (calibration later scales these).
    const U=1;
    const statuses=[
      {id:dotId,name:'侵蚀',kind:'debuff',maxStacks:3+r.random(4),stacking:pick(['stack','refresh','replace']),duration,
        periodic:{timing:'turnEnd',snapshot:pick(['apply','dynamic']),effects:[{type:'damage',damageType:type,formula:'ATK * '+round(.12*U)+' * STACKS',canMiss:false,canCrit:false,canReflect:false}]}},
      {id:buffId,name:'战意',kind:'buff',maxStacks:2,stacking:pick(['stack','refresh','replace']),duration,
        modifiers:[{stat:pick(['ATK','DEF','SPD','EVA','CRIT']),operation:'addPerStack',value:round(7*U)}],
        eventModifiers:[{event:'ModifyDamageTaken',operation:'multiply',value:round(1/(1+.15*U))}],
        upkeep:{resource,amount:1,timing:'roundStart'},
        triggers:[{event:'afterDamageTaken',target:'source',effects:[{type:'damage',damageType:'physical',formula:'ATK * '+round(.12*U),canReflect:false}]}]}
    ];
    const count=pick([2,3,3,3,3,4,4,4,4,5,6]);
    const actions=[];let hasCommand=false;
    const FAMILIES=['damage','heal','shield','ward','status','dot','consume','cleanse','dispel','resource','convert','cooldown','recoil','event','toggle'];
    // Weak correlation from RELATIVE stats — never a whitelist, never archetype.
    const s=U;
    const weight={damage:1.0,heal:0.35+112/400,shield:0.3+(55/U)/260,ward:0.25,status:0.45+20/200,
      dot:0.4+20/120,consume:0.35+20/260,cleanse:0.3,dispel:0.3,resource:0.4+2/8,
      convert:0.3,cooldown:0.35,recoil:0.3+(55/U)/520,event:0.35,toggle:0.3};
    const weightedFamilies=[];for(const fam of FAMILIES){const w=weight[fam]||0.3;for(let i=0;i<Math.round(w*10);i++)weightedFamilies.push(fam);}
    const condition=()=>pick([{type:'hpPctBelow',value:.5},{type:'targetHpPctBelow',value:.4},{type:'resourceAtLeast',resource,value:3},{type:'targetHasStatus',status:dotId},{type:'missingStatus',status:buffId}]);
    for(let i=0;i<count;i++){
      const family=pick(weightedFamilies),share=.65+r.random(101)/100;
      const c=round(U*share),dmg=()=>({type:'damage',damageType:pick(damageTypes),formula:'ATK * '+round(c*(.7+r.random(81)/100))});
      const a={id:id+':a'+i,name:'',kind:'utility',target:'self',cost:roll(40)?1:0,cooldown:r.random(4),priority:r.random(4)-1,accuracy:round(.8+r.random(21)/100),effects:[],_budget:round(U*.25/count)};
      const formula='MAX_HP * '+round(.12*c);
      switch(family){
        case 'damage':a.kind='damage';a.target='enemy';a.effects=[dmg()];break;
        case 'recoil':a.kind='damage';a.target='enemy';a.effects=[{type:'selfDamagePct',pct:.06},dmg(),dmg()];break;
        case 'heal':a.kind='heal';a.target='ally';a.effects=[{type:'heal',formula}];break;
        case 'shield':a.kind='shield';a.effects=[{type:'shield',formula}];break;
        case 'ward':a.kind='shield';a.effects=[{type:'ward',damageType:type,formula}];break;
        case 'status':a.kind='status';a.target=roll(50)?'self':'enemy';a.effects=[{type:'status',status:a.target==='self'?buffId:pick(['weak','slow','vulnerable','silence']),stacks:1+r.random(2),duration}];break;
        case 'dot':a.kind='status';a.target='enemy';a.effects=[{type:'status',status:dotId,stacks:1+r.random(2),duration}];break;
        case 'consume':a.kind='damage';a.target='enemy';a.effects=[{type:'status',status:dotId,stacks:1,duration},{type:'consumeStatus',status:dotId,stacks:'all'},{type:'damage',damageType:type,formula:'ATK * '+c+' * CONSUMED_STACKS'}];break;
        case 'cleanse':a.target='ally';a.effects=[{type:'cleanse',count:1+r.random(3)}];break;
        case 'dispel':a.target='enemy';a.effects=[{type:'dispel',count:1+r.random(2),...(roll(50)?{transfer:'actor'}:{})}];break;
        case 'resource':a.effects=[{type:pick(['gain','resource']),resource,amount:2+r.random(3)}];break;
        case 'convert':a.effects=[{type:'convertResource',from:'ENERGY',to:resource,amount:2,ratio:2}];break;
        case 'cooldown':a.target='ally';a.effects=[{type:'cooldownReduce',amount:1+r.random(2)}];break;
        case 'event':hasCommand=true;a.effects=[{type:'emitEvent',event:'command',eventSubject:'actor'}];break;
        case 'toggle':a.kind='status';a.effects=[{type:'toggleStatus',status:buffId,duration}];break;
      }
      if(roll(45))a.effects.push(pick([{type:'gain',resource,amount:2},{type:'shield',effectTarget:'actor',formula},{type:'status',status:buffId,effectTarget:'actor',duration}]));
      if(roll(30))a.effects=[{type:'conditional',condition:condition(),then:a.effects,else:[{type:'gain',resource,amount:1}]}];
      if(roll(22))a.effects=[{type:'repeat',times:2+r.random(2),effects:a.effects}];
      if(a.target!=='self'&&roll(35)){const relation=a.target==='enemy'?'enemy':'ally';a.target='query';a.targetQuery={relation,sortBy:{kind:pick(['hpPct','shield','stat']),key:'SPD'},order:pick(['asc','desc']),limit:1+r.random(3),mode:pick(['first','all'])};}
      if(roll(25))a.costs=[{resource,amount:2+r.random(2)},{resource:'HP',amount:round(0.24)}]; // HP cost relative to MAX_HP
      const walk=effects=>{for(const e of effects){if(e.type==='damage'){
        e.varianceMin=roll(50)?.8:.9;e.varianceMax=e.varianceMin===.9?1.1:1.3;e.penetration=r.random(51)/100;a.critBonus=r.random(21);
        if(roll(35))e.components=[{type:e.damageType,formula:e.formula,multiplier:.6},{type:pick(damageTypes),formula:'ATK * '+round(c*.4)}];
        if(roll(25))e.formula='('+e.formula+') + '+resource+' * '+round(3*c);
      }if(e.effects)walk(e.effects);if(e.then)walk(e.then);if(e.else)walk(e.else);}};walk(a.effects);
      a.name=({damage:'突袭',recoil:'血性猛击',heal:'复苏',shield:'坚守',ward:'护符',status:'战术',dot:'侵蚀',consume:'蚀爆',cleanse:'净化',dispel:'破咒',resource:'蓄能',convert:'转化',cooldown:'回转',event:'号令',toggle:'战意'})[family];
      actions.push(a);
    }
    const triggers=[{event:pick(['roundStart','roundEnd','afterDamageTaken','afterDamageDealt','afterKill']),target:'self',effects:[{type:pick(['heal','shield']),formula:'MAX_HP * '+round(.025*U)}]},
      {event:'afterKill',target:'self',effects:[{type:'gain',resource,amount:3}]},
      ...(hasCommand?[{event:'command',target:'self',effects:[{type:'gain',resource,amount:2}]}]:[])];
    const passives=[{stat:'ATK',operation:'add',value:round(5*U),condition:{type:'hpPctBelow',value:.5}},
      {stat:'DEF',operation:'add',formula:resource+' * '+round(2*U)}];
    return {id,identity,seed,rarity,level,type,resource,dotId,buffId,duration,count,actions,statuses,triggers,passives,resourceRegens:{[resource]:1}};
  }

  // Absolute stat profile (relative to a C Lv100 unit). These are scaled by the
  // clone before calibration by scaleStrength; the envelope target decides the
  // final absolute intensity. We keep a coherent spread so raise-rarity cards are
  // not monotonically "all stats up" but stay comparable within their band.
  function baseStats(resource){
    const s={MAX_HP:52,ATK:60,DEF:40,RES:44,SPD:55,ACC:94,EVA:22,CRIT:26,CRIT_DMG:170,PEN:20,LIFESTEAL:16,HEAL_POWER:110,HEAL_TAKEN:100,ENERGY_MAX:8,ENERGY_REGEN:2,VOLATILITY:.8,LUCK:0,ENDURANCE:50,RAMP_START:9,FATIGUE_START:45,RAMP_RATE:.012,FATIGUE_RATE:.006,RAMP_CAP:1.2,FATIGUE_CAP:.9};
    if(resource){s[resource]=2;s[resource+'_MAX']=8;}
    return s;
  }

  function generateCardV5(opts={}){
    if(opts.generatorVersion!==undefined&&opts.generatorVersion!==5)throw new Error('unsupported generatorVersion: '+opts.generatorVersion);
    if('archetype' in opts)throw new Error('Generator v5 is classless: archetype is not a valid input');
    const seed=String(opts.seed??''),rarity=N.toV2RarityId(opts.rarity),level=N.normalizeLevel(opts.level);
    const st=buildStructure({seed,rarity,level});
    // Compose the unit-shape card with tier-invariant stats + RELATIVE coefficients.
    const stats=baseStats(st.resource);
    // add individual time/random variables seeded from the seed (deterministic, tier-invariant)
    stats.VOLATILITY=round(0.2+Math.pow(rng(seed+'|iv').random(),2)*2.8);
    stats.LUCK=round(-0.9+rng(seed+'|iv2').random()*1.8);
    stats.ENDURANCE=Math.round(rng(seed+'|end').random()*100);
    let card={id:st.id,identity:st.identity,seed,generatorVersion:5,rarity,level,
      name:'',displayName:'',stats,actions:st.actions,statuses:st.statuses,triggers:st.triggers,
      passives:st.passives,resourceRegens:st.resourceRegens,
      resources:{ENERGY:{max:8,regen:2},[st.resource]:{max:8,regen:1}},
      resistances:{[st.type]:0.02},affinities:{[st.type]:0.02},
      _shapeLevel:1,_shape:{id:st.id,count:st.count,type:st.type,resource:st.resource}};
    const referenced=N.assembleCardPack(card).statuses;
    card.statuses=card.statuses.filter(s=>referenced[s.id]);
    card.mechanicFingerprint=N.mechanicFingerprint(card);

    // --- strength: envelope target, then bounded calibration ---
    const env=N.powerEnvelope(level,rarity);
    const target=N.targetPower(level,rarity,seed);
    const calib=N.battlePowerV3Calibrate(card,target,{maxIterations:30,tolerance:0.004,envelope:{min:env.min,max:env.max}});
    card=calib.card;
    card.mechanicFingerprint=N.mechanicFingerprint(card); // unchanged by strength edits, re-assert
    const bp=N.battlePowerV3(card);
    card.generationBudget=round(target); // informational anchor only (not read by v3 v5 BP)
    card.targetPower=round(target);
    card.powerEnvelope={min:round(env.min),target:round(env.target),max:round(env.max)};
    card.power= bp.power;
    card._calibration={base:calib.power,target:round(target),delta:calib.delta,iterations:calib.iterations,converged:calib.converged};
    card.presentation=card.presentation||{};
    card.presentation.power=bp.power;
    card.presentation.powerEnvelope={min:round(env.min),target:round(target),max:round(env.max)};
    card.presentation.mechanicFingerprint=card.mechanicFingerprint;
    // --- naming: species proper-name from seed + structural identity (no level/rarity) ---
    const spName=(typeof N.generateSpeciesName==='function')?N.generateSpeciesName(card):(card.seed);
    card.name=spName;card.displayName=spName;
    return card;
  }

  // ---- default dispatcher: v5 unless an explicit legacy version is requested ---
  const legacyGenerate=N.generateCardByVersion;
  Object.assign(N,{generateCardV5,buildStructure,CARD_GENERATOR_VERSION_V5:5});
  N.generateCardByVersion=(opts={})=>{
    const v=opts.generatorVersion===undefined?5:opts.generatorVersion;
    if(v===5)return generateCardV5(opts);
    return legacyGenerate(opts);
  };
  if(typeof module!=='undefined')module.exports=N;
})(typeof globalThis!=='undefined'?globalThis:window);