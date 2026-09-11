'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ranks, spearman, pairedInterval512 } = require('../scripts/audit-statistics.js');
test('Spearman uses average ties and is permutation invariant', () => {
  assert.deepEqual(ranks([100, 100, 200, 200]), [1.5, 1.5, 3.5, 3.5]);
  const x = [.1, .3, .7, .9], y = [100, 100, 200, 200];
  assert.ok(Math.abs(spearman(x, y) - .8944271909999159) < 1e-12);
  assert.equal(spearman(x, y), spearman([...x].reverse(), [...y].reverse()));
  assert.equal(spearman([1, 2, 3], [3, 2, 1]), -1);
  for (const [a, b] of [[[], []], [[1], [2]], [[1, 1], [2, 3]], [[1, NaN], [1, 2]], [[1, 2], [1]]]) assert.equal(spearman(a, b), null);
});
test('paired interval counts seeds, not opponents or seats', () => {
  const constant = pairedInterval512(Array(512).fill(.1));
  assert.equal(constant.n, 512);
  assert.ok(Math.abs(constant.mean - .1) < 1e-12 && constant.high - constant.low < 1e-12);
  assert.throws(() => pairedInterval512(Array(512 * 22 * 2).fill(0)));
  const r = pairedInterval512(Array.from({ length: 512 }, (_, i) => i % 2 ? 1 : -1));
  assert.equal(r.mean, 0); assert.ok(r.low < 0 && r.high > 0);
});
