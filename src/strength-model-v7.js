// Analytic General Strength model for Stat-Only V7.
//
// GeneralStrengthV7(card) is a pure, transparent function of the card's stats:
//   effectiveDamage = ATK x hitFactor x critEV x mitigation
//   effectiveHP     = MAX_HP x (1 + barrierFactor)
//   sustainPerRound = regen + lifesteal (healing modifiers applied)
//   survival        = effectiveHP + sustainPerRound x battleRounds x sustainShare
//   generalPower    = (effectiveDamage^a x survival^b x tempo^c x luck^d)^(1/(a+b+c+d))
//
// It never reads Level, Rarity, Seed, TargetTheta, the generation budget, battle
// results or BattlePower; it never runs a battle; it uses no ML. BattlePower is
// the monotone display mapping of GeneralPower (anchor: Lv50 A ~ 1000).
(function(root){
  'use strict';
  const N=root.NCB=root.NCB||{};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const num=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

  const COMBINE={damageExponent:.50,survivalExponent:.50,tempoExponent:.18,luckExponent:.04};
  const BATTLE_ROUNDS=18,SUSTAIN_SHARE=1.0,BARRIER_RATE=.02;
  const BP_REFERENCE=184;             // generalPower that maps to BP 1000 (Lv50 A anchor)
  const BP_EXPONENT=.62;              // display curvature
  // Reference opponent for the content-only offense side: a card's own DEF/RES
  // belongs to survival, never to its damage.
  const REF_DEF=100,REF_RES=100,REF_ACC=100,REF_EVA=30,REF_PEN=.15;

  function hitFactor(stats){
    const acc=num(stats.ACC,100);
    // offense hit: own ACC vs the REFERENCE opponent's EVA
    return clamp((100+acc)/(100+acc+REF_EVA*.85),.05,.995);
  }
  function critEV(stats){
    const chance=clamp(num(stats.CRIT,0)/100,0,.9);
    const dmg=Math.max(1,num(stats.CRIT_DMG,150)/100);
    return 1+chance*(dmg-1);
  }
  function offenseMitigation(stats){
    const pen=clamp(num(stats.PEN,0)/100,0,.8),resPen=clamp(num(stats.RES_PEN,0)/100,0,.8);
    const phys=100/(100+REF_DEF*(1-pen)),magic=100/(100+REF_RES*(1-resPen));
    return .6*phys+.4*magic;
  }
  function incomingMitigation(stats){
    const def=Math.max(0,num(stats.DEF,0)),res=Math.max(0,num(stats.RES,0));
    const phys=100/(100+def*(1-REF_PEN)),magic=100/(100+res*(1-REF_PEN));
    const toughness=clamp(num(stats.TOUGHNESS,0)/100,0,.3);
    return (.6*phys+.4*magic)*(1-toughness);
  }
  function generalStrengthV7(card){
    const s=card.stats||{};
    const atk=Math.max(0,num(s.ATK,0)),hp=Math.max(1,num(s.MAX_HP,1000));
    const hit=hitFactor(s),crit=critEV(s);
    const baseDamage=atk*hit*crit*offenseMitigation(s);
    const healMul=clamp(num(s.HEAL_POWER,100)/100,.6,1.3)*clamp(num(s.HEAL_TAKEN,100)/100,.6,1.3);
    const regen=hp*(num(s.HP_REGEN,0)/100)*.5*healMul;
    const lifesteal=baseDamage*(clamp(num(s.LIFESTEAL,0)/100,0,.25))*healMul;
    const sustainPerRound=regen+lifesteal;
    const effectiveHit=clamp((100+REF_ACC)/(100+REF_ACC+num(s.EVA,0)*.85),.25,1);
    const ehp=hp/incomingMitigation(s)/effectiveHit;
    const barrierFactor=clamp((num(s.BARRIER_POWER,0)/100)*BARRIER_RATE,0,.25);
    const effectiveHP=ehp*(1+barrierFactor);
    const survival=effectiveHP+sustainPerRound*BATTLE_ROUNDS*SUSTAIN_SHARE;
    const tempo=Math.exp(1.5*Math.tanh((num(s.SPD,100)-100)/220));
    const luck=1+clamp(num(s.LUCK,0),-1,1)*.04;
    const totalExponent=COMBINE.damageExponent+COMBINE.survivalExponent+COMBINE.tempoExponent+COMBINE.luckExponent;
    const generalPower=Math.pow(Math.pow(Math.max(1e-9,baseDamage),COMBINE.damageExponent)
      *Math.pow(Math.max(1e-9,survival),COMBINE.survivalExponent)
      *Math.pow(tempo,COMBINE.tempoExponent)
      *Math.pow(luck,COMBINE.luckExponent),1/totalExponent);
    return {generalPower,effectiveDamage:baseDamage,effectiveHP:ehp,sustainPerRound,tempo,
      hitFactor:hit,critEV:crit,mitigation:offenseMitigation(s),incomingMitigation:incomingMitigation(s)};
  }
  function battlePowerV7(card){
    const {generalPower}=generalStrengthV7(card);
    return Math.max(1,Math.round(1000*Math.pow(generalPower/BP_REFERENCE,BP_EXPONENT)));
  }
  N.GENERAL_STRENGTH_COMBINE_V7={...COMBINE};
  N.generalStrengthV7=generalStrengthV7;
  N.battlePowerV7=battlePowerV7;
  if(typeof module!=='undefined')module.exports=N;
})(typeof globalThis!=='undefined'?globalThis:window);






