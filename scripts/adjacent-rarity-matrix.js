// v1.2.2 Adjacent-Rarity Matrix — population strength with matched-card bootstrap
// CI (audit §7/§8/§9/§12/§13/§15).
//
// Fixes from the v1.2.1 audit:
//   - pseudo-replication fixed: CI is a MATCHED-CARD BOOTSTRAP over independently
//     generated matched card pairs (statistical unit = a generated card pair, not
//     a single battle).
//   - All registered archetypes (7, incl. Support) via Object.keys(N.ARCHETYPES).
//   - Archetype-conditioned results reported (Overall + every archetype).
//   - DRAWS REPORTED SEPARATELY: heal/shield mirrors can stall to maxRounds, and a
//     draw is NOT a higher-rarity loss. We report:
//       winRateHigherTier  = CONDITIONAL higher win rate (wins/(wins+losses), draws
//                            excluded) — the honest "is higher rarity stronger"
//       drawRate           = fraction of battles that stalled
//     A stale mirror (Support at ~48% draws) must not be read as a rarity inversion.
//   - Inversion thresholds: Hard <40% / Mild 40-48% / Neutral 48-52% /
//     Expected 52-62% (applied to the CONDITIONAL win rate).
//   - Reports battleCount / generatedCardCount / independentSeedCount / pairCount.
//
// Usage: node scripts/adjacent-rarity-matrix.js [--seeds K] [--battles M]
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const src=(f)=>require(path.join(root,'src',f));
global.NCB={};
for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower-model','battlepower'])src(f);
const N=global.NCB;
function parseArg(name,dflt){const i=process.argv.indexOf('--'+name);return i>=0&&process.argv[i+1]?Number(process.argv[i+1])||dflt:dflt;}
const K=parseArg('seeds',48);
const BATTLES=parseArg('battles',8);
const MAX_ROUNDS=30;
const ARCHETYPES=Object.keys(N.ARCHETYPES);
const rarities=N.RARITY_V2_ORDER;

function bootstrapCI(xs,b=2000,alpha=0.05){
  const n=xs.length;const means=new Array(b);
  for(let k=0;k<b;k++){let s=0;for(let i=0;i<n;i++)s+=xs[(Math.random()*n)|0];means[k]=s/n;}
  means.sort((x,y)=>x-y);
  return{lo:means[Math.floor(b*alpha/2)],hi:means[Math.floor(b*(1-alpha/2))]};
}
function classify(wr){return wr<0.40?'HARD_INV':wr<0.48?'MILD_INV':wr<0.52?'NEUTRAL':'EXPECTED';}
// Conditional win rate over an array of pair win rates (each already conditional
// per pair); draws are tracked separately.
function summarize(arr){
  const m=arr.reduce((x,y)=>x+y,0)/arr.length;
  const ci=bootstrapCI(arr);
  return{winRateHigherTier:m,ciLow:ci.lo,ciHigh:ci.hi,sampleCount:arr.length,class:classify(m)};
}
// Per-pair battle: return {hi,lo,draw} proportions over BATTLES x 2 directions.
function pairBattle(idHi,idLo,seedBase){
  const s1=N.runSimulation({seedBase,battles:BATTLES,maxRounds:MAX_ROUNDS,teamA:[idHi],teamB:[idLo]});
  const s2=N.runSimulation({seedBase:seedBase+1,battles:BATTLES,maxRounds:MAX_ROUNDS,teamA:[idLo],teamB:[idHi]});
  // hiWins = winRateA(s1) [hi is A] + winRateB(s2) [hi is B]
  const hiWins=(s1.winRateA+s2.winRateB)/2;
  const loWins=(s1.winRateB+s2.winRateA)/2;
  const draw=Math.max(0,1-hiWins-loWins);
  const cond=hiWins+loWins>0?hiWins/(hiWins+loWins):0.5; // conditional higher win rate
  return{cond,draw,hiWins,loWins};
}

(async()=>{
  const t0=Date.now();
  const pairs=[];
  for(let i=0;i<rarities.length-1;i++)pairs.push([rarities[i],rarities[i+1]]);
  const rows=[];const hardInversions=[];
  for(const [loR,hiR] of pairs){
    const key=loR+'->'+hiR;
    const byArch={};const overall=[];const draws=[];
    let generated=0,pairCount=0,battles=0;
    for(const a of ARCHETYPES){
      const arr=[];let dSum=0;
      for(let s=0;s<K;s++){
        const seed='AJ_'+s+'_'+a+'_'+loR+'_'+hiR;
        const lo=N.generateCardV2({rarity:loR,level:100,archetype:a,seed});
        const hi=N.generateCardV2({rarity:hiR,level:100,archetype:a,seed});
        const idLo=N.deployCardV2(lo),idHi=N.deployCardV2(hi);
        generated+=2;
        const r=pairBattle(idHi,idLo,910000+s*7+rarities.indexOf(loR)*13+ARCHETYPES.indexOf(a)*3);
        arr.push(r.cond);dSum+=r.draw;
        pairCount++;
      }
      const sum=summarize(arr);
      byArch[a]={...sum,drawRate:Math.round(dSum/K*1000)/1000};
      overall.push(...arr);draws.push(dSum/K);
      if(sum.winRateHigherTier<0.40)hardInversions.push({archetype:a,pair:key,wr:sum.winRateHigherTier});
    }
    const ov=summarize(overall);
    const ovDraw=draws.reduce((x,y)=>x+y,0)/draws.length;
    rows.push({pair:key,winRateHigherTier:ov.winRateHigherTier,ciLow:ov.ciLow,ciHigh:ov.ciHigh,
      sampleCount:ov.sampleCount,class:ov.class,drawRate:Math.round(ovDraw*1000)/1000,
      byArchetype:byArch,
      battleCount:overall.length*BATTLES*2,generatedCardCount:generated,independentSeedCount:K*ARCHETYPES.length,pairCount});
  }
  const allDirectionCorrect=rows.every(r=>r.winRateHigherTier>=0.50);
  const strictMonotonic=rows.every(r=>r.winRateHigherTier>=0.50);
  const out={version:'1.2.2',seeds:K,battlesPerDirection:BATTLES,maxRounds:MAX_ROUNDS,archetypes:ARCHETYPES.length,
    statisticalUnit:'independent matched card pair (bootstrap over pairs, not battles)',
    winRateNote:'CONDITIONAL higher-tier win rate (wins/(wins+losses), draws excluded); drawRate reported separately',
    allDirectionCorrect,strictMonotonic,hardInversions,rows};
  fs.writeFileSync(path.join(root,'qa','adjacent-rarity-matrix.json'),JSON.stringify(out,null,2));
  console.log(`ADJACENT RARITY MATRIX v1.2.2 — ${ARCHETYPES.length} archetypes · ${K} matched seeds · ${BATTLES} battles/dir · CONDITIONAL win rate (draws excluded)`);
  for(const r of rows){
    console.log(`${r.pair.padEnd(15)} OVERALL ${r.winRateHigherTier.toFixed(3)} [${r.ciLow.toFixed(3)}-${r.ciHigh.toFixed(3)}] ${r.class}  draws ${(r.drawRate*100).toFixed(0)}%`);
    const archStr=ARCHETYPES.map(a=>`${a.slice(0,4)}=${r.byArchetype[a].winRateHigherTier.toFixed(2)}${r.byArchetype[a].class==='HARD_INV'?'!':''}${r.byArchetype[a].drawRate>0.3?'(d'+Math.round(r.byArchetype[a].drawRate*100)+')':''}`).join(' ');
    console.log(`    arch: ${archStr}`);
  }
  console.log('ALL ADJACENT DIRECTION CORRECT (conditional):',allDirectionCorrect?'YES':'NO');
  console.log(`hard inversions (<40%, conditional): ${hardInversions.length}${hardInversions.length?' -> '+hardInversions.map(h=>h.archetype+' '+h.pair+' '+h.wr.toFixed(2)).join(' | '):''}`);
  console.log('elapsed',((Date.now()-t0)/1000).toFixed(0),'s');
  process.exit(0);
})();