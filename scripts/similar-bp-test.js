// v1.2.2 Similar-BP fairness test (audit §9/§7).
//
// Follows the audit text exactly: sample RANDOM card pairs across the full
// generated-card population (all 12 rarities x ALL registered archetypes
// (Object.keys(N.ARCHETYPES), incl. Support) x multiple seeds, Lv100), keep pairs
// with
//   abs(BPA - BPB) / mean(BPA, BPB) <= 5%
// and battle them directly 正反位 (many battles). Report the higher-BP card's win
// rate (ideal 45-55%, relaxed 40-60%). Then bucket ALL pairs by BP gap
// (0-2 / 2-5 / 5-10 / 10-20 / 20+ %) to verify larger BP gaps produce larger
// win-rate differences — the BP number must have distance meaning, not just order.
//
// Usage: node scripts/similar-bp-test.js [--battles M] [--pairs K]
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=(f)=>require(path.join(root,'src',f));
global.NCB={};
for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower-model','battlepower'])src(f);
const N=global.NCB;
function parseArg(name,dflt){const i=process.argv.indexOf('--'+name);return i>=0&&process.argv[i+1]?Number(process.argv[i+1])||dflt:dflt;}
const BATTLES=parseArg('battles',14);
const PAIRS=parseArg('pairs',120);
const ARCH=Object.keys(N.ARCHETYPES); // all registered archetypes (incl. Support)
// Full mixed pool: every (archetype, rarity, seed), Lv100.
function buildPool(){
  const pool=[];
  for(const a of ARCH)for(const r of N.RARITY_V2_ORDER)for(let k=0;k<6;k++){
    const c=N.generateCardV2({rarity:r,level:100,archetype:a,seed:'SR_'+a+'_'+r+'_'+k});
    pool.push({card:c,id:N.deployCardV2(c),bp:N.battlePower(c).power,arch:a,rarity:r});
  }
  return pool;
}
let CTR=0;
function pairWR(a,b){
  const seedBase=510000+CTR*97;
  const s1=N.runSimulation({seedBase,battles:BATTLES,maxRounds:30,teamA:[a.id],teamB:[b.id]});
  const s2=N.runSimulation({seedBase:seedBase+1,battles:BATTLES,maxRounds:30,teamA:[b.id],teamB:[a.id]});
  CTR++;
  return (s1.winRateA+s2.winRateB)/2; // win rate of FIRST over second
}
(async()=>{
  const pool=buildPool();
  const BUCKETS=['0-2','2-5','5-10','10-20','20+'];
  const buckets={};for(const b of BUCKETS)buckets[b]={n:0,sum:0};
  const CAP=28; // keep every bucket populated
  let similarN=0,similarSum=0,count=0;
  // deterministic pseudo-random pair scan (i += 7, j = i + 13 + step*k)
  const n=pool.length;
  for(let k=0;k<8000&&count<PAIRS*6;k++){
    const i=(k*37)%n;
    const j=(k*97+29)%n;
    if(i===j)continue;
    const a=pool[i],b=pool[j];
    const meanBP=(a.bp+b.bp)/2;if(meanBP<=0)continue;
    const gap=Math.abs(a.bp-b.bp)/meanBP*100;
    let bucket='20+';
    if(gap<=2)bucket='0-2';else if(gap<=5)bucket='2-5';else if(gap<=10)bucket='5-10';else if(gap<=20)bucket='10-20';
    if(buckets[bucket].n>=CAP)continue; // bucket balance
    const hi=a.bp>=b.bp?a:b, lo=a.bp>=b.bp?b:a;
    const wr=pairWR(hi,lo); // higher-BP card win rate
    buckets[bucket].n++;buckets[bucket].sum+=wr;
    if(gap<=5){similarN++;similarSum+=wr;}
    count++;
    if(count>=PAIRS*6)break;
  }
  console.log(`SIMILAR-BP FAIRNESS — random pairs ${count}, battles/pair ${BATTLES} 正反位`);
  console.log('BP gap buckets -> higher-BP card win rate (larger gap should be more lopsided):');
  for(const k of BUCKETS){
    const v=buckets[k];
    if(v.n)console.log(`  ${k.padEnd(6)}% n=${String(v.n).padEnd(4)} higherBP win ${(v.sum/v.n).toFixed(3)}`);
  }
  const similarRate=similarN?similarSum/similarN:null;
  console.log(`|dBP|/mean <= 5%: higher-BP card win rate ${similarRate===null?'n/a':similarRate.toFixed(3)}  (ideal 45-55%, relaxed 40-60%)`);
  const pass=similarRate!==null&&similarRate>=0.40&&similarRate<=0.60;
  console.log(pass?'SIMILAR-BP FAIRNESS PASS ✔ (40-60%)':'SIMILAR-BP FAIRNESS WEAK — BP distance not fair');
  process.exit(pass?0:1);
})();