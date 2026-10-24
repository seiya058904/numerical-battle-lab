'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { initTheme, lumenEmblemMarkup, editionEmblemMarkup, naturalEmblemMarkup, themedEmblemMarkup, EMBLEM_RENDERERS, EMBLEM_CACHE_LIMIT } = require('../src/app.js');
const { RARITY_LIST } = require('../src/cards.js');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function environment(value, failRead = false, failWrite = false) {
  const listeners = [];
  const nodes = Object.fromEntries(['themeSelect'].map(id => [id, {
    dataset: {}, attributes: {}, value: '',
    setAttribute(key, val) { this.attributes[key] = val; },
    addEventListener(event, fn) { listeners.push(fn); }
  }]));
  const meta = {};
  const document = { documentElement: { dataset: {}, style: {} },
    querySelector: () => meta, getElementById: id => nodes[id] };
  const writes = [];
  const localStorage = {
    getItem() { if (failRead) throw new Error('blocked'); return value; },
    setItem(key, val) { if (failWrite) throw new Error('quota'); writes.push([key, val]); }
  };
  const host = { document, localStorage }; host.window = host;
  vm.runInNewContext(bootstrap, host);
  return { host, document, meta, nodes, writes, listeners };
}

test('prepaint theme restores only known IDs, updates browser surfaces, safely defaults', () => {
  for (const value of [null, '', 'obsolete', '__proto__', 'LUMEN', '<script>']) {
    const e = environment(value);
    assert.equal(e.document.documentElement.dataset.theme, 'collector');
    assert.equal(e.meta.content, '#090e14');
    assert.equal(e.document.documentElement.style.colorScheme, 'dark');
  }
  const e = environment('lumen');
  assert.equal(e.document.documentElement.dataset.theme, 'lumen');
  assert.equal(e.meta.content, '#edf2f5');
  assert.equal(e.document.documentElement.style.colorScheme, 'light');
  assert.equal(environment('lumen', true).document.documentElement.dataset.theme, 'collector');
  assert.ok(html.indexOf('window.NCB_THEME') < html.indexOf('rel="stylesheet"'));
});

test('theme selector binds once and directly selects every edition without game ownership', () => {
  const e = environment('collector');
  initTheme(e.document, e.host); initTheme(e.document, e.host);
  assert.equal(e.listeners.length, 1);
  const ids = e.host.NCB_THEME.themes.map(theme => theme.id);
  for (let i = 0; i < 64; i++) {
    e.nodes.themeSelect.value = ids[i % ids.length];
    e.listeners[0]();
    assert.equal(e.document.documentElement.dataset.theme, ids[i % ids.length]);
    assert.equal(e.nodes.themeSelect.value, ids[i % ids.length]);
  }
  assert.equal(e.writes.length, 64);
  e.nodes.themeSelect.value = 'not-a-theme'; e.listeners[0]();
  assert.equal(e.nodes.themeSelect.value, 'collector');
});

test('blocked storage cannot prevent an in-session switch', () => {
  const e = environment(null, true, true);
  initTheme(e.document, e.host); e.nodes.themeSelect.value = 'lumen'; e.listeners[0]();
  assert.equal(e.document.documentElement.dataset.theme, 'lumen');
  assert.equal(e.nodes.themeSelect.value, 'lumen');
});

test('eight stable theme entries match renderers, options and browser surfaces', () => {
  const e = environment(null);
  const ids = ['collector', 'lumen', 'folio', 'pulse', 'nocturne', 'sumi', 'arcade', 'verdant'];
  assert.deepEqual(Array.from(e.host.NCB_THEME.themes, t => t.id), ids);
  assert.deepEqual(Object.keys(EMBLEM_RENDERERS), ids);
  assert.equal(new Set(e.host.NCB_THEME.themes.map(t => t.name)).size, 8);
  for (const t of e.host.NCB_THEME.themes) {
    const restored = environment(t.id);
    assert.equal(restored.document.documentElement.dataset.theme, t.id);
    assert.equal(restored.document.documentElement.style.colorScheme, t.scheme);
    assert.equal(restored.meta.content, t.color);
    assert.equal(restored.document.documentElement.dataset.surface, t.surface);
    assert.ok(t.description.length > 10 && t.reveal && t.impact);
    assert.ok(html.includes(`<option value="${t.id}">${t.name} / ${t.label}</option>`));
  }
});

test('expanded crest families are deterministic, safe, bounded and singly mounted', () => {
  for (const theme of ['nocturne', 'sumi', 'arcade', 'verdant']) {
    const variants = new Set();
    for (let tier = 0; tier < 12; tier++) {
      const svg = naturalEmblemMarkup(tier, theme); variants.add(svg);
      assert.equal(svg, naturalEmblemMarkup(tier, theme));
      assert.ok(Buffer.byteLength(svg) <= 12000);
      assert.ok((svg.match(/<[a-z]/g) || []).length <= 110);
      assert.doesNotMatch(svg, /\bid=|<(?:image|filter|script|foreignObject|animate)\b|NaN|undefined|href=/);
      assert.equal(svg.includes('COLLECTOR'), tier === 9 || tier === 11);
      for (const side of ['A', 'B', 'Result']) {
        assert.equal(themedEmblemMarkup(tier, side, theme), svg);
        assert.equal((themedEmblemMarkup(tier, side, theme).match(/<svg\b/g) || []).length, 1);
      }
    }
    assert.equal(variants.size, 12);
  }
  assert.equal(EMBLEM_CACHE_LIMIT, 288);
  assert.equal(themedEmblemMarkup(0, 'A', '__proto__'), themedEmblemMarkup(0, 'A', 'collector'));
  assert.throws(() => themedEmblemMarkup(0, 'UnboundedNamespace', 'sumi'), RangeError);
  assert.throws(() => naturalEmblemMarkup(12, 'sumi'), RangeError);
  assert.throws(() => naturalEmblemMarkup(0, 'unknown'), RangeError);
});

test('print and signal rank geometry are distinct, deterministic, bounded and ID-free', () => {
  for (const theme of ['folio', 'pulse']) {
    const variants = new Set();
    for (let tier = 0; tier < 12; tier++) {
      const svg = editionEmblemMarkup(tier, theme); variants.add(svg);
      assert.equal(svg, editionEmblemMarkup(tier, theme));
      assert.ok(svg.includes(`data-mark="${RARITY_LIST[tier].replace(' Collector', '')}"`));
      assert.ok(Buffer.byteLength(svg) < 5000);
      assert.ok((svg.match(/<[a-z]/g) || []).length < 40);
      assert.doesNotMatch(svg, /\bid=|<(?:image|filter|script|foreignObject|animate)\b|NaN|undefined|href=/);
    }
    assert.equal(variants.size, 12);
  }
  assert.notEqual(editionEmblemMarkup(0, 'folio'), editionEmblemMarkup(0, 'pulse'));
  assert.throws(() => editionEmblemMarkup(12, 'folio'), RangeError);
  assert.throws(() => editionEmblemMarkup(0, 'unknown'), RangeError);
});

test('all stylesheet assets resolve inside the static distribution', () => {
  const root = path.join(__dirname, '..');
  for (const file of ['styles.css', 'themes.css']) {
    const css = fs.readFileSync(path.join(root, file), 'utf8');
    for (const [, asset] of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
      assert.ok(fs.statSync(path.join(root, asset)).size > 0, asset);
    }
  }
});

test('all twelve optical crests are distinct, safe, deterministic and bounded', () => {
  const assets = new Set();
  for (let tier = 0; tier < 12; tier++) {
    const svg = lumenEmblemMarkup(tier, 'A');
    assets.add(svg);
    assert.equal(svg, lumenEmblemMarkup(tier, 'A'));
    assert.ok(svg.includes(`data-mark="${RARITY_LIST[tier].replace(' Collector', '')}"`));
    assert.ok(Buffer.byteLength(svg) < 12000);
    assert.ok((svg.match(/<[a-z]/g) || []).length < 110);
    assert.doesNotMatch(svg, /<(?:image|filter|script|foreignObject|animate)\b|NaN|undefined|href=/);
    const ids = new Set();
    for (const side of ['A', 'B', 'Result']) {
      const markup = lumenEmblemMarkup(tier, side);
      for (const [, id] of markup.matchAll(/id="([^"]+)"/g)) { assert.ok(!ids.has(id)); ids.add(id); }
      for (const [, id] of markup.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.has(id));
    }
  }
  assert.equal(assets.size, 12);
  assert.throws(() => lumenEmblemMarkup(-1, 'A'), RangeError);
  assert.throws(() => lumenEmblemMarkup(0, '"><script>'), RangeError);
});

test('Collector keeps twelve V3 dies while the three restored editions keep their V1 forms', () => {
  const { emblemMarkup } = require('../src/app.js');
  const families = ['token', 'reinforced', 'shield', 'braced', 'facet', 'array',
    'sanctum', 'duplex', 'radiant', 'archive', 'singularity', 'reliquary'];
  const collectorDies = [];
  for (let tier = 0; tier < 12; tier++) {
    const svg = emblemMarkup(tier, 'A');
    assert.match(svg, new RegExp(`data-identity="${families[tier]}"`));
    const chassis = svg.split('<g class="emblem-chassis">')[1];
    assert.ok(chassis, 'Collector keeps its V3 reveal structure');
    collectorDies.push(chassis.match(/<path d="([^"]+)"/)[1]);
    assert.match(svg, /class="rank-core"/);
    assert.match(svg, /class="emblem-field rank-detail"/);
    assert.doesNotMatch(svg, /<animate|<filter|Math.random/);
  }
  assert.equal(new Set(collectorDies).size, 12);
  for (let tier = 0; tier < 12; tier++) {
    const lumen = lumenEmblemMarkup(tier, 'A');
    const folio = editionEmblemMarkup(tier, 'folio');
    const pulse = editionEmblemMarkup(tier, 'pulse');
    assert.match(lumen, /viewBox="-30 -30 300 300"/);
    assert.match(lumen, /class="field-orbit"/);
    assert.equal((lumen.match(/d="M120 19v\d"/g) || []).length, 60);
    assert.match(folio, /M35 32h170v158H35Z/);
    assert.match(folio, /m120 52 58 58-58 58-58-58Z/);
    assert.equal((folio.match(/<rect\b/g) || []).length, 12, 'FOLIO retains the twelve progress pips');
    assert.match(pulse, /<rect x="25" y="32" width="190" height="158" rx="12"/);
    assert.match(pulse, /class="signal-trace"/);
    assert.equal((pulse.match(/<rect\b/g) || []).length, 14, 'PULSE retains its cartridge and twelve pips');
    assert.doesNotMatch(lumen + folio + pulse, /rank-reading-plane|data-identity=|class="rank-core"/);
  }
  assert.throws(() => emblemMarkup(0, '"><script>'), RangeError);
});

test('crest paint servers never collide with the surrounding page IDs', () => {
  const { emblemMarkup } = require('../src/app.js');
  for (let tier = 0; tier < 12; tier++) {
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    for (const side of ['A', 'B', 'Result']) {
      const svg = emblemMarkup(tier, side) + lumenEmblemMarkup(tier, side);
      for (const [, id] of svg.matchAll(/\bid="([^"]+)"/g)) {
        assert.ok(!ids.has(id), `document-wide duplicate paint ID: ${id}`);
        ids.add(id);
      }
    }
  }
});

test('restored editions keep large V1-style marks and edition-specific Collector labels', () => {
  const { emblemMarkup } = require('../src/app.js');
  for (let tier = 0; tier < 12; tier++) {
    const collector = emblemMarkup(tier, 'A');
    const lumen = lumenEmblemMarkup(tier, 'A');
    const folio = editionEmblemMarkup(tier, 'folio');
    const pulse = editionEmblemMarkup(tier, 'pulse');
    const long = tier === 8 || tier === 9;
    assert.match(collector, /class="rank-glyph"/);
    assert.equal(collector.includes('class="rank-certification"'), tier === 9 || tier === 11);
    assert.equal(lumen.includes('COLLECTOR OPTICS'), tier === 9 || tier === 11);
    assert.equal(folio.includes('COLLECTOR · '), tier === 9 || tier === 11);
    assert.equal(pulse.includes('COLLECTOR · '), tier === 9 || tier === 11);
    assert.equal(+lumen.match(/font-size="(\d+)" font-weight="300"/)[1], long ? 50 : 64);
    assert.equal(+folio.match(/class="edition-glyph"[^>]*font-size="(\d+)"/)[1], long ? 54 : 72);
    assert.equal(+pulse.match(/class="edition-glyph"[^>]*font-size="(\d+)"/)[1], long ? 54 : 72);
    assert.doesNotMatch(lumen + folio + pulse, /class="rank-certification"|rank-reading-plane/);
  }
});
