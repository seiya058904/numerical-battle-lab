'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {wilsonIntervalV7,evaluateProductScenarioV7}=require('../src/audit-statistics-v7.js');

test('V7 Wilson interval handles perfect and balanced samples',()=>{
  const perfect=wilsonIntervalV7(100,100);
  assert.ok(perfect.lower>.96&&perfect.upper===1);
  const balanced=wilsonIntervalV7(50,100);
  assert.ok(balanced.lower<.5&&balanced.upper>.5);
});

test('V7 product scenario gates use all battles including draws',()=>{
  const result=evaluateProductScenarioV7({higherWins:990,lowerWins:5,draws:5},{higherMin:.99,lowerMax:.01,wilsonLowerMin:.98});
  assert.equal(result.battles,1000);
  assert.equal(result.pass,true);
  const failed=evaluateProductScenarioV7({higherWins:990,lowerWins:11,draws:0},{higherMin:.98,lowerMax:.01});
  assert.equal(failed.pass,false);
});
