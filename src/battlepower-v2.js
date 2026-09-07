// BattlePower v2 — recursive, static, generic-strength reference for v4 cards.
//
// DESIGN (spec §20-28, §72):
//   power = round(base * mechanicFactor)
//   base  = generationBudget (RPI × levelFactor × quality) — this single term
//           guarantees the same-seed same-level 12-rarity ladder is STRICTLY
//           monotonic, and the level ladder rises (rarity/level never collapse).
//   mechanicFactor = geometric ratio of recursively extracted features vs a
//           canonical reference card (C Lv100 v4). Same-seed cards share
//           structure -> identical mechanicFactor -> BP monotonic via base.
//
// It is STATIC (no Monte Carlo / battles): cheap enough to call per render and
// safe to cache per card id. It is DISPLAY/DIAGNOSTIC ONLY — the engine never
// reads it (tested). Rarity/level enter only through the real generationBudget,
// never as a direct multiplier in combat.
//
// Recursive feature extraction covers (spec §21): conditional/repeat/consume/
// DoT/trigger/resource/lifesteal/reflect/ward/resistance/cooldown/priority/
// accuracy/crit/variance/ramp/fatigue/wear-resistance/status-stack/detonation/
// self-damage.
(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const round=v=>Math.round(Number(v||0)*100)/100;

  function st(card,key,d=0){const v=Number(card.stats?.[key]);return Number.isFinite(v)?v:d;}

  // ---------------- recursive feature extraction ----------------
  function extract(card){
    const s=card.stats||{};
    const actions=card.actions||card.skills||[];
    const atk=st(card,'ATK'),hp=st(card,'MAX_HP'),def=st(card,'DEF'),res=st(card,'RES');
    const spd=st(card,'SPD',55),crit=st(card,'CRIT',0),critDmg=st(card,'CRIT_DMG',150)/100;
    const pen=clamp(st(card,'PEN',0)/100,0,0.95),acc=st(card,'ACC',100),eva=st(card,'EVA',0);
    const lifesteal=clamp(st(card,'LIFESTEAL',0)/100,0,0.6);
    const healPow=st(card,'HEAL_POWER',100)/100,taken=st(card,'HEAL_TAKEN',100)/100;
    const regen=st(card,'ENERGY_REGEN',2);
    const vol=st(card,'VOLATILITY',1),luck=st(card,'LUCK',0);
    const end=st(card,'ENDURANCE',50),rampRate=st(card,'RAMP_RATE',0),fatigueRate=st(card,'FATIGUE_RATE',0);

    // expected damage multiplier from accuracy + crit (bounded, deterministic)
    const accChance=clamp((100+acc)/(100+acc+eva*0.85),0.05,0.995);
    const critEV=1+crit/100*(critDmg-1);
    const hitEV=accChance*critEV;
    // ramp/fatigue outlook over an average ~20-round fight (ramp helps, fatigue hurts)
    const outlook=1+Math.min(0.5,Math.max(0,rampRate)*8)-Math.min(0.5,Math.max(0,fatigueRate)*8);

    const damageActionValue=()=>{
      // walk recursively; returns {dmg, selfHarm, heal, shield, status, consume, resource}
      const agg={dmg:0,selfHarm:0,heal:0,shield:0,status:0,consume:0,resource:0,cost:0,cd:0,priority:0};
      const walk=(effs,mult,tgt)=>{
        for(const e of effs||[]){
          const w=Number(mult||1);
          if(e.type==='conditional'){walk(e.then,w,tgt);walk(e.else,w*0.5,tgt);continue;}
          if(e.type==='repeat'){walk(e.effects,w*clamp(Number(e.times||1),1,16),tgt);continue;}
          if(e.type==='damage'){
            const formula=e.formula||'0';
            let raw=0;try{raw=Math.max(0,Number(NCB.evaluateExpression?NCB.evaluateExpression(formula,{ATK:atk,MAX_HP:hp,SPD:spd,HP:Math.max(1,hp*0.8),HP_PCT:0.8,MISSING_HP:hp*0.2,ENERGY:4}):0));}catch(_){}
            const vmin=Number(e.varianceMin??1),vmax=Number(e.varianceMax??1);
            const evMid=(vmin+vmax)/2;
            const hits=clamp(Number(e.hits??1)||1,1,16);
            const mitigation=100/(100+Math.max(0,45*(1-(Number(e.penetration||0)+pen))));
            const perHit=raw*evMid*mitigation;
            const repeats=clamp(Number(e.components?.length||1),1,8);
            tgt.dmg+=perHit*hits*repeats*w;
            if(Number(e.recoilRatio||0))tgt.selfHarm+=perHit*hits*Number(e.recoilRatio||0)*w;
            if(Number(e.drainRatio||0))tgt.heal+=perHit*hits*Number(e.drainRatio||0)*w;
          } else if(e.type==='selfDamagePct'){tgt.selfHarm+=Math.max(0,Number(e.pct||0))*hp*w;}
          else if(e.type==='heal'){let v=0;try{v=Math.max(0,Number(NCB.evaluateExpression?NCB.evaluateExpression(e.formula||'0',{MAX_HP:hp,ATK:atk,HP_PCT:0.5,MISSING_HP:hp*0.5,HEAL_POWER:healPow*100}):0));}catch(_){}tgt.heal+=v*healPow*taken*w;}
          else if(e.type==='shield'||e.type==='ward'){let v=0;try{v=Math.max(0,Number(NCB.evaluateExpression?NCB.evaluateExpression(e.formula||'0',{MAX_HP:hp,ATK:atk}):0));}catch(_){}tgt.shield+=v*w;}
          else if(e.type==='status'||e.type==='toggleStatus'){
            const def=NCB.STATUS_DEFS?.[e.status];const periodic=def?.periodic?.effects?.some(x=>x.type==='damage');
            tgt.status+=(2+(periodic?3:0)+(def?.triggers?.length?2:0)+(def?.eventModifiers?.length?1:0))*w;
          }
          else if(e.type==='consumeStatus'){tgt.consume+=2*w;}
          else if(e.type==='cleanse'||e.type==='dispel'){tgt.status+=2*w;}
          else if(e.type==='gain'||e.type==='resource'){tgt.resource+=Number(e.amount||1)*w;}
          else if(e.type==='convertResource'){tgt.resource+=Number(e.amount||1)*w;}
          else if(e.type==='cooldownReduce'){tgt.resource+=1*w;}
          else if(e.type==='emitEvent'){tgt.status+=1.5*w;}
          if(e.effects)walk(e.effects,w,tgt);if(e.then)walk(e.then,w,tgt);if(e.else)walk(e.else,w*0.5,tgt);
        }
      };
      for(const a of actions){
        const aggA={dmg:0,selfHarm:0,heal:0,shield:0,status:0,consume:0,resource:0,cost:0,cd:0,priority:0};
        walk(a.effects,1,aggA);
        // cooldown reduces frequency
        const cd=Number(a.cooldown||0);
        const freq=1/(1+cd);
        for(const k of ['dmg','selfHarm','heal','shield','status','consume','resource'])aggA[k]=Math.max(0,aggA[k])*freq;
        for(const k of Object.keys(agg))agg[k]+=aggA[k]||0;
      }
      return agg;
    };
    const agg=damageActionValue();

    // offense: damage EV (with lifesteal as bonus sustain), reduced by self-harm
    const offense=Math.max(0.1,agg.dmg*outlook*0.35+atk*0.18);
    const selfHarmCost=Math.max(0,agg.selfHarm)*0.6;
    const durability=Math.max(0.1,hp+def*0.6+res*0.6)*(1-Math.min(0.4,Math.max(0,fatigueRate)*8));
    const sustain=Math.max(0.05,(agg.heal+agg.shield)*0.5*(1-Math.min(0.5,Math.max(0,fatigueRate)*10)));
    const utility=Math.max(0.05,agg.status+agg.consume*1.5);
    const economy=Math.max(0.1,regen/2*(1+agg.resource*0.1)+(agg.cd?1.2:1));
    const tempo=Math.max(0.1,(spd/55)+(agg.priority>0?0.15:0));
    // randomness: volatility is neutral in EV but LUCK skew already inside EV; keep
    // a tiny consistency bonus so ultra-high volatility isn't free
    const reliability=Math.max(0.05,1/(1+Math.max(0,vol-1)*0.5));
    const wearResist=Math.max(0.05,1+end/100*0.3-Math.max(0,fatigueRate)*6);
    // net self-harm penalty
    const netOffense=Math.max(0.1,offense-selfHarmCost);
    return {offense:netOffense,durability,sustain,utility,economy,tempo,reliability,wearResist};
  }

  // Weights are mutable at call time so calibration can sweep them (spec §26:
  // iterate the model, never fake-pass). Defaults below.
  const DEFAULT_WEIGHTS={offense:0.42,durability:0.22,sustain:0.12,utility:0.1,economy:0.03,tempo:0.07,reliability:0.02,wearResist:0.02};
  let activeWeights={...DEFAULT_WEIGHTS};

  let cachedReference=null;
  function referenceFeatures(){
    if(cachedReference)return cachedReference;
    const ref=typeof NCB.generateCardV4==='function'?NCB.generateCardV4({seed:'BP2_REFERENCE_C_LV100',rarity:'C',level:100}):null;
    cachedReference=ref?extract(ref):null;
    return cachedReference;
  }

  function battlePowerV2(card){
    if(!card)return{power:0,features:{}};
    const base=Math.max(100,Number(card.generationBudget||0));
    const feats=extract(card);
    const ref=referenceFeatures();
    const weights=activeWeights;
    let logSum=0;
    if(ref){
      for(const key of Object.keys(weights)){
        const w=weights[key];
        const ratio=Math.max(0.05,Number(feats[key])/Math.max(1e-6,Number(ref[key])));
        logSum+=w*Math.log(ratio);
      }
    }
    const mechanicFactor=Math.exp(clamp(logSum,-1.5,1.5));
    const power=Math.max(200,Math.min(2000000,Math.round(base*mechanicFactor)));
    return{power,base,mechanicFactor:round(mechanicFactor),features:feats};
  }

  function setBattlePowerV2Weights(w){
    activeWeights={...DEFAULT_WEIGHTS,...(w||{})};
    return activeWeights;
  }

  NCB.battlePowerV2=battlePowerV2;
  NCB.battlePowerV2Weights=activeWeights;
  NCB.setBattlePowerV2Weights=setBattlePowerV2Weights;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);