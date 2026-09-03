const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
function load(){
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower-model','battlepower'])
    delete require.cache[require.resolve('../src/'+f+'.js')];
  global.NCB={};
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower-model','battlepower'])
    require('../src/'+f+'.js');
  return global.NCB;
}
function canon(v){
  if(v===null||v===undefined)return'null';
  if(typeof v==='number'||typeof v==='boolean')return String(v);
  if(typeof v==='string')return JSON.stringify(v);
  if(Array.isArray(v))return'['+v.map(canon).join(',')+']';
  const keys=Object.keys(v).sort();
  return'{'+keys.map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
}
function cardHash(card){return crypto.createHash('sha256').update(canon(card)).digest('hex');}

// v1.2.3 historical fixture (audit §16/§17/§18): Generator v1 output is locked
// byte-for-byte against the ACTUAL v1.1.0 historical commit
// 19ca5a443fcccd418d421a648f29a900098f55f8 (fixture generated from a temp worktree
// at that commit, via scripts/generate-v1-fixture.js --historical-ref, which now
// ALSO verifies git HEAD and a clean worktree). The fixture carries machine-
// verifiable provenance (historicalCommit/historicalTree/generatorBlobSha/
// generatedAtToolVersion — no dynamic timestamp). Normal `npm run verify` NEVER
// regenerates this golden file — it only compares current v1 output against the
// immutable hashes; the 189 hashes themselves are unchanged by the provenance
// additions.
test('Generator v1 matches the v1.1.0 historical fixture (byte-for-byte hashes)',()=>{
  const N=load();
  const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','generator-v1.1.0.json'),'utf8'));
  assert.equal(fixture.generatorVersion,1);
  assert.equal(fixture.historicalCommit,'19ca5a443fcccd418d421a648f29a900098f55f8','fixture anchored to the v1.1.0 baseline commit');
  // v1.2.3 provenance (audit §17): machine-verifiable, deterministic, no timestamp
  assert.equal(fixture.historicalTree,'ad4e2a9d6833599c67310d4a45e9ec7dd4a1b27e','historical tree sha (git rev-parse HEAD^{tree})');
  assert.equal(fixture.generatorBlobSha,'228e65b98bdedadc1fc83d4542f9b0354f9ad8ac','generator.js blob sha at the historical commit');
  assert.equal(fixture.generatedAtToolVersion,'v1.2.3','tool version recorded (not a timestamp)');
  assert.equal(fixture.count,189,'official fixture has exactly 189 representative cards');
  let checked=0;
  for(const entry of fixture.entries){
    const card=N.generateCard({rarity:entry.rarity,level:entry.level,archetype:entry.archetype,seed:entry.seed});
    const h=cardHash(card);
    assert.equal(h,entry.sha256,
      `v1 drift at rarity=${entry.rarity} archetype=${entry.archetype} level=${entry.level} seed=${entry.seed}`);
    assert.equal(card.id,entry.cardId,'v1 card id drift');
    checked++;
  }
  assert.equal(checked,189,'verified all 189 fixture cards');
  // coverage sanity: fixture spans all 9 rarities, 7 archetypes, Lv1/50/100
  const r=new Set(fixture.entries.map(e=>e.rarity));
  const a=new Set(fixture.entries.map(e=>e.archetype));
  const l=new Set(fixture.entries.map(e=>e.level));
  assert.equal(r.size,9,'covers all 9 v1 rarities');
  assert.ok(a.size>=7,'covers all archetypes');
  assert.ok([1,50,100].every(x=>l.has(x)),'covers Lv1/50/100');
});

test('v1 dispatcher still reproduces the historical fixture (generateCardByVersion path)',()=>{
  const N=load();
  const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','generator-v1.1.0.json'),'utf8'));
  const entry=fixture.entries[0];
  const card=N.generateCardByVersion({rarity:entry.rarity,level:entry.level,archetype:entry.archetype,seed:entry.seed,generatorVersion:1});
  assert.equal(cardHash(card),entry.sha256,'dispatcher v1 path matches fixture');
});
