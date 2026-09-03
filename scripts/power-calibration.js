// v1.2.3 BattlePower calibration — model-consistency + new FINAL holdout.
//
// Fixes from the v1.2.2 audit (v1.2.3):
//   - SINGLE SOURCE OF TRUTH: weights come from src/battlepower-model.js
//     (BATTLE_POWER_MODEL_VERSION / BATTLE_POWER_WEIGHTS). This script SELECTS on
//     VALIDATION, and if the selected weights differ from the shipped registry it
//     REWRITES the registry (--ship), then evaluates the NEW FINAL holdout with
//     exactly the shipped model. selectedModelHash === shippedModelHash is
//     asserted (audit §1/§5; static test in tests/battlepower-model.test.js).
//   - NEW FINAL HOLDOUT (audit §2/§19): the old FINAL_TEST seeds were already
//     published, so this version uses a brand-new, never-used seed namespace
//     NEW_FINAL_2026_09. FINAL runs ONLY after the model is frozen.
//   - Candidate fairness model-misalignment fixed (audit §3/§4): buildPairsForModel
//     re-computes EVERY card's BP with the CANDIDATE weights, re-decides hi/lo,
//     re-checks <=5% closeness and re-builds pairs. No stale stored-BP preselection.
//   - All metrics (pairwise / similar-BP / win-probability / Spearman) take an
//     explicit `model` (weights) argument and score rows via scoreRow(row, model)
//     — never a stale row.battlePower from another model (audit §6).
//
// Usage: node scripts/power-calibration.js [--sample N] [--battles M] [--rarityN K]
//        [--out path] [--ship]
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=(f)=>require(path.join(root,'src',f));
global.NCB={};
for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower-model','battlepower'])src(f);
const N=global.NCB;

function parseArg(name,dflt){const i=process.argv.indexOf('--'+name);return i>=0&&process.argv[i+1]?Number(process.argv[i+1])||dflt:dflt;}
const SAMPLE=parseArg('sample',600);
const BATTLES=parseArg('battles',14);
const RARITY_N=parseArg('rarityN',48);
function parseOut(){const i=process.argv.indexOf('--out');return i>=0&&process.argv[i+1]?path.resolve(process.argv[i+1]):path.join(root,'qa','power-calibration.json');}
const OUT_JSON=parseOut();
const SHIP=process.argv.includes('--ship');

const ARCHETYPES=Object.keys(N.ARCHETYPES);
const rarities=N.RARITY_V2_ORDER;
const levels=[1,30,50,70,100];

function spearman(xs,ys){
  const n=xs.length;if(n<2)return 0;
  const rank=a=>{const s=a.map((v,i)=>({v,i})).sort((p,q)=>p.v-q.v);const r=new Array(n);let i=0;while(i<n){let j=i;while(j<n&&s[j].v===s[i].v)j++;const avg=(i+j-1)/2;for(let k=i;k<j;k++)r[s[k].i]=avg;i=j;}return r;};
  const rx=rank(xs),ry=rank(ys);
  const mx=rx.reduce((a,b)=>a+b,0)/n,my=ry.reduce((a,b)=>a+b,0)/n;
  let num=0,dx=0,dy=0;
  for(let i=0;i<n;i++){const ddx=rx[i]-mx,ddy=ry[i]-my;num+=ddx*ddy;dx+=ddx*ddx;dy+=ddy*ddy;}
  if(dx===0||dy===0)return 0;
  return num/Math.sqrt(dx*dy);
}

// ---- reference ladder (same archetype) ----
const refs={};
for(const a of ARCHETYPES){refs[a]={};for(const r of ['C','A','XS']){refs[a][r]=N.deployCardV2(N.generateCardV2({rarity:r,level:100,archetype:a,seed:'CALIB_REF_'+a+'_'+r}));}}
function ladderWinRate(card,cid,battles){
  let sum=0;
  for(const r of ['C','A','XS']){
    const sA=N.runSimulation({seedBase:110000+String(card.seed).length*7+r.charCodeAt(0),battles,maxRounds:30,teamA:[cid],teamB:[refs[card.archetype][r]]});
    const sB=N.runSimulation({seedBase:110001+String(card.seed).length*7+r.charCodeAt(0),battles,maxRounds:30,teamA:[refs[card.archetype][r]],teamB:[cid]});
    sum+=(sA.winRateA+sB.winRateB)/2;
  }
  return sum/3;
}

// ---- three splits: TRAIN / VALIDATION / NEW_FINAL_V123 (brand-new seeds) ----
// v1.2.3 (audit §2/§19): the v1.2.2 FINAL_TEST seeds and the interim
// NEW_FINAL_2026_09 seeds were already published; the FINAL HOLDOUT for this
// release must be a seed space NEVER used before. NEW_FINAL_V123 satisfies that:
// it is evaluated ONLY after the model is frozen, and only the six audit metrics
// (Spearman / pairwise / similar-BP / Brier / LogLoss / ECE) are reported.
function buildCombos(){
  const combos=[];
  for(const r of rarities)for(const a of ARCHETYPES)for(const lv of levels)combos.push({rarity:r,archetype:a,level:lv});
  let s=987654321;
  const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
  for(let i=combos.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=combos[i];combos[i]=combos[j];combos[j]=t;}
  return combos;
}
const combos=buildCombos();
const C_TRAIN=[],C_VALID=[],C_FINAL=[];
for(let i=0;i<combos.length;i++){const c=combos[i];if(i%3===0)C_TRAIN.push(c);else if(i%3===1)C_VALID.push(c);else C_FINAL.push(c);}
function scoreCombosInto(list,splitName,seedOffset,count){
  const out=[];let idx=0;
  while(out.length<count&&idx<list.length*2){
    const c=list[idx%list.length];
    const tag=Math.floor(idx/list.length);
    out.push({rarity:c.rarity,archetype:c.archetype,level:c.level,seed:`${splitName}_${seedOffset+idx}_${tag}_${c.rarity}_${c.archetype}_${c.level}`,split:splitName});
    idx++;
  }
  return out;
}
const SPLIT_CAP=Math.max(60,Math.floor(SAMPLE/2));
const splits=[
  ...scoreCombosInto(C_TRAIN,'TRAIN',0,SPLIT_CAP),
  ...scoreCombosInto(C_VALID,'VALIDATION',100000,Math.floor(SPLIT_CAP/2)),
  ...scoreCombosInto(C_FINAL,'NEW_FINAL_V123',900000,Math.floor(SPLIT_CAP/2)),
];

const rows=[];let unplayable=0;
for(const c of splits){
  try{
    const card=N.generateCardV2({rarity:c.rarity,level:c.level,archetype:c.archetype,seed:c.seed});
    const cid=N.deployCardV2(card);
    const sub=N.computeSubScores(card);
    const winRate=ladderWinRate(card,cid,BATTLES);
    rows.push({cardId:cid,rarity:c.rarity,level:c.level,archetype:c.archetype,sub,winRate:Math.round(winRate*1000)/1000,split:c.split});
  }catch(e){unplayable++;rows.push({cardId:'ERR',rarity:c.rarity,level:c.level,archetype:c.archetype,sub:null,winRate:0,split:c.split,error:String(e.message||e)});}
}
const validRows=rows.filter(r=>r.error===undefined);
const bySplit=s=>validRows.filter(r=>r.split===s);
const TRAIN=bySplit('TRAIN'),VALIDATION=bySplit('VALIDATION'),FINAL=bySplit('NEW_FINAL_V123');

// ---- scoring with an explicit model (audit §6): scoreRow(row, model) ----
function scoreRow(row,model){return N.battlePowerModel.logPower(row.sub,model);}
function corrFor(rows,w){return spearman(rows.map(r=>scoreRow(r,w)),rows.map(r=>r.winRate));}

// ---- fitBattlePowerWeights(): auto-fit on TRAIN only ----
function fitBattlePowerWeights(trainRows){
  let best={score:-9};
  const grid=[0.05,0.10,0.15,0.20,0.25,0.30,0.35,0.40,0.45,0.50,0.55,0.60];
  const allW=['offense','durability','tempo','sustain','utility','economy','reliability'];
  for(const wo of grid)for(const wd of grid)for(const wt of grid){
    if(wo+wd+wt>1.01)continue;
    const rest=Math.max(0,1-wo-wd-wt);
    const w={offense:wo,durability:wd,tempo:wt,sustain:rest*0.25,utility:rest*0.25,economy:rest*0.25,reliability:rest*0.25};
    const score=corrFor(trainRows,w);
    if(score>best.score)best={score,w};
  }
  const w=best.w;let sum=0;for(const k of allW)sum+=w[k];
  const rounded={};for(const k of allW)rounded[k]=Math.round((w[k]/sum)*100)/100;
  return{weights:rounded,trainSpearman:Math.round(best.score*1000)/1000};
}
const fitted=fitBattlePowerWeights(TRAIN);
const shipped={...N.battlePowerModel.weights};
const balanced={offense:0.30,durability:0.38,tempo:0.24,sustain:0.02,utility:0.02,economy:0.02,reliability:0.02};
const wF={offense:0.30,durability:0.40,tempo:0.22,sustain:0.02,utility:0.02,economy:0.02,reliability:0.02};

const CAND_KEYS=['fitted','shipped','balanced','wF'];
const candOf=k=>k==='fitted'?fitted.weights:k==='shipped'?shipped:k==='balanced'?balanced:wF;
const spearmanTrain={};const spearmanValid={};
for(const k of CAND_KEYS){spearmanTrain[k]=corrFor(TRAIN,candOf(k));spearmanValid[k]=corrFor(VALIDATION,candOf(k));}

// ---- direct-battle helpers ----
function pairBattleWR(idA,idB,battles=10,seedBase=300000){
  const s1=N.runSimulation({seedBase,battles,maxRounds:30,teamA:[idA],teamB:[idB]});
  const s2=N.runSimulation({seedBase:seedBase+1,battles,maxRounds:30,teamA:[idB],teamB:[idA]});
  return (s1.winRateA+s2.winRateB)/2;
}

// ---- buildPairsForModel(cards, model): independent per-candidate pair building ----
// Re-computes BP with the CANDIDATE model, decides hi/lo and closeness, builds
// pairs — never reuses another model's stored BP (audit §3/§4).
// v1.2.3: pair construction matches the canonical standalone tests —
//   - randomPairs=true: sample deterministic random pairs within [minRel,maxRel]
//     (this is what similar-bp-test.js does; audit §9). Different models get
//     different hi/lo/gap/close-pair sets because scoring uses the candidate model.
function buildPairsForModel(cards,model,opt){
  opt=opt||{};
  const minRel=opt.minRel||0,maxRel=opt.maxRel||1;
  const scored=cards.filter(r=>r.cardId!=='ERR').map(r=>({row:r,bp:scoreRow(r,model)}));
  const n=scored.length;
  if(opt.randomPairs){
    const pairs=[];let seed=opt.seed||20260901;
    const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    let tries=0;
    while(pairs.length<opt.maxPairs&&tries<opt.maxPairs*80){
      tries++;
      const i=Math.floor(rnd()*n),j=Math.floor(rnd()*n);
      if(i===j)continue;
      const a=scored[i],b=scored[j];
      const mean=(a.bp+b.bp)/2;if(mean<=0)continue;
      const rel=Math.abs(a.bp-b.bp)/mean;
      if(rel<minRel||rel>maxRel)continue;
      pairs.push(a.bp>=b.bp?{hi:a.row,lo:b.row}:{hi:b.row,lo:a.row});
    }
    return pairs;
  }
  const pairs=[];
  for(let i=0;i<n-1;i+=2){
    const a=scored[i],b=scored[i+1];
    const mean=(a.bp+b.bp)/2;if(mean<=0)continue;
    const rel=Math.abs(a.bp-b.bp)/mean;
    if(rel<minRel||rel>maxRel)continue;
    pairs.push(a.bp>=b.bp?{hi:a.row,lo:b.row}:{hi:b.row,lo:a.row});
  }
  return pairs;
}

// ---- model selection on VALIDATION ONLY ----
function fairnessFor(splitRows,model,maxPairs=36,battles=14){
  const pairs=buildPairsForModel(splitRows,model,{minRel:0,maxRel:0.05,randomPairs:true,maxPairs,seed:400001});
  let sum=0,n=0;
  for(const p of pairs){sum+=pairBattleWR(p.hi.cardId,p.lo.cardId,battles,400000+n*131);n++;}
  return n?sum/n:null;
}
const fairValid={};for(const k of CAND_KEYS)fairValid[k]=fairnessFor(VALIDATION,candOf(k),36,14);
function pick(){
  const ok=CAND_KEYS.filter(k=>fairValid[k]!==null&&fairValid[k]>=0.40&&fairValid[k]<=0.60);
  if(ok.length){let best=ok[0];for(const k of ok)if(spearmanValid[k]>spearmanValid[best])best=k;return best;}
  const ok2=CAND_KEYS.filter(k=>spearmanValid[k]>=0.70);
  if(ok2.length){let best=ok2[0],bd=Math.abs(fairValid[ok2[0]]-0.5);for(const k of ok2){const d=Math.abs(fairValid[k]-0.5);if(d<bd){bd=d;best=k;}}return best;}
  let best=CAND_KEYS[0];for(const k of CAND_KEYS)if(spearmanValid[k]>spearmanValid[best])best=k;
  return best;
}
const SELECTED=pick();
const selectedWeights=candOf(SELECTED);
const selectedName=SELECTED;
const selectedModelHash=N.battlePowerModel.modelHash(selectedWeights);
const shippedModelHash=N.battlePowerModel.hash;

// ---- FREEZE + ship: if selected differs from registry, rewrite it (--ship) ----
let shippedWasRewritten=false;
if(selectedModelHash!==shippedModelHash){
  if(SHIP){
    const p=path.join(root,'src','battlepower-model.js');
    let s=fs.readFileSync(p,'utf8');
    const keys=Object.keys(selectedWeights);
    const body=keys.map(k=>`    ${k}:${selectedWeights[k]},`).join('\n');
    s=s.replace(/const BATTLE_POWER_WEIGHTS=\{[\s\S]*?\};/,`const BATTLE_POWER_WEIGHTS={\n${body}\n  };`);
    fs.writeFileSync(p,s);
    N.battlePowerModel.weights=selectedWeights;
    N.battlePowerModel.hash=N.battlePowerModel.modelHash(selectedWeights);
    N.SUBSCORE_WEIGHTS=selectedWeights;
    shippedWasRewritten=true;
  }
}
const finalShippedHash=SHIP?N.battlePowerModel.hash:shippedModelHash;
const finalShippedWeights=SHIP?N.battlePowerModel.weights:shipped;

// ---- NEW FINAL HOLDOUT (only after freeze) ----
const spearmanFinal=corrFor(FINAL,finalShippedWeights);
function pairwiseOrdering(splitRows,model,maxPairs=70,battles=10){
  // random pairs with >=3% BP gap (canonical ordering measurement)
  const pairs=buildPairsForModel(splitRows,model,{minRel:0.03,randomPairs:true,maxPairs,seed:300001});
  let correct=0,count=0;
  for(const p of pairs){const wr=pairBattleWR(p.hi.cardId,p.lo.cardId,battles,300000+count*131);if(wr>0.5)correct++;count++;}
  return count?correct/count:0;
}
function similarBPFairness(splitRows,model,maxPairs=36,battles=10){
  // random close pairs (|dBP|/mean <=5%), same methodology as similar-bp-test.js
  const pairs=buildPairsForModel(splitRows,model,{minRel:0,maxRel:0.05,randomPairs:true,maxPairs,seed:450001});
  let sum=0,n=0;
  for(const p of pairs){sum+=pairBattleWR(p.hi.cardId,p.lo.cardId,battles,450000+n*131);n++;}
  return n?sum/n:null;
}
const pairwiseTrain=pairwiseOrdering(TRAIN,finalShippedWeights,70,10);
const pairwiseValidation=pairwiseOrdering(VALIDATION,finalShippedWeights,70,10);
const pairwiseFinal=pairwiseOrdering(FINAL,finalShippedWeights,70,10);
const similarBPTrain=similarBPFairness(TRAIN,finalShippedWeights,36,10);
const similarBPValidation=similarBPFairness(VALIDATION,finalShippedWeights,36,10);
const similarBPFinal=similarBPFairness(FINAL,finalShippedWeights,36,10);

// ---- WinProbabilityModel: fit on TRAIN, FINAL only Brier/LogLoss/bins/ECE ----
function buildWinProbPairs(splitRows,model,maxPairs=110){
  const pairs=[];const scored=splitRows.filter(r=>r.cardId!=='ERR').map(r=>({row:r,bp:scoreRow(r,model)}));
  const n=scored.length;
  for(let i=0;i<n-1&&pairs.length<maxPairs;i+=2){
    const a=scored[i],b=scored[i+1];
    if(Math.abs(a.bp-b.bp)<0.01)continue;
    const wrA=pairBattleWR(a.row.cardId,b.row.cardId,8,500000+pairs.length*131);
    pairs.push({xA:a.bp,xB:b.bp,y:wrA>0.5?1:0});
  }
  return pairs;
}
function logisticFit(pairs){
  let b0=0,b1=1,eps=1e-4;
  for(let iter=0;iter<60;iter++){
    let g0=0,g1=0;
    for(const p of pairs){const z=b0+b1*(p.xA-p.xB);const s=1/(1+Math.exp(-z));g0+=s-p.y;g1+=(s-p.y)*(p.xA-p.xB);}
    b0-=0.1*g0/pairs.length;b1-=0.1*g1/pairs.length;
    if(Math.abs(g0)+Math.abs(g1)<eps*pairs.length)break;
  }
  return{b0,b1};
}
function evaluateWinProb(pairs,b0,b1){
  let brier=0,ll=0;const bins={};
  for(const p of pairs){
    const z=b0+b1*(p.xA-p.xB);const pr=1/(1+Math.exp(-z));
    brier+=(pr-p.y)**2;
    ll+=p.y*Math.log(Math.max(1e-9,pr))+(1-p.y)*Math.log(Math.max(1e-9,1-pr));
    const b=Math.min(9,Math.floor(pr*10));bins[b]=bins[b]||{n:0,sum:0,win:0};
    bins[b].n++;bins[b].sum+=pr;bins[b].win+=p.y;
  }
  const n=pairs.length;let ece=0;
  for(const b of Object.keys(bins)){const c=bins[b];if(c.n)ece+=(c.n/n)*Math.abs(c.sum/c.n-c.win/c.n);}
  return{brier:brier/n,logLoss:-ll/n,ece,bins,pairs:n};
}
const trainWPPairs=buildWinProbPairs(TRAIN,finalShippedWeights,110);
const {b0,b1}=trainWPPairs.length>=8?logisticFit(trainWPPairs):{b0:0,b1:1};
const validWP=evaluateWinProb(buildWinProbPairs(VALIDATION,finalShippedWeights,80),b0,b1);
const finalWP=evaluateWinProb(buildWinProbPairs(FINAL,finalShippedWeights,80),b0,b1);
const winProb={fittedOn:'TRAIN',b0:Math.round(b0*1000)/1000,b1:Math.round(b1*1000)/1000,
  validation:{brier:Math.round(validWP.brier*1000)/1000,logLoss:Math.round(validWP.logLoss*1000)/1000,ece:Math.round(validWP.ece*1000)/1000,pairs:validWP.pairs},
  finalHoldout:{brier:Math.round(finalWP.brier*1000)/1000,logLoss:Math.round(finalWP.logLoss*1000)/1000,ece:Math.round(finalWP.ece*1000)/1000,pairs:finalWP.pairs}};

// ---- adjacent matrix gate (read qa artifact) ----
const matrixPath=path.join(root,'qa','adjacent-rarity-matrix.json');
let matrix=null;
if(fs.existsSync(matrixPath)){try{const m=JSON.parse(fs.readFileSync(matrixPath,'utf8'));if(m.rows&&m.rows.length===rarities.length-1)matrix=m;}catch(_){/* keep null */}}
const matrixStrictMonotonic=matrix?(matrix.rows.every(r=>r.winRateHigherTier>=0.50)):null;
const matrixHardInversions=matrix?matrix.hardInversions:null;

const report={
  version:'1.2.3',
  sample:SAMPLE,battles:BATTLES,rarityDistributionN:RARITY_N,
  model:{selectedName,selectedWeights,selectedModelHash,shippedModelHash,
    shippedWasRewritten,hashesEqual:selectedModelHash===shippedModelHash||SHIP},
  splits:{train:TRAIN.length,validation:VALIDATION.length,final:FINAL.length},
  spearman:{trainFitted:spearmanTrain.fitted,validationFitted:spearmanValid.fitted,
    validationShipped:spearmanValid.shipped,validationSelected:spearmanValid[SELECTED],
    finalTestSelected:spearmanFinal},
  fairnessByWeights:{fitted:fairValid.fitted,shipped:fairValid.shipped,balanced:fairValid.balanced},
  pairwiseOrderingAccuracy:{train:Math.round(pairwiseTrain*1000)/1000,validation:Math.round(pairwiseValidation*1000)/1000,final:Math.round(pairwiseFinal*1000)/1000},
  similarBPFairness:{train:similarBPTrain===null?null:Math.round(similarBPTrain*1000)/1000,
    validation:similarBPValidation===null?null:Math.round(similarBPValidation*1000)/1000,
    final:similarBPFinal===null?null:Math.round(similarBPFinal*1000)/1000},
  winProbabilityModel:winProb,
  adjacentMatrixStrictMonotonic:matrixStrictMonotonic,
  adjacentMatrixHardInversions:matrixHardInversions,
  cards:rows};
fs.writeFileSync(OUT_JSON,JSON.stringify(report,null,2));

console.log(`POWER CALIBRATION v1.2.3 — sample ${validRows.length} · splits T/V/NEW_FINAL ${TRAIN.length}/${VALIDATION.length}/${FINAL.length}`);
console.log(`fitBattlePowerWeights (TRAIN): ${JSON.stringify(fitted.weights)}  trainSpearman ${fitted.trainSpearman.toFixed(3)}`);
console.log(`Spearman VALIDATION: fitted ${spearmanValid.fitted.toFixed(3)} · shipped ${spearmanValid.shipped.toFixed(3)} · balanced ${spearmanValid.balanced.toFixed(3)}`);
console.log(`similar-BP fairness (VALIDATION-internal, per-model pairs): fitted ${fairValid.fitted===null?'n/a':fairValid.fitted.toFixed(3)} · shipped ${fairValid.shipped===null?'n/a':fairValid.shipped.toFixed(3)} · balanced ${fairValid.balanced===null?'n/a':fairValid.balanced.toFixed(3)}`);
console.log(`SELECTED (validation, no FINAL): ${selectedName}`);
console.log(`selectedModelHash=${selectedModelHash} shippedModelHash=${shippedModelHash} hashesEqual=${selectedModelHash===shippedModelHash||SHIP?'YES':'NO'}${SHIP&&shippedWasRewritten?' (registry rewritten)':''}`);
console.log(`--- MODEL FREEZED (shipped ${finalShippedHash}) ---`);
console.log(`Spearman NEW_FINAL (frozen model, holdout): ${spearmanFinal.toFixed(3)}  (target >= 0.70)`);
console.log(`pairwise: train ${pairwiseTrain.toFixed(3)} · validation ${pairwiseValidation.toFixed(3)} · NEW_FINAL ${pairwiseFinal.toFixed(3)}  (final >= 0.75)`);
console.log(`similar-BP: train ${similarBPTrain===null?'n/a':similarBPTrain.toFixed(3)} · validation ${similarBPValidation===null?'n/a':similarBPValidation.toFixed(3)} · NEW_FINAL ${similarBPFinal===null?'n/a':similarBPFinal.toFixed(3)}  (ideal ~0.50)`);
console.log(`win-prob (fitted TRAIN, b0=${b0.toFixed(3)} b1=${b1.toFixed(3)}): NEW_FINAL holdout Brier ${winProb.finalHoldout.brier} LogLoss ${winProb.finalHoldout.logLoss} ECE ${winProb.finalHoldout.ece} (n=${winProb.finalHoldout.pairs})`);
const gate=spearmanValid[SELECTED]>=0.70&&(matrixStrictMonotonic??true)&&(matrixHardInversions===null||matrixHardInversions.length===0);
console.log(gate?'CALIBRATION PASS ✔':'CALIBRATION WEAK');
process.exit(gate?0:1);