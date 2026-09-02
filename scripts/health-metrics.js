// v1.2.2 Health Metrics gate (audit §20/§21/§23).
//
// Same-rarity mirror 1v1 fights (both sides equal rarity, varied seeds/archetypes)
// — the balanced-fight ecosystem a player meets. v1.2.2 improvements:
//   - Release sample raised to n=1500-3000 (the v1.2.1 n=300 with stalemate 4.7%
//     sat too close to the 5% gate: ~14/300 makes the true rate statistically able
//     to exceed 5%).
//   - Reports POINT ESTIMATE + 95% CI (Wilson) for one-shot and stalemate, plus
//     P50/P75/P90/P95 round distribution.
//   - Gate: point estimate < 5% (CI upper is reported as a risk note).
//   - Per-archetype percentiles so Tank/Support tail sources are visible.
//   - All registered archetypes via Object.keys(N.ARCHETYPES) (7, incl. Support).
//
// Usage: node scripts/health-metrics.js [--n N]
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=(f)=>require(path.join(root,'src',f));
global.NCB={};
for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower'])src(f);
const N=global.NCB;
function parseArg(name,dflt){const i=process.argv.indexOf('--'+name);return i>=0&&process.argv[i+1]?Number(process.argv[i+1])||dflt:dflt;}
const N_FIGHTS=parseArg('n',2000);
const MAX_ROUNDS=40;
const ARCH=Object.keys(N.ARCHETYPES);
const rarities=N.RARITY_V2_ORDER;

function fightRounds(idA,idB,seed){
  const e=N.createBattle({seed:'gen5,'+((seed>>>0)&0xffff)+','+((seed>>>16)&0xffff)+',1,2',teamA:[idA],teamB:[idB]});
  let rounds=0;
  while(!e.outcome().ended&&rounds<MAX_ROUNDS){
    e.resolveRound([...N.planAI(e,'A','hard'),...N.planAI(e,'B','hard')]);
    rounds++;
  }
  return rounds;
}
function wilsonCI(k,n,z=1.96){
  if(n===0)return{lo:0,hi:0};
  const p=k/n;const den=1+z*z/n;
  const c=p+z*z/(2*n);const h=z*Math.sqrt((p*(1-p)+z*z/(4*n))/n);
  return{lo:Math.max(0,(c-h)/den),hi:Math.min(1,(c+h)/den)};
}
function pct(arr,q){const i=Math.floor((arr.length-1)*q);return arr[i];}
(async()=>{
  const byArch={};const roundsAll=[];
  for(let i=0;i<N_FIGHTS;i++){
    const rar=rarities[i%rarities.length];
    const a=ARCH[i%ARCH.length];
    const c1=N.generateCardV2({rarity:rar,level:100,archetype:a,seed:'HM1_'+i});
    const c2=N.generateCardV2({rarity:rar,level:100,archetype:a,seed:'HM2_'+i});
    const r=fightRounds(N.deployCardV2(c1),N.deployCardV2(c2),1000+i);
    roundsAll.push(r);
    (byArch[a]=byArch[a]||[]).push(r);
  }
  const summarize=(arr)=>{
    const s=arr.slice().sort((x,y)=>x-y);
    const n=s.length;
    const os=s.filter(x=>x<=1).length,st=s.filter(x=>x>=MAX_ROUNDS).length;
    return{oneShot:os/n,oneShotCI:wilsonCI(os,n),stalemate:st/n,stalemateCI:wilsonCI(st,n),
      p50:pct(s,0.5),p75:pct(s,0.75),p90:pct(s,0.90),p95:pct(s,0.95)};
  };
  const overall=summarize(roundsAll);
  const perArch={};for(const a of ARCH)perArch[a]=summarize(byArch[a]||[]);
  const oneShot=overall.oneShot,stale=overall.stalemate;
  console.log(`HEALTH METRICS v1.2.2 — n ${N_FIGHTS} (same-rarity mirror 1v1, maxRounds ${MAX_ROUNDS}, ${ARCH.length} archetypes)`);
  console.log(`one-shot: point ${(oneShot*100).toFixed(2)}%  95%CI [${(overall.oneShotCI.lo*100).toFixed(2)}-${(overall.oneShotCI.hi*100).toFixed(2)}]  (gate point < 5%)${oneShot<0.05?'  ✔':'  FAIL'}`);
  console.log(`stalemate: point ${(stale*100).toFixed(2)}%  95%CI [${(overall.stalemateCI.lo*100).toFixed(2)}-${(overall.stalemateCI.hi*100).toFixed(2)}]  (gate point < 5%)${stale<0.05?'  ✔':'  FAIL'}`);
  console.log(`rounds: P50 ${overall.p50} · P75 ${overall.p75} · P90 ${overall.p90} · P95 ${overall.p95}  (median gate 6-10)${overall.p50>=6&&overall.p50<=10?'  ✔':'  FAIL'}`);
  console.log('per-archetype (P50/P75/P90/P95, stalemate point):');
  for(const a of ARCH){
    const p=perArch[a];
    console.log(`  ${a.padEnd(11)} P50 ${p.p50} · P75 ${p.p75} · P90 ${p.p90} · P95 ${p.p95} · stale ${(p.stalemate*100).toFixed(1)}% n=${(byArch[a]||[]).length}`);
  }
  const pass=oneShot<0.05&&stale<0.05&&overall.p50>=6&&overall.p50<=10;
  console.log(pass?'HEALTH METRICS PASS ✔':'HEALTH METRICS WEAK');
  process.exit(pass?0:1);
})();