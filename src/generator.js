(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  const CARD_GENERATOR_VERSION=1;
  // budget/100 -> formula coefficient for a single-target, 100% acc, cd0, prio0 skill
  const GEN_SKILL_POWER_SCALE=100;
  const RECIPE_POOLS={
    Balanced:['strike','heavy','cleave','heal','shield','haste'],
    Tank:['strike','heavy','shield','fortify','cleave'],
    Bruiser:['strike','heavy','cleave','fortify','weaken'],
    Assassin:['strike','pierce','flurry','heavy','weaken'],
    Mage:['fire-bolt','ember','cleave','enfeeble','haste'],
    Support:['heal','shield','haste','fortify','strike'],
    Controller:['weaken','enfeeble','flurry','haste','cleave'],
  };
  const SKILL_BUDGET_SPLIT=[0.30,0.30,0.40]; // skill1, skill2, skill3(ult)
  function generatorSeedStream(seed,salt){
    const base=NCB.seedHash(String(seed)+':'+salt);
    return new NCB.Gen5PRNG('gen5,'+((base>>>0)&0xffff)+','+((base>>>16)&0xffff)+',3,4');
  }
  function cardId(seed){return 'gen_'+((NCB.seedHash(seed)>>>0).toString(16).slice(0,8));}
  // Coefficient for a recipe so its reference cost fits the allocated skill budget.
  function skillCoefficient(budget,recipe){
    const base=NCB.recipeBaseCost(recipe);
    const hits=recipe.hits||1;
    const c=(budget/(base*GEN_SKILL_POWER_SCALE))/hits;
    return Math.max(0.05,Math.min(5,Math.round(c*1000)/1000));
  }
  function statusValue(budget,recipe){
    const base=NCB.recipeBaseCost(recipe);
    const d=Math.max(1,Math.min(6,Math.round(budget/(base*40))));
    return{duration:d,stacks:recipe.statusStacks||1};
  }
  function pickRecipes(archetype,seed){
    const pool=RECIPE_POOLS[archetype]||RECIPE_POOLS.Balanced;
    const prng=generatorSeedStream(seed,'skills');
    const shuffled=pool.slice();
    for(let i=shuffled.length-1;i>0;i--){const j=prng.random(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
    const out=[];
    for(const id of shuffled){
      if(out.length>=3)break;
      if(!out.includes(id))out.push(id);
    }
    // guarantee at least one damage skill
    if(!out.some(id=>NCB.SKILL_RECIPES.find(r=>r.id===id)?.kind==='damage')){
      const dmg=pool.find(id=>NCB.SKILL_RECIPES.find(r=>r.id===id)?.kind==='damage');
      if(dmg&&!out.includes(dmg))out[out.length-1]=dmg;
    }
    return out;
  }
  NCB.CARD_GENERATOR_VERSION=CARD_GENERATOR_VERSION;
  NCB.GEN_SKILL_POWER_SCALE=GEN_SKILL_POWER_SCALE;
  NCB.RECIPE_POOLS=RECIPE_POOLS;
  NCB.generatorSeedStream=generatorSeedStream;
  NCB.cardId=cardId;
  NCB.skillCoefficient=skillCoefficient;
  NCB.statusValue=statusValue;
  NCB.pickRecipes=pickRecipes;

  // 15-step pipeline (spec 27): rarity->RPI->LevelFactor->QualityFactor->CardPower->
  // GenerationBudget->split->archetype weights->jitter->normalize->cost convert->
  // recipe pick->budget scale->compile->power estimate. MC is Sub-Plan 5.
  function generateCard(opts={}){
    const rarity=opts.rarity||'C';
    const level=opts.level||100;
    const archetype=opts.archetype||'Balanced';
    const seed=opts.seed==null?'':String(opts.seed);
    const tags=opts.tags||[];
    const generatorVersion=opts.generatorVersion||CARD_GENERATOR_VERSION;
    // steps 1-4
    const rpi=NCB.rpiOf(rarity);
    const lf=NCB.levelFactor(level);
    const quality=NCB.qualityFactor(seed);
    // step 4: CardPower = RPI * LevelFactor * QualityFactor
    const powerIndex=NCB.computeCardPower({rarity,level,quality});
    const generationBudget=NCB.generationBudget(powerIndex);
    const split=NCB.splitBudget(generationBudget);
    // steps 7-10: primary allocation via archetype + jitter
    const primary=NCB.allocatePrimary({budget:split.primary,archetype,seed});
    const secondary=NCB.allocateSecondary({budget:split.secondary,seed});
    // step 11: pick 3 recipes from the finite kit
    const recipeIds=NCB.pickRecipes(archetype,seed);
    const skillBudgets=SKILL_BUDGET_SPLIT.map(f=>Math.round(split.activeSkills*f));
    const id=NCB.cardId(seed);
    const skills=[];
    const unitSkills=[];
    recipeIds.forEach((recipe,i)=>{
      const r=NCB.SKILL_RECIPES.find(x=>x.id===recipe);
      if(!r)throw new Error('unknown recipe '+recipe);
      const sid=id+'-'+recipe;
      unitSkills.push(sid);
      const budget=skillBudgets[i];
      let def={id:sid,name:r.name+(i===2?'·终':''),kind:r.kind,target:r.target,cost:1,cooldown:r.cooldown,priority:r.priority,accuracy:r.accuracy,tags:r.tags,_budget:budget};
      if(r.scaling==='status'){
        const sv=NCB.statusValue(budget,r);
        def.effects=[{type:'status',status:r.status,duration:sv.duration,stacks:sv.stacks}];
      } else {
        const coeff=NCB.skillCoefficient(budget,r);
        const hits=r.hits||1;
        if(r.scaling==='heal'){def.formula='MAX_HP * '+coeff;def.effects=[{type:'heal'}];}
        else if(r.scaling==='shield'){def.formula='MAX_HP * '+coeff;def.effects=[{type:'shield'}];}
        else{def.damageType=r.damageType||'physical';def.formula='ATK * '+coeff;def.effects=hits>1?[{type:'damage',hits}]:[{type:'damage'}];}
      }
      skills.push(def);
    });
    // card schema (spec 30)
    const stats={...primary.stats,...secondary.seconds,ENERGY_MAX:4,ENERGY_REGEN:2};
    const resources={ENERGY:{max:stats.ENERGY_MAX,regen:stats.ENERGY_REGEN}};
    const card={
      id,seed,generatorVersion,rarity,level,quality,archetype,
      powerIndex:Math.round(powerIndex*10)/10,
      generationBudget:Math.round(generationBudget*10)/10,
      stats,resources,resistances:{},tags:[...tags,'rarity:'+rarity,'archetype:'+archetype],
      skills,passives:[],statuses:[],triggers:[],
      name:rarity+' '+archetype,
      _primary:primary,_secondary:secondary,
    };
    card.powerAudit=powerAudit(card);
    return card;
  }

  // PowerAudit (spec 31): report where the fixed budget was allocated/spent.
  function powerAudit(card){
    const split=NCB.splitBudget(card.generationBudget);
    const primarySpent=card._primary?Object.values(card._primary.statBP||{}).reduce((a,b)=>a+Number(b||0),0):0;
    const secondarySpent=card._secondary?Number(card._secondary.spent||0):0;
    const skillsSpent=card.skills.reduce((a,s)=>a+Number(s._budget||0),0);
    const buckets={
      primary:{allocated:split.primary,spent:primarySpent},
      secondary:{allocated:split.secondary,spent:Math.round(secondarySpent*10)/10},
      skills:{allocated:split.activeSkills,spent:skillsSpent},
      passive:{allocated:split.passiveTrigger,spent:0},
    };
    const totalSpent=buckets.primary.spent+buckets.secondary.spent+buckets.skills.spent+buckets.passive.spent;
    return{totalBudget:Math.round(card.generationBudget*10)/10,buckets,unspent:Math.round((card.generationBudget-totalSpent)*10)/10};
  }

  // Compile the generated card into a content pack that passes NCB.validateContentPack
  // and can be registered so it fights in a real battle.
  function assembleCardPack(card){
    const unitId=card.id;
    const unit={
      id:unitId,name:card.name,role:card.archetype,description:'Generated '+card.rarity+' '+card.archetype+' (v'+card.generatorVersion+')',
      stats:{...card.stats},skills:card.skills.map(s=>s.id),
      resistances:card.resistances||{},tags:card.tags||[],
    };
    const skills={};for(const s of card.skills){const {_budget,...def}=s;skills[s.id]={...def};}
    const statuses={};
    for(const s of card.skills)for(const e of (s.effects||[]))if(e.status&&!statuses[e.status]&&NCB.STATUS_DEFS[e.status])statuses[e.status]=NCB.STATUS_DEFS[e.status];
    return{units:{[unitId]:unit},skills,statuses};
  }
  // Register a generated card into the live NCB registries so createBattle can use it.
  function deployCard(card){
    const pack=assembleCardPack(card);
    Object.assign(NCB.UNIT_DEFS,pack.units);
    Object.assign(NCB.SKILL_DEFS,pack.skills);
    Object.assign(NCB.STATUS_DEFS,pack.statuses);
    return card.id;
  }
  NCB.generateCard=generateCard;
  NCB.assembleCardPack=assembleCardPack;
  NCB.deployCard=deployCard;
  NCB.powerAudit=powerAudit;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
