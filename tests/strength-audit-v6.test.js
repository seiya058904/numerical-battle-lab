const test=require('node:test');
const assert=require('node:assert/strict');
const {scoreMirroredPair,summarizeBattleCounts,wilson95}=require('../src/strength-audit-v6.js');

test('mirrored scorer counts each battle independently when higher strength splits the pair',()=>{
  const calls=[];
  const low={id:'low'},high={id:'high'};
  const fight=(a,b,seed)=>{
    calls.push([a.id,b.id,seed]);
    return a===low?-1:-1; // high wins as team B, then loses as team A
  };
  const counts=scoreMirroredPair(low,high,'paired-seed',fight);
  assert.deepEqual(calls,[['low','high','paired-seed'],['high','low','paired-seed']]);
  assert.deepEqual(counts,{pairCount:1,battleCount:2,higherWins:1,lowerWins:1,draws:0,teamAWins:0,teamBWins:2});
  const result=summarizeBattleCounts(counts);
  assert.equal(result.higherWinRate,0.5);
  assert.equal(result.lowerWinRate,0.5);
  assert.equal(result.teamAWinRate,0);
  assert.equal(result.teamBWinRate,1);
});

test('mirrored scorer records draws and side wins without pair-level inflation',()=>{
  const outcomes=[0,1];
  const counts=scoreMirroredPair({id:'lo'},{id:'hi'},42,()=>outcomes.shift());
  assert.deepEqual(counts,{pairCount:1,battleCount:2,higherWins:1,lowerWins:0,draws:1,teamAWins:1,teamBWins:0});
  assert.deepEqual(summarizeBattleCounts(counts),{
    pairCount:1,battleCount:2,higherWins:1,lowerWins:0,draws:1,teamAWins:1,teamBWins:0,
    higherWinRate:0.5,lowerWinRate:0,drawRate:0.5,teamAWinRate:0.5,teamBWinRate:0,
    ci95:{low:0.095,high:0.905},
  });
});

test('Wilson 95 percent interval is bounded and narrows with evidence',()=>{
  assert.deepEqual(wilson95(0,0),{low:0,high:1});
  assert.deepEqual(wilson95(5,10),{low:0.237,high:0.763});
  const larger=wilson95(50,100);
  assert.ok(larger.low>0.39&&larger.high<0.61);
});
