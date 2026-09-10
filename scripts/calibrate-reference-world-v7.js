'use strict';
// Reference World Calibration (V7).
//
// The reference world's `referenceGeneralPower` is the zero point of
// predictTheta:  predictTheta = 2 * gain * ln(generalPower / referenceGeneralPower).
// If it is stale, every unsolved card predicts far above its target and the
// iso-power solver drives its knobs into their hard bounds, which destroys its
// ability to equalise cards (measured: ATK -> 3, MAX_HP -> 530, HEAL_POWER ->
// 52.73 for every seed).
//
// Method (spec section 9-11): use a FIXED deterministic population of UNSOLVED
// base cards at a canonical neutral tier (Lv50 A) and take the MEDIAN general
// power as the reference, so extreme mechanisms cannot drag the baseline. The
// resulting scale must put the median predictTheta at ~0 (|median| <= 0.15) and
// keep p5/p95 within a sane range instead of +/-20 theta.
//
// Outputs: calibration/reference-world-v7.json (+ browser embed) and the
// versioned evidence artifact qa/v7-reference-scale.json.
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB;

const POPULATION=Number(process.argv[2]||256);
const ANCHOR_LEVEL=50,ANCHOR_RARITY='A';
const quantile=(values,q)=>{const sorted=values.slice().sort((a,b)=>a-b),position=(sorted.length-1)*q,lower=Math.floor(position),upper=Math.ceil(position);return sorted[lower]+(sorted[upper]-sorted[lower])*(position-lower);};

// Fixed deterministic representative population: unsolved base cards (style
// genome + mechanic skeleton + base numbers), never solver output.
const samples=[];
for(let i=0;i<POPULATION;i++){
  const seed=`v7-reference-${i}`;
  const genome=N.styleGenomeV7(seed),skeleton=N.mechanicSkeletonV7(seed);
  const base=N.buildUnsolvedCardV7(seed,ANCHOR_RARITY,ANCHOR_LEVEL,skeleton,genome);
  const features=N.strengthFeaturesV7(base);
  samples.push({seed,victoryPath:skeleton.victoryPath,generalPower:features.generalPower,
    attack:features.attack,endurance:features.endurance,sustain:features.sustain,
    control:features.control,periodic:features.periodic,heal:features.heal,barrier:features.barrier,tempo:features.tempo});
}

const powers=samples.map(sample=>sample.generalPower);
const medianGeneralPower=quantile(powers,.5);
const worldPath=path.join(ROOT,'calibration/reference-world-v7.json');
const world=JSON.parse(fs.readFileSync(worldPath,'utf8'));
const previousReference=world.referenceGeneralPower;
world.referenceGeneralPower=Math.round(medianGeneralPower*1000)/1000;
fs.writeFileSync(worldPath,JSON.stringify(world,null,2)+'\n');
// Browser embed must stay in sync with the JSON.
fs.writeFileSync(path.join(ROOT,'calibration/reference-world-v7.js'),
  '(function(root){root.NCB=root.NCB||{};root.NCB.REFERENCE_WORLD_V7='+JSON.stringify(world).replace(/<\/script/g,'<\\/script')+';})(typeof globalThis!==\'undefined\'?globalThis:window);\n');

// Verify the resulting scale in a fresh model instance (predictions must centre on 0).
const worldModule=require.resolve(worldPath),modelModule=require.resolve(path.join(ROOT,'src/strength-model-v7.js'));
delete require.cache[worldModule];delete require.cache[modelModule];
require(worldModule);require(modelModule);
const predictions=samples.map(sample=>{
  const genome=N.styleGenomeV7(sample.seed),skeleton=N.mechanicSkeletonV7(sample.seed);
  return N.predictThetaV7(N.buildUnsolvedCardV7(sample.seed,ANCHOR_RARITY,ANCHOR_LEVEL,skeleton,genome));
});
const medianPrediction=quantile(predictions,.5),p5=quantile(predictions,.05),p95=quantile(predictions,.95);
const gates={
  medianCentred:Math.abs(medianPrediction)<=.15,
  populationSane:Math.abs(p5)<=6&&Math.abs(p95)<=6,
  referenceMatchesMedian:Math.abs(world.referenceGeneralPower-medianGeneralPower)<1e-3,
};
const artifact={schemaVersion:1,generatorVersion:7,method:'median generalPower of fixed deterministic unsolved base cards at a canonical neutral tier',
  anchor:{level:ANCHOR_LEVEL,rarity:ANCHOR_RARITY},population:POPULATION,
  referenceGeneralPower:{previous:previousReference,next:world.referenceGeneralPower,ratio:Math.round(world.referenceGeneralPower/Math.max(1e-9,previousReference)*100)/100},
  generalPower:{p5:quantile(powers,.05),p25:quantile(powers,.25),median:medianGeneralPower,p75:quantile(powers,.75),p95:quantile(powers,.95),min:Math.min(...powers),max:Math.max(...powers)},
  predictTheta:{p5,p25:quantile(predictions,.25),median:medianPrediction,p75:quantile(predictions,.75),p95,min:Math.min(...predictions),max:Math.max(...predictions)},
  victoryPathBreakdown:Object.fromEntries([...new Set(samples.map(s=>s.victoryPath))].sort().map(pathName=>{
    const rows=samples.filter(sample=>sample.victoryPath===pathName).map(sample=>sample.generalPower);
    return [pathName,{count:rows.length,median:quantile(rows,.5)}];
  })),
  gates,pass:Object.values(gates).every(Boolean)};
const output=path.join(ROOT,'qa/v7-reference-scale.json');
fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({output:path.relative(ROOT,output),previousReference,referenceGeneralPower:world.referenceGeneralPower,medianPrediction:+medianPrediction.toFixed(3),p5:+p5.toFixed(3),p95:+p95.toFixed(3),gates},null,2));
if(!artifact.pass)process.exitCode=1;
