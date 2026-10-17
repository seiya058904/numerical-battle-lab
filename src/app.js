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

  // Presentation tokens only. Each tier shares one manufacturing language; rank
  // controls the cut, assembly and field budget, never simulation strength.
  const RARITY_FINISHES = Object.freeze([
    { material: 'PLATINUM ALLOY', color: '#becbd3', light: '#f3f4ed', dark: '#485b69', enamel: '#14212b', spokes: 4, reach: 102, rings: 1, aura: .14, period: 76, particles: 3 },
    { material: 'POLISHED PLATINUM', color: '#d3dce1', light: '#fcfcf2', dark: '#536975', enamel: '#172831', spokes: 4, reach: 108, rings: 1, aura: .18, period: 72, particles: 3 },
    { material: 'CHROMA TITANIUM', color: '#a9c6b8', light: '#edf4d9', dark: '#46695f', enamel: '#102820', spokes: 6, reach: 108, rings: 2, aura: .21, period: 68, particles: 4 },
    { material: 'VERDIGRIS TITANIUM', color: '#bad9bd', light: '#f2f6d9', dark: '#54795c', enamel: '#192a23', spokes: 6, reach: 113, rings: 2, aura: .25, period: 64, particles: 4 },
    { material: 'SAPPHIRE ENAMEL', color: '#aec9dd', light: '#ecf4f2', dark: '#476a8c', enamel: '#11283c', spokes: 8, reach: 113, rings: 2, aura: .29, period: 60, particles: 5 },
    { material: 'LUNAR ENAMEL', color: '#c3d0ea', light: '#f4f3ff', dark: '#626d98', enamel: '#1b2540', spokes: 8, reach: 117, rings: 2, aura: .33, period: 56, particles: 5 },
    { material: 'AMETHYST IRIDIUM', color: '#c9b8dc', light: '#f7ecfa', dark: '#74608c', enamel: '#251c35', spokes: 8, reach: 120, rings: 3, aura: .39, period: 52, particles: 7 },
    { material: 'IMPERIAL IRIDIUM', color: '#ddc3d3', light: '#fff0eb', dark: '#886078', enamel: '#301d2b', spokes: 10, reach: 123, rings: 3, aura: .44, period: 48, particles: 8 },
    { material: 'AURIC FOIL', color: '#e6c18b', light: '#fff3d4', dark: '#896139', enamel: '#2a2114', spokes: 12, reach: 125, rings: 3, aura: .50, period: 44, particles: 12 },
    { material: 'COLLECTOR ELECTRUM', color: '#edc7a5', light: '#fff4df', dark: '#936746', enamel: '#2d2019', spokes: 12, reach: 128, rings: 4, aura: .57, period: 40, particles: 16 },
    { material: 'SOLAR GOLD', color: '#edd08d', light: '#fff8df', dark: '#947133', enamel: '#2c2512', spokes: 12, reach: 133, rings: 4, aura: .65, period: 36, particles: 18 },
    { material: 'CELESTIAL GOLD', color: '#f2d6a2', light: '#fff9e5', dark: '#9c763b', enamel: '#312715', spokes: 16, reach: 137, rings: 5, aura: .76, period: 32, particles: 22 }
  ].map(Object.freeze));

  function rarityFinish(tier) {
    if (!Number.isInteger(tier) || tier < 0 || tier >= RARITY_FINISHES.length) throw new RangeError('Unknown rarity tier');
    return { ...RARITY_FINISHES[tier], tier: String(tier + 1).padStart(2, '0') };
  }

  // Collector silhouettes are presentation semantics, independent of battle rarity multipliers.
  const RANK_FORMS = Object.freeze({
    collector: Object.freeze([
      'M73 48H167L192 73V167L167 192H73L48 167V73Z',
      'M70 44H170L196 70V170L170 196H70L44 170V70Z M72 28H168V38H72Z M72 202H168V212H72Z',
      'M120 38L184 76V151L120 203L56 151V76Z',
      'M120 29L187 71V151L120 214L53 151V71Z M30 73L46 63V150L30 138Z M210 73L194 63V150L210 138Z',
      'M120 24L151 66L203 120L151 174L120 216L89 174L37 120L89 66Z',
      'M120 17L153 66L208 120L153 174L120 223L87 174L32 120L87 66Z M51 39L78 55L54 82L39 55Z M189 39L162 55L186 82L201 55Z',
      'M120 14L169 43L182 98L170 165L120 222L70 165L58 98L71 43Z M95 21L103 9L120 20L137 9L145 21L120 38Z',
      'M120 40L165 67L171 144L120 199L69 144L75 67Z M65 82L12 37L24 115L61 157L47 110Z M175 82L228 37L216 115L179 157L193 110Z',
      'M120 6L143 62L198 28L178 85L234 120L178 146L198 212L143 179L120 234L97 179L42 212L62 146L6 120L62 85L42 28L97 62Z',
      'M76 35H164L193 65V159L164 191H76L47 159V65Z M75 181L65 231L95 217L118 231L111 185Z M130 185L126 231L150 217L175 231L164 181Z M79 29L70 8L101 21L120 3L139 21L170 8L161 29Z',
      'M120 4L148 76L218 120L148 164L120 236L92 164L22 120L92 76Z M27 41L59 27L78 56L53 87Z M213 41L181 27L162 56L187 87Z M27 199L59 213L78 184L53 153Z M213 199L181 213L162 184L187 153Z',
      'M31 202V64L51 14L71 64V178L51 202Z M169 178V64L189 14L209 64V202L189 202Z M23 212H217V228H23Z M120 65L154 118L120 171L86 118Z M88 36L78 12L105 23L120 2L135 23L162 12L152 36Z'
    ])
  });
  const LUMEN_RANKS = Object.freeze(['#486477','#3b6575','#286b63','#236a58','#235f9d','#3155a5','#635093','#824d78','#846020','#77551b','#235f88','#2349a1']);
  const RANK_IDENTITIES = Object.freeze(['token','reinforced','shield','braced','facet','array','sanctum','duplex','radiant','archive','singularity','reliquary']);
  function rankPath(d, attrs = '') { return `<path d="${d}" ${attrs}/>`; }
  function rankSvg(tier, theme, content, style = '') {
    const glyph = RARITY_LIST[tier].replace(' Collector', '');
    return `<svg class="${theme}-emblem${['folio','pulse'].includes(theme) ? ' edition-emblem' : ''}" data-sculpture="procedural" data-tier="${tier}" data-identity="${RANK_IDENTITIES[tier]}" data-mark="${glyph}" viewBox="-8 -8 256 256" fill="none" aria-hidden="true" ${style}>${content}</svg>`;
  }
  function rankCertification(tier, theme) {
    if (tier !== 9 && tier !== 11) return '';
    const dark = theme === 'collector' || theme === 'pulse';
    return `<g class="rank-certification"><path d="M68 174H172V192H68Z" fill="${dark ? '#10131a' : '#fbf7e9'}" stroke="currentColor" stroke-width=".8"/><text x="120" y="186.5" text-anchor="middle" fill="currentColor" font-family="Segoe UI,sans-serif" font-size="10" font-weight="600" letter-spacing="1">COLLECTOR</text></g>`;
  }
  function collectorLetter(tier, side) {
    const glyph = RARITY_LIST[tier].replace(' Collector', '');
    const letters = {
      C: 'M27 0H8L1 7v22l7 7h19v-8H12l-3-3V11l3-3h15Z',
      B: 'M1 0h18l9 8v7l-5 3 5 3v7l-9 8H1Zm8 8v6h9l2-2-2-4Zm0 14v6h9l2-4-2-2Z',
      A: 'M1 36 11 0h9l10 36h-9l-2-8h-8l-2 8Zm12-16h4l-2-10Z',
      S: 'M28 0 25 8H12Q9 8 9 11q0 2 4 3l7 3q9 3 9 10 0 9-11 9H1l3-8h13q4 0 4-3 0-2-4-3l-7-3Q1 16 1 9 1 0 12 0Z',
      X: 'M0 0h10l5 11L20 0h10L20 18l10 18H20l-5-11-5 11H0l10-18Z',
      '+': 'M3 14h8V6h7v8h8v7h-8v8h-7v-8H3Z'
    };
    const scale = glyph.length > 2 ? 1.3 : 1.65;
    const width = (glyph.length * 34 - 4) * scale;
    const mark = [...glyph].map((letter, i) => `<path d="${letters[letter]}" transform="translate(${i * 34} 0)"/>`).join('');
    return `<g class="rank-label" fill-rule="evenodd"><g class="rank-glyph" transform="translate(${120 - width / 2} ${120 - 18 * scale}) scale(${scale})"><g transform="translate(1.2 2)" fill="#020609" stroke="#020609" stroke-width="1.3">${mark}</g><g fill="url(#crestLetter${side})" stroke="#e7edf0" stroke-width=".25">${mark}</g></g></g>`;
  }
  function emblemMarkup(tier, side) {
    const f = rarityFinish(tier);
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(side)) throw new RangeError('Invalid emblem namespace');
    const form = RANK_FORMS.collector[tier], metal = `url(#metal${side})`;
    const radius = tier < 2 ? 65 : tier < 6 ? 70 : 78;
    const body = Array.from({length:8}, (_,i) => {const a=(i*45+22.5)*Math.PI/180;return [120+radius*Math.cos(a),120+radius*Math.sin(a)].join(' ')}).join('L');
    const ticks = Array.from({length:tier < 6 ? 16 : 24},(_,i)=>`<path d="M120 ${120-radius+2}v4" transform="rotate(${i*360/(tier < 6 ? 16 : 24)} 120 120)" stroke="${f.light}" stroke-width=".7"/>`).join('');
    const extra = tier === 7 ? `<path class="emblem-wings" d="M22 61L56 93M28 89L57 116M35 120L60 143M218 61L184 93M212 89L183 116M205 120L180 143" stroke="${f.light}" stroke-width="2"/>` : tier === 8 ? `<path class="emblem-facets" d="M120 12V37M12 120H37M120 203V228M203 120H228M44 44L60 60M180 180L196 196M44 196L60 180M180 60L196 44" stroke="${f.light}" stroke-width="2"/>` : tier === 10 ? `<path class="emblem-star" d="M120 10L125 38L120 54L115 38ZM10 120L38 115L54 120L38 125ZM120 230L115 202L120 186L125 202ZM230 120L202 125L186 120L202 115Z" fill="${f.light}"/>` : '';
    const crown = tier === 9 || tier === 11 ? `<path class="emblem-crown" d="M86 32L80 13L103 24L120 5L137 24L160 13L154 32Z" fill="${metal}" stroke="${f.light}"/>` : '';
    const orbits = tier === 11 ? `<g class="emblem-astrolabe" stroke="${f.color}" opacity=".7"><ellipse cx="120" cy="120" rx="106" ry="84"/><ellipse cx="120" cy="120" rx="86" ry="104"/></g>` : '';
    return rankSvg(tier,'collector',`<defs><linearGradient id="metal${side}" x1=".1" y1="0" x2=".85" y2="1"><stop stop-color="${f.light}"/><stop offset=".2" stop-color="${f.color}"/><stop offset=".42" stop-color="${f.dark}"/><stop offset=".5" stop-color="${f.light}"/><stop offset=".7" stop-color="${f.color}"/><stop offset="1" stop-color="${f.dark}"/></linearGradient><linearGradient id="crestLetter${side}" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="#ffffff"/><stop offset=".4" stop-color="#dae7e9"/><stop offset=".48" stop-color="#6f8997"/><stop offset=".56" stop-color="#f6fbfa"/><stop offset="1" stop-color="#b5c9cf"/></linearGradient><radialGradient id="face${side}" cx=".25" cy=".12"><stop stop-color="${f.enamel}"/><stop offset="1" stop-color="#050b10"/></radialGradient></defs><g class="emblem-chassis">${rankPath(form,`transform="translate(0 3)" fill="#020609" stroke="#020609" stroke-width="3"`)}${rankPath(form,`fill="${metal}" stroke="${f.dark}" stroke-width="2"`)}${rankPath(form,`transform="translate(120 120) scale(.91) translate(-120 -120)" fill="url(#face${side})" stroke="${f.light}" stroke-width="1"`)}${extra}${crown}${orbits}<g class="rank-core"><circle cx="120" cy="120" r="${radius}" fill="${metal}" stroke="${f.light}" stroke-width="1"/><circle cx="120" cy="120" r="${radius-5}" fill="url(#face${side})" stroke="${f.dark}" stroke-width="2"/>${ticks}<path d="M${body}Z" transform="translate(120 120) scale(.84) translate(-120 -120)" fill="url(#face${side})" stroke="${metal}" stroke-width="4"/><path d="M77 153L94 161H146L163 153" stroke="${f.color}" stroke-width=".8" opacity=".6"/></g></g><g class="emblem-field rank-detail" stroke="${f.light}" stroke-width=".8"><circle cx="120" cy="120" r="${radius-2}"/></g>${collectorLetter(tier,side)}${rankCertification(tier,'collector')}`);
  }
  function lumenEmblemMarkup(tier, side) {
    const finish = rarityFinish(tier);
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(side)) throw new RangeError('Invalid emblem namespace');
    const glyph = RARITY_LIST[tier].replace(' Collector', '');
    const collector = tier === 9 || tier === 11;
    const ticks = Array.from({ length: 60 }, (_, i) => `<path d="M120 19v${i % 5 ? 3 : 8}" transform="rotate(${i * 6} 120 120)"/>`).join('');
    const scale = Array.from({ length: 12 }, (_, i) => `<path d="M120 30v7" transform="rotate(${i * 30} 120 120)" stroke="${i <= tier ? LUMEN_RANKS[tier] : '#d5dfe6'}" stroke-width="${i <= tier ? 4 : 2}"/>`).join('');
    const rings = Array.from({ length: finish.rings }, (_, i) => `<circle cx="120" cy="120" r="${108 + i * 5}" opacity="${.4 - i * .05}"/>`).join('');
    return `<svg class="lumen-emblem" data-tier="${tier}" data-mark="${glyph}" viewBox="-30 -30 300 300" fill="none" aria-hidden="true" style="color:${LUMEN_RANKS[tier]}">
      <defs><radialGradient id="lens${side}" cx=".3" cy=".2" r=".9"><stop stop-color="#fff"/><stop offset=".65" stop-color="#f4f8fb"/><stop offset="1" stop-color="#cbdbe7"/></radialGradient></defs>
      <g stroke="currentColor" stroke-width=".65">${rings}</g>
      <circle cx="120" cy="120" r="103" fill="url(#lens${side})" stroke="#b2c4d2"/>
      <g stroke="currentColor" stroke-width=".8" opacity=".6">${ticks}</g>${scale}
      <circle cx="120" cy="120" r="74" fill="#ffffff" fill-opacity=".75" stroke="#bfced9"/>
      <g class="field-orbit" stroke="currentColor" stroke-width="2"><path d="M45 120a75 75 0 0 1 75-75M195 120a75 75 0 0 1-75 75"/>${tier >= 6 ? '<path d="M120 40a80 80 0 0 1 80 80M120 200a80 80 0 0 1-80-80" stroke-width=".7"/>' : ''}</g>
      ${collector ? '<path d="m120-10 7 12-7 12-7-12Z M120 226l7 12-7 12-7-12Z" fill="currentColor"/>' : ''}
      <path d="M12 120h22m172 0h22M120 12v22m0 172v22" stroke="currentColor" stroke-width="1"/>
      <text x="120" y="130" text-anchor="middle" fill="currentColor" font-family="Segoe UI, sans-serif" font-size="${glyph.length > 2 ? 50 : 64}" font-weight="300" letter-spacing="-2">${glyph}</text>
      <path d="M97 150h46" stroke="currentColor" opacity=".4"/>
      <text x="120" y="169" text-anchor="middle" fill="currentColor" font-family="Segoe UI, sans-serif" font-size="8" letter-spacing="2">${finish.tier} / 12</text>
      <text x="120" y="264" text-anchor="middle" fill="currentColor" font-family="Segoe UI, sans-serif" font-size="8" letter-spacing="3">${collector ? 'COLLECTOR OPTICS' : 'SPECTRAL INDEX'}</text>
    </svg>`;
  }
  function editionEmblemMarkup(tier, theme) {
    rarityFinish(tier);
    if (!['folio', 'pulse'].includes(theme)) throw new RangeError('Invalid emblem edition');
    const glyph = RARITY_LIST[tier].replace(' Collector', '');
    const collector = tier === 9 || tier === 11;
    const pips = Array.from({ length: 12 }, (_, i) => `<rect x="${38 + i * 14}" y="213" width="9" height="${i <= tier ? 12 : 3}" fill="currentColor" opacity="${i <= tier ? 1 : .25}"/>`).join('');
    const frame = theme === 'folio'
      ? `<path d="M35 32h170v158H35Z M42 39h156v144H42Z" stroke="currentColor" stroke-width="1.5"/><path d="m120 52 58 58-58 58-58-58Z" fill="currentColor" opacity=".08"/>
        <path d="M25 47V22h25m140 0h25v25M25 175v25h25m140 0h25v-25" stroke="currentColor"/>
        ${tier >= 6 ? '<path d="M51 50h138v124H51Z" stroke="currentColor" stroke-dasharray="2 4"/>' : ''}
        ${collector ? '<path d="m120 12 7 10-7 10-7-10ZM120 188l7 10-7 10-7-10Z" fill="currentColor"/>' : ''}`
      : `<rect x="25" y="32" width="190" height="158" rx="12" fill="#241b2c" stroke="currentColor" stroke-width="2"/><rect x="37" y="44" width="166" height="134" rx="5" fill="#100e17" stroke="currentColor" stroke-opacity=".35"/>
        <path d="M10 62h15m-15 24h15m-15 24h15m-15 24h15m-15 24h15M215 62h15m-15 24h15m-15 24h15m-15 24h15m-15 24h15" stroke="currentColor" stroke-width="3"/>
        <path class="signal-trace" d="M44 146h24l12-18 14 34 14-16h88" stroke="currentColor" stroke-width="1.5"/>
        ${tier >= 6 ? '<path d="M48 56h144M48 168h144" stroke="currentColor" stroke-dasharray="3 5"/>' : ''}
        ${collector ? '<path d="m93 20 8 6h38l8-6M93 202l8-6h38l8 6" stroke="currentColor" stroke-width="2"/>' : ''}`;
    return `<svg class="${theme}-emblem edition-emblem" data-tier="${tier}" data-mark="${glyph}" viewBox="0 0 240 260" fill="none" aria-hidden="true">${frame}
      <text class="edition-glyph" x="120" y="${theme === 'folio' ? 133 : 119}" text-anchor="middle" fill="currentColor" font-size="${glyph.length > 2 ? 54 : 72}" font-weight="${theme === 'folio' ? 400 : 700}">${glyph}</text>
      ${pips}<text x="120" y="246" text-anchor="middle" fill="currentColor" font-family="Segoe UI,sans-serif" font-size="9" letter-spacing="2">${collector ? 'COLLECTOR · ' : ''}${String(tier + 1).padStart(2, '0')} / 12</text></svg>`;
  }
  function themedEmblemMarkup(tier, side) {
    return emblemMarkup(tier, side) + lumenEmblemMarkup(tier, side)
      + editionEmblemMarkup(tier, 'folio') + editionEmblemMarkup(tier, 'pulse');
  }

  function initTheme(doc, host) {
    const control = doc.getElementById('themeSelect');
    const api = host.NCB_THEME;
    if (!control || !api || control.dataset.bound) return;
    control.dataset.bound = 'true';
    const sync = () => {
      control.value = doc.documentElement.dataset.theme;
    };
    control.addEventListener('change', () => {
      const theme = api.apply(control.value);
      try { host.localStorage.setItem(api.key, theme.id); } catch (_) { /* Session still works. */ }
      sync();
    });
    sync();
  }

  // ---- DOM 初始化（浏览器端） ----
  function initApp() {
    if (typeof document === 'undefined') return null;
    const el = (id) => document.getElementById(id);
    initTheme(document, global);

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
    const app = document.querySelector('.app');

    const hud = {
      barA: el('hpbarA'), barB: el('hpbarB'),
      hpA: el('hpTA'), hpB: el('hpTB'),
      pctA: el('pctA'), pctB: el('pctB')
    };

    const state = { playing: false, delay: SPEEDS.slow, events: [], seed: 0, seedEdited: false, eventCount: 0, selectionKey: '', previous: null, follow: true, lastRound: -1 };
    const reduced = global.matchMedia('(prefers-reduced-motion: reduce)');
    const motions = new Map();
    const counters = new Map();
    let counterFrame = 0;
    function animate(node, frames, options, playback = true) {
      if (!node) return;
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
      // A single surface with a strict pixel budget, including 4K and mobile stages.
      const dpr = Math.min(1.5, global.devicePixelRatio || 1, Math.sqrt(3500000 / Math.max(1, box.width * box.height)));
      canvas.width = Math.floor(box.width * dpr); canvas.height = Math.floor(box.height * dpr);
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      geometry = { width: box.width, height: box.height };
      for (const side of ['A', 'B']) {
        const r = el('panel' + side).querySelector('.rarity-art').getBoundingClientRect();
        geometry[side] = [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
        const life = el('fighter' + side).getBoundingClientRect();
        const layer = el('float' + side);
        const floatWidth = Math.min(r.width * 1.3, el('panel' + side).clientWidth - 16);
        layer.style.top = r.top - life.top + r.height / 2 + 'px';
        layer.style.left = r.left - life.left + (r.width - floatWidth) / 2 + 'px';
        layer.style.width = floatWidth + 'px';
      }
      const dial = document.querySelector('.round-center').getBoundingClientRect();
      battleHud.style.setProperty('--announcement-y', dial.bottom - box.top + 12 + 'px');
    }
    new ResizeObserver(resizeFx).observe(battleHud);
    function burst(p) {
      if (!ctx || reduced.matches || document.hidden || !stageVisible || !state.delay || !p.target) return;
      const now = performance.now(), target = geometry[p.target];
      const source = p.drain ? geometry[p.target === 'A' ? 'B' : 'A'] : geometry[p.source] || target;
      const rarityColor = rarityFinish(currentCard(p.source || p.target).rarity).color;
      const theme = document.documentElement.dataset.theme;
      const palette = getComputedStyle(document.documentElement);
      const color = p.kind === 'heal' ? palette.getPropertyValue('--green').trim()
        : theme === 'collector' ? rarityColor : palette.getPropertyValue(p.source === 'A' ? '--blue' : '--red').trim();
      const attack = p.kind === 'hit' || p.kind === 'crit' || p.kind === 'miss';
      if (attack || p.drain) particles.push({ type: 'beam', source, target, color, theme, start: now, life: p.drain ? 380 : 340, miss: p.kind === 'miss', critical: p.kind === 'crit' });
      const count = p.kind === 'crit' ? 38 : p.kind === 'death' ? 42 : p.kind === 'miss' ? 7 : 18;
      for (let i = 0; i < count; i++) {
        const angle = (i * 2.39996 + state.eventCount * .7), force = 25 + (i * 37 % 115);
        particles.push({ type: 'spark', x: target[0], y: target[1], vx: Math.cos(angle) * force,
          vy: p.kind === 'heal' ? -30 - (i * 11 % 100) : Math.sin(angle) * force,
          color, start: now + (attack ? 100 : 0), life: 450 + i % 5 * 70, size: i % 4 === 0 ? 3 : 1.5 });
      }
      if (p.kind === 'crit' || p.kind === 'death') particles.push({ type: 'ring', theme, x: target[0], y: target[1], color, start: now + 90, life: 500 });
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
          ctx.shadowColor = p.color; ctx.shadowBlur = p.miss || p.theme === 'folio' ? 0 : p.theme === 'pulse' ? 4 : 12;
          ctx.setLineDash(p.theme === 'folio' ? [5, 5] : p.theme === 'pulse' ? [12, 4] : []); ctx.beginPath();
          ctx.moveTo(p.source[0] + dx * tail, p.source[1] + dy * tail);
          ctx.lineTo(p.source[0] + dx * f, p.source[1] + dy * f + (p.miss ? -24 : 0)); ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);
        } else if (p.type === 'ring') {
          ctx.lineWidth = 2 * (1 - t); ctx.beginPath();
          const radius = 12 + t * 95;
          if (p.theme === 'folio' || p.theme === 'pulse') ctx.rect(p.x - radius, p.y - radius, radius * 2, radius * 2);
          else ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.stroke();
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
        pointerPanel.style.removeProperty('--tilt-x'); pointerPanel.style.removeProperty('--tilt-y');
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
          panel.style.setProperty('--tilt-y', ((pointerX / pointerBox.width - .5) * 3).toFixed(2) + 'deg');
          panel.style.setProperty('--tilt-x', ((.5 - pointerY / pointerBox.height) * 2).toFixed(2) + 'deg');
          panel.querySelector('.card-reflection').style.transform = `translate3d(${pointerX - 110}px,${pointerY - 110}px,0)`;
        });
      });
      panel.addEventListener('pointerleave', resetPointer);
    });
    global.addEventListener('scroll', resetPointer, { passive: true });
    global.addEventListener('resize', resetPointer, { passive: true });
    document.addEventListener('visibilitychange', resetPointer);
    reduced.addEventListener('change', resetPointer);

    // A crest activation has three beats: a held core, the assembled chassis,
    // then a field release. One cancellable animation per surface, no timers.
    function activateCrest(side, kind = 'selection') {
      const panel = el('panel' + side), tier = currentCard(side).rarity;
      const playback = kind !== 'selection';
      const theme = document.documentElement.dataset.theme || 'collector';
      const crest = panel.querySelector('.' + theme + '-emblem');
      if (!crest) return;
      const release = crest.querySelector('.rank-detail, .field-orbit, .signal-trace');
      if (release) animate(release, [
        { opacity: 0, transform: 'scale(.72)' },
        { opacity: .8, transform: 'scale(.92)', offset: .28 },
        { opacity: 0, transform: 'scale(1.14)' }
      ], { duration: kind === 'crit' ? 760 : 1060, delay: playback ? 0 : 140 }, playback);
      if (kind === 'selection') {
        const core = crest.querySelector('.rank-core');
        const reveal = theme === 'folio' ? 'inset(0 0 100% 0)' : theme === 'pulse' ? 'inset(0 50% 0 50%)' : 'inset(8% 8% 8% 8%)';
        if (core) animate(core, [{ clipPath: reveal, opacity: .4 }, { clipPath: 'inset(0)', opacity: 1 }], { duration: 320 + tier * 35 }, false);
        const chassis = crest.querySelector('.emblem-chassis') || crest;
        animate(chassis, [
          { transform: 'translateY(8px) scale(.94)', opacity: .5 },
          { transform: 'translateY(-1px) scale(1.006)', opacity: 1, offset: .72 },
          { transform: 'translateY(0) scale(1)', opacity: 1 }
        ], { duration: 360 + tier * 32 }, false);
        const field = crest.querySelector('.emblem-field, .field-orbit, .signal-trace');
        if (field) animate(field, [
          { opacity: .15, transform: 'scale(.88) rotate(-9deg)' },
          { opacity: 1, transform: 'scale(1.025) rotate(1deg)', offset: .64 },
          { opacity: 1, transform: 'scale(1) rotate(0)' }
        ], { duration: 1080 + tier * 20, delay: 100 }, false);
      }
    }

    el('themeSelect').addEventListener('change', () => {
      for (const [node, motion] of motions) {
        if (node.closest('.emblem')) { motion.cancel(); motions.delete(node); }
      }
    });

    function present(p) {
      ['A', 'B'].forEach(side => { el('panel' + side).removeAttribute('data-action'); el('fighter' + side).removeAttribute('data-action'); });
      const labels = { hit: 'HIT', crit: 'CRITICAL', heal: p.drain ? 'LIFE STEAL' : 'REGEN', miss: 'EVADE', death: 'K.O.', sys: 'ENGAGE', draw: 'DRAW' };
      const readout = el('eventReadout'); readout.className = 'event-readout ' + p.kind;
      readout.querySelector('.event-tag').textContent = labels[p.kind];
      el('eventText').textContent = p.txt;
      el('eventAmount').textContent = p.amount ? (p.kind === 'heal' ? '+' : '−') + fmt(p.amount) : '';
      if (!p.target) return;
      const fighter = el('fighter' + p.target);
      const targetCard = el('panel' + p.target);
      const action = p.kind === 'heal' ? 'recover' : p.kind === 'miss' ? 'evade' : p.kind === 'death' ? 'fallen' : 'impact';
      fighter.dataset.action = action; el('panel' + p.target).dataset.action = action;
      if (p.source !== p.target && p.source && p.kind !== 'heal') {
        el('panel' + p.source).dataset.action = 'attack'; el('fighter' + p.source).dataset.action = 'attack';
        const direction = p.source === 'A' ? 1 : -1;
        animate(el('panel' + p.source).querySelector('.rarity-art'),
          [{ transform: 'translateX(0) scale(1)' }, { transform: `translateX(${-direction * 4}px) scale(.96)`, offset: .22 },
            { transform: `translateX(${direction * 9}px) scale(1.025)`, offset: .42 }, { transform: 'translateX(0) scale(1)' }],
          { duration: p.kind === 'crit' ? 620 : 440 });
      }
      burst(p);
      if (p.kind === 'crit' && p.source) activateCrest(p.source, 'crit');
      else if (p.kind === 'heal') activateCrest(p.target, 'heal');
      if (p.kind === 'hit' || p.kind === 'crit') {
        const force = p.kind === 'crit' ? 7 : 3;
        const direction = p.target === 'A' ? -1 : 1;
        animate(targetCard, [{ transform: 'translateX(0)' },
          { transform: `translateX(${direction * force}px) rotate(${direction * force / 12}deg)`, offset: .2 },
          { transform: `translateX(${-direction * force / 3}px)`, offset: .48 }, { transform: 'translateX(0)' }],
          { duration: p.kind === 'crit' ? 650 : 400 });
      }
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
      else if (p.kind === 'heal') animate(fighter, [{ color: 'var(--green)', filter: 'brightness(1.25)' }, { filter: 'brightness(1)' }]);
      else if (p.kind === 'hit') animate(fighter, [{ filter: 'brightness(1.35)' }, { filter: 'brightness(1)' }]);
      if (p.kind === 'death') animate(el('panel' + p.target), [{ transform: 'translateY(0)' }, { transform: 'translateY(5px)' }], { duration: 650 });
    }
    function announce(text) {
      const node = el('stageAnnouncement'); node.textContent = text;
      animate(node, [{ opacity: 0, transform: 'translateY(8px) scale(.96)' }, { opacity: .95, transform: 'translateY(0) scale(1)', offset: .2 }, { opacity: 0, transform: 'translateY(-10px) scale(1.03)' }], { duration: 850 });
    }
    function renderSummary(events) {
      const totals = summarizeEvents(events);
      el('metricRounds').textContent = events.length ? Math.max(...events.map(e => e.round || 0)) : '—';
      el('metricBlue').textContent = events.length ? fmt(totals.A.damage) : '—';
      el('metricRatio').textContent = events.length && totals.B.damage ? (totals.A.damage / totals.B.damage).toFixed(2) + ' : 1' : '—';
      if (!events.length) el('metricWinner').textContent = '—';
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

    // Desktop archives stay visible; mobile can disclose secondary attributes.
    const mobile = global.matchMedia('(max-width: 1000px)');
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
        panel.dataset.longName = String(card.name.length > 8);
        el('letter' + side).textContent = unit.rarityName.replace(' Collector', '');
        el('english' + side).textContent = card.id === 'origin_star' ? 'THE STAR OF ORIGIN' : card.id === 'iron_guard' ? 'IRON SHIELD GUARD' : card.id.replaceAll('_', ' ').toUpperCase();
        el('rar' + side).textContent = unit.rarityName;
        el('rar' + side).className = 'rar-badge t' + card.rarity;
        el('role' + side).textContent = card.role;
        el('desc' + side).textContent = card.source ? `${card.source} · ${card.desc}` : card.desc;
      }
      countTo(el('bp' + side), power);
      const finish = rarityFinish(card.rarity);
      if (panel.dataset.rarity !== String(card.rarity)) {
        for (const [node, motion] of motions) {
          if (el('emblem' + side).contains(node)) { motion.cancel(); motions.delete(node); }
        }
        el('emblem' + side).innerHTML = themedEmblemMarkup(card.rarity, side);
        el('ambient' + side).innerHTML = Array.from({ length: finish.particles }, (_, i) =>
          `<i style="--x:${8 + i * 43 % 85}%;--y:${6 + i * 29 % 64}%;--drift:${(i % 3 - 1) * 14}px;--duration:${8 + i % 7}s;--delay:-${i * 1.7}s;--size:${i % 5 === 0 ? 3 : 1.5}px"></i>`).join('');
      }
      panel.dataset.rarity = card.rarity;
      panel.style.setProperty('--lumen-rank', LUMEN_RANKS[card.rarity]);
      panel.style.setProperty('--foil', finish.color);
      panel.style.setProperty('--crest-light', finish.light);
      panel.style.setProperty('--crest-dark', finish.dark);
      panel.style.setProperty('--crest-enamel', finish.enamel);
      panel.style.setProperty('--field-strength', finish.aura);
      panel.style.setProperty('--orbit-period', finish.period + 's');
      panel.dataset.card = card.id; panel.dataset.level = unit.level;
      el('cardCode' + side).textContent = unit.rarityName.replace(' Collector', '') + '-096 / ' + String(CARDS.indexOf(card) + 1).padStart(4, '0');
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
        const icons = {"maxHp":"M12 20 3 11C-2 3 8-1 12 6c4-7 14-3 9 5Z","atk":"m4 21 3-7L18 2l4 0 0 4L10 17l-7 3m2-9 8 8","def":"M12 2 3 6v8l9 8 9-8V6Z M12 5v14","spd":"m14 1-9 13h7l-2 9L21 9h-8Z"};
        if (!mounted) {
          el('stats' + side).innerHTML = rows.slice(0, 4)
            .map(([k, v]) => `<div class="stat-tile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[k]}"/></svg><span class="k">${STAT_LABELS[k]} <span class="stat-code">${codes[k]}</span></span><span class="v">${v}</span></div>`).join('');
          el('secondaryStats' + side).innerHTML = rows.slice(4)
            .map(([k, v]) => `<div class="stat-row"><span class="k">${STAT_LABELS[k]}</span><span class="v">${v}</span></div>`).join('');
        } else {
          [...el('stats' + side).querySelectorAll('.v'), ...el('secondaryStats' + side).querySelectorAll('.v')].forEach((node, i) => {
            if (node.textContent !== rows[i][1]) node.textContent = rows[i][1];
          });
          if (changedCard) {
            activateCrest(side);
            animate(panel.querySelector('.rarity-art'),
              [{ transform: 'perspective(600px) rotateY(-12deg) translateY(6px)', opacity: .55 },
                { transform: 'perspective(600px) rotateY(3deg) translateY(-2px)', opacity: 1, offset: .72 },
                { transform: 'perspective(600px) rotateY(0) translateY(0)', opacity: 1 }], { duration: 900 }, false);
            animate(el('stats' + side), [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 520, delay: 100 }, false);
          }
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
      app.dataset.phase = 'ready';
      el('seedHint').textContent = state.seedEdited ? '下次战斗使用手动输入的 Seed' : '开始战斗默认新 Seed · 手动输入可指定对局';
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
      el('resultMedal').innerHTML = winningCard ? themedEmblemMarkup(winningCard.rarity, 'Result') : '<span>VS</span>';
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
      el('startLabel').textContent = locked ? '交锋进行中' : '开始战斗';
      againBtn.disabled = locked;
      resultAgainBtn.disabled = locked;
      el('seedInput').disabled = locked;
      el('replayBtn').disabled = locked || !state.events.length;
      el('resultReplayBtn').disabled = locked || !state.events.length;
    }

    function prepareArena(cardA, cardB) {
      el('sNameA').textContent = cardA.name;
      el('sNameB').textContent = cardB.name;
      el('sMetaA').textContent = `${RARITY_LIST[cardA.rarity]} · Lv.${lvlA.value}`;
      el('sMetaB').textContent = `${RARITY_LIST[cardB.rarity]} · Lv.${lvlB.value}`;
    }

    async function runBattle(mode = 'start') {
      if (state.playing) return;
      // Starting the battle disables the start button, which drops keyboard focus
      // to BODY. Remember the intent so the result action can take focus back.
      const focusWasOnStart = document.activeElement === startBtn;
      const input = el('seedInput');
      const seed = mode === 'replay' ? state.seed : mode === 'new' || !state.seedEdited ? null : parseSeed(input.value);
      if (seed === undefined) {
        input.setAttribute('aria-invalid', 'true'); el('seedHint').textContent = '请输入 0–4294967295 的整数，或留空随机'; input.focus(); return;
      }
      input.removeAttribute('aria-invalid');
      state.seed = seed === null ? global.crypto.getRandomValues(new Uint32Array(1))[0] : seed;
      state.seedEdited = false;
      input.value = String(state.seed); el('seedHint').textContent = '开始战斗换新 Seed · 重播保留当前 Seed';
      state.playing = true; resetPointer(); clearMotion(); setControlsLocked(true);
      app.dataset.phase = state.delay && !reduced.matches ? 'engage' : 'battle';
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
        activateCrest('A', 'engage'); activateCrest('B', 'engage');
        if (state.delay) await new Promise(resolve => setTimeout(resolve, reduced.matches ? 120 : 650));
        app.dataset.phase = 'battle';
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
        app.dataset.phase = 'result';
        showResult(result); renderSummary(result.events);
        el('metricWinner').textContent = result.winner === -1 ? '平局' : result.winner === 0 ? '蓝方' : '红方';
        resizeFx();
        const victor = result.winner === 0 ? 'A' : 'B';
        if (result.winner !== -1) { el('panel' + victor).classList.add('victorious'); burst({ kind: 'crit', source: victor, target: victor }); }
        announce(result.winner === -1 ? 'DRAW' : 'VICTORY');
        el('eventReadout').className = 'event-readout result-event';
        el('eventReadout').querySelector('.event-tag').textContent = result.winner === -1 ? 'DRAW' : 'VICTORY';
        el('eventText').textContent = result.winner === -1 ? '势均力敌 · 本局平局' : (result.winner === 0 ? '蓝方 · ' + cardA.name : '红方 · ' + cardB.name) + ' 获胜';
        el('eventAmount').textContent = result.rounds + ' ROUNDS';
        hudState.textContent = 'FINISHED'; battleHud.classList.add('finished');
        el('matchupHint').textContent = '本局结束 · Seed ' + state.seed;
        // The complete result must be discoverable even below a tall card archive.
        const resultRect = resultBox.getBoundingClientRect();
        if (resultRect.top < 0 || resultRect.bottom > global.innerHeight - (mobile.matches ? 88 : 24)) {
          resultBox.scrollIntoView({ behavior: reduced.matches || !state.delay ? 'instant' : 'smooth', block: 'center' });
        }
        animate(resultBox, [{ clipPath: 'inset(0 50% 0 50%)', opacity: .6 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], { duration: 800 });
        animate(el('resultMedal'), [{ transform: 'translateY(-12px) rotate(-12deg)', opacity: .1 }, { transform: 'translateY(0) rotate(0)', opacity: 1 }], { duration: 950, delay: 180 });
        animate(document.querySelector('.telemetry'), [{ opacity: .4, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 650, delay: 220 });
      } catch (error) {
        app.dataset.phase = 'ready';
        hudState.textContent = 'ERROR'; el('eventText').textContent = '播放失败，请重试。'; console.error(error);
      } finally {
        state.playing = false; setControlsLocked(false); battleHud.classList.remove('live');
        ['A', 'B'].forEach(side => { el('panel' + side).removeAttribute('data-action'); el('fighter' + side).removeAttribute('data-action'); });
        document.querySelector('.app').classList.remove('is-playing');
        if (focusWasOnStart && state.events.length) el('resultAgainBtn').focus({ preventScroll: true });
      }
    }

    el('seedInput').addEventListener('input', () => {
      state.seedEdited = true;
      el('seedHint').textContent = '下次战斗使用手动输入的 Seed';
    });
    startBtn.addEventListener('click', () => runBattle());
    againBtn.addEventListener('click', () => runBattle('new'));
    resultAgainBtn.addEventListener('click', () => runBattle('new'));
    el('resultEditBtn').addEventListener('click', () => {
      if (state.playing) return;
      clearMotion(); state.selectionKey = ''; refreshAll();
      searchA.focus({ preventScroll: true });
      el('panelA').scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    el('replayBtn').addEventListener('click', () => runBattle('replay'));
    el('resultReplayBtn').addEventListener('click', () => runBattle('replay'));

    refreshAll();
    return { state };
  }

  const API = { createViewState, applyEventToState, parseEvent, describeEvent, summarizeEvents, eventDelay, parseSeed, rarityFinish, emblemMarkup, lumenEmblemMarkup, editionEmblemMarkup, initTheme, matchesCard, normalizeLevel, initApp };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NCB = Object.assign(global.NCB || {}, API);
})(typeof window !== 'undefined' ? window : globalThis);
