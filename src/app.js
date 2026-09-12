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
  const { CARDS, RARITY_LIST, buildUnit, battlePower, fmt, statRows, STAT_LABELS, simulate, applyEvents } = M;

  const SPEEDS = { slow: 120, fast: 45, instant: 0 };

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

    const state = { playing: false, delay: SPEEDS.slow, events: [], seed: 0, eventCount: 0, selectionKey: '' };

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
    fillSelect(selA, 0);
    fillSelect(selB, 5);

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
    function renderSide(side, unit, deltaInfo) {
      const card = CARDS[unit.cardId] || currentCard(side);
      el('name' + side).textContent = card.name;
      el('rar' + side).textContent = unit.rarityName;
      el('rar' + side).className = 'rar-badge t' + card.rarity;
      el('role' + side).textContent = card.role;
      el('desc' + side).textContent = card.source ? `${card.source} · ${card.desc}` : card.desc;
      el('bp' + side).textContent = fmt(battlePower(unit));

      const deltaEl = el('bpDelta' + side);
      if (deltaInfo) {
        const { sign, cls } = deltaInfo;
        deltaEl.textContent = sign;
        deltaEl.className = 'bp-delta ' + cls;
      } else {
        deltaEl.textContent = '';
        deltaEl.className = 'bp-delta';
      }

      const rows = statRows(unit);
      const codes = { maxHp: 'HP', atk: 'ATK', def: 'DEF', spd: 'SPD' };
      el('stats' + side).innerHTML = rows.slice(0, 4)
        .map(([k, v]) => `<div class="stat-tile"><span class="k">${STAT_LABELS[k]} <span class="stat-code">${codes[k]}</span></span><span class="v">${v}</span></div>`).join('');
      el('secondaryStats' + side).innerHTML = rows.slice(4)
        .map(([k, v]) => `<div class="stat-row"><span class="k">${STAT_LABELS[k]}</span><span class="v">${v}</span></div>`).join('');
    }

    // ---- 双侧刷新 + BP 百分比差值（presentation-only） ----
    function refreshAll() {
      const key = [selA.value, lvlA.value, selB.value, lvlB.value].join(':');
      if (state.playing || key === state.selectionKey) return;
      state.selectionKey = key;
      const uA = buildUnit(currentCard('A'), currentLevel('A'));
      const uB = buildUnit(currentCard('B'), currentLevel('B'));
      const bpA = battlePower(uA), bpB = battlePower(uB);

      const deltaFor = (mine, other) => {
        const pct = (mine / other - 1) * 100;
        if (Math.abs(pct) < 0.05) return { sign: '±0.0%', cls: 'neu' };
        return pct > 0 ? { sign: `+${pct.toFixed(1)}%`, cls: 'pos' } : { sign: `${pct.toFixed(1)}%`, cls: 'neg' };
      };
      renderSide('A', uA, deltaFor(bpA, bpB));
      renderSide('B', uB, deltaFor(bpB, bpA));
      prepareArena(currentCard('A'), currentCard('B'));
      updateBar('A', uA.maxHp, uA.maxHp);
      updateBar('B', uB.maxHp, uB.maxHp);
      state.events = [];
      state.eventCount = 0;
      state.seed = 0;
      logCount.textContent = '0 EVENTS';
      logbox.innerHTML = '<div class="log-empty">STANDBY · 等待战斗开始</div>';
      resultBox.style.display = 'none';
      resultBox.className = 'result-panel';
      roundTxt.textContent = '--';
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
      });
    });

    // ---- Battle HUD ----
    function updateBar(side, hp, max) {
      const pct = Math.max(0, Math.min(100, hp / max * 100));
      (side === 'A' ? hud.barA : hud.barB).style.width = pct + '%';
      (side === 'A' ? hud.hpA : hud.hpB).textContent = `${fmt(hp)} / ${fmt(max)}`;
      (side === 'A' ? hud.pctA : hud.pctB).textContent = pct.toFixed(1) + '%';
      const panel = (side === 'A' ? hud.barA : hud.barB).closest('.hud-side');
      panel.classList.toggle('low', hp > 0 && pct <= 20);
      panel.classList.toggle('dead', hp <= 0);
      el('hpState' + side).textContent = hp <= 0 ? '已倒下' : pct <= 20 ? '低血量' : '';
    }

    // ---- Battle Log：结构化行 ----
    function appendLogRow(parsed) {
      const div = document.createElement('div');
      div.className = 'le ' + parsed.kind;
      const rnd = document.createElement('span');
      rnd.className = 'rnd';
      rnd.textContent = 'R' + parsed.rnd;
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
      logbox.appendChild(div);
      logbox.scrollTop = logbox.scrollHeight;
    }

    function applyEntry(e) {
      appendLogRow(parseEvent(e));
      state.eventCount++;
      logCount.textContent = state.eventCount + ' EVENTS';
      updateBar('A', e.hpA, e.maxA);
      updateBar('B', e.hpB, e.maxB);
      roundTxt.textContent = String(e.round).padStart(2, '0');
    }

    // ---- Battle Result ----
    function showResult(r) {
      const a = r.a, b = r.b;
      const winner = r.winner;
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
      document.querySelectorAll('.spdbtn').forEach((b) => { b.disabled = locked; });
    }

    function prepareArena(cardA, cardB) {
      el('sNameA').textContent = cardA.name;
      el('sNameB').textContent = cardB.name;
      el('sMetaA').textContent = `${RARITY_LIST[cardA.rarity]} · Lv.${lvlA.value}`;
      el('sMetaB').textContent = `${RARITY_LIST[cardB.rarity]} · Lv.${lvlB.value}`;
    }

    async function runBattle() {
      if (state.playing) return;
      state.playing = true;
      setControlsLocked(true);
      logbox.innerHTML = '';
      state.eventCount = 0;
      logCount.textContent = '0 EVENTS';
      resultBox.style.display = 'none';
      roundTxt.textContent = '--';

      const cardA = currentCard('A');
      const cardB = currentCard('B');
      state.seed = (Math.random() * 0xFFFFFFFF) >>> 0;

      // 先完整模拟，结果已确定；再按速度回放事件列表
      const result = simulate(cardA, currentLevel('A'), cardB, currentLevel('B'), state.seed);
      state.events = result.events;
      prepareArena(cardA, cardB);
      updateBar('A', result.a.maxHp, result.a.maxHp);
      updateBar('B', result.b.maxHp, result.b.maxHp);
      hudState.textContent = 'IN BATTLE';
      battleHud.classList.remove('finished');
      battleHud.classList.add('live');

      const delayMs = () => new Promise((r) => setTimeout(r, state.delay));
      await applyEvents(result.events, applyEntry, delayMs);

      showResult(result);
      hudState.textContent = 'FINISHED';
      battleHud.classList.add('finished');
      battleHud.classList.remove('live');
      setControlsLocked(false);
      state.playing = false;
    }

    startBtn.addEventListener('click', runBattle);
    againBtn.addEventListener('click', runBattle);
    resultAgainBtn.addEventListener('click', runBattle);

    refreshAll();
    return { state };
  }

  const API = { createViewState, applyEventToState, parseEvent, matchesCard, normalizeLevel, initApp };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NCB = Object.assign(global.NCB || {}, API);
})(typeof window !== 'undefined' ? window : globalThis);
