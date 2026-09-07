const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4'])require('../src/'+f+'.js');
const N=global.NCB;
// Minimal deployable units for engine probes (v4-shaped, but hand-set params).
function deployUnit(id,stats,skills=[],triggers=[]){
  const unit={id,name:id,role:'probe',description:'probe',stats:{MAX_HP:500,ATK:50,DEF:30,RES:20,SPD:60,ACC:100,EVA:0,CRIT:0,CRIT_DMG:150,PEN:0,ENERGY_MAX:10,ENERGY_REGEN:2,...stats},skills,triggers};
  N.UNIT_DEFS[id]=unit;
  return id;
}
function addSkill(id,effects,target='enemy',extra={}){
  N.SKILL_DEFS[id]={id,name:id,target,kind:'utility',cost:0,cooldown:0,accuracy:1,effects,...extra};
  return id;
}

test('ROUND and BATTLE_TURN are readable in formulas and scale with battle progress',()=>{
  deployUnit('round_probe',{},[],[]);
  addSkill('round_hit',[{type:'damage',formula:'ROUND * 10 + BATTLE_TURN * 1'}]);
  const e=N.createBattle({teamA:['round_probe'],teamB:['round_probe'],maxRounds:10});
  e.round=1;
  const v1=N.evaluateExpression('ROUND*10+BATTLE_TURN*1',e.scopeFor(e.entity('A1'),e.entity('B1')));
  assert.equal(v1,11);
  e.round=7;
  const v7=N.evaluateExpression('ROUND*10+BATTLE_TURN*1',e.scopeFor(e.entity('A1'),e.entity('B1')));
  assert.equal(v7,77);
});

test('VOLATILITY widens damage variance; LUCK biases the distribution; same battle seed reproduces exactly',()=>{
  deployUnit('vol_low',{ATK:100,VOLATILITY:1,LUCK:0},[],[]);
  deployUnit('vol_high',{ATK:100,VOLATILITY:3,LUCK:0},[],[]);
  addSkill('vol_hit',[{type:'damage',formula:'ATK',varianceMin:0.9,varianceMax:1.1}]);
  // many different battle seeds -> high volatility card shows a wider observed range
  function observedRange(unitId,battles){
    let lo=Infinity,hi=-Infinity;
    for(let i=0;i<battles;i++){
      const e=N.createBattle({seed:N.deriveSeed(1000+i),teamA:[unitId],teamB:['vol_probe_def']});
      const r=e.computeDamage(e.entity('A1'),e.entity('B1'),N.SKILL_DEFS.vol_hit,N.SKILL_DEFS.vol_hit.effects[0]);
      if(!r.miss){lo=Math.min(lo,r.damage);hi=Math.max(hi,r.damage);}
    }
    return hi-lo;
  }
  deployUnit('vol_probe_def',{ATK:10,DEF:0,RES:0},[],[]);
  const loSpread=observedRange('vol_low',300);
  const hiSpread=observedRange('vol_high',300);
  assert.ok(hiSpread>loSpread*1.5,`high VOLATILITY should spread damage more (low ${loSpread} vs high ${hiSpread})`);
  // same battle seed => identical sequence (determinism), including variance rolls
  const a1=N.createBattle({seed:'gen5,1,2,3,4',teamA:['vol_high'],teamB:['vol_probe_def']});
  const a2=N.createBattle({seed:'gen5,1,2,3,4',teamA:['vol_high'],teamB:['vol_probe_def']});
  assert.deepEqual(a1.computeDamage(a1.entity('A1'),a1.entity('B1'),N.SKILL_DEFS.vol_hit,N.SKILL_DEFS.vol_hit.effects[0]),a2.computeDamage(a2.entity('A1'),a2.entity('B1'),N.SKILL_DEFS.vol_hit,N.SKILL_DEFS.vol_hit.effects[0]));
  // luck bias: LUCK=+0.9 rolls land in the upper half more often than LUCK=-0.9
  deployUnit('luck_hi',{ATK:100,VOLATILITY:1,LUCK:0.9},[],[]);
  deployUnit('luck_lo',{ATK:100,VOLATILITY:1,LUCK:-0.9},[],[]);
  addSkill('varr_hit',[{type:'damage',formula:'ATK',varianceMin:0.5,varianceMax:1.5}]);
  let hiSum=0,loSum=0,n=200;
  for(let i=0;i<n;i++){
    const eh=N.createBattle({seed:N.deriveSeed(5000+i),teamA:['luck_hi'],teamB:['vol_probe_def']});
    const el=N.createBattle({seed:N.deriveSeed(5000+i),teamA:['luck_lo'],teamB:['vol_probe_def']});
    hiSum+=eh.computeDamage(eh.entity('A1'),eh.entity('B1'),N.SKILL_DEFS.varr_hit,N.SKILL_DEFS.varr_hit.effects[0]).damage;
    loSum+=el.computeDamage(el.entity('A1'),el.entity('B1'),N.SKILL_DEFS.varr_hit,N.SKILL_DEFS.varr_hit.effects[0]).damage;
  }
  assert.ok(hiSum>loSum*1.05,`LUCK +0.9 should average higher than -0.9 (${hiSum/n} vs ${loSum/n})`);
});

test('ramp/fatigue time dynamics change stats over rounds',()=>{
  deployUnit('grower',{ATK:100,DEF:50,RAMP_START:2,RAMP_RATE:0.1,RAMP_CAP:2,FATIGUE_START:999,FATIGUE_RATE:0,FATIGUE_CAP:1});
  deployUnit('fader',{ATK:100,DEF:50,RAMP_START:999,RAMP_RATE:0,RAMP_CAP:1,FATIGUE_START:1,FATIGUE_RATE:0.2,FATIGUE_CAP:0.4});
  const e=N.createBattle({teamA:['grower'],teamB:['fader']});
  const grower=e.entity('A1'),fader=e.entity('B1');
  const g1=e.getStat('A1','ATK');
  const f1=e.getStat('B1','ATK');
  e.round=10;
  const g10=e.getStat('A1','ATK');
  const f10=e.getStat('B1','ATK');
  assert.ok(g10>g1*1.3,`growth card should strengthen (${g1}->${g10})`);
  assert.ok(f10<f1*0.7,`fatigue card should weaken (${f1}->${f10})`);
  // legacy units (no params) stay exactly constant
  deployUnit('flat',{ATK:100,DEF:50},[],[]);
  const e2=N.createBattle({teamA:['flat'],teamB:['flat']});
  const ff1=e2.getStat('A1','ATK');e2.round=40;const ff40=e2.getStat('A1','ATK');
  assert.equal(ff1,ff40,'legacy units with no time params must be unaffected');
});

test('Battle Wear forces convergence: heal-vs-heal ends before maxRounds',()=>{
  deployUnit('healer_a',{MAX_HP:400,ATK:5,DEF:20,RES:20,SPD:60,HEAL_POWER:140,ENDURANCE:30},[],[]);
  deployUnit('healer_b',{MAX_HP:400,ATK:5,DEF:20,RES:20,SPD:60,HEAL_POWER:140,ENDURANCE:30},[],[]);
  addSkill('heal_big',[{type:'heal',formula:'MAX_HP * 0.25'}],'self');
  N.UNIT_DEFS.healer_a.skills=['heal_big'];N.UNIT_DEFS.healer_b.skills=['heal_big'];
  const e=N.createBattle({seed:N.deriveSeed(777),teamA:['healer_a'],teamB:['healer_b'],maxRounds:300});
  let guard=0;
  while(!e.outcome().ended&&guard++<300)e.resolveRound([]); // no damage actions at all
  assert.ok(e.outcome().ended,`pure-heal mirror must converge via Battle Wear (ended at round ${e.round})`);
  assert.ok(e.round<300,`converged before maxRounds (round ${e.round})`);
});

test('Battle Wear is deterministic and per-entity (ENDURANCE matters)',()=>{
  deployUnit('weary_lo',{MAX_HP:300,ENDURANCE:5},[],[]);
  deployUnit('weary_hi',{MAX_HP:300,ENDURANCE:95},[],[]);
  addSkill('nothing',[]);
  N.UNIT_DEFS.weary_lo.skills=['nothing'];N.UNIT_DEFS.weary_hi.skills=['nothing'];
  const e1=N.createBattle({seed:'gen5,3,3,3,3',teamA:['weary_lo'],teamB:['weary_hi'],maxRounds:60});
  const e2=N.createBattle({seed:'gen5,3,3,3,3',teamA:['weary_lo'],teamB:['weary_hi'],maxRounds:60});
  for(let i=0;i<40;i++){e1.resolveRound([]);e2.resolveRound([]);}
  assert.deepEqual(e1.serializableSnapshot(),e2.serializableSnapshot(),'battle wear must be deterministic');
  // low-endurance unit should have lost more maxHp to wear than high-endurance
  const loHp=e1.entity('A1').maxHp, hiHp=e1.entity('B1').maxHp;
  assert.ok(loHp<hiHp,`low ENDURANCE should decay more (A ${loHp} vs B ${hiHp})`);
});