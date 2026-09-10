const test=require('node:test');
const assert=require('node:assert/strict');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','strength-model-v7','stat-battle-v7','gen-v7','battlepower-v4'])require('../src/'+file+'.js');
const N=global.NCB;

test('V7 is a stat-only generator: no skills, statuses, triggers or resources',()=>{
  const card=N.generateCardV7({seed:'stat-only',rarity:'A',level:50});
  assert.equal(card.generatorVersion,7);
  assert.equal(card.actions,undefined);
  assert.equal(card.skills,undefined);
  assert.equal(card.statuses,undefined);
  assert.equal(card.triggers,undefined);
  assert.equal(card.resources,undefined);
  assert.equal(card.passives,undefined);
  assert.ok(!('archetype' in card));
  assert.equal(N.validateContentPack(N.assembleCardPack(card)).ok,true,'stat-only cards still assemble to a valid legacy pack');
});

test('V7 generation is deterministic and classless',()=>{
  const opts={seed:'det-v7',rarity:'SS',level:70};
  assert.deepEqual(N.generateCardV7(opts),N.generateCardV7(opts));
  assert.throws(()=>N.generateCardV7({...opts,archetype:'Mage'}),/classless|archetype/i);
});

test('V7 stats respect their documented bounds and number 20',()=>{
  assert.equal(N.STAT_SPECS_V7.length,20);
  for(let i=0;i<60;i++){
    const card=N.generateCardV7({seed:'bounds-'+i,rarity:N.RARITY_V2_ORDER[i%12],level:10+(i*37)%91});
    for(const spec of N.STAT_SPECS_V7){
      const value=card.stats[spec.key];
      assert.ok(Number.isFinite(value),`${spec.key} finite`);
      assert.ok(value>=spec.min&&value<=spec.max,`${spec.key}=${value} within [${spec.min},${spec.max}]`);
    }
  }
});

test('V7 same-tier seeds are analytically iso-power with different stat shapes',()=>{
  const cards=Array.from({length:12},(_,i)=>N.generateCardV7({seed:'iso-'+i,rarity:'A',level:50}));
  const gp=cards[0].strengthModel.generalPower;
  for(const card of cards)assert.ok(Math.abs(card.strengthModel.generalPower-gp)<.05,'iso-power at tier');
  for(const card of cards)assert.equal(card.budget,cards[0].budget,'same tier spends the same budget');
  const shapes=cards.map(card=>card.stats.ATK);
  assert.ok(Math.max(...shapes)-Math.min(...shapes)>50,'stat shapes clearly differ');
});

test('V7 budget grows monotonically with Level and Rarity (TargetTheta geometry)',()=>{
  const mk=(l,r)=>N.generateCardV7({seed:'mono',level:l,rarity:r});
  let prev=0;
  for(const rarity of N.RARITY_V2_ORDER){
    const budget=mk(50,rarity).budget;
    assert.ok(budget>prev,`budget rises with rarity (${rarity}: ${budget})`);
    prev=budget;
  }
  const c40=mk(40,'C').budget,c100=mk(100,'C').budget;
  assert.ok(c100>c40*2,'large level gap gives a strong budget gap');
  assert.equal(mk(50,'A').targetTheta,0);
});

test('V7 stat battles are deterministic, decisive and respect the one-attack rule',()=>{
  const a=N.generateCardV7({seed:'b-a',rarity:'A',level:50}),b=N.generateCardV7({seed:'b-b',rarity:'A',level:50});
  assert.equal(N.fightStatCardsV7(a,b,'seed-x'),N.fightStatCardsV7(a,b,'seed-x'),'deterministic battle');
  const battle=N.createStatBattleV7({seed:'seed-y',teamA:[a],teamB:[b],maxRounds:60});
  battle.run();
  assert.ok(battle.outcome().ended);
  for(const round of battle.history)assert.ok(round.actions.length<=2,'at most one action per unit per round');
});

test('V7 Level hierarchy is decisive in real battles',()=>{
  const low=N.generateCardV7({seed:'hier',level:40,rarity:'C'}),high=N.generateCardV7({seed:'hier',level:100,rarity:'C'});
  let wins=0;
  for(let i=0;i<60;i++){const r=N.fightStatCardsV7(high,low,'h'+i);if(r===1)wins++;}
  assert.ok(wins>=57,`Lv100 beats Lv40 ${wins}/60`);
});

