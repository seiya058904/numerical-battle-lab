(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  const CARD_GENERATOR_VERSION_V2=2;
  // v1 pipeline stays exactly as-is in generator.js; this module adds v2 on top
  // and a version dispatcher. generateCardByVersion(1) reproduces the v1.1.0 card
  // byte-for-byte; generateCardByVersion(2) (default) runs the v1.2 composition pipeline.

  // ---------------------------------------------------------------------------
  // Composition Grammar (spec 19): skills are composed from Primary Effect +
  // Secondary Effect + Target + Condition + Cost + Cooldown + Accuracy +
  // Damage Type + Tags. All blueprints are data; there is no per-skill JS branch.
  // ---------------------------------------------------------------------------
  const GRAMMAR_PRIMARY=[
    {id:'strike',kind:'damage',target:'enemy',targetCount:1,accuracy:1,cooldown:0,priority:0,damageType:'physical',hits:1,tags:['strike']},
    {id:'heavy',kind:'damage',target:'enemy',targetCount:1,accuracy:0.9,cooldown:2,priority:0,damageType:'physical',hits:1,tags:['heavy']},
    {id:'flurry',kind:'damage',target:'enemy',targetCount:1,accuracy:0.95,cooldown:1,priority:0,damageType:'physical',hits:3,tags:['multihit']},
    {id:'sweep',kind:'damage',target:'all-enemies',targetCount:3,accuracy:0.9,cooldown:2,priority:0,damageType:'physical',hits:1,tags:['aoe']},
    {id:'pierce',kind:'damage',target:'enemy',targetCount:1,accuracy:1,cooldown:1,priority:0,damageType:'physical',hits:1,penetrationBonus:20,tags:['pierce']},
    {id:'fire-bolt',kind:'damage',target:'enemy',targetCount:1,accuracy:0.95,cooldown:0,priority:0,damageType:'fire',hits:1,tags:['fire']},
    {id:'frost-lance',kind:'damage',target:'enemy',targetCount:1,accuracy:0.95,cooldown:1,priority:0,damageType:'frost',hits:1,tags:['frost']},
    {id:'arc-bolt',kind:'damage',target:'enemy',targetCount:1,accuracy:1,cooldown:1,priority:0,damageType:'lightning',hits:1,tags:['lightning']},
    {id:'venom',kind:'damage',target:'enemy',targetCount:1,accuracy:0.9,cooldown:1,priority:0,damageType:'toxic',hits:1,tags:['toxic']},
    {id:'cleave',kind:'damage',target:'all-enemies',targetCount:3,accuracy:0.85,cooldown:3,priority:0,damageType:'physical',hits:1,tags:['aoe','heavy']},
    {id:'heal',kind:'heal',target:'ally',targetCount:1,accuracy:1,cooldown:1,priority:0,scaling:'MAX_HP',tags:['support']},
    {id:'barrier',kind:'shield',target:'self',targetCount:0,accuracy:1,cooldown:2,priority:0,scaling:'MAX_HP',tags:['defense']},
    {id:'fortify',kind:'status',target:'self',targetCount:0,accuracy:1,cooldown:2,priority:0,status:'fortified',tags:['buff']},
    {id:'weaken',kind:'status',target:'enemy',targetCount:1,accuracy:1,cooldown:1,priority:0,status:'weak',tags:['debuff']},
  ];
  const GRAMMAR_SECONDARY=[
    {id:'burn',effect:{type:'status',status:'burn'},tags:['dot']},
    {id:'poison',effect:{type:'status',status:'poison'},tags:['dot']},
    {id:'bleed',effect:{type:'status',status:'bleed'},tags:['dot']},
    {id:'slow',effect:{type:'status',status:'slow'},tags:['debuff']},
    {id:'vulnerable',effect:{type:'status',status:'vulnerable'},tags:['debuff']},
    {id:'haste-self',effect:{type:'status',status:'haste'},tags:['buff']},
    {id:'regen',effect:{type:'status',status:'regen'},tags:['buff','dot']},
    {id:'energy-gain',effect:{type:'gain',resource:'ENERGY'},tags:['economy']},
    {id:'siphon',effect:{type:'shield',formula:'MAX_HP * c'},tags:['defense']},
    {id:'cleanse-self',effect:{type:'cleanse'},tags:['utility']},
  ];
  const ARCHETYPE_PRIMARY={
    Balanced:['strike','heavy','cleave','fire-bolt','heal','barrier','weaken','pierce'],
    Tank:['strike','heavy','barrier','fortify','cleave','pierce'],
    Bruiser:['strike','heavy','cleave','pierce','venom','fortify'],
    Assassin:['strike','pierce','flurry','heavy','venom','weaken'],
    Mage:['fire-bolt','frost-lance','arc-bolt','cleave','venom','weaken'],
    Support:['heal','barrier','fortify','strike','cleave'],
    Controller:['weaken','frost-lance','flurry','arc-bolt','cleave','venom'],
  };
  // Trigger blueprints (spec 20): generic, data-driven, reference registered events.
  // Balance note (v1.2 audit): a trigger that places *damage* on afterDamageDealt /
  // afterDamageTaken would re-fire from its own damage and chain to the engine proc
  // limit (one hit became ~12 hits / 158 dmg). The BattleEngine stays frozen; the
  // generator avoids that degenerate composition by only putting non-damage effects
  // (shield / heal / status / gain) on damage events.
  const TRIGGER_BLUEPRINTS=[
    {id:'counter',event:'afterDamageTaken',target:'self',kind:'shield',tags:['defense']},
    {id:'vengeance',event:'afterDamageDealt',target:'self',kind:'heal',tags:['sustain']},
    {id:'regen-start',event:'roundStart',target:'self',kind:'heal',tags:['sustain']},
    {id:'ward-kill',event:'afterKill',target:'self',kind:'shield',tags:['sustain']},
    {id:'haste-hit',event:'afterDamageDealt',target:'self',kind:'status',status:'haste',tags:['tempo']},
    {id:'energy-kill',event:'afterKill',target:'self',kind:'gain',resource:'ENERGY',tags:['economy']},
    {id:'bulwark',event:'afterDamageTaken',target:'self',kind:'status',status:'fortified',tags:['defense']},
    {id:'second-wind',event:'roundEnd',target:'self',kind:'heal',tags:['sustain']},
  ];
  const PASSIVE_STATS=['ATK','DEF','RES','SPD','ACC','CRIT','MAX_HP'];

  // ---------------------------------------------------------------------------
  // v1.2 GENERATOR_V2_RULES: v2-only balance coordinates (spec balance audit).
  // v1 keeps its shared constants untouched; every knob here is scoped to v2 so
  // generator v1 output stays byte-for-byte frozen. BattleEngine is never touched.
  //
  // The baseline v2 stat conversion produced degenerate fights (round-1 one-shots,
  // ~16%; heal/shield sustain stalls, ~6%; median 4 rounds). This coordinate set is
  // the first rebalance pass:
  //   - HP scales FASTER than ATK (longer TTK), DEF/RES grow slower than offense so
  //     higher rarity genuinely out-hits (rarity monotonicity), not just out-tanks.
  //   - Skill power scale is v2-specific (V2_SKILL_POWER_SCALE) so coefficients are
  //     tuned without touching v1's GEN_SKILL_POWER_SCALE.
  //   - Heal/shield use EffectiveSustainValue: a sustain point costs far more budget
  //     than a damage point (a heal that matches raw damage creates unkillable
  //     loops because damage is mitigated but sustain is not). See BALANCE-AUDIT.
  // ---------------------------------------------------------------------------
  const V2_PRIMARY_CONVERSION={
    MAX_HP:bp=>130+Number(bp)*1.15,
    ATK:bp=>35+Number(bp)*0.24,
    DEF:bp=>25+Number(bp)*0.28,
    RES:bp=>25+Number(bp)*0.28,
    SPD:bp=>52+Number(bp)*0.26,
  };
  const V2_SKILL_POWER_SCALE=100;   // damage coefficient denominator (v2)
  const V2_SUSTAIN_POWER_SCALE=720; // heal/shield coefficient denominator (v2)
  const V2_TARGET_SKILLS=[0.30,0.30,0.40];
  // Recurring trigger events repeat EVERY round (roundStart/roundEnd) or on every
  // hit (afterDamageTaken/afterDamageDealt): a one-time budget purchase buys
  // near-infinite value, so their sustain must be discounted far below a bounded
  // skill heal. afterKill is bounded (once per kill) and uses the normal scale.
  const V2_TRIGGER_RECURRING_EVENTS=['roundStart','roundEnd','afterDamageTaken','afterDamageDealt'];
  const V2_TRIGGER_RECURRENCE_DISCOUNT=3.2;
  function triggerSustainScale(event,share){
    return V2_SUSTAIN_POWER_SCALE*(V2_TRIGGER_RECURRING_EVENTS.includes(event)?V2_TRIGGER_RECURRENCE_DISCOUNT:1);
  }

  // Composition constraints (spec balance audit §7): a 3-skill kit must be a
  // healthy fight kit, decided generically by effect role — never by skill id.
  // Roles are derived from the composed skill's kind + effect tags.
  const COMPOSITION_RULES={
    minDamageSkills:2,      // every kit has at least two damaging skills (damage core)
    maxHealSkills:1,        // at most one major heal
    maxShieldSkills:1,      // at most one major shield
    maxStatusSkills:1,      // at most one pure status/control skill (prevents no-damage kits)
    maxSustainSkills:1,     // heal+shield combined cap (prevents stall kits)
    maxBurstSkillBudget:0.42, // one skill cannot swallow >42% of the kit (no triple-nuke)
  };
  function skillRole(skill){
    const kinds=(skill.effects||[]).map(e=>e.type);
    if(kinds.includes('damage'))return'burst';
    if(kinds.includes('heal'))return'heal';
    if(kinds.includes('shield'))return'shield';
    if(kinds.includes('status'))return'status';
    return'support';
  }
  // Enforce COMPOSITION_RULES on a full 3-skill kit. Deterministic and generic:
  // repairs a kit that violates the role limits by swapping in a grammar primary
  // from the same archetype pool (never a per-skill-id branch).
  function enforceComposition({archetype,seed,skills,cardId}){
    const prng=genSeed(seed,'compose-fix');
    const pool=ARCHETYPE_PRIMARY[archetype]||ARCHETYPE_PRIMARY.Balanced;
    const damageCandidates=pool.filter(id=>GRAMMAR_PRIMARY.find(p=>p.id===id)?.kind==='damage');
    const out=skills.slice();
    // helper: how many skills have each role
    const counts=()=>{
      const c={burst:0,heal:0,shield:0,status:0,support:0};
      for(const s of out)c[skillRole(s)]++;
      return c;
    };
    const toDamage=(idx)=>{if(idx<0||!damageCandidates.length)return;const primId=damageCandidates[prng.random(damageCandidates.length)];out[idx]=rebuildSkill({archetype,seed,slot:idx,budget:out[idx]._budget||0,cardId,primaryId:primId});};
    // 1) guarantee the damage core (minDamageSkills). Prefer replacing pure
    //    status/support skills first (they are the weak-DPS drain), then sustain.
    let guard=0;
    while(counts().burst<COMPOSITION_RULES.minDamageSkills&&guard++<12){
      let c=counts();
      let idx=-1;
      for(let i=0;i<out.length;i++){
        const r=skillRole(out[i]);
        if(r==='status'||r==='support'){idx=i;break;}
      }
      if(idx<0){for(let i=0;i<out.length;i++){const r=skillRole(out[i]);if(r==='heal'||r==='shield'){idx=i;break;}}}
      if(idx<0)break;
      toDamage(idx);
    }
    // 2) cap heals and shields
    let c=counts();
    for(let i=0;i<out.length&&c.heal>COMPOSITION_RULES.maxHealSkills;i++){
      if(skillRole(out[i])==='heal'){toDamage(i);c.heal--;}
    }
    c=counts();
    for(let i=0;i<out.length&&c.shield>COMPOSITION_RULES.maxShieldSkills;i++){
      if(skillRole(out[i])==='shield'){toDamage(i);c.shield--;}
    }
    // 3) cap pure status/control skills
    c=counts();
    for(let i=0;i<out.length&&c.status>COMPOSITION_RULES.maxStatusSkills;i++){
      if(skillRole(out[i])==='status'){toDamage(i);c.status--;}
    }
    // 4) sustain (heal+shield) combined cap
    c=counts();
    for(let i=0;i<out.length&&(c.heal+c.shield)>COMPOSITION_RULES.maxSustainSkills;i++){
      const r=skillRole(out[i]);
      if(r==='heal'||r==='shield'){toDamage(i);c[r]--;}
    }
    return out;
  }
  // Rebuild one skill with an explicit primary id (used by enforceComposition).
  function rebuildSkill({archetype,seed,slot,budget,cardId,primaryId}){
    const primary=GRAMMAR_PRIMARY.find(x=>x.id===primaryId);
    if(!primary)throw new Error('grammar: unknown primary '+primaryId);
    const prng=genSeed(seed,'skill'+slot);
    const secondaryRoll=prng.random(100)/100;
    const secondary=secondaryRoll<0.45?GRAMMAR_SECONDARY[prng.random(GRAMMAR_SECONDARY.length)]:null;
    const secShare=secondary?0.25:0;
    const primaryBudget=budget*(1-secShare);
    const secBudget=budget*secShare;
    const pseudo={targetCount:primary.targetCount,accuracy:primary.accuracy,cooldown:primary.cooldown,priority:primary.priority,penetrationBonus:primary.penetrationBonus,hits:primary.hits||1};
    const base=NCB.refSkillCost({rawPower:1,targetCount:pseudo.targetCount,accuracy:pseudo.accuracy,cooldown:pseudo.cooldown,priority:pseudo.priority,penetration:pseudo.penetrationBonus});
    const skillId=cardId+':v2'+slot;
    const def={id:skillId,name:primary.id,kind:primary.kind,target:primary.target,cost:1,cooldown:primary.cooldown,priority:primary.priority,accuracy:primary.accuracy,tags:[...primary.tags],_budget:Math.round(budget*10)/10};
    if(primary.penetrationBonus!==undefined)def.penetrationBonus=primary.penetrationBonus;
    if(primary.kind==='damage'){
      const coeff=clamp(Math.round((primaryBudget/(base*V2_SKILL_POWER_SCALE))/(primary.hits||1)*1000)/1000,0.05,5);
      def.damageType=primary.damageType;def.formula='ATK * '+coeff;def.hits=primary.hits||1;def.effects=[{type:'damage'}];def.rawPower=Math.round(base*1000)/1000;
    } else if(primary.kind==='heal'||primary.kind==='shield'){
      const coeff=clamp(Math.round((primaryBudget/(base*V2_SUSTAIN_POWER_SCALE))*1000)/1000,0.05,5);
      def.formula='MAX_HP * '+coeff;def.effects=[{type:primary.kind}];def.rawPower=Math.round(base*1000)/1000;
    } else if(primary.kind==='status'){
      const sv=NCB.statusValue(primaryBudget,{targetCount:primary.targetCount,accuracy:primary.accuracy,cooldown:primary.cooldown,priority:primary.priority,statusStacks:1});
      def.effects=[{type:'status',status:primary.status,duration:sv.duration,stacks:sv.stacks}];def.rawPower=Math.round(base*1000)/1000;
    }
    if(secondary&&secBudget>=5){
      const secEffect={...secondary.effect};
      if(secEffect.type==='status'){
        const sv=NCB.statusValue(secBudget,{targetCount:primary.targetCount,accuracy:primary.accuracy,cooldown:primary.cooldown,priority:primary.priority,statusStacks:1});
        secEffect.status=secondary.effect.status;secEffect.duration=Math.max(1,Math.min(6,sv.duration));secEffect.stacks=sv.stacks;
      } else if(secEffect.type==='gain'){
        secEffect.resource='ENERGY';secEffect.amount=Math.max(1,Math.round(secBudget/150));
      } else if(secEffect.type==='shield'){
        secEffect.formula='MAX_HP * '+clamp(Math.round((secBudget/(base*V2_SUSTAIN_POWER_SCALE))*1000)/1000,0.05,5);
      }
      def.effects=(def.effects||[]).concat([secEffect]);def.tags=def.tags.concat(secondary.tags||[]);def._secondary=secondary.id;
    }
    return def;
  }

  function genSeed(seed,salt){
    const base=NCB.seedHash(String(seed==null?'':seed)+':'+salt);
    return new NCB.Gen5PRNG('gen5,'+((base>>>0)&0xffff)+','+((base>>>16)&0xffff)+',5,6');
  }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const round2=v=>Math.round(Number(v||0)*100)/100;

  // v2 canonical identity: same philosophy as v1 but for version 2 with v2 rarity ids.
  function canonicalGenerationIdentityV2(opts={}){
    const version=opts.generatorVersion===undefined?CARD_GENERATOR_VERSION_V2:opts.generatorVersion;
    if(version!==CARD_GENERATOR_VERSION_V2)throw new Error('unsupported generatorVersion: '+version+' (v2 dispatcher)');
    const seed=opts.seed==null?'':String(opts.seed);
    const rarity=NCB.toV2RarityId(opts.rarity);
    const level=NCB.normalizeLevel(opts.level);
    const archetype=opts.archetype||'Balanced';
    const tags=(opts.tags||[]).slice().map(String).sort().join(',');
    return `v${version}|seed=${seed}|rarity=${rarity}|level=${level}|archetype=${archetype}${tags?'|tags='+tags:''}`;
  }

  // Compose one active skill from the grammar. Returns a full skill def + _budget.
  function composeSkill({seed,archetype,slot,budget,cardId}){
    const prng=genSeed(seed,'skill'+slot);
    const pool=ARCHETYPE_PRIMARY[archetype]||ARCHETYPE_PRIMARY.Balanced;
    const primaryId=pool[prng.random(pool.length)];
    const primary=GRAMMAR_PRIMARY.find(x=>x.id===primaryId);
    if(!primary)throw new Error('grammar: unknown primary '+primaryId);
    // secondary ~ 45% of the time, and never on top of a same-kind-only skill set twice
    const secondaryRoll=prng.random(100)/100;
    const secondary=secondaryRoll<0.45?GRAMMAR_SECONDARY[prng.random(GRAMMAR_SECONDARY.length)]:null;

    // budget split: secondary consumes ~25% of the skill budget when present
    const secShare=secondary?0.25:0;
    const primaryBudget=budget*(1-secShare);
    const secBudget=budget*secShare;

    // base reference cost of the primary (before formula scaling)
    const pseudo={targetCount:primary.targetCount,accuracy:primary.accuracy,cooldown:primary.cooldown,priority:primary.priority,penetrationBonus:primary.penetrationBonus,hits:primary.hits||1};
    const base=NCB.refSkillCost({rawPower:1,targetCount:pseudo.targetCount,accuracy:pseudo.accuracy,cooldown:pseudo.cooldown,priority:pseudo.priority,penetration:pseudo.penetrationBonus});

    // skill ids derive from the card's own unique id + slot, so distinct cards never collide
    const skillId=cardId+':v2'+slot;

    const def={
      id:skillId,name:primary.id,kind:primary.kind,target:primary.target,
      cost:1,cooldown:primary.cooldown,priority:primary.priority,accuracy:primary.accuracy,
      tags:[...primary.tags],_budget:Math.round(budget*10)/10,
    };
    if(primary.penetrationBonus!==undefined)def.penetrationBonus=primary.penetrationBonus;

    if(primary.kind==='damage'){
      const coeff=clamp(Math.round((primaryBudget/(base*V2_SKILL_POWER_SCALE))/(primary.hits||1)*1000)/1000,0.05,5);
      def.damageType=primary.damageType;
      def.formula='ATK * '+coeff;
      def.hits=primary.hits||1;
      def.effects=[{type:'damage'}];
      def.rawPower=Math.round(base*1000)/1000;
    } else if(primary.kind==='heal'||primary.kind==='shield'){
      const coeff=clamp(Math.round((primaryBudget/(base*V2_SUSTAIN_POWER_SCALE))*1000)/1000,0.05,5);
      def.formula='MAX_HP * '+coeff;
      def.effects=[{type:primary.kind}];
      def.rawPower=Math.round(base*1000)/1000;
    } else if(primary.kind==='status'){
      const sv=NCB.statusValue(primaryBudget,{targetCount:primary.targetCount,accuracy:primary.accuracy,cooldown:primary.cooldown,priority:primary.priority,statusStacks:1});
      def.effects=[{type:'status',status:primary.status,duration:sv.duration,stacks:sv.stacks}];
      def.rawPower=Math.round(base*1000)/1000;
    }
    // secondary effect append
    if(secondary&&secBudget>=5){
      const secEffect={...secondary.effect};
      if(secEffect.type==='status'){
        const sv=NCB.statusValue(secBudget,{targetCount:primary.targetCount,accuracy:primary.accuracy,cooldown:primary.cooldown,priority:primary.priority,statusStacks:1});
        secEffect.status=secondary.effect.status;
        secEffect.duration=Math.max(1,Math.min(6,sv.duration));
        secEffect.stacks=sv.stacks;
      } else if(secEffect.type==='gain'){
        secEffect.resource='ENERGY';
        secEffect.amount=Math.max(1,Math.round(secBudget/150));
      } else if(secEffect.type==='shield'){
        secEffect.formula='MAX_HP * '+clamp(Math.round((secBudget/(base*V2_SUSTAIN_POWER_SCALE))*1000)/1000,0.05,5);
      }
      def.effects=(def.effects||[]).concat([secEffect]);
      def.tags=def.tags.concat(secondary.tags||[]);
      def._secondary=secondary.id;
    }
    return def;
  }

  // Generate passive/trigger blueprints that ACTUALLY consume the passive budget (spec 20).
  // Returns {passives, triggers, spent}.
  function generatePassivesAndTriggers({seed,archetype,budget}){
    if(budget<=0)return{passives:[],triggers:[],spent:0};
    const prng=genSeed(seed,'passive');
    const items=[];
    const n=1+prng.random(2); // 1-2 items
    let remaining=budget;
    const out={passives:[],triggers:[],spent:0};
    for(let i=0;i<n&&remaining>=10;i++){
      const share= i===n-1 ? remaining : Math.round(remaining*(0.5+prng.random(50)/100));
      const type=prng.random(2)===0?'passive':'trigger';
      if(type==='passive'){
        const stat=PASSIVE_STATS[prng.random(PASSIVE_STATS.length)];
        const value=Math.max(1,Math.round(share/25));
        out.passives.push({stat,operation:'add',value});
      } else {
        const bp=TRIGGER_BLUEPRINTS[prng.random(TRIGGER_BLUEPRINTS.length)];
        const trigger={event:bp.event,target:bp.target,effects:[],tags:bp.tags||[]};
        if(bp.kind==='damage'){
          const pseudo={targetCount:1,accuracy:1,cooldown:0,priority:0,penetrationBonus:0,hits:1};
          const base=NCB.refSkillCost({rawPower:1,targetCount:1,accuracy:1,cooldown:0,priority:0,penetration:0});
          const coeff=clamp(Math.round((share/(base*V2_SKILL_POWER_SCALE))*1000)/1000,0.05,5);
          trigger.effects.push({type:'damage',damageType:bp.damageType||'physical',formula:'ATK * '+coeff});
        } else if(bp.kind==='heal'){
          const base=NCB.refSkillCost({rawPower:1,targetCount:1,accuracy:1,cooldown:0,priority:0,penetration:0});
          const coeff=clamp(Math.round((share/(base*triggerSustainScale(bp.event,share)))*1000)/1000,0.05,5);
          trigger.effects.push({type:'heal',formula:'MAX_HP * '+coeff});
        } else if(bp.kind==='shield'){
          const base=NCB.refSkillCost({rawPower:1,targetCount:1,accuracy:1,cooldown:0,priority:0,penetration:0});
          const coeff=clamp(Math.round((share/(base*triggerSustainScale(bp.event,share)))*1000)/1000,0.05,5);
          trigger.effects.push({type:'shield',formula:'MAX_HP * '+coeff});
        } else if(bp.kind==='status'){
          const sv=NCB.statusValue(share,{targetCount:1,accuracy:1,cooldown:0,priority:0,statusStacks:1});
          trigger.effects.push({type:'status',status:bp.status,duration:Math.max(1,Math.min(6,sv.duration)),stacks:sv.stacks});
        } else if(bp.kind==='gain'){
          trigger.effects.push({type:'gain',resource:bp.resource||'ENERGY',amount:Math.max(1,Math.round(share/150))});
        }
        out.triggers.push(trigger);
      }
      out.spent+=share;
      remaining-=share;
    }
    out.spent=Math.round(out.spent*10)/10;
    return out;
  }

  // v2 full pipeline.
  function generateCardV2(opts={}){
    const version=CARD_GENERATOR_VERSION_V2;
    if(opts.generatorVersion!==undefined&&opts.generatorVersion!==2)throw new Error('unsupported generatorVersion: '+opts.generatorVersion+' (only v2)');
    const seed=opts.seed==null?'':String(opts.seed);
    const rarity=NCB.toV2RarityId(opts.rarity);
    const level=NCB.normalizeLevel(opts.level);
    const archetype=opts.archetype||'Balanced';
    const tags=opts.tags||[];
    const identity=canonicalGenerationIdentityV2({seed,rarity,level,archetype,tags,generatorVersion:2});
    const id=NCB.cardId(identity);

    const rpi=NCB.rpiV2(rarity);
    const lf=NCB.levelFactor(level);
    const quality=NCB.qualityFactor(seed);
    const powerIndex=NCB.computeCardPowerV2({rarity,level,quality});
    const generationBudget=NCB.generationBudget(powerIndex);
    const split=NCB.splitBudget(generationBudget);

    const primary=NCB.allocatePrimary({budget:split.primary,archetype,seed,conversion:V2_PRIMARY_CONVERSION});
    const secondary=NCB.allocateSecondary({budget:split.secondary,seed});

    const skillsRaw=V2_TARGET_SKILLS.map((f,i)=>composeSkill({seed,archetype,slot:i,budget:Math.round(split.activeSkills*f),cardId:id}));
    // Composition constraints (spec balance audit §7): repair non-healthy kits.
    const skills=enforceComposition({archetype,seed,skills:skillsRaw,cardId:id});

    const passiveOut=generatePassivesAndTriggers({seed,archetype,budget:split.passiveTrigger});

    const stats={...primary.stats,...secondary.seconds,ENERGY_MAX:4,ENERGY_REGEN:2};
    const resources={ENERGY:{max:stats.ENERGY_MAX,regen:stats.ENERGY_REGEN}};
    const displayName=NCB.generateDisplayName({seed,archetype,rarity,level});
    const card={
      id,identity,seed,generatorVersion:2,rarity,level,quality,archetype,
      powerIndex:Math.round(powerIndex*10)/10,
      generationBudget:Math.round(generationBudget*10)/10,
      stats,resources,resistances:{},tags:[...tags,'rarity:'+rarity,'archetype:'+archetype],
      skills,passives:passiveOut.passives,statuses:[],triggers:passiveOut.triggers,
      name:displayName,displayName,
      _primary:primary,_secondary:secondary,
    };
    card.powerAudit=powerAuditV2(card,passiveOut.spent);
    return card;
  }

  function powerAuditV2(card,passiveSpent){
    const split=NCB.splitBudget(card.generationBudget);
    const primarySpent=card._primary?Object.values(card._primary.statBP||{}).reduce((a,b)=>a+Number(b||0),0):0;
    const secondarySpent=card._secondary?Number(card._secondary.spent||0):0;
    const skillsSpent=card.skills.reduce((a,s)=>a+Number(s._budget||0),0);
    const buckets={
      primary:{allocated:split.primary,spent:primarySpent},
      secondary:{allocated:split.secondary,spent:Math.round(secondarySpent*10)/10},
      skills:{allocated:split.activeSkills,spent:skillsSpent},
      passive:{allocated:split.passiveTrigger,spent:passiveSpent},
    };
    const totalSpent=buckets.primary.spent+buckets.secondary.spent+buckets.skills.spent+buckets.passive.spent;
    return{totalBudget:Math.round(card.generationBudget*10)/10,buckets,unspent:Math.round((card.generationBudget-totalSpent)*10)/10};
  }

  // v2 pack assembly: includes passives/triggers so they fight in a real battle.
  function assembleCardPackV2(card){
    const unitId=card.id;
    const unit={
      id:unitId,name:card.displayName||card.name,role:card.archetype,description:'Generated '+card.rarity+' '+card.archetype+' (v'+card.generatorVersion+')',
      stats:{...card.stats},skills:card.skills.map(s=>s.id),
      resistances:card.resistances||{},tags:card.tags||[],
    };
    if(Array.isArray(card.passives)&&card.passives.length)unit.passives=card.passives.map(p=>({...p}));
    if(Array.isArray(card.triggers)&&card.triggers.length)unit.triggers=card.triggers.map(t=>({...t,effects:(t.effects||[]).map(e=>({...e}))}));
    const skills={};for(const s of card.skills){const {_budget,...def}=s;skills[s.id]={...def};}
    const statuses={};
    const collect=effects=>{for(const e of effects||[])if(e.status&&!statuses[e.status]&&NCB.STATUS_DEFS[e.status])statuses[e.status]=NCB.STATUS_DEFS[e.status];};
    for(const s of card.skills)collect(s.effects);
    for(const t of card.triggers||[])collect(t.effects);
    return{units:{[unitId]:unit},skills,statuses};
  }
  function deployCardV2(card){
    const pack=assembleCardPackV2(card);
    Object.assign(NCB.UNIT_DEFS,pack.units);
    Object.assign(NCB.SKILL_DEFS,pack.skills);
    Object.assign(NCB.STATUS_DEFS,pack.statuses);
    return card.id;
  }

  // Version dispatcher (spec 11): v1 reproduces the exact v1.1.0 algorithm, v2 is default.
  function generateCardByVersion(opts={}){
    const version=opts.generatorVersion===undefined?CARD_GENERATOR_VERSION_V2:opts.generatorVersion;
    if(version===1)return NCB.generateCard({...opts,generatorVersion:1});
    if(version===2)return generateCardV2({...opts,generatorVersion:2});
    throw new Error('unsupported generatorVersion: '+version);
  }

  NCB.CARD_GENERATOR_VERSION_V2=CARD_GENERATOR_VERSION_V2;
  NCB.GRAMMAR_PRIMARY=GRAMMAR_PRIMARY;
  NCB.GRAMMAR_SECONDARY=GRAMMAR_SECONDARY;
  NCB.ARCHETYPE_PRIMARY=ARCHETYPE_PRIMARY;
  NCB.TRIGGER_BLUEPRINTS=TRIGGER_BLUEPRINTS;
  NCB.V2_PRIMARY_CONVERSION=V2_PRIMARY_CONVERSION;
  NCB.V2_SKILL_POWER_SCALE=V2_SKILL_POWER_SCALE;
  NCB.V2_SUSTAIN_POWER_SCALE=V2_SUSTAIN_POWER_SCALE;
  NCB.COMPOSITION_RULES=COMPOSITION_RULES;
  NCB.skillRole=skillRole;
  NCB.enforceComposition=enforceComposition;
  NCB.canonicalGenerationIdentityV2=canonicalGenerationIdentityV2;
  NCB.composeSkill=composeSkill;
  NCB.generatePassivesAndTriggers=generatePassivesAndTriggers;
  NCB.generateCardV2=generateCardV2;
  NCB.assembleCardPackV2=assembleCardPackV2;
  NCB.deployCardV2=deployCardV2;
  NCB.generateCardByVersion=generateCardByVersion;
  NCB.powerAuditV2=powerAuditV2;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);