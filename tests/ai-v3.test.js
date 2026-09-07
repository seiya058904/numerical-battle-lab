const test=require('node:test'),assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai'])require('../src/'+f+'.js');
const N=global.NCB;
function setup(effects){
  const base=N.UNIT_DEFS.vanguard;
  N.UNIT_DEFS.ai_test={...base,id:'ai_test',skills:Object.keys(effects)};
  for(const [id,e] of Object.entries(effects))N.SKILL_DEFS[id]={id,name:id,target:id==='attack'?'enemy':'self',kind:'utility',cost:0,cooldown:0,effects:e};
  return N.createBattle({teamA:['ai_test'],teamB:['warden']});
}
test('canonical AI heals missing HP and avoids overheal',()=>{
  const e=setup({attack:[{type:'damage',formula:'10'}],heal:[{type:'heal',formula:'200'}]});
  assert.equal(N.planAI(e,'A')[0].skillId,'attack');e.entity('A1').hp=10;
  assert.equal(N.planAI(e,'A')[0].skillId,'heal');
});
test('canonical AI uses shield, status, conditions and resources without mutating battle',()=>{
  for(const effect of [{type:'shield',amount:100},{type:'status',status:'fortified',duration:3},{type:'conditional',condition:{type:'hpPctBelow',value:.5},then:[{type:'heal',formula:'200'}],else:[]},{type:'gain',resource:'ENERGY',amount:4}]){
    const e=setup({attack:[{type:'damage',formula:'1'}],utility:[effect]});e.entity('A1').hp=20;e.entity('A1').energy=0;
    const before=JSON.stringify(e.serializableSnapshot());
    assert.equal(N.planAI(e,'A')[0].skillId,'utility',effect.type);
    assert.equal(JSON.stringify(e.serializableSnapshot()),before);
    assert.deepEqual(N.planAI(e,'A'),N.planAI(e,'A'));
  }
});
test('canonical AI avoids resource gain at cap and duplicate full-duration status',()=>{
  const e=setup({attack:[{type:'damage',formula:'10'}],utility:[{type:'gain',resource:'ENERGY',amount:4}]});
  e.entity('A1').energy=e.entity('A1').stats.ENERGY_MAX;assert.equal(N.planAI(e,'A')[0].skillId,'attack');
  N.SKILL_DEFS.utility.effects=[{type:'status',status:'fortified',duration:3}];e.applyStatus('A1','fortified',{duration:3});
  assert.equal(N.planAI(e,'A')[0].skillId,'attack');
});
