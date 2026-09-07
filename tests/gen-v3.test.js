const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3'])require('../src/'+f+'.js');
const N=global.NCB;
test('v3 deterministic, canonical actions, schema and JSON roundtrip',()=>{
  for(let i=0;i<80;i++){
    const opts={seed:'v3-test-'+i,level:37,rarity:'A'};
    const c=N.generateCardByVersion(opts);
    assert.equal(c.generatorVersion,3);assert.deepEqual(c,N.generateCardV3(opts));
    assert.ok(c.actions.length>=2&&c.actions.length<=6);
    const v=N.validateContentPack(N.assembleCardPack(c));assert.ok(v.ok,v.errors.join('\n'));
    assert.deepEqual(N.assembleCardPack(JSON.parse(JSON.stringify(c))),N.assembleCardPack(c));
  }
});
test('rarity raises budget and primary stats without changing mechanism fingerprint',()=>{
  let prev;
  for(const rarity of N.RARITY_V2_ORDER){
    const c=N.generateCardV3({seed:'mirror',level:37,rarity});
    if(prev){assert.ok(c.generationBudget>prev.generationBudget);assert.equal(c.mechanicFingerprint,prev.mechanicFingerprint);for(const k of ['MAX_HP','ATK','DEF','RES','SPD'])assert.ok(c.stats[k]>=prev.stats[k]);}
    prev=c;
  }
});
test('no mandatory damage: multi-heal, shield, status and defensive kits are valid',()=>{
  const seen=new Set();
  for(let i=0;i<800;i++){
    const c=N.generateCardV3({seed:'freedom-'+i});
    const kinds=c.actions.map(a=>a.kind);
    for(const k of ['heal','shield','status'])if(kinds.filter(x=>x===k).length>=2)seen.add(k);
    if(!kinds.includes('damage'))seen.add('non-damage');
  }
  assert.deepEqual([...seen].sort(),['heal','non-damage','shield','status']);
});
test('generated canonical battle is finite, legal, deterministic and replayable',()=>{
  for(let i=0;i<12;i++){
    const cards=['a','b'].map(x=>N.generateCardV3({seed:x+i}));cards.forEach(N.deployCard);
    const e=N.createBattle({teamA:[cards[0].id],teamB:[cards[1].id],maxRounds:20});
    while(!e.outcome().ended){const actions=[...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')];for(const a of actions){assert.ok(e.getLegalActions(a.actorId).some(x=>x.id===a.skillId));assert.ok(e.getValidTargets(a.actorId,a.skillId).some(x=>x.id===a.targetId));}e.resolveRound(actions);}
    assert.deepEqual(N.replayBattle(e.exportReplay()).serializableSnapshot(),e.serializableSnapshot());
    assert.ok(!/NaN|Infinity/.test(JSON.stringify(e.serializableSnapshot())));
  }
});
