/* =========================================================
   numerical-battle-lab · src/app.js
   单页 UI：选卡 → 调等级 → 开始 → 回放事件列表 → 看结果。
   播放速度（慢/快/瞬）只改变事件之间的延迟，绝不改变结果。
   ========================================================= */
(function (global) {
  'use strict';

  const M = (typeof module !== 'undefined' && module.exports)
    ? Object.assign({}, require('./power.js'), require('./battle.js'))
    : global.NCB;
  const { CARDS, RARITY_LIST, RARITY_COLOR, buildUnit, battlePower, fmt, statRows, STAT_LABELS, simulate, applyEvents } = M;

  const SPEEDS = { slow: 120, fast: 45, instant: 0 };

  // ---- 纯逻辑：把事件应用到回放状态（供 UI 与测试共用） ----
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

  // ---- DOM 初始化（浏览器端） ----
  function initApp() {
    if (typeof document === 'undefined') return null;
    const el = (id) => document.getElementById(id);

    const selA = el('selA'), selB = el('selB');
    const lvlA = el('lvlA'), lvlB = el('lvlB');
    const lvlAVal = el('lvlAVal'), lvlBVal = el('lvlBVal');
    const logbox = el('logbox');
    const resultBox = el('resultBox');
    const startBtn = el('startBtn');
    const againBtn = el('againBtn');
    const roundTxt = el('roundTxt');
    const barA = el('hpbarA'), barB = el('hpbarB');
    const hpTA = el('hpTA'), hpTB = el('hpTB');

    const state = { playing: false, delay: SPEEDS.slow, events: [], seed: 0 };

    // 卡牌下拉：按稀有度分组
    function fillSelect(sel, def) {
      sel.innerHTML = '';
      const groups = {};
      CARDS.forEach((c, i) => {
        const r = RARITY_LIST[c.rarity];
        (groups[r] = groups[r] || []).push({ c, i });
      });
      RARITY_LIST.forEach((r) => {
        if (!groups[r]) return;
        const og = document.createElement('optgroup');
        og.label = '— ' + r + ' —';
        groups[r].forEach(({ c, i }) => {
          const o = document.createElement('option');
          o.value = i;
          o.textContent = `${c.name} [${r}] ${c.role}`;
          og.appendChild(o);
        });
        sel.appendChild(og);
      });
      sel.value = def;
    }
    fillSelect(selA, 0);
    fillSelect(selB, 5);

    function renderPreview(side) {
      const sel = side === 'A' ? selA : selB;
      const lvl = +(side === 'A' ? lvlA : lvlB).value;
      const card = CARDS[+sel.value];
      const u = buildUnit(card, lvl);
      const rc = RARITY_COLOR[RARITY_LIST[card.rarity]];
      const bp = battlePower(u);
      const rows = statRows(u)
        .map(([k, v]) => `<div class="st"><span>${STAT_LABELS[k]}</span><span>${v}</span></div>`)
        .join('');
      el('prev' + side).innerHTML = `
        <div class="cardhead">
          <span class="cname">${card.name}</span>
          <span class="badge" style="background:${rc}">${RARITY_LIST[card.rarity]}</span>
          <span class="role">${card.role}</span>
        </div>
        <div class="cdesc">${card.desc}</div>
        <div class="bprow"><span>Battle Power</span><span>${fmt(bp)}</span></div>
        <div class="stats">${rows}</div>`;
    }

    function refreshAll() {
      lvlAVal.textContent = lvlA.value;
      lvlBVal.textContent = lvlB.value;
      renderPreview('A');
      renderPreview('B');
    }

    selA.addEventListener('change', refreshAll);
    selB.addEventListener('change', refreshAll);
    lvlA.addEventListener('input', refreshAll);
    lvlB.addEventListener('input', refreshAll);

    // 速度按钮：只改延迟
    document.querySelectorAll('.spdbtn').forEach((b) => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.spdbtn').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        state.delay = SPEEDS[b.dataset.speed];
      });
    });

    function updateBar(side, hp, max) {
      const pct = Math.max(0, Math.min(100, hp / max * 100));
      const bar = side === 'A' ? barA : barB;
      const txt = side === 'A' ? hpTA : hpTB;
      bar.style.width = pct + '%';
      bar.className = 'hpbar' + (pct < 25 ? ' low' : pct < 55 ? ' mid' : '');
      txt.textContent = `${fmt(hp)} / ${fmt(max)}`;
    }

    function log(text, cls) {
      const div = document.createElement('div');
      div.className = 'le ' + (cls || '');
      div.textContent = text;
      logbox.appendChild(div);
      logbox.scrollTop = logbox.scrollHeight;
    }

    function applyEntry(e) {
      log(e.text, e.cls);
      updateBar('A', e.hpA, e.maxA);
      updateBar('B', e.hpB, e.maxB);
      roundTxt.textContent = 'R' + e.round;
    }

    function showResult(r) {
      resultBox.style.display = 'block';
      const a = r.a, b = r.b;
      if (r.winner === 0) {
        resultBox.className = 'result win0';
        resultBox.textContent = `🏆 ${a.name}（Lv.${a.level} ${a.rarityName}）获胜 — 剩余 ${(a.hp / a.maxHp * 100).toFixed(1)}% 生命`;
      } else if (r.winner === 1) {
        resultBox.className = 'result win1';
        resultBox.textContent = `🏆 ${b.name}（Lv.${b.level} ${b.rarityName}）获胜 — 剩余 ${(b.hp / b.maxHp * 100).toFixed(1)}% 生命`;
      } else {
        resultBox.className = 'result draw';
        resultBox.textContent = `⚖ 平局 — 蓝方 ${(a.hp / a.maxHp * 100).toFixed(1)}% / 红方 ${(b.hp / b.maxHp * 100).toFixed(1)}%`;
      }
    }

    function setControlsLocked(locked) {
      selA.disabled = locked;
      selB.disabled = locked;
      lvlA.disabled = locked;
      lvlB.disabled = locked;
      startBtn.disabled = locked;
      againBtn.disabled = locked;
    }

    async function runBattle() {
      if (state.playing) return;
      state.playing = true;
      setControlsLocked(true);
      logbox.innerHTML = '';
      resultBox.style.display = 'none';
      roundTxt.textContent = '—';

      const cardA = CARDS[+selA.value];
      const cardB = CARDS[+selB.value];
      state.seed = (Math.random() * 0xFFFFFFFF) >>> 0;

      // 先完整模拟，结果已确定；再按速度回放事件列表
      const result = simulate(cardA, +lvlA.value, cardB, +lvlB.value, state.seed);
      state.events = result.events;
      el('sNameA').textContent = cardA.name;
      el('sNameB').textContent = cardB.name;
      el('sRarA').textContent = `${RARITY_LIST[cardA.rarity]} Lv.${lvlA.value}`;
      el('sRarB').textContent = `${RARITY_LIST[cardB.rarity]} Lv.${lvlB.value}`;

      const delayMs = () => new Promise((r) => setTimeout(r, state.delay));
      await applyEvents(result.events, applyEntry, delayMs);

      showResult(result);
      setControlsLocked(false);
      state.playing = false;
    }

    startBtn.addEventListener('click', runBattle);
    againBtn.addEventListener('click', runBattle);

    refreshAll();
    return { state };
  }

  const API = { createViewState, applyEventToState, initApp };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NCB = Object.assign(global.NCB || {}, API);
})(typeof window !== 'undefined' ? window : globalThis);
