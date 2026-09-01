const test=require('node:test');
const assert=require('node:assert/strict');
function load(){
  delete require.cache[require.resolve('../src/kernel.js')];
  delete require.cache[require.resolve('../src/power.js')];
  global.NCB={};require('../src/kernel.js');require('../src/power.js');return global.NCB;
}

test('rarity order is the single ascending order and RPI matches spec',()=>{
  const N=load();
  assert.deepEqual(N.RARITY_ORDER,['C','C+','B','B+','A','A+','S','SS','SSS']);
  assert.deepEqual(N.RARITY_RPI,{C:100,'C+':108,B:118,'B+':129,A:141,'A+':154,S:169,SS:187,SSS:207});
  assert.equal(N.rpiOf('C'),100);
  assert.equal(N.rpiOf('SSS'),207);
  for(let i=1;i<N.RARITY_ORDER.length;i++){
    assert.ok(N.RARITY_RPI[N.RARITY_ORDER[i]]>N.RARITY_RPI[N.RARITY_ORDER[i-1]],N.RARITY_ORDER[i]+' must be stronger than '+N.RARITY_ORDER[i-1]);
  }
});
test('unknown rarity throws',()=>{const N=load();assert.throws(()=>N.rpiOf('ZZZ'),/unknown rarity/);});

test('LevelFactor matches the spec curve at sample points',()=>{
  const N=load();
  const expect={1:0.400,10:0.466,20:0.531,30:0.594,40:0.655,50:0.714,60:0.773,70:0.830,80:0.888,90:0.944,100:1.000};
  for(const [lv,v] of Object.entries(expect)){
    assert.ok(Math.abs(N.levelFactor(Number(lv))-v)<0.005,'LF('+lv+')='+N.levelFactor(Number(lv))+', want ~'+v);
  }
  for(let lv=2;lv<=100;lv++)assert.ok(N.levelFactor(lv)>N.levelFactor(lv-1));
  assert.equal(N.levelFactor(100),1);
});

test('CardPower and GenerationBudget match spec examples',()=>{
  const N=load();
  assert.equal(N.computeCardPower({rarity:'C',level:100,quality:1}),100);
  assert.equal(N.generationBudget(100),1000);
  const a50=N.computeCardPower({rarity:'A',level:50,quality:1});
  assert.ok(Math.abs(a50-100.7)<1,'A Lv50 power ~100.7, got '+a50);
  const sss=N.computeCardPower({rarity:'SSS',level:100,quality:1});
  assert.ok(Math.abs(N.generationBudget(sss)-1439)<3,'SSS Lv100 budget ~1439, got '+N.generationBudget(sss));
});

test('budget partition uses registerable ratios summing to 1',()=>{
  const N=load();
  const s=N.splitBudget(1000);
  assert.deepEqual(s,{primary:520,secondary:130,activeSkills:250,passiveTrigger:100});
  const sum=['primary','secondary','activeSkills','passiveTrigger'].reduce((a,k)=>a+N.POWER_RULES.budgetPartitions[k],0);
  assert.ok(Math.abs(sum-1)<1e-9);
});

test('qualityFactor is seeded-deterministic and in range',()=>{
  const N=load();
  const a=N.qualityFactor('A_ASSASSIN_20260901_000134');
  const b=N.qualityFactor('A_ASSASSIN_20260901_000134');
  assert.equal(a,b,'same seed must give same quality');
  assert.ok(a>=0.97&&a<=1.03,a);
  assert.notEqual(N.qualityFactor('X1'),N.qualityFactor('X2'),'different seeds differ');
  for(let i=0;i<200;i++){const q=N.qualityFactor('s'+i);assert.ok(q>=0.97&&q<=1.03,q);}
});