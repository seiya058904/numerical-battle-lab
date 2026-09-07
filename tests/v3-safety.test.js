const test=require('node:test'),assert=require('node:assert/strict');
const {audit}=require('../scripts/diversity-audit.js');const N=global.NCB;
test('3000 sample diversity spans action counts, mechanics and non-damage kits',()=>{
  const r=audit(3000);assert.equal(Object.keys(r.actionCounts).length,5);
  assert.ok(r.uniqueFingerprints>1000);assert.ok(Object.keys(r.effectCoverage).length>=17);
  assert.ok(Object.keys(r.conditionCoverage).length>=5);assert.equal(Object.keys(r.damageTypeCoverage).length,8);
  assert.ok(r.multiHeal&&r.multiShield&&r.multiStatus&&r.nonDamage);
});
test('large rarity gap favors higher rarity in canonical mirrored battles',()=>{
  let high=0,low=0,draw=0;
  for(let i=0;i<48;i++){
    const a=N.generateCardV3({seed:'rarity-probe-'+i,rarity:'C'}),b=N.generateCardV3({seed:'rarity-probe-'+i,rarity:'XS_COLLECTOR'});
    N.deployCard(a);N.deployCard(b);
    const e=N.createBattle({seed:N.deriveSeed(i+1),teamA:[a.id],teamB:[b.id],maxRounds:30});
    while(!e.outcome().ended)e.resolveRound([...N.planAI(e,'A'),...N.planAI(e,'B')]);
    if(e.outcome().winner==='B')high++;else if(e.outcome().winner==='A')low++;else draw++;
  }
  console.log('rarity sanity',JSON.stringify({high,low,draw}));assert.ok(high>low&&high>24);
});
test('validator rejects nonfinite, cyclic and explosive repeat authoring',()=>{
  assert.equal(N.validateContentPack({units:{},skills:{bad:{amount:Infinity}}}).ok,false);
  const cyclic={};cyclic.loop=cyclic;assert.equal(N.validateContentPack(cyclic).ok,false);
  let effect={type:'heal',formula:'1'};for(let i=0;i<5;i++)effect={type:'repeat',times:32,effects:[effect]};
  assert.equal(N.validateContentPack({skills:{bad:{target:'self',effects:[effect]}}}).ok,false);
});
