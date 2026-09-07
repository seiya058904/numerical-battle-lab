const test=require('node:test'),assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior','battlepower-v2'])require('../src/'+f+'.js');
const N=global.NCB;
test('primary allocation conserves its continuous budget',()=>{
  for(let i=0;i<100;i++)assert.ok(Math.abs(Object.values(N.allocatePrimaryV4(520,'budget'+i)).reduce((a,b)=>a+b,0)-520)<1e-7);
});
test('seed text is opaque and does not become a class selector',()=>{
  assert.doesNotThrow(()=>N.generateCardV4({seed:'Tank experiment',rarity:'A',level:40}));
});
test('legacy battles retain HP over long idle rounds',()=>{
  const e=N.createBattle({teamA:['vanguard'],teamB:['vanguard'],maxRounds:100});
  const hp=e.entity('A1').hp;for(let i=0;i<60;i++)e.resolveRound([]);
  assert.equal(e.entity('A1').hp,hp);
});
test('real extreme sustain AI cannot offset terminal wear',()=>{
  const c=N.generateCardV4({seed:'sustain-contract',rarity:'C',level:80});
  c.actions=[{id:c.id+':heal',name:'复苏',target:'self',effects:[{type:'heal',formula:'MAX_HP * 100'}],cost:0,cooldown:0}];c.triggers=[];
  c.stats.ENDURANCE=100;c.passives=[];c.statuses=[{id:c.id+':immune',name:'减伤',kind:'buff',duration:null,maxStacks:1,eventModifiers:[{event:'ModifyDamageTaken',operation:'multiply',value:.01}]}];N.deployCard(c);
  const e=N.createBattle({teamA:[c.id],teamB:[c.id],maxRounds:100});
  e.applyStatus('A1',c.id+':immune');e.applyStatus('B1',c.id+':immune');
  while(!e.outcome().ended)e.resolveRound([...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')]);
  assert.ok(e.log.some(r=>r.kind==='heal'),'AI actually healed');
  assert.ok(e.history.length<100,'terminal pressure must end before technical cap');
});
test('behavior resolves local statuses without deployment and distinguishes buffs from DoT',()=>{
  const c={stats:{MAX_HP:250,ATK:50,SPD:60},actions:[{effects:[{type:'status',status:'local'}]}],statuses:[{id:'local',kind:'buff',modifiers:[{stat:'DEF',value:20}]}]};
  assert.ok(!N.analyzeBehavior(c).tags.includes('DoT'));
  c.statuses[0]={id:'local',kind:'debuff',periodic:{effects:[{type:'damage',formula:'ATK'}]}};
  assert.ok(N.analyzeBehavior(c).tags.includes('DoT'));
});

test('sustain plus reduction cannot round wear damage to zero forever',()=>{
 const c=require('../content/presets-v4.json').cards[0];N.deployCard(c);
 const e=N.createBattle({teamA:[c.id],teamB:[c.id],maxRounds:100});
 while(!e.outcome().ended)e.resolveRound([...N.planAI(e,'A'),...N.planAI(e,'B')]);
 assert.ok(e.history.length<100);
});
