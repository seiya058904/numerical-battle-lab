// BattlePower v3 — canonical real-strength estimator for Generator v5.
//
// Unlike v2 (power = generationBudget × mechanicFactor), v3 NEVER reads
// generationBudget, rarity, level, or quality. It is a pure function of the
// card's real numbers: stats, actions, effects, formulas, statuses, triggers,
// resources, passives. This is deliberate and required:
//
//   * Power must genuinely measure a card — editing ATK/HP/heal/coefficient
//     must change power in the real direction (test "no fake clamp").
//   * Rarity/level must NOT be able to inflate a card's displayed power beyond
//     what its real tables support (the old multi-hundred-unit mechanicFactor
//     drift that let C+ out-rank A+ is gone).
//
// The Level × Rarity envelope is enforced by the GENERATOR: it bakes a target
// power (from power-v5 targetPower) into the real numbers via bounded numeric
// calibration, so v3 lands inside the band naturally. v3 never clamps and never
// reads rarity.
//
// The estimator is roughly homogeneous of degree ~1 in the "strength continuum"
// (ATK / MAX_HP / DEF / RES / heal & shield coefficients / dot coefficients /
// passive magnitudes): scaling those magnitudes together scales power ~linearly,
// which is what makes the generator's bounded calibrator converge.
(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const round=v=>Math.round(Number(v||0)*100)/100;
  const st=(card,k,d=0)=>{const v=Number(card.stats?.[k]);return Number.isFinite(v)?v:d;};

  // Recursive feature extraction -> per-action + aggregate magnitude buckets.
  // All weights are absolute (no reference card division), so the sum really is
  // the card's own magnitude, not a ratio against an arbitrary reference.
  function extract(card){
    const s=card.stats||{};
    const actions=card.actions||card.skills||[];
    const statusDefs={...NCB.STATUS_DEFS,...Object.fromEntries((card.statuses||[]).map(d=>[d.id,d]))};
    const atk=st(card,'ATK'),hp=st(card,'MAX_HP'),def=st(card,'DEF'),res=st(card,'RES');
    const spd=st(card,'SPD',55),crit=clamp(st(card,'CRIT',0)/100,0,1),critDmg=st(card,'CRIT_DMG',150)/100;
    const pen=clamp(st(card,'PEN',0)/100,0,0.9);
    const acc=st(card,'ACC',100),eva=st(card,'EVA',0);
    const lifesteal=clamp(st(card,'LIFESTEAL',0)/100,0,0.6);
    const healPow=st(card,'HEAL_POWER',100)/100,taken=st(card,'HEAL_TAKEN',100)/100;
    const regen=st(card,'ENERGY_REGEN',2);
    const vol=st(card,'VOLATILITY',1),luck=st(card,'LUCK',0);
    const end=st(card,'ENDURANCE',50),rampRate=st(card,'RAMP_RATE',0),fatigueRate=st(card,'FATIGUE_RATE',0);
    const rampCap=st(card,'RAMP_CAP',1),fatigueCap=st(card,'FATIGUE_CAP',1);
    const rampStart=st(card,'RAMP_START',99),fatigueStart=st(card,'FATIGUE_START',999);

    const accChance=clamp((100+acc)/(100+acc+eva*0.85),0.05,0.995);
    const critEV=1+crit*(critDmg-1);
    const hitEV=accChance*critEV;
    const timeFactor=r=>Math.min(rampCap,1+Math.max(0,r-rampStart)*rampRate)*Math.max(fatigueCap,1-Math.max(0,r-fatigueStart)*fatigueRate);
    const outlook=[3,12,25,45].reduce((n,r)=>n+Math.max(0.4,Math.min(1.6,timeFactor(r))),0)/4;
    const scope={...s,ATK:atk,MAX_HP:hp,SPD:spd,HP:hp*.6,HP_PCT:.6,MISSING_HP:hp*.4,ENERGY:4,ROUND:18,BATTLE_TURN:18,STACKS:2,CONSUMED_STACKS:2,TARGET_HP:hp*.6,TARGET_MAX_HP:hp,TARGET_HP_PCT:.6,EVENT_DAMAGE:atk,EVENT_HP_DAMAGE:atk};
    const evaluate=f=>{try{return Math.max(0,Number(NCB.evaluateExpression(String(f??'0'),scope))||0);}catch(_){return 0;}};

    // mitigation multiplier the estimator assumes (own-perspective strength).
    const mitigation=100/(100+Math.max(0,50*(1-pen)));

    function damageActionValue(){
      const agg={dmg:0,selfHarm:0,heal:0,shield:0,status:0,consume:0,resource:0,cost:0,cd:0,priority:0,branches:0};
      const walk=(effs,mult,tgt,depth=0,seen=new Set())=>{
        if(depth>6)return;
        for(const e of effs||[]){
          const w=Number(mult||1);
          if(e.type==='conditional'){tgt.branches+=w;walk(e.then,w*.6,tgt,depth+1,seen);walk(e.else,w*.4,tgt,depth+1,seen);continue;}
          if(e.type==='repeat'){walk(e.effects,w*clamp(Number(e.times||1),1,16),tgt,depth+1,seen);continue;}
          if(e.type==='damage'){
            const components=e.components||[{formula:e.formula||'0',multiplier:1}];
            const vmin=Number(e.varianceMin??1),vmax=Number(e.varianceMax??1);
            const mid=(vmin+vmax)/2,half=(vmax-vmin)/2*clamp(vol,0.1,3);
            const meanU=luck>=0?(1+luck)/(2+luck):1/(2-luck);
            const evMid=Math.max(0.3,mid-half+2*half*meanU);
            const hits=clamp(Number(e.hits??1)||1,1,32);
            const perHit=components.reduce((n,c)=>n+evaluate(c.formula||e.formula)*Number(c.multiplier??1),0)*evMid*mitigation*hitEV;
            tgt.dmg+=perHit*hits*w;
            if(Number(e.recoilRatio||0))tgt.selfHarm+=perHit*hits*Number(e.recoilRatio||0)*w;
            if(Number(e.drainRatio||0))tgt.heal+=perHit*hits*Number(e.drainRatio||0)*w;
          } else if(e.type==='selfDamagePct'){tgt.selfHarm+=Math.max(0,Number(e.pct||0))*hp*w;}
          else if(e.type==='heal'){tgt.heal+=evaluate(e.formula)*healPow*taken*w;}
          else if(e.type==='shield'||e.type==='ward'){tgt.shield+=evaluate(e.formula)*w;}
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
          if(e.then)walk(e.then,w*.6,tgt,depth+1,seen);
          if(e.else)walk(e.else,w*.4,tgt,depth+1,seen);
          if(e.effects)walk(e.effects,w,tgt,depth+1,seen);
        }
      };
      for(const a of actions){
        const aggA={dmg:0,selfHarm:0,heal:0,shield:0,status:0,consume:0,resource:0,cost:0,cd:0,priority:0,branches:0};
        walk(a.effects,1,aggA);
        aggA.priority=Number(a.priority||0);aggA.cd=Number(a.cooldown||0);
        aggA.cost=Number(a.cost||0)+(a.costs||[]).reduce((n,c)=>n+Number(c.amount||0)*(c.resource==='HP'?.12:1),0);
        const freq=1/(1+Number(a.cooldown||0));
        for(const k of ['dmg','selfHarm','heal','shield','status','consume','resource'])aggA[k]=Math.max(0,aggA[k])*freq;
        for(const k of Object.keys(agg))agg[k]+=aggA[k]||0;
      }
      for(const t of card.triggers||[])if(t.event!=='command')walk(t.effects,t.event==='afterKill'?.1:.6,agg);
      return agg;
    }
    const agg=damageActionValue();

    // Sub-scores are ABSOLUTE magnitudes (no reference-card denominator).
    const offense=Math.max(0,agg.dmg*outlook/Math.max(1,actions.length*.5)+atk*.22-agg.selfHarm*0.6);
    const durability=Math.max(0,hp+def*0.7+res*0.7)*(Math.max(0.5,Math.min(1.5,1+end/100*0.3-Math.max(0,fatigueRate)*6)));
    const sustain=Math.max(0,agg.heal*1.1+agg.shield+agg.dmg*lifesteal);
    const utility=Math.max(0,agg.status+agg.consume*1.6+agg.branches*0.4);
    const economy=Math.max(0,regen*2+agg.resource*.3)/(1+Math.max(0,agg.cost)*.02);
    const tempo=Math.max(0,spd*.5+agg.priority*6);
    const reliability=Math.max(0,1/(1+Math.max(0,vol-1)*0.4));
    return {offense,durability,sustain,utility,economy,tempo,reliability,raw:{hp,atk,def,res,agg}};
  }

  // Absolute power = weighted sum of magnitude buckets, scaled so that a C Lv100
  // canonical reference scores near 1000 (the envelope anchor). The weights are
  // the "canonical currency" — no rarity term anywhere.
  const NORM=(()=>{
    // Reference: a well-rounded C Lv100 v5 card at exactly the envelope C band ~1020.
    // We normalise so measured buckets ≈ envelope anchor after weighting.
    // This constant is the estimator's global scale; it does NOT depend on rarity.
    return {offense:0.44,durability:0.22,sustain:0.13,utility:0.10,economy:0.04,tempo:0.05,reliability:0.02};
  })();

  function battlePowerV3(card){
    if(!card)return{power:0,features:null};
    const f=extract(card);
    let power=0;
    for(const k of Object.keys(NORM))power+=NORM[k]*f[k];
    power=Math.max(1,Math.round(power));
    return{power,features:{offense:f.offense,durability:f.durability,sustain:f.sustain,utility:f.utility,economy:f.economy,tempo:f.tempo,reliability:f.reliability}};
  }

  // Strength-continuum scale for calibration: returns a copy of the card with all
  // CONTINUOUS STAT MAGNITUDES multiplied by k, keeping every formula coefficient,
  // cooldown, cost, resource amount, status stack/duration and discrete structure
  // intact. Because v3 measures formulas through the stats they reference
  // (ATK/MAX_HP/DEF/RES/SPD), scaling only the stats makes every magnitude bucket
  // scale ~degree-1 in k, so BattlePower is monotonic in k and the bounded
  // bisection calibrator converges tightly. This is the ONLY way the v5 generator
  // moves real strength; it never touches discrete semantics.
  function scaleStrength(card,k){
    const c=JSON.parse(JSON.stringify(card));
    const s=c.stats||{};
    for(const key of ['ATK','MAX_HP','DEF','RES','SPD']){
      if(Number.isFinite(s[key]))s[key]=Math.round(s[key]*k);
    }
    return c;
  }

  // Bounded deterministic calibrator: steer battlePowerV3(card) to `target`.
  // BattlePower is monotonic in the strength-continuum scale k, so we use a
  // deterministic bisection on k (guaranteed convergence within the bounded
  // iteration budget). Returns {card, power, delta, iterations, converged}.
  function calibrateToPower(card,target,opts={}){
    const maxIt=opts.maxIterations||24,tol=opts.tolerance||0.008;
    const base=JSON.parse(JSON.stringify(card));
    const p=(k)=>battlePowerV3(scaleStrength(base,k)).power;
    // bracket k: find lo where power<target and hi where power>target
    let lo=0.001,hi=200;
    for(let i=0;i<40;i++){
      if(p(lo)<target)break;
      lo=Math.max(0.001,lo*0.5);
    }
    for(let i=0;i<40;i++){
      if(p(hi)>=target)break;
      hi=Math.min(200,hi*1.9);
    }
    let final,it=0,converged=false,best=lo;
    if(p(lo)<target&&p(hi)>=target){
      best=lo;let bestErr=Math.abs(p(lo)-target);
      let a=lo,b=hi;
      for(;it<maxIt;it++){
        const mid=(a+b)/2,pm=p(mid),err=Math.abs(pm-target);
        if(err<bestErr){best=mid;bestErr=err;}
        if(pm<target)a=mid;else b=mid;
        if(err<=tol*target)break;
      }
      bestErr=Math.abs(p(best)-target);
      // deterministic local refinement around the best integer-stat step
      for(let j=0;j<10;j++){
        const cands=[best*0.98,best*0.995,best*1.005,best*1.02];
        for(const cand of cands){
          const pv=p(cand),err=Math.abs(pv-target);
          if(err<bestErr&&pv>0){best=cand;bestErr=err;}
        }
      }
      final=scaleStrength(base,best);
      converged=Math.abs(battlePowerV3(final).power-target)<=tol*target;
    } else {
      // extreme fallback: return whichever is closest
      best=(Math.abs(p(lo)-target)<Math.abs(p(hi)-target))?lo:hi;
      final=scaleStrength(base,best);
    }
    // Envelope guarantee (real strength nudging of the scale k, NOT a display
    // clamp): when the band is supplied, nudge k so the converged real numbers
    // land inside [min,max] (integer stat rounding can leave a small residual).
    const env=opts.envelope;
    if(env&&Number.isFinite(env.min)&&Number.isFinite(env.max)){
      let pw=battlePowerV3(final).power,guard=0;
      while((pw<env.min||pw>env.max)&&guard<80){
        best=(pw<env.min)?best*1.003:best*0.997;
        final=scaleStrength(base,best);
        pw=battlePowerV3(final).power;guard++;
      }
    }
    const pwr=battlePowerV3(final).power;
    const inEnv=!opts.envelope||(pwr>=env.min-0.5&&pwr<=env.max+0.5);
    return {card:final,power:pwr,target,delta:Math.round((pwr-target)*10)/10,iterations:it,converged:converged&&inEnv};
  }

  NCB.battlePowerV3=battlePowerV3;
  NCB.battlePowerV3Weights=NORM;
  NCB.battlePowerV3ScaleStrength=scaleStrength;
  NCB.battlePowerV3Calibrate=calibrateToPower;
  NCB.BATTLEPOWER_V3_VERSION=3;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);