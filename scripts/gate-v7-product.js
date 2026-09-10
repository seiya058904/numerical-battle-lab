'use strict';
// gate:v7-product — deterministic CI regression for the V7 product contract.
//
// This is the LIGHTWEIGHT CI gate. The full 37,440-battle Reality audit, the
// large-sample product audit (audit-v7-product-strength.js) and the BPv4
// reality audit are release evidence and stay out of CI by design.
//
// Covers (spec Task 9): strength-geometry invariants, 100-vs-40 smoke,
// Lv40 XC vs Lv100 C, Lv70 XC vs Lv100 C compensation smoke, same-level
// extreme rarity, iso-power/solver convergence, seed-structure invariance,
// multi-axis smoke, BattlePower content-only, legacy deterministic
// reproduction, Naming freeze, diversity.
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const {emptyBattleCounts,addBattleCounts,scoreMirroredPair,summarizeBattleCounts}=require('../src/strength-audit-v6.js');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-model','battlepower','battlepower-v2','battlepower-v3','numerical-knowledge','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7','battlepower-v4','presets','presets-v6','presets-v7'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;
const POOL=2,PER=16,RMAX=100; // paired mirrored seeds per scenario (keeps the CI smoke stable without loosening thresholds)
const results=[];
const check=(name,ok,detail)=>{results.push({name,ok,detail});console.log(`${ok?'PASS':'FAIL'} ${name}${detail!==undefined?' · '+detail:''}`);};
function fight(a,b,seed){N.deployCard(a);N.deployCard(b);const e=N.createBattle({seed:N.deriveSeed(seed),teamA:[a.id],teamB:[b.id],maxRounds:RMAX});let g=0;while(!e.outcome().ended&&g++<RMAX*2+40)e.resolveRound([...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')]);const w=e.outcome().winner;return w==='A'?1:(w==='B'?-1:0);}
function measure(low,high,base){const counts=emptyBattleCounts();for(let i=0;i<low.length;i++)for(let k=0;k<PER;k++)addBattleCounts(counts,scoreMirroredPair(low[i],high[i%high.length],base+i*131+k*7,fight));return summarizeBattleCounts(counts);}
function mk(level,rarity,prefix){return Array.from({length:POOL},(_,i)=>N.generateCardV7({seed:`${prefix}-${rarity}-${level}-${i}`,rarity,level}));}

// 1. Strength geometry invariants
check('geometry: level>rarity hierarchy and convex progressions hold',N.assertStrengthGeometryV7().ok,JSON.stringify(N.assertStrengthGeometryV7()));

// 2. Iso-power / solver convergence + deterministic validity
const solverCards=[...mk(20,'C','g'),...mk(40,'XS_COLLECTOR','g'),...mk(70,'XS','g'),...mk(100,'C','g')];
check('solver: all gate cards converge to TargetTheta',solverCards.every(c=>c.solver.converged&&Math.abs(c.strengthModel.predictedTheta-c.targetTheta)<=.12),`${solverCards.length} cards`);
check('solver: deterministic regeneration',JSON.stringify(N.generateCardV7({seed:'g-det',rarity:'A',level:50}))===JSON.stringify(N.generateCardV7({seed:'g-det',rarity:'A',level:50})));

// 3. Seed-structure invariance
const f20=N.generateCardV7({seed:'g-fingerprint',rarity:'C',level:20}),f100=N.generateCardV7({seed:'g-fingerprint',rarity:'XS_COLLECTOR',level:100});
check('seed structure: mechanic fingerprint invariant across level/rarity',f20.mechanicFingerprint===f100.mechanicFingerprint);

// 4. Product smoke gates (small-sample directional regression)
const c100=mk(100,'C','g'),c40=mk(40,'C','g'),xc40=mk(40,'XS_COLLECTOR','g'),xc70=mk(70,'XS_COLLECTOR','g'),xs70=mk(70,'XS','g'),xc50=mk(50,'XS_COLLECTOR','g'),c50=mk(50,'C','g');
const r100v40=measure(c40,c100,200000);
check('product smoke: Lv100 C vs Lv40 C overwhelming',r100v40.higherWinRate>=.90,`high=${r100v40.higherWinRate} CI95 [${r100v40.ci95.low},${r100v40.ci95.high}]`);
const r100c40xc=measure(xc40,c100,201000);
check('product smoke: Lv100 C vs Lv40 XS_COLLECTOR overwhelming',r100c40xc.higherWinRate>=.85,`high=${r100c40xc.higherWinRate} CI95 [${r100c40xc.ci95.low},${r100c40xc.ci95.high}]`);
const r70xc100c=measure(xc70,c100,202000);
check('product smoke: Lv70 XS_COLLECTOR vs Lv100 C suspense window',r70xc100c.lowerWinRate>=.30&&r70xc100c.lowerWinRate<=.72,`low=${r70xc100c.lowerWinRate} CI95 [${r70xc100c.ci95.low},${r70xc100c.ci95.high}]`);
const r70xs100c=measure(xs70,c100,203000);
check('product smoke: Lv70 XS vs Lv100 C weaker compensation',r70xs100c.lowerWinRate>=.15&&r70xs100c.lowerWinRate<=.50,`low=${r70xs100c.lowerWinRate} CI95 [${r70xs100c.ci95.low},${r70xs100c.ci95.high}]`);
const rCvXC=measure(c50,xc50,204000);
check('product smoke: same-level C vs XS_COLLECTOR extreme rarity',rCvXC.higherWinRate>=.90,`high=${rCvXC.higherWinRate} CI95 [${rCvXC.ci95.low},${rCvXC.ci95.high}]`);

// 5. Multi-axis smoke: deterministic engine wiring per primary axis. These use
// engine state, not battles, so the CI gate cannot be flipped by sampling noise;
// the real-battle sensitivity audit stays release evidence (audit:v7-sensitivity).
let axisSeq=0;
function axisRun(card){
  const c=JSON.parse(JSON.stringify(card));c.id=card.id+':axis'+(++axisSeq);c.displayName=c.name;N.deployCard(c);
  return {engine:N.createBattle({seed:N.deriveSeed(900000+axisSeq),teamA:[c.id],teamB:['warden'],maxRounds:20}),card:c};
}
const axisCard=N.generateCardV7({seed:'g-axis',rarity:'A',level:50});
const perturbStat=(stat,delta)=>{const c=JSON.parse(JSON.stringify(axisCard));const base=Number(c.stats[stat]===undefined?100:c.stats[stat]);c.stats[stat]=base*(1+delta);return c;};
const anchorValue=card=>N.evaluateExpression('55 * (ATK + 1) * (0.02 + ACC / 100) * (0.70 + PEN / 100)',{...card.stats,MAX_HP:card.stats.MAX_HP,HP:card.stats.MAX_HP,HP_PCT:1,MISSING_HP:0,TARGET_MAX_HP:card.stats.MAX_HP,TARGET_HP:card.stats.MAX_HP,TARGET_HP_PCT:1,ROUND:1,BATTLE_TURN:1,STACKS:1,CONSUMED_STACKS:0,ENERGY:0,EVENT_DAMAGE:0});
const baseRun=axisRun(axisCard);
const atkBoost=perturbStat('ATK',.10),atkRun=axisRun(atkBoost);
const baseDamage=baseRun.engine.previewDamageComponent('A1','B1',{type:'physical',amount:anchorValue(axisCard)}).finalDamage;
const atkDamage=atkRun.engine.previewDamageComponent('A1','B1',{type:'physical',amount:anchorValue(atkBoost)}).finalDamage;
check('multi-axis: +10% ATK raises real engine damage',atkDamage>baseDamage,`${baseDamage} -> ${atkDamage}`);
const potencyRun=axisRun(perturbStat('POTENCY',.10)),barrierRun=axisRun(perturbStat('BARRIER_POWER',.10)),recoveryRun=axisRun(perturbStat('RECOVERY',.10));
const controlRun=axisRun(perturbStat('CONTROL_POWER',.20)),tenacityRun=axisRun(perturbStat('TENACITY',.20));
check('multi-axis: POTENCY raises periodic potency rate',potencyRun.engine.potencyRate('A1')>baseRun.engine.potencyRate('A1'),`${baseRun.engine.potencyRate('A1')} -> ${potencyRun.engine.potencyRate('A1')}`);
check('multi-axis: BARRIER_POWER raises barrier rate',barrierRun.engine.barrierRate('A1')>baseRun.engine.barrierRate('A1'),`${baseRun.engine.barrierRate('A1')} -> ${barrierRun.engine.barrierRate('A1')}`);
check('multi-axis: RECOVERY raises readiness rate',recoveryRun.engine.recoveryRate('A1')>baseRun.engine.recoveryRate('A1'),`${baseRun.engine.recoveryRate('A1')} -> ${recoveryRun.engine.recoveryRate('A1')}`);
const controlChanceOf=(run,actorId,targetId)=>run.engine.controlChance(run.engine.entity(actorId),run.engine.entity(targetId),.6);
check('multi-axis: CONTROL_POWER raises contested control chance',controlChanceOf(controlRun,'A1','B1')>controlChanceOf(baseRun,'A1','B1'),`${controlChanceOf(baseRun,'A1','B1')} -> ${controlChanceOf(controlRun,'A1','B1')}`);
check('multi-axis: TENACITY lowers incoming control chance',controlChanceOf(tenacityRun,'B1','A1')<controlChanceOf(baseRun,'B1','A1'),`${controlChanceOf(baseRun,'B1','A1')} -> ${controlChanceOf(tenacityRun,'B1','A1')}`);

// 6. BattlePower v4 content-only
const bpCard=N.generateCardV7({seed:'g-bp',rarity:'A',level:50});
const bpBase=N.battlePowerV4FeaturesV4(bpCard);
const bpEdited=JSON.parse(JSON.stringify(bpCard));bpEdited.level=100;bpEdited.rarity='XS_COLLECTOR';bpEdited.targetTheta=99;bpEdited.expectedStrength=999;bpEdited.empiricalTheta=-9;bpEdited.generationBudget=123;
check('BPv4: identity/budget/empirical edits cannot change content features',JSON.stringify(N.battlePowerV4FeaturesV4(bpEdited))===JSON.stringify(bpBase));
const bpStrong=JSON.parse(JSON.stringify(bpCard));bpStrong.stats.ATK*=2;bpStrong.stats.MAX_HP*=1.5;
const idx=N.BATTLEPOWER_V4_FEATURE_NAMES.indexOf('logAttackTotal');
check('BPv4: real content edits move measured strength',N.battlePowerV4FeaturesV4(bpStrong)[idx]>bpBase[idx]);

// 7. Legacy deterministic reproduction + neutral-100 axes
const legacyV1=N.generateCardByVersion({seed:'g-legacy',rarity:'A',level:50,archetype:'Mage',generatorVersion:1});
check('legacy: explicit v1 reproduction stays v1',legacyV1.generatorVersion===1);
const legacyV6=N.generateCardByVersion({seed:'g-legacy6',rarity:'A',level:50,generatorVersion:6});
check('legacy: explicit v6 reproduction stays v6',legacyV6.generatorVersion===6);
check('legacy: deterministic regeneration',JSON.stringify(legacyV6)===JSON.stringify(N.generateCardByVersion({seed:'g-legacy6',rarity:'A',level:50,generatorVersion:6})));
check('legacy: v6 cards carry no V7 axes (neutral-100 semantics)',['POTENCY','CONTROL_POWER','TENACITY','RECOVERY','BARRIER_POWER'].every(k=>legacyV6.stats[k]===undefined));

// 8. Naming freeze + preset identity
const v7=N.SYSTEM_PRESETS_V7,v6=N.SYSTEM_PRESETS_V6;
check('naming: presets-v7 names are index-aligned with presets-v6 (Naming V3 frozen)',v7.length===60&&v6.length===60&&v7.every((c,i)=>c.name===v6[i].name&&c.displayName===v6[i].displayName));
check('naming: species name is seed-only',N.generateSpeciesName({seed:'g-name'})===N.generateSpeciesName({seed:'g-name'}));

// 9. Diversity smoke
check('diversity: 60 presets have unique mechanic fingerprints',new Set(v7.map(c=>c.mechanicFingerprint)).size===60);

const pass=results.every(r=>r.ok);
if(!pass){console.error('gate:v7-product FAILED');process.exit(1);}
console.log(`gate:v7-product PASS · ${results.length} checks`);

