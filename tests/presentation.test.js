'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CARDS } = require('../src/cards.js');
const power = require('../src/power.js');
const { simulate } = require('../src/battle.js');
const { parseEvent } = require('../src/app.js');
test('mirror logs keep side identities including both sides of misses', () => {
  const r = simulate(CARDS[0], 50, CARDS[0], 50, 1349303770);
  for (const event of r.events) {
    assert.match(event.text, /蓝方·|红方·/);
    const parsed = parseEvent(event);
    assert.match(parsed.txt, /蓝方·|红方·/);
    if (['hit', 'crit', 'miss'].includes(event.cls)) {
      assert.match(parsed.txt, /蓝方·/); assert.match(parsed.txt, /红方·/);
    }
  }
  assert.equal(r.a.name, CARDS[0].name);
  assert.equal(r.b.name, CARDS[0].name);
});
test('battle runtime never reads BP', () => {
  const before = simulate(CARDS[0], 50, CARDS[1], 50, 1234);
  const original = power.battlePower;
  const file = require.resolve('../src/battle.js');
  try {
    power.battlePower = () => { throw new Error('BP must not run'); };
    delete require.cache[file];
    assert.deepEqual(require(file).simulate(CARDS[0], 50, CARDS[1], 50, 1234), before);
  } finally { power.battlePower = original; delete require.cache[file]; }
});
