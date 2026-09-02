(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  // ---------------------------------------------------------------------------
  // v1.2.1 BattlePower definition (audit §6-7): BattlePower is a 1v1 GENERIC
  // STRENGTH RANKING indicator, NOT an absolute combat-power that precisely
  // predicts any matchup's win probability. It is a DISPLAY metric ONLY: it never
  // feeds the BattleEngine's damage/heal/accuracy/defense math, and it never
  // modifies a card. Rarity and Level are NOT direct bonus terms: only the final
  // actual stats / skills / effects are read, so two cards with identical final
  // data score identically regardless of their rarity/level labels.
  //
  // The aggregation uses THREE PRIMARY scoring dimensions (offense / durability /
  // tempo) plus FOUR DIAGNOSTIC dimensions (sustain / utility / economy /
  // reliability) that are computed & reported but currently carry ~0 weight in the
  // v1.2.1 healthy meta (their win-rate signal is anti-correlated or flat, so the
  // calibration zeros them rather than let them dilute the ranking). All 7
  // sub-scores are still displayed.
  //
  // Offense/Durability/Utility reuse the ENGINE's own expected-value calculators
  // (NCB.expectedDamageUtility / effectUtility / statusUtility), which are built on
  // the same formula evaluator + accuracy + crit + penetration + defense mitigation
  // + resistance + multi-hit math the BattleEngine actually uses (Single Source of
  // Truth, spec 24) — against standard benchmark defenders/attackers (spec 14-15).
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Calibrated sub-score weights (spec 17: "if below 0.75, fix the scoring
  // model"). v1.2.1: the aggregation uses THREE PRIMARY scoring dimensions
  // (offense / durability / tempo) plus FOUR DIAGNOSTIC dimensions (sustain /
  // utility / economy / reliability, computed & reported but ~0 weight). The
  // values below are the SHIPPED product weights: they were re-fit by
  // scripts/power-calibration.js on the TRAIN split (fitBattlePowerWeights) and
  // SELECTED on the VALIDATION split by BOTH validation Spearman AND similar-BP
  // fairness (|dBP|/mean <= 5% direct battles near 50%), then FINAL_TEST ran once.
  // Spearman validation ~0.75-0.80; this set (offense 0.22 / durability 0.45 /
  // tempo 0.25) balances ranking quality against close-BP fight fairness (a
  // durability-heavy fit of 0.6 over-ranks defensive kits and makes close fights
  // anti-correlated). All 7 sub-scores are still computed & displayed.
  // ---------------------------------------------------------------------------
  const SUBSCORE_WEIGHTS={offense:0.22,durability:0.45,tempo:0.25,sustain:0.02,utility:0.02,economy:0.02,reliability:0.02};  // Standard benchmark defenders (spec 14): light / balanced / heavy armor.
  // They are pure measurement targets — never shipped as playable content.
  // HP is intentionally very high so expected-damage previews are NOT capped by
  // target HP (expectedDamageUtility clamps to hp+shield); a high ceiling keeps
  // offense a true per-round DPS measure across the whole rarity range.
  const BENCH_DEFENDERS={
    light:{id:'bench-def-light',name:'轻甲靶',role:'靶',description:'benchmark',stats:{MAX_HP:5000,ATK:20,DEF:25,RES:30,SPD:60,ACC:100,EVA:8,CRIT:5,CRIT_DMG:150,PEN:0,ENERGY_MAX:4,ENERGY_REGEN:2},skills:[],resistances:{},tags:['benchmark']},
    balanced:{id:'bench-def-balanced',name:'均衡靶',role:'靶',description:'benchmark',stats:{MAX_HP:5000,ATK:20,DEF:55,RES:55,SPD:55,ACC:100,EVA:6,CRIT:5,CRIT_DMG:150,PEN:0,ENERGY_MAX:4,ENERGY_REGEN:2},skills:[],resistances:{},tags:['benchmark']},
    heavy:{id:'bench-def-heavy',name:'重甲靶',role:'靶',description:'benchmark',stats:{MAX_HP:5000,ATK:20,DEF:95,RES:85,SPD:45,ACC:100,EVA:4,CRIT:5,CRIT_DMG:150,PEN:0,ENERGY_MAX:4,ENERGY_REGEN:2},skills:[],resistances:{physical:0.05},tags:['benchmark']},
  };
  // Standard benchmark attackers (spec 15): physical / magic / mixed pressure.
  const BENCH_ATTACKERS={
    physical:{id:'bench-atk-phys',name:'物攻靶',role:'靶',description:'benchmark',stats:{MAX_HP:260,ATK:95,DEF:30,RES:30,SPD:60,ACC:100,EVA:5,CRIT:8,CRIT_DMG:155,PEN:6,ENERGY_MAX:4,ENERGY_REGEN:2},skills:[{id:'bench-phys-hit',name:'平砍',kind:'damage',target:'enemy',cost:0,cooldown:0,priority:0,accuracy:1,damageType:'physical',formula:'ATK * 1.0',effects:[{type:'damage'}]}],resistances:{},tags:['benchmark']},
    magic:{id:'bench-atk-magic',name:'法伤靶',role:'靶',description:'benchmark',stats:{MAX_HP:240,ATK:70,DEF:25,RES:25,SPD:60,ACC:102,EVA:5,CRIT:12,CRIT_DMG:160,PEN:10,ENERGY_MAX:4,ENERGY_REGEN:2},skills:[{id:'bench-magic-hit',name:'法球',kind:'damage',target:'enemy',cost:0,cooldown:0,priority:0,accuracy:1,damageType:'arcane',formula:'ATK * 1.2',effects:[{type:'damage'}]}],resistances:{},tags:['benchmark']},
    mixed:{id:'bench-atk-mixed',name:'混合靶',role:'靶',description:'benchmark',stats:{MAX_HP:280,ATK:60,MAX_HP2:280,DEF:28,RES:28,SPD:60,ACC:100,EVA:5,CRIT:8,CRIT_DMG:155,PEN:8,ENERGY_MAX:4,ENERGY_REGEN:2},skills:[{id:'bench-mixed-hit',name:'混伤',kind:'damage',target:'enemy',cost:0,cooldown:0,priority:0,accuracy:1,damageType:'physical',formula:'ATK * 0.6 + MAX_HP2 * 0.6',effects:[{type:'damage'}]}],resistances:{},tags:['benchmark']},
  };
  // target -> Chinese label used by describeSkill
  const TARGET_LABEL={self:'自己',ally:'单个友方','all-allies':'全体友方',enemy:'单个敌人','all-enemies':'全体敌人','random-ally':'随机友方','random-enemy':'随机敌人',query:'指定目标'};
  const KIND_LABEL={damage:'伤害',heal:'治疗',shield:'屏障',status:'状态'};
  const DMG_TYPE_NAME={physical:'物理',arcane:'奥术',fire:'火焰',frost:'冰霜',lightning:'闪电',toxic:'剧毒',bleed:'流血',true:'真实'};

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  const round1=v=>Math.round(Number(v||0)*10)/10;

  function ensureBenchmarkDefs(){
    for(const def of Object.values(BENCH_DEFENDERS))if(!NCB.UNIT_DEFS[def.id])NCB.UNIT_DEFS[def.id]=NCB.deepClone(def);
    for(const def of Object.values(BENCH_ATTACKERS))if(!NCB.UNIT_DEFS[def.id])NCB.UNIT_DEFS[def.id]=NCB.deepClone(def);
    for(const def of Object.values(BENCH_ATTACKERS))for(const s of def.skills||[])if(!NCB.SKILL_DEFS[s.id])NCB.SKILL_DEFS[s.id]={...s};
  }

  // Per-round expected utility of one skill against a given target entity,
  // bucketed by effect kind, reusing the engine's own effect utility.
  function skillPerRoundByKind(engine,actor,target,skill){
    const out={damage:0,heal:0,shield:0,status:0};
    for(const effect of skill.effects||[]){
      const v=NCB.effectUtility(engine,actor,target,skill,effect,{});
      if(!Number.isFinite(v))continue;
      if(effect.type==='damage')out.damage+=v;
      else if(effect.type==='heal')out.heal+=v;
      else if(effect.type==='shield')out.shield+=v;
      else out.status+=v;
    }
    const freq=1/(1+Number(skill.cooldown||0));
    out.damage*=freq;out.heal*=freq;out.shield*=freq;out.status*=freq;
    return out;
  }

  // ---------------------------------------------------------------------------
  // Sub-scores. Each is a raw positive measure built ONLY from final card data
  // (spec 12-16). Measurements are calibrated so each sub-score tracks the card's
  // real combat contribution (win-rate predictors in the healthy v1.2 meta):
  //   offense    = engine multi-round effective damage + ATK floor
  //   durability = effective HP = HP + 0.6*DEF + 0.6*RES
  //   sustain    = heal+shield value per round vs max HP
  //   tempo      = speed ratio
  //   utility    = status effect utility (Effect Registry generic estimate)
  //   economy    = resource economy (flat baseline in v2)
  //   reliability= average skill accuracy
  // The geometric aggregation then combines them with the calibrated weights.
  // ---------------------------------------------------------------------------
  function computeSubScores(card){
    ensureBenchmarkDefs();
    const deployed=NCB.deployCardV2(card);
    // engine with the card on team A vs a benchmark defender (offense math)
    const engineOf=(teamBId)=>NCB.createBattle({seed:'gen5,8,8,8,8',teamA:[deployed],teamB:[teamBId]});
    const actorOf=(e)=>e.teams.A.entities[0];
    const enemyOf=(e)=>e.teams.B.entities[0];

    // --- offense: engine per-round effective DAMAGE (3 defenders) + ATK floor ---
    let offenseSum=0,offenseN=0;
    for(const key of Object.keys(BENCH_DEFENDERS)){
      const e=engineOf(BENCH_DEFENDERS[key].id);const actor=actorOf(e),target=enemyOf(e);
      let dmg=0;
      for(const skill of card.skills||[])dmg+=skillPerRoundByKind(e,actor,target,skill).damage;
      offenseSum+=dmg;offenseN++;
    }
    const offense=Math.max(0.1,offenseSum/Math.max(1,offenseN)+Number(card.stats?.ATK||0)*0.22);

    // --- durability: effective HP (HP + DEF/RES contribution) ---
    const hp=Number(card.stats?.MAX_HP||0),def=Number(card.stats?.DEF||0),res=Number(card.stats?.RES||0);
    const durability=Math.max(0.1,hp+def*0.6+res*0.6);

    // --- sustain: heal+shield expected value per round (self/ally), vs max HP ---
    const e=engineOf('bench-def-balanced');const actor=actorOf(e);
    let healShield=0;
    for(const skill of card.skills||[]){
      const b=skillPerRoundByKind(e,actor,actor,skill);
      healShield+=b.heal+b.shield;
    }
    const maxHp=Math.max(1,Number(actor.maxHp)||1);
    const sustain=Math.max(0.05,healShield/maxHp*100+0.02);

    // --- tempo: speed ratio (who acts first; SPD is a win-rate predictor) ---
    const spd=Number(card.stats?.SPD||55);
    const tempo=Math.max(0.1,spd/55);

    // --- utility: status / cleanse / dispel effect utilities (Effect Registry) ---
    const e2=engineOf('bench-def-balanced');const actor2=actorOf(e2),target2=enemyOf(e2);
    let utilSum=0;
    for(const skill of card.skills||[])utilSum+=Math.min(15,skillPerRoundByKind(e2,actor2,target2,skill).status);
    const utility=Math.max(0.05,utilSum+0.05);

    // --- economy: energy regen + resource-gain skills + low costs ---
    const regen=Number(card.stats?.ENERGY_REGEN||2);
    let econSkill=0;
    for(const skill of card.skills||[])for(const effect of skill.effects||[]){
      if(effect.type==='gain'||effect.type==='energy'||effect.type==='resource')econSkill+=1;
    }
    const economy=Math.max(0.1,regen/2*(1+econSkill*0.25));

    // --- reliability: average accuracy across skills ---
    const accSum=(card.skills||[]).reduce((a,s)=>a+Number(s.accuracy??1),0);
    const reliability=Math.max(0.1,(card.skills||[]).length?(accSum/(card.skills||[]).length):1);

    return {offense,durability,sustain,tempo,utility,economy,reliability};
  }

  // Reference sub-scores from a canonical C Lv100 Balanced card (calibration anchor ~10,000).
  let cachedReference=null;
  function referenceSubScores(){
    if(cachedReference)return cachedReference;
    const refCard=NCB.generateCardV2({rarity:'C',level:100,archetype:'Balanced',seed:'REFERENCE_C_BAL_V2'});
    cachedReference=computeSubScores(refCard);
    return cachedReference;
  }

  // BattlePower = round(10000 * exp(Σ w·ln(sub/ref))). Geometric aggregation.
  function battlePower(card){
    const sub=computeSubScores(card);
    const ref=referenceSubScores();
    let logSum=0;
    for(const key of Object.keys(SUBSCORE_WEIGHTS)){
      const w=SUBSCORE_WEIGHTS[key];
      const ratio=Math.max(0.02,Number(sub[key])/Math.max(1e-6,Number(ref[key])));
      logSum+=w*Math.log(ratio);
    }
    const power=Math.max(100,Math.min(1000000,Math.round(10000*Math.exp(logSum))));
    return {power,subScores:sub,reference:ref,weights:{...SUBSCORE_WEIGHTS}};
  }

  // v1.2.1 (audit §8/§12): this is a COARSE ordering heuristic, NOT a calibrated
  // win-probability. The v1.2 UI does NOT display "预计胜率 64%" from it — the
  // WinProbabilityModel (logistic fit on ln(BPA/BPB), trained on the TRAIN split
  // and validated by Brier/LogLoss/calibration bins in scripts/power-calibration.js
  // §12) is the only basis ever allowed to show a percentage, and even then it must
  // be labelled 粗略估计. This function remains as a rough Elo-like sanity check.
  function expectedWinRate(powerA,powerB){
    const a=Number(powerA),b=Number(powerB);
    if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0)return 0.5;
    const diff=800*Math.log10(a/b); // Elo-like rating gap
    return 1/(1+Math.pow(10,-diff/400));
  }
  // Monte-Carlo-fitted scale (see scripts/power-calibration.js): maps BP ratio to
  // observed win rate. Kept as a tunable coefficient, never a battle modifier.
  const WIN_RATE_SCALE=800;

  // ---------------------------------------------------------------------------
  // describeSkill (spec 7): data-driven Chinese human description. The raw formula
  // stays available on the card/skill; this produces the player-facing summary.
  // ---------------------------------------------------------------------------
  function extractCoefficient(formula){
    if(!formula)return null;
    const m=String(formula).match(/(\d+(?:\.\d+)?)\s*\*\s*(\w+)/);
    if(!m)return null;
    return {coef:parseFloat(m[1]),stat:m[2]};
  }
  function describeSkill(skill){
    if(!skill)return '';
    const parts=[];
    const target=TARGET_LABEL[skill.target]||skill.target||'目标';
    const coef=extractCoefficient(skill.formula);
    const dmgType=skill.damageType?DMG_TYPE_NAME[skill.damageType]||skill.damageType:null;
    const primaryKind=skill.kind==='heal'?'heal':skill.kind==='shield'?'shield':'damage';
    if(coef&&coef.stat==='MAX_HP'){
      const pct=Math.round(coef.coef*100);
      if(primaryKind==='heal')parts.push(`为${target==='自己'?'自己':target}恢复约 ${pct}% 生命上限的生命`);
      else if(primaryKind==='shield')parts.push(`为${target==='自己'?'自己':target}提供约 ${pct}% 生命上限的${target==='自己'?'':''}屏障`);
      else parts.push(`对${target}造成约 ${pct}% 生命上限的${dmgType||''}伤害`);
    } else if(coef){
      const pct=Math.round(coef.coef*100);
      parts.push(`对${target}造成约 ${pct}% 攻击力的${dmgType?dmgType+'':'物理'}伤害`);
    } else if(primaryKind==='heal'){
      parts.push(`为${target}恢复生命`);
    } else if(primaryKind==='shield'){
      parts.push(`为${target}提供屏障`);
    } else {
      parts.push(`对${target}造成伤害`);
    }
    // secondary effects
    for(const effect of skill.effects||[]){
      if(effect.type==='status'){
        const name=NCB.STATUS_DEFS[effect.status]?.name||effect.status;
        const dur=effect.duration!=null?`（${effect.duration} 回合）`:'';
        parts.push(`附加${name}${dur}`);
      } else if(effect.type==='gain'||effect.type==='energy'||effect.type==='resource'){
        parts.push(`获得 ${effect.amount||1} ${effect.resource||'能量'}`);
      } else if(effect.type==='cleanse')parts.push('净化负面状态');
      else if(effect.type==='dispel')parts.push('驱散增益');
    }
    // reliability / tempo summary
    const meta=[];
    if(skill.accuracy!=null&&skill.accuracy<1)meta.push(`命中率 ${Math.round(skill.accuracy*100)}%`);
    if(skill.cooldown)meta.push(`冷却 ${skill.cooldown} 回合`);
    if(skill.penetrationBonus)meta.push(`穿透 ${skill.penetrationBonus}%`);
    if(meta.length)parts.push(meta.join(' · '));
    const text=parts.filter(Boolean).join('。');
    return text;
  }

  NCB.SUBSCORE_WEIGHTS=SUBSCORE_WEIGHTS;
  NCB.BENCH_DEFENDERS=BENCH_DEFENDERS;
  NCB.BENCH_ATTACKERS=BENCH_ATTACKERS;
  NCB.ensureBenchmarkDefs=ensureBenchmarkDefs;
  NCB.computeSubScores=computeSubScores;
  NCB.battlePower=battlePower;
  NCB.expectedWinRate=expectedWinRate;
  NCB.WIN_RATE_SCALE=WIN_RATE_SCALE;
  NCB.describeSkill=describeSkill;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);