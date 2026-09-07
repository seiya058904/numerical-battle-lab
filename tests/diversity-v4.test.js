const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior','battlepower-v2'])require('../src/'+f+'.js');
const N=global.NCB;
const {audit}=require('../scripts/diversity-audit-v4.js');

test('v4 diversity: classless, varied mechanics, randomness and time profiles',()=>{
  const r=audit(1500);
  assert.equal(r.classless,true,'v4 must be classless');
  assert.equal(Object.keys(r.actionCounts).length,5,'2-6 action counts present');
  assert.ok(Object.keys(r.effectCoverage).length>=15,'rich effect coverage');
  assert.ok(Object.keys(r.damageTypeCoverage).length>=8,'all damage types appear');
  assert.ok(Object.keys(r.conditionCoverage).length>=4,'condition coverage');
  assert.ok(r.volatilityBands.low>0&&r.volatilityBands.high>0,'low+high volatility bands both present');
  const tp=r.timeProfiles;
  assert.ok(tp.ramp>0&&tp.fatigue>0&&tp.stable>0,'ramp/fatigue/stable time profiles all appear');
  assert.ok(r.nonDamage>0,'non-damage cards exist');
  assert.ok(r.uniqueFingerprints>100,'mechanic fingerprints varied');
  assert.equal(Object.keys(r.rarityDistribution).length,12,'all 12 rarities generated');
});

test('v4 diversity: per-rarity volatility variety and level spread',()=>{
  // Every rarity should show low AND high volatility at least once in a large sample
  const volByRarity={};
  for(let i=0;i<3600;i++){
    const rarity=N.RARITY_V2_ORDER[i%12];
    const c=N.generateCardV4({seed:'vr-'+i,rarity,level:10+((i*37)%91)});
    (volByRarity[rarity]=volByRarity[rarity]||{low:0,high:0});
    const v=Number(c.stats.VOLATILITY||1);
    if(v>=1.6)volByRarity[rarity].high++;else if(v<=0.6)volByRarity[rarity].low++;
  }
  for(const [rarity,b] of Object.entries(volByRarity)){
    assert.ok(b.low>0&&b.high>0,`rarity ${rarity} should contain both low and high volatility (${JSON.stringify(b)})`);
  }
});