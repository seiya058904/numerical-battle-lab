(function (root) {
  'use strict';
  const NCB = root.NCB;
  if (!NCB) throw new Error('NCB engine not loaded');

  // ===========================================================================
  // v1.2 player-facing UI (spec 1-6, 25-33):
  //   default nav: 对战 / 卡牌 / 生成卡牌 / 玩法说明
  //   advanced lab (数值编辑/批量模拟/规则架构/Replay/计算链/JSON) hidden behind
  //   高级实验室 in the top-right. Advanced lab features are preserved, never deleted.
  // ===========================================================================

  const $ = (s,el=document) => el.querySelector(s);
  const $$ = (s,el=document) => [...el.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  const STORAGE_LIBRARY='nbl-card-library-v1';
  const STORAGE_SETUP='nbl-setup-v1';
  const memoryStorage=new Map();
  const storage={
    get(k){try{return root.localStorage?.getItem(k)??memoryStorage.get(k)??null;}catch(_){return memoryStorage.get(k)??null;}},
    set(k,v){memoryStorage.set(k,String(v));try{root.localStorage?.setItem(k,String(v));}catch(_){}},
    remove(k){memoryStorage.delete(k);try{root.localStorage?.removeItem(k);}catch(_){}},
  };

  // ---- Card Library (local persistence; NO account/server/cloud/shop/gacha) ----
  function loadLibrary(){
    try{const s=JSON.parse(storage.get(STORAGE_LIBRARY)||'null');if(Array.isArray(s))return s;}catch(_){}
    return [];
  }
  function saveLibrary(){storage.set(STORAGE_LIBRARY,JSON.stringify(state.library));}
  function libraryContains(id){return state.library.some(c=>c.id===id);}

  const RARITY_OPTIONS=NCB.RARITY_V2_ORDER||[];
  const ARCHETYPE_OPTIONS=Object.keys(NCB.ARCHETYPES||{});
  const ROLE_ZH=NCB.ROLE_ZH||{};

  const defaultSetup={
    opponentDifficulty:'normal',
    battleSizeA:1,battleSizeB:1,
    seedNumber:20260901,
  };
  function loadSetup(){try{const s=JSON.parse(storage.get(STORAGE_SETUP)||'null');return{...defaultSetup,...(s||{})};}catch(_){return{...defaultSetup};}}
  function saveSetup(){storage.set(STORAGE_SETUP,JSON.stringify(state.setup));}

  const state={
    tab:'battle',
    setup:loadSetup(),
    library:loadLibrary(),
    // Read-only system presets (NOT part of the user's localStorage library).
    systemPresets:(NCB.SYSTEM_PRESETS||[]).map(NCB.deepClone),
    engine:null,
    pending:new Map(),
    selectedActorId:null,
    selectedSkillId:null,
    logFilter:'all',
    // generate form
    genRarity:'A',genLevel:100,genArchetype:'Balanced',genSeed:'',genManualSeed:false,
    // battle mode: manual (player picks skills) | auto (both AI)
    battleMode:'auto',autoPaused:false,
    autoSpeed:1,
    // advanced lab (preserved)
    editorUnitId:'vanguard',
    editorStatusId:'fortified',
    simulation:null,
    replay:null,
    replayIndex:0,
    traceSource:null,
  };

  function setTab(tab){
    state.tab=tab;
    $$('.tab').forEach(b=>b.classList.toggle('is-active',b.dataset.tab===tab));
    $$('.view').forEach(v=>v.classList.toggle('is-active',v.id===`view-${tab}`));
    if(tab==='battle')renderBattle();
    if(tab==='cards')renderCards();
    if(tab==='generate')renderGenerate();
    if(tab==='help')renderHelp();
    if(tab==='editor')renderEditor();
    if(tab==='simulation')renderSimulation();
    if(tab==='guide')renderGuide();
    if(tab==='replay')renderReplay();
    if(tab==='trace')renderTrace();
    if(tab==='json')renderJson();
    root.scrollTo(0,0);
  }

  // ===========================================================================
  // GENERATE (player-facing: 稀有度/等级/类型定位/Seed(可选)/随机生成)
  // ===========================================================================
  let autoSeedCounter=0;
  function generateFromForm(){
    const seed=state.genManualSeed&&state.genSeed?String(state.genSeed):null;
    // Auto seed: unique + non-deterministic per click, without Math.random
    // (the static runtime gate forbids Math.random in src/). Engine stays
    // deterministic given any fixed seed; only the auto default varies per click.
    const autoSeed='auto-'+(++autoSeedCounter)+'-'+Date.now();
    if(!Number.isInteger(state.genLevel)||state.genLevel<1||state.genLevel>100){alert('等级请输入 1–100 的整数。');return;}
    // v4 is classless: no archetype input — an individual, not a class.
    const card=NCB.generateCardByVersion({
      rarity:state.genRarity,level:state.genLevel,
      seed:seed??autoSeed,
    });
    state.lastGenerated=card;
    renderGenerate();
    return card;
  }
  function addToLibrary(card){
    if(!card||libraryContains(card.id)){alert('这张卡已在卡牌库中。');return;}
    state.library.push(NCB.deepClone(card));
    saveLibrary();
  }
  // Copy a read-only system preset into the user library as a NEW editable entry
  // (new id + remapped internal ids) so it never collides with the preset's id and
  // keeps deterministic combat identity of its own.
  function copyPresetToLibrary(preset){
    if(!preset)return null;
    let c=NCB.deepClone(preset);const oldId=c.id,newId=oldId+'-mine-'+Date.now();
    const remap=x=>{if(typeof x==='string')return x.startsWith(oldId)?newId+x.slice(oldId.length):x;if(Array.isArray(x))return x.map(remap);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,remap(v)]));return x;};
    c=remap(c);c.id=newId;
    addToLibrary(c);renderCards();
    return c;
  }
  function stopAuto(){if(autoTimer)clearInterval(autoTimer);autoTimer=null;}
  function beginBattle(config){
    stopAuto();state.engine=NCB.createBattle(config);state.battleMode='auto';state.autoPaused=false;
    // Build per-entity battle-card metadata map so every entity (incl. multi-team
    // extra members) resolves its own rarity/level/BattlePower, not a shared one.
    state._deployedMeta=new Map();
    for(const t of ['A','B'])for(const ent of state.engine.teams[t].entities){
      const meta=state.systemPresets.find(c=>c.id===ent.templateId)||state.library.find(c=>c.id===ent.templateId)||null;
      if(meta)state._deployedMeta.set(ent.templateId,meta);
    }
    state.pending.clear();state.selectedActorId=null;state.selectedSkillId=null;
    setTab('battle');startAuto();
  }
  function startBattleWithCard(card){
    if(!libraryContains(card.id)&&!isSystemPreset(card.id))addToLibrary(card);
    const pool=selectableCards();const idx=pool.findIndex(c=>c.id===card.id);
    state.selectedLeft=idx>=0?idx:0;state.selectedRight=pool[1]?1:0;
    state.engine=null;stopAuto();setTab('battle');
  }

  // ---- Card sources: system presets (read-only) + user library (editable) ----
  function isSystemPreset(id){return!!(state.systemPresets||[]).find(c=>c.id===id);}
  function selectableCards(){return [...(state.systemPresets||[]), ...state.library];}

  // Unified battle-card metadata resolver: system preset → user library → none.
  // Replaces the old `state.library.find(...)` assumption that every battle card
  // lived in the user library.
  function resolveBattleCardMeta(templateId){
    return NCB.resolveCardMeta(templateId,{system:state.systemPresets,library:state.library,deployed:state._deployedMeta});
  }

  // The pool index maps to a concrete card (preset or user card). Used for the
  // battle selectors AND multi-unit team building (extra members cycle the pool).
  function cardAt(poolIndex){
    const pool=selectableCards();
    return pool.length?pool[((poolIndex%pool.length)+pool.length)%pool.length]:null;
  }
  function selectableOptionHtml(values){
    // values: array of pool indices already chosen; returns <optgroup> markup.
    const presets=state.systemPresets||[], lib=state.library;
    const pool=selectableCards();
    const opt=(c,i)=>{const ui=NCB.rarityUI(c.rarity);const cpower=NCB.battlePowerOf(c);return `<option value="${c.id}" ${values.includes(c.id)?'selected':''}>${esc(c.displayName||c.name)} · ${esc(ui.badge)} · Lv.${c.level??100}${cpower?` · ${esc(NCB.formatBattlePower(cpower))}`:''}</option>`;};
    const groups=[];
    if(presets.length)groups.push(`<optgroup label="系统预设（14）">${presets.map((c,i)=>opt(c,i)).join('')}</optgroup>`);
    if(lib.length)groups.push(`<optgroup label="我的卡牌（${lib.length}）">${lib.map((c,i)=>opt(c,i+presets.length)).join('')}</optgroup>`);
    return groups.join('');
  }

  function renderBattle(){
    const view=$('#view-battle');if(!view)return;
    const engine=state.engine;
    if(!engine){
      view.innerHTML=`<div class="battle-empty">
        <div class="big-title">让创造，自己交锋。</div>
        <p>直接选两张系统预设卡，或从「我的卡牌」用自建卡，观察它们如何出招。</p>
        <div class="battle-setup-panel">
          <div class="field-row"><label class="field"><span>左方卡牌</span><select data-battle-card>${selectableOptionHtml(state.selectedLeft!=null?[selectableCards()[state.selectedLeft]?.id]:[])}</select></label><b class="setup-vs">VS</b><label class="field"><span>右方卡牌</span><select data-battle-right>${selectableOptionHtml(state.selectedRight!=null?[selectableCards()[state.selectedRight]?.id]:[])}</select></label></div>
          <button class="btn big primary" data-action="battle-start">开始对战</button>
          <details class="advanced-note"><summary>高级设置</summary><div class="field-row"><label class="field"><span>左方人数</span><select data-battle-size-a>${[1,2,3,4,5,6].map(n=>`<option>${n}</option>`).join('')}</select></label><label class="field"><span>右方人数</span><select data-battle-size-b>${[1,2,3,4,5,6].map(n=>`<option>${n}</option>`).join('')}</select></label><label class="field"><span>最大回合</span><input data-max-rounds type="number" min="1" max="1000" value="100"></label></div><p class="hint">额外成员按可选手牌顺序循环选取，无站位规则；系统预设为只读来源。</p></details>
        </div>
      </div>`;
      return;
    }
    view.innerHTML=`
      <div class="battle-toolbar">
        <span class="battle-mode-pill">${state.battleMode==='manual'?'实验接管':'AI 对战'}</span>
        <span class="hint">回合 ${engine.round}</span>
        <span class="spacer"></span>
        <button class="btn small" data-action="battle-restart">重开</button>
        <button class="btn small" data-action="battle-back">返回选卡</button>
      </div>
      <div class="battle-vs">
        <div class="battle-side">
          <div class="side-label">左方</div>
          <div class="arena-line">${teamCards('A')}</div>
        </div>
        <div class="battle-vs-divider">VS</div>
        <div class="battle-side">
          <div class="side-label">右方</div>
          <div class="arena-line">${teamCards('B')}</div>
        </div>
      </div>
      ${outcomeBanner()}<div class="current-event" aria-live="polite">${esc(state.engine.log.filter(x=>x.kind==='action').at(-1)?.text||'双方正在观察战场')}</div>
      ${state.battleMode==='auto'?autoControls():commandPanel()}<details class="advanced-note"><summary>实验控制</summary><button class="btn small" data-action="manual-takeover">${state.battleMode==='auto'?'手动接管左方':'返回 AI 对战'}</button><button class="btn small" data-action="edit-battle-card">编辑左方卡牌</button></details>
      <div class="battle-log-panel">
        <div class="panel-head"><h3>战斗记录</h3>
          <div class="log-tools"><select data-log-filter><option value="all">全部</option><option value="damage">伤害</option><option value="heal">治疗</option><option value="status">状态</option><option value="system">系统</option></select></div>
        </div>
        <div class="battle-log">${logRows()}</div>
      </div>`;
    const filter=$('[data-log-filter]',view);if(filter)filter.value=state.logFilter;
  }

  function autoControls(){
    return `<div class="auto-controls">
      <button class="btn" data-action="auto-pause">${state.autoPaused?'继续':'暂停'}</button>
      <button class="btn" data-action="auto-step">下一步</button>
      <span class="spacer"></span>
      ${[1,2,4].map(x=>`<button class="btn ${state.autoSpeed===x?'is-active':''}" data-action="auto-speed" data-speed="${x}">${x}×</button>`).join('')}
    </div>`;
  }

  function meter(label,value,max){const ratio=max?Math.max(0,Math.min(1,value/max)):0;return `<div class="meter-row"><span>${label}</span><span class="meter"><i style="width:${ratio*100}%"></i></span><span>${Math.round(value)}/${Math.round(max)}</span></div>`;}
  function resourceIds(entity){const keys=Object.keys(entity.stats||{});const out=[];if((entity.stats.ENERGY_MAX??0)>0)out.push('ENERGY');for(const key of keys){if(!key.endsWith('_MAX'))continue;const id=key.slice(0,-4);if(id==='ENERGY'||id==='HP')continue;if((entity.stats[key]??0)>0)out.push(id);}return [...new Set(out)];}
  function resourceMeters(entity){return resourceIds(entity).map(id=>meter('能量',state.engine.getResource(entity,id),state.engine.resourceMax(entity,id))).join('');}
  function formatSkillCosts(skill){const costs=state.engine?.skillCosts(skill)||[];return costs.length?costs.map(c=>`${c.resource==='ENERGY'?'能量':c.resource} ${c.amount}`).join(' + '):'无消耗';}
  function statusLine(entity){const statuses=entity.statuses.map(s=>{const d=NCB.STATUS_DEFS[s.id]||{name:s.id,kind:''};return `<span class="status ${d.kind==='debuff'?'debuff':''}" title="${esc(d.name)}">${esc(d.name)}${s.stacks>1?` ×${s.stacks}`:''}<small> ${s.duration===null?'∞':`${s.duration}回合`}</small></span>`;});return statuses.join('')||'<span class="inline-note">无状态</span>';}
  function entityCard(entity){
    const engine=state.engine;const selected=state.selectedActorId===entity.id;let target=false;
    if(state.selectedSkillId&&state.selectedActorId){try{target=engine.getValidTargets(state.selectedActorId,state.selectedSkillId).some(t=>t.id===entity.id);}catch(_){}}
    const planned=state.pending.get(entity.id);
    const derived=id=>engine.getStat(entity.id,id);
    const meta=resolveBattleCardMeta(entity.templateId);
    const ui=meta?NCB.rarityUI(meta.rarity):null;
    const bp=meta?NCB.battlePowerOf(meta):null;
    const lv=meta?meta.level:null;
    return `<article class="entity-card ${entity.hp>0?'selectable':''} ${selected?'is-selected':''} ${target?'is-target':''} ${entity.hp<=0?'is-dead':''}" data-entity-id="${entity.id}">
      <div class="entity-top"><div><div class="entity-name">${esc(entity.name)}</div>${meta&&ui?`<div class="entity-meta">${esc(ui.badge)} · Lv.${lv??''}${bp?` · ${esc(NCB.formatBattlePower(bp))}`:''}</div>`:''}</div><span class="entity-role">${esc(ROLE_ZH[entity.role]||'')}</span></div>
      ${NCB.artPlaceholder(meta?meta.rarity:'C',entity.templateId)}<div class="meter-group">${meter('生命',entity.hp,entity.maxHp)}${meter('护盾',entity.shield,entity.maxHp)}</div>
      <div class="stat-line"><span class="stat-chip">攻击<b>${derived('ATK')}</b></span><span class="stat-chip">防御<b>${derived('DEF')}</b></span><span class="stat-chip">速度<b>${derived('SPD')}</b></span><span class="stat-chip">暴击<b>${derived('CRIT')}%</b></span></div>
      <div class="status-line">${statusLine(entity)}</div><div class="battle-actions">${entity.skills.map(id=>`<span title="${esc(NCB.describeAction(NCB.SKILL_DEFS[id]))}">${esc(NCB.SKILL_DEFS[id].name)}</span>`).join('')}</div>
      ${planned?`<span class="action-marker">已选择行动</span>`:''}
    </article>`;
  }
  function teamCards(teamId){const entities=state.engine.teams[teamId].entities;return `<div class="team-line" style="--team-cols:${Math.min(entities.length,6)}">${entities.map(entityCard).join('')}</div>`;}

  function skillTargetLabel(skill){return ({self:'自己',ally:'单个友方','all-allies':'全体友方',enemy:'单个敌方','all-enemies':'全体敌方'})[skill.target]||skill.target;}
  function commandPanel(){
    const engine=state.engine;if(!engine)return'';
    ensureActor();const actor=state.selectedActorId?engine.entity(state.selectedActorId):null;
    const required=engine.getLiving('A').filter(e=>engine.getLegalSkills(e.id).length);
    const allReady=required.every(e=>state.pending.has(e.id));
    const selectedSkill=state.selectedSkillId?NCB.SKILL_DEFS[state.selectedSkillId]:null;
    const pending=[...state.pending.values()];
    return `<div class="command-panel">
      <div class="panel"><div class="panel-head"><h3>选择行动</h3><span class="inline-note">回合 ${engine.round}</span></div><div class="panel-body">
        ${actor?`<div class="actor-title">${esc(actor.name)}</div><div class="actor-sub">请选择技能${selectedSkill?'，再点击高亮目标':''}</div>
        <div class="skill-list">${engine.getLegalSkills(actor.id).map(skill=>`<button class="skill-btn ${state.selectedSkillId===skill.id?'is-active':''}" data-skill-id="${skill.id}"><span><span class="skill-name">${esc(skill.name)}</span><span class="skill-meta">${esc(skillTargetLabel(skill))} · 优先P${skill.priority||0} · 冷却CD${skill.cooldown||0}</span></span><span class="skill-cost">${esc(formatSkillCosts(skill))}</span></button>`).join('')||'<div class="empty">当前无法行动</div>'}`:'<div class="empty">没有可操作实体</div>'}
        <div class="row"><button class="btn" data-action="auto-plan">AI 填充我方</button><button class="btn primary" data-action="resolve-round" ${allReady?'':'disabled'}>结算回合</button><button class="btn" data-action="auto-finish">自动演算到结束</button></div>
      </div></div>
      <div class="panel"><div class="panel-head"><h3>已安排行动</h3><span>${pending.length}/${required.length}</span></div><div class="panel-body pending-list">${pending.length?pending.map(a=>{const actor=engine.entity(a.actorId),skill=NCB.SKILL_DEFS[a.skillId],target=engine.entity(a.targetId);return `<div class="pending-item"><span>${esc(actor.name)} → ${esc(skill.name)} → ${esc(target.name)}</span><button class="btn small ghost" data-remove-action="${actor.id}">×</button></div>`}).join(''):'<div class="inline-note">尚未安排动作。</div>'}</div></div>
    </div>`;
  }

  function logRows(){
    const log=state.engine?.log||[];const filtered=state.logFilter==='all'?log:log.filter(x=>x.kind===state.logFilter);
    if(!filtered.length)return `<div class="empty">暂无战斗记录</div>`;
    return filtered.slice(-200).reverse().map(entry=>`<div class="log-row ${esc(entry.kind)}"><span class="log-index">#${entry.id} R${entry.round}</span>${esc(entry.text||entry.kind)}${entry.trace?.length?`<details><summary>计算详情</summary><ol class="trace">${entry.trace.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></details>`:''}</div>`).join('');
  }
  function outcomeBanner(){const o=state.engine.outcome();if(!o.ended)return'';return `<div class="result-banner">${o.winner==='draw'?'平局':`${o.winner==='A'?'左方':'右方'}胜利！`}</div>`;}

  function ensureActor(){
    if(!state.engine)return;
    const candidate=state.engine.getLiving('A').find(e=>!state.pending.has(e.id)&&state.engine.getLegalSkills(e.id).length);
    const existing=state.selectedActorId&&state.engine.getLiving('A').some(e=>e.id===state.selectedActorId)?state.engine.entity(state.selectedActorId):null;
    if(!existing||state.pending.has(existing.id)||!state.engine.getLegalSkills(existing.id).length)state.selectedActorId=candidate?.id||state.engine.getLiving('A')[0]?.id||null;
  }

  function queueAction(actorId,skillId,targetId){state.pending.set(actorId,{actorId,skillId,targetId});state.selectedSkillId=null;state.selectedActorId=null;ensureActor();renderBattle();}
  function handleSkill(skillId){
    const engine=state.engine,actor=state.selectedActorId?engine.entity(state.selectedActorId):null;if(!actor)return;
    const skill=NCB.SKILL_DEFS[skillId];const targets=engine.getValidTargets(actor.id,skill.id);if(!targets.length)return;
    if(skill.target==='self'||skill.target==='all-allies'||skill.target==='all-enemies')queueAction(actor.id,skill.id,targets[0].id);
    else{state.selectedSkillId=skill.id;renderBattle();}
  }
  function autoPlanPlayer(){state.pending.clear();for(const a of NCB.planAI(state.engine,'A','canonical'))state.pending.set(a.actorId,a);state.selectedActorId=null;state.selectedSkillId=null;ensureActor();renderBattle();}
  function resolveRound(){const required=state.engine.getLiving('A').filter(e=>state.engine.getLegalSkills(e.id).length);if(!required.every(e=>state.pending.has(e.id)))return;const enemy=NCB.planAI(state.engine,'B','canonical');state.engine.resolveRound([...state.pending.values(),...enemy]);state.pending.clear();state.selectedActorId=null;state.selectedSkillId=null;ensureActor();renderBattle();}
  function autoFinish(){let guard=0;while(!state.engine.outcome().ended&&guard++<60){state.engine.resolveRound([...NCB.planAI(state.engine,'A','canonical'),...NCB.planAI(state.engine,'B','canonical')]);}state.pending.clear();state.selectedActorId=null;state.selectedSkillId=null;renderBattle();}
  function autoStep(){
    if(!state.engine||state.engine.outcome().ended)return;const before=state.engine.log.length;
    state.engine.resolveRound([...NCB.planAI(state.engine,'A','canonical'),...NCB.planAI(state.engine,'B','canonical')]);renderBattle();
    for(const row of state.engine.log.slice(before).filter(x=>['damage','heal','shield'].includes(x.kind)&&(x.amount||0)>0).slice(0,8)){
      const card=$(`[data-entity-id="${row.targetId}"]`);if(!card)continue;card.classList.add('is-hit');
      const label=document.createElement('span');label.className='combat-number';label.textContent=(row.kind==='damage'?'−':'+')+Math.round(row.amount??0);card.appendChild(label);
    }
  }
  function autoTogglePause(){state.autoPaused=!state.autoPaused;renderBattle();}
  function setAutoSpeed(s){state.autoSpeed=s;renderBattle();}

  // Auto-play loop with speed control (used by the 自动推演 mode).
  let autoTimer=null;
  function startAuto(){
    if(state.battleMode!=='auto'){state.battleMode='auto';state.autoPaused=false;}
    if(autoTimer)clearInterval(autoTimer);
    autoTimer=setInterval(()=>{
      if(!state.engine||state.engine.outcome().ended){clearInterval(autoTimer);autoTimer=null;renderBattle();return;}
      if(state.autoPaused||state.tab!=='battle')return;
      autoStep();
    },1200/state.autoSpeed);
  }

  // ===========================================================================
  // CARDS (card library)
  // ===========================================================================
  function renderCards(){
    const view=$('#view-cards');if(!view)return;
    const lib=state.library,presets=state.systemPresets||[];
    const presetTile=(c,i)=>`<div class="card-collection-item card-source-preset" data-preset-index="${i}">
      ${NCB.renderCard(c,{showId:false})}
      <div class="card-collection-actions card-preset-actions">
        <button class="btn small primary" data-preset-action="battle" data-preset-index="${i}">立即对战</button>
        <button class="btn small" data-preset-action="copy" data-preset-index="${i}">复制到我的卡牌</button>
      </div>
    </div>`;
    const presetRegion=presets.length?`<div class="card-region"><div class="cards-region-head"><h2>系统预设</h2><span class="hint">只读 · ${presets.length} 张 · 不可删除/改名</span></div><div class="card-grid">${presets.map(presetTile).join('')}</div></div>`:'';
    const libRegion=`<div class="card-region"><div class="cards-region-head"><h2>我的卡牌</h2><span class="hint">本地保存 · ${lib.length} 张</span><span class="spacer"></span><button class="btn small" data-action="cards-to-generate">生成新卡</button></div>
      ${lib.length?`<div class="card-grid">${lib.map((c,i)=>`<div class="card-collection-item" data-lib-index="${i}">
        ${NCB.renderCard(c,{showId:false})}
        <div class="card-collection-actions">
          <button class="btn small primary" data-lib-action="battle" data-lib-index="${i}">立即对战</button>
          <button class="btn small" data-lib-action="edit" data-lib-index="${i}">编辑</button><button class="btn small" data-lib-action="duplicate" data-lib-index="${i}">复制</button><button class="btn small" data-lib-action="rename" data-lib-index="${i}">改名</button>
          <button class="btn small" data-lib-action="copyseed" data-lib-index="${i}">复制种子</button>
          <button class="btn small" data-lib-action="regenerate" data-lib-index="${i}">同种子再生成</button>
          <button class="btn small ghost" data-lib-action="delete" data-lib-index="${i}">删除</button>
        </div>
      </div>`).join('')}</div>`:'<div class="empty-state"><p>还没有自建卡。可以从上方系统预设「复制到我的卡牌」，或生成新卡。</p><button class="btn primary" data-action="cards-to-generate">去生成第一张卡</button></div>'}</div>`;
    view.innerHTML=`${presetRegion}${libRegion}`;
  }

  // ===========================================================================
  // GENERATE view
  // ===========================================================================
  function renderGenerate(){
    const view=$('#view-generate');if(!view)return;
    const card=state.lastGenerated;
    view.innerHTML=`<div class="generate-layout">
      <div class="panel"><div class="panel-head"><h2>生成卡牌</h2><span class="hint">选择稀有度 / 等级，生成一个独立个体</span></div><div class="panel-body">
        <div class="field-row">
          <label class="field"><span>稀有度</span><select data-gen-rarity>${RARITY_OPTIONS.map(r=>`<option value="${r}" ${r===state.genRarity?'selected':''}>${esc(NCB.V2_RARITY_DISPLAY?.[r]||r)}</option>`).join('')}</select></label>
          <label class="field"><span>等级</span><input data-gen-level type="number" min="1" max="100" step="1" value="${state.genLevel}"></label>
        </div>
        <details class="advanced-note"><summary>Seed（高级）</summary>
          <label class="field"><span>固定种子</span><input type="text" data-gen-seed value="${esc(state.genSeed)}" placeholder="留空则自动随机"></label>
          <p class="hint">默认自动随机种子；只有高级模式下手动指定。</p>
        </details>
        <div class="row"><button class="btn big primary" data-action="generate-roll">随机生成</button></div>
      </div></div>
      ${card?`<div class="panel"><div class="panel-head"><h2>生成结果</h2></div><div class="panel-body">
        <div class="card-center">${NCB.renderCard(card,{showId:false})}</div>
        <div class="row"><button class="btn primary" data-action="add-to-library">加入我的卡牌</button><button class="btn" data-action="battle-generated">立即对战</button><button class="btn" data-action="generate-roll">再次生成</button><button class="btn" data-action="edit-generated">高级编辑</button></div>
      </div></div>`:''}
    </div>`;
  }

  // ===========================================================================
  // HELP (玩法说明)
  // ===========================================================================
  function renderHelp(){
    $('#view-help').innerHTML=`<div class="help-layout"><h2>创造、组合、观察。</h2><ol class="help-steps"><li>可直接选两张「系统预设」开战，无需先建卡；或选择稀有度、等级和定位自建卡。</li><li>保存到我的卡牌，选择左右双方。</li><li>开始对战，看 AI 自动决策。随时暂停、单步或调速。</li><li>结束后重开、换卡，或打开高级编辑修改数值。</li></ol><h3>同时决策，顺序结算</h3><p>每轮所有存活角色先选择一个行动与合法目标，再按行动优先级、速度和确定性规则统一排序。状态与反击会即时触发。达到最大回合则平局。</p><h3>稀有度 · 等级 · 战力</h3><p>内置 14 张系统预设（7 定位 × 2），覆盖 12 档稀有度、Lv.10–100，方便第一眼对比。卡面上「战力」是综合实力的<b>参考数值</b>，<b>不参与</b>战斗计算。</p><p>等级可输入 1–100 的任意整数；12 档稀有度代表逐步增加的数值预算；强弱与克制都可以存在。定位只影响生成倾向。没有升级、奖励或解锁。</p><p>数据保存在当前浏览器。高级实验室可编辑完整行动、资源、状态、公式，查看回放与计算详情。</p></div>`;
  }

  // ===========================================================================
  // ADVANCED LAB (preserved from v1: editor / simulation / guide / replay / trace / json)
  // ===========================================================================
  function unitOptions(selected){return Object.keys(NCB.UNIT_DEFS).map(id=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(NCB.UNIT_DEFS[id].name)} / ${esc(NCB.UNIT_DEFS[id].role)}</option>`).join('');}
  function currentPack(){return{units:NCB.UNIT_DEFS,skills:NCB.SKILL_DEFS,statuses:NCB.STATUS_DEFS};}

  function renderEditor(){ const view=$('#view-editor');if(!view)return;
    const unit=NCB.UNIT_DEFS[state.editorUnitId]||NCB.UNIT_DEFS[Object.keys(NCB.UNIT_DEFS)[0]];state.editorUnitId=unit.id;
    view.innerHTML=`<div class="editor-layout"><div class="panel"><div class="panel-head"><h2>实体目录</h2><span>${Object.keys(NCB.UNIT_DEFS).length}</span></div><div class="panel-body roster-list">${Object.keys(NCB.UNIT_DEFS).map(id=>{const u=NCB.UNIT_DEFS[id];return`<button class="roster-btn ${id===unit.id?'is-active':''}" data-editor-unit="${id}"><b>${esc(u.name)}</b><span>${esc(u.role)} · ${u.skills.length} 技能</span></button>`}).join('')}</div></div>
      <div class="stack"><div class="panel"><div class="panel-head"><h2>实体数值</h2><span class="inline-note">高级编辑</span></div><div class="panel-body">
        <div class="grid two"><label class="field"><span>名称</span><input data-unit-field="name" value="${esc(unit.name)}"></label><label class="field"><span>定位</span><input data-unit-field="role" value="${esc(unit.role)}"></label></div>
        <div class="form-grid">${['MAX_HP','ATK','DEF','RES','SPD','CRIT','CRIT_DMG','PEN','ACC','EVA','ENERGY_MAX','ENERGY_REGEN'].map(stat=>`<label class="field"><span>${esc(stat)}</span><input type="number" step="0.01" data-stat="${stat}" value="${unit.stats[stat]??0}"></label>`).join('')}</div>
        <p class="inline-note">抗性/亲和/技能程序编辑保留自 v1 实验室；具体见「规则/架构」与 JSON 视图。</p>
      </div></div></div></div>`;
  }

  function simulationLineup(team){return (state.setup[`team${team}`]||[]).map(id=>`<span class="status">${esc(NCB.UNIT_DEFS[id]?.name||id)}</span>`).join(' ');}
  function topMetricRows(obj,limit=8,format=v=>String(v)){return Object.entries(obj||{}).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([k,v])=>`<div class="pending-item"><span>${esc(NCB.SKILL_DEFS[k]?.name||NCB.STATUS_DEFS[k]?.name||NCB.DAMAGE_TYPES[k]?.name||k)}</span><b>${esc(format(v))}</b></div>`).join('')||'<div class="inline-note">暂无数据</div>';}
  function renderSimulation(){const view=$('#view-simulation');if(!view)return;const r=state.simulation;
    const ids=Object.keys(NCB.UNIT_DEFS);
    // Default to two distinct built-in units so the first run resolves (a mirror
    // of the same sustain kit is the known heal-stall case).
    const dfltA=ids[0]||'vanguard',dfltB=ids.find(x=>x!==dfltA)||ids[1]||'warden';
    const opt=(id,dflt)=>`<option ${id===dflt?'selected':''}>${esc(id)}</option>`;
    view.innerHTML=`<div class="sim-layout"><div class="panel"><div class="panel-head"><h2>批量模拟</h2></div><div class="panel-body stack">
      <label class="field"><span>我方阵容</span><select data-sim-team-a>${ids.map(id=>opt(id,dfltA)).join('')}</select></label>
      <label class="field"><span>对手阵容</span><select data-sim-team-b>${ids.map(id=>opt(id,dfltB)).join('')}</select></label>
      <label class="field"><span>局数</span><input type="number" min="1" max="5000" value="${r?.battles||500}" data-sim="battles"></label>
      <label class="field"><span>随机种子基数</span><input type="number" value="9000" data-sim="seedBase"></label>
      <button class="btn primary" data-action="run-simulation">运行批量模拟</button>
      <p class="inline-note">每场战斗使用独立确定性种子；AI 与真实战斗使用同一 Formula/Effect 管线。</p>
    </div></div>
    <div class="stack">${r?`<div class="metric-grid"><div class="metric"><label>我方胜率</label><strong>${(r.winRateA*100).toFixed(1)}%</strong></div><div class="metric"><label>对手胜率</label><strong>${(r.winRateB*100).toFixed(1)}%</strong></div><div class="metric"><label>平均回合</label><strong>${r.avgRounds}</strong></div></div>
      <div class="panel"><div class="panel-head"><h3>技能使用</h3></div><div class="panel-body pending-list">${topMetricRows(r.skillUsage)}</div></div>
      <div class="panel"><div class="panel-head"><h3>状态施加</h3></div><div class="panel-body pending-list">${topMetricRows(r.statusApplications)}</div></div>`:'<div class="panel"><div class="empty">选择参数并运行。</div></div>'}</div></div>`;
  }
  function runSimulationFromUI(){const view=$('#view-simulation'),get=k=>$(`[data-sim="${k}"]`,view)?.value;
    const a=$('[data-sim-team-a]',view)?.value||'vanguard',b=$('[data-sim-team-b]',view)?.value||'warden';
    state.simulation=NCB.runSimulation({battles:Number(get('battles'))||500,seedBase:Number(get('seedBase'))||9000,teamA:[a],teamB:[b],difficultyA:'canonical',difficultyB:'canonical',maxRounds:50});renderSimulation();}

  function parameterLibraryHtml(){const groups=new Map();for(const def of NCB.PARAMETER_LIST||[]){if(!groups.has(def.category))groups.set(def.category,[]);groups.get(def.category).push(def);}return [...groups.entries()].map(([cat,defs])=>`<details class="parameter-group"><summary><b>${esc(cat)}</b><span class="inline-note">${defs.length} 旋钮</span></summary><div class="definition-list">${defs.map(def=>`<div class="definition"><b>${esc(def.id)} · ${esc(def.name)}</b><br><span>${esc(def.human)}</span><br><span class="inline-note">类型 ${esc(def.kind)} · 单位 ${esc(def.unit||'-')} · 默认 ${esc(def.defaultValue)} · 范围 ${esc(def.range)}<br>结果：${esc(def.effect)}<br>AI：${esc(def.ai)}</span></div>`).join('')}</div></details>`).join('');}
  function renderGuide(){const view=$('#view-guide');if(!view)return;view.innerHTML=`<div class="reference-grid"><div class="panel"><div class="panel-head"><h2>核心模型</h2></div><div class="panel-body"><h3>卡牌不是内核</h3><p>Engine 只认识 <b>CombatEntity</b>、Skill、Status、Action、Event 和数值。网页把实体画成卡片只是展示层。同一个内核也可以接 CLI、纯文字列表或其他 UI。</p><div class="code">CombatEntity[]\n  ↓ Actions\nPriority / Speed Queue\n  ↓\nRelay Event Modifiers\n  ↓\nFormula → Accuracy → Crit → Defense/Penetration\n  ↓\nShield Replacement → HP → Trigger / Status\n  ↓\nDeterministic State + Replay</div></div></div>
    <div class="panel"><div class="panel-head"><h2>成熟系统吸收</h2></div><div class="panel-body"><p>确定性 Gen5 PRNG、Priority/Speed 排序和 relay-event 内核直接派生/泛化自 Pokémon Showdown。Damage Packet、复合伤害与穿透借鉴 Cataclysm-DDA；攻击参数 Event Modifier 借鉴 Wesnoth；多资源/Sustain/抗性穿透借鉴 ToME 类大型 RPG。公式 DSL 使用随包固定的 Acorn 8.15.0（MIT）解析 AST，再由极小白名单解释器执行。</p></div></div>
    <div class="panel"><div class="panel-head"><h2>数值组件语言</h2></div><div class="panel-body"><p>内容不是角色专属代码，而是固定组件语言的组合。目前注册 <b>${Object.keys(NCB.PARAMETER_CATALOG||{}).length}</b> 个参数旋钮、<b>${Object.keys(NCB.EFFECT_COMPONENTS||{}).length}</b> 个 Effect、<b>${Object.keys(NCB.CONDITION_COMPONENTS||{}).length}</b> 个 Condition、<b>${Object.keys(NCB.TARGET_COMPONENTS||{}).length}</b> 个 Target、<b>${Object.keys(NCB.EVENT_COMPONENTS||{}).length}</b> 个 Event 插入点。</p>${parameterLibraryHtml()}</div></div>
    <div class="panel"><div class="panel-head"><h2>插件接口</h2></div><div class="panel-body"><p><b>Effect:</b> ${esc(Object.keys(NCB.EFFECT_COMPONENTS||{}).join(', '))}</p><p><b>Condition:</b> ${esc(Object.keys(NCB.CONDITION_COMPONENTS||{}).join(', '))}</p><p><b>Target:</b> ${esc(Object.keys(NCB.TARGET_COMPONENTS||{}).join(', '))}</p><p><b>Event:</b> ${esc(Object.keys(NCB.EVENT_COMPONENTS||{}).join(', '))}</p></div></div></div>`;}

  function renderReplay(){const view=$('#view-replay');if(!view)return;
    view.innerHTML=`<div class="panel"><div class="panel-head"><h2>对局重放</h2></div><div class="panel-body stack">
      <p class="hint">将当前对局导出为 Replay JSON，之后可重新导入逐回合回放。</p>
      <div class="row"><button class="btn primary" data-action="export-replay">导出当前对局</button><label class="btn" for="replay-file">导入 Replay</label><input id="replay-file" class="hidden" type="file" accept="application/json"></div>
      ${state.replay?`<div class="metric-grid"><div class="metric"><label>回合</label><strong>${state.replayIndex}/${state.replay.rounds.length}</strong></div></div><div class="row"><button class="btn" data-action="replay-prev">上一步</button><button class="btn" data-action="replay-next">下一步</button></div>`:''}
    </div></div>`;
  }
  function renderTrace(){const view=$('#view-trace');if(!view)return;
    const log=state.engine?.log||[];
    view.innerHTML=`<div class="panel"><div class="panel-head"><h2>计算详情</h2><span>${log.length} 条</span></div><div class="panel-body battle-log">${logRows()}</div></div>`;
  }
  function renderJson(){const view=$('#view-json');if(!view)return;
    view.innerHTML=`<div class="panel"><div class="panel-head"><h2>JSON 导入导出</h2></div><div class="panel-body stack">
      <p class="hint">导出当前全部内容（实体/技能/状态）为 JSON 包，或在编辑器修改后保存。</p>
      <div class="row"><button class="btn primary" data-action="export-content">导出内容 JSON</button><label class="btn" for="content-file">导入 JSON</label><input id="content-file" class="hidden" type="file" accept="application/json"></div>
    </div></div>`;
  }

  // ===========================================================================
  // EVENTS
  // ===========================================================================
  document.addEventListener('click',event=>{
    const roster=event.target.closest('[data-editor-unit]');if(roster){state.editorUnitId=roster.dataset.editorUnit;renderEditor();return;}
    const tab=event.target.closest('[data-tab]');if(tab){$('#lab-menu').open=false;setTab(tab.dataset.tab);if(tab.dataset.tab==='battle'){renderBattle();}return;}
    const presetBtn=event.target.closest('[data-preset-action]');
    if(presetBtn){
      const i=Number(presetBtn.dataset.presetIndex);const card=(state.systemPresets||[])[i];
      if(!card)return;
      const act=presetBtn.dataset.presetAction;
      if(act==='battle'){const pool=selectableCards();const idx=pool.findIndex(c=>c.id===card.id);state.selectedLeft=idx>=0?idx:0;state.selectedRight=idx>=0?((idx+1)%pool.length):1;state.engine=null;stopAuto();setTab('battle');renderBattle();}
      if(act==='copy')copyPresetToLibrary(card);
      return;
    }
    const libBtn=event.target.closest('[data-lib-action]');
    if(libBtn){
      const i=Number(libBtn.dataset.libIndex);const card=state.library[i];
      if(!card)return;
      const act=libBtn.dataset.libAction;
      if(act==='battle')startBattleWithCard(card);
      if(act==='edit')openCardEditor(card);
      if(act==='duplicate'){let c=NCB.deepClone(card);const oldId=c.id,newId=oldId+'-copy-'+Date.now();const remap=x=>{if(typeof x==='string')return x.startsWith(oldId)?newId+x.slice(oldId.length):x;if(Array.isArray(x))return x.map(remap);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,remap(v)]));return x;};c=remap(c);c.id=newId;c.displayName=(card.displayName||card.name)+' 副本';addToLibrary(c);renderCards();}
      if(act==='rename'){const n=prompt('输入新名称：',card.displayName||card.name||'');if(n&&n.trim()){card.displayName=n.trim();saveLibrary();renderCards();}}
      if(act==='copyseed'){const seed=card.seed??'';if(navigator.clipboard?.writeText){navigator.clipboard.writeText(seed).then(()=>alert('种子已复制：'+seed)).catch(()=>alert('种子：'+seed));}else alert('种子：'+seed);}
      if(act==='regenerate'){const c=NCB.generateCardByVersion({rarity:card.rarity,level:card.level,archetype:card.archetype,seed:card.seed,generatorVersion:card.generatorVersion});state.library[i]=NCB.deepClone(c);saveLibrary();renderCards();}
      if(act==='delete'){if(confirm(`删除「${card.displayName||card.name}」？`)){state.library.splice(i,1);saveLibrary();renderCards();}}
      return;
    }
    const card=event.target.closest('[data-entity-id]');
    if(card&&state.tab==='battle'&&state.battleMode==='manual'){
      const id=card.dataset.entityId,e=state.engine.entity(id);if(e.hp<=0)return;
      if(state.selectedSkillId&&state.selectedActorId){const targets=state.engine.getValidTargets(state.selectedActorId,state.selectedSkillId);if(targets.some(t=>t.id===id)){queueAction(state.selectedActorId,state.selectedSkillId,id);return;}}
      if(e.teamId==='A'&&!state.pending.has(e.id)){state.selectedActorId=e.id;state.selectedSkillId=null;renderBattle();}return;
    }
    const skill=event.target.closest('[data-skill-id]');if(skill){handleSkill(skill.dataset.skillId);return;}
    const remove=event.target.closest('[data-remove-action]');if(remove){state.pending.delete(remove.dataset.removeAction);ensureActor();renderBattle();return;}
    const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
    if(action==='battle-start'){
      const leftId=$('[data-battle-card]')?.value,rightId=$('[data-battle-right]')?.value;
      const pool=selectableCards();
      const left=leftId?pool.findIndex(c=>c.id===leftId):-1,right=rightId?pool.findIndex(c=>c.id===rightId):-1;
      if(left<0||right<0||!pool.length)return;
      const sizeA=Number($('[data-battle-size-a]').value),sizeB=Number($('[data-battle-size-b]').value),maxRounds=Number($('[data-max-rounds]').value);
      if(!Number.isInteger(maxRounds)||maxRounds<1||maxRounds>1000){alert('最大回合请输入 1–1000 的整数。');return;}
      state.selectedLeft=left;state.selectedRight=right;
      // Extra members cycle the combined selectable pool (presets + user library).
      const team=(anchor,n)=>Array.from({length:n},(_,i)=>{const card=cardAt(anchor+i);return NCB.deployCard(card);});
      beginBattle({seed:NCB.deriveSeed(state.setup.seedNumber),teamA:team(left,sizeA),teamB:team(right,sizeB),maxRounds});
    }
    if(action==='demo-cards'){for(const c of (state.systemPresets||[]).slice(0,2))copyPresetToLibrary(c);renderCards();renderBattle();}
    if(action==='manual-takeover'){state.battleMode=state.battleMode==='auto'?'manual':'auto';state.autoPaused=state.battleMode==='manual';if(state.battleMode==='auto')startAuto();renderBattle();}
    if(action==='edit-generated'&&state.lastGenerated)openCardEditor(state.lastGenerated);
    if(action==='edit-battle-card'){let c=resolveBattleCardMeta(state.engine?.config.teamA[0]);if(c){if(isSystemPreset(c.id)){c=copyPresetToLibrary(c);}if(c)openCardEditor(c);}}
    if(action==='save-card-edit')saveCardEdit();
    if(action==='battle-restart'){if(state.engine)createBattleWithSameCard();}
    if(action==='battle-back'){stopAuto();state.engine=null;renderBattle();}
    if(action==='auto-plan')autoPlanPlayer();
    if(action==='resolve-round')resolveRound();
    if(action==='auto-finish')autoFinish();
    if(action==='auto-pause')autoTogglePause();
    if(action==='auto-step'){state.battleMode='auto';state.autoPaused=true;autoStep();}
    if(action==='auto-speed'){state.autoSpeed=Number(event.target.closest('[data-speed]').dataset.speed);startAuto();renderBattle();}
    if(action==='generate-roll')generateFromForm();
    if(action==='add-to-library'){if(state.lastGenerated){addToLibrary(state.lastGenerated);renderGenerate();}}
    if(action==='battle-generated'){if(state.lastGenerated)startBattleWithCard(state.lastGenerated);}
    if(action==='cards-to-generate')setTab('generate');
    if(action==='export-replay'){if(state.engine)downloadJson(`数值对战-${Date.now()}.json`,state.engine.exportReplay());else alert('当前没有对局。');}
    if(action==='replay-prev'){if(state.replay){state.replayIndex=Math.max(0,state.replayIndex-1);applyReplay(state.replay,state.replayIndex);setTab('replay');}}
    if(action==='replay-next'){if(state.replay){state.replayIndex=Math.min(state.replay.rounds.length,state.replayIndex+1);applyReplay(state.replay,state.replayIndex);setTab('replay');}}
    if(action==='run-simulation')runSimulationFromUI();
    if(action==='export-content')downloadJson('数值内容.json',{version:2,units:NCB.UNIT_DEFS,skills:NCB.SKILL_DEFS,statuses:NCB.STATUS_DEFS});
    if(action==='reset-content'){if(confirm('恢复全部内置数值？')){storage.remove('numerical-battle-content-v1');location.reload();}}
  });

  document.addEventListener('change',event=>{
    if(event.target.matches('[data-stat],[data-unit-field]')){const unit=NCB.UNIT_DEFS[state.editorUnitId];if(event.target.dataset.stat){const n=Number(event.target.value);if(!Number.isFinite(n))return;unit.stats[event.target.dataset.stat]=n;}else unit[event.target.dataset.unitField]=event.target.value;storage.set('numerical-battle-content-v1',JSON.stringify(currentPack()));return;}
    if(event.target.matches('[data-log-filter]')){state.logFilter=event.target.value;renderBattle();return;}
    if(event.target.matches('[data-gen-rarity]')){state.genRarity=event.target.value;return;}
    if(event.target.matches('[data-gen-level]')){state.genLevel=Number(event.target.value);return;}
    if(event.target.matches('[data-gen-seed]')){state.genManualSeed=true;state.genSeed=event.target.value;return;}
    if(event.target.id==='replay-file'){const file=event.target.files[0];if(file)file.text().then(text=>{try{applyReplay(JSON.parse(text),JSON.parse(text).rounds?.length);setTab('replay');}catch(e){alert(`Replay 无效: ${e.message}`);}});}
    if(event.target.id==='content-file'){const file=event.target.files[0];if(file)file.text().then(text=>{try{importContent(JSON.parse(text));}catch(e){alert(`内容包无效: ${e.message}`);}});}
  });

  document.addEventListener('input',event=>{
    if(event.target.matches('[data-gen-seed]')){state.genSeed=event.target.value;state.genManualSeed=true;}
  });

  function createBattleWithSameCard(){if(state.engine)beginBattle({...state.engine.config});}
  function openCardEditor(card){
    state.editCard=card;state.autoPaused=true;setTab('editor');
    $('#view-editor').innerHTML=`<h2>编辑 ${esc(card.displayName||card.name)}</h2><p>修改任意属性、行动、状态、资源或公式。保存前会验证；原始卡牌在保存成功前保持不变。</p><label class="field"><span>完整卡牌 JSON</span><textarea id="card-json-editor" spellcheck="false" rows="24">${esc(JSON.stringify(card,null,2))}</textarea></label><p id="card-edit-error" role="alert"></p><button class="btn primary" data-action="save-card-edit">验证并保存</button>`;
  }
  function saveCardEdit(){
    try{
      const c=JSON.parse($('#card-json-editor').value);c.id=state.editCard.id;
      NCB.normalizeLevel(c.level);const actions=NCB.getCardActions(c);
      if(actions.length<2||actions.length>6)throw new Error('行动数量必须为 2–6。');
      const pack=NCB.assembleCardPack(c),v=NCB.validateContentPack(pack);if(!v.ok)throw new Error(v.errors.slice(0,8).join('；'));
      const i=state.library.findIndex(x=>x.id===c.id);if(i>=0)state.library[i]=c;else state.library.push(c);
      state.lastGenerated=c;saveLibrary();state.engine=null;stopAuto();setTab('cards');
    }catch(e){$('#card-edit-error').textContent=e.message;}
  }

  function downloadJson(filename,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
  function applyReplay(replay,index=replay.rounds.length){stopAuto();state.autoPaused=true;NCB.restoreReplayContent(replay);const engine=NCB.createBattle({seed:replay.seed,teamA:replay.teamA,teamB:replay.teamB,maxRounds:replay.maxRounds});for(let i=0;i<Math.min(index,replay.rounds.length);i++){if(engine.outcome().ended)break;engine.resolveRound(replay.rounds[i]);}state.engine=engine;state._deployedMeta=new Map();for(const t of ['A','B'])for(const ent of engine.teams[t].entities){const meta=state.systemPresets.find(c=>c.id===ent.templateId)||state.library.find(c=>c.id===ent.templateId)||null;if(meta)state._deployedMeta.set(ent.templateId,meta);}state.replay=replay;state.replayIndex=Math.min(index,replay.rounds.length);state.pending.clear();state.selectedActorId=null;state.selectedSkillId=null;}
  function importContent(data){if(!data?.units||!data?.skills||!data?.statuses)throw new Error('JSON 缺少 units / skills / statuses');const validation=NCB.validateContentPack(data);if(!validation.ok)throw new Error(`内容验证失败:\n${validation.errors.slice(0,12).join('\n')}`);const repl=k=>{for(const key of Object.keys(NCB[k]))delete NCB[k][key];Object.assign(NCB[k],NCB.deepClone(data[k]));};repl('UNIT_DEFS');repl('SKILL_DEFS');repl('STATUS_DEFS');alert('内容已导入。');setTab('guide');}

  function updateHeader(){
    const formula=$('#formula-state');if(formula){const info=NCB.formulaEngineInfo?.()||{};formula.textContent=info.offline?`${(info.name||'公式').toUpperCase()} ${info.version||''} / 离线`.replace(/\s+/g,' ').trim():'公式检查';}
    const engine=$('#engine-state');if(engine)engine.textContent='引擎就绪';
  }

  function qaSelfTest(){try{const engine=NCB.createBattle({seed:'gen5,77,88,99,111',teamA:['vanguard','ranger'],teamB:['warden','assassin']});for(let i=0;i<2;i++)engine.resolveRound([...NCB.planAI(engine,'A','hard'),...NCB.planAI(engine,'B','normal')]);const replay=NCB.replayBattle(engine.exportReplay());const same=JSON.stringify(replay.serializableSnapshot())===JSON.stringify(engine.serializableSnapshot());const sim=NCB.runSimulation({battles:10,seedBase:500,teamA:['vanguard','ranger'],teamB:['warden','assassin'],difficultyA:'normal',difficultyB:'normal',maxRounds:25});const ok=same&&sim.battles===10&&engine.log.length>0;document.body.dataset.qaPass=String(ok);const marker=document.createElement('div');marker.id='qa-result';marker.textContent=ok?'QA_PASS':'QA_FAIL';marker.style.cssText='position:fixed;right:8px;bottom:8px;padding:4px 6px;background:#111;color:#fff;font:10px monospace;z-index:9999';document.body.appendChild(marker);}catch(e){document.body.dataset.qaPass='false';console.error(e);}}

  try{const saved=JSON.parse(storage.get('numerical-battle-content-v1')||'null');if(saved&&NCB.validateContentPack(saved).ok){Object.assign(NCB.UNIT_DEFS,saved.units);Object.assign(NCB.SKILL_DEFS,saved.skills);Object.assign(NCB.STATUS_DEFS,saved.statuses);}}catch(_){}
  renderHelp();updateHeader();setTab('battle');
  if(new URLSearchParams(location.search).get('qa')==='1')setTimeout(qaSelfTest,50);
})(window);
