const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2'])require('../src/'+f+'.js');
const N=global.NCB;

test('Action API reuses legal Skill programs without adding a basic attack',()=>{
  const e=N.createBattle({teamA:['vanguard'],teamB:['warden']});
  assert.deepEqual(e.getLegalActions('A1'),e.getLegalSkills('A1'));
  assert.ok(e.getLegalActions('A1').every(a=>e.entity('A1').skills.includes(a.id)));
});
test('max-round draw terminates and reproduces through replay',()=>{
  const e=N.createBattle({teamA:['vanguard'],teamB:['warden'],maxRounds:3});
  for(let i=0;i<5;i++)e.resolveRound([]);
  assert.equal(e.history.length,3);
  assert.deepEqual(e.outcome(),{ended:true,winner:'draw'});
  assert.deepEqual(N.replayBattle(e.exportReplay()).serializableSnapshot(),e.serializableSnapshot());
});
