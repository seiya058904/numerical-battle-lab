// v1.2.3 Health Metrics gate (audit §14/§15/§20).
//
// Same-rarity mirror 1v1 fights (both sides equal rarity, varied seeds/archetypes)
// — the balanced-fight ecosystem a player meets. v1.2.3 improvements:
//   - Release sample RAISED to n=3000 (audit §14) with point estimate + 95% CI.
//   - Reports overall + 7 archetype + 12 rarity + archetype x rarity breakdown.
//   - Metrics: oneShot / stalemate / P50 / P75 / P90 / P95.
//   - Hard gate: point estimate < 5% one-shot and < 5% stalemate (audit §20);
//     target stalemate < 4% leaving safety margin.
//   - All registered archetypes via Object.keys(N.ARCHETYPES) (7, incl. Support).
//
// Usage: node scripts/health-metrics.js [--n N] [--out path]
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const src=(f)=>require(path.join(root,'src',f));
global.NCB={};
for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower-model','battlepower'])src(f);
const N=global.NCB;
function parseArg(name,dflt){const i=process.argv.indexOf('--'+name);return i>=0&&process.argv[i+1]?Number(process.argv[i+1])||dflt:dflt;}
const N_FIGHTS=parseArg('n',3000);
const MAX_ROUNDS=40;
const ARCH=Object.keys(N.ARCHETYPES);
const rarities=N.RARITY_V2_ORDER;
function parseOut(){const i=process.argv.indexOf('--out');return i>=0&&process.argv[i+1]?path.resolve(process.argv[i+1]):null;}
const OUT_JSON=parseOut();

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
function summarize(arr){
  const s=arr.slice().sort((x,y)=>x-y);
  const n=s.length;
  if(n===0)return{oneShot:null,oneShotCI:{lo:null,hi:null},stalemate:null,stalemateCI:{lo:null,hi:null},p50:null,p75:null,p90:null,p95:null};
  const os=s.filter(x=>x<=1).length,st=s.filter(x=>x>=MAX_ROUNDS).length;
  return{oneShot:os/n,oneShotCI:wilsonCI(os,n),stalemate:st/n,stalemateCI:wilsonCI(st,n),
    p50:pct(s,0.5),p75:pct(s,0.75),p90:pct(s,0.90),p95:pct(s,0.95)};
}
(async()=>{
  const byArch={},byRar={},byBoth={};const roundsAll=[];
  for(let i=0;i<N_FIGHTS;i++){
    const rar=rarities[i%rarities.length];
    const a=ARCH[i%ARCH.length];
    const c1=N.generateCardV2({rarity:rar,level:100,archetype:a,seed:'HM1_'+i});
    const c2=N.generateCardV2({rarity:rar,level:100,archetype:a,seed:'HM2_'+i});
    const r=fightRounds(N.deployCardV2(c1),N.deployCardV2(c2),1000+i);
    roundsAll.push(r);
    (byArch[a]=byArch[a]||[]).push(r);
    (byRar[rar]=byRar[rar]||[]).push(r);
    const key=a+'x'+rar;(byBoth[key]=byBoth[key]||[]).push(r);
  }
  const overall=summarize(roundsAll);
  const perArch={};for(const a of ARCH)perArch[a]=summarize(byArch[a]||[]);
  const perRar={};for(const r of rarities)perRar[r]=summarize(byRar[r]||[]);
  const oneShot=overall.oneShot,stale=overall.stalemate;
  console.log(`HEALTH METRICS v1.2.3 — n ${N_FIGHTS} (same-rarity mirror 1v1, maxRounds ${MAX_ROUNDS}, ${ARCH.length} archetypes)`);
  console.log(`one-shot: point ${(oneShot*100).toFixed(2)}%  95%CI [${(overall.oneShotCI.lo*100).toFixed(2)}-${(overall.oneShotCI.hi*100).toFixed(2)}]  (gate point < 5%)${oneShot<0.05?'  ✔':'  FAIL'}`);
  console.log(`stalemate: point ${(stale*100).toFixed(2)}%  95%CI [${(overall.stalemateCI.lo*100).toFixed(2)}-${(overall.stalemateCI.hi*100).toFixed(2)}]  (gate < 5%, target < 4%)${stale<0.05?(stale<0.04?'  ✔':'  ⚠ <5% but >=4%'):'  FAIL'}`);
  console.log(`rounds: P50 ${overall.p50} · P75 ${overall.p75} · P90 ${overall.p90} · P95 ${overall.p95}  (median gate 6-10)${overall.p50>=6&&overall.p50<=10?'  ✔':'  FAIL'}`);
  console.log('per-archetype (P50/P75/P90/P95, stalemate point):');
  for(const a of ARCH){
    const p=perArch[a];
    console.log(`  ${a.padEnd(11)} P50 ${p.p50} · P75 ${p.p75} · P90 ${p.p90} · P95 ${p.p95} · stale ${p.stalemate===null?'n/a':(p.stalemate*100).toFixed(1)}% n=${(byArch[a]||[]).length}`);
  }
  console.log('per-rarity (stalemate point):');
  for(const r of rarities){
    const p=perRar[r];
    console.log(`  ${String(r).padEnd(13)} stale ${p.stalemate===null?'n/a':(p.stalemate*100).toFixed(1)}% · P50 ${p.p50} · P90 ${p.p90} · n=${(byRar[r]||[]).length}`);
  }
  const pass=oneShot<0.05&&stale<0.05&&overall.p50>=6&&overall.p50<=10;
  console.log(pass?'HEALTH METRICS PASS ✔':'HEALTH METRICS WEAK');
  if(OUT_JSON){
    const out={version:'1.2.3',n:N_FIGHTS,maxRounds:MAX_ROUNDS,overall,
      byArchetype:perArch,byRarity:perRar,archetypeXRarity:byBoth,pass};
    fs.writeFileSync(OUT_JSON,JSON.stringify(out,null,2));
    console.log('written:',OUT_JSON);
  }
  process.exit(pass?0:1);
})();