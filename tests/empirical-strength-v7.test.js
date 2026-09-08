const test=require('node:test');
const assert=require('node:assert/strict');
const {fitBradleyTerryV7,isConnectedGraphV7,splitCardFamiliesV7}=require('../src/empirical-strength-v7.js');

test('V7 Bradley-Terry fit recovers ordering and centers additive scale',()=>{
  const nodes=['weak','mid','strong'];
  const edges=[
    {a:'weak',b:'mid',winsA:20,winsB:80,draws:0},
    {a:'mid',b:'strong',winsA:15,winsB:85,draws:0},
    {a:'weak',b:'strong',winsA:2,winsB:98,draws:0},
  ];
  const fit=fitBradleyTerryV7(nodes,edges);
  assert.ok(fit.theta.strong>fit.theta.mid);
  assert.ok(fit.theta.mid>fit.theta.weak);
  assert.ok(Math.abs(Object.values(fit.theta).reduce((a,b)=>a+b,0))<1e-9);
  assert.ok(fit.standardError.strong>0);
});

test('V7 battle graph connectivity includes isolated nodes in failure',()=>{
  assert.equal(isConnectedGraphV7(['a','b'],[{a:'a',b:'b'}]),true);
  assert.equal(isConnectedGraphV7(['a','b','c'],[{a:'a',b:'b'}]),false);
});

test('V7 data split keeps every seed family wholly in one partition',()=>{
  const cards=[
    {id:'a1',seed:'family-a:1'},{id:'a2',seed:'family-a:2'},
    {id:'b1',seed:'family-b:1'},{id:'c1',seed:'family-c:1'},
  ];
  const split=splitCardFamiliesV7(cards,card=>card.seed.split(':')[0]);
  const owner=new Map();
  for(const [partition,rows] of Object.entries(split))for(const card of rows){
    const family=card.seed.split(':')[0];
    if(owner.has(family))assert.equal(owner.get(family),partition);
    owner.set(family,partition);
  }
  assert.equal([...Object.values(split)].flat().length,cards.length);
});
