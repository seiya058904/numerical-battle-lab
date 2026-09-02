// v1.2.1 historical fixture generator (audit §15).
//
// Captures canonical sha256 hashes of 20-50 representative Generator v1 cards
// (generatorVersion:1) so the v1 pipeline is locked byte-for-byte against drift.
// The fixture covers: 9 rarities x 7 archetypes x Lv1/50/100 x multiple seeds.
//
// Usage: node scripts/generate-v1-fixture.js  (writes tests/fixtures/generator-v1.1.0.json)
const path=require('node:path');
const crypto=require('node:crypto');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const src=(f)=>require(path.join(root,'src',f));
global.NCB={};
for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower'])src(f);
const N=global.NCB;

// Canonical serializer: deterministic recursive sort of keys, omit undefined,
// primitives rendered plainly. This is the "canonical output" we hash.
function canon(v){
  if(v===null||v===undefined)return'null';
  if(typeof v==='number'||typeof v==='boolean')return String(v);
  if(typeof v==='string')return JSON.stringify(v);
  if(Array.isArray(v))return'['+v.map(canon).join(',')+']';
  const keys=Object.keys(v).sort();
  return'{'+keys.map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
}
function cardHash(card){return crypto.createHash('sha256').update(canon(card)).digest('hex');}

// Representative v1 sample grid: 9 rarities x 7 archetypes x Lv1/50/100 x seeds.
const rarities=['C','C+','B','B+','A','A+','S','SS','SSS'];
const archetypes=['Balanced','Tank','Bruiser','Assassin','Mage','Support','Controller'];
const levels=[1,50,100];
const entries=[];
let idx=0;
// primary grid: rarity x archetype x level (each one seed) -> 9*7*3 = 189 cards
for(const r of rarities){
  for(const a of archetypes){
    for(const lv of levels){
      const seed='V1FIX_'+idx+'_'+r+'_'+a+'_'+lv;
      const card=N.generateCard({rarity:r,level:lv,archetype:a,seed});
      const id=N.deployCard(card);
      entries.push({rarity:r,archetype:a,level:lv,seed,cardId:id,sha256:cardHash(card)});
      idx++;
    }
  }
}
// sort deterministically
entries.sort((a,b)=>a.seed<b.seed?-1:a.seed>b.seed?1:0);
const fixture={
  name:'generator-v1.1.0 historical fixture',
  version:1,
  generatorVersion:1,
  canonical:'sha256(recursive-sorted-json of generateCard output)',
  count:entries.length,
  entries,
};
fs.writeFileSync(path.join(root,'tests','fixtures','generator-v1.1.0.json'),JSON.stringify(fixture,null,2)+'\n');
console.log(`v1 fixture written: ${entries.length} cards -> tests/fixtures/generator-v1.1.0.json`);
process.exit(0);