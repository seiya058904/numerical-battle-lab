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
    const statusDefs={...NCB.STATUS_DEFS,...Object.fromEntries((card.statuses||[]).map(d=>[d.id,d]))};
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
    const timeFactor=r=>Math.min(st(card,'RAMP_CAP',1),1+Math.max(0,r-st(card,'RAMP_START'))*rampRate)*Math.max(st(card,'FATIGUE_CAP',1),1-Math.max(0,r-st(card,'FATIGUE_START',999))*fatigueRate);
    const outlook=[3,12,25,45].reduce((n,r)=>n+timeFactor(r),0)/4;
    const scope={...s,ATK:atk,MAX_HP:hp,SPD:spd,HP:hp*.6,HP_PCT:.6,MISSING_HP:hp*.4,ENERGY:4,ROUND:18,BATTLE_TURN:18,STACKS:2,CONSUMED_STACKS:2,TARGET_HP:hp*.6,TARGET_MAX_HP:hp,TARGET_HP_PCT:.6,EVENT_DAMAGE:atk,EVENT_HP_DAMAGE:atk};
    const evaluate=f=>{try{return Math.max(0,Number(NCB.evaluateExpression(String(f??'0'),scope))||0);}catch(_){return 0;}};

    const damageActionValue=()=>{
      // walk recursively; returns {dmg, selfHarm, heal, shield, status, consume, resource}
      const agg={dmg:0,selfHarm:0,heal:0,shield:0,status:0,consume:0,resource:0,cost:0,cd:0,priority:0};
      const walk=(effs,mult,tgt,depth=0,seen=new Set())=>{
        if(depth>6)return;
        for(const e of effs||[]){
          const w=Number(mult||1);
          if(e.type==='conditional'){walk(e.then,w*.6,tgt,depth+1,seen);walk(e.else,w*.4,tgt,depth+1,seen);continue;}
          if(e.type==='repeat'){walk(e.effects,w*clamp(Number(e.times||1),1,16),tgt,depth+1,seen);continue;}
          if(e.type==='damage'){
            const components=e.components||[{formula:e.formula||'0',multiplier:1}];
            const vmin=Number(e.varianceMin??1),vmax=Number(e.varianceMax??1);
            const mid=(vmin+vmax)/2,half=(vmax-vmin)/2*vol;
            const meanU=luck>=0?(1+luck)/(2+luck):1/(2-luck);
            const evMid=Math.max(0,mid-half+2*half*meanU);
            const hits=clamp(Number(e.hits??1)||1,1,32);
            const mitigation=100/(100+Math.max(0,45*(1-clamp(Number(e.penetration??pen),0,1))));
            const perHit=components.reduce((n,c)=>n+evaluate(c.formula||e.formula)*Number(c.multiplier??1),0)*evMid*mitigation*hitEV;
            tgt.dmg+=perHit*hits*w;
            if(Number(e.recoilRatio||0))tgt.selfHarm+=perHit*hits*Number(e.recoilRatio||0)*w;
            if(Number(e.drainRatio||0))tgt.heal+=perHit*hits*Number(e.drainRatio||0)*w;
          } else if(e.type==='selfDamagePct'){tgt.selfHarm+=Math.max(0,Number(e.pct||0))*hp*w;}
          else if(e.type==='heal'){const v=evaluate(e.formula);tgt.heal+=v*healPow*taken*w;}
          else if(e.type==='shield'||e.type==='ward'){const v=evaluate(e.formula);tgt.shield+=v*w;}
          else if(e.type==='status'||e.type==='toggleStatus'){
            const def=statusDefs[e.status];
            tgt.status+=(2+(def?.flags?.stun?8:0)+(def?.flags?.silence?4:0))*w*Number(e.chance??1);
            if(def&&!seen.has(e.status)){
              const next=new Set(seen);next.add(e.status);
              const duration=Math.min(4,Number(e.duration??def.duration??3));
              walk(def.periodic?.effects,w*duration*Number(e.chance??1),tgt,depth+1,next);
              if(def.turnEnd?.type==='damagePctMaxHp')tgt.dmg+=hp*Number(def.turnEnd.pct||0)*duration*w;
              if(def.turnEnd?.type==='healPctMaxHp')tgt.heal+=hp*Number(def.turnEnd.pct||0)*duration*w;
              tgt.shield+=hp*Number(def.reflectPerStack||0)*.4*w;
              for(const t of def.triggers||[])walk(t.effects,w*.7,tgt,depth+1,next);
              tgt.status+=(def.modifiers||[]).reduce((n,m)=>n+Math.abs(Number(m.value)||0)*.2,0)*w;
              tgt.status+=(def.eventModifiers||[]).reduce((n,m)=>n+Math.abs(1-Number(m.value??1))*8,0)*w;
            }
          }
          else if(e.type==='consumeStatus'){tgt.consume+=2*w;}
          else if(e.type==='cleanse'||e.type==='dispel'){tgt.status+=2*w;}
          else if(e.type==='gain'||e.type==='resource'){tgt.resource+=Number(e.amount||1)*w;}
          else if(e.type==='convertResource'){tgt.resource+=Number(e.amount||1)*w;}
          else if(e.type==='cooldownReduce'){tgt.resource+=1*w;}
          else if(e.type==='emitEvent'){for(const t of card.triggers||[])if(t.event===e.event)walk(t.effects,w,tgt,depth+1,seen);}
          if(e.effects)walk(e.effects,w,tgt,depth+1,seen);
        }
      };
      for(const a of actions){
        const aggA={dmg:0,selfHarm:0,heal:0,shield:0,status:0,consume:0,resource:0,cost:0,cd:0,priority:0};
        walk(a.effects,1,aggA);
        aggA.priority=Number(a.priority||0);aggA.cd=Number(a.cooldown||0);aggA.cost=Number(a.cost||0)+(a.costs||[]).reduce((n,c)=>n+Number(c.amount||0)*(c.resource==='HP'?.1:1),0);
        // cooldown reduces frequency
        const cd=Number(a.cooldown||0);
        const freq=1/(1+cd);
        for(const k of ['dmg','selfHarm','heal','shield','status','consume','resource'])aggA[k]=Math.max(0,aggA[k])*freq;
        for(const k of Object.keys(agg))agg[k]+=aggA[k]||0;
      }
      for(const t of card.triggers||[])if(t.event!=='command')walk(t.effects,t.event==='afterKill'?.1:.6,agg);
      return agg;
    };
    const agg=damageActionValue();

    // offense: damage EV (with lifesteal as bonus sustain), reduced by self-harm
    const offense=Math.max(0.1,agg.dmg*outlook*.35/Math.max(1,actions.length*.6)+atk*.18);
    const selfHarmCost=Math.max(0,agg.selfHarm)*0.6;
    const durability=Math.max(0.1,hp+def*0.6+res*0.6)*(1-Math.min(0.4,Math.max(0,fatigueRate)*8));
    const sustain=Math.max(0.05,(agg.heal+agg.shield+agg.dmg*lifesteal)*0.5*(1-Math.min(0.5,Math.max(0,fatigueRate)*10)));
    const utility=Math.max(0.05,agg.status+agg.consume*1.5);
    const economy=Math.max(0.1,regen/2*(1+agg.resource*0.1)/(1+agg.cost*.03));
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
    const power=Math.max(1,Math.round(base*mechanicFactor));
    return{power,base,mechanicFactor:round(mechanicFactor),features:feats};
  }

  function setBattlePowerV2Weights(w){
    activeWeights={...DEFAULT_WEIGHTS,...(w||{})};
    NCB.battlePowerV2Weights=activeWeights;
    return activeWeights;
  }

  NCB.battlePowerV2=battlePowerV2;
  NCB.battlePowerV2Weights=activeWeights;
  NCB.setBattlePowerV2Weights=setBattlePowerV2Weights;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);