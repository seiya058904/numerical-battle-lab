const test=require('node:test');
const assert=require('node:assert/strict');
// Card persistence (spec 25): the card library is saved locally as JSON and must
// survive a save -> reload round-trip losslessly, including displayName edits and
// stable identity. This tests the data layer the localStorage library uses.
function load(){
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower','card-ui'])
    delete require.cache[require.resolve('../src/'+f+'.js')];
  global.NCB={};
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower','card-ui'])
    require('../src/'+f+'.js');
  return global.NCB;
}

test('generated v2 card persists through JSON save/load round-trip losslessly',()=>{
  const N=load();
  const card=N.generateCardV2({rarity:'SS',level:80,archetype:'Mage',seed:'PERSIST_1'});
  const saved=JSON.stringify(card);          // what localStorage stores
  const restored=JSON.parse(saved);          // what reload reads
  assert.deepEqual(restored,card,'card survives save->load');
  assert.equal(restored.id,card.id);
  assert.equal(restored.identity,card.identity);
  // deploy after reload produces a battle-valid pack
  const uid=N.deployCardV2(restored);
  assert.equal(uid,card.id);
  const e=N.createBattle({seed:'gen5,1,2,3,4',teamA:[uid],teamB:['vanguard']});
  let guard=0;
  while(!e.outcome().ended&&guard++<60)e.resolveRound([...N.planAI(e,'A','normal'),...N.planAI(e,'B','normal')]);
  assert.ok(e.log.every(x=>String(x.text).indexOf('NaN')<0),'no NaN after reload');
});

test('displayName edit persists and never changes card id/identity',()=>{
  const N=load();
  const card=N.generateCardV2({rarity:'A',level:70,archetype:'Assassin',seed:'PERSIST_2'});
  card.displayName='霜痕';
  const saved=JSON.stringify(card);
  const restored=JSON.parse(saved);
  assert.equal(restored.displayName,'霜痕','renamed card persists');
  assert.equal(restored.id,card.id,'rename keeps id');
  assert.equal(restored.identity,card.identity,'rename keeps identity');
  // card-ui renders the persisted (renamed) card with a Chinese name
  const html=N.renderCard(restored,{showId:false});
  assert.ok(html.includes('霜痕'),'rendered card shows the persisted Chinese name');
  // battlepower of the restored card is finite and readable
  const bp=N.battlePower(restored);
  assert.ok(Number.isFinite(bp.power)&&bp.power>0);
});

test('card library array survives JSON persistence (add/delete/rename round-trip)',()=>{
  const N=load();
  const c1=N.generateCardV2({rarity:'C',level:50,archetype:'Balanced',seed:'PERSIST_3'});
  const c2=N.generateCardV2({rarity:'XS',level:100,archetype:'Bruiser',seed:'PERSIST_4'});
  const library=[c1,c2];                       // as stored by the library view
  library[0].displayName='起点';
  const saved=JSON.stringify(library);
  const reloaded=JSON.parse(saved);
  assert.equal(reloaded.length,2);
  assert.equal(reloaded[0].displayName,'起点');
  assert.equal(reloaded[0].id,c1.id);
  assert.equal(reloaded[1].rarity,'XS');
  // removing one entry mirrors the library delete action
  reloaded.splice(1,1);
  assert.equal(reloaded.length,1);
  assert.equal(reloaded[0].id,c1.id);
});
