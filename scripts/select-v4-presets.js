// Offline curation: generated candidates, semantic screening, authored names/notes,
// schema-only tuning, then a frozen canonical data file and file:// wrapper.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior','battlepower-v2'])require('../src/'+f+'.js');
const N=global.NCB;
const RARITIES=N.RARITY_V2_ORDER;
function levelDecade(l){return l===100?'100':Math.floor(l/10)*10+'-'+(Math.floor(l/10)*10+9);}
function timeProfile(c){return c.stats.RAMP_RATE?(c.stats.FATIGUE_RATE?'mixed':'ramp'):(c.stats.FATIGUE_RATE?'fatigue':'stable');}
function effects(x){const out=[];const walk=v=>{if(!v||typeof v!=='object')return;if(N.EFFECT_COMPONENTS[v.type])out.push(v);for(const y of Object.values(v))if(y&&typeof y==='object')walk(y);};walk(x);return out;}
function issues(c){
 const all=effects(c.actions),problems=[];
 for(const a of c.actions){const es=effects(a);if(!es.length)problems.push('empty-action');
  if(es.every(e=>['gain','resource','convertResource','emitEvent'].includes(e.type))){
   const resource=es.find(e=>e.resource)?.resource||Object.keys(c.resourceRegens)[0];
   const consumers=c.actions.some(x=>(x.costs||[]).some(k=>k.resource===resource))||JSON.stringify(c.actions).includes(resource+' *')||c.statuses.some(x=>x.upkeep?.resource===resource);
   if(!consumers)problems.push('resource-without-consumer');
  }
  if(es.every(e=>e.type==='cooldownReduce')&&!c.actions.some(x=>x.cooldown>0))problems.push('cooldown-without-consumer');
 }
 if(!N.validateContentPack(N.assembleCardPack(c)).ok)problems.push('invalid');
 return [...new Set(problems)];
}
// neutral, non-class display names per rarity (curation, presentation only)
const NAMES={
  C:['砂砾','苔痕','灰雀','雾芽','岩屑'],
  C_PLUS:['岩牙','铁爪','霜芽','钝角','石甲'],
  B:['风隼','银鳍','影足','棘皮','烬羽'],
  B_PLUS:['雷纹','暮潮','星隙','玄岩','羽冠'],
  A:['赤隼','苍岩','夜枭','青岚','孤峰'],
  A_PLUS:['曜甲','熔芯','渊鳞','月镰','疾电'],
  S:['苍翼','绝刃','虹雉','怒涛','暗星'],
  SS:['焚天','渊影','棱镜','时尘','血冕'],
  SSS:['穹顶','极光','不朽','湮灭','创世'],
  SSS_COLLECTOR:['星冕','晨辉','虚影','终焉','幻梦'],
  XS:['天陨','深渊','破晓','永夜','洪荒'],
  XS_COLLECTOR:['泰初','太虚','无极','混沌','涅槃'],
};

function selectPresets({candidates=160}={}){
 const cards=[],used=new Set(),rejected={},slots=[],candidateCount=RARITIES.length*5*candidates;
 for(let ri=0;ri<RARITIES.length;ri++){
  const rarity=RARITIES[ri],offset=Math.floor(ri/2),levels=ri%2?[23+offset,43+offset,63+offset,83+offset,100]:[12+offset,34+offset,54+offset,74+offset,92+offset];
  for(let slot=0;slot<5;slot++){
   const pool=[];
   for(let i=0;i<candidates;i++){
    const c=N.generateCardV4({seed:`curated-v4-${ri}-${slot}-${i}`,rarity,level:levels[slot]});
    const errors=issues(c),profile=timeProfile(c);
    if(slot===0&&c.stats.VOLATILITY>.6)errors.push('slot-low-volatility');
    if(slot===1&&c.stats.VOLATILITY<1.6)errors.push('slot-high-volatility');
    if(slot===2&&profile!=='ramp')errors.push('slot-ramp');
    if(slot===3&&profile!=='fatigue')errors.push('slot-fatigue');
    if(slot===4&&profile!==(ri%2?'mixed':'stable'))errors.push('slot-time-profile');
    if(errors.length){for(const reason of errors)rejected[reason]=(rejected[reason]||0)+1;continue;}
    const es=effects(c.actions),kinds=new Set(es.map(e=>e.type));
    const score=kinds.size*3+(kinds.has('consumeStatus')?3:0)+(c.actions.length>=3&&c.actions.length<=4?4:0)+(c.stats.LIFESTEAL>=12?1:0);
    pool.push({c,score});
   }
   const similarity=(a,b)=>{const ka=new Set(effects(a.actions).map(e=>e.type)),kb=new Set(effects(b.actions).map(e=>e.type));return [...ka].filter(x=>kb.has(x)).length/new Set([...ka,...kb]).size;};
   for(const x of pool)x.score-=Math.max(0,...cards.filter(c=>c.rarity===rarity).map(c=>similarity(x.c,c)))*24;
   pool.sort((a,b)=>b.score-a.score);
   const selected=pool.find(x=>!used.has(x.c.mechanicFingerprint)&&!cards.some(c=>similarity(c,x.c)>=.95&&timeProfile(c)===timeProfile(x.c)&&Math.abs(c.stats.VOLATILITY-x.c.stats.VOLATILITY)<.3));
   if(!selected)throw new Error(`no distinct candidate for ${rarity} slot ${slot}`);
   const c=selected.c;used.add(c.mechanicFingerprint);c.displayName=NAMES[rarity][slot];c.originSeed=c.seed;c.curated=true;c.curationVersion=1;
   c.adjustments=[];
   const b=N.analyzeBehavior(c),es=effects(c.actions),p=timeProfile(c);
   c.designNote=`${c.displayName}：展示${p==='ramp'?'延后成长':p==='fatigue'?'逐步疲劳':p==='mixed'?'先成长后疲劳':'稳定时间曲线'}与${c.stats.VOLATILITY<=.6?'低':c.stats.VOLATILITY>=1.6?'高':'中'}波动。行动组合：${c.actions.map(a=>a.name).join('、')}；机制：${[...new Set(es.map(e=>e.type))].join(' / ')}。${es.some(e=>e.type==='damage')?'直接伤害与其他机制共同工作。':'不强塞攻击，依靠状态、反应或长期损耗结束。'}具体强弱保留生成差异。`;
   c.presentation={power:N.battlePowerV2(c).power,behaviorTags:b.tags,behaviorSummary:b.summary};
   cards.push(c);slots.push({rarity,level:c.level,slot,eligible:pool.length,selectedSeed:c.seed,score:selected.score});
  }
 }
 return {cards,candidateCount,rejected,slots,eligibleCount:slots.reduce((n,s)=>n+s.eligible,0),adjustedCards:0,review:'Rule and source-data review by Codex; human playtest remains separate. No numerical tuning needed for selected candidates.'};
}
function writePresets(result){
 fs.mkdirSync(path.join(__dirname,'../content'),{recursive:true});
 const data={version:4,curationVersion:1,cards:result.cards};
 fs.writeFileSync(path.join(__dirname,'../content/presets-v4.json'),JSON.stringify(data,null,2)+'\n');
 fs.writeFileSync(path.join(__dirname,'../content/presets-v4.js'),'// Generated from presets-v4.json; offline browser transport.\n(function(r){r.NCB.PRESET_V4_CONTENT='+JSON.stringify(data)+';})(globalThis);\n');
 const report={...result,cards:result.cards.map(c=>({name:c.displayName,seed:c.originSeed,rarity:c.rarity,level:c.level,power:c.presentation.power,tags:c.presentation.behaviorTags,volatility:c.stats.VOLATILITY,timeProfile:timeProfile(c),fingerprint:crypto.createHash('sha256').update(c.mechanicFingerprint).digest('hex').slice(0,16),designNote:c.designNote}))};
 fs.writeFileSync(path.join(__dirname,'../qa/v4-curation.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({cards:result.cards.length,candidates:result.candidateCount,eligible:result.eligibleCount,rejected:result.candidateCount-result.eligibleCount,adjusted:result.adjustedCards}));
}
if(require.main===module)writePresets(selectPresets());
module.exports={selectPresets,writePresets,levelDecade,timeProfile,issues,effects};
