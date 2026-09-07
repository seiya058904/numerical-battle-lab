const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3'])require('../src/'+f+'.js');
const N=global.NCB;
test('v3 deterministic, canonical actions, schema and JSON roundtrip',()=>{
  for(let i=0;i<80;i++){
    const opts={seed:'v3-test-'+i,level:37,rarity:'A',generatorVersion:3};
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
test('generated LIFESTEAL stat genuinely heals the source from HP damage (not an inert field)',()=>{
  // The engine's global lifesteal path (applyDamage -> heal = hpDamage*LIFESTEAL/100)
  // must make a generated card's LIFESTEAL stat real, independent of skill drainRatio.
  let card=null;
  for(let i=0;i<500&&!card;i++){const c=N.generateCardV3({seed:'lslive-'+i});if((c.stats.LIFESTEAL||0)>=12)card=c;}
  assert.ok(card,`no generated card reached LIFESTEAL>=12`);
  N.deployCard(card); // registers UNIT_DEFS[card.id] with the real stats
  // Re-deploy the generated unit directly so its real stats (incl. LIFESTEAL) are active.
  const probeId='lslive-'+card.id;
  N.UNIT_DEFS[probeId]={...N.UNIT_DEFS[card.id],id:probeId,skills:['ls-probe-hit']};
  N.UNIT_DEFS[probeId].stats={...N.UNIT_DEFS[card.id].stats};
  N.SKILL_DEFS['ls-probe-hit']={id:'ls-probe-hit',name:'命中',target:'enemy',kind:'damage',cost:0,cooldown:0,effects:[{type:'damage',formula:'0'}]};
  const e=N.createBattle({teamA:[probeId],teamB:['warden']});
  const source=e.entity('A1');
  source.hp=Math.floor(source.maxHp*0.5); // create missing-HP headroom
  const before=source.hp;
  const r=e.applyDamage({sourceId:'A1',targetId:'B1',amount:200,damageType:'physical'});
  const ls=Math.min(card.stats.LIFESTEAL,60)/100;
  assert.ok(source.hp>before,`LIFESTEAL ${card.stats.LIFESTEAL} did not heal the source (hp ${before}->${source.hp}, hpDamage ${r.hpDamage})`);
  assert.ok(source.hp-before<=Math.round(r.hpDamage*ls)+1,`lifesteal healed more than hpDamage*ls`);
  assert.ok(e.log.some(x=>x.kind==='heal'&&x.sourceId==='A1'),'no lifesteal heal log entry');
});
test('event/号令 emits a semantic command signal, never a forged afterKill',()=>{
  let seen=0;
  for(let i=0;i<1200;i++){
    const c=N.generateCardV3({seed:'cmd-'+i});
    for(const a of c.actions){
      for(const e of (a.effects||[])){
        if(e.type==='emitEvent'){
          assert.notEqual(e.event,'afterKill',`action ${c.id}/${a.name} forges afterKill`);
          assert.ok(N.EVENT_COMPONENTS[e.event],`event action references unregistered event ${e.event}`);
          if(e.event==='command')seen++;
        }
      }
    }
  }
  assert.ok(seen>0,'no generated event action emitted the command signal; check sampling');
});
test('firing command does not trigger afterKill listeners (semantic isolation)',()=>{
  const base=N.UNIT_DEFS.vanguard;
  N.UNIT_DEFS.cmd_unit={...base,id:'cmd_unit',skills:['cmd-signal','cmd-afterkill']};
  N.UNIT_DEFS.cmd_unit.triggers=[{event:'afterKill',target:'self',effects:[{type:'gain',resource:'ENERGY',amount:5}]},{event:'command',target:'self',effects:[{type:'gain',resource:'ENERGY',amount:2}]}];
  N.UNIT_DEFS.cmd_unit.stats={...base.stats,ENERGY_MAX:10};
  N.SKILL_DEFS['cmd-signal']={id:'cmd-signal',name:'号令',target:'self',kind:'utility',cost:0,cooldown:0,effects:[{type:'emitEvent',event:'command',eventSubject:'actor'}]};
  N.SKILL_DEFS['cmd-afterkill']={id:'cmd-afterkill',name:'伪击杀',target:'self',kind:'utility',cost:0,cooldown:0,effects:[{type:'emitEvent',event:'afterKill',eventSubject:'actor'}]};
  const e=N.createBattle({teamA:['cmd_unit'],teamB:['warden']});
  const a=e.entity('A1'),initial=a.energy;
  // Only the command-signal action; the afterKill listener (ENERGY+5) must NOT fire.
  e.useSkill({actorId:'A1',skillId:'cmd-signal',targetId:'A1'});
  assert.equal(a.energy,initial+2,`command signal should run the command reward (+2), got ${a.energy} (afterKill would have been +5)`);
  assert.ok(!e.log.some(x=>x.eventName==='afterKill'),'command signal emitted an afterKill event');
  // Sanity: an explicit afterKill action DOES reach the afterKill listener.
  e.useSkill({actorId:'A1',skillId:'cmd-afterkill',targetId:'A1'});
  assert.ok(e.log.some(x=>x.eventName==='afterKill'),'explicit afterKill action did not emit afterKill');
});
