const test=require('node:test');
const assert=require('node:assert/strict');
function load(){
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower-model','battlepower'])
    delete require.cache[require.resolve('../src/'+f+'.js')];
  global.NCB={};
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower-model','battlepower'])
    require('../src/'+f+'.js');
  return global.NCB;
}

test('battlePower is deterministic for the same card',()=>{
  const N=load();
  const c=N.generateCardV2({rarity:'A',level:70,archetype:'Assassin',seed:'BP_1'});
  const r1=N.battlePower(c),r2=N.battlePower(c);
  assert.equal(r1.power,r2.power,'same card -> same BattlePower');
  assert.ok(r1.power>0&&Number.isFinite(r1.power));
  assert.ok(Object.keys(r1.subScores).length===7);
});

test('battlePower does not modify the card (read-only)',()=>{
  const N=load();
  const c=N.generateCardV2({rarity:'S',level:90,archetype:'Mage',seed:'BP_RO'});
  const snapshot=JSON.stringify(c);
  N.battlePower(c);
  assert.equal(JSON.stringify(c),snapshot,'battlePower must not mutate the card');
});

test('battlePower does not read rarity/level as direct bonus: identical data => same power',()=>{
  const N=load();
  // Build two cards with IDENTICAL final stats/skills but different rarity labels.
  const base=N.generateCardV2({rarity:'A',level:80,archetype:'Balanced',seed:'SAME_DATA'});
  const twin={...base,rarity:'XS',id:'gen_twin_xs'}; // only rarity label + id differ
  const r1=N.battlePower(base);
  const r2=N.battlePower(twin);
  assert.equal(r1.power,r2.power,'identical final data with different rarity -> same BattlePower');
});

test('higher-rarity generated cards trend to higher BattlePower (display metric)',()=>{
  const N=load();
  const c=N.generateCardV2({rarity:'C',level:100,archetype:'Balanced',seed:'BP_C'});
  const s=N.generateCardV2({rarity:'SSS',level:100,archetype:'Balanced',seed:'BP_S'});
  const pC=N.battlePower(c),pS=N.battlePower(s);
  assert.ok(pS.power>pC.power,'SSS should outscore C on average');
});

test('expectedWinRate is a bounded probability and asymmetric',()=>{
  const N=load();
  const w=N.expectedWinRate(12400,10100);
  assert.ok(w>=0&&w<=1);
  assert.ok(w>0.5&&w<0.8,'12400 vs 10100 ~ 60-70%');
  assert.ok(Math.abs(N.expectedWinRate(10000,10000)-0.5)<1e-9,'equal power -> 50%');
  assert.ok(N.expectedWinRate(20000,10000)>N.expectedWinRate(12000,10000),'bigger gap -> higher win rate');
});

test('battlePower of C Lv100 Balanced anchors near 10,000',()=>{
  const N=load();
  const c=N.generateCardV2({rarity:'C',level:100,archetype:'Balanced',seed:'REFERENCE_C_BAL_V2'});
  const r=N.battlePower(c);
  assert.ok(Math.abs(r.power-10000)<1500,`reference ~10000, got ${r.power}`);
});

test('describeSkill produces Chinese human-readable text (data-driven)',()=>{
  const N=load();
  let card=null;
  // find a card with a formula-based damage skill
  for(let i=0;i<20&&!card;i++){const c=N.generateCardV2({rarity:'B',level:60,archetype:'Assassin',seed:'DS'+i});if(c.skills[0].formula)card=c;}
  assert.ok(card,'found a card with formula skill');
  const skill=card.skills[0];
  const txt=N.describeSkill(skill);
  assert.ok(/[\u4e00-\u9fff]/.test(txt),'description contains Chinese: '+txt);
  assert.ok(/伤害|恢复|屏障|附加|命中率|冷却/.test(txt),'description reads like a human sentence: '+txt);
  assert.ok(txt.indexOf('Infinity')<0&&txt.indexOf('NaN')<0,'no NaN in description');
  // deterministic
  assert.equal(N.describeSkill(skill),N.describeSkill(skill));
});

test('describeSkill is generic across the registry (not per-skill hand-written)',()=>{
  const N=load();
  const kinds=new Set();
  for(let i=0;i<25;i++){
    const c=N.generateCardV2({rarity:'A',level:80,archetype:'Mage',seed:'DSG'+i});
    for(const s of c.skills)kinds.add(N.describeSkill(s).length>0?'ok':'empty');
  }
  assert.ok(!kinds.has('empty'),'every composed skill gets a description');
});