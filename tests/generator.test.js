const test=require('node:test');
const assert=require('node:assert/strict');
function load(){
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator'])
    delete require.cache[require.resolve('../src/'+f+'.js')];
  global.NCB={};
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator'])
    require('../src/'+f+'.js');
  return global.NCB;
}
test('generateCard is deterministic for identical seed/rarity/level/archetype/version',()=>{
  const N=load();
  const a=N.generateCard({rarity:'A',level:50,archetype:'Assassin',seed:'A_ASSASSIN_20260901_000134'});
  const b=N.generateCard({rarity:'A',level:50,archetype:'Assassin',seed:'A_ASSASSIN_20260901_000134'});
  assert.deepEqual(a,b,'same seed must generate the identical card');
  assert.equal(N.CARD_GENERATOR_VERSION,1);
  assert.equal(a.generatorVersion,1);
});
test('card schema matches spec fields and constraints',()=>{
  const N=load();
  const c=N.generateCard({rarity:'C',level:100,archetype:'Balanced',seed:'c100'});
  assert.ok(c.id&&typeof c.seed==='string');
  assert.equal(c.rarity,'C');assert.equal(c.level,100);assert.equal(c.quality>=0.97&&c.quality<=1.03,true,c.quality);
  assert.equal(c.archetype,'Balanced');
  assert.ok(c.powerIndex>0&&c.generationBudget>0);
  assert.ok(c.stats.MAX_HP>=90&&c.stats.ATK>=40&&c.stats.SPD>=55,'primary conversion floor (calibrated band)');
  assert.ok(c.stats.MAX_HP<3000&&c.stats.ATK<1000,'generated stats stay in a sane engine band');
  assert.equal(c.skills.length,3,'exactly 3 active skills');
  assert.ok(Array.isArray(c.passives)&&Array.isArray(c.statuses)&&Array.isArray(c.triggers));
  assert.ok(c.resources.ENERGY&&c.resources.ENERGY.max>0);
});
test('SSS outpowers C and A Lv50 ~ C Lv100 relationship holds',()=>{
  const N=load();
  const c=N.generateCard({rarity:'C',level:100,archetype:'Balanced',seed:'c'});
  const s=N.generateCard({rarity:'SSS',level:100,archetype:'Balanced',seed:'s'});
  const a=N.generateCard({rarity:'A',level:50,archetype:'Balanced',seed:'a'});
  assert.ok(s.stats.MAX_HP>c.stats.MAX_HP,'SSS HP > C HP');
  assert.ok(s.powerIndex>c.powerIndex*1.9,'SSS RPI ~2x C');
  assert.ok(Math.abs(a.powerIndex-c.powerIndex)<3,'A Lv50 ~ C Lv100 power');
});
test('generated card compiles through validateContentPack',()=>{
  const N=load();
  const c=N.generateCard({rarity:'B+',level:60,archetype:'Mage',seed:'bplus60'});
  const pack=N.assembleCardPack(c);
  const result=N.validateContentPack(pack);
  assert.ok(result.ok,result.errors.join('\n'));
});
test('generated card can fight in a real battle',()=>{
  const N=load();
  const c=N.generateCard({rarity:'A',level:80,archetype:'Assassin',seed:'fighter'});
  const unitId=N.deployCard(c);
  const e=N.createBattle({seed:'gen5,1,2,3,4',teamA:[unitId],teamB:['vanguard']});
  let guard=0;
  while(!e.outcome().ended&&guard++<20)e.resolveRound([...N.planAI(e,'A','normal'),...N.planAI(e,'B','normal')]);
  assert.ok(e.outcome().ended,'battle must resolve');
  assert.ok(e.log.some(x=>x.kind==='action'),'battle log contains actions');
  assert.ok(e.log.every(x=>String(x.text).indexOf('NaN')<0),'no NaN in log');
});
test('powerAudit reports budget allocation honestly',()=>{
  const N=load();
  const c=N.generateCard({rarity:'A',level:100,archetype:'Controller',seed:'audit'});
  const audit=c.powerAudit;
  assert.ok(Math.abs(audit.totalBudget-c.generationBudget)<1,'audit total ~ card budget');
  const sum=['primary','secondary','skills','passive'].reduce((a,k)=>a+audit.buckets[k].allocated,0);
  assert.ok(Math.abs(sum-audit.totalBudget)<2,'buckets sum to total');
  assert.ok(audit.buckets.skills.spent>0,'skills bucket spent');
  assert.ok(audit.buckets.passive.spent===0,'passive auto-gen deferred (v1)');
  assert.ok(audit.unspent>=0);
});
test('archetype shapes differ meaningfully',()=>{
  const N=load();
  // Structural fact (immune to per-seed jitter): Assassin ATK allocation weight > Tank.
  assert.ok(N.ARCHETYPES.Assassin.ATK>N.ARCHETYPES.Tank.ATK,'archetype ATK weight: Assassin > Tank');
  const tank=N.generateCard({rarity:'B',level:100,archetype:'Tank',seed:'t'});
  const asn=N.generateCard({rarity:'B',level:100,archetype:'Assassin',seed:'a'});
  assert.ok(tank.stats.MAX_HP>asn.stats.MAX_HP,'tank HP > assassin HP');
  assert.ok(asn.stats.SPD>tank.stats.SPD,'assassin SPD > tank SPD');
  // Across many deterministic seeds the jitter never flips the ATK ordering.
  let sumAsn=0,sumTank=0;
  for(let i=0;i<40;i++){
    sumAsn+=N.generateCard({rarity:'B',level:100,archetype:'Assassin',seed:'w'+i}).stats.ATK;
    sumTank+=N.generateCard({rarity:'B',level:100,archetype:'Tank',seed:'w'+i}).stats.ATK;
  }
  assert.ok(sumAsn>sumTank,'Assassin mean ATK > Tank mean ATK over 40 seeds');
});

test('generation identity: identical full tuple => same card and same ID; different tuple => different ID',()=>{
  const N=load();
  const opts={seed:'same',rarity:'C',level:1,archetype:'Tank'};
  const a=N.generateCard(opts),b=N.generateCard(opts);
  assert.deepEqual(a,b,'identical tuple -> identical card');
  assert.equal(a.id,b.id,'identical tuple -> same ID');
  const s=N.generateCard({seed:'same',rarity:'SSS',level:100,archetype:'Assassin'});
  assert.notEqual(a.id,s.id,'different rarity/level/archetype -> different ID');
  assert.notEqual(a.id,N.generateCard({seed:'same',rarity:'A',level:1,archetype:'Tank'}).id,'different rarity -> different ID');
  assert.notEqual(a.id,N.generateCard({seed:'same',rarity:'C',level:50,archetype:'Tank'}).id,'different level -> different ID');
  assert.notEqual(a.id,N.generateCard({seed:'same',rarity:'C',level:1,archetype:'Mage'}).id,'different archetype -> different ID');
  // canonical identity string is stable and unique across the tuple
  const i1=N.canonicalGenerationIdentity({seed:'same',rarity:'C',level:1,archetype:'Tank',generatorVersion:1});
  const i2=N.canonicalGenerationIdentity({seed:'same',rarity:'C',level:1,archetype:'Tank',generatorVersion:1});
  assert.equal(i1,i2,'canonical identity is stable');
  assert.notEqual(N.canonicalGenerationIdentity({seed:'same',rarity:'C',level:1,archetype:'Tank'}),N.canonicalGenerationIdentity({seed:'same',rarity:'SSS',level:100,archetype:'Assassin'}));
});

test('unsupported generatorVersion is rejected (no fake version tags)',()=>{
  const N=load();
  assert.throws(()=>N.generateCard({seed:'x',rarity:'C',generatorVersion:999}),/unsupported generatorVersion/i);
  assert.throws(()=>N.generateCard({seed:'x',rarity:'C',generatorVersion:2}),/unsupported generatorVersion/i);
  // default still resolves to version 1
  const c=N.generateCard({seed:'x',rarity:'C'});
  assert.equal(c.generatorVersion,1);
});

test('deploying two cards with the same seed but different rarity coexist (no overwrite)',()=>{
  const N=load();
  const c=N.generateCard({seed:'same',rarity:'C',level:1,archetype:'Tank'});
  const s=N.generateCard({seed:'same',rarity:'SSS',level:100,archetype:'Assassin'});
  assert.notEqual(c.id,s.id);
  const idC=N.deployCard(c),idS=N.deployCard(s);
  assert.equal(idC,c.id);assert.equal(idS,s.id);
  assert.ok(N.UNIT_DEFS[c.id],'first card still registered');
  assert.ok(N.UNIT_DEFS[s.id],'second card registered alongside');
  assert.equal(N.UNIT_DEFS[c.id].id,c.id,'first card not overwritten');
  // both packs compile and have distinct skill ids
  const pC=N.assembleCardPack(c),pS=N.assembleCardPack(s);
  assert.ok(N.validateContentPack(pC).ok);
  assert.ok(N.validateContentPack(pS).ok);
  const skC=c.skills.map(x=>x.id),skS=s.skills.map(x=>x.id);
  for(const id of skC)assert.ok(!skS.includes(id),'skill id collision: '+id);
});

test('generateCard validates level strictly (1..100 integer); undefined defaults to 100',()=>{
  const N=load();
  assert.equal(N.generateCard({seed:'x',rarity:'C',level:1}).level,1);
  assert.equal(N.generateCard({seed:'x',rarity:'C',level:100}).level,100);
  assert.equal(N.generateCard({seed:'x',rarity:'C'}).level,100,'undefined defaults to 100');
  for(const bad of [0,-1,101,999,1.5,NaN,Infinity,'abc']){
    assert.throws(()=>N.generateCard({seed:'x',rarity:'C',level:bad}),/level/i,'must reject level '+String(bad));
  }
});

test('generated pierce skill actually carries penetrationBonus and beats no-pen twin vs high-DEF target',()=>{
  const N=load();
  // Find an Assassin seed whose recipe set includes pierce (pool includes it).
  let card=null,pSkill=null;
  for(let i=0;i<60&&!pSkill;i++){
    const c=N.generateCard({rarity:'A',level:100,archetype:'Assassin',seed:'pf'+i});
    pSkill=c.skills.find(s=>s.id.endsWith('-pierce'));
    if(pSkill)card=c;
  }
  assert.ok(card&&pSkill,'found a generated Assassin card with a pierce skill');
  assert.equal(pSkill.penetrationBonus,20,'generated pierce skill carries penetrationBonus=20');
  // The skill costs budget for its penetration: higher reference cost than pen=0 twin.
  const pierceRecipe=N.SKILL_RECIPES.find(r=>r.id==='pierce');
  const zeroPen={...pierceRecipe,penetrationBonus:0};
  assert.ok(N.recipeBaseCost(pierceRecipe)>N.recipeBaseCost(zeroPen),'pierce costs budget for penetration');
  // Integration: pierce vs identical no-pen skill, same attacker/target/seed/base formula.
  const build=(pen)=>{
    const skill={id:'it_s'+pen,name:'IT',kind:'damage',target:'enemy',cost:1,cooldown:0,priority:0,accuracy:1,damageType:'physical',formula:'ATK * 1.2',effects:[{type:'damage'}]};
    if(pen)skill.penetrationBonus=20;
    return{id:'it_u'+pen,name:'IT',role:'x',description:'',generatorVersion:1,rarity:'B',level:100,quality:1,archetype:'Bruiser',
      powerIndex:100,generationBudget:1000,seed:'it',
      stats:{MAX_HP:300,ATK:80,DEF:30,RES:30,SPD:50,ENERGY_MAX:4,ENERGY_REGEN:2},
      resources:{ENERGY:{max:4,regen:2}},resistances:{},tags:[],
      skills:[skill],passives:[],statuses:[],triggers:[]};
  };
  N.UNIT_DEFS['qa_highdef']={id:'qa_highdef',name:'QA HighDef',role:'tank',description:'',stats:{MAX_HP:900,ATK:20,DEF:120,RES:100,SPD:40,ENERGY_MAX:4},skills:[],resistances:{},tags:[]};
  const dmg=(card)=>{
    const uid=N.deployCard(card);
    const e=N.createBattle({seed:'gen5,7,7,7,7',teamA:[uid],teamB:['qa_highdef']});
    let g=0;while(!e.outcome().ended&&g++<15)e.resolveRound([...N.planAI(e,'A','normal'),...N.planAI(e,'B','normal')]);
    return e.log.filter(x=>x.kind==='damage'&&x.sourceId==='A1').reduce((s,x)=>s+(x.hpDamage||0),0);
  };
  const dPen=dmg(build(20)),dZero=dmg(build(0));
  assert.ok(dPen>dZero,'pierce (pen 20) deals more damage than no-pen twin vs high DEF: '+dPen+' vs '+dZero);
});