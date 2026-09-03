// v1.2.3 v1 historical fixture generator (audit §16/§17/§18).
//
// The golden fixture is IMMUTABLE TEST EVIDENCE, not a generated artifact. It must
// be produced ONCE from the actual v1.1.0 historical commit
//   19ca5a443fcccd418d421a648f29a900098f55f8
// via a temporary git worktree, then committed. To prevent accidental overwrite
// from current main, this script REFUSES to run unless:
//   --historical-ref <commit>   matches the documented v1.1.0 baseline
//   --src-dir <path>            points at a checkout of that historical commit
//                               (e.g. a temp worktree at 19ca5a4)
//
// v1.2.3 (audit §16): the src-dir checkout is VERIFIED for real:
//   - `git -C <srcDir> rev-parse HEAD` must strictly equal the historical ref
//   - `git -C <srcDir> status --porcelain` must be empty (clean worktree)
//   Either check failing aborts with a REFUSED message.
// v1.2.3 (audit §17): the fixture carries machine-verifiable provenance:
//   historicalCommit / historicalTree / generatorBlobSha / generatedAtToolVersion
//   (no dynamic timestamp — output stays byte-reproducible).
//
// The fixture itself is tests/fixtures/generator-v1.1.0.json (189 cards:
// 9 rarities x 7 archetypes x Lv1/50/100). Normal `npm run verify` NEVER
// regenerates this file — it only compares current v1 output against the golden
// hashes.
//
// Usage (one-time, in a temp worktree of the historical commit):
//   git worktree add /tmp/v1fixture 19ca5a443fcccd418d421a648f29a900098f55f8
//   cd /tmp/v1fixture
//   node <path-to-current-scripts>/generate-v1-fixture.js \
//        --historical-ref 19ca5a443fcccd418d421a648f29a900098f55f8 \
//        --src-dir . \
//        --out <path-to-current>/tests/fixtures/generator-v1.1.0.json
const path=require('node:path');
const crypto=require('node:crypto');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

const HISTORICAL_REF='19ca5a443fcccd418d421a648f29a900098f55f8';
// v1.2.3 (audit §17): tool version recorded as provenance (NOT a timestamp, so the
// fixture output stays deterministic/reproducible across runs).
const GENERATOR_TOOL_VERSION='v1.2.3';
function parseArg(name){const i=process.argv.indexOf('--'+name);return i>=0&&process.argv[i+1]?process.argv[i+1]:null;}
const ref=parseArg('historical-ref');
const srcDir=parseArg('src-dir');
const out=parseArg('out');
if(!ref||!srcDir||!out){
  console.error('REFUSED: golden v1 fixture is immutable evidence.');
  console.error(`  --historical-ref <commit>  (must equal ${HISTORICAL_REF})`);
  console.error('  --src-dir <path>            a checkout of that historical commit');
  console.error('  --out <path>                fixture destination');
  process.exit(2);
}
if(ref!==HISTORICAL_REF){
  console.error(`REFUSED: --historical-ref ${ref} != documented v1.1.0 baseline ${HISTORICAL_REF}`);
  process.exit(2);
}
function gitIn(srcDir,args){
  try{return execFileSync('git',['-C',srcDir,...args],{encoding:'utf8'}).trim();}
  catch(e){return '';}
}
// v1.2.3 (audit §16): REAL checkout verification.
const actualHead=gitIn(srcDir,['rev-parse','HEAD']);
if(actualHead!==HISTORICAL_REF){
  console.error(`REFUSED: git -C ${srcDir} rev-parse HEAD = ${actualHead||'<unavailable>'}`);
  console.error(`  expected ${HISTORICAL_REF} — src-dir must be a checkout of the historical commit`);
  process.exit(2);
}
const dirty=gitIn(srcDir,['status','--porcelain']);
if(dirty!==''){
  console.error(`REFUSED: git -C ${srcDir} status --porcelain is NOT empty (worktree dirty):`);
  console.error(dirty.split('\n').slice(0,8).join('\n'));
  console.error('  the historical checkout must be clean so the fixture is exactly the commit');
  process.exit(2);
}
if(!fs.existsSync(path.join(srcDir,'src','generator.js'))){
  console.error(`REFUSED: ${srcDir}/src/generator.js not found — src-dir must be a checkout of ${HISTORICAL_REF}`);
  process.exit(2);
}
// v1.2.3 (audit §17): provenance blobs/tree from the verified checkout.
const historicalTree=gitIn(srcDir,['rev-parse','HEAD^{tree}']);
const generatorBlobSha=gitIn(srcDir,['ls-tree','HEAD','src/generator.js']).split(/\s+/)[2]||'';
if(!/^[0-9a-f]{40}$/.test(historicalTree)||!/^[0-9a-f]{40}$/.test(generatorBlobSha)){
  console.error(`REFUSED: could not derive provenance (tree=${historicalTree} blob=${generatorBlobSha})`);
  process.exit(2);
}

global.NCB={};
for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator'])require(path.join(srcDir,'src',f+'.js'));
const N=global.NCB;

function canon(v){
  if(v===null||v===undefined)return'null';
  if(typeof v==='number'||typeof v==='boolean')return String(v);
  if(typeof v==='string')return JSON.stringify(v);
  if(Array.isArray(v))return'['+v.map(canon).join(',')+']';
  const keys=Object.keys(v).sort();
  return'{'+keys.map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
}
function cardHash(card){return crypto.createHash('sha256').update(canon(card)).digest('hex');}

const rarities=['C','C+','B','B+','A','A+','S','SS','SSS'];
const archetypes=['Balanced','Tank','Bruiser','Assassin','Mage','Support','Controller'];
const levels=[1,50,100];
const entries=[];let idx=0;
for(const r of rarities)for(const a of archetypes)for(const lv of levels){
  const seed='V1FIX_'+idx+'_'+r+'_'+a+'_'+lv;
  const card=N.generateCard({rarity:r,level:lv,archetype:a,seed});
  const id=N.deployCard(card);
  entries.push({rarity:r,archetype:a,level:lv,seed,cardId:id,sha256:cardHash(card)});
  idx++;
}
entries.sort((a,b)=>a.seed<b.seed?-1:a.seed>b.seed?1:0);
const fixture={
  name:'generator-v1.1.0 historical fixture',
  historicalCommit:HISTORICAL_REF,
  historicalTree,
  generatorBlobSha,
  generatedAtToolVersion:GENERATOR_TOOL_VERSION,
  version:1,
  generatorVersion:1,
  canonical:'sha256(recursive-sorted-json of generateCard output)',
  count:entries.length,
  entries,
};
fs.writeFileSync(out,JSON.stringify(fixture,null,2)+'\n');
console.log(`v1 fixture written from historical commit ${HISTORICAL_REF}: ${entries.length} cards -> ${out}`);
process.exit(0);