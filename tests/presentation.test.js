const test=require('node:test'),assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai'])require('../src/'+f+'.js');
const N=global.NCB;
test('presentation captures each mutation without changing deterministic battle',()=>{
  const config={seed:N.deriveSeed(317),teamA:['vanguard'],teamB:['ranger'],maxRounds:10};
  const e=N.createBattle({...config,capturePresentation:true}),plain=N.createBattle(config);
  assert.ok(Array.isArray(e.presentationFrames),'opt-in frame capture exists');
  while(!e.outcome().ended){const actions=[...N.planAI(e,'A'),...N.planAI(e,'B')];e.resolveRound(actions);plain.resolveRound(actions);}
  assert.deepEqual(e.serializableSnapshot(),plain.serializableSnapshot());
  const frames=e.presentationFrames;assert.ok(frames.some(f=>f.row?.kind==='damage'));
  let prev=frames[0].snapshot;
  for(const f of frames.slice(1)){
    if(f.row?.kind==='damage'){
      const id=f.row.targetId,find=s=>Object.values(s.teams).flatMap(t=>t.entities).find(e=>e.id===id);
      assert.equal(find(prev).hp-find(f.snapshot).hp,f.row.hpDamage);
    }
    prev=f.snapshot;
  }
  for(const t of ['A','B'])assert.deepEqual(prev.teams[t].entities.map(e=>e.hp),e.teams[t].entities.map(e=>e.hp));
  assert.deepEqual(prev.outcome,e.outcome());
});
