const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','gen-v2','gen-v3','gen-v4','gen-v5'])require('../src/'+f+'.js');
const N=global.NCB;

// LevelScale must match the authoritative curve.
test('LevelScale follows the authoritative magnitude curve',()=>{
  const expected={1:0.10,10:0.192,25:0.334,50:0.561,75:0.783,100:1.00};
  for(const [L,e] of Object.entries(expected))assert.ok(Math.abs(N.levelScale(Number(L))-e)<0.01,`Lv${L} LevelScale ${N.levelScale(L).toFixed(3)} near ${e}`);
  // strict growth between the sample points
  const pts=[1,10,25,50,75,100];for(let i=1;i<pts.length;i++)assert.ok(N.levelScale(pts[i])>N.levelScale(pts[i-1]));
});

// Rarity bands at a given level must be strictly disjoint & ascending.
test('PowerEnvelope: max(lower rarity) < min(next rarity) at every level',()=>{
  for(const L of [1,10,25,50,75,100]){
    let prevMax=-Infinity,first=true;
    for(const r of N.RARITY_V2_ORDER){
      const {min,max}=N.powerEnvelope(L,r);
      if(!first)assert.ok(prevMax<min,`Lv${L} ${r}: max of previous ${prevMax} not < min ${min}`);
      assert.ok(min<max);
      prevMax=max;first=false;
    }
  }
  // and Level scaling shrinks bands exactly by LevelScale
  const c100=N.powerEnvelope(100,'C'),c50=N.powerEnvelope(50,'C');
  const s50=N.levelScale(50);
  assert.ok(Math.abs(c50.min-c100.min*s50)/c100.min<0.01,`Lv50 C min should scale by LevelScale(50) (~${s50.toFixed(3)})`);
});

test('same-seed rarity ladder: BattlePower(Lv100) strictly increases with rarity',()=>{
  const seeds=['ladder-a','ladder-b','ladder-c'];
  for(const seed of seeds){
    let prev=-1;
    for(const r of N.RARITY_V2_ORDER){
      const c=N.generateCardV5({seed,rarity:r,level:100});
      assert.ok(c.power>prev,`${seed} ${r}: BP ${c.power} not > ${prev}`);
      prev=c.power;
    }
  }
});

test('same-seed level ladder: BattlePower strictly increases across level',()=>{
  for(const seed of ['lv-a','lv-b']){
    let prev=-1;const levels=[1,10,25,50,75,100];
    for(const L of levels){
      const c=N.generateCardV5({seed,rarity:'A',level:L});
      assert.ok(c.power>prev,`${seed} Lv${L}: BP ${c.power} not > ${prev}`);
      prev=c.power;
    }
    // Lv100 must be substantially above Lv1 (level really matters)
    const l1=N.generateCardV5({seed,rarity:'A',level:1}).power;
    const l100=N.generateCardV5({seed,rarity:'A',level:100}).power;
    assert.ok(l100>=l1*4,`Lv100/Lv1 ratio ${(l100/l1).toFixed(2)} should be large`);
  }
});

// Explicit regression: no C+ Lv100 can out-BP an A+ Lv100, across many seeds.
test('cross-seed envelope: every C+ Lv100 BP < every A+ Lv100 BP',()=>{
  let cMax=0,aMin=Infinity;
  for(let i=0;i<150;i++){
    const c=N.generateCardV5({seed:'csx-cplus-'+i,rarity:'C_PLUS',level:100}).power;
    const a=N.generateCardV5({seed:'csx-aplus-'+i,rarity:'A_PLUS',level:100}).power;
    if(c>cMax)cMax=c;if(a<aMin)aMin=a;
  }
  assert.ok(cMax<aMin,`C+ Lv100 max BP ${cMax} must be < A+ Lv100 min BP ${aMin}`);
});

// BattlePower must respond to real number edits (no rarity lookup / fake clamp).
test('battlePowerV3 is a real estimator: editing numbers changes power',()=>{
  const c=N.generateCardV5({seed:'bp-real',rarity:'B',level:50});const base=N.battlePowerV3(c).power;
  const hi=JSON.parse(JSON.stringify(c));hi.stats.ATK*=3;hi.stats.MAX_HP*=2;hi.stats.DEF*=2;
  const hp=N.battlePowerV3(hi).power;
  assert.ok(hp>base+Math.max(50,base*0.3),`stronger numbers must raise power (${base}->${hp})`);
  const role=JSON.parse(JSON.stringify(c));role.stats.ATK=Math.max(1,role.stats.ATK*0.2);role.stats.MAX_HP*=0.5;
  const lo=N.battlePowerV3(role).power;
  assert.ok(lo<base,`weaker numbers must lower power (${base}->${lo})`);
});

// Same real numbers should yield identical power regardless of rarity/level tag
// (proves v3 does NOT read rarity/level: rarity only constrains real numbers).
test('battlePowerV3 never reads rarity: same real numbers -> same power',()=>{
  const a=N.generateCardV5({seed:'bp-identity',rarity:'C',level:100});
  const b=JSON.parse(JSON.stringify(a));b.rarity='XS_COLLECTOR';b.level=1; // retag only
  assert.equal(N.battlePowerV3(a).power,N.battlePowerV3(b).power);
});

// Structural invariance: same seed, changing only level/rarity keeps the
// mechanic fingerprint and action topology identical (only strength differs).
test('Generator v5 structural invariance across level and rarity',()=>{
  for(const seed of ['shake-a','shake-b']){
    const base=N.generateCardV5({seed,rarity:'C',level:25});
    const aplus=N.generateCardV5({seed,rarity:'A_PLUS',level:100});
    const high=N.generateCardV5({seed,rarity:'C',level:100});
    assert.equal(aplus.mechanicFingerprint,base.mechanicFingerprint,`rarity must not change structure (${seed})`);
    assert.equal(high.mechanicFingerprint,base.mechanicFingerprint,`level must not change structure (${seed})`);
    assert.equal(aplus.actions.length,base.actions.length);
    assert.equal(aplus.generatorVersion,5);
    // identical params -> identical id
    const again=N.generateCardV5({seed,rarity:'C',level:25});
    assert.equal(again.id,base.id,'same seed+rarity+level -> same id');
    assert.notEqual(aplus.id,base.id,'different rarity -> different id');
  }
});

// deterministic
test('Generator v5 is deterministic for identical input',()=>{
  const a=N.generateCardV5({seed:'det5',rarity:'S',level:60});
  const b=N.generateCardV5({seed:'det5',rarity:'S',level:60});
  assert.deepEqual(a,b);
});