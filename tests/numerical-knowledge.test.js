const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior','battlepower-v2','numerical-knowledge'])require('../src/'+f+'.js');
const N=global.NCB;

test('knowledge: canonical registry covers params, effects, conditions, events, targets',()=>{
  const k=N.NUMERICAL_KNOWLEDGE();
  assert.ok(Object.keys(k.params).length>=100,'params documented');
  assert.ok(Object.keys(k.effects).length>=15);
  assert.ok(Object.keys(k.conditions).length>=20);
  assert.ok(Object.keys(k.events).length>=20);
  assert.ok(Object.keys(k.targets).length>=8);
  assert.ok(Object.keys(k.formulaSymbols).length>=30,'formula symbols');
  assert.ok(Object.keys(k.formulaFunctions).length>=10);
  assert.ok(Object.keys(k.damageTypes).length>=8);
  // key v4 individual vars have rich semantics (not hollow)
  for(const id of ['VOLATILITY','LUCK','ENDURANCE','RAMP_START','RAMP_RATE','RAMP_CAP','FATIGUE_START','FATIGUE_RATE','FATIGUE_CAP']){
    const e=k.params[id];
    assert.ok(e&&e.summary&&e.summary.length>10,id+' summary');
    assert.ok(e.higherEffect&&e.higherEffect.length>4,id+' higherEffect');
    assert.ok(e.lowerEffect&&e.lowerEffect.length>4,id+' lowerEffect');
    assert.ok(e.battleEffect&&e.battleEffect.length>8,id+' battleEffect');
    assert.ok((e.aiMeaning||'').length>0,id+' aiMeaning');
    assert.ok((e.tuningGuidance||'').length>0,id+' tuningGuidance');
    assert.ok((e.battlePowerMeaning||'').length>0,id+' battlePowerMeaning');
  }
});

test('knowledge: search finds stats/mechanics by Chinese query',()=>{
  assert.ok(N.knowledgeSearch('吸血').some(x=>x.id==='LIFESTEAL'),'吸血 -> LIFESTEAL');
  assert.ok(N.knowledgeSearch('疲劳').some(x=>x.id==='FATIGUE_RATE'),'疲劳 -> FATIGUE_RATE');
  assert.ok(N.knowledgeSearch('疲劳').some(x=>x.id==='BATTLE_WEAR'),'疲劳 -> Battle Wear');
  assert.ok(N.knowledgeSearch('暴击').some(x=>x.id==='CRIT'),'暴击 -> CRIT');
  assert.ok(N.knowledgeSearch('暴击').some(x=>x.id==='CRIT_DMG'),'暴击 -> CRIT_DMG');
  assert.ok(N.knowledgeSearch('后期成长').some(x=>x.id==='RAMP_RATE'||x.id==='RAMP_START'),'后期成长 -> RAMP');
});

test('knowledge: dynamic resources (SOUL/RAGE/CHRONO) resolve to documented entries',()=>{
  for(const r of ['SOUL','RAGE','CHRONO','SOUL_MAX','SOUL_REGEN']){
    const hit=N.knowledgeLookup(r);
    assert.ok(hit&&hit.entry&&hit.entry.summary&&hit.entry.summary.length>5,`resource ${r} documented`);
  }
});

test('knowledge: all 60 presets have zero coverage gaps (no undocumented active fields)',()=>{
  const cards=require('../content/presets-v4.json').cards;
  let gaps=[];
  for(const c of cards)gaps=gaps.concat(N.knowledgeCoverageGaps(c));
  assert.equal(gaps.length,0,gaps.slice(0,8).join('; '));
});

test('knowledge: engine truth matches documented semantics (perturbation, §56)',()=>{
  const {audit}=require('../scripts/audit-numerical-semantics.js');
  const r=audit();
  assert.ok(r.atk.ok,'ATK up -> damage up');
  assert.ok(r.lifesteal.ok,'LIFESTEAL up -> healing up');
  assert.ok(r.volatility.ok,'VOLATILITY up -> variance up');
  assert.ok(r.ramp.ok,'RAMP up -> late damage up');
  assert.ok(r.fatigue.ok,'FATIGUE up -> late damage down');
  assert.ok(r.healPower.ok,'HEAL_POWER up -> healing up');
});