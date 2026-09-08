const test=require('node:test'),assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior','battlepower','battlepower-v2','card-ui'])require('../src/'+f+'.js');
const N=global.NCB;try{require('../src/card-browser.js');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
test('browser combines rarity, arbitrary levels, behavior and action search',()=>{
 assert.equal(typeof N.filterCards,'function');
 const cards=[30,47,61].map((level,i)=>N.generateCardV4({seed:'filter-'+i,rarity:i===2?'S':'A_PLUS',level}));
 cards[1].displayName='暮潮';cards[1].actions[0].name='侵蚀';cards[1].stats.LIFESTEAL=25;
 assert.deepEqual(N.filterCards(cards,{rarity:'A_PLUS',min:40,max:60,tag:'吸血',search:'侵蚀'}).map(c=>c.id),[cards[1].id]);
 assert.equal(N.filterCards(cards,{}).length,3);
 assert.deepEqual(N.filterCards(cards,{sort:'level-desc'}).map(c=>c.level),[61,47,30]);
});
test('card rendering is read only and legacy classes are absent',()=>{
 const c=N.generateCardV3({seed:'legacy-render',rarity:'A',level:60,archetype:'Tank'}),before=N.deepClone(c);
 N.renderCard(c);assert.deepEqual(c,before);
 assert.ok(!/坦克|Tank/.test(N.renderCompactCard(c)));
});

test('browser metadata invalidates after legacy skill and name edits',()=>{
 const c=N.generateCardV3({seed:'metadata-edit',rarity:'A',level:60,archetype:'Tank'});
 c.skills=c.actions;delete c.actions;c.name='old';delete c.displayName;
 N.cardInfo(c);
 c.name='renamed';
 assert.equal(N.filterCards([c],{search:'renamed'}).length,1);
 N.cachePresetPower(c);
 c.skills[0].effects=[{type:'damage',formula:'ATK * 100'}];
 assert.equal(N.battlePowerOf(c),Math.round(N.battlePower(c).power));
});

test('preset metadata cache follows canonical model weight changes',()=>{
 const c=N.generateCardV4({seed:'weight-edit',rarity:'S',level:60});N.cachePresetPower(c);N.cardInfo(c);
 try{
  N.setBattlePowerV2Weights({offense:.1,durability:.7});
  assert.equal(N.cardInfo(c).power,N.battlePowerV2(c).power);
  assert.equal(N.battlePowerOf(c),N.battlePowerV2(c).power);
 }finally{N.setBattlePowerV2Weights();}
});
