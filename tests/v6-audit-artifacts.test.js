const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'qa',name),'utf8'));

test('v6 static audit artifacts contain allocation, panel, budget, correlation, and performance evidence',()=>{
  const seed=read('v6-seed-dispersion.json');
  assert.equal(seed.sampleSize,100);
  for(const key of ['ATK','MAX_HP','DEF','RES','SPD'])for(const stat of ['mean','std','p5','p95'])assert.ok(Number.isFinite(seed.panel[key][stat]),`${key}.${stat}`);
  for(const key of ['p5','p25','p50','p75','p95'])assert.ok(Number.isFinite(seed.pricedStrength[key]));
  const budget=read('v6-budget-distribution.json');
  assert.equal(budget.examples.length,8);
  assert.equal(new Set(budget.examples.map(x=>x.category)).size,8);
  assert.ok(budget.maxAbsoluteDeviation<=.05);
  const corr=read('v6-battlepower-correlation.json');
  assert.ok(corr.sampleSize>=200);
  assert.ok(Number.isFinite(corr.spearman));
  const perf=read('v6-performance.json');
  assert.equal(perf.cards,1000);
  assert.ok(perf.medianMsPerCard<50&&perf.p95MsPerCard<50);
});

test('v6 expected-strength artifact covers every rarity and required cross interactions',()=>{
  const data=read('v6-expected-strength.json');
  assert.equal(Object.keys(data.curves).length,12);
  assert.deepEqual(data.crossInteractions.map(x=>x.label),['Lv20 XS vs Lv50 A','Lv30 S vs Lv60 B','Lv80 C vs Lv40 SSS','Lv100 C vs Lv50 XS']);
});

test('v6 empirical artifacts use corrected paired battle accounting and cover presets',()=>{
  for(const name of ['v6-strength-final.json','v6-level-strength.json','v6-rarity-strength.json']){
    const data=read(name);assert.equal(data.methodology.pairedSideMirroring,true);assert.equal(data.methodology.confidenceInterval,'Wilson 95%');
  }
  const matrix=read('v6-preset-matchup-matrix.json');
  assert.equal(matrix.cards,60);
  assert.equal(matrix.matchups,1770);
  assert.ok(matrix.totalBattles>=3540);
  assert.ok(matrix.rows.every(row=>row.battleCount===row.pairCount*2));
});
