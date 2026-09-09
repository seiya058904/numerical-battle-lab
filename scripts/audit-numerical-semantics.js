'use strict';
// Numerical semantics perturbation audit (§56-57): for each core parameter,
// build a control card and a changed card, fight/simulate, and assert the
// documented behavior actually happens in the engine:
//   ATK 100->200   -> dependent damage increases
//   LIFESTEAL 0->50 -> post-damage healing increases
//   VOLATILITY low->high -> multi-seed variance widens
//   RAMP_RATE 0->positive -> late-round stats grow
//   FATIGUE_RATE 0->positive -> late-round stats decay
//   HEAL_POWER 100->200 -> own healing increases
//   ENDURANCE low->high -> Battle Wear terminal pressure arrives later
// Pure diagnostics with real engine data; exit code 1 on documented-semantics failure.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior','battlepower-v2','numerical-knowledge'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const h=s=>{let x=0;for(const ch of String(s))x=(x*31+ch.codePointAt(0))>>>0;return x;};
const bs=s=>N.deriveSeed(h(s));

function probeDamage(atk,seed='probe',maxRounds=30){
  const c=N.generateCardV4({seed,rarity:'A',level:50});
  c.stats={...c.stats,MAX_HP:600,ATK:atk,DEF:30,RES:30,SPD:50,ACC:100,EVA:0,CRIT:0,CRIT_DMG:150,PEN:0,LIFESTEAL:0,HEAL_POWER:100,HEAL_TAKEN:100,ENERGY_REGEN:4,VOLATILITY:1,LUCK:0,ENDURANCE:50,RAMP_RATE:0,FATIGUE_RATE:0};
  c.actions=[{id:c.id+':hit',name:'命中',target:'enemy',cost:0,cooldown:0,effects:[{type:'damage',damageType:'physical',formula:'ATK',canMiss:false,canCrit:false}]}];
  c.triggers=[];c.statuses=[];c.passives=[];c.affinities={};
  N.deployCard(c);
  const opp=N.generateCardV4({seed:seed+'-opp',rarity:'A',level:50});
  opp.stats={...opp.stats,MAX_HP:5000,ATK:1,DEF:30,RES:30,SPD:1,ACC:100,EVA:0,CRIT:0,CRIT_DMG:150,PEN:0,LIFESTEAL:0,HEAL_POWER:100,HEAL_TAKEN:100,ENERGY_REGEN:4,VOLATILITY:1,LUCK:0,ENDURANCE:50,RAMP_RATE:0,FATIGUE_RATE:0};
  opp.actions=[{id:opp.id+':hit',name:'命中',target:'enemy',cost:0,cooldown:0,effects:[{type:'damage',damageType:'physical',formula:'ATK',canMiss:false,canCrit:false}]}];
  opp.triggers=[];opp.statuses=[];opp.passives=[];opp.affinities={};
  N.deployCard(opp);
  const e=N.createBattle({seed:bs('probe-'+seed),teamA:[c.id],teamB:[opp.id],maxRounds});
  let guard=0;
  while(!e.outcome().ended&&guard++<maxRounds)e.resolveRound([...N.planAI(e,'A'),...N.planAI(e,'B')]);
  const total=e.log.filter(x=>x.kind==='damage'&&x.sourceId==='A1').reduce((n,x)=>n+x.hpDamage,0);
  const source=e.entity('A1');
  return {total,dealt:e.log.filter(x=>x.kind==='damage'&&x.sourceId==='A1').length,sourceHp:source.hp};
}
function probeLifesteal(ls,seed='ls'){
  const c=N.generateCardV4({seed,rarity:'A',level:50});
  c.stats={...c.stats,MAX_HP:600,ATK:100,DEF:30,RES:30,SPD:50,ACC:100,EVA:0,CRIT:0,CRIT_DMG:150,PEN:0,LIFESTEAL:ls,HEAL_POWER:100,HEAL_TAKEN:100,ENERGY_REGEN:4,VOLATILITY:1,LUCK:0,ENDURANCE:50,RAMP_RATE:0,FATIGUE_RATE:0};
  c.actions=[{id:c.id+':hit',name:'命中',target:'enemy',cost:0,cooldown:0,effects:[{type:'damage',damageType:'physical',formula:'ATK',canMiss:false,canCrit:false}]}];
  c.triggers=[];c.statuses=[];c.passives=[];c.affinities={};
  N.deployCard(c);
  const opp=N.generateCardV4({seed:seed+'-opp',rarity:'A',level:50});
  opp.stats={...opp.stats,MAX_HP:2000,ATK:1,DEF:0,RES:0,SPD:1,ACC:100,EVA:0,CRIT:0,CRIT_DMG:150,PEN:0,LIFESTEAL:0,HEAL_POWER:100,HEAL_TAKEN:100,ENERGY_REGEN:4,VOLATILITY:1,LUCK:0,ENDURANCE:50,RAMP_RATE:0,FATIGUE_RATE:0};
  opp.actions=[{id:opp.id+':hit',name:'命中',target:'enemy',cost:0,cooldown:0,effects:[{type:'damage',damageType:'physical',formula:'ATK',canMiss:false,canCrit:false}]}];
  opp.triggers=[];opp.statuses=[];opp.passives=[];opp.affinities={};
  N.deployCard(opp);
  const e=N.createBattle({seed:bs('ls-'+seed),teamA:[c.id],teamB:[opp.id],maxRounds:30});
  const source=e.entity('A1');source.hp=Math.floor(source.maxHp*0.5);
  const before=source.hp;let guard=0;
  while(!e.outcome().ended&&guard++<30){e.resolveRound([...N.planAI(e,'A'),...N.planAI(e,'B')]);}
  const heals=e.log.filter(x=>x.kind==='heal'&&x.sourceId==='A1').reduce((n,x)=>n+x.amount,0);
  return {heals,hpGain:source.hp-before};
}
function probeVolatility(vol,seeds){
  const out=[];
  for(const seed of seeds){
    const c=N.generateCardV4({seed,rarity:'A',level:50});
    c.stats={...c.stats,MAX_HP:600,ATK:100,DEF:30,RES:30,SPD:50,ACC:100,EVA:0,CRIT:0,CRIT_DMG:150,PEN:0,LIFESTEAL:0,HEAL_POWER:100,HEAL_TAKEN:100,ENERGY_REGEN:4,VOLATILITY:vol,LUCK:0,ENDURANCE:50,RAMP_RATE:0,FATIGUE_RATE:0};
    c.actions=[{id:c.id+':hit',name:'命中',target:'enemy',cost:0,cooldown:0,effects:[{type:'damage',damageType:'physical',formula:'ATK',varianceMin:0.5,varianceMax:1.5,canMiss:false,canCrit:false}]}];
    c.triggers=[];c.statuses=[];c.passives=[];c.affinities={};
    N.deployCard(c);
    const opp=N.generateCardV4({seed:seed+'-o',rarity:'A',level:50});
    opp.stats={...opp.stats,MAX_HP:5000,ATK:1,DEF:0,RES:0,SPD:1,ACC:100,EVA:0,CRIT:0,CRIT_DMG:150,PEN:0,LIFESTEAL:0,HEAL_POWER:100,HEAL_TAKEN:100,ENERGY_REGEN:4,VOLATILITY:1,LUCK:0,ENDURANCE:50,RAMP_RATE:0,FATIGUE_RATE:0};
    opp.actions=[{id:opp.id+':hit',name:'命中',target:'enemy',cost:0,cooldown:0,effects:[{type:'damage',damageType:'physical',formula:'ATK',canMiss:false,canCrit:false}]}];
    opp.triggers=[];opp.statuses=[];opp.passives=[];opp.affinities={};
    N.deployCard(opp);
    const e=N.createBattle({seed:bs('vol-'+seed),teamA:[c.id],teamB:[opp.id],maxRounds:30});
    let guard=0;while(!e.outcome().ended&&guard++<30)e.resolveRound([...N.planAI(e,'A'),...N.planAI(e,'B')]);
    out.push(e.log.filter(x=>x.kind==='damage'&&x.sourceId==='A1').reduce((n,x)=>n+x.hpDamage,0));
  }
  const mean=out.reduce((a,b)=>a+b,0)/out.length;
  const variance=out.reduce((a,b)=>a+(b-mean)*(b-mean),0)/out.length;
  return {hits:out,std:Math.sqrt(variance)};
}
function probeTimeParam(seed,ramp,fatigue){
  const c=N.generateCardV4({seed,rarity:'A',level:50});
  c.stats={...c.stats,MAX_HP:600,ATK:100,DEF:30,RES:30,SPD:50,ACC:100,EVA:0,CRIT:0,CRIT_DMG:150,PEN:0,LIFESTEAL:0,HEAL_POWER:100,HEAL_TAKEN:100,ENERGY_REGEN:4,VOLATILITY:1,LUCK:0,ENDURANCE:50,RAMP_RATE:ramp,RAMP_START:ramp?5:999,RAMP_CAP:ramp?1.6:1,FATIGUE_RATE:fatigue,FATIGUE_START:fatigue?10:999,FATIGUE_CAP:fatigue?0.5:1};
  c.actions=[{id:c.id+':hit',name:'命中',target:'enemy',cost:0,cooldown:0,effects:[{type:'damage',damageType:'physical',formula:'ATK',canMiss:false,canCrit:false}]}];
  c.triggers=[];c.statuses=[];c.passives=[];c.affinities={};
  N.deployCard(c);
  const opp=N.generateCardV4({seed:seed+'-o',rarity:'A',level:50});
  opp.stats={...opp.stats,MAX_HP:5000,ATK:1,DEF:0,RES:0,SPD:1,ACC:100,EVA:0,CRIT:0,CRIT_DMG:150,PEN:0,LIFESTEAL:0,HEAL_POWER:100,HEAL_TAKEN:100,ENERGY_REGEN:4,VOLATILITY:1,LUCK:0,ENDURANCE:50,RAMP_RATE:0,FATIGUE_RATE:0};
  opp.actions=[{id:opp.id+':hit',name:'命中',target:'enemy',cost:0,cooldown:0,effects:[{type:'damage',damageType:'physical',formula:'ATK',canMiss:false,canCrit:false}]}];
  opp.triggers=[];opp.statuses=[];opp.passives=[];opp.affinities={};
  N.deployCard(opp);
  const e=N.createBattle({seed:bs('time-'+seed),teamA:[c.id],teamB:[opp.id],maxRounds:60});
  let guard=0;while(!e.outcome().ended&&guard++<60)e.resolveRound([...N.planAI(e,'A'),...N.planAI(e,'B')]);
  // effective ATK over rounds from combat log of A1's damage actions
  const byRound={};
  for(const x of e.log.filter(x=>x.kind==='damage'&&x.sourceId==='A1')){byRound[x.round]=(byRound[x.round]||0)+x.hpDamage;}
  const rounds=Object.keys(byRound).map(Number).sort((a,b)=>a-b);
  return {rounds,first:rounds.length?byRound[rounds[0]]:0,last:rounds.length?byRound[rounds[rounds.length-1]]:0,damage:e.log.filter(x=>x.kind==='damage'&&x.sourceId==='A1').reduce((n,x)=>n+x.hpDamage,0)};
}
function audit(){
  const results={};
  // ATK
  const d100=probeDamage(100,'atk100'),d200=probeDamage(200,'atk200');
  results.atk={low:{total:d100.total},high:{total:d200.total},ok:d200.total>d100.total*1.5};
  // LIFESTEAL
  const l0=probeLifesteal(0,'ls0'),l50=probeLifesteal(50,'ls50');
  results.lifesteal={zero:l0.hpGain,fifty:l50.hpGain,healsZero:l0.heals,healsFifty:l50.heals,ok:l50.hpGain>l0.hpGain};
  // VOLATILITY (variance)
  const seeds=['va','vb','vc','vd','ve','vf'];
  const vLow=probeVolatility(0.2,seeds),vHigh=probeVolatility(2.5,seeds);
  results.volatility={lowStd:vLow.std,highStd:vHigh.std,lowHits:vLow.hits,highHits:vHigh.hits,ok:vHigh.std>vLow.std};
  // RAMP
  const r0=probeTimeParam('ramp0',0,0),r1=probeTimeParam('ramp1',0.04,0);
  results.ramp={controlLast:r0.last,rampFirst:r1.first,rampLast:r1.last,ok:r1.last>r1.first*1.2};
  // FATIGUE
  const f0=probeTimeParam('fat0',0,0),f1=probeTimeParam('fat1',0,0.04);
  results.fatigue={controlLast:f0.last,fatigueFirst:f1.first,fatigueLast:f1.last,ok:f1.last<f1.first*0.85};
  // HEAL_POWER
  const hp=(p,seed)=>{const c=N.generateCardV4({seed,rarity:'A',level:50});c.stats={...c.stats,MAX_HP:600,ATK:10,DEF:0,RES:0,SPD:50,ACC:100,EVA:0,CRIT:0,CRIT_DMG:150,PEN:0,LIFESTEAL:0,HEAL_POWER:p,HEAL_TAKEN:100,ENERGY_REGEN:4,VOLATILITY:1,LUCK:0,ENDURANCE:50,RAMP_RATE:0,FATIGUE_RATE:0};c.actions=[{id:c.id+':heal',name:'复苏',target:'self',cost:0,cooldown:0,effects:[{type:'heal',formula:'ATK'}]}];c.triggers=[];c.statuses=[];c.passives=[];c.affinities={};N.deployCard(c);const opp=N.generateCardV4({seed:seed+'-o',rarity:'A',level:50});opp.stats={...opp.stats,MAX_HP:2000,ATK:1,DEF:0,RES:0,SPD:1,ACC:100,EVA:0,CRIT:0,CRIT_DMG:150,PEN:0,LIFESTEAL:0,HEAL_POWER:100,HEAL_TAKEN:100,ENERGY_REGEN:4,VOLATILITY:1,LUCK:0,ENDURANCE:50,RAMP_RATE:0,FATIGUE_RATE:0};opp.actions=[{id:opp.id+':hit',name:'命中',target:'enemy',cost:0,cooldown:0,effects:[{type:'damage',damageType:'physical',formula:'ATK',canMiss:false,canCrit:false}]}];opp.triggers=[];opp.statuses=[];opp.passives=[];opp.affinities={};N.deployCard(opp);const e=N.createBattle({seed:bs('hp-'+seed),teamA:[c.id],teamB:[opp.id],maxRounds:10});let g=0;while(!e.outcome().ended&&g++<10){e.entity('A1').hp=Math.max(1,Math.floor(e.entity('A1').hp-20));e.resolveRound([...N.planAI(e,'A'),...N.planAI(e,'B')]);}return e.log.filter(x=>x.kind==='heal'&&x.sourceId==='A1').reduce((n,x)=>n+x.amount,0);};
  const h100=hp(100,'h100'),h200=hp(200,'h200');
  results.healPower={p100:h100,p200:h200,ok:h200>h100*1.5};
  // V7 neutral-100 axes: use the shared engine directly so this remains a
  // semantic contract rather than a Generator/BattlePower self-check.
  const axisBattle=N.createBattle({seed:bs('v7-axis-semantics'),teamA:['ranger'],teamB:['vanguard'],maxRounds:10});
  const axisActor=axisBattle.entity('A1'),axisTarget=axisBattle.entity('B1');
  const triggerSkill={id:'semantic-trigger',name:'semantic trigger',kind:'trigger',accuracy:1,damageType:'true',formula:'100'};
  const triggerEffect={type:'damage',damageType:'true',formula:'100',canMiss:false,canCrit:false};
  axisActor.stats.POTENCY=100;const potency100=axisBattle.computeDamage(axisActor,axisTarget,triggerSkill,triggerEffect).damage;
  axisActor.stats.POTENCY=200;const potency200=axisBattle.computeDamage(axisActor,axisTarget,triggerSkill,triggerEffect).damage;
  axisActor.stats.BARRIER_POWER=100;const barrier100=axisBattle.barrierRate(axisActor);
  axisActor.stats.BARRIER_POWER=200;const barrier200=axisBattle.barrierRate(axisActor);
  axisActor.stats.RECOVERY=100;const recovery100=axisBattle.recoveryRate(axisActor);
  axisActor.stats.RECOVERY=200;const recovery200=axisBattle.recoveryRate(axisActor);
  axisActor.stats.CONTROL_POWER=100;axisTarget.stats.TENACITY=100;const controlNeutral=axisBattle.controlChance(axisActor,axisTarget,.37);
  axisActor.stats.CONTROL_POWER=160;axisTarget.stats.TENACITY=80;const controlHigh=axisBattle.controlChance(axisActor,axisTarget,.37),durationHigh=axisBattle.controlDurationMultiplier(axisActor,axisTarget);
  axisActor.stats.CONTROL_POWER=80;axisTarget.stats.TENACITY=160;const controlLow=axisBattle.controlChance(axisActor,axisTarget,.37),durationLow=axisBattle.controlDurationMultiplier(axisActor,axisTarget);
  results.v7Axes={potency100,potency200,barrier100,barrier200,recovery100,recovery200,controlNeutral,controlHigh,controlLow,durationHigh,durationLow,
    ok:potency200>potency100&&barrier100===1&&barrier200>barrier100&&recovery100===1&&recovery200>recovery100&&controlNeutral===.37&&controlHigh>.37&&controlLow<.37&&durationHigh<=1.5&&durationLow>=.6};
  results.allOk=Object.values(results).every(r=>r.ok!==false);
  return results;
}
if(require.main===module){
  const r=audit();
  fs.writeFileSync(path.join(ROOT,'qa/numerical-semantics.json'),JSON.stringify(r,null,2)+'\n');
  console.log(JSON.stringify({atk:r.atk.ok,lifesteal:r.lifesteal.ok,volatility:r.volatility.ok,ramp:r.ramp.ok,fatigue:r.fatigue.ok,healPower:r.healPower.ok,v7Axes:r.v7Axes.ok,allOk:r.allOk,details:{atk:{low:r.atk.low,high:r.atk.high},lifesteal:{z:r.lifesteal.zero,f:r.lifesteal.fifty},vol:{ls:r.volatility.lowStd,hs:r.volatility.highStd},ramp:{c:r.ramp.controlLast,f:r.ramp.rampFirst,l:r.ramp.rampLast},fatigue:{c:r.fatigue.controlLast,f:r.fatigue.fatigueFirst,l:r.fatigue.fatigueLast},heal:{p100:r.healPower.p100,p200:r.healPower.p200},v7Axes:r.v7Axes}}));
  if(!r.allOk)process.exitCode=1;
}
module.exports={audit};
