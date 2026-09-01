const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
global.NCB={};
for(const f of ['kernel.js','components.js','rules.js','content.js','status-runtime.js','formula.js','validator.js','effects.js','engine.js'])require(path.join(root,'src',f));
const N=global.NCB;

function finiteObject(obj,pathName='result'){
  if(obj===null||obj===undefined)return;
  if(typeof obj==='number'&&!Number.isFinite(obj))throw new Error(`${pathName} is non-finite`);
  if(Array.isArray(obj))return obj.forEach((v,i)=>finiteObject(v,`${pathName}[${i}]`));
  if(typeof obj==='object')for(const [k,v] of Object.entries(obj))finiteObject(v,`${pathName}.${k}`);
}
function run(label,opts){
  const started=Date.now();
  const result=N.runSimulation(opts);
  finiteObject(result,label);
  if(result.battles!==opts.battles)throw new Error(`${label}: expected ${opts.battles} battles, got ${result.battles}`);
  if(result.winsA+result.winsB+result.draws!==result.battles)throw new Error(`${label}: outcomes do not sum to battles`);
  return{label,elapsedMs:Date.now()-started,...result};
}

const defaultA=N.DEFAULT_TEAM_A.slice(), defaultB=N.DEFAULT_TEAM_B.slice();
const sixA=['vanguard','ranger','medic','duelist','templar','berserker'];
const sixB=['runeknight','pyromancer','alchemist','assassin','warden','oracle'];
const scenarios=[
  run('default-4v4-200',{battles:200,seedBase:91000,teamA:defaultA,teamB:defaultB,difficultyA:'hard',difficultyB:'hard',maxRounds:50}),
  run('swapped-4v4-200',{battles:200,seedBase:92000,teamA:defaultB,teamB:defaultA,difficultyA:'hard',difficultyB:'hard',maxRounds:50}),
  run('six-v-six-50',{battles:50,seedBase:93000,teamA:sixA,teamB:sixB,difficultyA:'normal',difficultyB:'normal',maxRounds:60}),
  run('one-v-six-20',{battles:20,seedBase:94000,teamA:['berserker'],teamB:sixB,difficultyA:'hard',difficultyB:'hard',maxRounds:60}),
  run('six-v-one-20',{battles:20,seedBase:95000,teamA:sixA,teamB:['warden'],difficultyA:'hard',difficultyB:'hard',maxRounds:60}),
];

const combinedDefaultAWin=(scenarios[0].winsA + scenarios[1].winsB)/(scenarios[0].battles+scenarios[1].battles);
if(combinedDefaultAWin<0.38||combinedDefaultAWin>0.62)throw new Error(`default composition combined win rate out of broad band: ${combinedDefaultAWin}`);
if(scenarios[0].draws/scenarios[0].battles>0.1||scenarios[1].draws/scenarios[1].battles>0.1)throw new Error('default scenario draw rate unexpectedly high');

const determinism=[];
for(let i=0;i<25;i++){
  const seed=`gen5,${101+i},${211+i},${307+i},${401+i}`;
  const a=N.createBattle({seed,teamA:defaultA,teamB:defaultB});
  const b=N.createBattle({seed,teamA:defaultA,teamB:defaultB});
  for(let round=0;round<8&&!a.outcome().ended&&!b.outcome().ended;round++){
    const aa=[...N.planAI(a,'A','hard'),...N.planAI(a,'B','hard')];
    const bb=[...N.planAI(b,'A','hard'),...N.planAI(b,'B','hard')];
    if(JSON.stringify(aa)!==JSON.stringify(bb))throw new Error(`determinism actions diverged at case ${i} round ${round}`);
    a.resolveRound(aa); b.resolveRound(bb);
  }
  const sa=JSON.stringify(a.serializableSnapshot()), sb=JSON.stringify(b.serializableSnapshot());
  if(sa!==sb)throw new Error(`determinism state diverged at case ${i}`);
  determinism.push({seed,round:a.round,outcome:a.outcome()});
}

const report={generatedAt:new Date().toISOString(),parser:N.formulaEngineInfo(),catalog:{parameters:Object.keys(N.PARAMETER_CATALOG).length,effects:Object.keys(N.EFFECT_COMPONENTS).length,conditions:Object.keys(N.CONDITION_COMPONENTS).length,targets:Object.keys(N.TARGET_COMPONENTS).length,events:Object.keys(N.EVENT_COMPONENTS).length,units:Object.keys(N.UNIT_DEFS).length,skills:Object.keys(N.SKILL_DEFS).length,statuses:Object.keys(N.STATUS_DEFS).length},combinedDefaultCompositionWinRate:Number(combinedDefaultAWin.toFixed(4)),scenarios,determinismCases:determinism.length};
fs.mkdirSync(path.join(root,'qa'),{recursive:true});
fs.writeFileSync(path.join(root,'qa/stress-results.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({combinedDefaultCompositionWinRate:report.combinedDefaultCompositionWinRate,scenarios:scenarios.map(x=>({label:x.label,winsA:x.winsA,winsB:x.winsB,draws:x.draws,winRateA:x.winRateA,avgRounds:x.avgRounds,elapsedMs:x.elapsedMs})),determinismCases:determinism.length},null,2));
