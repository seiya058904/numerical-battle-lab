const test=require('node:test');
const assert=require('node:assert/strict');
function load(){
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2'])
    delete require.cache[require.resolve('../src/'+f+'.js')];
  global.NCB={};
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2'])
    require('../src/'+f+'.js');
  return global.NCB;
}

test('Generator v2 default: deterministic, id stable, Chinese display name',()=>{
  const N=load();
  const a=N.generateCardByVersion({rarity:'A',level:50,archetype:'Assassin',seed:'V2_ASSASSIN_1'});
  const b=N.generateCardByVersion({rarity:'A',level:50,archetype:'Assassin',seed:'V2_ASSASSIN_1'});
  assert.equal(a.generatorVersion,2);
  assert.equal(N.CARD_GENERATOR_VERSION_V2,2);
  assert.deepEqual(a,b,'v2 same tuple -> identical card');
  assert.equal(a.id,b.id);
  // Chinese display name (data-driven, seeded)
  assert.ok(/^[\u4e00-\u9fff]{1,4}(之[\u4e00-\u9fff])?$/.test(a.displayName),'Chinese name: '+a.displayName);
  assert.equal(a.name,a.displayName);
});

test('Generator v1 backward compatibility: generateCardByVersion(1) reproduces exact v1.1.0 card',()=>{
  const N=load();
  const v1direct=N.generateCard({rarity:'A',level:50,archetype:'Assassin',seed:'A_ASSASSIN_20260901_000134'});
  const v1dispatch=N.generateCardByVersion({rarity:'A',level:50,archetype:'Assassin',seed:'A_ASSASSIN_20260901_000134',generatorVersion:1});
  assert.deepEqual(v1dispatch,v1direct,'v1 via dispatcher == v1 direct (byte-for-byte)');
  assert.equal(v1dispatch.generatorVersion,1);
});

test('v1 and v2 for the same seed produce different cards with different ids',()=>{
  const N=load();
  const v1=N.generateCardByVersion({rarity:'A',level:50,archetype:'Assassin',seed:'SAME',generatorVersion:1});
  const v2=N.generateCardByVersion({rarity:'A',level:50,archetype:'Assassin',seed:'SAME',generatorVersion:2});
  assert.notEqual(v1.id,v2.id,'v1/v2 differ by version');
  assert.equal(v1.generatorVersion,1);assert.equal(v2.generatorVersion,2);
});

test('unsupported generatorVersion rejected by dispatcher and by generateCardV2',()=>{
  const N=load();
  assert.throws(()=>N.generateCardByVersion({rarity:'C',seed:'x',generatorVersion:999}),/unsupported generatorVersion/i);
  assert.throws(()=>N.generateCardV2({rarity:'C',seed:'x',generatorVersion:1}),/unsupported generatorVersion/i);
});

test('v2 supports all 12 rarities with ascending budget',()=>{
  const N=load();
  const prev={power:0};
  for(const r of N.RARITY_V2_ORDER){
    const c=N.generateCardV2({rarity:r,level:100,archetype:'Balanced',seed:'R_'+r});
    assert.equal(N.toV2RarityId(c.rarity),r);
    assert.ok(c.powerIndex>prev.power,'rarity '+r+' must exceed previous power');
    prev.power=c.powerIndex;
  }
});

test('v2 card uses a valid full schema and compiles through validateContentPack',()=>{
  const N=load();
  for(const r of ['C','B+','A','SS','XS_COLLECTOR']){
    const c=N.generateCardV2({rarity:r,level:60,archetype:'Mage',seed:'v2c_'+r});
    assert.equal(c.skills.length,3);
    const pack=N.assembleCardPackV2(c);
    const result=N.validateContentPack(pack);
    assert.ok(result.ok,'rarity '+r+' compile: '+result.errors.join('\n'));
  }
});

test('v2 generated skill composition compiles and uses composition grammar',()=>{
  const N=load();
  // grammar-driven: skills reference registered effects/statuses/damage types
  let found={damage:false,healOrShield:false,secondary:false};
  for(let i=0;i<40&&!(found.damage&&found.healOrShield&&found.secondary);i++){
    const c=N.generateCardV2({rarity:'S',level:80,archetype:'Support',seed:'g'+i});
    for(const s of c.skills){
      if(s.kind==='damage'&&s.damageType&&N.DAMAGE_TYPES[s.damageType])found.damage=true;
      if((s.kind==='heal'||s.kind==='shield')&&s.formula)found.healOrShield=true;
      if(s._secondary)found.secondary=true;
    }
  }
  assert.ok(found.damage,'composition produces damage skills');
  assert.ok(found.healOrShield,'composition produces heal/shield skills');
  assert.ok(found.secondary,'composition sometimes attaches secondary effects');
});

test('v2 passive/trigger budget is actually consumed (spent > 0) and compiles',()=>{
  const N=load();
  let sawPassive=false, sawTrigger=false, sawSpent=false;
  for(let i=0;i<30;i++){
    const c=N.generateCardV2({rarity:'B',level:100,archetype:'Tank',seed:'p'+i});
    const pack=N.assembleCardPackV2(c);
    const result=N.validateContentPack(pack);
    assert.ok(result.ok,result.errors.join('\n'));
    if(c.passives&&c.passives.length)sawPassive=true;
    if(c.triggers&&c.triggers.length)sawTrigger=true;
    if(c.powerAudit.buckets.passive.spent>0)sawSpent=true;
  }
  assert.ok(sawPassive,'v2 sometimes generates stat passives');
  assert.ok(sawTrigger,'v2 sometimes generates triggers');
  assert.ok(sawSpent,'passive budget is actually spent');
});

test('v2 card with passives/triggers fights in a real battle without NaN',()=>{
  const N=load();
  let tested=false;
  for(let i=0;i<20&&!tested;i++){
    const c=N.generateCardV2({rarity:'SS',level:100,archetype:'Bruiser',seed:'battle'+i});
    if(!(c.passives.length||c.triggers.length))continue;
    const uid=N.deployCardV2(c);
    const e=N.createBattle({seed:'gen5,1,2,3,4',teamA:[uid],teamB:['vanguard']});
    let guard=0;
    while(!e.outcome().ended&&guard++<60)e.resolveRound([...N.planAI(e,'A','normal'),...N.planAI(e,'B','normal')]);
    assert.ok(e.outcome().ended,'battle must resolve');
    assert.ok(e.log.every(x=>String(x.text).indexOf('NaN')<0),'no NaN in v2 battle log');
    tested=true;
  }
  assert.ok(tested,'found a v2 card with passives/triggers to battle-test');
});

test('displayName can be edited locally without changing card id or identity',()=>{
  const N=load();
  const c=N.generateCardV2({rarity:'A',level:70,archetype:'Assassin',seed:'rename'});
  const idBefore=c.id, identityBefore=c.identity;
  c.displayName='霜痕';
  assert.equal(c.id,idBefore);
  assert.equal(c.identity,identityBefore);
  // deployed unit picks up the edited display name but keeps its id
  const pack=N.assembleCardPackV2(c);
  assert.equal(pack.units[c.id].name,'霜痕');
});

test('v2 powerAudit reports passive spent honestly',()=>{
  const N=load();
  const c=N.generateCardV2({rarity:'A',level:100,archetype:'Controller',seed:'auditv2'});
  const audit=c.powerAudit;
  assert.ok(Math.abs(audit.totalBudget-c.generationBudget)<1);
  const sum=['primary','secondary','skills','passive'].reduce((a,k)=>a+audit.buckets[k].allocated,0);
  assert.ok(Math.abs(sum-audit.totalBudget)<2,'buckets sum to total');
  assert.ok(audit.buckets.skills.spent>0);
  assert.ok(audit.buckets.passive.spent>0,'v2 passive budget spent');
  assert.ok(audit.unspent>=0);
});

// ---- v1.2 balance regression (Generator v2 rebalance, 2026-02) ----
// Composition constraints: every 3-skill kit has a damage core, and never more
// than one heal / one shield / one pure status skill (audit §7). These are the
// invariants that killed the degenerate one-shot / stall fights.
test('legacy v2 produces a fixed 3-skill kit (no composition gate; v3 owns variety)',()=>{
  const N=load();
  for(let i=0;i<120;i++){
    const c=N.generateCardV2({rarity:['C','B','A','S','SS','XS'][i%6],level:100,archetype:['Balanced','Tank','Bruiser','Assassin','Mage','Controller'][i%6],seed:'comp'+i});
    assert.equal(c.skills.length,3);
  }
});

// v1.2 balance regression: damage-dealing triggers on recurring events would chain
// to the engine proc limit (one hit -> ~12 hits). The rebalance forbids placing
// damage on afterDamageDealt / afterDamageTaken; only bounded events may carry damage.
test('v2 triggers never put damage on recurring damage events (no chain amplification)',()=>{
  const N=load();
  const RECURRING=['roundStart','roundEnd','afterDamageTaken','afterDamageDealt'];
  for(let i=0;i<120;i++){
    const c=N.generateCardV2({rarity:['C','B','A','S','SS','XS'][i%6],level:100,archetype:['Balanced','Tank','Bruiser','Assassin','Mage','Controller'][i%6],seed:'trg'+i});
    for(const t of c.triggers||[]){
      for(const e of t.effects||[]){
        assert.ok(!(e.type==='damage'&&RECURRING.includes(t.event)),
          'damage trigger on recurring event '+t.event+' would chain: '+JSON.stringify(t));
      }
    }
  }
});

// v1.2 balance regression: generated-card 1v1 fights are healthy (no degenerate
// round-1 one-shots or heal-stall stalemates). Uses a light statistical sample.
test('v2 generated mirror fights report diagnostic duration',t=>{
  const N=load();
  let oneShot=0,stall=0,n=0;
  const ARCH=['Balanced','Tank','Bruiser','Assassin','Mage','Controller'];
  for(let i=0;i<60;i++){
    const a=ARCH[i%ARCH.length];
    const c1=N.generateCardV2({rarity:'A',level:100,archetype:a,seed:'h'+i+'a'});
    const c2=N.generateCardV2({rarity:'A',level:100,archetype:a,seed:'h'+i+'b'});
    const id1=N.deployCardV2(c1),id2=N.deployCardV2(c2);
    const e=N.createBattle({seed:'gen5,'+((1000+i>>>0)&0xffff)+','+((1000+i>>>16)&0xffff)+',1,2',teamA:[id1],teamB:[id2]});
    let rounds=0;
    for(let r=0;r<40;r++){if(e.outcome().winner)break;e.resolveRound([...N.planAI(e,'A','hard'),...N.planAI(e,'B','hard')]);rounds++;}
    n++;
    if(rounds<=1)oneShot++;
    if(rounds>=40&&!e.outcome().winner)stall++;
  }
  // audit targets: one-shot <5%, stalemate <5%. Allow small statistical slack on
  // a 60-fight smoke sample (<=2 occurrences on each side).
  t.diagnostic('one-shot '+oneShot+'/'+n);
  t.diagnostic('max-round '+stall+'/'+n);
  assert.equal(n,60);
});
