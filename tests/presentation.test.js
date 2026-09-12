'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CARDS } = require('../src/cards.js');
const power = require('../src/power.js');
const { simulate } = require('../src/battle.js');
const { parseEvent, matchesCard, normalizeLevel } = require('../src/app.js');

test('picker searches actual card fields and rarity names without changing the card pool', () => {
  const card = CARDS.find((c) => c.source);
  assert.ok(card);
  for (const query of [card.name, card.source, card.role, '   ']) {
    assert.equal(matchesCard(card, query), true, query);
  }
  const xs = CARDS.filter((c) => matchesCard(c, '  xS  '));
  assert.equal(xs.length, 16);
  assert.deepEqual([...new Set(xs.map((c) => c.rarity))], [10, 11]);
  assert.equal(CARDS.filter((c) => matchesCard(c, 'no-such-character-xyz')).length, 0);
  assert.equal(matchesCard({ name: 'Example', role: 'Guard', rarity: 0 }, 'example'), true);
});

test('level commit clamps and rounds, while incomplete or invalid input restores the last valid level', () => {
  for (const [input, expected] of [
    ['1', 1], ['100', 100], ['0', 1], ['-20', 1], ['101', 100],
    ['55.4', 55], ['55.5', 56], [' 80 ', 80],
    ['', 50], ['   ', 50], ['-', 50], ['abc', 50], ['Infinity', 50]
  ]) {
    assert.equal(normalizeLevel(input, 50), expected, JSON.stringify(input));
  }
});
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
