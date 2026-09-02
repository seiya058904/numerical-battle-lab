// v1.2.2 BattlePower Monte Carlo calibration — validation methodology hardening.
//
// Fixes from the v1.2.1 audit (v1.2.2):
//   - FINAL_TEST LEAK FIXED: model selection now uses ONLY TRAIN + VALIDATION.
//     The v1.2.1 script computed fairnessFor(VALIDATION, FINAL, ...) during the
//     pick() model-selection step, so FINAL cards participated in choosing the
//     model and "FINAL_TEST Spearman" was not a true holdout. Correct flow:
//
//       TRAIN        -> fitBattlePowerWeights() fits sub-score weights
//       VALIDATION   -> choose model (Spearman + similar-BP fairness, using ONLY
//                       VALIDATION-internal disjoint pairs)
//       FREEZE MODEL -> selected weights
//       FINAL_TEST   -> ONLY final evaluation (Spearman / pairwise / similar-BP /
//                       win-probability), never used for fitting or selection.
//
//   - Pairwise / Similar-BP are split into train / validation / final, each
//     measured on pairs built INSIDE that split only (no cross-split pairing).
//     Release reports pairwiseFinal and similarBPFinal.
//   - WinProbabilityModel: logistic b0/b1 fitted on TRAIN pairs; VALIDATION is
//     sanity/model-selection; FINAL only computes Brier / LogLoss / calibration
//     bins / ECE with the FROZEN coefficients (never refit on FINAL).
//   - All archetypes are used via Object.keys(NCB.ARCHETYPES) (7, incl. Support).
//
// Measurement: same-archetype fair mirrors (C/A/XS ladder refs per archetype),
// 正反位 merged. The dedicated Lv100 rarity distribution uses the same per-archetype
// refs so per-card ratings are comparable across rarities.
//
// Usage: node scripts/power-calibration.js [--sample N] [--battles M]
//   --sample  default 600 -> cards per overall ladder sample (T/V/F splits)
//   --battles default 14   -> battles per direction for the ladder measurement
//   --rarityN default 48   -> cards per rarity in the dedicated Lv100 distribution
//   --out <path>           -> JSON output (default qa/power-calibration.json)
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=(f)=>require(path.join(root,'src',f));
global.NCB={};
for(const f of ['kernel','components','rules','content','status-runtime','validator','formula','effects','engine','power','gen-stats','gen-skills','generator','gen-names','gen-v2','battlepower'])src(f);
const N=global.NCB;

function parseArg(name,dflt){const i=process.argv.indexOf('--'+name);return i>=0&&process.argv[i+1]?Number(process.argv[i+1])||dflt:dflt;}
const SAMPLE=parseArg('sample',600);
const BATTLES=parseArg('battles',14);
const RARITY_N=parseArg('rarityN',48);
function parseOut(){const i=process.argv.indexOf('--out');return i>=0&&process.argv[i+1]?path.resolve(process.argv[i+1]):path.join(root,'qa','power-calibration.json');}
const OUT_JSON=parseOut();

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

// ---- measure a card against its own archetype ladder ----
function ladderWinRate(card,cid,battles){
  let sum=0;
  for(const r of ['C','A','XS']){
    const sA=N.runSimulation({seedBase:110000+String(card.seed).length*7+r.charCodeAt(0),battles,maxRounds:30,teamA:[cid],teamB:[refs[card.archetype][r]]});
    const sB=N.runSimulation({seedBase:110001+String(card.seed).length*7+r.charCodeAt(0),battles,maxRounds:30,teamA:[refs[card.archetype][r]],teamB:[cid]});
    sum+=(sA.winRateA+sB.winRateB)/2;
  }
  return sum/3;
}

// ---- three fixed seed-disjoint splits (TRAIN / VALIDATION / FINAL_TEST) ----
function buildCombos(){
  const combos=[];
  for(const r of rarities)for(const a of ARCHETYPES)for(const lv of levels)combos.push({rarity:r,archetype:a,level:lv});
  let s=1234567;
  const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
  for(let i=combos.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=combos[i];combos[i]=combos[j];combos[j]=t;}
  return combos;
}
const combos=buildCombos();
const COMBO_TRAIN=[],COMBO_VALID=[],COMBO_FINAL=[];
for(let i=0;i<combos.length;i++){const c=combos[i];if(i%3===0)COMBO_TRAIN.push(c);else if(i%3===1)COMBO_VALID.push(c);else COMBO_FINAL.push(c);}
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
  ...scoreCombosInto(COMBO_TRAIN,'TRAIN',0,SPLIT_CAP),
  ...scoreCombosInto(COMBO_VALID,'VALIDATION',100000,Math.floor(SPLIT_CAP/2)),
  ...scoreCombosInto(COMBO_FINAL,'FINAL_TEST',200000,Math.floor(SPLIT_CAP/2)),
];

const rows=[];let unplayable=0;
for(const c of splits){
  try{
    const card=N.generateCardV2({rarity:c.rarity,level:c.level,archetype:c.archetype,seed:c.seed});
    const cid=N.deployCardV2(card);
    const bp=N.battlePower(card).power;
    const winRate=ladderWinRate(card,cid,BATTLES);
    rows.push({cardId:cid,rarity:c.rarity,level:c.level,archetype:c.archetype,battlePower:Math.round(bp),winRate:Math.round(winRate*1000)/1000,split:c.split});
  }catch(e){unplayable++;rows.push({cardId:'ERR',rarity:c.rarity,level:c.level,archetype:c.archetype,battlePower:0,winRate:0,split:c.split,error:String(e.message||e)});}
}
const validRows=rows.filter(r=>r.error===undefined&&r.battlePower>0);
const bySplit=s=>validRows.filter(r=>r.split===s);
const TRAIN=bySplit('TRAIN'),VALIDATION=bySplit('VALIDATION'),FINAL=bySplit('FINAL_TEST');

function subOf(r){return N.battlePower(N.generateCardV2({rarity:r.rarity,level:r.level,archetype:r.archetype,seed:r.seed})).subScores;}
const withSubs=TRAIN.map(r=>({...r,sub:subOf(r)}));
const valSubs=VALIDATION.map(r=>({...r,sub:subOf(r)}));
const finSubs=FINAL.map(r=>({...r,sub:subOf(r)}));

// ---- fitBattlePowerWeights(): auto-fit on TRAIN only ----
const l=v=>Math.log(Math.max(0.01,v));
function aggPower(card,w){
  const s=card.sub;
  return w.offense*l(s.offense)+w.durability*l(s.durability)+w.tempo*l(s.tempo)
    +w.sustain*l(s.sustain)+w.utility*l(s.utility)+w.economy*l(s.economy)+w.reliability*l(s.reliability);
}
function fitBattlePowerWeights(trainRows){
  let best={score:-9};
  const grid=[0.05,0.10,0.15,0.20,0.25,0.30,0.35,0.40,0.45,0.50,0.55,0.60];
  const allW=['offense','durability','tempo','sustain','utility','economy','reliability'];
  for(const wo of grid)for(const wd of grid)for(const wt of grid){
    if(wo+wd+wt>1.01)continue;
    const rest=Math.max(0,1-wo-wd-wt);
    const w={offense:wo,durability:wd,tempo:wt,sustain:rest*0.25,utility:rest*0.25,economy:rest*0.25,reliability:rest*0.25};
    const score=spearman(trainRows.map(r=>aggPower(r,w)),trainRows.map(r=>r.winRate));
    if(score>best.score)best={score,w};
  }
  const w=best.w;let sum=0;for(const k of allW)sum+=w[k];
  const rounded={};for(const k of allW)rounded[k]=Math.round((w[k]/sum)*100)/100;
  return{weights:rounded,trainSpearman:Math.round(best.score*1000)/1000};
}
const fitted=fitBattlePowerWeights(withSubs);
// The SHIPPED product weights (src/battlepower.js SUBSCORE_WEIGHTS) — the model that
// actually ships. Candidates explored are all VALIDATED (never fit) on VALIDATION.
const committed={offense:0.22,durability:0.45,tempo:0.25,sustain:0.02,utility:0.02,economy:0.02,reliability:0.02};
const balanced={offense:0.30,durability:0.38,tempo:0.24,sustain:0.02,utility:0.02,economy:0.02,reliability:0.02};
const wA={offense:0.22,durability:0.45,tempo:0.25,sustain:0.02,utility:0.02,economy:0.02,reliability:0.02};
const wF={offense:0.30,durability:0.40,tempo:0.22,sustain:0.02,utility:0.02,economy:0.02,reliability:0.02};

function corrFor(rows,w){return spearman(rows.map(r=>aggPower(r,w)),rows.map(r=>r.winRate));}
const CAND_KEYS=['fitted','committed','balanced','wA','wF'];
const candOf=k=>k==='fitted'?fitted.weights:k==='committed'?committed:k==='balanced'?balanced:k==='wA'?wA:wF;
const spearmanTrain={};const spearmanValid={};
for(const k of CAND_KEYS){spearmanTrain[k]=corrFor(withSubs,candOf(k));spearmanValid[k]=corrFor(valSubs,candOf(k));}

// ---- Direct-battle helpers (all splits) ----
function pairBattleWR(idA,idB,battles=10,seedBase=300000){
  const s1=N.runSimulation({seedBase,battles,maxRounds:30,teamA:[idA],teamB:[idB]});
  const s2=N.runSimulation({seedBase:seedBase+1,battles,maxRounds:30,teamA:[idB],teamB:[idA]});
  return (s1.winRateA+s2.winRateB)/2; // win rate of idA over idB
}
const subOfRow=r=>r.sub||subOf(r);

// Build DETERMINISTIC DISJOINT pairs INSIDE one split (no cross-split borrowing).
// Returns a list of {hi,lo} row references (higher-BP first) whose BP differs by
// the given relative threshold regime.
function disjointPairs(splitRows,opt){
  opt=opt||{};
  const minRel=opt.minRel||0; // minimum |dB|/mean (0 = any), used to split pairwise vs similar
  const maxRel=opt.maxRel||1; // maximum |dB|/mean
  const pairs=[];
  const n=splitRows.length;
  for(let i=0;i<n-1;i+=2){
    const a=splitRows[i],b=splitRows[i+1];
    if(a.cardId==='ERR'||b.cardId==='ERR')continue;
    const meanBP=(a.battlePower+b.battlePower)/2;if(meanBP<=0)continue;
    const rel=Math.abs(a.battlePower-b.battlePower)/meanBP;
    if(rel<minRel||rel>maxRel)continue;
    pairs.push(a.battlePower>=b.battlePower?{hi:a,lo:b}:{hi:b,lo:a});
  }
  return pairs;
}

// ---- model selection on VALIDATION ONLY (audit §14) ----
// Fairness (similar-BP) measured with VALIDATION-internal disjoint pairs only —
// FINAL cards never participate in model selection.
function fairnessFor(splitRows,w,maxPairs=36,battles=14){
  const pairs=disjointPairs(splitRows,{minRel:0,maxRel:0.05}).slice(0,maxPairs);
  let sum=0,n=0;
  for(const p of pairs){
    const hiBP=aggPower({...p.hi,sub:subOfRow(p.hi)},w),loBP=aggPower({...p.lo,sub:subOfRow(p.lo)},w);
    // pair was selected by stored BP (same weights), re-check with candidate w
    const mean=(hiBP+loBP)/2;if(mean<=0)continue;
    if(Math.abs(hiBP-loBP)/mean>0.05)continue;
    sum+=pairBattleWR(p.hi.cardId,p.lo.cardId,battles,400000+n*131);
    n++;
  }
  return n?sum/n:null;
}
const fairValid={};for(const k of CAND_KEYS)fairValid[k]=fairnessFor(VALIDATION,candOf(k),36,14);
function pick(){
  const ok=CAND_KEYS.filter(k=>fairValid[k]!==null&&fairValid[k]>=0.40&&fairValid[k]<=0.60);
  if(ok.length){
    let best=ok[0];for(const k of ok)if(spearmanValid[k]>spearmanValid[best])best=k;
    return best;
  }
  const ok2=CAND_KEYS.filter(k=>spearmanValid[k]>=0.70);
  if(ok2.length){
    let best=ok2[0],bd=Math.abs(fairValid[ok2[0]]-0.5);
    for(const k of ok2){const d=Math.abs(fairValid[k]-0.5);if(d<bd){bd=d;best=k;}}
    return best;
  }
  let best=CAND_KEYS[0];for(const k of CAND_KEYS)if(spearmanValid[k]>spearmanValid[best])best=k;
  return best;
}
const SELECTED=pick();
const selectedWeights=candOf(SELECTED);
const selectedName=SELECTED;
// ---- FREEZE MODEL ----
// From this point FINAL is ONLY evaluated; no further fitting/selection.

// ---- Spearman (FINAL only, frozen model) ----
const spearmanFinal=corrFor(finSubs,selectedWeights);

// ---- Pairwise ordering accuracy (audit §11): split train/validation/final ----
// Pairwise = cards with DIFFERENT BP (rel >= 3%); the higher-BP card must win >50%.
function pairwiseOrdering(splitRows,maxPairs=70,battles=10){
  const pairs=disjointPairs(splitRows,{minRel:0.03}).slice(0,maxPairs);
  let correct=0,count=0;
  for(const p of pairs){
    const wr=pairBattleWR(p.hi.cardId,p.lo.cardId,battles,300000+count*131);
    if(wr>0.5)correct++;
    count++;
  }
  return count?correct/count:0;
}
const pairwiseTrain=pairwiseOrdering(TRAIN,70,10);
const pairwiseValidation=pairwiseOrdering(VALIDATION,70,10);
const pairwiseFinal=pairwiseOrdering(FINAL,70,10);

// ---- Similar-BP fairness (audit §9): split train/validation/final ----
// |dBP|/mean <= 5% pairs; higher-BP card win rate ideal ~0.50.
function similarBPFairness(splitRows,maxPairs=36,battles=10){
  const pairs=disjointPairs(splitRows,{minRel:0,maxRel:0.05}).slice(0,maxPairs);
  let sum=0,n=0;
  for(const p of pairs){
    sum+=pairBattleWR(p.hi.cardId,p.lo.cardId,battles,450000+n*131);
    n++;
  }
  return n?sum/n:null;
}
const similarBPTrain=similarBPFairness(TRAIN,36,10);
const similarBPValidation=similarBPFairness(VALIDATION,36,10);
const similarBPFinal=similarBPFairness(FINAL,36,10);

// ---- WinProbabilityModel proper holdout (audit §12) ----
// TRAIN: fit logistic b0/b1. VALIDATION: sanity. FINAL: ONLY Brier/LogLoss/bins/ECE.
function buildWinProbPairs(splitRows,maxPairs=110){
  const pairs=[];const n=splitRows.length;
  for(let i=0;i<n-1&&pairs.length<maxPairs;i+=2){
    const a=splitRows[i],b=splitRows[i+1];
    if(a.cardId==='ERR'||b.cardId==='ERR'||Math.abs(a.battlePower-b.battlePower)<1)continue;
    const wrA=pairBattleWR(a.cardId,b.cardId,8,500000+pairs.length*131);
    pairs.push({xA:Math.log(a.battlePower),xB:Math.log(b.battlePower),y:wrA>0.5?1:0});
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
  const n=pairs.length;
  // ECE: mean |predicted - empirical| per bin (weighted by bin size)
  let ece=0;
  for(const b of Object.keys(bins)){const c=bins[b];if(c.n)ece+=(c.n/n)*Math.abs(c.sum/c.n-c.win/c.n);}
  return{brier:brier/n,logLoss:-ll/n,ece,bins,pairs:n};
}
const trainWPPairs=buildWinProbPairs(TRAIN,110);
const {b0,b1}=trainWPPairs.length>=8?logisticFit(trainWPPairs):{b0:0,b1:1};
const validWP=evaluateWinProb(buildWinProbPairs(VALIDATION,80),b0,b1);
const finalWP=evaluateWinProb(buildWinProbPairs(FINAL,80),b0,b1);
const winProb={
  fittedOn:'TRAIN',b0:Math.round(b0*1000)/1000,b1:Math.round(b1*1000)/1000,
  validation:{brier:Math.round(validWP.brier*1000)/1000,logLoss:Math.round(validWP.logLoss*1000)/1000,ece:Math.round(validWP.ece*1000)/1000,pairs:validWP.pairs},
  finalHoldout:{brier:Math.round(finalWP.brier*1000)/1000,logLoss:Math.round(finalWP.logLoss*1000)/1000,ece:Math.round(finalWP.ece*1000)/1000,pairs:finalWP.pairs},
};

// ---- dedicated LARGE Lv100 rarity distribution (strict + trend monotonicity) ----
function rarityDistribution(){
  const byR={};
  const perArch=Math.max(2,Math.floor(RARITY_N/ARCHETYPES.length));
  for(const r of rarities){
    byR[r]=[];
    for(const a of ARCHETYPES)for(let k=0;k<perArch;k++){
      const card=N.generateCardV2({rarity:r,level:100,archetype:a,seed:'RD_'+r+'_'+a+'_'+k});
      const cid=N.deployCardV2(card);
      byR[r].push(ladderWinRate(card,cid,BATTLES));
    }
  }
  const means={};for(const r of rarities){const a=byR[r];means[r]=a.reduce((x,y)=>x+y,0)/a.length;}
  return{means,byR};
}
const dist=rarityDistribution();
function monotonicity(means){
  const list=rarities.filter(r=>means[r]!==undefined);
  let strict=true,trend=true;
  const pairs=[];
  for(let i=1;i<list.length;i++){
    const diff=means[list[i]]-means[list[i-1]];
    pairs.push([list[i-1],list[i],diff]);
    if(diff<-1e-9)strict=false;
    if(diff<-0.03)trend=false;
  }
  return{strict,trend,meanList:list,pairs};
}
const mono=monotonicity(dist.means);

// ---- Authoritative adjacent-rarity matrix (matched-card bootstrap) ----
// Produced by scripts/adjacent-rarity-matrix.js; read for the release gate.
const matrixPath=path.join(root,'qa','adjacent-rarity-matrix.json');
let matrix=null;
if(fs.existsSync(matrixPath)){
  try{const m=JSON.parse(fs.readFileSync(matrixPath,'utf8'));if(m.rows&&m.rows.length===rarities.length-1)matrix=m;}catch(_){/* keep null */}
}
const matrixAllDirectionCorrect=matrix?matrix.allDirectionCorrect:null;
const matrixStrictMonotonic=matrix?(matrix.rows.every(r=>r.winRateHigherTier>=0.50)):null;
const matrixHardInversions=matrix?matrix.hardInversions:null;

const report={
  version:'1.2.2',
  sample:SAMPLE,battles:BATTLES,rarityDistributionN:RARITY_N,
  splits:{train:TRAIN.length,validation:VALIDATION.length,finalTest:FINAL.length},
  fittedWeights:fitted.weights,fittedTrainSpearman:fitted.trainSpearman,
  committedWeights:committed,balancedWeights:balanced,
  selectedWeights,selectedName,
  modelSelectionUsedSplits:['TRAIN','VALIDATION'],
  spearman:{train:spearmanTrain.fitted,committedTrain:spearmanTrain.committed,balancedTrain:spearmanTrain.balanced,
    validationFitted:spearmanValid.fitted,validationCommitted:spearmanValid.committed,validationBalanced:spearmanValid.balanced,
    validationSelected:spearmanValid[SELECTED],
    finalTestSelected:spearmanFinal},
  similarBPFairnessByWeights:{fitted:fairValid.fitted,committed:fairValid.committed,balanced:fairValid.balanced},
  rarityMeansLv100:dist.means,
  rarityLadderStrictMonotonic:mono.strict,
  rarityLadderTrendAcceptable:mono.trend,
  adjacentMatrixAllDirectionCorrect:matrixAllDirectionCorrect,
  adjacentMatrixStrictMonotonic:matrixStrictMonotonic,
  adjacentMatrixHardInversions:matrixHardInversions,
  rarityAdjacentDiffs:mono.pairs,
  pairwiseOrderingAccuracy:{train:Math.round(pairwiseTrain*1000)/1000,validation:Math.round(pairwiseValidation*1000)/1000,final:Math.round(pairwiseFinal*1000)/1000},
  similarBPFairness:{train:similarBPTrain===null?null:Math.round(similarBPTrain*1000)/1000,
    validation:similarBPValidation===null?null:Math.round(similarBPValidation*1000)/1000,
    final:similarBPFinal===null?null:Math.round(similarBPFinal*1000)/1000},
  winProbabilityModel:winProb,
  cards:rows};
fs.writeFileSync(OUT_JSON,JSON.stringify(report,null,2));

console.log(`POWER CALIBRATION v1.2.2 — sample ${validRows.length} playable · splits T/V/F ${TRAIN.length}/${VALIDATION.length}/${FINAL.length}`);
console.log(`fitBattlePowerWeights (TRAIN only): ${JSON.stringify(fitted.weights)}  trainSpearman ${fitted.trainSpearman.toFixed(3)}`);
console.log(`Spearman VALIDATION: fitted ${spearmanValid.fitted.toFixed(3)} · committed ${spearmanValid.committed.toFixed(3)} · balanced ${spearmanValid.balanced.toFixed(3)}`);
console.log(`similar-BP fairness (VALIDATION-internal pairs): fitted ${fairValid.fitted===null?'n/a':fairValid.fitted.toFixed(3)} · committed ${fairValid.committed===null?'n/a':fairValid.committed.toFixed(3)} · balanced ${fairValid.balanced===null?'n/a':fairValid.balanced.toFixed(3)}`);
console.log(`SELECTED (validation, no FINAL): ${selectedName} -> ${JSON.stringify(selectedWeights)}`);
console.log(`--- MODEL FREEZED ---`);
console.log(`Spearman FINAL_TEST (frozen model, holdout): ${spearmanFinal.toFixed(3)}  (target >= 0.70)`);
console.log(`pairwise ordering: train ${pairwiseTrain.toFixed(3)} · validation ${pairwiseValidation.toFixed(3)} · FINAL ${pairwiseFinal.toFixed(3)}  (final target >= 0.75)`);
console.log(`similar-BP fairness: train ${similarBPTrain===null?'n/a':similarBPTrain.toFixed(3)} · validation ${similarBPValidation===null?'n/a':similarBPValidation.toFixed(3)} · FINAL ${similarBPFinal===null?'n/a':similarBPFinal.toFixed(3)}  (ideal ~0.50)`);
console.log(`win-probability model (fitted on TRAIN, b0=${b0.toFixed(3)} b1=${b1.toFixed(3)}):`);
console.log(`  VALIDATION sanity: Brier ${winProb.validation.brier} LogLoss ${winProb.validation.logLoss} ECE ${winProb.validation.ece} (n=${winProb.validation.pairs})`);
console.log(`  FINAL holdout:     Brier ${winProb.finalHoldout.brier} LogLoss ${winProb.finalHoldout.logLoss} ECE ${winProb.finalHoldout.ece} (n=${winProb.finalHoldout.pairs})`);
console.log(`rarity ladder means (n=${RARITY_N}/rarity Lv100): strict=${mono.strict?'YES':'NO'} trend=${mono.trend?'YES':'NO'}`);
if(matrixAllDirectionCorrect!==null){
  console.log(`adjacent-rarity matrix: allDirectionCorrect=${matrixAllDirectionCorrect?'YES':'NO'} strictMonotonic=${matrixStrictMonotonic?'YES':'NO'} hardInversions(<40%) count=${matrixHardInversions===null?'n/a':matrixHardInversions.length}`);
}else{
  console.log('adjacent-rarity matrix: run scripts/adjacent-rarity-matrix.js first');
}
const gate=spearmanValid[SELECTED]>=0.70&&(matrixStrictMonotonic??mono.strict)&&(matrixHardInversions===null||matrixHardInversions.length===0);
console.log(gate?'CALIBRATION PASS ✔ (validation Spearman >= 0.70 AND strict monotonic AND no hard inversions <40%)':'CALIBRATION WEAK — improve scoring model');
process.exit(gate?0:1);