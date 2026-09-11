'use strict';

function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function ranks(xs) {
  const order = xs.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = [];
  for (let i = 0; i < order.length;) {
    let end = i + 1;
    while (end < order.length && order[end].value === order[i].value) end++;
    for (let j = i; j < end; j++) result[order[j].index] = (i + 1 + end) / 2;
    i = end;
  }
  return result;
}
function spearman(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2 || ![...xs, ...ys].every(Number.isFinite)) return null;
  const a = ranks(xs), b = ranks(ys), ma = mean(a), mb = mean(b);
  let covariance = 0, va = 0, vb = 0;
  for (let i = 0; i < a.length; i++) {
    covariance += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2;
  }
  return va && vb ? covariance / Math.sqrt(va * vb) : null;
}
// Two-sided Student t 0.975 quantile, df=511. Observations are seed clusters.
function pairedInterval512(differences) {
  if (differences.length !== 512 || !differences.every(Number.isFinite)) throw new Error('Expected 512 finite seed differences');
  const average = mean(differences);
  const variance = differences.reduce((s, d) => s + (d - average) ** 2, 0) / 511;
  const margin = 1.964617 * Math.sqrt(variance / 512);
  return { n: 512, mean: average, low: average - margin, high: average + margin };
}
module.exports = { mean, ranks, spearman, pairedInterval512 };
