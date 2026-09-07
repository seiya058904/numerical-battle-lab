// Generator v4 diversity audit (spec §63-64, §82).
//
// Generates N v4 cards and reports coverage across mechanics, randomness,
// time profiles, behavior tags, rarity, level, and convergence/lethality.
// Also proves classlessness: no card carries an archetype, and no archetype
// vocabulary appears in identities.
const fs=require('node:fs'),path=require('node:path');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior','battlepower-v2'])require('../src/'+f+'.js');
const N=global.NCB;

function audit(n=10000){
  const counts={},effects={},conditions={},events={},damageTypes={},resources={},statuses={},targets={},triggers={},tags={},timeProfiles={},volBands={low:0,mid:0,high:0};
  const fingerprints=new Set();
  const inc=(m,k)=>{if(k)m[k]=(m[k]||0)+1;};
  const walk=x=>{if(!x||typeof x!=='object')return;
    if(N.EFFECT_COMPONENTS[x.type])inc(effects,x.type);
    if(N.CONDITION_COMPONENTS[x.type])inc(conditions,x.type);
    if(N.DAMAGE_TYPES[x.type])inc(damageTypes,x.type);
    if(x.damageType)inc(damageTypes,x.damageType);
    if(x.event)inc(events,x.event);
    for(const k of ['resource','from','to'])if(x[k])inc(resources,x[k]);
    if(x.status)inc(statuses,x.type||'reference');
    if(x.target)inc(targets,x.target);if(x.relation)inc(targets,'query:'+x.relation);
    if(x.event&&x.effects)inc(triggers,x.event);
    for(const v of Object.values(x))if(v&&typeof v==='object')walk(v);
  };
  let nonDamage=0,multiHeal=0,multiShield=0,multiStatus=0,classless=true,maxRoundsRate=0;
  const rarityDist={},levelBuckets={};
  for(let i=0;i<n;i++){
    const rarity=N.RARITY_V2_ORDER[i%12];
    const level=10+((i*37)%91);
    const c=N.generateCardV4({seed:'div4-'+i,rarity,level});
    inc(counts,c.actions.length);fingerprints.add(c.mechanicFingerprint);
    if('archetype' in c||/archetype|Balanced|Tank|Bruiser|Assassin|Mage|Support|Controller/.test(c.identity||''))classless=false;
    inc(rarityDist,c.rarity);
    const bucket=level===100?'100':Math.floor(level/10)*10+'-'+ (Math.floor(level/10)*10+9);
    inc(levelBuckets,bucket);
    const vol=Number(c.stats.VOLATILITY||1);
    if(vol>=1.6)volBands.high++;else if(vol<=0.6)volBands.low++;else volBands.mid++;
    const ramp=Number(c.stats.RAMP_RATE||0),fat=Number(c.stats.FATIGUE_RATE||0);
    const profile=ramp>0&&fat>0?'mixed':ramp>0?'ramp':fat>0?'fatigue':'stable';
    inc(timeProfiles,profile);
    const beh=N.analyzeBehavior(c);for(const t of beh.tags)inc(tags,t);
    const kinds=c.actions.map(a=>a.kind);if(!kinds.includes('damage'))nonDamage++;
    if(kinds.filter(x=>x==='heal').length>1)multiHeal++;
    if(kinds.filter(x=>x==='shield').length>1)multiShield++;
    if(kinds.filter(x=>x==='status').length>1)multiStatus++;
    walk({actions:c.actions,statuses:c.statuses,triggers:c.triggers,passives:c.passives});
    // convergence probe: subset of cards fight canonical AI (bounded for speed)
    if(i%40===0){
      const opp=N.generateCardV4({seed:'div4-opp-'+i,rarity:'A',level:50});
      N.deployCard(c);N.deployCard(opp);
      const e=N.createBattle({seed:N.deriveSeed(90000+i),teamA:[c.id],teamB:[opp.id],maxRounds:100});
      let g=0;while(!e.outcome().ended&&g++<100)e.resolveRound([...N.planAI(e,'A'),...N.planAI(e,'B')]);
      if(e.history.length>=100)maxRoundsRate++;
      require('./audit-v4-battles').undeploy(c);require('./audit-v4-battles').undeploy(opp);
    }
  }
  return{samples:n,classless,actionCounts:counts,effectCoverage:effects,conditionCoverage:conditions,eventCoverage:events,
    damageTypeCoverage:damageTypes,resourceCoverage:resources,statusInteractionCoverage:statuses,targetCoverage:targets,
    triggerCoverage:triggers,behaviorTags:tags,timeProfiles,volatilityBands:volBands,uniqueFingerprints:fingerprints.size,
    duplicateRate:1-fingerprints.size/n,nonDamage,multiHeal,multiShield,multiStatus,rarityDistribution:rarityDist,levelBuckets,
    convergenceProbes:Math.ceil(n/40),maxRoundsDraws:maxRoundsRate};
}
if(require.main===module){const report=audit(Number(process.argv[2])||10000);fs.mkdirSync(path.join(__dirname,'../qa'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../qa/diversity-v4.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
module.exports={audit};