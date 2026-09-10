const test=require('node:test');
const assert=require('node:assert/strict');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7','battlepower-v4'])require('../src/'+file+'.js');
const N=global.NCB;
const clone=value=>JSON.parse(JSON.stringify(value));

test('V7 cards expose a content-only BattlePower v4 measurement',()=>{
  const card=N.generateCardV7({seed:'bpv4-smoke',rarity:'A',level:50});
  const bp=N.battlePowerV4(card);
  assert.ok(Array.isArray(bp.features)&&bp.features.length>=10);
  assert.ok(Number.isFinite(bp.predictedTheta));
  assert.equal(N.BATTLEPOWER_V4_VERSION,4);
});

test('BPv4 is invariant under identity metadata edits',()=>{
  const card=N.generateCardV7({seed:'bpv4-metadata',rarity:'A',level:50});
  const base=N.battlePowerV4FeaturesV4(card);
  const edited=clone(card);
  edited.level=100;edited.rarity='XS_COLLECTOR';edited.seed='other-seed';
  edited.targetTheta=99;edited.expectedStrength=999;edited.generationStrengthBudget=1234;
  edited.empiricalTheta=-50;edited.generationBudget=99999;edited.power=1;edited.presentation.power=1;
  assert.deepEqual(N.battlePowerV4FeaturesV4(edited),base,'identity/budget/empirical edits must not change content features');
});

test('BPv4 real content edits move the measured magnitude in the real direction',()=>{
  const card=N.generateCardV7({seed:'bpv4-content',rarity:'A',level:50});
  const base=N.battlePowerV4FeaturesV4(card);
  const stronger=clone(card);
  stronger.stats.ATK=stronger.stats.ATK*2;
  stronger.stats.MAX_HP=stronger.stats.MAX_HP*1.5;
  const strongerFeatures=N.battlePowerV4FeaturesV4(stronger);
  const weaker=clone(card);
  weaker.stats.ATK=weaker.stats.ATK*.5;
  const weakerFeatures=N.battlePowerV4FeaturesV4(weaker);
  assert.ok(strongerFeatures[N.BATTLEPOWER_V4_FEATURE_NAMES.indexOf('logAttackTotal')]>base[N.BATTLEPOWER_V4_FEATURE_NAMES.indexOf('logAttackTotal')]);
  assert.ok(strongerFeatures[N.BATTLEPOWER_V4_FEATURE_NAMES.indexOf('logEndurance')]>base[N.BATTLEPOWER_V4_FEATURE_NAMES.indexOf('logEndurance')]);
  assert.ok(weakerFeatures[N.BATTLEPOWER_V4_FEATURE_NAMES.indexOf('logAttackTotal')]<base[N.BATTLEPOWER_V4_FEATURE_NAMES.indexOf('logAttackTotal')]);
});

test('BPv4 display transform is monotone and anchors theta 0 near 1000',()=>{
  assert.ok(N.battlePowerV4DisplayTheta(0)>=900&&N.battlePowerV4DisplayTheta(0)<=1100);
  assert.ok(N.battlePowerV4DisplayTheta(1)>N.battlePowerV4DisplayTheta(0));
  assert.ok(N.battlePowerV4DisplayTheta(-1)<N.battlePowerV4DisplayTheta(0));
  assert.ok(N.battlePowerV4DisplayTheta(10)>N.battlePowerV4DisplayTheta(0));
});

test('BPv4 honors the one-action rule and does not sum six throughputs',()=>{
  // Eight IDENTICAL actions must not produce anywhere near eight times the
  // throughput of one: best action full + 0.35 x the other seven bounds the
  // growth at 1 + 7*0.35 = 3.45 in linear space.
  const card=N.generateCardV7({seed:'bpv4-one-action',rarity:'A',level:50});
  const single=clone(card);
  single.actions=[clone(single.actions[0])];
  const many=clone(card);
  many.actions=Array.from({length:8},()=>clone(card.actions[0]));
  const f1=N.battlePowerV4FeaturesV4(single);
  const f8=N.battlePowerV4FeaturesV4(many);
  const directIndex=N.BATTLEPOWER_V4_FEATURE_NAMES.indexOf('logDirectThroughput');
  const growth=Math.exp(f8[directIndex]-f1[directIndex]);
  assert.ok(growth<3.9,`eight identical actions inflated direct throughput ${growth}x`);
  assert.ok(growth>1.05,`identical actions should still add some AI-cycle value, got ${growth}x`);
});

test('BPv4 never reads hidden identity or battle labels at runtime',()=>{
  for(const file of ['src/battlepower-v4.js']){
    const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..',file),'utf8');
    for(const forbidden of ['targetTheta','expectedStrength','generationBudget','empiricalTheta','createBattle','resolveRound','planAI','rarityScoreV7','levelScoreV7','generateCardV7'])assert.ok(!source.includes(forbidden),`forbidden ${forbidden} in ${file}`);
  }
});

test('BPv4 on legacy-style cards defaults absent V7 axes to neutral-100 semantics',()=>{
  const legacy={id:'legacy-x',stats:{ATK:100,MAX_HP:1000,DEF:75,RES:75,SPD:100,ACC:100,EVA:30,CRIT:15,CRIT_DMG:150,PEN:10,HEAL_POWER:100,ENERGY_REGEN:2},
    actions:[{id:'a',name:'strike',kind:'damage',target:'enemy',cost:1,cooldown:1,priority:0,accuracy:.9,effects:[{type:'damage',damageType:'physical',formula:'ATK * 1'}]}],
    statuses:[],triggers:[],passives:[]};
  const f=N.battlePowerV4FeaturesV4(legacy);
  assert.ok(f.every(value=>Number.isFinite(value)),'no NaN features for legacy content');
  assert.ok(f[N.BATTLEPOWER_V4_FEATURE_NAMES.indexOf('logAttackTotal')]>0);
});
