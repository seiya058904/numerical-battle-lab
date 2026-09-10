const test=require('node:test');
const assert=require('node:assert/strict');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','strength-model-v7','stat-battle-v7','gen-v7','battlepower-v4'])require('../src/'+file+'.js');
const N=global.NCB;
const clone=value=>JSON.parse(JSON.stringify(value));

test('BPv4 is the monotone display of GeneralPower and content-only',()=>{
  const card=N.generateCardV7({seed:'bpv4-smoke',rarity:'A',level:50});
  const bp=N.battlePowerV4(card);
  assert.ok(Number.isFinite(bp.power)&&bp.power>0);
  assert.equal(bp.power,N.battlePowerV7(card));
  assert.equal(bp.power,card.strengthModel.battlePower);
});

test('BPv4 ignores identity metadata edits (level/rarity/seed/budget/labels)',()=>{
  const card=N.generateCardV7({seed:'bpv4-metadata',rarity:'A',level:50});
  const base=N.battlePowerV4(card).power;
  const edited=clone(card);
  edited.level=100;edited.rarity='XS_COLLECTOR';edited.seed='other';
  edited.targetTheta=99;edited.budget=1;edited.expectedStrength=999;edited.empiricalTheta=-50;
  assert.equal(N.battlePowerV4(edited).power,base,'identity/budget/empirical edits must not change BP');
});

test('BPv4 real content edits move the measured power in the real direction',()=>{
  const card=N.generateCardV7({seed:'bpv4-content',rarity:'A',level:50});
  const base=N.battlePowerV4(card).power;
  const stronger=clone(card);stronger.stats.ATK*=2;stronger.stats.MAX_HP*=1.5;stronger.stats.SPD*=1.2;
  const weaker=clone(card);weaker.stats.ATK*=.5;
  assert.ok(N.battlePowerV4(stronger).power>base,'stronger numbers must raise BP');
  assert.ok(N.battlePowerV4(weaker).power<base,'weaker numbers must lower BP');
});

test('BPv4 never reads hidden identity or battle labels at runtime',()=>{
  const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','src','battlepower-v4.js'),'utf8');
  for(const forbidden of ['targetTheta','expectedStrength','generationBudget','empiricalTheta','createStatBattle','rarity','level','seed'])assert.ok(!source.includes(forbidden),`forbidden ${forbidden} in battlepower-v4.js`);
});
