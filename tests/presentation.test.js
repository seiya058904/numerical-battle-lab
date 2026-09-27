'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CARDS } = require('../src/cards.js');
const power = require('../src/power.js');
const { simulate } = require('../src/battle.js');
const { parseEvent, matchesCard, normalizeLevel } = require('../src/app.js');
const { describeEvent, summarizeEvents, parseSeed, eventDelay } = require('../src/app.js');
const { createHash } = require('node:crypto');
const { rarityFinish, emblemMarkup } = require('../src/app.js');

test('rarity decoration has a bounded resource ladder and distinct premium materials', () => {
  const finishes = Array.from({ length: 12 }, (_, tier) => rarityFinish(tier));
  assert.ok(finishes.slice(0, 6).every(f => f.particles === 0));
  finishes.forEach((f, i) => {
    assert.ok(Number.isInteger(f.particles) && f.particles <= 18);
    if (i) assert.ok(f.particles >= finishes[i - 1].particles);
  });
  assert.equal(new Set(finishes.slice(8).map(f => f.material)).size, 4);
  assert.match(emblemMarkup(8, 'A'), /emblem-facets/);
  assert.doesNotMatch(emblemMarkup(8, 'A'), /emblem-crown/);
  assert.match(emblemMarkup(9, 'A'), /emblem-crown/);
  assert.match(emblemMarkup(10, 'A'), /emblem-star/);
  assert.doesNotMatch(emblemMarkup(10, 'A'), /emblem-crown/);
  assert.match(emblemMarkup(11, 'B'), /emblem-crown/);
  assert.match(emblemMarkup(11, 'A'), /id="metalA"/);
  assert.match(emblemMarkup(11, 'B'), /id="metalB"/);
  assert.match(emblemMarkup(11, 'A'), /emblem-astrolabe/);
  assert.doesNotMatch(emblemMarkup(10, 'A'), /emblem-astrolabe/);
  assert.match(emblemMarkup(9, 'A'), /emblem-wings/);
  assert.doesNotMatch(emblemMarkup(8, 'A'), /emblem-wings/);
  for (const finish of finishes) assert.match(finish.color, /^#[0-9a-f]{6}$/);
  // All three displayed medals must own unique paint-server IDs and include their labels.
  for (let tier = 0; tier < 12; tier++) {
    const ids = new Set();
    for (const side of ['A', 'B', 'Result']) {
      const svg = emblemMarkup(tier, side);
      assert.match(svg, new RegExp('>' + require('../src/cards.js').RARITY_LIST[tier].replace(' Collector', '').replace('+', '\\+') + '</text>'));
      for (const [, id] of svg.matchAll(/id="([^"]+)"/g)) {
        assert.ok(!ids.has(id), 'independent medals must not share a gradient ID');
        ids.add(id);
      }
      for (const [, id] of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.has(id), 'every paint reference must resolve');
    }
  }
});

test('material and emblem construction is repeatable without consuming random numbers', () => {
  const original = Math.random;
  try {
    Math.random = () => { throw new Error('visual identity must not consume RNG'); };
    for (let tier = 0; tier < 12; tier++) {
      assert.deepEqual(rarityFinish(tier), rarityFinish(tier));
      assert.equal(emblemMarkup(tier, 'A'), emblemMarkup(tier, 'A'));
    }
  } finally { Math.random = original; }
});

test('Arena presentation preserves all 1,920 full simulation results from main e9ce5e9', () => {
  // Captured BEFORE the presentation upgrade, including every event, HP snapshot and final unit.
  const hash = createHash('sha256');
  for (let i = 0; i < 96; i++) {
    for (const [a, b] of [[1, 1], [50, 50], [55, 100], [100, 1]]) {
      for (const seed of [0, 1, 42, 1349303770, 4294967295]) {
        hash.update(JSON.stringify(simulate(CARDS[i], a, CARDS[(i * 7 + 13) % 96], b, seed)));
      }
    }
  }
  assert.equal(hash.digest('hex'), 'a947f05e621e8223e5828f6d4235cd74cf6c34f0b4ad6f3d4a3a4c5699313743');
});

test('event metadata and summary conserve actual HP, including mirror matches and overkill', () => {
  const kinds = new Set(); let drain = false;
  for (const [i, j, a, b] of [[0, 0, 50, 50], [23, 0, 55, 100], [0, 23, 1, 100], [5, 5, 50, 50]]) {
    for (const seed of [0, 42, 1349303770]) {
      const result = simulate(CARDS[i], a, CARDS[j], b, seed);
      const saved = JSON.stringify(result);
      const totals = summarizeEvents(result.events);
      assert.equal(result.a.maxHp + totals.A.healing - totals.B.damage, result.a.hp);
      assert.equal(result.b.maxHp + totals.B.healing - totals.A.damage, result.b.hp);
      result.events.forEach((e, index) => {
        const p = describeEvent(e, result.events[index - 1]); kinds.add(p.kind); drain ||= p.drain;
        if (['hit', 'crit', 'miss'].includes(p.kind)) assert.notEqual(p.source, p.target);
        if (p.kind === 'sys') assert.equal(p.target, null);
        if (['hit', 'crit', 'heal'].includes(p.kind)) {
          assert.ok(p.amount > 0);
          assert.equal(p.amount, Number(p.amt.replace(/[^\d]/g, '')));
        }
      });
      assert.equal(JSON.stringify(result), saved, 'presentation must not mutate events');
    }
  }
  for (const kind of ['hit', 'crit', 'miss', 'heal', 'death']) assert.ok(kinds.has(kind), kind);
  assert.ok(drain);
});

test('seed input accepts uint32 including zero; invalid inputs never silently coerce', () => {
  assert.equal(parseSeed(''), null); assert.equal(parseSeed('  '), null);
  assert.equal(parseSeed('0'), 0); assert.equal(parseSeed('4294967295'), 4294967295);
  assert.equal(parseSeed(' 00042 '), 42);
  for (const value of ['-1', '1.1', '1e3', 'NaN', '4294967296', 'abc']) assert.equal(parseSeed(value), undefined);
});

test('playback weight distinguishes crit, heal and death without adding instant waits', () => {
  assert.ok(eventDelay('crit', 440) > eventDelay('hit', 440));
  assert.ok(eventDelay('heal', 440) < eventDelay('hit', 440));
  assert.ok(eventDelay('death', 440) > eventDelay('hit', 440));
  for (const kind of ['hit', 'crit', 'miss', 'heal', 'death', 'sys', 'draw']) assert.equal(eventDelay(kind, 0), 0);
});

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
