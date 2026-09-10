const test=require('node:test');
const assert=require('node:assert/strict');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','strength-model-v7','stat-battle-v7','gen-v7','battlepower-v4'])require('../src/'+file+'.js');
const N=global.NCB;
const clone=value=>JSON.parse(JSON.stringify(value));

test('GeneralPower is content-only and ignores identity metadata',()=>{
  const card=N.generateCardV7({seed:'gp-meta',rarity:'A',level:50});
  const base=N.generalStrengthV7(card).generalPower;
  const edited=clone(card);
  edited.level=100;edited.rarity='XS_COLLECTOR';edited.seed='other';edited.targetTheta=99;edited.budget=1;
  assert.equal(N.generalStrengthV7(edited).generalPower,base);
});

test('GeneralPower is monotone in offense and defense axes',()=>{
  const card=N.generateCardV7({seed:'gp-mono',rarity:'A',level:50});
  const base=N.generalStrengthV7(card).generalPower;
  const strong=clone(card);strong.stats.ATK*=2;strong.stats.MAX_HP*=1.5;strong.stats.SPD*=1.3;
  const weak=clone(card);weak.stats.ATK*=.5;
  assert.ok(N.generalStrengthV7(strong).generalPower>base);
  assert.ok(N.generalStrengthV7(weak).generalPower<base);
});

test('GeneralPower is a transparent geometric combination of stat components',()=>{
  const card=N.generateCardV7({seed:'gp-form',rarity:'A',level:50});
  const g=N.generalStrengthV7(card);
  assert.ok(g.effectiveDamage>0);
  assert.ok(g.effectiveHP>0);
  assert.ok(Number.isFinite(g.tempo)&&g.tempo>0);
  const noAtk=clone(card);noAtk.stats.ATK=0;
  assert.ok(N.generalStrengthV7(noAtk).effectiveDamage<1e-6);
});

test('BattlePower is a monotone display of GeneralPower and anchored near Lv50 A',()=>{
  const mid=N.generateCardV7({seed:'bp-anchor',rarity:'A',level:50});
  const bp=N.battlePowerV7(mid);
  assert.ok(bp>=700&&bp<=1300,`Lv50 A BP ${bp} near 1000`);
  const low=N.generateCardV7({seed:'bp-anchor',rarity:'C',level:20});
  const high=N.generateCardV7({seed:'bp-anchor',rarity:'XS_COLLECTOR',level:100});
  assert.ok(N.battlePowerV7(high)>bp&&bp>N.battlePowerV7(low),'BP monotone in strength');
});

test('GeneralPower never runs a battle and never reads Level/Rarity/Seed',()=>{
  const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','src','strength-model-v7.js'),'utf8');
  for(const forbidden of ['targetTheta','rarityScoreV7','levelScoreV7','createStatBattle','Math.random'])assert.ok(!source.includes(forbidden),`forbidden ${forbidden} in strength-model-v7.js`);
});
