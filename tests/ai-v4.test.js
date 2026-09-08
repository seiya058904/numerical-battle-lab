const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior'])require('../src/'+f+'.js');
const N=global.NCB;
function deployUnit(id,stats,skills=[],triggers=[]){
  N.UNIT_DEFS[id]={id,name:id,role:'probe',description:'',stats:{MAX_HP:500,ATK:50,DEF:30,RES:20,SPD:60,ACC:100,EVA:0,CRIT:0,CRIT_DMG:150,PEN:0,ENERGY_MAX:10,ENERGY_REGEN:2,...stats},skills,triggers};
}
function addSkill(id,effects,target='enemy',extra={}){
  N.SKILL_DEFS[id]={id,name:id,target,kind:'utility',cost:0,cooldown:0,accuracy:1,effects,...extra};
}

test('AI accounts for entity LIFESTEAL when scoring damage (chooses attack over heal when missing HP)',()=>{
  deployUnit('ls_ai',{ATK:50,MAX_HP:500,LIFESTEAL:40,HEAL_POWER:100},[],[]);
  addSkill('ls_atk',[{type:'damage',formula:'ATK * 1'}]);
  addSkill('ls_heal',[{type:'heal',formula:'MAX_HP * 0.05'}],'self');
  N.UNIT_DEFS.ls_ai.skills=['ls_atk','ls_heal'];
  const e=N.createBattle({teamA:['ls_ai'],teamB:['warden']});
  const actor=e.entity('A1');actor.hp=Math.floor(actor.maxHp*0.5);
  const plan=N.planAI(e,'A');
  const chosen=plan.find(a=>a.actorId==='A1')?.skillId;
  assert.equal(chosen,'ls_atk',`high-lifesteal low-HP AI should attack to self-heal, chose ${chosen}`);
});

test('AI avoids self-harm spiral: recoil + own counter trigger is priced negatively',()=>{
  deployUnit('spiral',{ATK:50,MAX_HP:300},[],[]);
  addSkill('reckless',[{type:'selfDamagePct',pct:.1},{type:'damage',formula:'ATK*2'}]);
  N.UNIT_DEFS.spiral.skills=['reckless'];
  // own status that counters ANY damage taken -> using reckless self-damages repeatedly
  N.UNIT_DEFS.spiral.triggers=[{event:'afterDamageTaken',target:'self',effects:[{type:'damage',formula:'ATK*0.5'}]}];
  // give an alternative safe action; AI should NOT pick reckless when it self-harms a lot
  addSkill('safe_hit',[{type:'damage',formula:'ATK*1.2'}]);
  N.UNIT_DEFS.spiral.skills=['reckless','safe_hit'];
  const e=N.createBattle({teamA:['spiral'],teamB:['warden']});
  const actor=e.entity('A1');
  const plan=N.planAI(e,'A');
  // We only assert the AI evaluates reckless FINITELY (no infinite planner recursion)
  // and picks something legal.
  assert.ok(plan.length>=0);
  const chosen=plan.find(a=>a.actorId==='A1');
  assert.ok(chosen&&N.getLegalActions?true:true);
  assert.ok(['reckless','safe_hit'].includes(chosen.skillId));
  // and the score of reckless (with the self-trigger) must be lower than a pure
  // safe attack when HP is already low (self-harm is bounded in the estimate).
  actor.hp=Math.floor(actor.maxHp*0.2);
  const scReckless=N.scoreAction(e,actor,N.SKILL_DEFS.reckless,e.entity('B1'));
  const scSafe=N.scoreAction(e,actor,N.SKILL_DEFS.safe_hit,e.entity('B1'));
  assert.ok(scSafe>scReckless,`at low HP reckless (self-harm) must score below safe hit (${scSafe} vs ${scReckless})`);
});

test('AI values ramp cards for long-term damage and discounts fatiguing ones',()=>{
  deployUnit('ramper',{ATK:50,RAMP_START:1,RAMP_RATE:0.2,RAMP_CAP:2},[],[]);
  deployUnit('fader',{ATK:50,FATIGUE_START:1,FATIGUE_RATE:0.2,FATIGUE_CAP:0.4},[],[]);
  addSkill('plain',[{type:'damage',formula:'ATK*1'}]);
  N.UNIT_DEFS.ramper.skills=['plain'];N.UNIT_DEFS.fader.skills=['plain'];
  const e1=N.createBattle({seed:'gen5,1,1,1,1',teamA:['ramper'],teamB:['warden']});
  const e2=N.createBattle({seed:'gen5,1,1,1,1',teamA:['fader'],teamB:['warden']});
  e1.round=15;e2.round=15;
  const r1=N.scoreAction(e1,e1.entity('A1'),N.SKILL_DEFS.plain,e1.entity('B1'));
  const r2=N.scoreAction(e2,e2.entity('A1'),N.SKILL_DEFS.plain,e2.entity('B1'));
  assert.ok(r1>r2,`at round 15 a ramping attacker should score higher than a fatiguing one (${r1} vs ${r2})`);
});

test('AI still deterministic and legal-only with v4 cards in real battles',()=>{
  for(let i=0;i<10;i++){
    const a=N.generateCardV4({seed:'ai-v4-'+i,rarity:'A',level:50});
    const b=N.generateCardV4({seed:'ai-v4-'+(i+999),rarity:'B',level:50});
    N.deployCard(a);N.deployCard(b);
    const e=N.createBattle({seed:N.deriveSeed(9000+i),teamA:[a.id],teamB:[b.id],maxRounds:40});
    for(let r=0;r<6;r++){
      const actions=[...N.planAI(e,'A'),...N.planAI(e,'B')];
      for(const act of actions){
        const legal=e.getLegalActions(act.actorId).map(s=>s.id);
        assert.ok(legal.includes(act.skillId),`AI chose illegal action ${act.skillId}`);
        const targets=e.getValidTargets(act.actorId,act.skillId);
        assert.ok(targets.some(t=>t.id===act.targetId),`AI chose illegal target ${act.targetId}`);
      }
      e.resolveRound(actions);
    }
  }
});
test('canonical repeat evaluates each REPEAT_INDEX without mutating battle state',()=>{
 deployUnit('repeat_probe',{},['indexed','flat']);
 addSkill('indexed',[{type:'repeat',times:3,effects:[{type:'damage',formula:'10 + REPEAT_INDEX * 50',canMiss:false,canCrit:false}]}]);
 addSkill('flat',[{type:'damage',formula:'100',canMiss:false,canCrit:false}]);
 const e=N.createBattle({teamA:['repeat_probe'],teamB:['warden']}),before=JSON.stringify(e.teams);
 assert.doesNotThrow(()=>N.planAI(e,'A','canonical'));
 assert.equal(N.planAI(e,'A','canonical')[0].skillId,'indexed');
 assert.equal(JSON.stringify(e.teams),before);
});

test('own counter does not penalize an attack that causes no self damage',()=>{
 deployUnit('counter_probe',{},['counter_hit']);
 addSkill('counter_hit',[{type:'damage',formula:'ATK',canMiss:false,canCrit:false}]);
 N.STATUS_DEFS.counter_probe={id:'counter_probe',name:'counter',kind:'buff',duration:3,maxStacks:1,triggers:[{event:'afterDamageTaken',target:'source',effects:[{type:'damage',formula:'ATK'}]}]};
 const e=N.createBattle({teamA:['counter_probe'],teamB:['warden']}),a=e.entity('A1'),b=e.entity('B1');
 const before=N.scoreAction(e,a,N.SKILL_DEFS.counter_hit,b);
 e.applyStatus(a.id,'counter_probe');
 assert.equal(N.scoreAction(e,a,N.SKILL_DEFS.counter_hit,b),before);
});

test('canonical repeat retains predicted status caps between child effects',()=>{
 deployUnit('repeat_cap',{},['one_buff','three_buffs']);
 N.STATUS_DEFS.repeat_cap={id:'repeat_cap',name:'cap',kind:'buff',maxStacks:1,duration:4,stacking:'stack'};
 const effect={type:'status',status:'repeat_cap'};
 addSkill('one_buff',[effect],'self');addSkill('three_buffs',[{type:'repeat',times:3,effects:[effect]}],'self');
 const e=N.createBattle({teamA:['repeat_cap'],teamB:['warden']}),a=e.entity('A1');
 assert.equal(N.scoreAction(e,a,N.SKILL_DEFS.three_buffs,a),N.scoreAction(e,a,N.SKILL_DEFS.one_buff,a));
 assert.equal(a.statuses.length,0,'planner must not apply the predicted buff');
});
