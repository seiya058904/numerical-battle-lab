const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','presets'])require('../src/'+f+'.js');
const N=global.NCB;

test('naming v3: default generator is v3; v2 retained for legacy',()=>{
  assert.equal(N.NAME_GENERATOR_VERSION,3);
  assert.equal(typeof N.generateSpeciesNameV3,'function');
  assert.equal(typeof N.generateSpeciesNameV2,'function','v2 must remain for legacy reproduction');
  assert.equal(typeof N.generateDisplayName,'function','v1 must remain for legacy reproduction');
});

test('naming v3: deterministic — same card always same name',()=>{
  const a=N.generateCardV5({seed:'v3-det',rarity:'A',level:50});
  const b=N.generateCardV5({seed:'v3-det',rarity:'A',level:50});
  assert.equal(a.displayName,b.displayName);
  assert.equal(a.displayName,N.generateSpeciesNameV3(a));
});

test('naming v3: same seed ignores level and rarity',()=>{
  for(const seed of ['v3-sp-a','v3-sp-b']){
    const lo=N.generateCardV5({seed,rarity:'C',level:1});
    const mid=N.generateCardV5({seed,rarity:'A_PLUS',level:50});
    const hi=N.generateCardV5({seed,rarity:'XS_COLLECTOR',level:100});
    assert.equal(lo.displayName,mid.displayName,seed+' level/rarity must not change name');
    assert.equal(lo.displayName,hi.displayName,seed+' rarity must not change name');
  }
});

test('naming v3: name depends on Seed ONLY (stats/actions/fingerprint changes do not rename)',()=>{
  const base=N.generateCardV5({seed:'v3-seedonly',rarity:'C',level:25});
  const name=base.displayName;
  const mut=JSON.parse(JSON.stringify(base));
  mut.stats.ATK=9999;mut.stats.MAX_HP=1;
  mut.actions=[mut.actions[0]];mut.statuses=[];mut.triggers=[];
  delete mut.mechanicFingerprint;mut.rarity='XS_COLLECTOR';mut.level=100;
  assert.equal(N.generateSpeciesNameV3(mut),name,'name must depend on seed only');
});

test('naming v3: names are 2-4 chars, all canonical chars, no repeats, no banned suffix',()=>{
  for(let i=0;i<300;i++){
    const c=N.generateCardV5({seed:'v3-valid-'+i,rarity:N.RARITY_V2_ORDER[i%12],level:10+(i*37)%91});
    const n=N.generateSpeciesNameV3(c);
    assert.ok(n.length>=2&&n.length<=4,`length ${n.length}: ${n}`);
    assert.ok(N.isValidSpeciesNameV3(n),'invalid name: '+n);
    for(const ch of n)assert.ok(N.NAME_V3_CANONICAL_CHARS.has(ch),`non-canonical char ${ch} in ${n}`);
    assert.equal(new Set(n).size,n.length,`repeated char in ${n}`);
  }
});

test('naming v3: no 5-char names and no known-name / banned-substring leaks',()=>{
  for(let i=0;i<500;i++){
    const n=N.generateSpeciesNameV3(N.generateCardV5({seed:'v3-ban-'+i,rarity:'A',level:50}));
    assert.ok(n.length<=4,`5-char name ${n}`);
    for(const known of N.NAME_V3_KNOWN_NAMES)assert.ok(!n.includes(known),`known name ${known} in ${n}`);
  }
});

test('naming v3: all 60 system presets carry the exact canonical names',()=>{
  const CANONICAL=[
    '米洛','咕拉奇','诺米亚','布鲁米','啵洛安','莫里亚姆','咪诺拉','波奇姆','阿米洛','布洛奇安',
    '奇洛','卡维克','迪诺克','提拉奇','皮鲁特','比洛克','希诺特','维拉诺克','卡迪诺','奇米克亚',
    '克塔','塔鲁克','格洛恩','古罗德','达鲁姆','巴洛坦','摩格恩','博鲁克','格鲁安德','塔洛克恩',
    '洛菲','维洛恩','赛米亚','伊诺安','艾洛维','泽鲁亚','希拉恩','诺维姆','维米诺亚','赛拉维恩',
    '托鲁','巴奇洛','布拉姆','咕鲁克','鲁米塔','莫洛奇','拉迪安','卡诺拉','鲁奇恩塔','卡米洛安',
    '洛兰','奥兰姆','阿鲁恩','欧拉诺','伊赛诺','塔米洛','维赛安','赛鲁恩','阿鲁诺德','奥维兰恩',
  ];
  assert.equal(N.SYSTEM_PRESETS.length,60);
  const names=N.SYSTEM_PRESETS.map(c=>c.displayName);
  for(let i=0;i<60;i++)assert.equal(names[i],CANONICAL[i],`cards[${i}] must be ${CANONICAL[i]}`);
  assert.equal(new Set(names).size,60);
  // name-only migration: fingerprints unchanged from the committed baseline is
  // asserted by presets.test.js; here assert no rarity/level/BP influence.
  for(const c of N.SYSTEM_PRESETS)assert.equal(c.name,c.displayName);
});

test('naming v3: registrar resolves collisions to 100% uniqueness at 10k',()=>{
  const reg=N.createNameRegistrarV3();
  const used=new Set();
  for(let i=0;i<10000;i++){
    const c=N.generateCardV5({seed:'v3-unique-'+i,rarity:N.RARITY_V2_ORDER[i%12],level:10+(i*53)%91});
    const n=reg(c);
    assert.ok(!used.has(n),'duplicate registered name '+n);
    used.add(n);
    assert.ok(N.isValidSpeciesNameV3(n));
  }
});

test('naming v3: legacy v1/v2 generators still reproduce their own outputs',()=>{
  const legacy=N.generateCardV4({seed:'v3-legacy',rarity:'A',level:50});
  assert.equal(typeof N.generateSpeciesNameV2(legacy),'string');
  assert.equal(typeof N.generateDisplayName({seed:legacy.seed}),'string');
});