// BattlePower v4 — Stat-Only V7 estimator.
//
// V7 is now a stat-only numerical battle system, so the complex mechanism-feature
// estimator is superseded by the simple analytic GeneralStrength model. BattlePower
// is the monotone display mapping of GeneralPower (see strength-model-v7.js):
//
//   battlePowerV4(card).power = battlePowerV7(card)   (monotone in generalPower)
//   battlePowerV4(card).predictedTheta = log-scaled generalPower (monotone proxy)
//
// Content-only: never reads Level, Rarity, Seed, TargetTheta, the generation
// budget, EmpiricalTheta or any battle result; never runs a battle; no ML.
(function(root){
  'use strict';
  const N=root.NCB=root.NCB||{};
  function battlePowerV4(card){
    const {generalPower}=N.generalStrengthV7(card);
    const power=N.battlePowerV7(card);
    return {power,predictedTheta:Math.log(Math.max(1e-9,generalPower)),features:null,model:4};
  }
  N.battlePowerV4FeaturesV4=()=>[];
  N.battlePowerV4=battlePowerV4;
  N.battlePowerV4DisplayTheta=theta=>Math.max(1,Math.round(1000*Math.exp(.62*theta)));
  N.BATTLEPOWER_V4_VERSION=4;
  if(typeof module!=='undefined')module.exports=N;
})(typeof globalThis!=='undefined'?globalThis:window);
