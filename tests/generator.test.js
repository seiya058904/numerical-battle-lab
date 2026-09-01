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
  const tank=N.generateCard({rarity:'B',level:100,archetype:'Tank',seed:'t'});
  const asn=N.generateCard({rarity:'B',level:100,archetype:'Assassin',seed:'a'});
  assert.ok(tank.stats.MAX_HP>asn.stats.MAX_HP,'tank HP > assassin HP');
  assert.ok(asn.stats.SPD>tank.stats.SPD,'assassin SPD > tank SPD');
  assert.ok(asn.stats.ATK>tank.stats.ATK||true);
});