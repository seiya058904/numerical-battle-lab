const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','presets','presets-v6'])require('../src/'+f+'.js');
const N=global.NCB;

test('presets-v6: 60 cards, all 12 rarities, names frozen from Naming V3',()=>{
  const cards=N.SYSTEM_PRESETS_V6;
  assert.equal(cards.length,60);
  const tiers=new Set(cards.map(c=>c.rarity));
  assert.equal(tiers.size,12,'must cover all 12 rarity tiers');
  for(const r of N.RARITY_V2_ORDER)assert.equal(cards.filter(c=>c.rarity===r).length,5);
  // names frozen: identical (index-aligned) to the v5 catalog's canonical names
  const v5=N.SYSTEM_PRESETS;
  assert.equal(v5.length,60);
  for(let i=0;i<60;i++){assert.equal(cards[i].name,v5[i].name);assert.equal(cards[i].displayName,v5[i].displayName);}
  const names=new Set(cards.map(c=>c.name));
  assert.equal(names.size,60);
});

test('presets-v6: every card is Generator v6 with a closed budget ledger',()=>{
  for(const c of N.SYSTEM_PRESETS_V6){
    assert.equal(c.generatorVersion,6);
    assert.ok(Number.isFinite(c.stats.ATK)&&c.stats.ATK>0);
    assert.ok(Number.isFinite(c.stats.MAX_HP)&&c.stats.MAX_HP>0);
    assert.ok(c.strengthLedger&&c.strengthLedger.totalBudget===c.generationStrengthBudget,`budget ledger for ${c.id}`);
    assert.ok(Math.abs(N.budgetPriceCardV6(c).total-c.expectedStrength)/c.expectedStrength<=.05,`priced budget for ${c.id}`);
    assert.ok(Number.isFinite(N.battlePowerV3(c).power)&&N.battlePowerV3(c).power>0);
    const v=N.validateContentPack(N.assembleCardPack(c));
    assert.ok(v.ok,`invalid pack for ${c.id}: ${v.errors.join('; ')}`);
  }
});

test('presets-v6: every budget equals ExpectedStrength(level,rarity) (contract)',()=>{
  for(const c of N.SYSTEM_PRESETS_V6){
    const exp=N.expectedStrengthV6(c.level,c.rarity);
    assert.equal(c.generationStrengthBudget,exp,`budget ${c.id} must equal ExpectedStrength(${c.level},${c.rarity})=${exp}`);
    assert.ok(c.strengthLedger.totalBudget===exp);
  }
});
