// Stat-Only V7 battle — one unified Basic Attack per living unit per round.
//
// V7 is a high-dimensional NUMERICAL battle game, not a skill-card game: no
// skills, no statuses, no triggers, no resources, no AI planning. Complexity
// comes from ~20 interacting stats. Determinism comes only from the canonical
// PRNG (kernel Gen5PRNG via deriveSeed).
//
// Round flow (identical for every living unit, once per round, in initiative
// order):
//   round start : HP regen, barrier refresh
//   initiative  : SPD-based roll (reuses kernel initiativeFor)
//   attack      : hit (ACC vs EVA) -> crit (CRIT x CRIT_DMG) -> penetration
//                 (PEN vs DEF / RES_PEN vs RES) -> flat TOUGHNESS reduction
//                 -> barrier absorb -> HP damage -> lifesteal
//   target      : living enemy with the lowest current HP (focus fire)
//   maxRounds   : reached -> draw
(function(root){
  'use strict';
  const N=root.NCB=root.NCB||{};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const num=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

  function entityOf(card,teamId,index){
    const stats={...(card.stats||{})};
    stats.MAX_HP=Math.max(1,num(stats.MAX_HP,1000));
    stats.ATK=Math.max(0,num(stats.ATK,0));
    for(const key of Object.keys(stats))if(!Number.isFinite(stats[key]))stats[key]=0;
    const entity={id:`${teamId}${index+1}`,templateId:card.id,name:card.name||card.id,teamId,
      stats,maxHp:stats.MAX_HP,hp:stats.MAX_HP,
      // one-time battle-start shield pool (flat EHP bonus; consumed, not refreshed)
      shield:stats.MAX_HP*clamp((num(stats.BARRIER_POWER,0)/100)*.02,0,.25),alive:true};
    return entity;
  }
  function living(team){return team.filter(e=>e.hp>0&&e.alive);}
  function hitChance(attacker,defender){
    const acc=num(attacker.stats.ACC,100),eva=num(defender.stats.EVA,0);
    return clamp((100+acc)/(100+acc+eva*.85),.05,.995);
  }
  function mitigation(attacker,defender){
    const def=Math.max(0,num(defender.stats.DEF,0)),res=Math.max(0,num(defender.stats.RES,0));
    const pen=clamp(num(attacker.stats.PEN,0)/100,0,.8),resPen=clamp(num(attacker.stats.RES_PEN,0)/100,0,.8);
    const phys=100/(100+def*(1-pen));
    const magic=100/(100+res*(1-resPen));
    const toughness=clamp(num(defender.stats.TOUGHNESS,0)/100,0,.3);
    return (.6*phys+.4*magic)*(1-toughness);
  }
  function critMultiplier(attacker){
    const chance=clamp(num(attacker.stats.CRIT,0)/100,0,.9);
    const dmg=Math.max(1,num(attacker.stats.CRIT_DMG,150)/100);
    return {chance,multiplier:1+chance*(dmg-1),dmg};
  }
  function effectiveRoll(rng,luck){return clamp(rng()+(num(luck,0)/400),0,1);}
  const roll=prng=>prng.random.bind(prng);

  function createStatBattleV7(config){
    if(!config||!Array.isArray(config.teamA)||!Array.isArray(config.teamB))throw new Error('stat battle needs teamA/teamB card arrays');
    const prng=new N.Gen5PRNG(N.deriveSeed(config.seed||'gen5,1,2,3,4'));
    const maxRounds=Number.isInteger(config.maxRounds)&&config.maxRounds>0?Math.min(config.maxRounds,1000):60;
    const teams={A:config.teamA.map((card,i)=>entityOf(card,'A',i)),B:config.teamB.map((card,i)=>entityOf(card,'B',i))};
    const state={seed:config.seed||'gen5,1,2,3,4',round:1,maxRounds,teams,winner:null,history:[]};
    function attack(attacker){
      const targets=living(teams[attacker.teamId==='A'?'B':'A']);
      if(!targets.length)return;
      const defender=targets.reduce((best,e)=>e.hp<best.hp?e:best,targets[0]);
      const luck=num(attacker.stats.LUCK,0);
      // hit
      const hit=hitChance(attacker,defender);
      if(effectiveRoll(prng.random.bind(prng),luck)>=hit)return; // miss
      // crit
      const {chance,multiplier,dmg}=critMultiplier(attacker);
      const rolled=effectiveRoll(prng.random.bind(prng),luck);
      const crit=rolled<chance;
      // variance
      const volatility=clamp(num(attacker.stats.VOLATILITY,1),0,3);
      const varianceMult=1+volatility*(2*effectiveRoll(prng.random.bind(prng),luck)-1);
      const critRes=clamp(num(defender.stats.CRIT_RES,0)/100,0,.8);
      const finalCritMult=crit?1+Math.max(0,multiplier-1)*(1-critRes):1;
      let damage=num(attacker.stats.ATK,0)*finalCritMult*mitigation(attacker,defender)*varianceMult;
      damage=Math.max(0,damage);
      // late-game damage escalation (round > 40): guarantees long sustain
      // stalemates converge instead of running to the round cap.
      if(state.round>40)damage*=1+.02*(state.round-40);
      // barrier absorbs first
      const absorbed=Math.min(defender.shield,damage);
      defender.shield-=absorbed;damage-=absorbed;
      const hpDamage=Math.min(defender.hp,damage);
      defender.hp-=hpDamage;
      // lifesteal (healing modifiers apply, bounded)
      if(hpDamage>0&&num(attacker.stats.LIFESTEAL,0)>0&&attacker.hp<attacker.maxHp){
        const healMul=clamp(num(attacker.stats.HEAL_POWER,100)/100,.6,1.3)*clamp(num(attacker.stats.HEAL_TAKEN,100)/100,.6,1.3);
        const heal=hpDamage*(clamp(num(attacker.stats.LIFESTEAL,0)/100,0,.25))*healMul;
        attacker.hp=Math.min(attacker.maxHp,attacker.hp+heal);
      }
      return {attacker:attacker.id,defender:defender.id,hit:true,crit,hpDamage};
    }
    function roundStart(){
      for(const side of ['A','B'])for(const e of teams[side]){
        if(e.hp<=0)continue;
        // HP regen (healing modifiers apply, bounded)
        const healMul=clamp(num(e.stats.HEAL_POWER,100)/100,.6,1.3)*clamp(num(e.stats.HEAL_TAKEN,100)/100,.6,1.3);
        const regen=e.maxHp*(num(e.stats.HP_REGEN,0)/100)*.4*healMul;
        e.hp=Math.min(e.maxHp,e.hp+Math.max(0,regen));
      }
    }
    function resolveRound(){
      roundStart();
      // initiative: one roll per living unit, SPD-based (kernel semantics)
      const order=[];
      for(const side of ['A','B'])for(const e of living(teams[side])){
        const initiative=N.initiativeFor?N.initiativeFor(num(e.stats.SPD,100),prng):(num(e.stats.SPD,100)*(.85+prng.random()*.3));
        order.push({e,initiative,side});
      }
      order.sort((a,b)=>b.initiative-a.initiative||(a.side===b.side?0:(a.side==='A'?-1:1)));
      const actions=[];
      for(const entry of order){
        if(!living(teams.A).length||!living(teams.B).length)break;
        const result=attack(entry.e);
        if(result)actions.push(result);
      }
      state.history.push({round:state.round,actions});
      const a=living(teams.A).length,b=living(teams.B).length;
      if(a&&b){if(state.round>=maxRounds){state.winner='draw';}else state.round++;}
      else state.winner=a?'A':(b?'B':'draw');
      return state.outcome();
    }
    state.outcome=()=>({ended:!!state.winner,winner:state.winner,round:state.round});
    state.resolveRound=resolveRound;
    state.run=()=>{let guard=0;while(!state.outcome().ended&&guard++<maxRounds+2)resolveRound();return state.outcome();};
    state.snapshot=()=>({round:state.round,teams:Object.fromEntries(['A','B'].map(side=>[side,teams[side].map(e=>({id:e.id,hp:+e.hp.toFixed(1),maxHp:e.maxHp,shield:+e.shield.toFixed(1),alive:e.alive}))])),winner:state.winner});
    return state;
  }
  // Convenience for audits: fight two cards, return 1 (A wins) / -1 (B) / 0 (draw).
  function fightStatCardsV7(a,b,seed,maxRounds=100){
    const battle=createStatBattleV7({seed,teamA:[a],teamB:[b],maxRounds});
    const outcome=battle.run();
    return outcome.winner==='A'?1:outcome.winner==='B'?-1:0;
  }
  N.createStatBattleV7=createStatBattleV7;
  N.fightStatCardsV7=fightStatCardsV7;
  if(typeof module!=='undefined')module.exports=N;
})(typeof globalThis!=='undefined'?globalThis:window);




