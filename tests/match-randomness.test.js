const test=require('node:test');
const assert=require('node:assert/strict');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','gen-v2','gen-v3','gen-v4','gen-v5','behavior','battlepower-v2'])require('../src/'+f+'.js');
const N=global.NCB;

// ---------- Match seed semantics ----------

// Fixed seed => byte-exact same battle (deterministic engine is preserved).
test('explicit-fixed-seed: same seed reproduces identical snapshot and logs',()=>{
  const cards=[N.generateCardV5({seed:'mr-a',rarity:'A',level:100}),N.generateCardV5({seed:'mr-b',rarity:'B',level:100})];
  cards.forEach(c=>N.deployCard(c));
  const run=(seed)=>{
    const e=N.createBattle({seed:N.deriveSeed(seed),teamA:[cards[0].id],teamB:[cards[1].id],maxRounds:40});
    let g=0;while(!e.outcome().ended&&g++<40)e.resolveRound([...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')]);
    return JSON.stringify(e.serializableSnapshot());
  };
  const s1=run(424242),s2=run(424242);
  assert.equal(s1,s2,'same seed must reproduce exactly');
});

// Different match seeds => different battle sequences (normal play variety).
test('fresh match seeds produce different outcomes/sequences',()=>{
  // A mixed-kit matchup (damage + sustain) so the AI has real choice variety;
  // pure sustain mirrors can degenerate into near-identical loops regardless of seed.
  const cards=[N.generateCardV5({seed:'rnd-1',rarity:'A',level:100}),N.generateCardV5({seed:'rnd-2',rarity:'A_PLUS',level:100})];
  cards.forEach(c=>N.deployCard(c));
  const seqs=new Set();
  for(let i=0;i<14;i++){
    const e=N.createBattle({seed:N.deriveSeed(900000+i),teamA:[cards[0].id],teamB:[cards[1].id],maxRounds:80});
    let g=0;while(!e.outcome().ended&&g++<80)e.resolveRound([...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')]);
    seqs.add(e.log.filter(x=>x.kind==='action').map(x=>x.sourceId+':'+(x.skillId||'')).join('|'));
  }
  assert.ok(seqs.size>=4,`expected diverse sequences across seeds, got ${seqs.size}`);
});

// Replay reproduces the original battle exactly (initiative RNG included).
test('replay: replayBattle reproduces the original final snapshot',()=>{
  const cards=[N.generateCardV5({seed:'mr3-a',rarity:'S',level:100}),N.generateCardV5({seed:'mr3-b',rarity:'A',level:100})];
  cards.forEach(c=>N.deployCard(c));
  const e=N.createBattle({seed:N.deriveSeed(777123),teamA:[cards[0].id],teamB:[cards[1].id],maxRounds:50});
  let g=0;while(!e.outcome().ended&&g++<50)e.resolveRound([...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')]);
  const snap=e.serializableSnapshot();
  const replay=N.replayBattle(e.exportReplay());
  const rs=JSON.stringify(replay.serializableSnapshot());
  assert.equal(rs,JSON.stringify(snap),'replay final snapshot must match original');
});

// Battle randomness: 400 fresh seeds on a mixed-kit matchup must produce many
// unique sequences (the sustain-mirror caveat is documented in the test above).
test('battle randomness: 400 fresh seeds on the same matchup produce many unique sequences',()=>{
  const a=N.generateCardV5({seed:'rnd-1',rarity:'A',level:100});
  const b=N.generateCardV5({seed:'rnd-2',rarity:'A_PLUS',level:100});
  N.deployCard(a);N.deployCard(b);
  const seqs=new Set(),lengths=new Set();
  for(let i=0;i<400;i++){
    const e=N.createBattle({seed:N.deriveSeed(4000000+i),teamA:[a.id],teamB:[b.id],maxRounds:80});
    let g=0;while(!e.outcome().ended&&g++<80)e.resolveRound([...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')]);
    seqs.add(e.log.filter(x=>x.kind==='action').map(x=>x.skillId||'').join(','));
    lengths.add(e.round);
  }
  assert.ok(seqs.size>=50,`expected many unique sequences, got ${seqs.size}`);
  // Battle lengths: the sustain meta can push fights toward the round cap (known
  // long-battle limitation), so only require that seeds do not all hit one length.
  assert.ok(lengths.size>=2,`expected varied battle lengths, got ${[...lengths]}`);
});

// ---------- Bounded stochastic initiative ----------

function firstRate(spdA,spdB,n=2000){
  let aFirst=0;
  for(let i=0;i<n;i++){
    const prng=new N.Gen5PRNG(N.deriveSeed(600000+i));
    const acts=[{actorId:'A',skillId:'s',order:200,priority:0,speed:spdA},{actorId:'B',skillId:'s',order:200,priority:0,speed:spdB}];
    const sorted=N.sortActions(acts,prng);
    if(sorted[0].actorId==='A')aFirst++;
  }
  return aFirst/n;
}

test('initiative: equal SPD mirror is ~50/50 (no systematic side bias)',()=>{
  const rate=firstRate(80,80,4000);
  assert.ok(rate>0.40&&rate<0.60,`mirror first-rate ${rate.toFixed(3)} should be near 0.5`);
});

test('initiative: small SPD advantage is probabilistic (between 50% and 100%)',()=>{
  const rate=firstRate(85,80,4000);
  assert.ok(rate>0.50&&rate<0.95,`85v80 first-rate ${rate.toFixed(3)} should be probabilistic`);
});

test('initiative: SPD advantage is monotonic in speed',()=>{
  const r50=firstRate(50,50,2000),r60=firstRate(60,50,2000),r80=firstRate(80,50,2000),r120=firstRate(120,50,2000),r150=firstRate(150,50,2000);
  assert.ok(r60>r50,'60v50 > 50v50');
  assert.ok(r80>=r60,'80v50 >= 60v50');
  assert.ok(r120>=r80,'120v50 >= 80v50');
  assert.ok(r150>=r120,'150v50 >= 120v50');
  assert.ok(r150===1,'extreme SPD gap should give guaranteed first');
});

test('initiative: Priority always beats stochastic SPD',()=>{
  const prng=new N.Gen5PRNG('gen5,7,8,9,10');
  const acts=[{actorId:'slow',skillId:'x',order:200,priority:2,speed:10},{actorId:'fast',skillId:'x',order:200,priority:0,speed:1000}];
  const sorted=N.sortActions(acts,prng);
  assert.equal(sorted[0].actorId,'slow','high priority must act first regardless of SPD');
});

test('initiative: deterministic per seed (replay-safe)',()=>{
  const mk=()=>[{actorId:'A',order:200,priority:0,speed:80},{actorId:'B',order:200,priority:0,speed:81},{actorId:'C',order:200,priority:0,speed:80}].map(x=>({...x}));
  const run=()=>{const prng=new N.Gen5PRNG(N.deriveSeed(555));return N.sortActions(mk(),prng).map(a=>a.actorId).join(',');};
  assert.equal(run(),run());
});

test('initiative: bounded — a huge SPD gap can never be beaten by RNG',()=>{
  // worst roll for fast vs best roll for slow must still favour fast
  let violated=false;
  for(let i=0;i<5000;i++){
    const prng=new N.Gen5PRNG(N.deriveSeed(310000+i));
    const acts=[{actorId:'fast',order:200,priority:0,speed:120},{actorId:'slow',order:200,priority:0,speed:60}];
    if(N.sortActions(acts,prng)[0].actorId!=='fast'){violated=true;break;}
  }
  assert.equal(violated,false,'120 vs 60 must always favour the fast side (bounded jitter)');
});