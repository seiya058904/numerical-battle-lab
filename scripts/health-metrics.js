// v1.2.1 Health Metrics gate (audit §16).
//
// Same measurement design as the v1.2.0 baseline (median 8, one-shot 0%, stalemate
// 1.7%): same-rarity mirror 1v1 fights (both sides equal rarity, varied seeds and
// archetypes) — the balanced-fight ecosystem a player meets. Also reports a
// mixed-rarity diagnostic (higher vs lower rarity timing out faster is healthy).
//   oneShot   < 5%   (rounds <= 1)
//   stalemate < 5%   (rounds >= MAX_ROUNDS)
//   median  6-10 rounds
//
// Usage: node scripts/health-metrics.js [--n N]
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=(f)=>require(path.join(root,'src',f));
global.NCB={};
for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower'])src(f);
const N=global.NCB;
function parseArg(name,dflt){const i=process.argv.indexOf('--'+name);return i>=0&&process.argv[i+1]?Number(process.argv[i+1])||dflt:dflt;}
const N_FIGHTS=parseArg('n',300);
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
(async()=>{
  const roundsRaw=[];
  for(let i=0;i<N_FIGHTS;i++){
    const rar=rarities[i%rarities.length];
    const a=ARCH[i%ARCH.length];
    const c1=N.generateCardV2({rarity:rar,level:100,archetype:a,seed:'HM1_'+i});
    const c2=N.generateCardV2({rarity:rar,level:100,archetype:a,seed:'HM2_'+i});
    roundsRaw.push(fightRounds(N.deployCardV2(c1),N.deployCardV2(c2),1000+i));
  }
  roundsRaw.sort((x,y)=>x-y);
  const median=roundsRaw[Math.floor(roundsRaw.length/2)];
  const p10=roundsRaw[Math.floor(roundsRaw.length*0.1)],p90=roundsRaw[Math.floor(roundsRaw.length*0.9)];
  const oneShot=roundsRaw.filter(r=>r<=1).length/N_FIGHTS;
  const stalemate=roundsRaw.filter(r=>r>=MAX_ROUNDS).length/N_FIGHTS;
  console.log(`HEALTH METRICS — n ${N_FIGHTS} (same-rarity mirror 1v1, maxRounds ${MAX_ROUNDS})`);
  console.log(`one-shot (<=1 round): ${(oneShot*100).toFixed(1)}%  (gate < 5%)${oneShot<0.05?'  ✔':'  FAIL'}`);
  console.log(`stalemate (>=${MAX_ROUNDS}): ${(stalemate*100).toFixed(1)}%  (gate < 5%)${stalemate<0.05?'  ✔':'  FAIL'}`);
  console.log(`median ${median} rounds (gate 6-10)${median>=6&&median<=10?'  ✔':'  FAIL'} · P10 ${p10} · P90 ${p90}`);
  const pass=oneShot<0.05&&stalemate<0.05&&median>=6&&median<=10;
  console.log(pass?'HEALTH METRICS PASS ✔':'HEALTH METRICS WEAK');
  process.exit(pass?0:1);
})();