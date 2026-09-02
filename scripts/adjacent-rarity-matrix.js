// v1.2.1 Adjacent-Rarity Matrix (audit §3).
//
// For each adjacent rarity pair (C->C+ ... XS->XS典藏) it runs 正反位 1v1 battles
// across MULTIPLE archetypes (all 6) and MULTIPLE seeds (thousands of total battles
// per pair), and reports:
//   winRateHigherTier : mean win rate of the higher tier over the lower tier
//   95% CI            : Wald interval on the higher-tier win rate (per-battle count)
//   sampleCount       : total battles (both directions, all archetypes)
//
// Targets: normal upgrades 54-60%, collector upgrades 52-57%.
//
// Usage: node scripts/adjacent-rarity-matrix.js [--battles M] [--seedsPerArch K]
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=(f)=>require(path.join(root,'src',f));
global.NCB={};
for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower'])src(f);
const N=global.NCB;

function parseArg(name,dflt){const i=process.argv.indexOf('--'+name);return i>=0&&process.argv[i+1]?Number(process.argv[i+1])||dflt:dflt;}
const BATTLES=parseArg('battles',10);
const SEEDS=parseArg('seedsPerArch',6);

const ARCHETYPES=Object.keys(N.ARCHETYPES);
const rarities=N.RARITY_V2_ORDER;
const pairs=[];
for(let i=0;i<rarities.length-1;i++)pairs.push([rarities[i],rarities[i+1]]);

function runPair(loR,hiR){
  // multiple archetypes, multiple seeds each, both directions
  let wins=0,count=0;
  const archRows=[];
  for(const arch of ARCHETYPES){
    const los=[],his=[];
    for(let k=0;k<SEEDS;k++){
      los.push(N.deployCardV2(N.generateCardV2({rarity:loR,level:100,archetype:arch,seed:'M_LO_'+loR+'_'+arch+'_'+k})));
      his.push(N.deployCardV2(N.generateCardV2({rarity:hiR,level:100,archetype:arch,seed:'M_HI_'+hiR+'_'+arch+'_'+k})));
    }
    let aw=0,ac=0;
    for(let i=0;i<SEEDS;i++)for(let j=0;j<SEEDS;j++){
      const s1=N.runSimulation({seedBase:910000+(loR.length*7919+hiR.length*104729+arch.length*131+ i*SEEDS+j)*17,battles:BATTLES,maxRounds:30,teamA:[his[i]],teamB:[los[j]]});
      const s2=N.runSimulation({seedBase:910001+(loR.length*7919+hiR.length*104729+arch.length*131+ i*SEEDS+j)*17,battles:BATTLES,maxRounds:30,teamA:[los[j]],teamB:[his[i]]});
      const wr=(s1.winRateA+s2.winRateB)/2;
      aw+=wr*BATTLES*2; ac+=BATTLES*2;
    }
    wins+=aw;count+=ac;
    archRows.push({arch,hi:Math.round((aw/ac)*1000)/1000});
  }
  const p=wins/count;
  const se=Math.sqrt(p*(1-p)/count);
  return{lo:loR,hi:hiR,winRateHigherTier:Math.round(p*1000)/1000,
    ciLow:Math.round(Math.max(0,p-1.96*se)*1000)/1000,ciHigh:Math.round(Math.min(1,p+1.96*se)*1000)/1000,
    sampleCount:count,archRows};
}

(async()=>{
  const t0=Date.now();
  const rows=[];
  for(const [lo,hi] of pairs){rows.push(runPair(lo,hi));}
  console.log(`ADJACENT RARITY MATRIX — battles/pair ${BATTLES} x seeds ${SEEDS} x 6 archetypes x 正反位`);
  let allDirectionCorrect=true;
  for(const r of rows){
    const isColl=r.hi.includes('COLLECTOR');
    const tgt=isColl?'52-57':'54-60';
    const ok=r.winRateHigherTier>=0.50;
    if(!ok)allDirectionCorrect=false;
    console.log(`${r.lo.padEnd(13)}->${r.hi.padEnd(13)} hi ${r.winRateHigherTier.toFixed(3)}  [${r.ciLow.toFixed(3)}-${r.ciHigh.toFixed(3)}]  n=${r.sampleCount}  (${tgt})${ok?'':'  <--INV'}`);
    // per-archetype detail (compact)
    console.log(`    arch: ${r.archRows.map(a=>`${a.arch.slice(0,4)}=${a.hi.toFixed(2)}`).join(' ')}`);
  }
  console.log('ALL ADJACENT DIRECTION CORRECT:',allDirectionCorrect?'YES':'NO');
  console.log('elapsed',((Date.now()-t0)/1000).toFixed(0),'s');
  // v1.2.1: emit qa/adjacent-rarity-matrix.json for the release report
  const fs=require('node:fs');
  fs.writeFileSync(path.join(root,'qa','adjacent-rarity-matrix.json'),JSON.stringify({version:'1.2.1',battlesPerPair:BATTLES,cardsPerTier:SEEDS,archetypes:ARCHETYPES.length,allDirectionCorrect,rows},null,2));
  process.exit(allDirectionCorrect?0:1);
})();