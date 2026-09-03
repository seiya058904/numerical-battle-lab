(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  // ---------------------------------------------------------------------------
  // v1.2.3 BattlePower model registry — the SINGLE SOURCE OF TRUTH for the
  // BattlePower aggregation model. Calibration, browser, tests and UI must all
  // read the same model from here; battlepower.js consumes these weights rather
  // than hardcoding them. The shipped weights are the model that was SELECTED on
  // VALIDATION and FROZEN; the FINAL holdout evaluates exactly this model.
  //
  //   BATTLE_POWER_MODEL_VERSION : version tag of the frozen model
  //   BATTLE_POWER_WEIGHTS       : the shipped sub-score weights
  //   BATTLE_POWER_MODEL_HASH    : deterministic canonical hash of the weights
  //   battlePowerWithWeights     : pure geometric aggregator (sub-scores + ref)
  //
  // The weights below are the CURRENT SHIPPED model (v1.2.2 online values). This
  // script's calibration (scripts/power-calibration.js) SELECTS the release model
  // on VALIDATION (never on FINAL), and with --ship rewrites this registry so the
  // shipped weights === selected weights. The NEW FINAL holdout then evaluates
  // exactly the frozen registry. selectedModelHash === shippedModelHash is
  // asserted (audit §1/§5; static test in tests/battlepower-model.test.js).
  const BATTLE_POWER_MODEL_VERSION='MODEL_V123';
  const BATTLE_POWER_WEIGHTS={
    offense:0.3,
    durability:0.4,
    tempo:0.22,
    sustain:0.02,
    utility:0.02,
    economy:0.02,
    reliability:0.02,
  };

  // Deterministic canonical hash of a weight set (sorted keys, stable string).
  function modelHash(weights){
    const keys=Object.keys(weights).sort();
    const s=keys.map(k=>k+':'+Number(weights[k]).toFixed(6)).join('|');
    let h=2166136261>>>0;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    return('00000000'+(h>>>0).toString(16)).slice(-8);
  }
  const BATTLE_POWER_MODEL_HASH=modelHash(BATTLE_POWER_WEIGHTS);

  // Pure geometric aggregation: power = round(10000 * exp(Σ w·ln(sub/ref))).
  // sub/ref are the sub-score objects; weights are any candidate weight set
  // (this is also how calibration scores a CANDIDATE model independently).
  function battlePowerWithWeights(sub,ref,weights){
    let logSum=0;
    for(const key of Object.keys(weights)){
      const w=Number(weights[key])||0;
      if(w===0)continue;
      const ratio=Math.max(0.02,Number(sub[key])/Math.max(1e-6,Number(ref[key])));
      logSum+=w*Math.log(ratio);
    }
    return Math.max(100,Math.min(1000000,Math.round(10000*Math.exp(logSum))));
  }
  // Log-space aggregation used by calibration for ranking (monotone with BP).
  function logPower(sub,weights){
    const l=v=>Math.log(Math.max(0.01,Number(v)));
    return weights.offense*l(sub.offense)+weights.durability*l(sub.durability)+weights.tempo*l(sub.tempo)
      +weights.sustain*l(sub.sustain)+weights.utility*l(sub.utility)+weights.economy*l(sub.economy)+weights.reliability*l(sub.reliability);
  }

  NCB.battlePowerModel={
    version:BATTLE_POWER_MODEL_VERSION,
    weights:BATTLE_POWER_WEIGHTS,
    hash:BATTLE_POWER_MODEL_HASH,
    modelHash,
    battlePowerWithWeights,
    logPower,
  };
  // Back-compat alias so existing code reading NCB.SUBSCORE_WEIGHTS gets the same
  // shipped weights (single source of truth).
  NCB.SUBSCORE_WEIGHTS=BATTLE_POWER_WEIGHTS;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);