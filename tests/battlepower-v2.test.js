const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior','battlepower-v2'])require('../src/'+f+'.js');
const N=global.NCB;

test('battlepower v2: deterministic, read-only, returns power + features',()=>{
  const c=N.generateCardV4({seed:'bp2-det',rarity:'A',level:50});
  const before=JSON.stringify(c);
  const r=N.battlePowerV2(c);
  assert.ok(Number.isFinite(r.power)&&r.power>0);
  assert.ok(r.features&&typeof r.features==='object');
  assert.equal(JSON.stringify(c),before,'battlePowerV2 must not mutate the card');
  assert.equal(N.battlePowerV2(c).power,r.power,'deterministic');
});

test('battlepower v2: same seed + level -> 12 rarity ladder strictly increasing',()=>{
  let prev=null;
  for(const rarity of ['C','C_PLUS','B','B_PLUS','A','A_PLUS','S','SS','SSS','SSS_COLLECTOR','XS','XS_COLLECTOR']){
    const c=N.generateCardV4({seed:'bp2-ladder',rarity,level:50});
    const p=N.battlePowerV2(c).power;
    if(prev!==null)assert.ok(p>prev,`BP must strictly rise ${prev}->${p} at ${rarity}`);
    prev=p;
  }
});

test('battlepower v2: same seed + rarity -> level ladder rises',()=>{
  let prev=null;
  for(const level of [10,30,50,70,90]){
    const c=N.generateCardV4({seed:'bp2-level',rarity:'A',level});
    const p=N.battlePowerV2(c).power;
    if(prev!==null)assert.ok(p>prev,`BP must rise with level ${prev}->${p}`);
    prev=p;
  }
});

test('battlepower v2: large rarity gap never collapses to the same integer',()=>{
  const seen=new Set();
  for(let i=0;i<40;i++){
    const c=N.generateCardV4({seed:'bp2-gap-'+i,rarity:'C',level:60});
    const xs=N.generateCardV4({seed:'bp2-gap-'+i,rarity:'XS_COLLECTOR',level:60});
    const pc=N.battlePowerV2(c).power,px=N.battlePowerV2(xs).power;
    assert.ok(px>pc*1.3,`XS should be clearly above C (${pc} vs ${px})`);
    seen.add(pc);seen.add(px);
  }
  assert.ok(seen.size>=50,`values should not collapse to a few identical integers (${seen.size} distinct)`);
});

test('battlepower v2: recursive mechanics raise the score (features matter)',()=>{
  // Baseline: bare card. Then add mechanic richness (crit/lifesteal/ramp/repeat/
  // consume/status) on the SAME base stats -> features must lift BP.
  function bareCard(seed){
    const c=N.generateCardV4({seed,rarity:'A',level:50});
    Object.assign(c.stats,{MAX_HP:220,ATK:50,DEF:40,RES:20,SPD:55,ACC:100,EVA:0,CRIT:0,CRIT_DMG:150,PEN:0,LIFESTEAL:0,HEAL_POWER:100,ENERGY_REGEN:2,
      VOLATILITY:1,LUCK:0,ENDURANCE:50,RAMP_RATE:0,FATIGUE_RATE:0});
    c.actions=[{id:c.id+':a0',name:'hit',kind:'damage',target:'enemy',cost:0,cooldown:0,accuracy:1,effects:[{type:'damage',formula:'ATK * 1.0'}]}];
    c.statuses=[];c.triggers=[];
    return c;
  }
  const base=bareCard('bp2-base');
  const rich=bareCard('bp2-rich');
  // identical stats, richer mechanics
  rich.stats.CRIT=35;rich.stats.LIFESTEAL=20;rich.stats.RAMP_RATE=0.02;
  rich.actions=[{id:rich.id+':a0',name:'combo',kind:'damage',target:'enemy',cost:0,cooldown:0,accuracy:1,effects:[{type:'repeat',times:2,effects:[{type:'damage',formula:'ATK * 1.0',varianceMin:0.8,varianceMax:1.3}]}]},
    {id:rich.id+':a1',name:'detonate',kind:'damage',target:'enemy',cost:0,cooldown:0,accuracy:1,effects:[{type:'consumeStatus',status:'dot',stacks:'all'},{type:'damage',formula:'ATK * CONSUMED_STACKS'}]}];
  const pb=N.battlePowerV2(base).power,pr=N.battlePowerV2(rich).power;
  assert.ok(pr>pb*1.1,`richer mechanics must raise BP (base ${pb} vs rich ${pr})`);
});

test('battlepower v2: no engine hook (display-only)',()=>{
  const engineSrc=require('node:fs').readFileSync(require('node:path').join(__dirname,'../src/engine.js'),'utf8');
  assert.ok(!/battlePowerV2|battlePower2|\.power\b/.test(engineSrc),'engine must not reference BattlePower');
});