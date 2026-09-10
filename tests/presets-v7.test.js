const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','strength-model-v7','stat-battle-v7','gen-v7','battlepower-v4','presets','presets-v6','presets-v7'])require('../src/'+f+'.js');
const N=global.NCB;

test('presets-v7: 60 stat-only cards, 12 rarities x5, names frozen from Naming V3',()=>{
  const cards=N.SYSTEM_PRESETS_V7;
  assert.equal(cards.length,60);
  for(const r of N.RARITY_V2_ORDER)assert.equal(cards.filter(c=>c.rarity===r).length,5);
  const v6=N.SYSTEM_PRESETS_V6;
  for(let i=0;i<60;i++){assert.equal(cards[i].name,v6[i].name);assert.equal(cards[i].displayName,v6[i].displayName);}
  assert.equal(new Set(cards.map(c=>c.name)).size,60);
  assert.equal(new Set(cards.map(c=>c.id)).size,60);
});

test('presets-v7: every card is Generator v7, stat-only, valid, BPv4 frozen',()=>{
  for(const c of N.SYSTEM_PRESETS_V7){
    assert.equal(c.generatorVersion,7);
    assert.ok(Math.abs(c.targetTheta-N.targetThetaV7(c.level,c.rarity))<=1e-5);
    assert.ok(c.actions===undefined&&c.statuses===undefined&&c.triggers===undefined,'stat-only');
    assert.ok(Number.isFinite(N.battlePowerV4(c).power)&&N.battlePowerV4(c).power>0);
    assert.equal(N.battlePowerV4(c).power,c.power,'frozen presentation power equals live BPv4');
    assert.equal(N.validateContentPack(N.assembleCardPack(c)).ok,true);
    assert.ok(c.curated&&c.curationVersion&&c.designNote&&c.originSeed);
  }
});

test('presets-v7: iso-power within tier and distinct stat shapes',()=>{
  const byTier=new Map();
  for(const c of N.SYSTEM_PRESETS_V7){
    const key=c.level+'|'+c.rarity;
    if(!byTier.has(key))byTier.set(key,[]);
    byTier.get(key).push(c);
  }
  for(const [key,cards] of byTier){
    const gp=cards[0].strengthModel.generalPower;
    for(const c of cards)assert.ok(Math.abs(c.strengthModel.generalPower-gp)<.05,`iso-power at ${key}`);
    const atk=cards.map(c=>c.stats.ATK);
    if(cards.length>1)assert.ok(Math.max(...atk)-Math.min(...atk)>0,'distinct shapes');
  }
});
