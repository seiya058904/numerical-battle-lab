// Generator v6 — Power Budget Contract generation.
//
// v6 makes Level × Rarity the dominant source of REAL combat strength in THIS
// engine by pinning the two decisive real-combat quantities directly to the
// TotalStrengthBudget:
//
//   level,rarity -> TotalStrengthBudget = ExpectedStrength(level,rarity)
//     MAX_HP  = hMax(level,rarity)   (effective HP pool; ∝ budget)
//     ATK     = aMax(level,rarity)   (raw attack; ∝ budget)
//     actionKit normalized so real DPS = ATK × Σ(effective coeffs) == kDPS × budget
//
// Why this pins real dominance (engine.js combat math):
//   * damage per round  = ATK × Σ(coeff × hits × repeat × freq × acc × targets);
//     normalizing the kit so this equals kDPS×budget makes real output ∝ budget.
//   * effective HP pool = MAX_HP (mitigation 100/(100+DEF) saturates, so HP is
//     the dominant tank lever); MAX_HP ∝ budget gives durability ∝ budget.
//   A higher-budget card therefore both deals ∝budget damage AND survives ∝budget
//   fire => its time-to-kill advantage over a lower-tier card is MULTIPLICATIVE,
//   yielding strong, real (never hidden) win dominance for Level/Rarity gaps.
//
// `Seed` can only RE-ALLOCATE within this fixed total (stat-vs-mech split and the
// style: offensive vs control vs sustain vs tank). Its aggregate real strength is
// pinned to the tier, so within-tier aggregate win rates cluster near 50/50 while
// cross-tier gaps are unambiguous. All of this is generation-time budget
// accounting — NOT post-hoc stat scaling of a runaway structure.
(function(root){
  'use strict';
  const N=root.NCB;
  const round=v=>Math.round((Number(v)||0)*100)/100;
  const clampV=(v,a,b)=>Math.max(a,Math.min(b,v));
  function rng(seed){return new N.Gen5PRNG(N.deriveSeed(N.seedHash(String(seed))));}
  const LEGACY_WORDS=/archetype|Balanced|Tank|Bruiser|Assassin|Mage|Support|Controller/;
  const FAM=['damage','heal','shield','ward','status','dot','consume','cleanse','dispel','resource','convert','cooldown','recoil','event','toggle'];

  // ---- Level × Rarity physical panel anchors (∝ budget) ----
  // The physical panel is a FIXED function of budget (identical for every seed at
  // the same level/rarity) so that real strength is pinned to the tier; the seed
  // expresses style ONLY through the kit (actions/statuses/triggers), never by
  // silently changing ATK/HP/DEF. Only SPD jitters mildly for turn-order flavor.
  function panelFor(budget,seed){
    const r=rng(seed+'|v6panel');
    const atk=Math.round(budget*0.16);
    const hp=Math.round(budget*1.55);
    const def=Math.round(budget*0.055);
    const res=Math.round(budget*0.055);
    const spd=Math.round(40+budget*0.015*(1+r.random()));
    return {atk,hp,def,res,spd};
  }

  // ---- effective per-action coefficients (frequency/accuracy/target weighted) ----
  function effectiveCoeffs(card,action){
    const stats=card.stats;
    const scope={...stats,HP:stats.MAX_HP*.6,HP_PCT:.6,MISSING_HP:stats.MAX_HP*.4,ENERGY:4,ROUND:18,BATTLE_TURN:18,STACKS:2,CONSUMED_STACKS:2,TARGET_HP:stats.MAX_HP*.6,TARGET_MAX_HP:stats.MAX_HP};
    const ev=f=>{try{const v=Number(N.evaluateExpression(String(f||'0'),scope));return Number.isFinite(v)?Math.max(0,v):0;}catch(_){return 0;}};
    const cd=Number(action.cooldown||0),acc=Number(action.accuracy??1)||1;
    const freq=1/(1+cd);
    let afford=1;const regen=stats.ENERGY_REGEN||2;
    if(Number(action.cost||0)>0)afford=Math.min(afford,clampV(regen/(Math.max(1,action.cost)*1.4),0,1));
    for(const c of action.costs||[])if(c.resource!=='HP'&&Number(c.amount||0)>0)afford=Math.min(afford,0.6);
    const usable=freq*afford*acc;
    const targets=action.target==='all-enemies'||action.target==='all-allies'?3:(action.targetQuery?.mode==='all'?Math.max(1,action.targetQuery.limit||1):1);
    const agg={dmg:0,heal:0,shield:0,control:0,economy:0};
    const walk=(effs,mult,depth=0)=>{if(depth>6)return;for(const e of effs||[]){const w=Number(mult||1);
      if(e.type==='conditional'){const p=.5;walk(e.then,w*p,depth+1);walk(e.else,w*(1-p),depth+1);continue;}
      if(e.type==='repeat'){walk(e.effects,w*clampV(Number(e.times||1),1,16),depth+1);continue;}
      if(e.type==='damage'){
        const comps=e.components||[{formula:e.formula||'0',multiplier:1}];
        const hits=clampV(Number(e.hits??1)||1,1,32);
        const mid=(Number(e.varianceMin??1)+Number(e.varianceMax??1))/2;
        let coeff=0;
        for(const c of comps){const f=String(c.formula||e.formula||'0');
          const m=f.match(/ATK\s*\*\s*([0-9]+(?:\.[0-9]+)?)/);
          if(m)coeff+=Number(m[1])*Number(c.multiplier??1);else coeff+=(ev(f)/Math.max(1,stats.ATK))*Number(c.multiplier??1);}
        coeff=coeff*hits*mid;
        if(Number(e.recoilRatio||0))coeff-=coeff*Number(e.recoilRatio||0);
        agg.dmg+=coeff*w;
      } else if(e.type==='heal'){
        const f=String(e.formula||'0');const m=f.match(/MAX_HP\s*\*\s*([0-9]+(?:\.[0-9]+)?)/);
        agg.heal+=(m?Number(m[1]):ev(f)/Math.max(1,stats.MAX_HP))*w;
      } else if(e.type==='shield'||e.type==='ward'){
        const f=String(e.formula||'0');const m=f.match(/MAX_HP\s*\*\s*([0-9]+(?:\.[0-9]+)?)/);
        agg.shield+=(m?Number(m[1]):ev(f)/Math.max(1,stats.MAX_HP))*w;
      } else if(e.type==='status'||e.type==='toggleStatus'){
        const def=N.STATUS_DEFS?.[e.status];const fl=def&&def.flags?def.flags:null;
        agg.control+=(fl&&fl.stun?4:fl&&fl.silence?2:1)*w*Number(e.chance??1);
        if(def?.periodic?.effects){const ticks=clampV(Number(e.duration??def.duration??3),1,6);for(const te of def.periodic.effects||[]){
          if(te.type==='damage'){const f=String(te.formula||'0');const m=f.match(/ATK\s*\*\s*([0-9]+(?:\.[0-9]+)?)/);agg.dmg+=(m?Number(m[1]):0)*ticks*w;}
          if(te.type==='heal'||te.type==='shield'){const f=String(te.formula||'0');const m=f.match(/MAX_HP\s*\*\s*([0-9]+(?:\.[0-9]+)?)/);agg.heal+=(m?Number(m[1]):0)*ticks*w;}}}
      } else if(e.type==='consumeStatus'){agg.dmg+=.6*w;agg.control+=.4*w;}
      else if(e.type==='cleanse'||e.type==='dispel'){agg.control+=1*w;}
      else if(e.type==='gain'||e.type==='resource'){agg.economy+=Number(e.amount||1)*w;}
      else if(e.type==='convertResource'){agg.economy+=Number(e.amount||1)*w;}
      else if(e.type==='cooldownReduce'){agg.economy+=.8*w;}
      else if(e.type==='emitEvent'){agg.economy+=.6*w;}
      if(e.effects)walk(e.effects,w,depth+1);}};
    walk(action.effects,1);
    const k=usable*Math.max(1,targets);
    return {dmg:agg.dmg*k,heal:agg.heal*k,shield:agg.shield*k,control:agg.control*usable,economy:agg.economy*usable};
  }

  // rescale leading ATK/MAX_HP/+literal coefficients in a subtree by factor r
  // mode: 'atk' scales only ATK literals (damage), 'hp' only MAX_HP literals
  // (heal/shield), any other scales both.
  function rescale(action,r,mode){
    const atkPat=/ATK\s*\*\s*([0-9]+(?:\.[0-9]+)?)/g;
    const hpPat=/MAX_HP\s*\*\s*([0-9]+(?:\.[0-9]+)?)/g;
    const sc=f=>{if(typeof f!=='string')return f;
      let out=f;
      if(mode!=='hp')out=out.replace(atkPat,(m_,x)=>'ATK * '+round(Number(x)*r));
      if(mode!=='atk')out=out.replace(hpPat,(m_,x)=>'MAX_HP * '+round(Number(x)*r));
      return out;
    };
    const walk=eff=>{for(const e of eff||[]){if(e.formula)e.formula=sc(e.formula);
      for(const c of e.components||[])if(c.formula)c.formula=sc(c.formula);
      if(e.effects)walk(e.effects);if(e.then)walk(e.then);if(e.else)walk(e.else);}};
    walk(action.effects);
  }

  function buildStructure(opts){
    const seed=String(opts.seed??''),rarity=N.toV2RarityId(opts.rarity),level=N.normalizeLevel(opts.level);
    const seedToken=LEGACY_WORDS.test(seed)?Array.from(seed,c=>c.codePointAt(0).toString(16)).join('-'):seed;
    const identity=`v6|seed=${seedToken}|rarity=${rarity}|level=${level}`;
    if(LEGACY_WORDS.test(identity))throw new Error('v6 identity must not contain archetype vocabulary');
    const id=N.cardId(identity),r=rng(seed+'|v6');
    const pick=a=>a[r.random(a.length)],roll=p=>r.random(100)<p;
    const damageTypes=Object.keys(N.DAMAGE_TYPES),type=pick(damageTypes),resource=pick(['RAGE','SOUL','CHRONO']);
    const dotId=id+':dot',buffId=id+':stance';
    return {id,identity,seed,rarity,level,type,resource,dotId,buffId,duration:2+r.random(4),count:pick([2,3,3,3,3,4,4,4,4,5,6])};
  }

  function buildCard(seed,s,rarity,level,total){
    const st=buildStructure({seed:s,rarity,level});
    const r=rng(s+'|v6shape');
    const pick=a=>a[r.random(a.length)],roll=p=>r.random(100)<p;
    const damageTypes=Object.keys(N.DAMAGE_TYPES),type=pick(damageTypes),resource=st.resource,dotId=st.dotId,buffId=st.buffId,duration=st.duration,id=st.id;
    const panel=panelFor(total,seed); // FULL budget -> physical panel (dominant)
    const stats={MAX_HP:panel.hp,ATK:panel.atk,DEF:panel.def,RES:panel.res,SPD:panel.spd,
      ACC:94,EVA:22,CRIT:26,CRIT_DMG:170,PEN:20,LIFESTEAL:16,HEAL_POWER:110,HEAL_TAKEN:100,ENERGY_MAX:8,ENERGY_REGEN:2,
      VOLATILITY:round(0.2+Math.pow(r.random(),2)*2.8),LUCK:round(-0.9+r.random()*1.8),ENDURANCE:Math.round(r.random()*100),
      RAMP_START:9,FATIGUE_START:45,RAMP_RATE:.012,FATIGUE_RATE:.006,RAMP_CAP:1.2,FATIGUE_CAP:.9};
    if(resource){stats[resource]=2;stats[resource+'_MAX']=8;}
    const actions=[];let hasCommand=false;
    const weight={damage:1.0,heal:0.42,shield:0.32,ward:0.26,status:0.46,dot:0.42,consume:0.36,cleanse:0.3,dispel:0.3,resource:0.38,convert:0.3,cooldown:0.36,recoil:0.32,event:0.34,toggle:0.3};
    const wf=[];for(const fam of FAM){const w=weight[fam]||0.3;for(let i=0;i<Math.round(w*10);i++)wf.push(fam);}
    // UTILITY-ONLY families for the non-core slots (never damage/recoil/consume):
    // the damage engine is canonical (2 fixed strikes); utility adds style that is
    // PRICED against the same budget (more utility => lower strike coefficients).
    const UTIL=['heal','shield','ward','status','dot','cleanse','dispel','resource','convert','cooldown','event','toggle'];
    const uwf=[];for(const fam of UTIL){const w=weight[fam]||0.3;for(let i=0;i<Math.round(w*10);i++)uwf.push(fam);}
    const condC=()=>pick([{type:'hpPctBelow',value:.5},{type:'targetHpPctBelow',value:.4},{type:'resourceAtLeast',resource,value:3},{type:'targetHasStatus',status:dotId},{type:'missingStatus',status:buffId}]);
    for(let i=0;i<st.count;i++){
      // ---- canonical damage engine: slots 0..1 are fixed unconditional strikes ----
      // slot0: fast cd1 strike (fires every other round), slot1: heavy cd2 strike.
      // Their coefficients are normalized later so real DPS == budget target; the
      // UNCONDITIONAL topology guarantees the damage is actually delivered in combat.
      let family,coreDamage=null;
      if(i===0){family='damage';coreDamage={cd:1,coeff:1.0,name:'突袭'};}
      else if(i===1){family='damage';coreDamage={cd:2,coeff:1.4,name:'重击'};}
      else family=pick(uwf);
      const share=.65+r.random(101)/100,c=round(share);
      const a={id:id+':a'+i,name:'',kind:'utility',target:'self',cost:roll(40)?1:0,cooldown:r.random(4),priority:r.random(4)-1,accuracy:round(.8+r.random(21)/100),effects:[]};
      if(coreDamage){
        // deterministic fast/heavy strike topology (reliable real damage)
        a.name=coreDamage.name;a.kind='damage';a.target='enemy';a.cooldown=coreDamage.cd;a.cost=0;a.accuracy=i===0?0.95:0.90;
        a.effects=[{type:'damage',damageType:pick(damageTypes),formula:'ATK * '+round(coreDamage.coeff),varianceMin:0.9,varianceMax:1.1}];
      } else {
        const formula='MAX_HP * '+round(.12*c);
        switch(family){
          case 'heal':a.kind='heal';a.target='ally';a.effects=[{type:'heal',formula}];break;
          case 'shield':a.kind='shield';a.effects=[{type:'shield',formula}];break;
          case 'ward':a.kind='shield';a.effects=[{type:'ward',damageType:type,formula}];break;
          case 'status':a.kind='status';a.target=roll(50)?'self':'enemy';a.effects=[{type:'status',status:a.target==='self'?buffId:pick(['weak','slow','vulnerable','silence']),stacks:1+r.random(2),duration}];break;
          case 'dot':a.kind='status';a.target='enemy';a.effects=[{type:'status',status:dotId,stacks:1+r.random(2),duration}];break;
          case 'cleanse':a.target='ally';a.effects=[{type:'cleanse',count:1+r.random(3)}];break;
          case 'dispel':a.target='enemy';a.effects=[{type:'dispel',count:1+r.random(2),...(roll(50)?{transfer:'actor'}:{})}];break;
          case 'resource':a.effects=[{type:pick(['gain','resource']),resource,amount:2+r.random(3)}];break;
          case 'convert':a.effects=[{type:'convertResource',from:'ENERGY',to:resource,amount:2,ratio:2}];break;
          case 'cooldown':a.target='ally';a.effects=[{type:'cooldownReduce',amount:1+r.random(2)}];break;
          case 'event':hasCommand=true;a.effects=[{type:'emitEvent',event:'command',eventSubject:'actor'}];break;
          case 'toggle':a.kind='status';a.effects=[{type:'toggleStatus',status:buffId,duration}];break;
        }
        // NOTE: utility actions are kept SIMPLE (no random conditional/repeat/query/
        // cost wrappers). Those wrappers create the degenerate, hard-to-price kit
        // topologies that leak real strength across tiers; a simple utility still
        // gives strong style diversity (12 families) but with bounded real value.
        if(a.target!=='self'&&roll(25)){const relation=a.target==='enemy'?'enemy':'ally';a.target='query';a.targetQuery={relation,sortBy:{kind:pick(['hpPct','shield','stat']),key:'SPD'},order:pick(['asc','desc']),limit:1+r.random(3),mode:pick(['first','all'])};}
        a.name=({heal:'复苏',shield:'坚守',ward:'护符',status:'战术',dot:'侵蚀',cleanse:'净化',dispel:'破咒',resource:'蓄能',convert:'转化',cooldown:'回转',event:'号令',toggle:'战意'})[family]||'战术';
      }
      actions.push(a);
    }
    const triggers=[{event:pick(['roundStart','roundEnd','afterDamageTaken','afterDamageDealt','afterKill']),target:'self',effects:[{type:pick(['heal','shield']),formula:'MAX_HP * '+round(.025)}]},
      {event:'afterKill',target:'self',effects:[{type:'gain',resource,amount:3}]},
      ...(hasCommand?[{event:'command',target:'self',effects:[{type:'gain',resource,amount:2}]}]:[])];
    const passives=[{stat:'ATK',operation:'add',value:round(5),condition:{type:'hpPctBelow',value:.5}},
      {stat:'DEF',operation:'add',formula:resource+' * '+round(2)}];
    const statuses=[
      {id:dotId,name:'侵蚀',kind:'debuff',maxStacks:3+r.random(4),stacking:pick(['stack','refresh','replace']),duration,
       periodic:{timing:'turnEnd',snapshot:pick(['apply','dynamic']),effects:[{type:'damage',damageType:type,formula:'ATK * '+round(.12)+' * STACKS',canMiss:false,canCrit:false,canReflect:false}]}},
      {id:buffId,name:'战意',kind:'buff',maxStacks:2,stacking:pick(['stack','refresh','replace']),duration,
       modifiers:[{stat:pick(['ATK','DEF','SPD','EVA','CRIT']),operation:'addPerStack',value:round(7)}],
       eventModifiers:[{event:'ModifyDamageTaken',operation:'multiply',value:round(1/(1+.15))}],
       upkeep:{resource,amount:1,timing:'roundStart'},
       triggers:[{event:'afterDamageTaken',target:'source',effects:[{type:'damage',damageType:'physical',formula:'ATK * '+round(.12),canReflect:false}]}]}
    ];
    const card={id,identity:st.identity,seed:s,generatorVersion:6,rarity,level,name:'',displayName:'',
      stats,actions,statuses,triggers,passives,resourceRegens:{[resource]:1},
      resources:{ENERGY:{max:8,regen:2},[resource]:{max:8,regen:1}},
      resistances:{[type]:0.02},affinities:{[type]:0.02},_shapeLevel:1,_shape:{id,count:st.count,type,resource}};
    const referenced=N.assembleCardPack(card).statuses;
    card.statuses=card.statuses.filter(sx=>referenced[sx.id]);
    card.mechanicFingerprint=N.mechanicFingerprint(card);
    enforceViability(card,type,id);
    return {card,hasCommand};
  }

  // ---- viability pass: guarantee every card CAN fight ----
  // A kit whose damage is gated behind a condition the kit can never satisfy (e.g.
  // "targetHasStatus:dot" with no dot applier) or whose actions are all
  // resource/cooldown utility literally cannot deal damage => it can only lose.
  // We guarantee at least one UNCONDITIONAL, self-sufficient damage action so the
  // card's real strength is actually delivered, then let DPS normalization balance it.
  function enforceViability(card,type,id){
    const actions=card.actions;
    // "reliable damage" = an action with a DIRECT ATKn-coefficient damage effect
    // that produces >0 even with a neutral scope (not gated on consumed stacks,
    // conditions, or a dot that must be applied first). Consume/detonation/conditional
    // damage do NOT count — they need an enabling applier the kit may lack.
    const hasReliableDamage=(a)=>{let ok=false;
      (function walk(effs,gated){for(const e of effs||[]){
        if(e.type==='conditional'){walk(e.then,true);walk(e.else,true);continue;}
        if(e.type==='repeat'){walk(e.effects,gated);continue;}
        if(e.type==='damage'){if(!gated&&/ATK\s*\*\s*[0-9]+(?:\.[0-9]+)?/.test(String(e.formula||'')))ok=true;}
        if(e.effects)walk(e.effects,gated);
      }})(a.effects||[],false);
      return ok;
    };
    const isDamageAct=hasReliableDamage; // reliable-damage actions
    const hasUnconditionalDamage=actions.some(hasReliableDamage);
    const damageActs=actions.filter(hasReliableDamage).length;
    if(!hasUnconditionalDamage||damageActs===0){
      const core={id:id+':core',name:'突袭',kind:'damage',target:'enemy',cost:0,cooldown:1,priority:0,accuracy:0.95,
        effects:[{type:'damage',damageType:'physical',formula:'ATK * 1.0',varianceMin:0.9,varianceMax:1.1}]};
      const idx=actions.findIndex(a=>!hasReliableDamage(a));
      if(idx>=0)actions[idx]=core;else actions.push(core);
    }
    // bound unreliable-damage/utility-only actions so they can't crowd out the engine
    const utilityOnly=actions.filter(a=>!hasReliableDamage(a));
    const maxUtil=Math.max(1,Math.floor(actions.length*0.6));
    if(utilityOnly.length>maxUtil){
      for(let i=actions.length-1;i>=0&&utilityOnly.length>maxUtil;i--){
        if(!hasReliableDamage(actions[i])){
          actions[i]={id:id+':util',name:'突袭',kind:'damage',target:'enemy',cost:0,cooldown:1,priority:0,accuracy:0.95,
            effects:[{type:'damage',damageType:'physical',formula:'ATK * '+round(0.9+Math.abs(actions[i].cooldown||1)*0.1),varianceMin:0.9,varianceMax:1.1*round(1+(actions[i].priority||0)*0.05)}]};
          utilityOnly.pop();
        }
      }
    }
    // ---- tempo floor: guarantee at least one FAST, reliable damage action ----
    const dActions=actions.filter(hasReliableDamage);
    const hasFastDamage=dActions.some(a=>Number(a.cooldown||0)<=1);
    if(dActions.length>0&&!hasFastDamage){
      const slow=dActions.slice().sort((x,y)=>(x.cooldown||0)-(y.cooldown||0))[0];
      slow.cooldown=1;slow.cost=Math.min(slow.cost||0,1);slow.accuracy=Math.max(slow.accuracy||0.9,0.9);
    } else if(dActions.length>0){
      for(const a of dActions)if(Number(a.cooldown||0)>2)a.cooldown=2;
    }
    // ---- no degenerate spam loops ----
    // Any action that grants shield/heal or converts cheap resource every round (cd 0)
    // produces an unkillable/sustain loop that no budget model prices correctly.
    // Require a non-zero cooldown on sustain/convert-granting actions so a card
    // cannot become an immortal wall that out-lasts everything on attrition.
    const grantsSustain=a=>{let s=false;
      (function walk(effs){for(const e of effs||[]){
        if(e.type==='shield'||e.type==='heal'||e.type==='ward')s=true;
        else if(e.type==='convertResource')s=true;
        if(e.effects)walk(e.effects);if(e.then)walk(e.then);if(e.else)walk(e.else);}})(a.effects||[]);
      return s;};
    for(const a of actions){if(grantsSustain(a)&&!hasReliableDamage(a)&&Number(a.cooldown||0)<=1&&a.kind!=='damage'){
      a.cooldown=2; // sustain tools can't be free every round
    }}
  }

  // ---- real-strength measurement (Monte-Carlo selection gate) ----
  // The engine's real combat strength is dominated by kit topology, not just the
  // nominal DPS/HP panel. To pin aggregate real strength to the tier, we MEASURE
  // each draft card's real edge vs a fixed canonical reference opponent and select
  // the draft whose measured edge is closest to the budget's target edge. This is
  // generation-time budget accounting (measure -> choose) using the REAL engine,
  // the source of truth, rather than a fragile headonic DPS model.
  let REF_V6=null;
  function buildRef(salt){
    // build a fixed canonical reference WITHOUT the measurement recursion
    const total=round(N.expectedStrengthV6(50,'B'));
    const built=buildCard('__v6ref__'+salt,'__v6ref__'+salt,'B',50,total);
    let c=built.card;
    const kDPS=0.15,targetDPS=kDPS*total;
    const sumCE=c.actions.reduce((n,a)=>n+effectiveCoeffs(c,a).dmg,0);
    const curDPS=(c.stats.ATK||1)*sumCE;
    if(sumCE>0&&curDPS>0){c.actions.forEach(a=>rescale(a,Math.max(0.01,Math.min(14,targetDPS/curDPS))));}
    else{c.actions.push({id:c.id+':d',name:'突袭',kind:'damage',target:'enemy',cost:0,cooldown:0,priority:0,accuracy:0.95,effects:[{type:'damage',damageType:'physical',formula:'ATK*1.0',varianceMin:0.9,varianceMax:1.1}]});}
    c.power=0;c.generationStrengthBudget=total;c.expectedStrength=total;
    return c;
  }
  function measureNetAdv(card,K,base,RMAX=22){
    if(!REF_V6)REF_V6=buildRef();
    const ref=REF_V6;let s=0,n=0;
    for(let i=0;i<K;i++){
      N.deployCard(card);N.deployCard(ref);
      const e=N.createBattle({seed:N.deriveSeed(base+i*13),teamA:[card.id],teamB:[ref.id],maxRounds:RMAX});
      let g=0;while(!e.outcome().ended&&g++<RMAX*2+20)e.resolveRound([...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')]);
      const A=e.teams.A.entities[0],B=e.teams.B.entities[0];
      const val=A.hp/Math.max(1,A.maxHp)-B.hp/Math.max(1,B.maxHp);
      if(Number.isFinite(val)){s+=val;n++;}
    }
    return n?s/n:0;
  }

  function generateCardV6(opts={}){
    if(opts.generatorVersion!==undefined&&opts.generatorVersion!==6)throw new Error('unsupported generatorVersion: '+opts.generatorVersion);
    if('archetype' in opts)throw new Error('Generator v6 is classless: archetype is not a valid input');
    const seed=String(opts.seed??''),rarity=N.toV2RarityId(opts.rarity),level=N.normalizeLevel(opts.level);
    const total=round(N.expectedStrengthV6(level,rarity));
    // reference-level budget -> target real edge is ~0 at REF tier; grow with budget.
    // Higher budget => the card should beat REF more (monotone edge target).
    const refBudget=round(N.expectedStrengthV6(50,'B'));
    const targetEdge=Math.max(-0.3,Math.min(0.75,0.05+ (total-refBudget)/refBudget*0.18));
    const K=4, RMAX=44, DBASE=770000, NTRY=10;
    let best=null,bestErr=Infinity,card;
    for(let attempt=0;attempt<NTRY;attempt++){
      const s=attempt===0?seed:(seed+'#'+attempt);
      const built=buildCard(seed,s,rarity,level,total);
      card=built.card;
      // ---- budget-faithful normalization: damage pays for sustain/control ----
      // The engine's decisive quantities are damage-per-round (ATK × Σ coeffs) and
      // sustain-per-round (MAX_HP × Σ heal/shield coeffs). A kit may NOT get both at
      // full strength: heal/shield/control utility is priced OUT of the damage
      // engine (strikes are scaled down), so a heal fortress genuinely trades
      // damage for survival. This keeps same-tier aggregate strength pinned to the
      // budget while allowing diverse builds.
      const kDPS=0.15;
      const targetDPS=kDPS*total;
      const atk=Math.max(1,card.stats.ATK||1),hp=Math.max(1,card.stats.MAX_HP||1);
      const targetCE=targetDPS/atk;                       // damage-coefficient budget
      const ceSum=()=>{const list=card.actions.map(a=>effectiveCoeffs(card,a));
        return {dmg:list.reduce((n,x)=>n+x.dmg,0),heal:list.reduce((n,x)=>n+x.heal,0),shield:list.reduce((n,x)=>n+x.shield,0)};};
      const eq=(c)=>{ // sustain in ATK-coefficient units (real HP-value conversion):
        // heal uses MAX_HP (~10x ATK) and bypasses mitigation, so 1.0 heal-coeff is
        // worth ~25x a 1.0 damage-coeff in real HP/round; shields ~15x (1:1 absorb).
        const r=hp/atk;
        const healVal=(c.heal)*(r*2.5)+(c.shield)*(r*1.5);
        return {dmg:c.dmg,heal:healVal,total:c.dmg+healVal};
      };
      let ce=eq(ceSum());
      if(ce.total>0&&targetCE>0){
        // pay sustain from the damage budget: scale strikes down so total==targetCE
        let s=(targetCE-ce.heal)/ce.dmg;                  // s×dmg + heal == targetCE
        s=Number.isFinite(s)?Math.max(0.02,Math.min(8,s)):0.02;
        if(s<1&&ce.heal>0)card.actions.forEach(a=>rescale(a,s,'atk'));
        else if(s>=1&&ce.dmg>0)card.actions.forEach(a=>rescale(a,Math.min(s,8),'atk'));
        ce=eq(ceSum());
        // hard sustain cap: sustain may be at most 85% of the damage-coeff budget
        const healCap=0.85*targetCE;
        if(ce.heal>healCap&&ce.heal>0){
          const s2=Math.max(0.01,healCap/ce.heal);
          card.actions.forEach(a=>rescale(a,s2,'hp'));
        }
        ce=eq(ceSum());
      } else if(ce.dmg===0){
        // no damage at all (should not happen after viability): force a strike
        card.actions.push({id:card.id+':d',name:'突袭',kind:'damage',target:'enemy',cost:0,cooldown:0,priority:0,accuracy:0.95,
          effects:[{type:'damage',damageType:'physical',formula:'ATK * 1.0',varianceMin:0.9,varianceMax:1.1}]});
        ce=eq(ceSum());
      }
      card._dmgCE=round(ce.dmg);card._healCE=round(ce.heal);
      // ---- measure real edge vs reference and score (closest to tier target) ----
      const edge=measureNetAdv(card,K,DBASE+attempt*1000,RMAX);
      card._measuredEdge=edge;
      card.realDPS=Math.round((card.stats.ATK||1)*card.actions.reduce((n,a)=>n+effectiveCoeffs(card,a).dmg,0));
      const err=Math.abs(edge-targetEdge);
      if(err<bestErr){bestErr=err;best=card;}
    }
    if(!best)throw new Error('v6 could not generate for seed '+seed+' budget='+total);
    card=best;
    // NOTE: no post-hoc magnitude calibration here. Battle measurement noise at
    // feasible sample sizes makes fine calibration unreliable; the real hierarchy
    // is carried robustly by the budget-proportional PANEL (MAX_HP/ATK/DEF ∝
    // budget) plus the canonical damage engine and sustain-compensated kit.
    // `_measuredEdge` is the draft's measured real edge vs the reference (recorded
    // in the ledger for diagnostics).
    // ---- ledger (real measured strength) ----
    const ledger=N.budgetLedgerV6(total);
    ledger.measuredEdge=round(card._measuredEdge*1000)/1000;
    ledger.targetEdge=round(targetEdge*1000)/1000;
    ledger.spent.offense=round(card.realDPS||0);
    ledger.spent.defense=Math.round(card.stats.MAX_HP*0.5);
    ledger.spent.economy=Math.round(card.stats.SPD*0.08);
    N.closeBudgetLedgerV6(ledger);
    card.strengthLedger=ledger;
    card.generationStrengthBudget=total;card.expectedStrength=total;
    // independent real measurement
    const bp=N.battlePowerV3(card).power;
    if(!Number.isFinite(bp)||bp<=0)throw new Error('v6 non-finite battlepower '+bp);
    if(!Number.isFinite(card.stats.ATK)||!Number.isFinite(card.stats.MAX_HP))throw new Error('v6 non-finite stats');
    card.power=bp;card.mechanicFingerprint=N.mechanicFingerprint(card);
    card.presentation=card.presentation||{};card.presentation.power=bp;card.presentation.mechanicFingerprint=card.mechanicFingerprint;
    const spName=(typeof N.generateSpeciesName==='function')?N.generateSpeciesName(card):(card.seed);
    card.name=spName;card.displayName=spName;
    return card;
  }

  // Explicit dispatcher: `generateCardV6` is opt-in (a new-strength-system module).
  // The DEFAULT generator version is NOT changed here so existing v5-generated
  // cards/presets/tests keep their behavior; callers choose v6 via generatorVersion:6
  // (or app UI once Intel-tier wiring flips the default deliberately).
  const legacyGenerate=N.generateCardByVersion;
  Object.assign(N,{generateCardV6,buildStructure,CARD_GENERATOR_VERSION_V6:6});
  N.generateCardV6ByVersion=(opts={})=>{
    const v=opts.generatorVersion===undefined?6:opts.generatorVersion;
    if(v===6)return generateCardV6(opts);
    return legacyGenerate(opts);
  };
  if(typeof module!=='undefined')module.exports=N;
})(typeof globalThis!=='undefined'?globalThis:window);