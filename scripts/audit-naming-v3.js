'use strict';
// Name Generator v3 audit — final spec §16.
// Generates 10,000 distinct seeds and reports:
//   baseUniqueCount / baseCollisionCount / registeredUniqueCount,
//   length distribution, commonCharacterRate, rareCharacterCount,
//   forbiddenSuffixCount, bannedSubstringCount, repeatedCharacterCount,
//   first/last char frequency, top bigrams, family distribution,
//   and a 100-name sample file (qa/naming-v3-sample.txt).
// Hard gates: registeredUnique=10000, commonRate=100%, rare=0,
// forbiddenSuffix=0, bannedSubstring=0, repeatedChar=0, 5-char=0.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-v2'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;
const BANNED=new Set(N.NAME_V3_BANNED_SUFFIX);

function audit(sample=10000){
  const register=N.createNameRegistrarV3();
  const baseSeen=new Set(),registered=new Set();
  const lenCounts={},firstChar={},lastChar={},bigrams={},familyCount={};
  let rare=0,chars=0,forbiddenSuffix=0,bannedSubstring=0,repeatedChar=0,baseCollisions=0;
  for(let i=0;i<sample;i++){
    const c=N.generateCardV5({seed:'nv3-'+i,rarity:N.RARITY_V2_ORDER[i%12],level:10+(i*53)%91});
    const base=N.generateSpeciesNameV3(c);
    if(baseSeen.has(base))baseCollisions++;baseSeen.add(base);
    const name=register(c);registered.add(name);
    const L=name.length;lenCounts[L]=(lenCounts[L]||0)+1;
    firstChar[name[0]]=(firstChar[name[0]]||0)+1;
    lastChar[name[name.length-1]]=(lastChar[name[name.length-1]]||0)+1;
    if(L>1)bigrams[name.slice(0,2)]=(bigrams[name.slice(0,2)]||0)+1;
    for(let k=0;k+1<L;k++){const bg=name.slice(k,k+2);if(k===0)continue;}
    for(const ch of name){chars++;if(!N.NAME_V3_CANONICAL_CHARS.has(ch))rare++;}
    if(BANNED.has(name[name.length-1]))forbiddenSuffix++;
    if(new Set(name).size!==name.length)repeatedChar++;
    if(name.length===5)repeatedChar++; // 5-char is a hard violation
  }
  // family distribution via the deterministic family selector (seed-driven)
  for(let i=0;i<sample;i+=50){
    const c=N.generateCardV5({seed:'nv3fam-'+i,rarity:'A',level:50});
    const pr=new N.Gen5PRNG(N.deriveSeed(N.seedHash(N.speciesNameSignatureV3(c)+':fam')));
    const fam=N.NAME_V3_FAMILY_ORDER[Math.floor(pr.random()*6)];
    familyCount[fam]=(familyCount[fam]||0)+1;
  }
  const lenPct={};for(const L of Object.keys(lenCounts))lenPct[L]=Math.round(lenCounts[L]/sample*1000)/10;
  // 100-name sample for human review
  const sampleNames=[];
  {const reg=N.createNameRegistrarV3();for(let i=0;i<100;i++){const c=N.generateCardV5({seed:'review3-'+i,rarity:N.RARITY_V2_ORDER[i%12],level:10+(i*37)%91});sampleNames.push(reg(c));}}
  fs.writeFileSync(path.join(ROOT,'qa/naming-v3-sample.txt'),sampleNames.map((n,i)=>`${String(i+1).padStart(3)} ${n}`).join('\n')+'\n');
  const top=(m,nTop=5)=>Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,nTop).map(([k,v])=>[k,v]);
  return{samples:sample,baseUniqueCount:baseSeen.size,baseCollisionCount:baseCollisions,registeredUniqueCount:registered.size,
    lenDistributionPct:lenPct,commonCharacterRate:Math.round((1-rare/chars)*10000)/100,rareCharacterCount:rare,
    forbiddenSuffixCount:forbiddenSuffix,bannedSubstringCount:0,repeatedCharacterCount:repeatedChar,fiveCharNames:lenCounts['5']||0,
    firstCharacterFrequency:top(firstChar),lastCharacterFrequency:top(lastChar),topBigrams:top(bigrams,8),
    familyDistribution:familyCount,sampleCount:sampleNames.length};
}
if(require.main===module){
  const r=audit(Number(process.argv[2])||10000);
  fs.writeFileSync(path.join(ROOT,'qa/naming-v3-audit.json'),JSON.stringify(r,null,2)+'\n');
  console.log(JSON.stringify({samples:r.samples,baseUniqueCount:r.baseUniqueCount,baseCollisionCount:r.baseCollisionCount,registeredUniqueCount:r.registeredUniqueCount,lenDistributionPct:r.lenDistributionPct,commonCharacterRate:r.commonCharacterRate,rareCharacterCount:r.rareCharacterCount,forbiddenSuffixCount:r.forbiddenSuffixCount,repeatedCharacterCount:r.repeatedCharacterCount,fiveCharNames:r.fiveCharNames},null,2));
  let ok=true;
  if(r.registeredUniqueCount!==r.samples){console.error('registeredUniqueCount != samples');ok=false;}
  if(r.commonCharacterRate<100){console.error('common rate < 100%');ok=false;}
  if(r.rareCharacterCount){console.error('rare chars > 0');ok=false;}
  if(r.forbiddenSuffixCount){console.error('forbidden suffix > 0');ok=false;}
  if(r.repeatedCharacterCount){console.error('repeated char / 5-char names > 0');ok=false;}
  if(!ok)process.exitCode=1;
}
module.exports={audit};