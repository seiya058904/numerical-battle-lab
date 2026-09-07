const test=require('node:test'),assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','battlepower-v2'])require('../src/'+f+'.js');
const N=global.NCB;
test('BP reads local DoT, trigger formulas, priority and luck without deployment',()=>{
 const base=N.generateCardV4({seed:'bp-recursion',rarity:'A',level:50});
 base.actions=[{target:'enemy',effects:[{type:'status',status:'local'}]}];base.statuses=[{id:'local',kind:'debuff',duration:3,periodic:{effects:[{type:'damage',formula:'ATK * 2'}]}}];base.triggers=[];
 const a=N.battlePowerV2(base).features;
 const strong=N.deepClone(base);strong.statuses[0].periodic.effects[0].formula='ATK * 6';
 assert.ok(N.battlePowerV2(strong).features.offense>a.offense,'local periodic damage evaluated');
 strong.actions[0].priority=3;assert.ok(N.battlePowerV2(strong).features.tempo>a.tempo);
 strong.triggers=[{event:'roundEnd',target:'self',effects:[{type:'heal',formula:'MAX_HP * .4'}]}];
 assert.ok(N.battlePowerV2(strong).features.sustain>a.sustain,'unit triggers evaluated');
});
