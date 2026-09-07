(function(root){
  'use strict';
  const N=root.NCB;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const round=x=>Math.round(x*100)/100;
  const ROLES={Balanced:[],Tank:['shield','ward','status'],Bruiser:['damage','recoil'],Assassin:['damage','consume'],Mage:['damage','dot'],Support:['heal','cleanse','resource'],Controller:['status','dispel','dot']};
  const FAMILIES=['damage','heal','shield','ward','status','dot','consume','cleanse','dispel','resource','convert','cooldown','recoil','event','toggle'];
  function rng(seed){return new N.Gen5PRNG(N.deriveSeed(N.seedHash(String(seed))));}
  function getCardActions(card){return card.actions||card.skills||[];}
  function assembleCardPack(card){
    const actions=getCardActions(card);
    const pack=N.assembleCardPackV2({...card,skills:actions});
    const unit=pack.units[card.id];
    unit.affinities=clone(card.affinities||{});
    unit.resourceRegens=clone(card.resourceRegens||{});
    const local=Array.isArray(card.statuses)?Object.fromEntries(card.statuses.map(s=>[s.id,s])):(card.statuses||{});
    const catalog={...N.STATUS_DEFS,...local};
    const visit=x=>{if(!x||typeof x!=='object')return;if(x.status&&catalog[x.status]&&!pack.statuses[x.status]){pack.statuses[x.status]=clone(catalog[x.status]);visit(pack.statuses[x.status]);}for(const v of Object.values(x))if(v&&typeof v==='object')visit(v);};
    visit(actions);visit(card.triggers);visit(card.passives);
    return clone(pack);
  }
  function deployCard(card){
    const pack=assembleCardPack(card),v=N.validateContentPack(pack);
    if(!v.ok)throw new Error(v.errors.join('\n'));
    Object.assign(N.UNIT_DEFS,pack.units);Object.assign(N.SKILL_DEFS,pack.skills);Object.assign(N.STATUS_DEFS,pack.statuses);
    return card.id;
  }
  // Structural identity excludes labels, seeds, rarity, numeric constants and IDs.
  // Formula symbols and operators remain, so resource scaling differs from ATK scaling.
  function mechanicFingerprint(card){
    const local=Object.fromEntries((card.statuses||[]).map((s,i)=>[s.id,'status'+i]));
    const omit=new Set(['id','name','displayName','_budget','tags']);
    const shape=x=>{
      if(typeof x==='number')return '#';
      if(typeof x==='string')return local[x]||x;
      if(Array.isArray(x))return x.map(shape);
      if(!x||typeof x!=='object')return x;
      return Object.fromEntries(Object.keys(x).sort().filter(k=>!omit.has(k)).map(k=>[k,k==='formula'?String(x[k]).replace(/\d+(?:\.\d+)?/g,'#'):shape(x[k])]));
    };
    return JSON.stringify(shape({actions:getCardActions(card),statuses:card.statuses||[],triggers:card.triggers||[],passives:card.passives||[],resourceRegens:card.resourceRegens||{}}));
  }
  function generateCardV3(opts={}){
    if(opts.generatorVersion!==undefined&&opts.generatorVersion!==3)throw new Error('unsupported generatorVersion: '+opts.generatorVersion);
    const seed=String(opts.seed??''),rarity=N.toV2RarityId(opts.rarity),level=N.normalizeLevel(opts.level),archetype=opts.archetype||'Balanced';
    if(!ROLES[archetype])throw new Error('unknown archetype: '+archetype);
    const tags=(opts.tags||[]).map(String).sort();
    const identity=`v3|seed=${seed}|rarity=${rarity}|level=${level}|archetype=${archetype}|tags=${tags.join(',')}`;
    const id=N.cardId(identity),r=rng(seed+'|'+archetype+'|'+tags.join(','));
    const pick=a=>a[r.random(a.length)],roll=p=>r.random(100)<p;
    // No fitted matchup table. RPI allocates strength, never an engine multiplier.
    const scale=N.rpiV2(rarity)/100*N.levelFactor(level)*N.qualityFactor(seed);
    const generationBudget=round(1000*scale);
    const primary=N.allocatePrimary({budget:520,archetype,seed,conversion:N.V2_PRIMARY_CONVERSION}).stats;
    const stats={};for(const [k,v] of Object.entries(primary))stats[k]=round(v*scale);
    Object.assign(stats,{ACC:88+r.random(12),EVA:r.random(31),CRIT:r.random(51),CRIT_DMG:140+r.random(81),PEN:r.random(46),LIFESTEAL:r.random(26),HEAL_POWER:100,HEAL_TAKEN:100,ENERGY_MAX:8,ENERGY_REGEN:2});
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
    const actions=[];
    const condition=()=>pick([{type:'hpPctBelow',value:.5},{type:'targetHpPctBelow',value:.4},{type:'resourceAtLeast',resource,value:3},{type:'targetHasStatus',status:dotId},{type:'missingStatus',status:buffId}]);
    for(let i=0;i<count;i++){
      const weighted=FAMILIES.concat(ROLES[archetype],ROLES[archetype]);
      const family=pick(weighted),share=.65+r.random(101)/100;
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
        case 'event':a.effects=[{type:'emitEvent',event:'afterKill',eventSubject:'actor'}];break;
        case 'toggle':a.kind='status';a.effects=[{type:'toggleStatus',status:buffId,duration}];break;
      }
      // Independently compose secondary effects, control flow, target queries and costs.
      if(roll(45))a.effects.push(pick([{type:'gain',resource,amount:2},{type:'shield',effectTarget:'actor',formula},{type:'status',status:buffId,effectTarget:'actor',duration}]));
      if(roll(30))a.effects=[{type:'conditional',condition:condition(),then:a.effects,else:[{type:'gain',resource,amount:1}]}];
      if(roll(22))a.effects=[{type:'repeat',times:2+r.random(2),effects:a.effects}];
      if(a.target!=='self'&&roll(35)){
        const relation=a.target==='enemy'?'enemy':'ally';a.target='query';a.targetQuery={relation,sortBy:{kind:pick(['hpPct','shield','stat']),key:'SPD'},order:pick(['asc','desc']),limit:1+r.random(3),mode:pick(['first','all'])};
      }
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
      {event:'afterKill',target:'self',effects:[{type:'gain',resource,amount:3}]}];
    const name=N.generateDisplayName({seed,rarity,level,archetype});
    const card={id,identity,seed,generatorVersion:3,rarity,level,archetype,name,displayName:name,generationBudget,quality:N.qualityFactor(seed),stats,actions,statuses,triggers,resourceRegens,
      resources:{ENERGY:{max:8,regen:2},[resource]:{max:8,regen:1}},resistances:{[type]:round(.15*scale)},affinities:{[type]:round(.12*scale)},
      passives:[{stat:'ATK',operation:'add',value:round(5*scale),condition:{type:'hpPctBelow',value:.5}},
        {stat:'DEF',operation:'add',formula:resource+' * '+round(2*scale)}],tags};
    const referenced=assembleCardPack(card).statuses;
    card.statuses=card.statuses.filter(s=>referenced[s.id]);
    card.mechanicFingerprint=mechanicFingerprint(card);
    const validation=N.validateContentPack(assembleCardPack(card));if(!validation.ok)throw new Error(validation.errors.join('\n'));
    return card;
  }
  const legacyGenerate=N.generateCardByVersion;
  Object.assign(N,{getCardActions,assembleCardPack,deployCard,generateCardV3,mechanicFingerprint,CARD_GENERATOR_VERSION_V3:3});
  N.generateCardByVersion=(opts={})=>opts.generatorVersion===undefined||opts.generatorVersion===3?generateCardV3(opts):legacyGenerate(opts);
  if(typeof module!=='undefined')module.exports=N;
})(typeof globalThis!=='undefined'?globalThis:window);
