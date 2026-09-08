const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','gen-v2','gen-v3','gen-v4','gen-v5','presets'])require('../src/'+f+'.js');
const N=global.NCB;

test('naming v2: deterministic for the same card',()=>{
  const a=N.generateCardV5({seed:'nm-det',rarity:'A',level:50});
  const b=N.generateCardV5({seed:'nm-det',rarity:'A',level:50});
  assert.equal(a.displayName,b.displayName);
  assert.equal(a.displayName,N.generateSpeciesName(a));
});

test('naming v2: same seed ignores level and rarity (species identity is the seed)',()=>{
  for(const seed of ['sp-a','sp-b']){
    const lo=N.generateCardV5({seed,rarity:'C',level:25});
    const mid=N.generateCardV5({seed,rarity:'A',level:50});
    const hi=N.generateCardV5({seed,rarity:'XS_COLLECTOR',level:100});
    assert.equal(lo.displayName,mid.displayName,`${seed}: level/rarity must not change name`);
    assert.equal(lo.displayName,hi.displayName,`${seed}: rarity must not change name`);
  }
});

test('naming v2: name does not contain rarity/level/role tokens',()=>{
  const bad=new Set(['C','C+','A','A+','S','SS','SSS','XS','Lv','Lv100','战士','治疗者','刺客','法师','坦克','毒','火','雷','狼','刃','之刃','之盾']);
  for(let i=0;i<200;i++){
    const c=N.generateCardV5({seed:'nm-token-'+i,rarity:N.RARITY_V2_ORDER[i%12],level:1+(i*37)%100});
    const n=c.displayName;
    for(const t of bad)assert.ok(!n.includes(t),`name ${n} contains forbidden token ${t}`);
  }
});

test('naming v2: all 60 system presets have distinct names',()=>{
  const names=new Set(N.SYSTEM_PRESETS.map(c=>c.displayName));
  assert.equal(names.size,N.SYSTEM_PRESETS.length);
});

test('naming v2: morphological length variety (2..5 chars present)',()=>{
  const lens=new Set();
  let samples=0;
  for(let i=0;i<600;i++){const n=N.generateCardV5({seed:'nm-len-'+i,rarity:'B',level:50}).displayName;lens.add(n.length);samples++;}
  assert.ok(lens.has(3)&&lens.has(4),`expected at least 3-char and 4-char names, got ${[...lens]}`);
  assert.ok(samples>0);
  assert.ok(![...lens].some(L=>L<2||L>5),`invalid name lengths ${[...lens]}`);
});

test('naming audit: 10k unique-name rate >= 99% and no generic suffix explosion',()=>{
  const assign=N.createNameRegistrar();
  const names=new Set(),generic={};
  for(let i=0;i<10000;i++){
    const c=N.generateCardV5({seed:'nm-audit-'+i,rarity:N.RARITY_V2_ORDER[i%12],level:10+(i*53)%91});
    const n=assign(c);names.add(n);
    const last=n.slice(-1);if(['兽','龙','灵','王','刃','魂','甲','鬼','神'].includes(last))generic[last]=(generic[last]||0)+1;
  }
  const rate=names.size/10000*100;
  assert.ok(rate>=99,`unique-name rate ${rate.toFixed(1)}% < 99%`);
  for(const [k,v] of Object.entries(generic))assert.ok(v/10000<0.01,`generic suffix ${k} too frequent: ${v}/10000`);
});

test('naming v2: legacy v1-v4 name generator is retained for replay',()=>{
  assert.equal(typeof N.generateDisplayName,'function');
  const c=N.generateCardV4({seed:'legacy-nm',rarity:'A',level:50});
  assert.equal(typeof N.generateDisplayName({seed:c.seed}),'string');
});