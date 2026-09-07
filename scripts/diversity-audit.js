const fs=require('node:fs'),path=require('node:path');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3'])require('../src/'+f+'.js');
const N=global.NCB;
function audit(n=3000){
  const counts={},effects={},conditions={},events={},damageTypes={},resources={},statuses={},targets={},triggers={},fingerprints=new Set(),actionStructures=new Set();
  const inc=(map,key)=>{if(key)map[key]=(map[key]||0)+1;};
  const walk=x=>{if(!x||typeof x!=='object')return;
    if(N.EFFECT_COMPONENTS[x.type])inc(effects,x.type);
    if(N.CONDITION_COMPONENTS[x.type])inc(conditions,x.type);
    if(N.DAMAGE_TYPES[x.type])inc(damageTypes,x.type);
    if(x.damageType)inc(damageTypes,x.damageType);
    if(x.event)inc(events,x.event);
    for(const key of ['resource','from','to'])if(x[key])inc(resources,x[key]);
    if(x.stacking)inc(statuses,x.stacking);if(x.snapshot)inc(statuses,x.snapshot);
    if(x.status)inc(statuses,x.type||'reference');
    if(x.target)inc(targets,x.target);if(x.relation)inc(targets,'query:'+x.relation);
    if(x.event&&x.effects)inc(triggers,x.event);
    for(const v of Object.values(x))if(v&&typeof v==='object')walk(v);
  };
  let nonDamage=0,multiHeal=0,multiShield=0,multiStatus=0;
  for(let i=0;i<n;i++){
    const c=N.generateCardV3({seed:'diversity-v3-'+i,level:1+i%100,rarity:N.RARITY_V2_ORDER[i%12],archetype:Object.keys(N.ARCHETYPES)[i%7]});
    inc(counts,c.actions.length);fingerprints.add(c.mechanicFingerprint);
    for(const a of c.actions)actionStructures.add(N.mechanicFingerprint({...c,actions:[a],triggers:[],passives:[]}));
    const kinds=c.actions.map(a=>a.kind);if(!kinds.includes('damage'))nonDamage++;
    if(kinds.filter(x=>x==='heal').length>1)multiHeal++;
    if(kinds.filter(x=>x==='shield').length>1)multiShield++;
    if(kinds.filter(x=>x==='status').length>1)multiStatus++;
    walk({actions:c.actions,statuses:c.statuses,triggers:c.triggers,passives:c.passives});
  }
  return{samples:n,actionCounts:counts,effectCoverage:effects,conditionCoverage:conditions,eventCoverage:events,damageTypeCoverage:damageTypes,resourceCoverage:resources,statusInteractionCoverage:statuses,targetCoverage:targets,triggerCoverage:triggers,uniqueFingerprints:fingerprints.size,uniqueActionStructures:actionStructures.size,duplicateRate:1-fingerprints.size/n,nonDamage,multiHeal,multiShield,multiStatus};
}
if(require.main===module){const report=audit(Number(process.argv[2])||3000);fs.mkdirSync(path.join(__dirname,'../qa'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../qa/diversity-v3.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
module.exports={audit};
