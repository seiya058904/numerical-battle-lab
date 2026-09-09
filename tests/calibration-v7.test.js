'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {fitLinearScaleV7,fitRidgeCalibrationV7,predictRidgeV7}=require('../src/calibration-v7.js');

test('V7 empirical scale is fit from training rows only',()=>{
  const training=[{raw:-1,target:-2},{raw:0,target:1},{raw:1,target:4}];
  const fit=fitLinearScaleV7(training);
  assert.ok(Math.abs(fit.slope-3)<1e-9);
  assert.ok(Math.abs(fit.intercept-1)<1e-9);
  const unchanged=fitLinearScaleV7(training);
  assert.deepEqual(unchanged,fit);
});

test('V7 ridge calibration standardizes from train and never fits test outcomes',()=>{
  const train=[
    {features:[0,0],outcome:1},{features:[1,0],outcome:3},
    {features:[0,1],outcome:-2},{features:[1,1],outcome:0},
  ];
  const validation=[{features:[2,0],outcome:5},{features:[0,2],outcome:-5}];
  const testA=[{features:[3,3],outcome:1000}];
  const testB=[{features:[3,3],outcome:-1000}];
  const a=fitRidgeCalibrationV7(train,validation,testA,[0.0001,0.01,1]);
  const b=fitRidgeCalibrationV7(train,validation,testB,[0.0001,0.01,1]);
  assert.deepEqual(a.model,b.model);
  assert.ok(Math.abs(predictRidgeV7(a.model,[2,1])-2)<0.05);
  assert.ok(a.metrics.train.rmse<0.05);
  assert.ok(a.metrics.validation.rmse<0.05);
  assert.notEqual(a.metrics.test.rmse,b.metrics.test.rmse);
});
