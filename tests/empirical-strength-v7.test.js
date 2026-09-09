const test=require('node:test');
const assert=require('node:assert/strict');
const {fitBradleyTerryV7,isConnectedGraphV7,splitCardFamiliesV7,buildSparsePairsV7}=require('../src/empirical-strength-v7.js');

test('V7 Bradley-Terry fit recovers ordering and centers additive scale',()=>{
  const nodes=['weak','mid','strong'];
  const edges=[
    {a:'weak',b:'mid',winsA:20,winsB:80,draws:0},
    {a:'mid',b:'strong',winsA:15,winsB:85,draws:0},
    {a:'weak',b:'strong',winsA:2,winsB:98,draws:0},
  ];
  const fit=fitBradleyTerryV7(nodes,edges);
  assert.equal(fit.converged,true);
  assert.ok(fit.theta.strong>fit.theta.mid);
  assert.ok(fit.theta.mid>fit.theta.weak);
  assert.ok(Math.abs(Object.values(fit.theta).reduce((a,b)=>a+b,0))<1e-9);
  assert.ok(fit.standardError.strong>0);
});

test('V7 Bradley-Terry regularization converges for perfectly separated battle edges',()=>{
  const fit=fitBradleyTerryV7(['a','b','c'],[
    {a:'a',b:'b',winsA:100,winsB:0,draws:0},
    {a:'b',b:'c',winsA:100,winsB:0,draws:0},
  ]);
  assert.equal(fit.converged,true);
  assert.ok(Number.isFinite(fit.theta.a));
  assert.ok(fit.theta.a>fit.theta.b&&fit.theta.b>fit.theta.c);
});

test('V7 Bradley-Terry treats draws as half scores and is invariant to node ordering',()=>{
  const edges=[{a:'a',b:'b',winsA:20,winsB:20,draws:60}];
  const forward=fitBradleyTerryV7(['a','b'],edges);
  const reverse=fitBradleyTerryV7(['b','a'],edges);
  assert.ok(Math.abs(forward.theta.a-forward.theta.b)<1e-9);
  assert.ok(Math.abs(forward.theta.a-reverse.theta.a)<1e-9);
  assert.ok(Math.abs(forward.theta.b-reverse.theta.b)<1e-9);
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

test('V7 family split keeps train validation and test non-empty for the release family set',()=>{
  const cards=Array.from({length:6},(_,i)=>({id:'c'+i,seed:'v7-family-'+i}));
  const split=splitCardFamiliesV7(cards);
  assert.ok(split.train.length>0);
  assert.ok(split.validation.length>0);
  assert.ok(split.test.length>0);
});

test('V7 sparse pair plan is connected and covers near, cross-style, and extreme gaps',()=>{
  const cards=Array.from({length:12},(_,i)=>({id:'c'+i,targetTheta:i,style:i%3,seed:'family-'+(i%3),level:20+20*Math.floor(i/3),rarity:'A'}));
  const pairs=buildSparsePairsV7(cards);
  assert.ok(pairs.length<cards.length*(cards.length-1)/2);
  assert.equal(isConnectedGraphV7(cards.map(card=>card.id),pairs),true);
  assert.ok(pairs.some(pair=>Math.abs(cards.find(c=>c.id===pair.a).targetTheta-cards.find(c=>c.id===pair.b).targetTheta)>=8));
  assert.ok(pairs.some(pair=>cards.find(c=>c.id===pair.a).style!==cards.find(c=>c.id===pair.b).style));
  assert.ok(pairs.some(pair=>pair.kind==='same-tier'));
  assert.ok(pairs.some(pair=>pair.kind==='same-seed-level'));
});
