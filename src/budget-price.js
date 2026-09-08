// budget-price — causal real-combat mechanic pricing model for Generator v6.
//
// This is the GENERATION-time cost model, deliberately implemented independently
// from battlepower-v3 (the measurement model). Both target the same real combat
// strength; the empirical Monte Carlo layer is the final arbiter.
//
// The decisive real-combat quantities in this engine are:
//   - throughput  = damage output per round  ∝  ATK × (Σ action coefficients ×
//                    hits × repeat × frequency × accuracy × target-count)
//   - durability  = effective HP pool         ∝  MAX_HP (mitigation 100/(100+DEF)
//                    is strongly saturating, so HP dominates the pool).
//   - sustain     = heal/shield per round     ∝  (heal formula) × frequency.
//   - control     = denied enemy actions by stun/silence/control.
//
// PRICING RULE (real conservation): ATK and the action coefficients are
// MULTIPLICATIVE in the engine damage formula (damage = ATK × coeff). So offense
// is priced as the PRODUCT  ATK × coeffSum  — a card cannot get more real
// throughput for a given offense budget by stacking coefficients and cutting ATK,
// nor by stacking ATK and cutting coefficients. Two cards that both spend the same
// offense budget therefore have the SAME real throughput. Same for durability
// (charge MAX_HP) and sustain. This keeps same-(Level×Rarity) aggregate strength
// in-tier while between-tier budget gaps produce strong real dominance.
(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const round=v=>Math.round((Number(v)||0)*1000)/1000;

  function scopeFor(card){
    const s=card.stats||{};
    const ATK=s.ATK||60,HP=s.MAX_HP||120,DEF=s.DEF||50,RES=s.RES||50,SPD=s.SPD||60;
    return {ATK,MAX_HP:HP,SPD,HP:HP*.6,HP_PCT:.6,MISSING_HP:HP*.4,ENERGY:4,ROUND:18,BATTLE_TURN:18,
      STACKS:2,CONSUMED_STACKS:2,TARGET_HP:HP*.6,TARGET_MAX_HP:HP,TARGET_HP_PCT:.6,EVENT_DAMAGE:ATK};
  }
  function evalFormula(expr,scope){
    try{const v=Number(NCB.evaluateExpression(String(expr==null?'0':expr),scope));return Number.isFinite(v)?Math.max(0,v):0;}catch(_){return 0;}
  }
  function conditionProb(cond,card){
    if(!cond)return 1;
    switch(cond.type){
      case 'hpPctBelow':{const v=Number(cond.value)||.5;return clamp(0.2+0.9*(1-v),0.12,0.8);}
      case 'targetHpPctBelow':{const v=Number(cond.value)||.4;return clamp(0.15+0.75*(1-v),0.12,0.7);}
      case 'resourceAtLeast':return 0.45;
      case 'targetHasStatus':return 0.5;
      case 'missingStatus':return 0.5;
      default:return 0.5;
    }
  }
  function aiUsability(total){return clamp(0.35+total/(1+total),0.3,1);}

  // Extract per-action COEFFICIENT throughput (damage / heal tokens independent of
  // the ATK/HP multiplier), so offense can be priced as ATK × coeffSum.
  // Returns {dmgCoeff, healCoeff, shieldCoeff, control, economy, tempo, freq}.
  function actionCoeff(card,action){
    const scope=scopeFor(card);
    const cd=Number(action.cooldown||0),acc=Number(action.accuracy??1)||1;
    const freq=1/(1+cd);
    let afford=1;
    const regen=(card.stats||{}).ENERGY_REGEN||2;
    if(Number(action.cost||0)>0)afford=Math.min(afford,clamp(regen/(Math.max(1,action.cost)*1.4),0,1));
    for(const c of action.costs||[]){if(c.resource!=='HP'&&Number(c.amount||0)>0)afford=Math.min(afford,0.6);}
    const usable=freq*afford;
    const targets=action.target==='all-enemies'||action.target==='all-allies'?3:(action.targetQuery?.mode==='all'?Math.max(1,action.targetQuery.limit||1):1);
    const priority=Number(action.priority||0);
    const critBonus=Number(action.critBonus||0);
    const agg={dmgCoeff:0,healCoeff:0,shieldCoeff:0,control:0,economy:0,tempo:0};
    const walk=(effs,mult,depth=0)=>{
      if(depth>6)return;
      for(const e of effs||[]){
        const w=Number(mult||1);
        if(e.type==='conditional'){const p=conditionProb(e.condition,card);walk(e.then,w*p,depth+1);walk(e.else,w*(1-p),depth+1);continue;}
        if(e.type==='repeat'){walk(e.effects,w*clamp(Number(e.times||1),1,16),depth+1);continue;}
        // A REcursive damage coefficient: for formula "ATK * X", dmgCoeff += X.
        // For "ATK*X + Y" we approximate by the leading ATK coefficient; complex
        // forms use their evaluated size at the reference ATK to find an equivalent
        // coefficient (= evaluated / ATK).
        if(e.type==='damage'){
          const comps=e.components||[{formula:e.formula||'0',multiplier:1}];
          const atk=Math.max(1,scope.ATK);
          const vmin=Number(e.varianceMin??1),vmax=Number(e.varianceMax??1),mid=(vmin+vmax)/2;
          const hits=clamp(Number(e.hits??1)||1,1,32);
          let coeff=0;
          for(const c of comps){const f=String(c.formula||e.formula||'0');
            const m=f.match(/(?:^|\*|\(|^)ATK\s*\*\s*([0-9]+(?:\.[0-9]+)?)/);
            if(m)coeff+=Number(m[1])*Number(c.multiplier??1);
            else{const val=evalFormula(f,scope);coeff+=val/atk*Number(c.multiplier??1);}
          }
          coeff*=hits*mid;
          agg.dmgCoeff+=coeff*w;
          const fi=Number(e.recoilRatio||0);if(fi)agg.dmgCoeff-=coeff*fi;
          const dr=Number(e.drainRatio||0);if(dr)agg.healCoeff+=coeff*dr;
        } else if(e.type==='selfDamagePct'){
          agg.dmgCoeff-=(Number(e.pct||0)*0); // HP-relative; charged via durability penalty, ignore here
        } else if(e.type==='heal'){
          const f=String(e.formula||'0');
          const m=f.match(/(?:MAX_HP\s*\*\s*)([0-9]+(?:\.[0-9]+)?)/);
          agg.healCoeff+= (m?Number(m[1]):(evalFormula(f,scope)/Math.max(1,scope.MAX_HP)))*w;
        } else if(e.type==='shield'||e.type==='ward'){
          const f=String(e.formula||'0');
          const m=f.match(/(?:MAX_HP\s*\*\s*)([0-9]+(?:\.[0-9]+)?)/);
          agg.shieldCoeff+=(m?Number(m[1]):(evalFormula(f,scope)/Math.max(1,scope.MAX_HP)))*w;
        } else if(e.type==='status'||e.type==='toggleStatus'){
          const def=NCB.STATUS_DEFS?.[e.status];
          const flags=def&&def.flags?def.flags:null;
          const base=flags&&flags.stun?8:(flags&&flags.silence?4:2);
          agg.control+=base*w*Number(e.chance??1);
          if(def?.periodic?.effects){
            const ticks=clamp(Number(e.duration??def.duration??3),1,6);
            for(const te of def.periodic.effects||[]){
              if(te.type==='damage'){const f=String(te.formula||'0');const m=f.match(/(?:ATK\s*\*\s*)([0-9]+(?:\.[0-9]+)?)/);agg.dmgCoeff+=(m?Number(m[1]):0)*ticks*w;}
              if(te.type==='heal'){const f=String(te.formula||'0');const m=f.match(/(?:MAX_HP\s*\*\s*)([0-9]+(?:\.[0-9]+)?)/);agg.healCoeff+=(m?Number(m[1]):0)*ticks*w;}
            }
          }
        } else if(e.type==='consumeStatus'){agg.dmgCoeff+=1*w;agg.control+=0.5*w;}
        else if(e.type==='cleanse'||e.type==='dispel'){agg.control+=1*w;}
        else if(e.type==='gain'||e.type==='resource'){agg.economy+=Number(e.amount||1)*w;}
        else if(e.type==='convertResource'){agg.economy+=Number(e.amount||1)*w;}
        else if(e.type==='cooldownReduce'){agg.economy+=1*w;}
        else if(e.type==='emitEvent'){agg.tempo+=1*w;}
        if(e.effects)walk(e.effects,w,depth+1);
      }
    };
    walk(action.effects,1);
    // apply the shared real-frequency + accuracy + target + AI-usability discount
    const ai=aiUsability(agg.dmgCoeff+agg.healCoeff+agg.control+agg.economy);
    const k=usable*acc*Math.max(1,targets)*ai;
    agg.frequency=round(usable*acc);
    agg.ai=round(ai*100)/100;
    for(const key of ['dmgCoeff','healCoeff','shieldCoeff','control','economy','tempo'])agg[key]=round(agg[key]*k);
    return agg;
  }

  // ---- price a whole card ----
  // Prices the card in budget units such that:
  //   statsPrice + actionPrice + triggerPrice + passivePrice == TotalStrengthBudget
  // with real combat quantities conserved.
  function priceCard(card){
    const s=card.stats||{};
    const atk=Math.max(0,s.ATK||0),hp=Math.max(0,s.MAX_HP||0),def=Math.max(0,s.DEF||0),res=Math.max(0,s.RES||0),spd=Math.max(0,s.SPD||0);
    // --- real-combat coefficient sums over actions ---
    let dmgCoeff=0,healCoeff=0,shieldCoeff=0,control=0,economy=0,tempo=0;
    for(const a of card.actions||card.skills||[]){const p=actionCoeff(card,a);
      dmgCoeff+=p.dmgCoeff;healCoeff+=p.healCoeff;shieldCoeff+=p.shieldCoeff;control+=p.control;economy+=p.economy;tempo+=p.tempo;}
    // triggers/passives add mechanics output too
    for(const t of card.triggers||[]){
      const f0={roundStart:6,roundEnd:6,afterDamageTaken:4,afterDamageDealt:4,afterKill:0.8,command:3}[t.event]??2;
      const scope=scopeFor(card);
      (function walk(effs,mult){for(const e of effs||[]){const w=Number(mult||1);
        if(e.type==='damage'){const f=String(e.formula||'0');const m=f.match(/(?:ATK\s*\*\s*)([0-9]+(?:\.[0-9]+)?)/);const coeff=(m?Number(m[1]):0);dmgCoeff+=coeff*f0*0.6*w;}
        else if(e.type==='heal'||e.type==='shield'){const f=String(e.formula||'0');const m=f.match(/(?:MAX_HP\s*\*\s*)([0-9]+(?:\.[0-9]+)?)/);const c=(m?Number(m[1]):0);healCoeff+=c*f0*0.6*w;}
        else if(e.type==='gain'||e.type==='resource')economy+=Number(e.amount||1)*f0*0.4*w;
        else if(e.type==='status')control+=(f0*0.4*w);
        if(e.effects)walk(e.effects,w);if(e.then)walk(e.then,w*.5);if(e.else)walk(e.else,w*.5);}})(t.effects,1);
    }
    for(const p of card.passives||[]){
      let v=p.formula?evalFormula(p.formula,scopeFor(card)):(Math.abs(Number(p.value||0)));
      const c=p.condition?0.5:1;
      dmgCoeff+=(v*(p.stat==='ATK'?0.4:0.15))*c;
    }

    // --- prices (real conservation) ---
    // offense = ATK × effective coefficient throughput (product, so a card can't
    // game the budget by cutting ATK and stacking coefficients or vice versa).
    const offsetC=1;                       // tuning constant
    const critFactor=1+clamp(Number(s.CRIT||0)/100,0,.95)*Math.max(0,Number(s.CRIT_DMG||150)/100-1);
    const penFactor=1+clamp(Number(s.PEN||0)/250,0,.5);
    const offensePrice=round(atk*dmgCoeff*0.45*critFactor*penFactor); // real expected throughput
    const resistanceValue=Object.values(card.resistances||{}).reduce((n,v)=>n+Math.max(0,Number(v)||0),0);
    const defensePrice=round(hp*0.42+def*0.72+res*0.72+Number(s.EVA||0)*.35+hp*resistanceValue*.08);
    const sustainPrice=round(healCoeff*(hp*0.5)*(0.28)+shieldCoeff*hp*0.18); // heal/shield pool-output
    const controlPrice=round(control*2.2);
    const economyPrice=round(economy*1.2);
    const tempoPrice=round(spd*0.25+tempo*1.5);
    const reliabilityPrice=round(Number(s.ACC||0)*.12+Math.max(0,1-Number(s.VOLATILITY||1))*.8+Math.max(0,Number(s.LUCK||0))*.6);
    const totals={offense:offensePrice,defense:defensePrice,sustain:sustainPrice,control:controlPrice,economy:economyPrice,tempo:tempoPrice,reliability:reliabilityPrice};
    return {...totals,total:round(offensePrice+defensePrice+sustainPrice+controlPrice+economyPrice+tempoPrice+reliabilityPrice),
      coeff:{dmgCoeff:round(dmgCoeff),healCoeff:round(healCoeff),shieldCoeff:round(shieldCoeff)},stats:round(hp*0.45+def*0.75+res*0.75)};
  }

  // ---- per-category prices for the ledger (breakdown of priceCard) ----
  function priceStats(card){
    const p=priceCard(card);
    return {offense:p.offense,defense:p.defense,sustain:p.sustain,control:p.control,economy:p.economy,
      tempo:p.tempo,reliability:p.reliability,triggers:0,passives:0,total:p.total};
  }
  function priceMechanics(card){
    const p=priceCard(card);
    // approximate mechanics-only (the stats-dominance portion is in priceStats);
    // for reconciliation we always use priceCard(card).total, so these are ledger hints.
    const all={offense:p.offense,defense:p.defense,sustain:p.sustain,control:p.control,economy:p.economy,
      tempo:p.tempo};
    return {...all,total:p.total};
  }

  NCB.budgetPriceActionV6=actionCoeff;
  NCB.budgetPriceCardV6=priceCard;
  NCB.budgetPriceStatsV6=priceStats;
  NCB.budgetPriceMechanicsV6=priceMechanics;
  NCB.BUDGET_PRICE_VERSION=2;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
