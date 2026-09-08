'use strict';
// Name Generator v2 audit — verifies deterministic naming quality at scale.
//   * unique-name rate over N samples (>= 99% required)
//   * exact/normalized duplicate counts
//   * length distribution (2..5 chars; must show morphological variety)
//   * generic-suffix concentration (兽/龙/灵/王/刃/魂/甲... must stay ~0)
//   * element+animal template leakage (火狼/雷刃/影刺... must be ~0)
//   * forbidden leaks (rarity / level / role tokens must never appear)
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-v2'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;
function audit(sample=10000){
  const names=[],lenCounts={};
  const suffix={},leak=[];
  const assign=N.createNameRegistrar();
  const GENERIC=['兽','龙','灵','王','者','鬼','神','刃','甲','魂','将','皇','魔','妖'];
  const RARITY_TOKENS=new Set(['C','C+','A','S','SS','SSS','XS','Lv','Lv1','Lv100']);
  for(let i=0;i<sample;i++){
    const seed='audit-n-'+i+(i%7);
    const c=N.generateCardV5({seed,rarity:N.RARITY_V2_ORDER[i%12],level:10+(i*53)%91});
    const n=assign(c);names.push(n);const L=n.length;
    lenCounts[L]=(lenCounts[L]||0)+1;
    // suffix concentration (last char)
    const last=n.slice(-1);suffix[last]=(suffix[last]||0)+1;
    // forbidden leaks
    for(const t of RARITY_TOKENS){if(n.includes(t)){leak.push(n+'<-'+t);break;}}
    const bad=/(火|雷|冰|毒|影|玄|血|暗|岩|风|炎|霜)[狼刃兽甲]+/;
    if(bad.test(n))leak.push(n+'<-template');
  }
  const distinct=new Set(names);
  // normalized duplicate: same string
  const dupCount=names.length-distinct.size;
  const rate=distinct.size/names.length;
  // top generic suffix counts
  const genSuffix={};for(const g of GENERIC)genSuffix[g]=suffix[g]||0;
  const lenPct={};for(const L of Object.keys(lenCounts))lenPct[L]=Math.round(lenCounts[L]/sample*1000)/10;
  return{samples:sample,uniqueNames:distinct.size,uniqueRate:Math.round(rate*10000)/100,dupCount,
    lenDistributionPct:lenPct,topLen:Object.entries(lenCounts).sort((a,b)=>b[1]-a[1]).slice(0,4),
    genericSuffixTop:Object.entries(genSuffix).sort((a,b)=>b[1]-a[1]).slice(0,6),
    leaks:leak.slice(0,20)};
}
if(require.main===module){
  const r=audit(Number(process.argv[2])||10000);
  fs.writeFileSync(path.join(ROOT,'qa/naming-v2-audit.json'),JSON.stringify(r,null,2)+'\n');
  console.log(JSON.stringify({samples:r.samples,uniqueRate:r.uniqueRate,dupCount:r.dupCount,lenDistributionPct:r.lenDistributionPct,genericSuffixTop:r.genericSuffixTop,leakCount:r.leaks.length,leaks:r.leaks.slice(0,6)},null,2));
  if(r.uniqueRate<99){console.error('unique-name rate below 99%');process.exitCode=1;}
  if(r.leaks.length){console.error('naming leaks detected');process.exitCode=1;}
}
module.exports={audit};