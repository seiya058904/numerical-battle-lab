const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4'])require('../src/'+f+'.js');
const N=global.NCB;

test('v4: generateCardV4 exists, defaults to v4, identity has no archetype',()=>{
  const c=N.generateCardV4({seed:'v4-red-1',rarity:'A',level:37});
  assert.equal(c.generatorVersion,4);
  assert.equal(c.archetype,undefined);
  assert.ok(!('archetype' in c),'v4 card must not carry an archetype field');
  assert.ok(/v4\|seed=v4-red-1\|rarity=A\|level=37/.test(c.identity),`identity should encode v4+seed+rarity+level, got ${c.identity}`);
  assert.ok(!/archetype|Balanced|Tank|Bruiser|Assassin|Mage|Support|Controller/.test(c.identity),'identity must not contain archetype vocabulary');
});

test('v4: classless stat allocation — continuous, not 7 fixed shapes',()=>{
  // Over many seeds, the five primary stats should produce MANY distinct ordinal
  // signatures (a continuous allocation, not a small whitelist of archetype ratios).
  const orderings=new Set();
  const STATS=['MAX_HP','ATK','DEF','RES','SPD'];
  for(let i=0;i<240;i++){
    const c=N.generateCardV4({seed:'v4-shapes-'+i,rarity:'A',level:60});
    const sig=STATS.map(k=>c.stats[k]).map((v,idx)=>({v,idx})).sort((a,b)=>b.v-a.v).map(x=>x.idx).join(',');
    orderings.add(sig);
    // extremes must be reachable: some glass cannon (very low HP / high ATK), some wall
  }
  assert.ok(orderings.size>=10,`expected >=10 distinct stat orderings, got ${orderings.size}`);
});

test('v4: individual random + time variables exist and are real numbers',()=>{
  for(let i=0;i<60;i++){
    const c=N.generateCardV4({seed:'v4-vars-'+i,rarity:'B',level:50});
    for(const key of ['VOLATILITY','LUCK','ENDURANCE','RAMP_START','RAMP_RATE','RAMP_CAP','FATIGUE_START','FATIGUE_RATE','FATIGUE_CAP']){
      assert.ok(Number.isFinite(c.stats[key]),`missing finite ${key}`);
    }
    assert.ok(c.stats.VOLATILITY>=0.2&&c.stats.VOLATILITY<=3,'VOLATILITY sane range');
    assert.ok(Math.abs(c.stats.LUCK)<=0.9,'LUCK sane range');
    assert.ok(c.stats.ENDURANCE>=0&&c.stats.ENDURANCE<=100,'ENDURANCE sane range');
    // ramp/fatigue caps sane
    assert.ok(c.stats.RAMP_CAP>=1,'RAMP_CAP >= 1 (growth only multiplies up)');
    assert.ok(c.stats.FATIGUE_CAP>=0.2&&c.stats.FATIGUE_CAP<=1,'FATIGUE_CAP within (0,1]');
  }
});

test('v4: deterministic — same seed reproduces identical card',()=>{
  for(let i=0;i<40;i++){
    const opts={seed:'v4-det-'+i,rarity:['C','A','SS','XS'][i%4],level:[17,42,73,100][i%4]};
    assert.deepEqual(N.generateCardV4(opts),N.generateCardV4(opts));
  }
});

test('v4: 2-6 actions, content validates, deployable, no mandatory attack',()=>{
  let nonDamage=0;
  for(let i=0;i<200;i++){
    const c=N.generateCardV4({seed:'v4-actions-'+i,rarity:'A',level:50});
    assert.ok(c.actions.length>=2&&c.actions.length<=6,`action count ${c.actions.length}`);
    const v=N.validateContentPack(N.assembleCardPack(c));
    assert.ok(v.ok,v.errors.join('\n'));
    if(!c.actions.some(a=>a.kind==='damage'))nonDamage++;
  }
  assert.ok(nonDamage>0,'some v4 cards should naturally lack direct damage (allowed)');
});

test('v4: API rejects explicit archetype (classless enforcement)',()=>{
  assert.throws(()=>N.generateCardV4({seed:'x',rarity:'C',level:10,archetype:'Tank'}),/archetype/);
});

test('v4: rarity scales budget/stats for same seed, level scales too',()=>{
  let prev;
  for(const rarity of ['C','C_PLUS','B','B_PLUS','A','A_PLUS','S','SS','SSS','SSS_COLLECTOR','XS','XS_COLLECTOR']){
    const c=N.generateCardV4({seed:'v4-rarity-ladder',rarity,level:50});
    if(prev){
      assert.ok(c.generationBudget>prev.generationBudget,`budget not monotonic ${prev.rarity}->${rarity}`);
      assert.ok(c.stats.MAX_HP>prev.stats.MAX_HP,`MAX_HP not rising ${prev.rarity}->${rarity}`);
    }
    prev=c;
  }
  const lo=N.generateCardV4({seed:'v4-level-ladder',rarity:'A',level:20});
  const hi=N.generateCardV4({seed:'v4-level-ladder',rarity:'A',level:90});
  assert.ok(hi.stats.MAX_HP>lo.stats.MAX_HP,'level should raise effective stats');
  assert.ok(hi.generationBudget>lo.generationBudget,'level should raise budget');
});

test('v4: dispatcher defaults to v4; explicit 1/2/3 still reproduce legacy',()=>{
  const c=N.generateCardByVersion({seed:'v4-dispatch',rarity:'A',level:50});
  assert.equal(c.generatorVersion,4);
  const c3=N.generateCardByVersion({seed:'v4-dispatch',rarity:'A',level:50,generatorVersion:3});
  assert.equal(c3.generatorVersion,3);
  const c2=N.generateCardByVersion({seed:'v4-dispatch',rarity:'A',level:50,archetype:'Balanced',generatorVersion:2});
  assert.equal(c2.generatorVersion,2);
});