'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const {fitRidgeCalibrationV7}=require('../src/calibration-v7.js');
for(const file of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','power-v5','battlepower-v3','gen-stats','gen-skills','generator','gen-names','name-generator-v2','name-generator-v3','gen-v2','gen-v3','gen-v4','gen-v5','budget-v6','budget-price','gen-v6','strength-geometry-v7','style-genome-v7','strength-model-v7','solver-v7','gen-v7'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB;
const graph=JSON.parse(fs.readFileSync(path.join(ROOT,'qa/v7-battle-graph.json'),'utf8'));
const empirical=JSON.parse(fs.readFileSync(path.join(ROOT,'qa/v7-empirical-strength.json'),'utf8'));
const empiricalById=new Map(empirical.cards.map(card=>[card.id,card]));
const partitionById=new Map(Object.entries(graph.split).flatMap(([partition,ids])=>ids.map(id=>[id,partition])));
const datasets={train:[],validation:[],test:[]};
const fittedFeatureCount=16;
for(const row of graph.cards){
  if(!Array.isArray(row.shapeFeatures))throw new Error(`battle graph lacks frozen shape features for ${row.id}`);
  const observed=empiricalById.get(row.id);
  datasets[partitionById.get(row.id)].push({id:row.id,features:row.shapeFeatures.slice(0,fittedFeatureCount),outcome:observed.empiricalTheta-row.targetTheta});
}
const result=fitRidgeCalibrationV7(datasets.train,datasets.validation,datasets.test,[.001,.01,.1,1,10,100]);
const calibration={schemaVersion:1,trainedOn:'train seed families only',selectedOn:'validation seed families',testedOn:'untouched test seed families',featurePolicy:'mechanism-shape only; absolute strength diagnostics excluded from solver feedback',featureNames:N.STRENGTH_SHAPE_FEATURE_NAMES_V7.slice(0,fittedFeatureCount),means:result.model.means,scales:result.model.scales,coefficients:result.model.coefficients,intercept:result.model.intercept,ridge:result.model.lambda};
const calibrationPath=path.join(ROOT,'calibration/strength-model-v7.json');
fs.writeFileSync(calibrationPath,JSON.stringify(calibration,null,2)+'\n');
// Browser embed (offline static runtime cannot fetch JSON).
fs.writeFileSync(path.join(ROOT,'calibration/strength-model-v7.js'),'(function(r){r.NCB=r.NCB||{};r.NCB.STRENGTH_MODEL_CALIBRATION_V7='+JSON.stringify(calibration).replace(/<\/script/g,'<\\/script')+';})(typeof globalThis!==\'undefined\'?globalThis:window);\n');
const artifact={schemaVersion:1,methodology:{target:'scaled empirical theta minus TargetTheta',scaleSource:'qa/v7-empirical-strength.json train-only scale',familyIsolation:true,hyperparameterSelection:'validation RMSE',testUsage:'evaluation only'},model:calibration,metrics:result.metrics,split:Object.fromEntries(Object.entries(datasets).map(([key,rows])=>[key,rows.map(row=>row.id)]))};
const output=path.join(ROOT,'qa/v7-target-reality-calibration.json');
fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({output:path.relative(ROOT,output),ridge:calibration.ridge,metrics:result.metrics},null,2));
