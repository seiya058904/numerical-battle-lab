// Generator v4 — Classless Dynamic Generation.
//
// The v4 identity is an INDIVIDUAL, not a class:
//   identity = "v4|seed=...|rarity=...|level=..."
// There is no archetype input, no archetype weighting, and no archetype in the
// identity or the card. Primary stats are a continuous, seeded budget allocation;
// action families are weighted only by the real stats that were already rolled
// (weak correlation, never a whitelist). Every card also rolls real individual
// variables that participate in battle math:
//   VOLATILITY / LUCK            — damage & effect randomness (engine variance)
//   ENDURANCE / RAMP_* / FATIGUE_* — time dynamics (engine getStat factor)
//   ROUND / BATTLE_TURN          — formula scope symbols (engine)
// Generator v1/v2/v3 stay fully intact for legacy reproduction.
(function(root){
  'use strict';
  const N=root.NCB;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const round=x=>Math.round(x*100)/100;
  function rng(seed){return new N.Gen5PRNG(N.deriveSeed(N.seedHash(String(seed))));}
  const FAMILIES=['damage','heal','shield','ward','status','dot','consume','cleanse','dispel','resource','convert','cooldown','recoil','event','toggle'];
  const LEGACY_WORDS=/archetype|Balanced|Tank|Bruiser|Assassin|Mage|Support|Controller/;

  // ---- continuous, seeded primary allocation (no archetype ratios) ----
  // Each stat gets its own continuous value range; five INDEPENDENT seeded
  // weights pick a position inside that range, so ordinal shapes vary widely
  // (not a whitelist of archetype templates). No normalization: independence
  // is what creates real individuals.
  const PRIMARY_RANGES={
    MAX_HP:[140,420],ATK:[38,120],DEF:[24,90],RES:[20,75],SPD:[32,100],
  };
  function allocatePrimaryV4(budget,seed){
    const r=rng(seed+'|primary');
    return {MAX_HP:r.random(),ATK:r.random(),DEF:r.random(),RES:r.random(),SPD:r.random()};
  }
  function statFromShare(w,kind,scale){
    const [lo,hi]=PRIMARY_RANGES[kind]||[10,60];
    return Math.max(1,Math.round((lo+w*(hi-lo))*scale));
  }
  // individual random variables — all finite, all used by engine math later
  function individualVars(r,scale){
    const volRoll=r.random(); // 0..1
    const volatility=round(0.2+volRoll*volRoll*2.8); // skewed low: 0.2..3.0
    const luck=round(-0.9+r.random()*1.8); // -0.9..0.9
    const endurance=Math.round(r.random()*100);
    // time profile: pure growth / pure fatigue / burst-then-fatigue / stable / mixed
    const profile=r.random();
    let RAMP_START=0,RAMP_RATE=0,RAMP_CAP=1,FATIGUE_START=999,FATIGUE_RATE=0,FATIGUE_CAP=1;
    if(profile<0.28){ // late growth
      RAMP_START=4+r.random()*10;RAMP_RATE=0.008+r.random()*0.02;RAMP_CAP=round(1.15+r.random()*0.5);
    } else if(profile<0.5){ // early strong then fatigue
      FATIGUE_START=6+r.random()*8;FATIGUE_RATE=0.01+r.random()*0.025;FATIGUE_CAP=round(0.5+r.random()*0.35);
    } else if(profile<0.66){ // growth then late fatigue
      RAMP_START=3+r.random()*6;RAMP_RATE=0.006+r.random()*0.014;RAMP_CAP=round(1.1+r.random()*0.3);
      FATIGUE_START=14+r.random()*12;FATIGUE_RATE=0.006+r.random()*0.016;FATIGUE_CAP=round(0.55+r.random()*0.3);
    } else if(profile<0.82){ // low endurance fast fatigue
      FATIGUE_START=3+r.random()*5;FATIGUE_RATE=0.02+r.random()*0.03;FATIGUE_CAP=round(0.35+r.random()*0.3);
    }
    // stable profile (>=0.82) keeps RAMP_RATE=0 / FATIGUE_RATE=0 -> factor 1 forever
    return {VOLATILITY:volatility,LUCK:luck,ENDURANCE:endurance,
      RAMP_START,FATIGUE_START,RAMP_RATE:round(RAMP_RATE),FATIGUE_RATE:round(FATIGUE_RATE),RAMP_CAP,FATIGUE_CAP};
  }

  function generateCardV4(opts={}){
    if(opts.generatorVersion!==undefined&&opts.generatorVersion!==4)throw new Error('unsupported generatorVersion: '+opts.generatorVersion);
    if('archetype' in opts)throw new Error('Generator v4 is classless: archetype is not a valid input');
    const seed=String(opts.seed??''),rarity=N.toV2RarityId(opts.rarity),level=N.normalizeLevel(opts.level);
    const identity=`v4|seed=${seed}|rarity=${rarity}|level=${level}`;
    if(LEGACY_WORDS.test(identity))throw new Error('v4 identity must not contain archetype vocabulary');
    const id=N.cardId(identity),r=rng(seed+'|v4');
    const pick=a=>a[r.random(a.length)],roll=p=>r.random(100)<p;

    // --- scale: rarity+level+quality only affect BUDGET/STRENGTH, never structure ---
    const scale=N.rpiV2(rarity)/100*N.levelFactor(level)*N.qualityFactor(seed);
    const generationBudget=round(1000*scale);
    const primary=allocatePrimaryV4(520,seed);
    const stats={};
    for(const [k,v] of Object.entries(primary))stats[k]=round(statFromShare(v,k,scale));
    // secondary stats: continuous, independent
    Object.assign(stats,{
      ACC:88+r.random(12),EVA:r.random(31),CRIT:r.random(51),CRIT_DMG:140+r.random(81),
      PEN:r.random(46),LIFESTEAL:r.random(26),HEAL_POWER:90+r.random(40),HEAL_TAKEN:100,
      ENERGY_MAX:8,ENERGY_REGEN:2,
    });
    // individual random + time variables (real numbers; engine uses them)
    Object.assign(stats,individualVars(r,scale));
    const damageTypes=Object.keys(N.DAMAGE_TYPES),type=pick(damageTypes),resource=pick(['RAGE','SOUL','CHRONO']);
    stats[resource]=2;stats[resource+'_MAX']=8;const resourceRegens={[resource]:1};

    const dotId=id+':dot',buffId=id+':stance';
    const duration=2+r.random(4);
    const statuses=[
      {id:dotId,name:'侵蚀',kind:'debuff',maxStacks:3+r.random(4),stacking:pick(['stack','refresh','replace']),duration,
        periodic:{timing:'turnEnd',snapshot:pick(['apply','dynamic']),effects:[{type:'damage',damageType:type,formula:'ATK * '+round(.12*scale)+' * STACKS',canMiss:false,canCrit:false,canReflect:false}]}},
      {id:buffId,name:'战意',kind:'buff',maxStacks:2,stacking:pick(['stack','refresh','replace']),duration,
        modifiers:[{stat:pick(['ATK','DEF','SPD','EVA','CRIT']),operation:'addPerStack',value:round(7*scale)}],
        eventModifiers:[{event:'ModifyDamageTaken',operation:'multiply',value:round(1/(1+.15*scale))}],
        upkeep:{resource,amount:1,timing:'roundStart'},
        triggers:[{event:'afterDamageTaken',target:'source',effects:[{type:'damage',damageType:'physical',formula:'ATK * '+round(.12*scale),canReflect:false}]}]}
    ];

    const count=pick([2,3,3,3,3,4,4,4,4,5,6]);
    const actions=[];let hasCommand=false;
    // Weak correlation from REAL rolled stats — never a whitelist, never archetype.
    const s=stats;
    const weight={damage:1.0,heal:0.35+s.HEAL_POWER/400,shield:0.3+s.DEF/260,ward:0.25,status:0.45+s.CRIT/200,
      dot:0.4+s.PEN/120,consume:0.35+s.CRIT/260,cleanse:0.3,dispel:0.3,resource:0.4+s.ENERGY_REGEN/8,
      convert:0.3,cooldown:0.35,recoil:0.3+s.ATK/520,event:0.35,toggle:0.3};
    const weightedFamilies=[];for(const fam of FAMILIES){const w=weight[fam]||0.3;for(let i=0;i<Math.round(w*10);i++)weightedFamilies.push(fam);}
    const condition=()=>pick([{type:'hpPctBelow',value:.5},{type:'targetHpPctBelow',value:.4},{type:'resourceAtLeast',resource,value:3},{type:'targetHasStatus',status:dotId},{type:'missingStatus',status:buffId}]);
    for(let i=0;i<count;i++){
      const family=pick(weightedFamilies),share=.65+r.random(101)/100;
      const c=round(scale*share),dmg=()=>({type:'damage',damageType:pick(damageTypes),formula:'ATK * '+round(c*(.7+r.random(81)/100))});
      const a={id:id+':a'+i,name:'',kind:'utility',target:'self',cost:roll(40)?1:0,cooldown:r.random(4),priority:r.random(4)-1,accuracy:round(.8+r.random(21)/100),effects:[],_budget:round(generationBudget*.25/count)};
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
      // Independently compose secondary effects, control flow, target queries, costs.
      if(roll(45))a.effects.push(pick([{type:'gain',resource,amount:2},{type:'shield',effectTarget:'actor',formula},{type:'status',status:buffId,effectTarget:'actor',duration}]));
      if(roll(30))a.effects=[{type:'conditional',condition:condition(),then:a.effects,else:[{type:'gain',resource,amount:1}]}];
      if(roll(22))a.effects=[{type:'repeat',times:2+r.random(2),effects:a.effects}];
      if(a.target!=='self'&&roll(35)){const relation=a.target==='enemy'?'enemy':'ally';a.target='query';a.targetQuery={relation,sortBy:{kind:pick(['hpPct','shield','stat']),key:'SPD'},order:pick(['asc','desc']),limit:1+r.random(3),mode:pick(['first','all'])};}
      if(roll(25))a.costs=[{resource,amount:2+r.random(2)},{resource:'HP',amount:round(stats.MAX_HP*.03)}];
      const walk=effects=>{for(const e of effects){if(e.type==='damage'){
        e.varianceMin=roll(50)?.7:1;e.varianceMax=e.varianceMin===1?1:1.5;e.penetration=r.random(51)/100;a.critBonus=r.random(21);
        if(roll(35))e.components=[{type:e.damageType,formula:e.formula,multiplier:.6},{type:pick(damageTypes),formula:'ATK * '+round(c*.4)}];
        if(roll(25))e.formula='('+e.formula+') + '+resource+' * '+round(3*c);
      }if(e.effects)walk(e.effects);if(e.then)walk(e.then);if(e.else)walk(e.else);}};walk(a.effects);
      a.name=({damage:'突袭',recoil:'血性猛击',heal:'复苏',shield:'坚守',ward:'护符',status:'战术',dot:'侵蚀',consume:'蚀爆',cleanse:'净化',dispel:'破咒',resource:'蓄能',convert:'转化',cooldown:'回转',event:'号令',toggle:'战意'})[family];
      actions.push(a);
    }
    const triggers=[{event:pick(['roundStart','roundEnd','afterDamageTaken','afterDamageDealt','afterKill']),target:'self',effects:[{type:pick(['heal','shield']),formula:'MAX_HP * '+round(.025*scale)}]},
      {event:'afterKill',target:'self',effects:[{type:'gain',resource,amount:3}]},
      ...(hasCommand?[{event:'command',target:'self',effects:[{type:'gain',resource,amount:2}]}]:[])];
    const name=N.generateDisplayName({seed,rarity,level});
    const card={id,identity,seed,generatorVersion:4,rarity,level,name,displayName:name,generationBudget,quality:N.qualityFactor(seed),stats,actions,statuses,triggers,resourceRegens,
      resources:{ENERGY:{max:8,regen:2},[resource]:{max:8,regen:1}},resistances:{[type]:round(.15*scale)},affinities:{[type]:round(.12*scale)},
      passives:[{stat:'ATK',operation:'add',value:round(5*scale),condition:{type:'hpPctBelow',value:.5}},
        {stat:'DEF',operation:'add',formula:resource+' * '+round(2*scale)}]};
    const referenced=N.assembleCardPack(card).statuses;
    card.statuses=card.statuses.filter(s=>referenced[s.id]);
    card.mechanicFingerprint=N.mechanicFingerprint(card);
    const validation=N.validateContentPack(N.assembleCardPack(card));if(!validation.ok)throw new Error(validation.errors.join('\n'));
    return card;
  }

  // Default dispatcher: v4 unless an explicit legacy version is requested.
  const legacyGenerate=N.generateCardByVersion;
  Object.assign(N,{generateCardV4,allocatePrimaryV4,individualVars,CARD_GENERATOR_VERSION_V4:4});
  N.generateCardByVersion=(opts={})=>{
    const v=opts.generatorVersion===undefined?4:opts.generatorVersion;
    if(v===4)return generateCardV4(opts);
    return legacyGenerate(opts);
  };
  if(typeof module!=='undefined')module.exports=N;
})(typeof globalThis!=='undefined'?globalThis:window);