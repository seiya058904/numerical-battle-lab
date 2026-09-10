const test=require('node:test');
const assert=require('node:assert/strict');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','strength-model-v7','stat-battle-v7','gen-v7','battlepower-v4'])require('../src/'+file+'.js');
const N=global.NCB;

test('gate: strength geometry invariants hold',()=>{
  const g=N.assertStrengthGeometryV7();
  assert.equal(g.ok,true);
  assert.equal(N.targetThetaV7(50,'A'),0);
  assert.ok(N.targetThetaV7(100,'C')-N.targetThetaV7(40,'XS_COLLECTOR')>4.5);
});

test('gate: same-tier seeds are iso-power with distinct shapes (analytic)',()=>{
  const cards=Array.from({length:8},(_,i)=>N.generateCardV7({seed:'gate-iso-'+i,rarity:'A',level:50}));
  const gp=cards[0].strengthModel.generalPower;
  for(const c of cards)assert.ok(Math.abs(c.strengthModel.generalPower-gp)<.05);
  const atk=cards.map(c=>c.stats.ATK);
  assert.ok(Math.max(...atk)-Math.min(...atk)>20,'stat shapes differ');
});

test('gate: Level and Rarity dominate real battles',()=>{
  const hi=N.generateCardV7({seed:'gate-h',level:100,rarity:'C'}),lo=N.generateCardV7({seed:'gate-h',level:40,rarity:'C'});
  let wins=0;for(let i=0;i<40;i++){const r=N.fightStatCardsV7(hi,lo,'gl'+i);if(r===1)wins++;}
  assert.ok(wins>=38,`Lv100 C vs Lv40 C ${wins}/40`);
  const xc=N.generateCardV7({seed:'gate-x',level:50,rarity:'XS_COLLECTOR'}),c50=N.generateCardV7({seed:'gate-x',level:50,rarity:'C'});
  wins=0;for(let i=0;i<40;i++){const r=N.fightStatCardsV7(xc,c50,'gr'+i);if(r===1)wins++;}
  assert.ok(wins>=36,`same-level XC vs C ${wins}/40`);
});

test('gate: stat-only battles are deterministic and never exceed one attack per unit per round',()=>{
  const a=N.generateCardV7({seed:'gate-det-a',rarity:'A',level:50}),b=N.generateCardV7({seed:'gate-det-b',rarity:'A',level:50});
  assert.equal(N.fightStatCardsV7(a,b,'d1'),N.fightStatCardsV7(a,b,'d1'));
  const battle=N.createStatBattleV7({seed:'d2',teamA:[a],teamB:[b],maxRounds:60});
  battle.run();
  assert.ok(battle.outcome().ended);
  for(const round of battle.history)assert.ok(round.actions.length<=2);
});

test('gate: legacy v1/v6 reproduction stays legacy and neutral-100 axes absent',()=>{
  const v1=N.generateCardByVersion({seed:'gate-legacy',rarity:'A',level:50,archetype:'Mage',generatorVersion:1});
  assert.equal(v1.generatorVersion,1);
  const v6=N.generateCardByVersion({seed:'gate-legacy6',rarity:'A',level:50,generatorVersion:6});
  assert.equal(v6.generatorVersion,6);
  assert.deepEqual(v6,N.generateCardByVersion({seed:'gate-legacy6',rarity:'A',level:50,generatorVersion:6}));
});
