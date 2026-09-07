const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior'])require('../src/'+f+'.js');
const N=global.NCB;

test('behavior analyzer: returns 2-4 tags + one-line summary, deterministic',()=>{
  for(let i=0;i<80;i++){
    const c=N.generateCardV4({seed:'beh-'+i,rarity:'A',level:50});
    const r=N.analyzeBehavior(c);
    assert.ok(Array.isArray(r.tags)&&r.tags.length>=2&&r.tags.length<=4,`tags count ${r.tags?.length}`);
    assert.ok(typeof r.summary==='string'&&r.summary.length>0);
    assert.deepEqual(r,N.analyzeBehavior(c),'analysis must be deterministic');
  }
});

test('behavior tags reflect real individual stats and mechanics',()=>{
  // Build a bare probe card (single damage action, neutral stats) then isolate
  // ONE trait per sub-test so the analyzer's signal is unambiguous.
  function bare(seed){
    const c=N.generateCardV4({seed,rarity:'A',level:50});
    c.actions=[{id:c.id+':p',name:'打击',kind:'damage',target:'enemy',cost:0,cooldown:0,priority:0,accuracy:1,effects:[{type:'damage',formula:'ATK * 1.0'}]}];
    Object.assign(c.stats,{VOLATILITY:1,LUCK:0,ENDURANCE:50,RAMP_START:0,RAMP_RATE:0,RAMP_CAP:1,FATIGUE_START:999,FATIGUE_RATE:0,FATIGUE_CAP:1,
      CRIT:0,CRIT_DMG:150,EVA:0,ACC:100,PEN:0,LIFESTEAL:0,HEAL_POWER:100,DEF:40,RES:20,ATK:50,MAX_HP:220,SPD:55,ENERGY_REGEN:2});
    return c;
  }
  const vol=bare('beh-vol');vol.stats.VOLATILITY=2.8;vol.stats.LUCK=0.8;
  assert.ok(N.analyzeBehavior(vol).tags.some(t=>/波动|赌徒/.test(t)),`volatile card tags ${N.analyzeBehavior(vol).tags.join(',')}`);
  const ls=bare('beh-ls');ls.stats.LIFESTEAL=30;
  assert.ok(N.analyzeBehavior(ls).tags.includes('吸血'),`lifesteal card tags ${N.analyzeBehavior(ls).tags.join(',')}`);
  const ramp=bare('beh-ramp');ramp.stats.RAMP_RATE=0.02;ramp.stats.RAMP_START=3;ramp.stats.FATIGUE_RATE=0;
  assert.ok(N.analyzeBehavior(ramp).tags.some(t=>/后期|成长/.test(t)),`ramp card tags ${N.analyzeBehavior(ramp).tags.join(',')}`);
  const fat=bare('beh-fat');fat.stats.FATIGUE_RATE=0.03;fat.stats.FATIGUE_START=2;fat.stats.ENDURANCE=5;
  assert.ok(N.analyzeBehavior(fat).tags.some(t=>/疲劳/.test(t)),`fatigue card tags ${N.analyzeBehavior(fat).tags.join(',')}`);
  const end=bare('beh-end');end.stats.ENDURANCE=95;
  assert.ok(N.analyzeBehavior(end).tags.some(t=>/耐力/.test(t)),`high endurance tags ${N.analyzeBehavior(end).tags.join(',')}`);
  const nodmg=bare('beh-nodmg');nodmg.actions=[];nodmg.stats.CRIT=0;nodmg.stats.ATK=30;
  assert.ok(N.analyzeBehavior(nodmg).tags.some(t=>/状态|DoT|控制|回复|护盾|资源|冷却|防御/.test(t)),`no-damage tags ${N.analyzeBehavior(nodmg).tags.join(',')}`);
});

test('behavior analyzer is post-hoc: generation does not depend on it, AI does not read it',()=>{
  // Generation: same seed reproduces identical card; adding behaviorTags to a card
  // must not change how it fights (AI reads real stats/actions only).
  const c=N.generateCardV4({seed:'beh-iso',rarity:'A',level:50});
  const r=N.analyzeBehavior(c);
  const cWithTags=N.deepClone(c);cWithTags.behaviorTags=r.tags;cWithTags.behaviorSummary=r.summary;
  N.deployCard(c);N.deployCard(cWithTags);
  const e1=N.createBattle({seed:'gen5,9,9,9,9',teamA:[c.id],teamB:['warden']});
  const e2=N.createBattle({seed:'gen5,9,9,9,9',teamA:[cWithTags.id],teamB:['warden']});
  const plan1=N.planAI(e1,'A');const plan2=N.planAI(e2,'A');
  assert.deepEqual(plan1,plan2,'AI must not read behavior tags');
  // analyzeBehavior must not mutate the card
  const before=JSON.stringify(c);
  N.analyzeBehavior(c);
  assert.equal(JSON.stringify(c),before,'analyzeBehavior must be read-only');
  // the card schema must not carry behavior tags from generation
  assert.equal(c.behaviorTags,undefined,'generator must not emit behavior tags');
});

test('legacy archetype cards get behavior tags too (analyzed, not displayed as class)',()=>{
  const v3=N.generateCardV3({seed:'beh-v3',rarity:'B',level:40,archetype:'Support'});
  const r=N.analyzeBehavior(v3);
  assert.ok(r.tags.length>=1,'legacy cards can be analyzed');
  assert.ok(!r.tags.some(t=>t==='辅助'||t==='Support'),'analyzer never emits archetype labels');
  assert.ok(typeof r.summary==='string');
});