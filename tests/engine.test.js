const test = require('node:test');
const assert = require('node:assert/strict');

function load() {
  delete require.cache[require.resolve('../src/kernel.js')];
  delete require.cache[require.resolve('../src/components.js')];
  delete require.cache[require.resolve('../src/rules.js')];
  delete require.cache[require.resolve('../src/content.js')];
  delete require.cache[require.resolve('../src/status-runtime.js')];
  delete require.cache[require.resolve('../src/validator.js')];
  delete require.cache[require.resolve('../src/formula.js')];
  delete require.cache[require.resolve('../src/effects.js')];
  delete require.cache[require.resolve('../src/engine.js')];
  require('../src/kernel.js');
  require('../src/components.js');
  require('../src/rules.js');
  require('../src/content.js');
  require('../src/status-runtime.js');
  require('../src/validator.js');
  require('../src/formula.js');
  require('../src/effects.js');
  require('../src/engine.js');
  return global.NCB;
}

test('same seed and scripted actions produce identical snapshots', () => {
  const NCB = load();
  const run = () => {
    const engine = NCB.createBattle({seed: 'gen5,1,2,3,4', teamA: ['vanguard','ranger'], teamB: ['berserker','medic']});
    for (let r=0; r<4 && !engine.outcome().ended; r++) {
      const a = engine.getLiving('A').map(e => ({actorId:e.id, skillId:e.skills[0], targetId: engine.getLiving('B')[0]?.id})).filter(x=>x.targetId);
      const b = NCB.planAI(engine, 'B', 'normal');
      engine.resolveRound([...a, ...b]);
    }
    return engine.serializableSnapshot();
  };
  assert.deepEqual(run(), run());
});

test('battle supports six simultaneously active entities per team', () => {
  const NCB = load();
  const roster = ['vanguard','duelist','berserker','ranger','pyromancer','medic'];
  const engine = NCB.createBattle({seed:'gen5,10,20,30,40', teamA:roster, teamB:roster});
  assert.equal(engine.getLiving('A').length, 6);
  assert.equal(engine.getLiving('B').length, 6);
  const actions = [...NCB.planAI(engine,'A','normal'), ...NCB.planAI(engine,'B','normal')];
  engine.resolveRound(actions);
  assert.equal(engine.round, 2);
});

test('priority beats speed and exact ties remain deterministic', () => {
  const NCB = load();
  const engine = NCB.createBattle({seed:'gen5,7,8,9,10', teamA:['ranger'], teamB:['duelist']});
  const a = engine.getLiving('A')[0];
  const b = engine.getLiving('B')[0];
  a.stats.SPD = 200;
  b.stats.SPD = 50;
  const actions = [
    {actorId:a.id, skillId:'piercing-shot', targetId:b.id, overridePriority:0},
    {actorId:b.id, skillId:'quick-cut', targetId:a.id, overridePriority:2},
  ];
  engine.resolveRound(actions);
  const first = engine.log.find(x=>x.kind==='action');
  assert.equal(first.actorId, b.id);
});

test('status modifiers derive stats without mutating base stats', () => {
  const NCB = load();
  const engine = NCB.createBattle({seed:'gen5,1,1,1,1', teamA:['vanguard'], teamB:['ranger']});
  const unit = engine.getLiving('A')[0];
  const base = unit.stats.DEF;
  engine.applyStatus(unit.id, 'fortified', {duration:2, stacks:1, sourceId:unit.id});
  assert.ok(engine.getStat(unit.id,'DEF') > base);
  assert.equal(unit.stats.DEF, base);
});

test('barrier replacement absorbs damage before hp changes', () => {
  const NCB = load();
  const engine = NCB.createBattle({seed:'gen5,2,2,2,2', teamA:['medic'], teamB:['berserker']});
  const target = engine.getLiving('A')[0];
  const source = engine.getLiving('B')[0];
  target.shield = 50;
  const hp = target.hp;
  const result = engine.applyDamage({sourceId:source.id,targetId:target.id,amount:40,tags:['physical'],traceLabel:'test'});
  assert.equal(result.hpDamage, 0);
  assert.equal(target.shield, 10);
  assert.equal(target.hp, hp);
});

test('turn-end poison is deterministic and can defeat an entity', () => {
  const NCB = load();
  const engine = NCB.createBattle({seed:'gen5,3,3,3,3', teamA:['vanguard'], teamB:['ranger']});
  const target = engine.getLiving('B')[0];
  target.hp = 4;
  engine.applyStatus(target.id,'poison',{duration:3,stacks:2,sourceId:engine.getLiving('A')[0].id});
  engine.processTurnEnd();
  assert.equal(target.hp,0);
  assert.equal(engine.outcome().winner,'A');
});

test('energy, cooldown and stun restrict legal actions', () => {
  const NCB = load();
  const engine = NCB.createBattle({seed:'gen5,4,4,4,4', teamA:['sentinel'], teamB:['vanguard']});
  const unit = engine.getLiving('A')[0];
  unit.energy = 0;
  assert.ok(engine.getLegalSkills(unit.id).every(s => (s.cost || 0) === 0));
  unit.energy = unit.stats.ENERGY_MAX;
  engine.applyStatus(unit.id,'stun',{duration:1,stacks:1,sourceId:engine.getLiving('B')[0].id});
  assert.equal(engine.getLegalSkills(unit.id).length,0);
});

test('simulation lab returns aggregate metrics', () => {
  const NCB = load();
  const result = NCB.runSimulation({
    battles: 30,
    seedBase: 900,
    teamA:['vanguard','ranger','medic'],
    teamB:['berserker','pyromancer','warden'],
    difficultyA:'normal',difficultyB:'normal',maxRounds:30,
  });
  assert.equal(result.battles,30);
  assert.equal(result.winsA + result.winsB + result.draws,30);
  assert.ok(result.avgRounds > 0);
  assert.ok(Number.isFinite(result.avgDamageA));
  assert.ok(Number.isFinite(result.avgDamageB));
  assert.ok(Number.isFinite(result.avgHealingA));
  assert.ok(Number.isFinite(result.avgSurvivorsA));
});

test('replay action history reproduces final result', () => {
  const NCB = load();
  const engine = NCB.createBattle({seed:'gen5,9,9,9,9', teamA:['duelist','medic'], teamB:['ranger','vanguard']});
  for (let i=0;i<3 && !engine.outcome().ended;i++) {
    engine.resolveRound([...NCB.planAI(engine,'A','normal'),...NCB.planAI(engine,'B','normal')]);
  }
  const replay = engine.exportReplay();
  const replayed = NCB.replayBattle(replay);
  assert.deepEqual(replayed.serializableSnapshot(), engine.serializableSnapshot());
});

test('guard status restricts enemy target selection', () => {
  const NCB = load();
  const engine = NCB.createBattle({seed:'gen5,11,11,11,11', teamA:['ranger'], teamB:['warden','assassin']});
  const warden = engine.teams.B.entities[0];
  engine.applyStatus(warden.id,'guard',{duration:2,stacks:1,sourceId:warden.id});
  const targets = engine.getValidTargets(engine.teams.A.entities[0].id,'piercing-shot');
  assert.deepEqual(targets.map(t=>t.id), [warden.id]);
});

test('reflect does not steal the primary damage calculation trace', () => {
  const NCB = load();
  const engine = NCB.createBattle({seed:'gen5,12,12,12,12', teamA:['duelist'], teamB:['warden']});
  const actor = engine.teams.A.entities[0];
  const target = engine.teams.B.entities[0];
  engine.applyStatus(target.id,'thorns',{duration:2,stacks:1,sourceId:target.id});
  engine.useSkill({actorId:actor.id,skillId:'riposte',targetId:target.id});
  const primary = engine.log.find(x => x.kind==='damage' && x.sourceId===actor.id && x.targetId===target.id);
  assert.ok(primary);
  assert.ok(primary.trace.some(line => line.startsWith('公式:')));
  assert.ok(engine.log.some(x => x.kind==='damage' && x.sourceId===target.id && x.targetId===actor.id));
});

test('all-enemy skills resolve independently for every living target', () => {
  const NCB = load();
  const engine = NCB.createBattle({seed:'gen5,13,13,13,13', teamA:['ranger'], teamB:['vanguard','medic','assassin']});
  const actor = engine.teams.A.entities[0];
  actor.energy = 4;
  const before = engine.getLiving('B').map(e=>e.hp);
  engine.useSkill({actorId:actor.id,skillId:'volley',targetId:engine.teams.B.entities[0].id});
  const after = engine.getLiving('B').map(e=>e.hp);
  assert.equal(after.length, 3);
  const resolved = engine.log.filter(x => x.sourceId===actor.id && (x.kind==='damage' || x.kind==='miss'));
  assert.equal(new Set(resolved.map(x=>x.targetId)).size, 3);
  assert.ok(after.some((hp,i)=>hp < before[i]));
});

test('formula function plugins extend battle formulas without engine branches', () => {
  const NCB = load();
  NCB.registerFormulaFunction('__doubleAtk', value => Number(value) * 2, {pure:true});
  NCB.SKILL_DEFS.__custom = {id:'__custom',name:'自定义测试',kind:'damage',target:'enemy',cost:0,cooldown:0,priority:0,accuracy:1,damageType:'true',formula:'__doubleAtk(ATK)',effects:[{type:'damage'}]};
  NCB.UNIT_DEFS.duelist.skills.push('__custom');
  const engine = NCB.createBattle({seed:'gen5,14,14,14,14', teamA:['duelist'], teamB:['vanguard']});
  const actor = engine.teams.A.entities[0], target = engine.teams.B.entities[0];
  const result = engine.computeDamage(actor,target,NCB.SKILL_DEFS.__custom);
  assert.equal(result.damage, engine.getStat(actor.id,'ATK') * 2);
  NCB.UNIT_DEFS.duelist.skills.pop();
  delete NCB.SKILL_DEFS.__custom;
});

test('status modifier band is stable: additions apply before multipliers regardless definition order', () => {
  const NCB = load();
  NCB.STATUS_DEFS.__bandA = {id:'__bandA',name:'Band A',kind:'buff',maxStacks:1,modifiers:[{stat:'ATK',operation:'multiply',value:2}]};
  NCB.STATUS_DEFS.__bandB = {id:'__bandB',name:'Band B',kind:'buff',maxStacks:1,modifiers:[{stat:'ATK',operation:'add',value:10}]};
  const engine = NCB.createBattle({seed:'gen5,12,13,14,15',teamA:['vanguard'],teamB:['ranger']});
  const unit = engine.getLiving('A')[0];
  const base = unit.stats.ATK;
  engine.applyStatus(unit.id,'__bandA',{duration:2});
  engine.applyStatus(unit.id,'__bandB',{duration:2});
  assert.equal(engine.getStat(unit.id,'ATK'), (base + 10) * 2);
});

test('status stacking policies support refresh and replace semantics', () => {
  const NCB = load();
  NCB.STATUS_DEFS.__refresh = {id:'__refresh',name:'Refresh',kind:'buff',maxStacks:5,stacking:'refresh'};
  NCB.STATUS_DEFS.__replace = {id:'__replace',name:'Replace',kind:'buff',maxStacks:5,stacking:'replace'};
  const engine = NCB.createBattle({seed:'gen5,16,17,18,19',teamA:['vanguard'],teamB:['ranger']});
  const unit = engine.getLiving('A')[0];
  engine.applyStatus(unit.id,'__refresh',{duration:1,stacks:2});
  engine.applyStatus(unit.id,'__refresh',{duration:4,stacks:3});
  assert.equal(engine.status(unit,'__refresh').stacks, 2);
  assert.equal(engine.status(unit,'__refresh').duration, 4);
  engine.applyStatus(unit.id,'__replace',{duration:4,stacks:4});
  engine.applyStatus(unit.id,'__replace',{duration:2,stacks:1});
  assert.equal(engine.status(unit,'__replace').stacks, 1);
  assert.equal(engine.status(unit,'__replace').duration, 2);
});

test('typed damage applies resistance and vulnerability after armor mitigation', () => {
  const NCB = load();
  const engine = NCB.createBattle({seed:'gen5,20,21,22,23',teamA:['pyromancer'],teamB:['vanguard']});
  const source = engine.getLiving('A')[0];
  const target = engine.getLiving('B')[0];
  target.resistances.fire = 0.50;
  const neutral = engine.previewDamageComponent(source.id,target.id,{type:'fire',amount:100,penetration:1});
  target.resistances.fire = -0.25;
  const vulnerable = engine.previewDamageComponent(source.id,target.id,{type:'fire',amount:100,penetration:1});
  assert.ok(vulnerable.finalDamage > neutral.finalDamage * 2);
});

test('hybrid damage packet resolves multiple damage types independently', () => {
  const NCB = load();
  const engine = NCB.createBattle({seed:'gen5,24,25,26,27',teamA:['sentinel'],teamB:['vanguard']});
  const source = engine.getLiving('A')[0];
  const target = engine.getLiving('B')[0];
  target.resistances.lightning = 0.5;
  const hp = target.hp;
  const result = engine.applyDamagePacket({sourceId:source.id,targetId:target.id,components:[
    {type:'physical',amount:30,penetration:1},
    {type:'lightning',amount:30,penetration:1},
  ],traceLabel:'hybrid-test'});
  assert.equal(result.components.length,2);
  assert.ok(result.components[0].hpDamage > result.components[1].hpDamage);
  assert.equal(target.hp, hp - result.hpDamage);
});

test('damage affinity converts part of matching hp damage into healing', () => {
  const NCB = load();
  const engine = NCB.createBattle({seed:'gen5,28,29,30,31',teamA:['pyromancer'],teamB:['vanguard']});
  const source = engine.getLiving('A')[0];
  const target = engine.getLiving('B')[0];
  target.hp -= 40;
  target.affinities.fire = 0.5;
  const before = target.hp;
  const result = engine.applyDamagePacket({sourceId:source.id,targetId:target.id,components:[{type:'fire',amount:20,penetration:1}],traceLabel:'affinity'});
  assert.ok(result.hpDamage > 0);
  assert.ok(result.affinityHealing > 0);
  assert.equal(target.hp, before - result.hpDamage + result.affinityHealing);
});

test('multi-hit damage effects resolve the configured number of deterministic hits', () => {
  const NCB = load();
  NCB.SKILL_DEFS.__multihit = {id:'__multihit',name:'Multi',kind:'damage',target:'enemy',cost:0,cooldown:0,priority:0,accuracy:1,damageType:'physical',formula:'ATK * 0 + 10',effects:[{type:'damage',hits:3}]};
  const engine = NCB.createBattle({seed:'gen5,32,33,34,35',teamA:['ranger'],teamB:['vanguard']});
  const actor = engine.getLiving('A')[0];
  actor.skills.push('__multihit');
  const target = engine.getLiving('B')[0];
  engine.useSkill({actorId:actor.id,skillId:'__multihit',targetId:target.id});
  const damageRows = engine.log.filter(x => x.kind === 'damage' && x.sourceId === actor.id && x.targetId === target.id);
  assert.equal(damageRows.length,3);
});

test('status immunity tags can deterministically block status application', () => {
  const NCB = load();
  NCB.STATUS_DEFS.__control = {id:'__control',name:'Control',kind:'debuff',maxStacks:1,tags:['control']};
  const engine = NCB.createBattle({seed:'gen5,36,37,38,39',teamA:['vanguard'],teamB:['ranger']});
  const unit = engine.getLiving('A')[0];
  unit.immunities.control = 1;
  const applied = engine.applyStatus(unit.id,'__control',{duration:2,sourceId:engine.getLiving('B')[0].id});
  assert.equal(applied,false);
  assert.equal(engine.hasStatus(unit,'__control'),false);
});

test('conditional effects reuse generic requirement evaluation', () => {
  const NCB = load();
  NCB.SKILL_DEFS.__conditional = {id:'__conditional',name:'Conditional',kind:'support',target:'enemy',cost:0,cooldown:0,accuracy:1,effects:[{type:'conditional',condition:{type:'targetHasStatus',status:'slow'},then:[{type:'status',status:'stun',duration:1}]}]};
  const engine = NCB.createBattle({seed:'gen5,40,41,42,43',teamA:['frostbinder'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0], target=engine.getLiving('B')[0]; actor.skills.push('__conditional');
  engine.useSkill({actorId:actor.id,skillId:'__conditional',targetId:target.id});
  assert.equal(engine.hasStatus(target,'stun'),false);
  engine.applyStatus(target.id,'slow',{duration:2,sourceId:actor.id});
  engine.useSkill({actorId:actor.id,skillId:'__conditional',targetId:target.id});
  assert.equal(engine.hasStatus(target,'stun'),true);
});

test('healing received modifiers can reduce or amplify healing', () => {
  const NCB = load();
  NCB.STATUS_DEFS.__grievous = {id:'__grievous',name:'Grievous',kind:'debuff',maxStacks:2,modifiers:[{stat:'HEAL_TAKEN',operation:'addPerStack',value:-25}]};
  const engine = NCB.createBattle({seed:'gen5,44,45,46,47',teamA:['medic'],teamB:['vanguard']});
  const healer=engine.getLiving('A')[0], target=engine.getLiving('B')[0]; target.stats.HEAL_TAKEN=100; target.hp-=100;
  engine.applyStatus(target.id,'__grievous',{duration:2,stacks:2,sourceId:healer.id});
  const gained=engine.heal(healer.id,target.id,100,'test');
  assert.equal(gained,62);
});

test('status resistance modifiers participate in typed damage', () => {
  const NCB = load();
  NCB.STATUS_DEFS.__fireWard = {id:'__fireWard',name:'Fire Ward',kind:'buff',maxStacks:1,resistanceMods:[{type:'fire',operation:'add',value:0.4}]};
  const engine = NCB.createBattle({seed:'gen5,48,49,50,51',teamA:['pyromancer'],teamB:['vanguard']});
  const source=engine.getLiving('A')[0], target=engine.getLiving('B')[0];
  const before=engine.previewDamageComponent(source.id,target.id,{type:'fire',amount:100,penetration:1}).finalDamage;
  engine.applyStatus(target.id,'__fireWard',{duration:2});
  const after=engine.previewDamageComponent(source.id,target.id,{type:'fire',amount:100,penetration:1}).finalDamage;
  assert.ok(after < before * 0.7);
});

test('generic periodic status resolves typed damage through resistance pipeline', () => {
  const NCB = load();
  NCB.STATUS_DEFS.__ember = {
    id:'__ember',name:'Ember',kind:'debuff',maxStacks:3,stacking:'stack',
    periodic:{timing:'turnEnd',effects:[{type:'damage',damageType:'fire',formula:'TARGET_MAX_HP * 0.05 * STACKS',canMiss:false,canCrit:false}]}
  };
  const engine = NCB.createBattle({seed:'gen5,52,53,54,55',teamA:['pyromancer'],teamB:['vanguard']});
  const source=engine.getLiving('A')[0], target=engine.getLiving('B')[0];
  target.resistances.fire=0.5;
  engine.applyStatus(target.id,'__ember',{duration:2,stacks:2,sourceId:source.id});
  const before=target.hp;
  engine.processTurnEnd();
  assert.ok(target.hp < before);
  const typed=engine.log.filter(x=>x.kind==='damage').at(-1);
  assert.ok(typed.trace.some(x=>String(x).includes('火焰')));
  assert.equal(engine.status(target,'__ember').duration,1);
});

test('repeat effect composes nested effects without bespoke skill code', () => {
  const NCB = load();
  NCB.SKILL_DEFS.__repeat = {id:'__repeat',name:'Triple Tap',kind:'damage',target:'enemy',cost:0,accuracy:1,formula:'ATK * 0.2',effects:[{type:'repeat',times:3,effects:[{type:'damage',canMiss:false,canCrit:false}]}]};
  const engine=NCB.createBattle({seed:'gen5,56,57,58,59',teamA:['ranger'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0],target=engine.getLiving('B')[0];actor.skills.push('__repeat');
  engine.useSkill({actorId:actor.id,skillId:'__repeat',targetId:target.id});
  assert.equal(engine.log.filter(x=>x.kind==='damage').length,3);
});

test('reactive status triggers can use committed damage values and avoid reflected ping-pong', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__counter={id:'__counter',name:'Counter',kind:'buff',maxStacks:2,stacking:'stack',triggers:[{
    event:'afterDamageTaken',target:'other',condition:{not:{type:'tag',tag:'reflect'}},
    effects:[{type:'damage',damageType:'true',formula:'EVENT_HP_DAMAGE * 0.2 * STACKS',canMiss:false,canCrit:false,tags:['reflect']}]
  }]};
  const engine=NCB.createBattle({seed:'gen5,60,61,62,63',teamA:['duelist'],teamB:['warden']});
  const a=engine.getLiving('A')[0],b=engine.getLiving('B')[0];
  engine.applyStatus(a.id,'__counter',{duration:2,stacks:1,sourceId:a.id});
  engine.applyStatus(b.id,'__counter',{duration:2,stacks:1,sourceId:b.id});
  const before=a.hp;
  engine.applyDamage({sourceId:a.id,targetId:b.id,amount:50,tags:['test'],traceLabel:'test'});
  assert.ok(a.hp<before);
  const reflected=engine.log.filter(x=>x.kind==='damage'&&x.sourceId===b.id&&x.targetId===a.id);
  assert.equal(reflected.length,1);
});

test('reactive trigger depth guard halts pathological status chains deterministically', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__loop={id:'__loop',name:'Loop',kind:'buff',maxStacks:1,triggers:[{
    event:'afterDamageTaken',target:'other',effects:[{type:'damage',damageType:'true',formula:'1',canMiss:false,canCrit:false}]
  }]};
  const engine=NCB.createBattle({seed:'gen5,64,65,66,67',teamA:['vanguard'],teamB:['warden']});
  const a=engine.getLiving('A')[0],b=engine.getLiving('B')[0];
  engine.applyStatus(a.id,'__loop',{duration:2});engine.applyStatus(b.id,'__loop',{duration:2});
  engine.applyDamage({sourceId:a.id,targetId:b.id,amount:2,tags:['test'],traceLabel:'test'});
  assert.ok(engine.log.some(x=>x.kind==='system'&&String(x.text).includes('触发链上限')));
  assert.ok(engine.log.length<100);
});

test('AI scores actual tactical utility and prioritizes healing a critically wounded ally', () => {
  const NCB=load();
  const engine=NCB.createBattle({seed:'gen5,68,69,70,71',teamA:['medic','vanguard'],teamB:['assassin']});
  const medic=engine.getLiving('A')[0],tank=engine.getLiving('A')[1];
  medic.energy=medic.stats.ENERGY_MAX;tank.hp=Math.floor(tank.maxHp*0.18);
  const action=NCB.planAI(engine,'A','hard').find(x=>x.actorId===medic.id);
  assert.ok(action);
  assert.equal(action.targetId,tank.id);
  assert.ok(['pulse-heal','barrier','cleanse'].includes(action.skillId));
});

test('simulation reports damage types, skill usage, status applications and misses', () => {
  const NCB=load();
  const r=NCB.runSimulation({battles:20,seedBase:1200,teamA:['pyromancer','stormcaller'],teamB:['frostbinder','plague'],difficultyA:'normal',difficultyB:'normal',maxRounds:20});
  assert.equal(typeof r.damageByType.fire,'number');
  assert.ok(Object.keys(r.skillUsage).length>0);
  assert.ok(Object.keys(r.statusApplications).length>0);
  assert.equal(typeof r.misses,'number');
});

test('all built-in content references valid skills, statuses, damage types and parseable formulas', () => {
  const NCB=load();
  const scope={ATK:80,DEF:50,RES:55,SPD:70,CRIT:15,RAGE:3,MAX_HP:160,HP:120,HP_PCT:.75,MISSING_HP:40,ENERGY:3,TARGET_HP:100,TARGET_MAX_HP:180,TARGET_HP_PCT:.55,TARGET_DEF:65,TARGET_RES:60,TARGET_STATUS_SLOW:1,STACKS:2,CONSUMED_STACKS:3,EVENT_DAMAGE:50,EVENT_HP_DAMAGE:40,EVENT_SHIELD_DAMAGE:10};
  for(const unit of Object.values(NCB.UNIT_DEFS))for(const id of unit.skills)assert.ok(NCB.SKILL_DEFS[id],`missing skill ${id}`);
  const scanEffects=(effects=[])=>{for(const effect of effects){if(effect.status)assert.ok(NCB.STATUS_DEFS[effect.status],`missing status ${effect.status}`);if(effect.damageType)assert.ok(NCB.DAMAGE_TYPES[effect.damageType],`missing damage type ${effect.damageType}`);if(effect.formula)assert.ok(Number.isFinite(NCB.evaluateExpression(effect.formula,scope)),`bad formula ${effect.formula}`);scanEffects(effect.effects);scanEffects(effect.then);scanEffects(effect.else);}};
  for(const skill of Object.values(NCB.SKILL_DEFS)){
    if(skill.damageType)assert.ok(NCB.DAMAGE_TYPES[skill.damageType],`missing skill damage type ${skill.damageType}`);
    if(skill.formula)assert.ok(Number.isFinite(NCB.evaluateExpression(skill.formula,scope)),`bad skill formula ${skill.id}`);
    for(const c of skill.damageComponents||[]){assert.ok(NCB.DAMAGE_TYPES[c.type],`missing component type ${c.type}`);assert.ok(Number.isFinite(NCB.evaluateExpression(c.formula||skill.formula,scope)));}
    scanEffects(skill.effects);
  }
  for(const status of Object.values(NCB.STATUS_DEFS)){
    for(const t of status.tags||[])assert.equal(typeof t,'string');
    for(const m of status.modifiers||[])assert.ok(['add','addPerStack','multiply','multiplyPerStack'].includes(m.operation));
    for(const m of status.resistanceMods||[])assert.ok(m.type==='all'||NCB.DAMAGE_TYPES[m.type]);
    scanEffects(status.periodic?.effects);for(const tr of status.triggers||[])scanEffects(tr.effects);
  }
});


test('default 4v4 preset stays within a broad competitive balance band', () => {
  const NCB=load();
  const r=NCB.runSimulation({battles:200,seedBase:33000,teamA:NCB.DEFAULT_TEAM_A,teamB:NCB.DEFAULT_TEAM_B,difficultyA:'hard',difficultyB:'hard',maxRounds:45});
  assert.ok(r.winRateA>=0.38&&r.winRateA<=0.62,`A win rate ${r.winRateA}`);
});

test('skills can require and atomically pay multiple named resources', () => {
  const NCB=load();
  NCB.SKILL_DEFS.__rageCost={id:'__rageCost',name:'Rage Cost',kind:'damage',target:'enemy',cost:1,costs:[{resource:'RAGE',amount:2}],accuracy:1,formula:'ATK * 0.82',effects:[{type:'damage',canMiss:false,canCrit:false}]};
  const engine=NCB.createBattle({seed:'gen5,72,73,74,75',teamA:['berserker'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0],target=engine.getLiving('B')[0];actor.skills.push('__rageCost');actor.energy=4;actor.stats.RAGE=1;
  assert.equal(engine.getLegalSkills(actor.id).some(s=>s.id==='__rageCost'),false);
  actor.stats.RAGE=3;
  assert.equal(engine.getLegalSkills(actor.id).some(s=>s.id==='__rageCost'),true);
  engine.useSkill({actorId:actor.id,skillId:'__rageCost',targetId:target.id});
  assert.equal(actor.energy,3);
  assert.equal(actor.stats.RAGE,1);
});

test('generic resource effects work for non-energy resources', () => {
  const NCB=load();
  NCB.SKILL_DEFS.__resource={id:'__resource',name:'Resource',kind:'support',target:'self',cost:0,effects:[{type:'resource',resource:'RAGE',amount:3}]};
  const engine=NCB.createBattle({seed:'gen5,76,77,78,79',teamA:['berserker'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0];actor.skills.push('__resource');actor.stats.RAGE=0;
  engine.useSkill({actorId:actor.id,skillId:'__resource',targetId:actor.id});
  assert.equal(actor.stats.RAGE,3);
});

test('on-hit follow-up effects do not fire when the preceding attack misses', () => {
  const NCB=load();
  NCB.SKILL_DEFS.__onHit={id:'__onHit',name:'On Hit',kind:'damage',target:'enemy',cost:0,accuracy:0,formula:'10',effects:[
    {type:'damage',canCrit:false},
    {type:'status',status:'slow',duration:2,condition:{type:'lastHit'}},
  ]};
  const engine=NCB.createBattle({seed:'gen5,81,82,83,84',teamA:['ranger'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0],target=engine.getLiving('B')[0];actor.skills.push('__onHit');
  engine.useSkill({actorId:actor.id,skillId:'__onHit',targetId:target.id});
  assert.ok(engine.log.some(x=>x.kind==='miss'));
  assert.equal(engine.hasStatus(target,'slow'),false);
});

test('on-hit follow-up effects can read committed hit context', () => {
  const NCB=load();
  NCB.SKILL_DEFS.__onHitSure={id:'__onHitSure',name:'On Hit Sure',kind:'damage',target:'enemy',cost:0,accuracy:1,formula:'10',effects:[
    {type:'damage',canMiss:false,canCrit:false},
    {type:'status',status:'slow',duration:2,condition:{type:'lastHit'}},
  ]};
  const engine=NCB.createBattle({seed:'gen5,84,85,86,87',teamA:['ranger'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0],target=engine.getLiving('B')[0];actor.skills.push('__onHitSure');
  engine.useSkill({actorId:actor.id,skillId:'__onHitSure',targetId:target.id});
  assert.equal(engine.hasStatus(target,'slow'),true);
});

test('nested effects can explicitly target the acting entity', () => {
  const NCB=load();
  const engine=NCB.createBattle({seed:'gen5,88,89,90,91',teamA:['duelist'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0],target=engine.getLiving('B')[0];actor.energy=4;
  NCB.SKILL_DEFS.riposte.effects[1].effectTarget='actor';
  engine.useSkill({actorId:actor.id,skillId:'riposte',targetId:target.id});
  assert.equal(engine.hasStatus(actor,'evasion'),true);
  assert.equal(engine.hasStatus(target,'evasion'),false);
});

test('unit reactive triggers fire even when the entity has no statuses', () => {
  const NCB = load();
  NCB.UNIT_DEFS.__reactor = {
    id:'__reactor',name:'Reactor',role:'test',description:'',
    stats:{MAX_HP:100,ATK:10,DEF:0,RES:0,SPD:50,CRIT:0,CRIT_DMG:150,PEN:0,ACC:100,EVA:0,ENERGY_MAX:3,ENERGY_REGEN:1,RAGE:0,RAGE_MAX:10,LIFESTEAL:0,HEAL_POWER:100},
    skills:['quick-cut'],
    triggers:[{event:'afterDamageTaken',target:'self',effects:[{type:'resource',resource:'RAGE',amount:2}]}]
  };
  const engine=NCB.createBattle({seed:'gen5,90,91,92,93',teamA:['__reactor'],teamB:['ranger']});
  const reactor=engine.getLiving('A')[0], attacker=engine.getLiving('B')[0];
  assert.equal(reactor.statuses.length,0);
  engine.applyDamage({sourceId:attacker.id,targetId:reactor.id,amount:10,tags:['test'],traceLabel:'test'});
  assert.equal(engine.getResource(reactor,'RAGE'),2);
});

test('status stacks can be consumed and exposed to following effects', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__hex={id:'__hex',name:'Hex',kind:'debuff',maxStacks:6,stacking:'stack'};
  NCB.SKILL_DEFS.__detonate={
    id:'__detonate',name:'Detonate',kind:'damage',target:'enemy',cost:0,cooldown:0,accuracy:1,formula:'0',
    effects:[
      {type:'consumeStatus',status:'__hex',stacks:'all'},
      {type:'damage',damageType:'true',formula:'CONSUMED_STACKS * 12',canMiss:false,canCrit:false}
    ]
  };
  const engine=NCB.createBattle({seed:'gen5,94,95,96,97',teamA:['ranger'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0],target=engine.getLiving('B')[0];actor.skills.push('__detonate');
  engine.applyStatus(target.id,'__hex',{duration:3,stacks:4,sourceId:actor.id});
  const before=target.hp;
  engine.useSkill({actorId:actor.id,skillId:'__detonate',targetId:target.id});
  assert.equal(engine.hasStatus(target,'__hex'),false);
  assert.equal(before-target.hp,48);
  assert.ok(engine.log.some(x=>x.kind==='consume'&&x.statusId==='__hex'&&x.stacks===4));
});

test('after-kill triggers can reward the killer through the generic trigger system', () => {
  const NCB=load();
  NCB.UNIT_DEFS.__reaper={
    id:'__reaper',name:'Reaper',role:'test',description:'',
    stats:{MAX_HP:100,ATK:200,DEF:0,RES:0,SPD:90,CRIT:0,CRIT_DMG:150,PEN:100,ACC:150,EVA:0,ENERGY_MAX:3,ENERGY_REGEN:1,SOUL:0,SOUL_MAX:10,LIFESTEAL:0,HEAL_POWER:100},
    skills:['quick-cut'],
    triggers:[{event:'afterKill',target:'self',effects:[{type:'resource',resource:'SOUL',amount:1}]}]
  };
  const engine=NCB.createBattle({seed:'gen5,98,99,100,101',teamA:['__reaper'],teamB:['assassin']});
  const killer=engine.getLiving('A')[0],victim=engine.getLiving('B')[0];victim.hp=1;
  engine.applyDamage({sourceId:killer.id,targetId:victim.id,amount:10,tags:['test'],traceLabel:'test'});
  assert.equal(engine.getResource(killer,'SOUL'),1);
});

test('healing emits generic after-heal triggers for source and target', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__gratitude={id:'__gratitude',name:'Gratitude',kind:'buff',maxStacks:1,stacking:'refresh',triggers:[{event:'afterHealTaken',target:'self',effects:[{type:'resource',resource:'ENERGY',amount:1}]}]};
  const engine=NCB.createBattle({seed:'gen5,102,103,104,105',teamA:['medic','vanguard'],teamB:['ranger']});
  const healer=engine.teams.A.entities[0],target=engine.teams.A.entities[1];target.hp-=50;target.energy=0;
  engine.applyStatus(target.id,'__gratitude',{duration:2,sourceId:target.id});
  engine.heal(healer.id,target.id,20,'test');
  assert.equal(target.energy,1);
});

test('resource conversion is atomic and supports arbitrary named resources', () => {
  const NCB=load();
  NCB.SKILL_DEFS.__convert={id:'__convert',name:'Convert',kind:'support',target:'self',cost:0,cooldown:0,effects:[{type:'convertResource',from:'RAGE',to:'ENERGY',amount:3,ratio:0.5}]};
  const engine=NCB.createBattle({seed:'gen5,106,107,108,109',teamA:['berserker'],teamB:['ranger']});
  const actor=engine.getLiving('A')[0];actor.skills.push('__convert');actor.stats.RAGE=4;actor.energy=0;
  engine.useSkill({actorId:actor.id,skillId:'__convert',targetId:actor.id});
  assert.equal(engine.getResource(actor,'RAGE'),1);
  assert.equal(engine.getResource(actor,'ENERGY'),1.5);
});

test('cleanse can filter removable statuses by tags instead of bespoke ids', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__curse={id:'__curse',name:'Curse',kind:'debuff',maxStacks:1,stacking:'refresh',tags:['curse']};
  const engine=NCB.createBattle({seed:'gen5,110,111,112,113',teamA:['medic','vanguard'],teamB:['ranger']});
  const source=engine.teams.A.entities[0],target=engine.teams.A.entities[1];
  engine.applyStatus(target.id,'__curse',{duration:3,sourceId:source.id});
  engine.applyStatus(target.id,'slow',{duration:3,sourceId:source.id});
  engine.resolveEffect(source,target,{id:'x',name:'x',formula:'0'},{type:'cleanse',count:3,tags:['curse']},{});
  assert.equal(engine.hasStatus(target,'__curse'),false);
  assert.equal(engine.hasStatus(target,'slow'),true);
});

test('skill requirements share the generic condition engine and hide illegal actions', () => {
  const NCB=load();
  NCB.SKILL_DEFS.__req={id:'__req',name:'Req',kind:'support',target:'self',cost:0,cooldown:0,requirements:{type:'resourceAtLeast',resource:'RAGE',value:3},effects:[{type:'resource',resource:'RAGE',amount:-3}]};
  const engine=NCB.createBattle({seed:'gen5,114,115,116,117',teamA:['berserker'],teamB:['ranger']});
  const actor=engine.getLiving('A')[0];actor.skills.push('__req');actor.stats.RAGE=2;
  assert.equal(engine.getLegalSkills(actor.id).some(s=>s.id==='__req'),false);
  actor.stats.RAGE=3;
  assert.equal(engine.getLegalSkills(actor.id).some(s=>s.id==='__req'),true);
});

test('generic tag requirements support brand/slay style target specialization', () => {
  const NCB=load();
  NCB.UNIT_DEFS.vanguard.tags=['armored','human'];
  const engine=NCB.createBattle({seed:'gen5,118,119,120,121',teamA:['ranger'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0],target=engine.getLiving('B')[0];
  assert.equal(NCB.conditionMatches({type:'targetTag',tag:'armored'},{battle:engine,source:actor,target}),true);
  assert.equal(NCB.conditionMatches({type:'targetTag',tag:'caster'},{battle:engine,source:actor,target}),false);
});

test('consumed stack count can drive conditional detonation branches', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__brand={id:'__brand',name:'Brand',kind:'debuff',maxStacks:5,stacking:'stack'};
  NCB.SKILL_DEFS.__pop={id:'__pop',name:'Pop',kind:'debuff',target:'enemy',cost:0,cooldown:0,effects:[{type:'consumeStatus',status:'__brand',stacks:'all'},{type:'conditional',condition:{type:'consumedStacksAtLeast',value:3},then:[{type:'status',status:'stun',duration:1}]}]};
  const engine=NCB.createBattle({seed:'gen5,122,123,124,125',teamA:['ranger'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0],target=engine.getLiving('B')[0];actor.skills.push('__pop');engine.applyStatus(target.id,'__brand',{stacks:3,duration:2,sourceId:actor.id});
  engine.useSkill({actorId:actor.id,skillId:'__pop',targetId:target.id});
  assert.equal(engine.hasStatus(target,'stun'),true);
});

test('hp resource costs are nonlethal by default', () => {
  const NCB=load();
  NCB.SKILL_DEFS.__blood={id:'__blood',name:'Blood',kind:'support',target:'self',cost:0,cooldown:0,costs:[{resource:'HP',amount:20}],effects:[{type:'shield',formula:'MAX_HP * 0.10'}]};
  const engine=NCB.createBattle({seed:'gen5,126,127,128,129',teamA:['berserker'],teamB:['ranger']});
  const actor=engine.getLiving('A')[0];actor.skills.push('__blood');actor.hp=20;
  assert.equal(engine.getLegalSkills(actor.id).some(s=>s.id==='__blood'),false);
  actor.hp=21;
  assert.equal(engine.getLegalSkills(actor.id).some(s=>s.id==='__blood'),true);
});

test('formula scope automatically exposes arbitrary actor and target stats/resources', () => {
  const NCB=load();
  const engine=NCB.createBattle({seed:'gen5,130,131,132,133',teamA:['chronomancer'],teamB:['reaper']});
  const actor=engine.getLiving('A')[0],target=engine.getLiving('B')[0];
  actor.stats.CHRONO=4;target.stats.SOUL=3;
  const scope=engine.scopeFor(actor,target);
  assert.equal(scope.CHRONO,4);
  assert.equal(scope.TARGET_SOUL,3);
  assert.equal(scope.ENERGY,actor.energy);
});

test('arbitrary resource regeneration is data-driven per unit definition', () => {
  const NCB=load();
  const engine=NCB.createBattle({seed:'gen5,134,135,136,137',teamA:['chronomancer'],teamB:['ranger']});
  const actor=engine.getLiving('A')[0];actor.stats.CHRONO=2;
  engine.processRoundStart(false);
  assert.equal(actor.stats.CHRONO,3);
});

test('status event modifiers can increase a skill hit count without bespoke skill code', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__flurry={id:'__flurry',name:'Flurry',kind:'buff',maxStacks:1,stacking:'refresh',eventModifiers:[{event:'ModifyHits',operation:'add',value:1}]};
  NCB.SKILL_DEFS.__tap={id:'__tap',name:'Tap',kind:'damage',target:'enemy',cost:0,cooldown:0,accuracy:1,formula:'10',damageType:'true',effects:[{type:'damage',canMiss:false,canCrit:false}]};
  const engine=NCB.createBattle({seed:'gen5,140,141,142,143',teamA:['ranger'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0],target=engine.getLiving('B')[0];actor.skills.push('__tap');
  engine.applyStatus(actor.id,'__flurry',{duration:2,sourceId:actor.id});
  const before=target.hp;
  engine.useSkill({actorId:actor.id,skillId:'__tap',targetId:target.id});
  assert.equal(before-target.hp,20);
});

test('status event modifiers can raise penetration through the shared combat pipeline', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__pierce={id:'__pierce',name:'Pierce',kind:'buff',maxStacks:1,stacking:'refresh',eventModifiers:[{event:'ModifyPenetration',operation:'add',value:50}]};
  NCB.SKILL_DEFS.__strike={id:'__strike',name:'Strike',kind:'damage',target:'enemy',cost:0,cooldown:0,accuracy:1,formula:'100',damageType:'physical',effects:[{type:'damage',canMiss:false,canCrit:false}]};
  const baseline=NCB.createBattle({seed:'gen5,144,145,146,147',teamA:['ranger'],teamB:['vanguard']});
  const a0=baseline.getLiving('A')[0],t0=baseline.getLiving('B')[0];a0.skills.push('__strike');const b=t0.hp;baseline.useSkill({actorId:a0.id,skillId:'__strike',targetId:t0.id});const normal=b-t0.hp;
  const boosted=NCB.createBattle({seed:'gen5,144,145,146,147',teamA:['ranger'],teamB:['vanguard']});
  const a1=boosted.getLiving('A')[0],t1=boosted.getLiving('B')[0];a1.skills.push('__strike');boosted.applyStatus(a1.id,'__pierce',{duration:2,sourceId:a1.id});const p=t1.hp;boosted.useSkill({actorId:a1.id,skillId:'__strike',targetId:t1.id});
  assert.ok(p-t1.hp>normal);
});

test('periodic statuses can snapshot formula magnitude at application time', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__snapshotDot={id:'__snapshotDot',name:'Snapshot DOT',kind:'debuff',maxStacks:1,stacking:'refresh',periodic:{timing:'turnEnd',snapshot:'apply',effects:[{type:'damage',damageType:'true',formula:'ATK * 0.82',canMiss:false,canCrit:false,canReflect:false}]}};
  const engine=NCB.createBattle({seed:'gen5,150,151,152,153',teamA:['ranger'],teamB:['vanguard']});
  const source=engine.getLiving('A')[0],target=engine.getLiving('B')[0];
  const initialAtk=engine.getStat(source.id,'ATK');
  engine.applyStatus(target.id,'__snapshotDot',{duration:2,sourceId:source.id});
  source.stats.ATK=200;
  const before=target.hp;
  engine.processTurnEnd();
  assert.equal(before-target.hp,Math.floor(initialAtk*0.82));
});

test('periodic statuses default to live formula evaluation', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__liveDot={id:'__liveDot',name:'Live DOT',kind:'debuff',maxStacks:1,stacking:'refresh',periodic:{timing:'turnEnd',effects:[{type:'damage',damageType:'true',formula:'ATK * 0.82',canMiss:false,canCrit:false,canReflect:false}]}};
  const engine=NCB.createBattle({seed:'gen5,154,155,156,157',teamA:['ranger'],teamB:['vanguard']});
  const source=engine.getLiving('A')[0],target=engine.getLiving('B')[0];
  engine.applyStatus(target.id,'__liveDot',{duration:2,sourceId:source.id});
  source.stats.ATK=200;
  const before=target.hp;
  engine.processTurnEnd();
  assert.equal(before-target.hp,164);
});

test('persistent statuses can be toggled on and off through the generic effect DSL', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__stance={id:'__stance',name:'Stance',kind:'buff',maxStacks:1,stacking:'refresh',duration:null,modifiers:[{stat:'ATK',operation:'multiply',value:1.2}]};
  NCB.SKILL_DEFS.__stanceSkill={id:'__stanceSkill',name:'Stance Skill',kind:'support',target:'self',cost:0,cooldown:0,effects:[{type:'toggleStatus',status:'__stance'}]};
  const engine=NCB.createBattle({seed:'gen5,160,161,162,163',teamA:['ranger'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0];actor.skills.push('__stanceSkill');const base=actor.stats.ATK;
  engine.useSkill({actorId:actor.id,skillId:'__stanceSkill',targetId:actor.id});
  assert.equal(engine.hasStatus(actor,'__stance'),true);
  assert.equal(engine.getStat(actor.id,'ATK'),base*1.2);
  engine.useSkill({actorId:actor.id,skillId:'__stanceSkill',targetId:actor.id});
  assert.equal(engine.hasStatus(actor,'__stance'),false);
});

test('sustain upkeep drains a named resource and automatically drops when it cannot be paid', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__channel={id:'__channel',name:'Channel',kind:'buff',maxStacks:1,stacking:'refresh',duration:null,upkeep:{resource:'ENERGY',amount:2,timing:'roundStart'},modifiers:[{stat:'RES',operation:'multiply',value:1.25}]};
  const engine=NCB.createBattle({seed:'gen5,164,165,166,167',teamA:['ranger'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0];actor.energy=1;actor.stats.ENERGY_REGEN=0;
  engine.applyStatus(actor.id,'__channel',{duration:null,sourceId:actor.id});
  engine.round++;engine.processRoundStart(false);
  assert.equal(engine.hasStatus(actor,'__channel'),false);
  assert.equal(actor.energy,1);
});

test('AI values a beneficial sustain when inactive but does not immediately toggle it off once active', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__sustainAi={id:'__sustainAi',name:'Sustain AI',kind:'buff',maxStacks:1,stacking:'refresh',duration:null,upkeep:{resource:'ENERGY',amount:1,timing:'roundStart'},modifiers:[{stat:'ATK',operation:'multiply',value:1.4}]};
  NCB.SKILL_DEFS.__sustainAiSkill={id:'__sustainAiSkill',name:'Sustain',kind:'support',target:'self',cost:0,cooldown:0,effects:[{type:'toggleStatus',status:'__sustainAi'}]};
  NCB.SKILL_DEFS.__smallHit={id:'__smallHit',name:'Small Hit',kind:'damage',target:'enemy',cost:0,cooldown:0,accuracy:1,formula:'10',damageType:'true',effects:[{type:'damage',canMiss:false,canCrit:false}]};
  const engine=NCB.createBattle({seed:'gen5,170,171,172,173',teamA:['ranger'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0];actor.skills=['__sustainAiSkill','__smallHit'];
  let action=NCB.planAI(engine,'A','hard').find(a=>a.actorId===actor.id);
  assert.equal(action.skillId,'__sustainAiSkill');
  engine.useSkill(action);
  assert.equal(engine.hasStatus(actor,'__sustainAi'),true);
  action=NCB.planAI(engine,'A','hard').find(a=>a.actorId===actor.id);
  assert.equal(action.skillId,'__smallHit');
});

test('built-in runeknight exposes a persistent upkeep stance as a real content choice', () => {
  const NCB=load();
  const unit=NCB.UNIT_DEFS.runeknight;
  assert.ok(unit.skills.includes('runic-guard'));
  const status=NCB.STATUS_DEFS['runic-guard'];
  assert.equal(status.duration,null);
  assert.equal(status.upkeep.resource,'ENERGY');
  const engine=NCB.createBattle({seed:'gen5,174,175,176,177',teamA:['runeknight'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0];actor.energy=5;
  engine.useSkill({actorId:actor.id,skillId:'runic-guard',targetId:actor.id});
  assert.equal(engine.hasStatus(actor,'runic-guard'),true);
  const defBefore=engine.getStat(actor.id,'DEF');
  engine.processTurnEnd();engine.round++;engine.processRoundStart(false);
  assert.equal(engine.hasStatus(actor,'runic-guard'),true);
  assert.ok(engine.getStat(actor.id,'DEF')>=defBefore);
});

test('typed wards absorb only matching damage before the generic shield and hp layers', () => {
  const NCB=load();
  const engine=NCB.createBattle({seed:'gen5,180,181,182,183',teamA:['pyromancer'],teamB:['vanguard']});
  const source=engine.getLiving('A')[0],target=engine.getLiving('B')[0];
  target.wards.fire=30; target.shield=10;
  const fire=engine.applyDamage({sourceId:source.id,targetId:target.id,amount:50,tags:['fire'],damageType:'fire',canReflect:false});
  assert.equal(fire.wardDamage,30);
  assert.equal(fire.shieldDamage,10);
  assert.equal(fire.hpDamage,10);
  assert.equal(target.wards.fire,0);
  target.wards.fire=25; target.shield=0; const before=target.hp;
  const physical=engine.applyDamage({sourceId:source.id,targetId:target.id,amount:20,tags:['physical'],damageType:'physical',canReflect:false});
  assert.equal(physical.wardDamage,0);
  assert.equal(target.wards.fire,25);
  assert.equal(before-target.hp,20);
});

test('ward effect creates a typed defensive pool through the generic effect DSL', () => {
  const NCB=load();
  NCB.SKILL_DEFS.__ward={id:'__ward',name:'Ward',kind:'support',target:'self',cost:0,cooldown:0,effects:[{type:'ward',damageType:'fire',formula:'40'}]};
  const engine=NCB.createBattle({seed:'gen5,184,185,186,187',teamA:['runeknight'],teamB:['pyromancer']});
  const actor=engine.getLiving('A')[0];actor.skills.push('__ward');
  engine.useSkill({actorId:actor.id,skillId:'__ward',targetId:actor.id});
  assert.equal(actor.wards.fire,40);
});

test('generic dispel can remove and steal an enemy buff without knowing its id', () => {
  const NCB=load();
  NCB.SKILL_DEFS.__steal={id:'__steal',name:'Steal',kind:'debuff',target:'enemy',cost:0,cooldown:0,effects:[{type:'dispel',kind:'buff',count:1,transfer:'actor'}]};
  const engine=NCB.createBattle({seed:'gen5,188,189,190,191',teamA:['oracle'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0],target=engine.getLiving('B')[0];actor.skills.push('__steal');
  engine.applyStatus(target.id,'fortified',{duration:3,sourceId:target.id});
  engine.useSkill({actorId:actor.id,skillId:'__steal',targetId:target.id});
  assert.equal(engine.hasStatus(target,'fortified'),false);
  assert.equal(engine.hasStatus(actor,'fortified'),true);
});

test('built-in runeknight ward skill uses typed fire and frost ward pools', () => {
  const NCB=load();
  const skill=NCB.SKILL_DEFS['null-ward'];
  assert.ok(skill.effects.some(e=>e.type==='ward'&&e.damageType==='fire'));
  assert.ok(skill.effects.some(e=>e.type==='ward'&&e.damageType==='frost'));
});

test('built-in oracle includes a buff-stealing counterplay skill', () => {
  const NCB=load();
  assert.ok(NCB.UNIT_DEFS.oracle.skills.includes('fate-theft'));
  const skill=NCB.SKILL_DEFS['fate-theft'];
  assert.ok(skill.effects.some(e=>e.type==='dispel'&&e.transfer==='actor'));
});

test('reactive triggers can target all allies through the generic trigger system', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__aura={id:'__aura',name:'Aura',kind:'buff',maxStacks:1,stacking:'refresh',duration:null,triggers:[{event:'roundStart',target:'all-allies',effects:[{type:'status',status:'focus',duration:1}]}]};
  const engine=NCB.createBattle({seed:'gen5,192,193,194,195',teamA:['templar','ranger'],teamB:['vanguard']});
  const source=engine.getLiving('A')[0];engine.applyStatus(source.id,'__aura',{duration:null,sourceId:source.id});
  engine.round++;engine.processRoundStart(false);
  assert.equal(engine.getLiving('A').every(e=>engine.hasStatus(e,'focus')),true);
});

test('built-in templar has a maintained team aura as a real sustain archetype', () => {
  const NCB=load();
  assert.ok(NCB.UNIT_DEFS.templar.skills.includes('radiant-aura'));
  const aura=NCB.STATUS_DEFS['radiant-aura'];
  assert.equal(aura.duration,null);
  assert.ok(aura.triggers.some(t=>t.event==='roundStart'&&t.target==='all-allies'));
});

test('numeric component catalog exposes at least fifty documented reusable knobs', () => {
  const NCB = load();
  const knobs = Object.values(NCB.PARAMETER_CATALOG || {});
  assert.ok(knobs.length >= 50, `expected >=50 knobs, got ${knobs.length}`);
  for (const knob of knobs) {
    assert.ok(knob.id);
    assert.ok(knob.name);
    assert.ok(knob.category);
    assert.ok(knob.human);
    assert.ok(knob.ai);
    assert.ok(knob.effect);
  }
});

test('every effect and condition used by bundled content is declared as a reusable component', () => {
  const NCB = load();
  const effectTypes = new Set();
  const conditionTypes = new Set();
  const scanCondition = c => {
    if (!c) return;
    if (Array.isArray(c)) return c.forEach(scanCondition);
    if (c.all) c.all.forEach(scanCondition);
    if (c.any) c.any.forEach(scanCondition);
    if (c.not) scanCondition(c.not);
    if (c.type) conditionTypes.add(c.type);
  };
  const scanEffects = effects => (effects || []).forEach(e => {
    effectTypes.add(e.type);
    scanCondition(e.condition);
    scanEffects(e.effects);
    scanEffects(e.then);
    scanEffects(e.else);
  });
  for (const skill of Object.values(NCB.SKILL_DEFS)) {
    scanCondition(skill.requirements);
    scanCondition(skill.targetRequirements);
    scanEffects(skill.effects);
  }
  for (const status of Object.values(NCB.STATUS_DEFS)) {
    for (const mod of status.modifiers || []) scanCondition(mod.condition);
    for (const mod of status.resistanceMods || []) scanCondition(mod.condition);
    for (const mod of status.eventModifiers || []) scanCondition(mod.condition);
    for (const trigger of status.triggers || []) { scanCondition(trigger.condition); scanEffects(trigger.effects); }
    scanEffects(status.periodic?.effects);
  }
  for (const unit of Object.values(NCB.UNIT_DEFS)) {
    for (const passive of unit.passives || []) scanCondition(passive.condition);
    for (const trigger of unit.triggers || []) { scanCondition(trigger.condition); scanEffects(trigger.effects); }
  }
  for (const type of effectTypes) assert.ok(NCB.EFFECT_COMPONENTS[type], `missing effect component ${type}`);
  for (const type of conditionTypes) assert.ok(NCB.CONDITION_COMPONENTS[type], `missing condition component ${type}`);
});

test('condition system is plugin-extensible without editing the matcher', () => {
  const NCB = load();
  NCB.registerConditionComponent('__above_magic_number', {
    name:'测试条件', human:'测试', ai:'测试', fields:['value'],
    test:(condition,ctx)=>Number(ctx.magic || 0) > Number(condition.value || 0),
  });
  assert.equal(NCB.conditionMatches({type:'__above_magic_number',value:3},{magic:4}), true);
  assert.equal(NCB.conditionMatches({type:'__above_magic_number',value:3},{magic:2}), false);
});

test('target selection is plugin-extensible without editing BattleEngine', () => {
  const NCB = load();
  NCB.registerTargetComponent('__lowest_enemy', {
    name:'最低血敌人', human:'选择最低生命敌人', ai:'lowest hp enemy',
    select:({battle,actor})=>battle.getLiving(battle.enemyTeam(actor.teamId)).sort((a,b)=>a.hp-b.hp).slice(0,1),
  });
  NCB.SKILL_DEFS.__target_plugin={id:'__target_plugin',name:'Target Plugin',kind:'support',target:'__lowest_enemy',cost:0,cooldown:0,priority:0,effects:[]};
  const engine=NCB.createBattle({seed:'gen5,2,4,6,8',teamA:['ranger'],teamB:['vanguard','duelist']});
  engine.getLiving('B')[1].hp=5;
  assert.equal(engine.getValidTargets(engine.getLiving('A')[0].id,'__target_plugin')[0].id,engine.getLiving('B')[1].id);
  delete NCB.SKILL_DEFS.__target_plugin;
});

test('effect execution accepts external plugins without adding another engine branch', () => {
  const NCB=load();
  NCB.registerEffectComponent('__grant_magic', {
    name:'测试效果',human:'测试',ai:'test',fields:['amount'],
    resolve:({engine,target,effect})=>engine.changeResource(target,'MAGIC',Number(effect.amount||0)),
  });
  const engine=NCB.createBattle({seed:'gen5,3,5,7,9',teamA:['ranger'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0];
  actor.stats.MAGIC=0; actor.stats.MAGIC_MAX=10;
  engine.resolveEffect(actor,actor,{id:'__x',name:'X',formula:'0'}, {type:'__grant_magic',amount:4}, {});
  assert.equal(engine.getResource(actor,'MAGIC'),4);
});

test('damage taxonomy accepts new registered types without changing damage code', () => {
  const NCB=load();
  NCB.registerDamageType('void',{name:'虚空',defenseStat:'RES'});
  const engine=NCB.createBattle({seed:'gen5,4,6,8,10',teamA:['ranger'],teamB:['vanguard']});
  const a=engine.getLiving('A')[0],b=engine.getLiving('B')[0];
  b.resistances.void=.25;
  const p=engine.previewDamageComponent(a.id,b.id,{type:'void',amount:100,penetration:1});
  assert.equal(p.type,'void');
  assert.equal(p.resistance,.25);
});

test('one plugin manifest can add reusable parameters, conditions, targets, effects and events', () => {
  const NCB=load();
  NCB.registerCombatPlugin({
    id:'test-plugin',version:'1.0.0',apiVersion:1,
    parameters:[{id:'PLUGIN_POWER',name:'插件强度',category:'插件',kind:'number',unit:'point',defaultValue:0,range:'0–100',human:'测试插件参数',ai:'plugin power',effect:'测试'}],
    conditions:{pluginFlag:{name:'插件条件',human:'测试',ai:'test',test:(_c,ctx)=>ctx.PLUGIN_FLAG===true}},
    targets:{pluginSelf:{name:'插件自身',human:'测试',ai:'test',select:({actor})=>[actor]}},
    effects:{pluginGain:{name:'插件资源',human:'测试',ai:'test',resolve:({engine,target,effect})=>engine.changeResource(target,'PLUGIN',effect.amount||1)}},
    events:{PluginEvent:{name:'插件事件',human:'测试',ai:'test'}},
  });
  assert.ok(NCB.PARAMETER_CATALOG.PLUGIN_POWER);
  assert.equal(NCB.conditionMatches({type:'pluginFlag'},{PLUGIN_FLAG:true}),true);
  assert.ok(NCB.TARGET_COMPONENTS.pluginSelf);
  assert.ok(NCB.EFFECT_COMPONENTS.pluginGain);
  assert.ok(NCB.EVENT_COMPONENTS.PluginEvent);
});

test('content validator treats the component registries as the schema source of truth', () => {
  const NCB=load();
  const ok=NCB.validateContentPack({units:NCB.UNIT_DEFS,skills:NCB.SKILL_DEFS,statuses:NCB.STATUS_DEFS});
  assert.deepEqual(ok.errors,[]);
  const bad=NCB.deepClone({units:NCB.UNIT_DEFS,skills:NCB.SKILL_DEFS,statuses:NCB.STATUS_DEFS});
  bad.skills.__bad={id:'__bad',name:'Bad',kind:'damage',target:'does-not-exist',damageType:'does-not-exist',effects:[{type:'does-not-exist'}]};
  bad.units.vanguard.skills.push('__bad');
  const result=NCB.validateContentPack(bad);
  assert.ok(result.errors.some(x=>x.includes('target')));
  assert.ok(result.errors.some(x=>x.includes('damageType')));
  assert.ok(result.errors.some(x=>x.includes('effect')));
});

test('content validator rejects invalid formulas modifier operations and event hooks before battle start', () => {
  const NCB=load();
  const bad=NCB.deepClone({units:NCB.UNIT_DEFS,skills:NCB.SKILL_DEFS,statuses:NCB.STATUS_DEFS});
  bad.skills['shield-bash'].formula='UNKNOWN_COMBAT_VALUE * 2';
  bad.statuses.fortified.modifiers[0].operation='invented-operation';
  bad.statuses.precision.eventModifiers[0].event='InventedEvent';
  const result=NCB.validateContentPack(bad);
  assert.ok(result.errors.some(x=>x.includes('UNKNOWN_COMBAT_VALUE')), result.errors.join('\n'));
  assert.ok(result.errors.some(x=>x.includes('invented-operation')), result.errors.join('\n'));
  assert.ok(result.errors.some(x=>x.includes('InventedEvent')), result.errors.join('\n'));
});

test('content validator accepts dynamic stats resources status tags and query targets in formulas', () => {
  const NCB=load();
  const pack=NCB.deepClone({units:NCB.UNIT_DEFS,skills:NCB.SKILL_DEFS,statuses:NCB.STATUS_DEFS});
  pack.units.vanguard.stats.MOMENTUM=7;
  pack.statuses.__marked={id:'__marked',name:'Marked',kind:'debuff',maxStacks:2,tags:['mark']};
  pack.skills.__query={id:'__query',name:'Query',kind:'damage',target:'query',targetQuery:{relation:'enemy',where:{type:'targetStatusTag',tag:'mark'},sortBy:{kind:'stat',key:'DEF'},order:'desc',limit:2,mode:'all'},formula:'MOMENTUM + TARGET_DEF + TARGET_STATUS_MARK * 3',damageType:'true',effects:[{type:'damage'}]};
  pack.units.vanguard.skills.push('__query');
  const result=NCB.validateContentPack(pack);
  assert.deepEqual(result.errors,[],result.errors.join('\n'));
});

test('enemy target priority reads a generic guard flag instead of a hardcoded status id', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__bodyguard={id:'__bodyguard',name:'Bodyguard',kind:'buff',maxStacks:1,flags:{guard:true}};
  const engine=NCB.createBattle({seed:'gen5,5,7,9,11',teamA:['ranger'],teamB:['vanguard','duelist']});
  const protectedUnit=engine.getLiving('B')[1];
  engine.applyStatus(protectedUnit.id,'__bodyguard',{duration:2});
  const targets=engine.getValidTargets(engine.getLiving('A')[0].id,'piercing-shot');
  assert.deepEqual(targets.map(x=>x.id),[protectedUnit.id]);
});

test('formula scope exposes status tags generically instead of naming specific statuses', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__chill={id:'__chill',name:'Chill',kind:'debuff',maxStacks:3,tags:['slow','ice-mark']};
  const engine=NCB.createBattle({seed:'gen5,6,8,10,12',teamA:['frostbinder'],teamB:['vanguard']});
  const actor=engine.getLiving('A')[0],target=engine.getLiving('B')[0];
  engine.applyStatus(target.id,'__chill',{duration:2,stacks:2});
  const scope=engine.scopeFor(actor,target);
  assert.equal(scope.TARGET_STATUS_SLOW,2);
  assert.equal(scope.TARGET_STATUS_ICE_MARK,2);
  assert.equal(scope.TARGET_STATUS___CHILL,2);
});

test('all built-in effect primitives are executable registry components rather than BattleEngine branches', () => {
  const NCB=load();
  const builtins=['damage','heal','shield','ward','status','toggleStatus','consumeStatus','cleanse','dispel','resource','gain','energy','convertResource','cooldownReduce','selfDamagePct','conditional','repeat'];
  for(const id of builtins) assert.equal(typeof NCB.EFFECT_COMPONENTS[id]?.resolve,'function',`${id} must own its resolver`);
  const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../src/engine.js'),'utf8');
  assert.doesNotMatch(source,/if\s*\(effect\.type\s*===\s*['"](?:damage|heal|shield|ward|status|toggleStatus|consumeStatus|cleanse|dispel|resource|gain|energy|convertResource|cooldownReduce|selfDamagePct|conditional|repeat)['"]\)/);
});

test('event modifiers can programmatically alter resource cost and resource gain', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__economy={id:'__economy',name:'Economy',kind:'buff',maxStacks:1,stacking:'refresh',eventModifiers:[
    {event:'ModifyResourceCost',operation:'multiply',value:.5,condition:{type:'resourceIs',resource:'ENERGY'}},
    {event:'ModifyResourceGain',operation:'multiply',value:2,condition:{type:'resourceIs',resource:'CHRONO'}},
  ]};
  NCB.SKILL_DEFS.__costly={id:'__costly',name:'Costly',kind:'support',target:'self',cost:4,cooldown:0,effects:[{type:'gain',resource:'CHRONO',amount:1}]};
  const engine=NCB.createBattle({seed:'gen5,201,202,203,204',teamA:['chronomancer'],teamB:['ranger']});
  const actor=engine.getLiving('A')[0]; actor.skills.push('__costly'); actor.energy=2; actor.stats.CHRONO=0;
  engine.applyStatus(actor.id,'__economy',{duration:2,ignoreImmunity:true});
  assert.equal(engine.getLegalSkills(actor.id).some(s=>s.id==='__costly'),true);
  engine.useSkill({actorId:actor.id,skillId:'__costly',targetId:actor.id});
  assert.equal(actor.energy,0);
  assert.equal(actor.stats.CHRONO,2);
});

test('event modifiers can alter heal shield ward resistance cooldown and action priority', () => {
  const NCB=load();
  NCB.STATUS_DEFS.__relay={id:'__relay',name:'Relay',kind:'buff',maxStacks:1,stacking:'refresh',eventModifiers:[
    {event:'ModifyHealTaken',operation:'multiply',value:.5},
    {event:'ModifyShield',operation:'multiply',value:2},
    {event:'ModifyWard',operation:'multiply',value:1.5},
    {event:'ModifyResistance',operation:'add',value:.2,condition:{type:'damageType',damageType:'fire'}},
    {event:'ModifyCooldown',operation:'add',value:-1},
    {event:'ModifyPriority',operation:'add',value:3},
  ]};
  NCB.SKILL_DEFS.__utility={id:'__utility',name:'Utility',kind:'support',target:'self',cost:0,cooldown:3,priority:0,effects:[{type:'shield',amount:10},{type:'ward',damageType:'fire',amount:10}]};
  const engine=NCB.createBattle({seed:'gen5,205,206,207,208',teamA:['medic'],teamB:['ranger']});
  const actor=engine.getLiving('A')[0],enemy=engine.getLiving('B')[0]; actor.skills.push('__utility'); actor.stats.SPD=1; actor.stats.HEAL_POWER=100; enemy.stats.SPD=999;
  engine.applyStatus(actor.id,'__relay',{duration:2,ignoreImmunity:true});
  actor.hp=50; const healed=engine.heal(actor.id,actor.id,40,'test'); assert.equal(healed,20);
  engine.useSkill({actorId:actor.id,skillId:'__utility',targetId:actor.id});
  assert.equal(actor.shield,20); assert.equal(actor.wards.fire,15); assert.equal(actor.cooldowns.__utility,3); // stored value includes +1 round bookkeeping after event-adjusted cooldown 2
  assert.ok(engine.getResistance(actor.id,'fire')>=.2);
  const actions=[{actorId:actor.id,skillId:actor.skills[0],targetId:enemy.id},{actorId:enemy.id,skillId:enemy.skills[0],targetId:actor.id}];
  const normalized=engine.orderActions(actions);
  assert.equal(normalized[0].actorId,actor.id);
});

test('query target component composes relation filters sorting limits and automatic selection', () => {
  const NCB=load();
  NCB.SKILL_DEFS.__execute_low={id:'__execute_low',name:'Execute Low',kind:'damage',target:'query',targetQuery:{relation:'enemy',where:{type:'targetHpPctBelow',value:.8},sortBy:{kind:'hpPct'},order:'asc',limit:1,mode:'first'},cost:0,accuracy:1,formula:'10',damageType:'true',effects:[{type:'damage',canMiss:false,canCrit:false}]};
  const engine=NCB.createBattle({seed:'gen5,210,211,212,213',teamA:['ranger'],teamB:['vanguard','duelist','berserker']});
  const actor=engine.getLiving('A')[0],foes=engine.getLiving('B'); actor.skills.push('__execute_low');
  foes[0].hp=150; foes[1].hp=20; foes[2].hp=100;
  const targets=engine.getValidTargets(actor.id,'__execute_low');
  assert.deepEqual(targets.map(x=>x.id),[foes[1].id]);
});

test('query target mode can apply one component program to every matching ally', () => {
  const NCB=load();
  NCB.SKILL_DEFS.__aid_damaged={id:'__aid_damaged',name:'Aid Damaged',kind:'support',target:'query',targetQuery:{relation:'ally',where:{type:'targetHpPctBelow',value:.8},mode:'all'},cost:0,effects:[{type:'shield',amount:7}]};
  const engine=NCB.createBattle({seed:'gen5,214,215,216,217',teamA:['ranger','medic','vanguard'],teamB:['duelist']});
  const actor=engine.getLiving('A')[0],allies=engine.getLiving('A'); actor.skills.push('__aid_damaged');
  allies[1].hp-=50; allies[2].hp-=60;
  engine.useSkill({actorId:actor.id,skillId:'__aid_damaged',targetId:allies[1].id});
  assert.equal(allies[0].shield,0); assert.equal(allies[1].shield,7); assert.equal(allies[2].shield,7);
});

test('modifier programs share one deterministic SET ADD MULTIPLY CAP band', () => {
  const NCB=load();
  const entries=[
    {stableKey:'z',stacks:1,mod:{operation:'max',value:100}},
    {stableKey:'b',stacks:1,mod:{operation:'multiply',value:2}},
    {stableKey:'a',stacks:1,mod:{operation:'add',value:10}},
    {stableKey:'s',stacks:1,mod:{operation:'set',value:40}},
  ];
  const result=NCB.applyModifierBand(5,entries,{});
  assert.equal(result,100); // set 40 -> add 10 -> x2 -> floor-at-least 100
  assert.equal(NCB.applyModifierBand(5,entries.slice().reverse(),{}),100);
});

test('modifier values can be formulas and custom modifier operations are plugin-extensible', () => {
  const NCB=load();
  const engine=NCB.createBattle({seed:'gen5,220,221,222,223',teamA:['vanguard'],teamB:['duelist']});
  const actor=engine.getLiving('A')[0];
  const result=NCB.applyModifierBand(10,[{stableKey:'f',stacks:1,mod:{operation:'add',formula:'MAX_HP * 0.10'}}],{battle:engine,source:actor,target:actor});
  assert.equal(result,29); // vanguard MAX_HP=190
  NCB.registerModifierOperation('doubleAdd',{phase:'ADD',apply:({current,value})=>Number(current)+Number(value)*2});
  assert.equal(NCB.applyModifierOperation(10,{operation:'doubleAdd',value:3},{stacks:1}),16);
});

test('damage variance is a deterministic reusable skill knob', () => {
  const NCB=load();
  NCB.SKILL_DEFS.__variance={id:'__variance',name:'Variance',kind:'damage',target:'enemy',cost:0,cooldown:0,priority:0,accuracy:1,damageType:'true',formula:'100',varianceMin:.8,varianceMax:1.2,effects:[{type:'damage',canCrit:false}]};
  NCB.UNIT_DEFS.duelist.skills.push('__variance');
  const run=()=>{const e=NCB.createBattle({seed:'gen5,31,41,59,26',teamA:['duelist'],teamB:['vanguard']});const a=e.getLiving('A')[0],b=e.getLiving('B')[0];e.useSkill({actorId:a.id,skillId:'__variance',targetId:b.id});return b.maxHp-b.hp;};
  const a=run(),b=run();assert.equal(a,b);assert.ok(a>=80&&a<=120,a);assert.notEqual(a,100,'variance knob must actually affect damage for this seed');
  NCB.UNIT_DEFS.duelist.skills.pop();delete NCB.SKILL_DEFS.__variance;
});

test('skill drain and recoil are generic ratios based on committed hp damage', () => {
  const NCB=load();
  NCB.SKILL_DEFS.__drain={id:'__drain',name:'Drain',kind:'damage',target:'enemy',cost:0,cooldown:0,priority:0,accuracy:1,damageType:'true',formula:'80',drainRatio:.5,recoilRatio:.25,effects:[{type:'damage',canCrit:false}]};
  NCB.UNIT_DEFS.duelist.skills.push('__drain');
  const e=NCB.createBattle({seed:'gen5,2,7,1,8',teamA:['duelist'],teamB:['vanguard']});const a=e.getLiving('A')[0],b=e.getLiving('B')[0];a.stats.LIFESTEAL=0;a.hp=Math.max(1,a.maxHp-100);const before=a.hp;e.useSkill({actorId:a.id,skillId:'__drain',targetId:b.id});
  // 80 hp damage => +40 drain then -20 recoil, before clamping.
  assert.equal(a.hp,before+20);
  NCB.UNIT_DEFS.duelist.skills.pop();delete NCB.SKILL_DEFS.__drain;
});

test('damage components can ignore defense resistance and choose a defense stat without engine special cases', () => {
  const NCB=load();const e=NCB.createBattle({seed:'gen5,1,4,1,4',teamA:['duelist'],teamB:['vanguard']});const a=e.getLiving('A')[0],b=e.getLiving('B')[0];b.resistances.physical=.5;
  const normal=e.previewDamageComponent(a.id,b.id,{type:'physical',amount:100,penetration:0});
  const ignored=e.previewDamageComponent(a.id,b.id,{type:'physical',amount:100,ignoreDefense:true,ignoreResistance:true});
  const resDefense=e.previewDamageComponent(a.id,b.id,{type:'physical',amount:100,defenseStat:'RES',ignoreResistance:true});
  assert.ok(ignored.finalDamage>normal.finalDamage);assert.equal(ignored.finalDamage,100);assert.notEqual(resDefense.defense,normal.defense);
});

test('trigger event names are registry-validated instead of free-form hidden strings', () => {
  const NCB=load();const bad=NCB.deepClone({units:NCB.UNIT_DEFS,skills:NCB.SKILL_DEFS,statuses:NCB.STATUS_DEFS});
  bad.statuses.fortified.triggers=[{event:'not-a-real-event',target:'self',effects:[{type:'resource',resource:'ENERGY',amount:1}]}];
  const result=NCB.validateContentPack(bad);assert.ok(result.errors.some(x=>x.includes('not-a-real-event')),result.errors.join('\n'));
});

test('generic emitEvent effect lets content and plugins compose new trigger programs', () => {
  const NCB=load();
  NCB.registerEventComponent('TestPulse',{name:'测试脉冲',kind:'trigger'});
  NCB.STATUS_DEFS.__listener={id:'__listener',name:'Listener',kind:'buff',maxStacks:1,triggers:[{event:'TestPulse',target:'self',effects:[{type:'resource',resource:'ENERGY',amount:2}]}]};
  NCB.SKILL_DEFS.__emit={id:'__emit',name:'Emit',kind:'support',target:'self',cost:0,cooldown:0,effects:[{type:'emitEvent',event:'TestPulse',tags:['test-pulse']}]};
  NCB.UNIT_DEFS.vanguard.skills.push('__emit');const e=NCB.createBattle({seed:'gen5,8,6,7,5',teamA:['vanguard'],teamB:['duelist']});const a=e.getLiving('A')[0];e.applyStatus(a.id,'__listener',{duration:2});a.energy=0;e.useSkill({actorId:a.id,skillId:'__emit',targetId:a.id});assert.equal(a.energy,2);
  NCB.UNIT_DEFS.vanguard.skills.pop();delete NCB.SKILL_DEFS.__emit;delete NCB.STATUS_DEFS.__listener;
});
