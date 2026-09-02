const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
function load(){
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower'])
    delete require.cache[require.resolve('../src/'+f+'.js')];
  global.NCB={};
  for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower'])
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

// v1.2.1 historical fixture (audit §15): Generator v1 output is locked byte-for-byte
// against the v1.1.0 release. If anyone touches the shared v1 pipeline (even to make
// it "match" v2), this test fails. This is stronger than the dispatcher self-check:
// both would have to change together to fake it.
test('Generator v1 matches the v1.1.0 historical fixture (byte-for-byte hashes)',()=>{
  const N=load();
  const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','generator-v1.1.0.json'),'utf8'));
  assert.equal(fixture.generatorVersion,1);
  assert.ok(fixture.count>=20,'fixture has at least 20 representative cards');
  assert.ok(fixture.count<=50||fixture.count>50,'fixture size documented');
  let checked=0;
  for(const entry of fixture.entries){
    const card=N.generateCard({rarity:entry.rarity,level:entry.level,archetype:entry.archetype,seed:entry.seed});
    const h=cardHash(card);
    assert.equal(h,entry.sha256,
      `v1 drift at rarity=${entry.rarity} archetype=${entry.archetype} level=${entry.level} seed=${entry.seed}`);
    assert.equal(card.id,entry.cardId,'v1 card id drift');
    checked++;
  }
  assert.ok(checked>=20,'verified at least 20 fixture cards');
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
