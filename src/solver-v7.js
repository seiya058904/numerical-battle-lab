// Per-knob iso-power solver for Generator v7. Never runs battles or BattlePower.
(function(root){
  'use strict';
  const N=root.NCB=root.NCB||{};
  const clone=value=>JSON.parse(JSON.stringify(value));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const LIMITS={ATK:[.1,1e9],MAX_HP:[1,1e10],DEF:[10,350],RES:[10,350],SPD:[20,300],ACC:[20,300],EVA:[0,200],CRIT:[0,80],PEN:[0,95],HEAL_POWER:[10,600],ENERGY_REGEN:[.1,30]};
  const KNOBS=[
    {key:'ATK',axis:'pressure'},{key:'MAX_HP',axis:'endurance'},{key:'DEF',axis:'endurance'},
    {key:'RES',axis:'endurance'},{key:'SPD',axis:'tempo'},{key:'ACC',axis:'reliability'},
    {key:'EVA',axis:'reliability'},{key:'CRIT',axis:'pressure'},{key:'PEN',axis:'pressure'},
    {key:'HEAL_POWER',axis:'sustain'},{key:'ENERGY_REGEN',axis:'economy'},
  ];
  function round(value){return Math.round(value*1e6)/1e6;}
  function solveCardV7(baseCard,genome,targetTheta,options={}){
    const card=clone(baseCard),tolerance=Number(options.tolerance??.08),maxIterations=Number(options.maxIterations??180);
    const uses=Object.fromEntries(KNOBS.map(knob=>[knob.key,0]));
    let predicted=N.predictThetaV7(card),iterations=0;
    while(Math.abs(predicted-targetTheta)>tolerance&&iterations++<maxIterations){
      const error=targetTheta-predicted;
      const increasing=error>0;
      const candidates=[];
      for(const knob of KNOBS){
        const current=Number(card.stats[knob.key]??0),limits=LIMITS[knob.key];
        if((increasing&&current>=limits[1])||(!increasing&&current<=limits[0]))continue;
        const marginal=N.marginalValueV7(card,{kind:'stat',key:knob.key,relativeStep:.025});
        if(!Number.isFinite(marginal)||marginal<=1e-7)continue;
        // Headroom: de-prioritise a knob that is already close to the bound it
        // would move toward, so saturation cannot silently replace equalisation.
        // A flatter knob must not win just because every strong knob was used.
        const headroom=clamp((increasing?limits[1]-current:current-limits[0])/Math.max(1e-9,limits[1]-limits[0]),.05,1);
        candidates.push({knob,marginal,score:marginal*headroom/(1+uses[knob.key]*.45)});
      }
      candidates.sort((a,b)=>b.score-a.score||a.knob.key.localeCompare(b.knob.key));
      if(!candidates.length)break;
      const chosen=candidates[0],key=chosen.knob.key,current=Math.max(1e-6,Number(card.stats[key]||0));
      const relative=clamp(error/chosen.marginal,-.32,.32);
      const limits=LIMITS[key];
      card.stats[key]=clamp(current*Math.exp(relative),limits[0],limits[1]);
      uses[key]++;
      predicted=N.predictThetaV7(card);
    }
    for(const key of Object.keys(card.stats))if(Number.isFinite(card.stats[key]))card.stats[key]=round(card.stats[key]);
    predicted=N.predictThetaV7(card);
    return {card,predictedTheta:predicted,targetTheta,error:predicted-targetTheta,iterations,converged:Math.abs(predicted-targetTheta)<=tolerance,knobUpdates:uses,tolerance};
  }
  N.SOLVER_KNOBS_V7=KNOBS.map(knob=>({...knob}));
  N.SOLVER_LIMITS_V7=Object.fromEntries(Object.entries(LIMITS).map(([key,range])=>[key,range.slice()]));
  N.solveCardV7=solveCardV7;
  if(typeof module!=='undefined')module.exports=N;
})(typeof globalThis!=='undefined'?globalThis:window);
