const test=require('node:test');
const assert=require('node:assert/strict');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','strength-geometry-v7','style-genome-v7','strength-model-v7'])require('../src/'+file+'.js');
const N=global.NCB;

function simpleCard(){return {id:'simple',stats:{ATK:100,MAX_HP:1000,DEF:100,RES:100,SPD:100,ACC:100,EVA:20,CRIT:10,CRIT_DMG:150,PEN:10,HEAL_POWER:100,ENERGY_MAX:8,ENERGY_REGEN:2},actions:[{id:'hit',target:'enemy',accuracy:1,cooldown:0,cost:0,effects:[{type:'damage',damageType:'physical',formula:'ATK * 1'}]}],statuses:[],triggers:[],passives:[],resistances:{},affinities:{}};}

test('V7 strength model is content-only and ignores identity metadata',()=>{
  const card=simpleCard();
  const a=N.predictThetaV7(card);
  const b=N.predictThetaV7({...card,seed:'other',level:100,rarity:'XS_COLLECTOR',targetTheta:99,expectedStrength:999,generationStrengthBudget:999,empiricalTheta:-99});
  assert.equal(a,b);
});

test('V7 strength model understands interacting attack coefficients and defenses',()=>{
  const card=simpleCard();
  const stronger=structuredClone(card);stronger.actions[0].effects[0].formula='ATK * 2';
  const tougher=structuredClone(card);tougher.stats.DEF=250;tougher.stats.RES=250;
  assert.ok(N.predictThetaV7(stronger)>N.predictThetaV7(card));
  assert.ok(N.predictThetaV7(tougher)>N.predictThetaV7(card));
  const damageMarginal=N.marginalValueV7(card,{kind:'stat',key:'ATK',relativeStep:.05});
  const noDamage=structuredClone(card);noDamage.actions=[];
  assert.ok(damageMarginal>N.marginalValueV7(noDamage,{kind:'stat',key:'ATK',relativeStep:.05}));
});

test('V7 style genome is deterministic, bounded, normalized only as preference weights',()=>{
  const a=N.styleGenomeV7('style-seed'),b=N.styleGenomeV7('style-seed');
  assert.deepEqual(a,b);
  assert.deepEqual(Object.keys(a),['pressure','endurance','sustain','control','tempo','economy','reliability','triggers']);
  assert.ok(Object.values(a).every(value=>value>=0&&value<=1));
  assert.notEqual(Object.values(a).reduce((x,y)=>x+y,0),1);
});

test('V7 calibration feature vector is derived from content shape, not card metadata',()=>{
  const card=simpleCard(),copy={...structuredClone(card),seed:'secret',level:1,rarity:'C',targetTheta:-9};
  assert.deepEqual(N.strengthShapeVectorV7(card),N.strengthShapeVectorV7(copy));
  const dot=structuredClone(card);dot.statuses=[{id:'dot',kind:'debuff',duration:3,periodic:{effects:[{type:'damage',formula:'ATK * .4'}]}}];dot.actions=[{id:'apply',target:'enemy',effects:[{type:'status',status:'dot',duration:3}]}];
  assert.notDeepEqual(N.strengthShapeVectorV7(card),N.strengthShapeVectorV7(dot));
});

test('V7 one-action-per-round model does not multiply strength by action count',()=>{
  const base={stats:{ATK:100,MAX_HP:1000,DEF:100,RES:100,SPD:100},actions:[{id:'a',target:'enemy',cooldown:0,cost:0,effects:[{type:'damage',damageType:'true',formula:'ATK * 2',strengthAnchor:true}]}],statuses:[],triggers:[]};
  const duplicate=structuredClone(base);duplicate.actions.push({...structuredClone(base.actions[0]),id:'b'});
  assert.ok(Math.abs(N.predictThetaV7(base)-N.predictThetaV7(duplicate))<1e-9);
});
