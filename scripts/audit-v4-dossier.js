'use strict';
// Per-preset design dossier generator (v1.3.1 curation support).
// For every official preset it emits a readable analysis used to review each card:
// identity/coherence/dead-mechanic/time-curve/battle-usage/strength signal.
// Writes qa/v4-dossiers.json (machine + human readable). Not a release gate.
const fs=require('node:fs'),path=require('node:path');
const {fight}=require('./audit-v4-battles.js');
const {effects,issues,timeProfile}=require('./select-v4-presets.js');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior','battlepower-v2'])require('../src/'+f+'.js');
const N=global.NCB,cards=require('../content/presets-v4.json').cards;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function fmt(n){return Number.isFinite(n)?Math.round(n*100)/100:n;}
function effTree(effs,depth=0,out=[]){
  for(const e of effs||[]){
    out.push('  '.repeat(depth)+`${e.type}`+Object.entries(e).filter(([k])=>!['type','effects','then','else'].includes(k)).map(([k,v])=>` ${k}=${Array.isArray(v)?v.length+'x':(typeof v==='object'?JSON.stringify(v):v)}`).join(''));
    if(e.effects)effTree(e.effects,depth+1,out);
    if(e.then){out.push('  '.repeat(depth)+'then:');effTree(e.then,depth+1,out);}
    if(e.else){out.push('  '.repeat(depth)+'else:');effTree(e.else,depth+1,out);}
  }
  return out;
}
function timeCurve(c){
  // expected stat multiplier / damage proxy at rounds 1,10,20,30 using ramp+fatigue
  const s=c.stats;const ramp=Number(s.RAMP_RATE||0),fat=Number(s.FATIGUE_RATE||0);
  const rs=Number(s.RAMP_START||999),fs2=Number(s.FATIGUE_START||999);
  const cap=Number(s.RAMP_CAP||1),fc=Number(s.FATIGUE_CAP||1);
  const at=(r)=>clamp(cap,Number(s.RAMP_CAP||1),1+Math.max(0,r-rs)*ramp)*clamp(fc,1,Math.max(fc,1-Math.max(0,r-fs2)*fat));
  const keyAtks=['ATK','SPD','MAX_HP','DEF','CRIT'].filter(k=>s[k]!==undefined);
  const rows=[1,10,20,30,40].map(r=>{const m=at(r);return {round:r,factor:fmt(m),effAtk:keyAtks.reduce((o,k)=>(o[k]=fmt((s[k]||0)*m),o),{})};});
  return rows;
}
function deadScan(c){
  const d=[];
  const allActions=(card)=>{const r=[];const walk=ef=>{for(const e of ef||[]){r.push(e);if(e.effects)walk(e.effects);if(e.then)walk(e.then);if(e.else)walk(e.else);}};for(const a of card.actions)walk(a.effects);return r;};
  const res=Object.keys(c.resources||{}).concat(c.resourceRegens?Object.keys(c.resourceRegens):[]);
  const hasResConsumer=(r)=>{const R=r.toUpperCase();return c.actions.some(a=>(a.costs||[]).some(c=>String(c.resource).toUpperCase()===R))||JSON.stringify(c.actions).includes(R+' *');};
  for(const r of res){if(!hasResConsumer(r))d.push(`resource '${r}' has no consumer`);}
  // status with no consumer for consumeStatus / no trigger util
  const consumeTags=(c.actions||[]).flatMap(a=>effTree(a.effects)).filter(x=>x.includes('consumeStatus'));
  const stIds=new Set((c.statuses||[]).map(s=>s.id));
  d.push(`consumeStatus uses: ${consumeTags.length?consumeTags.join('; '):'none'}`);
  // cooldownReduce without cooldown
  const cdReduce=c.actions.some(a=>JSON.stringify(a.effects).includes('cooldownReduce'));
  if(cdReduce&&!c.actions.some(a=>(a.cooldown||0)>0))d.push('cooldownReduce present but no action has cooldown>0');
  // emitEvent listeners
  const ev=c.actions.some(a=>JSON.stringify(a.effects).includes('emitEvent'));
  const listeners=(c.triggers||[]).some(t=>t.event==='command');
  if(ev&&!listeners)d.push('emitEvent command but no command trigger listener');
  // formula variables: naive check for known scope vars used
  return d;
}
function battleProfile(c,i){
  const ri=N.RARITY_V2_ORDER.indexOf(c.rarity);
  const res=[];
  for(const [j,offset] of [-3,-1,0,0,1,3].entries()){
    const opp=N.generateCardV4({seed:`dp-${i}-${j}`,rarity:N.RARITY_V2_ORDER[Math.max(0,Math.min(11,ri+offset))],level:Math.max(10,Math.min(100,c.level+(j%3-1)*4))});
    const r=fight(c,opp,930000+i*10+j);
    res.push({oppRarity:opp.rarity,oppLevel:opp.level,rounds:r.rounds,winner:r.winner,myDamage:fmt(r.damage),myHeal:fmt(r.healing),actions:r.actions});
  }
  const mirror=fight(c,c,940000+i);
  return {panel:res,mirror:mirror};
}
function dossier(){
  const out=[];
  for(const [i,c] of cards.entries()){
    const b=N.analyzeBehavior(c),bp=N.battlePowerV2(c);
    const used=new Set();const btl=battleProfile(c,i);
    for(const r of btl.panel)for(const a of r.actions)used.add(a);
    const flaws=issues(c);
    const perAction=c.actions.map(a=>{
      const use=btl.panel.reduce((n,r)=>n+r.actions.filter(x=>x===a.id).length,0);
      return {name:a.name,target:a.target,priority:a.priority,cooldown:a.cooldown,cost:a.cost,costs:a.costs,usedInPanel:use,effects:effTree(a.effects)};
    });
    out.push({
      id:c.id,name:c.displayName,seed:c.seed,rarity:c.rarity,level:c.level,
      generationBudget:c.generationBudget,bp:bp.power,bpBreakdown:bp.features,
      tags:b.tags,summary:b.summary,timeProfile:timeProfile(c),
      stats:Object.fromEntries(Object.entries(c.stats).map(([k,v])=>[k,fmt(v)])),
      actions:perAction,
      statuses:(c.statuses||[]).map(s=>({id:s.id.replace(c.id+':',''),kind:s.kind,duration:s.duration,maxStacks:s.maxStacks,modifiers:s.modifiers,periodic:s.periodic,turnEnd:s.turnEnd,triggers:s.triggers,eventModifiers:s.eventModifiers})),
      triggers:c.triggers,
      resources:c.resources,resourceRegens:c.resourceRegens,resistances:c.resistances,affinities:c.affinities,passives:c.passives,
      timeCurve:timeCurve(c),
      deadScan:deadScan(c),
      sourceIssues:flaws,
      designNote:c.designNote,adjustments:c.adjustments||[],
      battle:battleProfile(c,i)
    });
  }
  return out;
}
if(require.main===module){
  const r=dossier();
  fs.writeFileSync(path.join(__dirname,'../qa/v4-dossiers.json'),JSON.stringify(r,null,2)+'\n');
  console.log('dossiers written:',r.length);
}
module.exports={dossier,timeCurve,deadScan};