/* =========================================================
   numerical-battle-lab · src/app.js
   单页 UI（Dark Analytical Arena）：
   选卡 → 调等级 → 开始 → 回放事件列表 → 看结果。
   播放速度（慢/快/瞬）只改变事件之间的延迟，绝不改变结果。
   本文件只做展示；战斗/数值/胜负逻辑全部在 battle.js / power.js。
   ========================================================= */
(function (global) {
  'use strict';

  const M = (typeof module !== 'undefined' && module.exports)
    ? Object.assign({}, require('./cards.js'), require('./power.js'), require('./battle.js'))
    : global.NCB;
  const { CARDS, RARITY_LIST, buildUnit, battlePower, fmt, statRows, STAT_LABELS, simulate } = M;

  const SPEEDS = { slow: 440, fast: 130, instant: 0 };

  function matchesCard(card, query) {
    const term = query.trim().toLowerCase();
    return [card.name, card.source, card.role, RARITY_LIST[card.rarity]]
      .some((value) => String(value || '').toLowerCase().includes(term));
  }

  function normalizeLevel(text, previous) {
    const value = Number(text);
    return text.trim() && Number.isFinite(value)
      ? Math.max(1, Math.min(100, Math.round(value))) : previous;
  }

  // ---- 纯逻辑：把事件应用到回放状态（供 UI 与测试共用，不依赖 DOM） ----
  function createViewState() {
    return { round: 0, hpA: 0, maxA: 1, hpB: 0, maxB: 1, aliveA: true, aliveB: true };
  }

  function applyEventToState(state, e) {
    state.round = e.round;
    state.hpA = e.hpA; state.maxA = e.maxA;
    state.hpB = e.hpB; state.maxB = e.maxB;
    state.aliveA = e.aliveA; state.aliveB = e.aliveB;
    return state;
  }

  // ---- 从事件文本派生 presentation-only 结构化行（不改战斗逻辑） ----
  function parseEvent(e) {
    const t = e.text;
    let hit = t.match(/^　(.+?) 对 (.+?) 造成 ([\d,]+) 伤害(?:（暴击！）)?/);
    if (hit) {
      const crit = t.includes('暴击');
      return { rnd: e.round, kind: crit ? 'crit' : 'hit', txt: `${hit[1]} → ${hit[2]}`, amt: `−${hit[3]} DMG` };
    }
    let heal = t.match(/^　(.+?) (?:再生，恢复|吸取) ([\d,]+) HP/);
    if (heal) return { rnd: e.round, kind: 'heal', txt: `${heal[1]} 回复`, amt: `+${heal[2]}` };
    let miss = t.match(/^　(.+?) 闪避了 (.+?) 的攻击/);
    if (miss) return { rnd: e.round, kind: 'miss', txt: `${miss[1]} 闪避 ← ${miss[2]}`, amt: '' };
    let death = t.match(/^💀 (.+?) 倒下/);
    if (death) return { rnd: e.round, kind: 'death', txt: `☠ ${death[1]} 倒下`, amt: '' };
    let victory = t.match(/^🏆 (.+?)（Lv\.\d+ .+?）获胜/);
    if (victory) return { rnd: e.round, kind: 'sys', txt: `🏆 ${victory[1]} 获胜`, amt: '' };
    if (t.includes('平局')) return { rnd: e.round, kind: 'draw', txt: '⚖ 平局', amt: '' };
    return { rnd: e.round, kind: 'sys', txt: t.replace(/^⚔ /, ''), amt: '' };
  }

  // Presentation metadata derives from immutable snapshots and side-prefixed labels.
  // It never consumes engine RNG, and remains unambiguous for mirror matches.
  function describeEvent(e, previous) {
    const parsed = parseEvent(e);
    const side = e.text.match(/(?:蓝方|红方)·/);
    const first = side ? (side[0] === '蓝方·' ? 'A' : 'B') : null;
    const other = first === 'A' ? 'B' : 'A';
    const attack = parsed.kind === 'hit' || parsed.kind === 'crit';
    const target = attack ? other : ['heal', 'miss', 'death'].includes(parsed.kind) ? first : null;
    const amount = previous && target ? Math.abs(e['hp' + target] - previous['hp' + target]) : 0;
    return { ...parsed, source: attack ? first : parsed.kind === 'miss' ? other : first,
      target, amount, drain: parsed.kind === 'heal' && e.text.includes('吸取'),
      heavy: attack && amount / e['max' + target] >= .18 };
  }

  function summarizeEvents(events) {
    const fresh = () => ({ damage: 0, healing: 0, crits: 0, dodges: 0, peak: 0 });
    const totals = { A: fresh(), B: fresh() };
    events.forEach((e, i) => {
      const p = describeEvent(e, events[i - 1]);
      if ((p.kind === 'hit' || p.kind === 'crit') && p.source) {
        const t = totals[p.source]; t.damage += p.amount; t.peak = Math.max(t.peak, p.amount);
        if (p.kind === 'crit') t.crits++;
      } else if (p.kind === 'heal' && p.target) totals[p.target].healing += p.amount;
      else if (p.kind === 'miss' && p.target) totals[p.target].dodges++;
    });
    return totals;
  }

  function eventDelay(kind, speed) {
    if (!speed) return 0;
    return Math.round(speed * ({ crit: 1.65, death: 1.8, heal: .55, sys: 1.15, draw: 1.5 }[kind] || 1));
  }

  function parseSeed(value) {
    const text = value.trim();
    if (!text) return null;
    return /^\d+$/.test(text) && Number(text) <= 0xFFFFFFFF ? Number(text) : undefined;
  }

  // Visual complexity is an explicit rarity ladder, unrelated to engine strength or RNG.
  function rarityFinish(tier) {
    const particles = [3, 3, 4, 4, 5, 5, 7, 8, 12, 16, 18, 22][tier];
    const material = tier === 11 ? 'CELESTIAL GOLD' : tier === 10 ? 'SOLAR FOIL' :
      tier === 9 ? 'COLLECTOR COPPER' : tier === 8 ? 'AURIC FOIL' : tier >= 6 ? 'PRISM ALLOY' : tier >= 4 ? 'SAPPHIRE ENAMEL' : tier >= 2 ? 'CHROMA TITANIUM' : 'PLATINUM ALLOY';
    const color = ['#b5ccda', '#d4e3ee', '#8dc9a9', '#8de6c0', '#93c5f8', '#aab8ff', '#c3abf2', '#e5a9d3', '#e6c18b', '#f3b891', '#f5d994', '#f7dcb3'][tier];
    return { particles, material, color, tier: String(tier + 1).padStart(2, '0') };
  }

  function emblemMarkup(tier, side) {
    const collector = tier === 9 || tier === 11, premium = tier >= 8;
    const glyph = RARITY_LIST[tier].replace(' Collector', '');
    const metal = `url(#metal${side})`, enamel = `url(#face${side})`;
    const highlight = premium ? '#fff0d2' : '#f0f8ff';
    const shadow = premium ? '#9c7b47' : '#738e9f';
    // Authored, cut-metal lettering shares the seal's bevel and geometry. Paths stay inside
    // the opaque face; rings, bridges and moving light are painted behind that face.
    const letters = {
      C: 'M27 0H8L1 7v22l7 7h19v-8H12l-3-3V11l3-3h15Z',
      B: 'M1 0h18l9 8v7l-5 3 5 3v7l-9 8H1Zm8 8v6h9l2-2-2-4Zm0 14v6h9l2-4-2-2Z',
      A: 'M1 36 11 0h9l10 36h-9l-2-8h-8l-2 8Zm12-16h4l-2-10Z',
      S: 'M28 0 25 8H12Q9 8 9 11q0 2 4 3l7 3q9 3 9 10 0 9-11 9H1l3-8h13q4 0 4-3 0-2-4-3l-7-3Q1 16 1 9 1 0 12 0Z',
      X: 'M0 0h10l5 11L20 0h10L20 18l10 18H20l-5-11-5 11H0l10-18Z',
      '+': 'M3 14h8V6h7v8h8v7h-8v8h-7v-8H3Z'
    };
    const scale = glyph.length > 2 ? 1 : 1.23;
    const width = (glyph.length * 34 - 4) * scale;
    const mark = [...glyph].map((letter, i) => `<path d="${letters[letter]}" transform="translate(${i * 34} 0)"/>`).join('');
    const ticks = Array.from({ length: 60 }, (_, i) =>
      `<path d="M120 13v${i % 5 === 0 ? 7 : 2}" transform="rotate(${i * 6} 120 120)"/>`).join('');
    const mounts = Array.from({ length: premium ? 8 : 4 }, (_, i) =>
      `<g transform="rotate(${i * (premium ? 45 : 90) + 45} 120 120)"><path d="m115 22 5-4 5 4v9l-5 3-5-3Z" fill="${metal}"/><path d="M117 25h6" stroke="#101a23"/></g>`).join('');
    const family = tier < 2 ? 'M78 54h84l27 27v78l-27 27H78l-27-27V81Z' :
      tier < 4 ? 'M120 44 189 81v78l-69 38-69-38V81Z' :
      tier < 6 ? 'M120 38 195 120 120 200 45 120Z' : 'M120 43 180 69 195 120 180 171 120 197 60 171 45 120 60 69Z';
    const bridges = tier < 2 ? 'M30 87h15v66H30l-7-9V96ZM210 87h-15v66h15l7-9V96Z' :
      tier < 4 ? 'M36 66 51 58v21L35 92ZM36 174l15 8v-21l-16-13ZM204 66l-15-8v21l16 13ZM204 174l-15 8v-21l16-13Z' :
      'M120 20 130 35l-10 10-10-10ZM220 120l-15 10-10-10 10-10ZM120 220l-10-15 10-10 10 10ZM20 120l15-10 10 10-10 10Z';
    const facets = premium ? `<g class="emblem-facets" stroke="${metal}"><path d="M120 23 188 52 217 120 188 188 120 217 52 188 23 120 52 52Z M120 30 183 57 210 120 183 183 120 210 57 183 30 120 57 57Z"/></g>` : '';
    const wings = collector ? `<g class="emblem-wings" fill="${metal}"><path d="m42 61-20 20 8 14 15-16-12-1Zm-10 34-18 19 11 17 14-18-12-4Zm1 35-13 23 17 15 8-19-12-2Zm12 31-5 23 23 11 1-19-12 1Zm23 22 2 20 27 4-8-15-11 3ZM198 61l20 20-8 14-15-16 12-1Zm10 34 18 19-11 17-14-18 12-4Zm-1 35 13 23-17 15-8-19 12-2Zm-12 31 5 23-23 11-1-19 12 1Zm-23 22-2 20-27 4 8-15 11 3Z"/></g>` : '';
    const star = tier >= 10 ? `<g class="emblem-star" fill="${metal}"><path d="m120 0 9 27-9 15-9-15ZM240 120l-27 9-15-9 15-9ZM120 240l-9-27 9-15 9 15ZM0 120l27-9 15 9-15 9Z"/><path d="M52 52 69 60 60 69ZM188 52l-17 8 9 9ZM188 188l-17-8 9-9ZM52 188l17-8-9-9Z"/></g>` : '';
    const astrolabe = tier === 11 ? `<g class="emblem-astrolabe" stroke="${metal}"><path d="M43 28a120 120 0 0 1 154 0M212 43a120 120 0 0 1 0 154M197 212a120 120 0 0 1-154 0M28 197a120 120 0 0 1 0-154"/><path d="m37 37 8-2-2 8-8 2ZM203 37l-8-2 2 8 8 2ZM203 203l-8 2 2-8 8-2ZM37 203l8 2-2-8-8-2Z" fill="${metal}"/></g>` : '';
    const crown = collector ? `<path class="emblem-crown" d="m100 70 5 12h30l5-12-12 5-8-12-8 12Z" fill="${metal}"/>` :
      `<path class="emblem-insignia" d="m107 73 13-8 13 8-13 8Z" fill="${metal}"/><path d="M120 68v10" stroke="#14202c"/>`;
    return `<svg viewBox="0 0 240 240" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="metal${side}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${highlight}"/><stop offset=".2" stop-color="currentColor"/><stop offset=".43" stop-color="${shadow}"/><stop offset=".49" stop-color="${highlight}"/><stop offset=".7" stop-color="currentColor"/><stop offset="1" stop-color="${shadow}"/></linearGradient>
        <linearGradient id="face${side}" x2=".8" y2="1"><stop stop-color="#3a4b58"/><stop offset=".43" stop-color="#172632"/><stop offset=".44" stop-color="#111e2c"/><stop offset="1" stop-color="#070f1a"/></linearGradient>
      </defs>
      <circle class="emblem-base" cx="120" cy="120" r="102" fill="${enamel}" stroke="${metal}" stroke-width="3"/>
      <g class="emblem-ticks">${ticks}</g><circle class="emblem-rim" cx="120" cy="120" r="91" stroke="${metal}"/>
      <circle class="emblem-inner" cx="120" cy="120" r="85"/><g class="emblem-mounts">${mounts}</g>
      <path class="emblem-bridges" d="${bridges}" fill="${metal}"/>${facets}${wings}${astrolabe}${star}
      <circle class="emblem-glint" cx="120" cy="120" r="102" stroke="${highlight}" stroke-width="1.8" stroke-dasharray="24 617"/>
      <path d="${family}" transform="translate(0 4)" fill="#020812" opacity=".65"/>
      <g class="emblem-face"><path d="${family}" fill="${metal}"/><path d="${family}" transform="translate(120 120) scale(.91) translate(-120 -120)" fill="${enamel}" stroke="currentColor" stroke-width=".5"/>
        <path d="${family}" transform="translate(120 120) scale(.83) translate(-120 -120)" stroke="currentColor" opacity=".15"/>
        ${crown}<g class="emblem-letter" data-mark="${glyph}" transform="translate(${120 - width / 2} ${134 - 36 * scale}) scale(${scale})" fill="${metal}" fill-rule="evenodd">${mark}</g>
        <path d="M83 146h25l12 5 12-5h25M105 155h30" stroke="currentColor" opacity=".5"/>
        <text class="emblem-number" x="120" y="171" text-anchor="middle" fill="currentColor">${String(tier + 1).padStart(2, '0')} / XII</text>
      </g>
      <text class="emblem-edition" x="120" y="225" text-anchor="middle" fill="currentColor">${collector ? 'COLLECTOR' : tier >= 10 ? 'APEX' : premium ? 'PRESTIGE' : tier >= 4 ? 'PRISM' : tier >= 2 ? 'CHROMA' : 'PLATINUM'}</text>
    </svg>`;
  }

  // ---- DOM 初始化（浏览器端） ----
  function initApp() {
    if (typeof document === 'undefined') return null;
    const el = (id) => document.getElementById(id);

    const selA = el('selA'), selB = el('selB');
    const lvlA = el('lvlA'), lvlB = el('lvlB');
    const lvlAVal = el('lvlAVal'), lvlBVal = el('lvlBVal');
    const searchA = el('searchA'), searchB = el('searchB');
    const logbox = el('logbox');
    const logCount = el('logCount');
    const resultBox = el('resultBox');
    const startBtn = el('startBtn');
    const againBtn = el('againBtn');
    const resultAgainBtn = el('resultAgainBtn');
    const roundTxt = el('roundTxt');
    const hudState = el('hudState');
    const battleHud = el('battleHud');

    const hud = {
      barA: el('hpbarA'), barB: el('hpbarB'),
      hpA: el('hpTA'), hpB: el('hpTB'),
      pctA: el('pctA'), pctB: el('pctB')
    };

    const state = { playing: false, delay: SPEEDS.slow, events: [], seed: 0, eventCount: 0, selectionKey: '', previous: null, follow: true, lastRound: -1 };
    const reduced = global.matchMedia('(prefers-reduced-motion: reduce)');
    const motions = new Map();
    const counters = new Map();
    let counterFrame = 0;
    function animate(node, frames, options, playback = true) {
      const surface = node.closest('.pcard, .battle-hud');
      if (reduced.matches || document.hidden || (playback && state.delay === 0) || (surface && !surface.classList.contains('in-view'))) return;
      motions.get(node)?.cancel();
      const animation = node.animate(frames, { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)', ...options });
      motions.set(node, animation);
      animation.onfinish = () => { if (motions.get(node) === animation) motions.delete(node); };
    }
    function countTo(node, value, suffix = '', immediate = false) {
      if (!immediate && counters.get(node)?.value === value) return;
      const from = Number(node.dataset.displayValue ?? value);
      node.dataset.value = value;
      counters.delete(node);
      if (immediate || reduced.matches || document.hidden || (state.playing && state.delay === 0) || from === value) {
        node.dataset.displayValue = value; node.textContent = fmt(value) + suffix; return;
      }
      counters.set(node, { from, value, suffix, start: performance.now() });
      if (!counterFrame) counterFrame = requestAnimationFrame(tickCounters);
    }
    function tickCounters(now) {
      for (const [node, c] of counters) {
        const t = Math.min(1, (now - c.start) / 280);
        const value = c.from + (c.value - c.from) * (1 - Math.pow(1 - t, 3));
        node.dataset.displayValue = value;
        node.textContent = fmt(value) + c.suffix;
        if (t === 1) counters.delete(node);
      }
      counterFrame = counters.size ? requestAnimationFrame(tickCounters) : 0;
    }

    // One bounded canvas, active only while transient particles exist. No combat randomness.
    const canvas = el('battleFx'), ctx = canvas.getContext('2d');
    let particles = [], fxFrame = 0, geometry = { width: 1, height: 1, A: [0, 0], B: [0, 0] };
    function resizeFx() {
      const box = battleHud.getBoundingClientRect();
      const dpr = Math.min(2, global.devicePixelRatio || 1);
      canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr);
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      geometry = { width: box.width, height: box.height };
      for (const side of ['A', 'B']) {
        const r = el('fighter' + side).getBoundingClientRect();
        geometry[side] = [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
      }
    }
    new ResizeObserver(resizeFx).observe(battleHud);
    function burst(p) {
      if (!ctx || reduced.matches || document.hidden || !stageVisible || !state.delay || !p.target) return;
      const now = performance.now(), target = geometry[p.target];
      const source = p.drain ? geometry[p.target === 'A' ? 'B' : 'A'] : geometry[p.source] || target;
      const rarityColor = rarityFinish(currentCard(p.source || p.target).rarity).color;
      const color = p.kind === 'heal' ? '#77e0b5' : p.kind === 'crit' ? rarityColor : p.source === 'A' ? '#72ceff' : '#ff8d9a';
      const attack = p.kind === 'hit' || p.kind === 'crit' || p.kind === 'miss';
      if (attack || p.drain) particles.push({ type: 'beam', source, target, color, start: now, life: p.drain ? 380 : 340, miss: p.kind === 'miss', critical: p.kind === 'crit' });
      const count = p.kind === 'crit' ? 38 : p.kind === 'death' ? 42 : p.kind === 'miss' ? 7 : 18;
      for (let i = 0; i < count; i++) {
        const angle = (i * 2.39996 + state.eventCount * .7), force = 25 + (i * 37 % 115);
        particles.push({ type: 'spark', x: target[0], y: target[1], vx: Math.cos(angle) * force,
          vy: p.kind === 'heal' ? -30 - (i * 11 % 100) : Math.sin(angle) * force,
          color, start: now + (attack ? 100 : 0), life: 450 + i % 5 * 70, size: i % 4 === 0 ? 3 : 1.5 });
      }
      if (p.kind === 'crit' || p.kind === 'death') particles.push({ type: 'ring', x: target[0], y: target[1], color, start: now + 90, life: 500 });
      particles = particles.slice(-180);
      if (!fxFrame) fxFrame = requestAnimationFrame(drawFx);
    }
    function drawFx(now) {
      ctx.clearRect(0, 0, geometry.width, geometry.height);
      particles = particles.filter(p => now - p.start < p.life);
      for (const p of particles) {
        const t = (now - p.start) / p.life; if (t < 0) continue;
        ctx.globalAlpha = Math.max(0, 1 - t); ctx.strokeStyle = p.color; ctx.fillStyle = p.color;
        if (p.type === 'beam') {
          const f = Math.min(1, t * 2), tail = Math.max(0, f - .35);
          const dx = p.target[0] - p.source[0], dy = p.target[1] - p.source[1];
          ctx.lineWidth = p.miss ? 1 : p.critical ? 5 : 3;
          ctx.shadowColor = p.color; ctx.shadowBlur = p.miss ? 0 : 12; ctx.beginPath();
          ctx.moveTo(p.source[0] + dx * tail, p.source[1] + dy * tail);
          ctx.lineTo(p.source[0] + dx * f, p.source[1] + dy * f + (p.miss ? -24 : 0)); ctx.stroke(); ctx.shadowBlur = 0;
        } else if (p.type === 'ring') {
          ctx.lineWidth = 2 * (1 - t); ctx.beginPath(); ctx.arc(p.x, p.y, 12 + t * 95, 0, Math.PI * 2); ctx.stroke();
        } else { ctx.fillRect(p.x + p.vx * t, p.y + p.vy * t + (t * t * 18), p.size * (1 - t), p.size); }
      }
      ctx.globalAlpha = 1;
      fxFrame = particles.length ? requestAnimationFrame(drawFx) : 0;
    }
    function clearMotion() {
      for (const a of motions.values()) a.cancel(); motions.clear();
      for (const [node, c] of counters) { node.textContent = fmt(c.value) + c.suffix; node.dataset.displayValue = c.value; }
      counters.clear(); cancelAnimationFrame(counterFrame); counterFrame = 0;
      particles = []; cancelAnimationFrame(fxFrame); fxFrame = 0;
      if (ctx) ctx.clearRect(0, 0, geometry.width, geometry.height);
      document.querySelectorAll('.float-number').forEach(n => n.remove());
    }
    reduced.addEventListener('change', () => { if (reduced.matches) clearMotion(); });
    document.documentElement.classList.toggle('page-hidden', document.hidden);
    document.addEventListener('visibilitychange', () => {
      document.documentElement.classList.toggle('page-hidden', document.hidden);
      if (document.hidden) clearMotion();
    });
    const observer = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('in-view', e.isIntersecting)));
    ['A', 'B'].forEach(side => observer.observe(el('panel' + side)));
    let stageVisible = true;
    const stageObserver = new IntersectionObserver(([entry]) => {
      stageVisible = entry.isIntersecting;
      battleHud.classList.toggle('in-view', stageVisible);
      if (!stageVisible) {
        particles = []; cancelAnimationFrame(fxFrame); fxFrame = 0;
        if (ctx) ctx.clearRect(0, 0, geometry.width, geometry.height);
      }
    });
    stageObserver.observe(battleHud);

    // Event-driven reflection: one pending frame, no permanent pointer animation loop.
    const finePointer = global.matchMedia('(hover: hover) and (pointer: fine)');
    let pointerFrame = 0, pointerPanel = null, pointerBox = null, pointerX = 0, pointerY = 0;
    function resetPointer() {
      cancelAnimationFrame(pointerFrame); pointerFrame = 0;
      if (pointerPanel) {
        pointerPanel.classList.remove('pointer-active');
        pointerPanel.style.removeProperty('--lean-x'); pointerPanel.style.removeProperty('--lean-y');
      }
      pointerPanel = null; pointerBox = null;
    }
    ['A', 'B'].forEach(side => {
      const panel = el('panel' + side);
      panel.addEventListener('pointerenter', () => {
        if (!finePointer.matches || reduced.matches || document.hidden || state.playing) return;
        resetPointer(); pointerPanel = panel; pointerBox = panel.getBoundingClientRect();
        panel.classList.add('pointer-active');
      });
      panel.addEventListener('pointermove', e => {
        if (pointerPanel !== panel || !pointerBox) return;
        pointerX = e.clientX - pointerBox.left; pointerY = e.clientY - pointerBox.top;
        if (!pointerFrame) pointerFrame = requestAnimationFrame(() => {
          pointerFrame = 0;
          panel.style.setProperty('--lean-x', ((pointerX / pointerBox.width - .5) * 5).toFixed(2) + 'px');
          panel.style.setProperty('--lean-y', ((pointerY / pointerBox.height - .5) * 4).toFixed(2) + 'px');
          panel.querySelector('.card-reflection').style.transform = `translate3d(${pointerX - 110}px,${pointerY - 110}px,0)`;
        });
      });
      panel.addEventListener('pointerleave', resetPointer);
    });
    global.addEventListener('scroll', resetPointer, { passive: true });
    global.addEventListener('resize', resetPointer, { passive: true });
    document.addEventListener('visibilitychange', resetPointer);
    reduced.addEventListener('change', resetPointer);

    function present(p) {
      ['A', 'B'].forEach(side => { el('panel' + side).removeAttribute('data-action'); el('fighter' + side).removeAttribute('data-action'); });
      const labels = { hit: 'HIT', crit: 'CRITICAL', heal: p.drain ? 'LIFE STEAL' : 'REGEN', miss: 'EVADE', death: 'K.O.', sys: 'ENGAGE', draw: 'DRAW' };
      const readout = el('eventReadout'); readout.className = 'event-readout ' + p.kind;
      readout.querySelector('.event-tag').textContent = labels[p.kind];
      el('eventText').textContent = p.txt;
      el('eventAmount').textContent = p.amount ? (p.kind === 'heal' ? '+' : '−') + fmt(p.amount) : '';
      if (!p.target) return;
      const fighter = el('fighter' + p.target);
      const action = p.kind === 'heal' ? 'recover' : p.kind === 'miss' ? 'evade' : p.kind === 'death' ? 'fallen' : 'impact';
      fighter.dataset.action = action; el('panel' + p.target).dataset.action = action;
      if (p.source !== p.target && p.source && p.kind !== 'heal') {
        el('panel' + p.source).dataset.action = 'attack'; el('fighter' + p.source).dataset.action = 'attack';
        animate(el('panel' + p.source).querySelector('.rarity-art'), [{ transform: 'scale(.94)', filter: 'brightness(1.4)' }, { transform: 'scale(1)', filter: 'brightness(1)' }]);
      }
      burst(p);
      const chip = document.createElement('span'); chip.className = 'float-number ' + p.kind;
      chip.textContent = p.kind === 'miss' ? 'MISS' : p.kind === 'death' ? 'K.O.' : (p.kind === 'crit' ? 'CRIT −' : p.kind === 'heal' ? '+' : '−') + fmt(p.amount);
      if (!reduced.matches && !document.hidden && stageVisible && state.delay) {
        const layer = el('float' + p.target); if (layer.children.length >= 3) layer.firstChild.remove();
        layer.appendChild(chip);
        const float = chip.animate([{ opacity: 0, transform: 'translateY(12px) scale(.8)' }, { opacity: 1, transform: 'translateY(0) scale(1.08)', offset: .18 }, { opacity: 0, transform: 'translateY(-42px) scale(1)' }], { duration: state.delay < 200 ? 540 : 880, easing: 'ease-out' });
        float.onfinish = () => chip.remove();
      }
      if (p.kind === 'miss') animate(fighter, [{ transform: 'translateX(0)' }, { transform: 'translateX(' + (p.target === 'A' ? '-12px' : '12px') + ')', opacity: .5 }, { transform: 'translateX(0)', opacity: 1 }]);
      else if (p.kind === 'crit' || p.heavy) animate(fighter, [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)', filter: 'brightness(1.6)', offset: .18 }, { transform: 'translateX(5px)', offset: .32 }, { transform: 'translateX(0)', filter: 'brightness(1)' }]);
      else if (p.kind === 'heal') animate(fighter, [{ color: '#77e0b5', filter: 'brightness(1.25)' }, { filter: 'brightness(1)' }]);
      else if (p.kind === 'hit') animate(fighter, [{ filter: 'brightness(1.35)' }, { filter: 'brightness(1)' }]);
      if (p.kind === 'death') animate(el('panel' + p.target), [{ transform: 'translateY(0)' }, { transform: 'translateY(5px)' }], { duration: 650 });
    }
    function announce(text) {
      const node = el('stageAnnouncement'); node.textContent = text;
      animate(node, [{ opacity: 0, transform: 'translateY(8px) scale(.96)' }, { opacity: .95, transform: 'translateY(0) scale(1)', offset: .2 }, { opacity: 0, transform: 'translateY(-10px) scale(1.03)' }], { duration: 850 });
    }
    function renderSummary(events) {
      const totals = summarizeEvents(events);
      const rows = [['damage', '总伤害'], ['healing', '有效治疗'], ['crits', '暴击'], ['dodges', '闪避'], ['peak', '最高单次']];
      el('summaryBody').innerHTML = rows.map(([key, label]) => '<tr><th scope="row">' + label + '</th><td>' + (events.length ? fmt(totals.A[key]) : '—') + '</td><td>' + (events.length ? fmt(totals.B[key]) : '—') + '</td></tr>').join('');
      el('summaryRound').textContent = events.length ? 'ROUND ' + events[events.length - 1].round : '等待战斗';
    }
    el('followLog').addEventListener('click', () => { state.follow = !state.follow; syncFollow(); if (state.follow) logbox.scrollTop = logbox.scrollHeight; });
    function syncFollow() { el('followLog').setAttribute('aria-pressed', String(state.follow)); el('followLog').textContent = state.follow ? '跟随最新' : '已暂停跟随'; }
    logbox.addEventListener('wheel', e => { if (e.deltaY < 0) { state.follow = false; syncFollow(); } }, { passive: true });
    logbox.addEventListener('touchstart', () => { state.follow = false; syncFollow(); }, { passive: true });
    logbox.addEventListener('keydown', e => { if (['ArrowUp', 'PageUp', 'Home'].includes(e.key)) { state.follow = false; syncFollow(); } });
    renderSummary([]);

    // ---- 卡牌下拉：按稀有度分组 ----
    function fillSelect(sel, selected, query = '') {
      sel.innerHTML = '';
      const groups = {};
      let count = 0;
      function option(c, i, prefix = '') {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = `${prefix}${c.name} [${RARITY_LIST[c.rarity]}] ${c.role}${c.source ? ` · ${c.source}` : ''}`;
        return o;
      }
      if (!matchesCard(CARDS[selected], query)) {
        const current = document.createElement('optgroup');
        current.label = '当前选择';
        current.appendChild(option(CARDS[selected], selected, '当前选择 · '));
        sel.appendChild(current);
      }
      CARDS.forEach((c, i) => {
        if (!matchesCard(c, query)) return;
        count++;
        const r = RARITY_LIST[c.rarity];
        (groups[r] = groups[r] || []).push({ c, i });
      });
      RARITY_LIST.forEach((r) => {
        if (!groups[r]) return;
        const og = document.createElement('optgroup');
        og.label = '— ' + r + ' —';
        groups[r].forEach(({ c, i }) => {
          og.appendChild(option(c, i));
        });
        sel.appendChild(og);
      });
      sel.value = selected;
      const hint = el('searchHint' + (sel === selA ? 'A' : 'B'));
      hint.hidden = !query.trim();
      hint.textContent = count ? `${count} 张匹配 · 下拉选择卡牌` : '无匹配卡牌 · 已保留当前选择，清空搜索可查看全部';
    }
    // The established crossover matchup showcases rarity without a predetermined winner.
    fillSelect(selA, CARDS.findIndex(card => card.id === 'origin_star'));
    fillSelect(selB, CARDS.findIndex(card => card.id === 'iron_guard'));

    [[searchA, selA], [searchB, selB]].forEach(([search, select]) => {
      search.addEventListener('input', () => fillSelect(select, +select.value, search.value));
    });

    // 桌面总是展开；手机偏好独立保存，渲染卡牌不会覆盖它。
    const mobile = global.matchMedia('(max-width: 760px)');
    const expanded = { A: false, B: false };
    function syncStatsVisibility() {
      ['A', 'B'].forEach((side) => {
        const open = !mobile.matches || expanded[side];
        const button = el('statsToggle' + side);
        el('secondaryStats' + side).hidden = !open;
        button.hidden = !mobile.matches;
        button.setAttribute('aria-expanded', String(open));
        button.innerHTML = `${open ? '收起属性' : '更多属性'} <span aria-hidden="true">${open ? '−' : '＋'}</span>`;
      });
    }
    ['A', 'B'].forEach((side) => {
      el('statsToggle' + side).addEventListener('click', () => {
        expanded[side] = !expanded[side];
        syncStatsVisibility();
      });
    });
    mobile.addEventListener('change', syncStatsVisibility);
    syncStatsVisibility();

    function currentCard(side) {
      return CARDS[+(side === 'A' ? selA : selB).value];
    }
    function currentLevel(side) {
      return +(side === 'A' ? lvlA : lvlB).value;
    }

    // ---- 渲染一侧 Player Card（identity + BP + BP 差值 + stats） ----
    function renderSide(side, unit, deltaInfo, power) {
      const card = CARDS[unit.cardId] || currentCard(side);
      const panel = el('panel' + side);
      const changedCard = panel.dataset.card !== card.id;
      const changedLevel = panel.dataset.level !== String(unit.level);
      const mounted = panel.dataset.card !== undefined;
      if (changedCard) {
        el('name' + side).textContent = card.name;
        el('rar' + side).textContent = unit.rarityName;
        el('rar' + side).className = 'rar-badge t' + card.rarity;
        el('role' + side).textContent = card.role;
        el('desc' + side).textContent = card.source ? `${card.source} · ${card.desc}` : card.desc;
      }
      countTo(el('bp' + side), power);
      const finish = rarityFinish(card.rarity);
      if (panel.dataset.rarity !== String(card.rarity)) {
        el('emblem' + side).innerHTML = emblemMarkup(card.rarity, side);
        el('ambient' + side).innerHTML = Array.from({ length: finish.particles }, (_, i) =>
          `<i style="--x:${8 + i * 43 % 85}%;--y:${6 + i * 29 % 64}%;--drift:${(i % 3 - 1) * 14}px;--duration:${8 + i % 7}s;--delay:-${i * 1.7}s;--size:${i % 5 === 0 ? 3 : 1.5}px"></i>`).join('');
      }
      panel.dataset.rarity = card.rarity;
      panel.dataset.card = card.id; panel.dataset.level = unit.level;
      el('cardCode' + side).textContent = 'N° ' + String(CARDS.indexOf(card) + 1).padStart(3, '0') + ' / 096';
      el('material' + side).textContent = finish.material;
      el('tierIndex' + side).textContent = 'RARITY ' + finish.tier + ' / 12';
      panel.style.setProperty('--power-light', Math.min(.24, Math.max(.03, Math.log10(power) / 32)));
      el('fighter' + side).style.setProperty('--rarity-accent', finish.color);
      battleHud.style.setProperty('--foil-' + side.toLowerCase(), finish.color);
      el('lvl' + side).style.setProperty('--level-fill', (unit.level - 1) / 99 * 100 + '%');
      panel.classList.toggle('collector', card.rarity === 9 || card.rarity === 11);
      panel.classList.toggle('high-rarity', card.rarity >= 8);
      panel.classList.toggle('apex', card.rarity >= 10);

      const deltaEl = el('bpDelta' + side);
      if (deltaInfo) {
        const { sign, cls } = deltaInfo;
        deltaEl.textContent = sign;
        deltaEl.className = 'bp-delta ' + cls;
      } else {
        deltaEl.textContent = '';
        deltaEl.className = 'bp-delta';
      }

      if (changedCard || changedLevel) {
        const rows = statRows(unit);
        const codes = { maxHp: 'HP', atk: 'ATK', def: 'DEF', spd: 'SPD' };
        if (!mounted) {
          el('stats' + side).innerHTML = rows.slice(0, 4)
            .map(([k, v]) => `<div class="stat-tile"><span class="k">${STAT_LABELS[k]} <span class="stat-code">${codes[k]}</span></span><span class="v">${v}</span></div>`).join('');
          el('secondaryStats' + side).innerHTML = rows.slice(4)
            .map(([k, v]) => `<div class="stat-row"><span class="k">${STAT_LABELS[k]}</span><span class="v">${v}</span></div>`).join('');
        } else {
          [...el('stats' + side).querySelectorAll('.v'), ...el('secondaryStats' + side).querySelectorAll('.v')].forEach((node, i) => {
            if (node.textContent !== rows[i][1]) node.textContent = rows[i][1];
          });
          if (changedCard) animate(panel.querySelector('.seal-flare'),
            [{ opacity: 0, transform: 'scale(.65)' }, { opacity: .7, offset: .25 }, { opacity: 0, transform: 'scale(1.18)' }],
            { duration: 850 }, false);
          animate(panel.querySelector(changedCard ? '.identity' : '.power-pulse'), changedCard ?
            [{ opacity: .35, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }] :
            [{ opacity: 0, transform: 'translateX(-100%)' }, { opacity: .65, offset: .35 }, { opacity: 0, transform: 'translateX(100%)' }],
          { duration: changedCard ? 520 : 600 }, false);
        }
      }
    }

    // ---- 双侧刷新 + BP 百分比差值（presentation-only） ----
    function refreshAll() {
      const key = [selA.value, lvlA.value, selB.value, lvlB.value].join(':');
      if (state.playing || key === state.selectionKey) return;
      const needsReset = !state.selectionKey || state.events.length > 0;
      state.selectionKey = key;
      const uA = buildUnit(currentCard('A'), currentLevel('A'));
      const uB = buildUnit(currentCard('B'), currentLevel('B'));
      const bpA = battlePower(uA), bpB = battlePower(uB);

      const deltaFor = (mine, other) => {
        const pct = (mine / other - 1) * 100;
        if (Math.abs(pct) < 0.05) return { sign: '±0.0%', cls: 'neu' };
        return pct > 0 ? { sign: `+${pct.toFixed(1)}%`, cls: 'pos' } : { sign: `${pct.toFixed(1)}%`, cls: 'neg' };
      };
      renderSide('A', uA, deltaFor(bpA, bpB), bpA);
      renderSide('B', uB, deltaFor(bpB, bpA), bpB);
      el('powerFillA').style.transform = 'scaleX(' + bpA / (bpA + bpB) + ')';
      el('powerFillB').style.transform = 'scaleX(' + bpB / (bpA + bpB) + ')';
      prepareArena(currentCard('A'), currentCard('B'));
      const ratio = Math.max(bpA, bpB) / Math.min(bpA, bpB);
      el('matchupHint').textContent = ratio < 1.06 ? 'BP 接近 · 胜负未定' : (bpA > bpB ? '蓝方' : '红方') + ' BP 领先 · ' + (ratio >= 2 ? '实力悬殊' : '等待交锋');
      if (!needsReset) {
        updateBar('A', uA.maxHp, uA.maxHp); updateBar('B', uB.maxHp, uB.maxHp);
        return;
      }
      el('replayBtn').disabled = true;
      renderSummary([]);
      ['A', 'B'].forEach(side => { el('panel' + side).classList.remove('fallen', 'victorious'); el('panel' + side).removeAttribute('data-action'); el('fighter' + side).removeAttribute('data-action'); });
      el('eventReadout').className = 'event-readout';
      el('eventReadout').querySelector('.event-tag').textContent = 'STANDBY';
      el('eventText').textContent = '两张卡牌，一场数值交锋。'; el('eventAmount').textContent = '';
      updateBar('A', uA.maxHp, uA.maxHp);
      updateBar('B', uB.maxHp, uB.maxHp);
      state.events = [];
      state.eventCount = 0;
      state.seed = 0;
      logCount.textContent = '0 EVENTS';
      logbox.innerHTML = '<div class="log-empty"><svg viewBox="0 0 160 32" aria-hidden="true"><path d="M0 16h52l8-8 12 16 16-24 12 24 8-8h52"/></svg><strong>等待第一场交锋</strong><span>选择卡牌与等级，开始后逐回合记录。</span></div>';
      resultBox.style.display = 'none';
      resultBox.className = 'result-panel';
      roundTxt.textContent = 'VS';
      hudState.textContent = 'READY';
      battleHud.classList.remove('finished');
      battleHud.classList.remove('live');
    }

    [[selA, searchA], [selB, searchB]].forEach(([select, search]) => {
      select.addEventListener('change', () => {
        fillSelect(select, +select.value, search.value);
        refreshAll();
      });
    });
    [[lvlA, lvlAVal], [lvlB, lvlBVal]].forEach(([slider, field]) => {
      slider.addEventListener('input', () => {
        field.value = slider.value;
        refreshAll();
      });
      field.addEventListener('input', () => {
        if (/^\d+$/.test(field.value) && +field.value >= 1 && +field.value <= 100) {
          slider.value = +field.value;
          refreshAll();
        }
      });
      function commitLevel() {
        const value = normalizeLevel(field.value, +slider.value);
        field.value = String(value);
        slider.value = value;
        refreshAll();
      }
      field.addEventListener('blur', commitLevel);
      field.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitLevel();
        }
      });
    });

    // ---- 速度 segmented control：只改 delay ----
    document.querySelectorAll('.spdbtn').forEach((b) => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.spdbtn').forEach((x) => {
          x.classList.remove('on');
          x.setAttribute('aria-pressed', 'false');
        });
        b.classList.add('on');
        b.setAttribute('aria-pressed', 'true');
        state.delay = SPEEDS[b.dataset.speed];
        document.querySelector('.app').dataset.playback = b.dataset.speed;
        if (!state.delay) state.finishWait?.();
      });
    });

    // ---- Battle HUD ----
    function updateBar(side, hp, max) {
      const pct = Math.max(0, Math.min(100, hp / max * 100));
      const bar = side === 'A' ? hud.barA : hud.barB;
      bar.style.transform = 'scaleX(' + pct / 100 + ')';
      el('hpTrail' + side).style.transform = 'scaleX(' + pct / 100 + ')';
      countTo(side === 'A' ? hud.hpA : hud.hpB, hp, '', !state.playing);
      el('hpMax' + side).textContent = ' / ' + fmt(max);
      el('panel' + side).classList.toggle('fallen', hp <= 0);
      (side === 'A' ? hud.pctA : hud.pctB).textContent = pct.toFixed(1) + '%';
      const panel = (side === 'A' ? hud.barA : hud.barB).closest('.hud-side');
      panel.classList.toggle('low', hp > 0 && pct <= 20);
      panel.classList.toggle('dead', hp <= 0);
      el('hpState' + side).textContent = hp <= 0 ? '已倒下' : pct <= 20 ? '低血量' : '';
    }

    // ---- Battle Log：结构化行 ----
    function appendLogRow(parsed, container = logbox) {
      const div = document.createElement('div');
      div.className = 'le ' + parsed.kind + (parsed.heavy ? ' heavy' : '');
      if (parsed.rnd !== state.lastRound) {
        const group = document.createElement('div'); group.className = 'log-round';
        group.textContent = parsed.rnd ? 'ROUND ' + String(parsed.rnd).padStart(2, '0') : 'MATCH START';
        container.appendChild(group); state.lastRound = parsed.rnd;
      }
      state.currentRow?.classList.remove('current'); div.classList.add('current'); state.currentRow = div;
      const rnd = document.createElement('span');
      rnd.className = 'rnd';
      rnd.textContent = ({ hit: 'HIT', crit: 'CRIT', heal: parsed.drain ? 'DRAIN' : 'HEAL', miss: 'MISS', death: 'K.O.', sys: 'SYS', draw: 'DRAW' })[parsed.kind];
      const txt = document.createElement('span');
      txt.className = 'txt';
      txt.textContent = parsed.txt;
      div.appendChild(rnd);
      div.appendChild(txt);
      if (parsed.amt) {
        const amt = document.createElement('span');
        amt.className = 'amt';
        amt.textContent = parsed.amt;
        div.appendChild(amt);
      }
      container.appendChild(div);
      if (container === logbox && state.follow) logbox.scrollTop = logbox.scrollHeight;
    }

    function applyEntry(e) {
      const parsed = describeEvent(e, state.previous);
      appendLogRow(parsed);
      if (state.previous && e.round !== state.previous.round) {
        animate(roundTxt, [{ transform: 'translateY(8px)', opacity: .4 }, { transform: 'translateY(0)', opacity: 1 }]);
      }
      present(parsed);
      state.previous = e;
      state.eventCount++;
      logCount.textContent = state.eventCount + ' EVENTS';
      updateBar('A', e.hpA, e.maxA);
      updateBar('B', e.hpB, e.maxB);
      roundTxt.textContent = String(e.round).padStart(2, '0');
      const difference = e.hpA / e.maxA - e.hpB / e.maxB;
      el('matchupHint').textContent = e.hpA / e.maxA < .2 && e.hpB / e.maxB < .2 ? '双方残血 · 决胜时刻' : Math.abs(difference) < .05 ? '生命比例接近 · 胜负未定' : (difference > 0 ? '蓝方' : '红方') + '生命比例领先';
    }

    // ---- Battle Result ----
    function showResult(r) {
      const a = r.a, b = r.b;
      countTo(hud.hpA, a.hp, '', true); countTo(hud.hpB, b.hp, '', true);
      const winner = r.winner;
      const winningCard = winner === -1 ? null : currentCard(winner === 0 ? 'A' : 'B');
      resultBox.style.setProperty('--foil', winningCard ? rarityFinish(winningCard.rarity).color : '#b9c6d5');
      el('resultMedal').innerHTML = winningCard ? emblemMarkup(winningCard.rarity, 'Result') : '<span>VS</span>';
      resultBox.style.display = 'flex';
      el('resultVerdict').textContent = winner === -1 ? 'DRAW' : 'VICTORY';
      if (winner === 0) {
        resultBox.className = 'result-panel win0';
        el('resultTitle').textContent = 'TEAM BLUE / 蓝方获胜';
        el('resultName').textContent = a.name;
        el('resultMeta').textContent = `${a.rarityName} · Lv.${a.level}`;
        el('resultHp').textContent = `${fmt(a.hp)} / ${fmt(a.maxHp)}`;
        el('resultPct').textContent = (a.hp / a.maxHp * 100).toFixed(1) + '%';
      } else if (winner === 1) {
        resultBox.className = 'result-panel win1';
        el('resultTitle').textContent = 'TEAM RED / 红方获胜';
        el('resultName').textContent = b.name;
        el('resultMeta').textContent = `${b.rarityName} · Lv.${b.level}`;
        el('resultHp').textContent = `${fmt(b.hp)} / ${fmt(b.maxHp)}`;
        el('resultPct').textContent = (b.hp / b.maxHp * 100).toFixed(1) + '%';
      } else {
        resultBox.className = 'result-panel draw';
        el('resultTitle').textContent = 'DRAW / 平局';
        el('resultName').textContent = '双方平局';
        el('resultMeta').textContent = '';
        el('resultHp').innerHTML = `<span>BLUE · ${fmt(a.hp)} / ${fmt(a.maxHp)}</span><span>RED · ${fmt(b.hp)} / ${fmt(b.maxHp)}</span>`;
        el('resultPct').textContent = `${(a.hp / a.maxHp * 100).toFixed(1)}%  ·  ${(b.hp / b.maxHp * 100).toFixed(1)}%`;
      }
    }

    function setControlsLocked(locked) {
      selA.disabled = locked;
      selB.disabled = locked;
      lvlA.disabled = locked;
      lvlB.disabled = locked;
      lvlAVal.disabled = locked;
      lvlBVal.disabled = locked;
      searchA.disabled = locked;
      searchB.disabled = locked;
      startBtn.disabled = locked;
      againBtn.disabled = locked;
      resultAgainBtn.disabled = locked;
      el('seedInput').disabled = locked;
      el('replayBtn').disabled = locked || !state.events.length;
    }

    function prepareArena(cardA, cardB) {
      el('sNameA').textContent = cardA.name;
      el('sNameB').textContent = cardB.name;
      el('sMetaA').textContent = `${RARITY_LIST[cardA.rarity]} · Lv.${lvlA.value}`;
      el('sMetaB').textContent = `${RARITY_LIST[cardB.rarity]} · Lv.${lvlB.value}`;
    }

    async function runBattle(mode = 'start') {
      if (state.playing) return;
      const input = el('seedInput');
      const seed = mode === 'replay' ? state.seed : mode === 'new' ? null : parseSeed(input.value);
      if (seed === undefined) {
        input.setAttribute('aria-invalid', 'true'); el('seedHint').textContent = '请输入 0–4294967295 的整数，或留空随机'; input.focus(); return;
      }
      input.removeAttribute('aria-invalid');
      state.seed = seed === null ? global.crypto.getRandomValues(new Uint32Array(1))[0] : seed;
      input.value = String(state.seed); el('seedHint').textContent = '当前 Seed · 可重播本局或开始新一局';
      state.playing = true; resetPointer(); clearMotion(); setControlsLocked(true);
      document.querySelector('.app').classList.add('is-playing');
      battleHud.classList.toggle('instant', !state.delay);
      state.follow = true; syncFollow(); state.lastRound = -1; state.previous = null; state.currentRow = null;
      logbox.innerHTML = ''; state.eventCount = 0; logCount.textContent = '0 EVENTS';
      resultBox.style.display = 'none'; roundTxt.textContent = '--';
      ['A', 'B'].forEach(side => el('panel' + side).classList.remove('fallen', 'victorious'));
      const cardA = currentCard('A'), cardB = currentCard('B');
      try {
        // Exactly one simulation. All timing, statistics and effects consume only its snapshots.
        const result = simulate(cardA, currentLevel('A'), cardB, currentLevel('B'), state.seed);
        state.events = result.events;
        prepareArena(cardA, cardB);
        updateBar('A', result.a.maxHp, result.a.maxHp); updateBar('B', result.b.maxHp, result.b.maxHp);
        hudState.textContent = 'IN BATTLE'; battleHud.classList.remove('finished'); battleHud.classList.add('live');
        // Starting from controls below the fold must bring the actual fight into view.
        battleHud.scrollIntoView({ behavior: 'instant', block: 'start' });
        resizeFx(); announce('BATTLE START'); renderSummary([]);
        if (state.delay) await new Promise(resolve => setTimeout(resolve, reduced.matches ? 120 : 650));
        for (let i = 0; i < result.events.length; i++) {
          if (!state.delay) {
            clearMotion(); battleHud.classList.add('instant');
            const fragment = document.createDocumentFragment();
            for (; i < result.events.length; i++) {
              const e = result.events[i]; appendLogRow(describeEvent(e, state.previous), fragment); state.previous = e; state.eventCount++;
            }
            logbox.appendChild(fragment); if (state.follow) logbox.scrollTop = logbox.scrollHeight;
            const last = state.previous; updateBar('A', last.hpA, last.maxA); updateBar('B', last.hpB, last.maxB);
            roundTxt.textContent = String(last.round).padStart(2, '0'); logCount.textContent = state.eventCount + ' EVENTS';
            break;
          }
          applyEntry(result.events[i]);
          await new Promise(resolve => {
            const timer = setTimeout(() => { state.finishWait = null; resolve(); }, eventDelay(result.events[i].cls, state.delay));
            state.finishWait = () => { clearTimeout(timer); state.finishWait = null; resolve(); };
          });
        }
        showResult(result); renderSummary(result.events);
        const victor = result.winner === 0 ? 'A' : 'B';
        if (result.winner !== -1) { el('panel' + victor).classList.add('victorious'); burst({ kind: 'crit', source: victor, target: victor }); }
        announce(result.winner === -1 ? 'DRAW' : 'VICTORY');
        el('eventReadout').className = 'event-readout result-event';
        el('eventReadout').querySelector('.event-tag').textContent = result.winner === -1 ? 'DRAW' : 'VICTORY';
        el('eventText').textContent = result.winner === -1 ? '势均力敌 · 本局平局' : (result.winner === 0 ? '蓝方 · ' + cardA.name : '红方 · ' + cardB.name) + ' 获胜';
        el('eventAmount').textContent = result.rounds + ' ROUNDS';
        hudState.textContent = 'FINISHED'; battleHud.classList.add('finished');
        el('matchupHint').textContent = '本局结束 · Seed ' + state.seed;
        animate(resultBox, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 600 });
      } catch (error) {
        hudState.textContent = 'ERROR'; el('eventText').textContent = '播放失败，请重试。'; console.error(error);
      } finally {
        state.playing = false; setControlsLocked(false); battleHud.classList.remove('live');
        ['A', 'B'].forEach(side => { el('panel' + side).removeAttribute('data-action'); el('fighter' + side).removeAttribute('data-action'); });
        document.querySelector('.app').classList.remove('is-playing');
      }
    }

    startBtn.addEventListener('click', () => runBattle());
    againBtn.addEventListener('click', () => runBattle('new'));
    resultAgainBtn.addEventListener('click', () => runBattle('new'));
    el('replayBtn').addEventListener('click', () => runBattle('replay'));

    refreshAll();
    return { state };
  }

  const API = { createViewState, applyEventToState, parseEvent, describeEvent, summarizeEvents, eventDelay, parseSeed, rarityFinish, emblemMarkup, matchesCard, normalizeLevel, initApp };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NCB = Object.assign(global.NCB || {}, API);
})(typeof window !== 'undefined' ? window : globalThis);
