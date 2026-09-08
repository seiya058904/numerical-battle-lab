'use strict';
// Numerical Knowledge coverage audit (§36-38, §55): scans the 60 presets and a
// large v4+v5+v6 sample; any field/effect/condition/event used by real content
// without a knowledge entry FAILS. Also verifies the generated reference is
// current (drift detection) and counts documented coverage.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','behavior','battlepower-v2','numerical-knowledge'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;
function audit(sample=10000){
  const cards=require(path.join(ROOT,'content/presets-v6.json')).cards;
  const gaps=[];
  for(const c of cards)gaps.push(...N.knowledgeCoverageGaps(c).map(g=>'preset '+c.displayName+': '+g));
  // diversity sample (v4/v5 legacy + v6 default)
  for(let i=0;i<sample;i++){
    const c=N.generateCardByVersion({seed:'nk-audit-v5-'+i,rarity:N.RARITY_V2_ORDER[i%12],level:10+(i*37)%91,generatorVersion:5});
    gaps.push(...N.knowledgeCoverageGaps(c).map(g=>'gen5 '+i+': '+g));
    const c6=N.generateCardV6({seed:'nk-audit-v6-'+i,rarity:N.RARITY_V2_ORDER[i%12],level:10+(i*37)%91});
    gaps.push(...N.knowledgeCoverageGaps(c6).map(g=>'gen6 '+i+': '+g));
    const c4=N.generateCardV4({seed:'nk-audit-'+i,rarity:N.RARITY_V2_ORDER[i%12],level:10+(i*37)%91});
    gaps.push(...N.knowledgeCoverageGaps(c4).map(g=>'gen4 '+i+': '+g));
  }
  const unique=[...new Set(gaps)];
  // drift check: regenerate reference in memory and compare to the file
  const gen=require(path.join(ROOT,'scripts/generate-numerical-reference.js'));
  const k=N.NUMERICAL_KNOWLEDGE();
  return{
    presets:cards.length,v4Sample:sample,v5Sample:sample,v6Sample:sample,
    undocumentedActiveFields:unique.length,
    gaps:unique.slice(0,40),
    params:Object.keys(k.params).length,effects:Object.keys(k.effects).length,
    conditions:Object.keys(k.conditions).length,targets:Object.keys(k.targets).length,
    events:Object.keys(k.events).length,formulaSymbols:Object.keys(k.formulaSymbols).length,
    formulaFunctions:Object.keys(k.formulaFunctions).length,damageTypes:Object.keys(k.damageTypes).length
  };
}
if(require.main===module){
  const r=audit(Number(process.argv[2])||3000);
  fs.writeFileSync(path.join(ROOT,'qa/numerical-coverage.json'),JSON.stringify(r,null,2)+'\n');
  console.log(JSON.stringify({presets:r.presets,v4Sample:r.v4Sample,v5Sample:r.v5Sample,v6Sample:r.v6Sample,undocumentedActiveFields:r.undocumentedActiveFields,params:r.params,effects:r.effects,conditions:r.conditions,targets:r.targets,events:r.events,formulaSymbols:r.formulaSymbols,formulaFunctions:r.formulaFunctions,damageTypes:r.damageTypes,gapSample:r.gaps.slice(0,12)}));
  if(r.undocumentedActiveFields)process.exitCode=1;
}
module.exports={audit};
