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
    engine:null,
    pending:new Map(),
    selectedActorId:null,
    selectedSkillId:null,
    logFilter:'all',
    // generate form
    genRarity:'A',genLevel:100,genArchetype:'Balanced',genSeed:'',genManualSeed:false,
    // battle mode: manual (player picks skills) | auto (both AI)
    battleMode:'manual',
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
    const card=NCB.generateCardV2({
      rarity:state.genRarity,level:state.genLevel,archetype:state.genArchetype,
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
  function startBattleWithCard(card){
    const id=NCB.deployCardV2(card);
    const opp=NCB.generateCardV2({rarity:state.genRarity==='C'?'C_PLUS':state.genRarity,level:state.genLevel,archetype:state.genArchetype==='Balanced'?'Balanced':state.genArchetype,seed:'opp-'+Date.now()});
    const oppId=NCB.deployCardV2(opp);
    state.setup.battleSizeA=1;state.setup.battleSizeB=1;
    state.engine=NCB.createBattle({seed:NCB.deriveSeed(state.setup.seedNumber),teamA:[id],teamB:[oppId]});
    state.battleMode='manual';
    state.pending.clear();state.selectedActorId=null;state.selectedSkillId=null;
    setTab('battle');
  }

  // ===========================================================================
  // BATTLE (1 VS 1 default; manual player skills vs AI opponent; auto 推演 mode)
  // ===========================================================================
  function createBattleFromLibrary(){
    const lib=state.library;
    if(!lib.length){alert('请先在「生成卡牌」或「卡牌」中准备卡牌。');setTab('generate');return;}
    const card=lib[0];
    startBattleWithCard(card);
  }

  function renderBattle(){
    const view=$('#view-battle');if(!view)return;
    const engine=state.engine;
    if(!engine){
      view.innerHTML=`<div class="battle-empty">
        <div class="big-title">开始对战</div>
        <p>从你的卡牌库选择一张卡，再选择对手难度，即可开始 1 VS 1 对战。</p>
        <div class="battle-setup-panel">
          <div class="field-row">
            <label class="field"><span>我的卡牌</span><select data-battle-card>${state.library.length?state.library.map((c,i)=>`<option value="${i}">${esc(c.displayName||c.name||c.id)} · Lv.${c.level??100} · ${esc(ROLE_ZH[c.archetype]||c.archetype||'')}</option>`).join(''):'<option disabled>（卡牌库为空，请先生成）</option>'}</select></label>
            <label class="field"><span>对手难度</span><select data-battle-diff><option value="easy" ${state.setup.opponentDifficulty==='easy'?'selected':''}>简单</option><option value="normal" ${state.setup.opponentDifficulty==='normal'?'selected':''}>普通</option><option value="hard" ${state.setup.opponentDifficulty==='hard'?'selected':''}>困难</option></select></label>
          </div>
          <button class="btn big primary" data-action="battle-start">开始对战</button>
          <details class="advanced-note"><summary>更多对战设置</summary>
            <div class="field-row">
              <label class="field"><span>我方上场</span><select data-battle-size-a>${[1,2,3,4,5,6].map(n=>`<option ${n===state.setup.battleSizeA?'selected':''}>${n}</option>`).join('')}</select></label>
              <label class="field"><span>对手上场</span><select data-battle-size-b>${[1,2,3,4,5,6].map(n=>`<option ${n===state.setup.battleSizeB?'selected':''}>${n}</option>`).join('')}</select></label>
            </div>
            <p class="hint">默认 1 VS 1；更多对战设置在高级设置中调整（沿用卡牌库的前几张卡，未配置时自动补齐）。</p>
          </details>
        </div>
        <div class="mode-toggle-row">
          <button class="btn" data-action="battle-auto">自动推演</button>
          <span class="hint">自动推演：双方都由 AI 控制，支持 暂停/继续/下一步/1×/2×/4×</span>
        </div>
      </div>`;
      return;
    }
    const lib=state.library;
    const myCard=lib.find(c=>c.id===engine.teams.A.entities[0]?.templateId);
    view.innerHTML=`
      <div class="battle-toolbar">
        <span class="battle-mode-pill">${state.battleMode==='manual'?'手动对战':'自动推演'}</span>
        <span class="hint">回合 ${engine.round}</span>
        <span class="spacer"></span>
        <button class="btn small" data-action="battle-restart">重开</button>
        <button class="btn small" data-action="battle-back">返回选卡</button>
      </div>
      <div class="battle-vs">
        <div class="battle-side">
          <div class="side-label">对手</div>
          <div class="arena-line">${teamCards('B')}</div>
        </div>
        <div class="battle-vs-divider">VS</div>
        <div class="battle-side">
          <div class="side-label">我方</div>
          <div class="arena-line">${teamCards('A')}</div>
        </div>
      </div>
      ${outcomeBanner()}
      ${state.battleMode==='auto'?autoControls():commandPanel()}
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
  function statusLine(entity){const statuses=entity.statuses.map(s=>{const d=NCB.STATUS_DEFS[s.id]||{name:s.id,kind:''};return `<span class="status ${d.kind==='debuff'?'debuff':''}" title="${esc(s.id)}">${esc(d.name)}${s.stacks>1?` ×${s.stacks}`:''}<small> ${s.duration===null?'∞':`${s.duration}回合`}</small></span>`;});return statuses.join('')||'<span class="inline-note">无状态</span>';}
  function entityCard(entity){
    const engine=state.engine;const selected=state.selectedActorId===entity.id;let target=false;
    if(state.selectedSkillId&&state.selectedActorId){try{target=engine.getValidTargets(state.selectedActorId,state.selectedSkillId).some(t=>t.id===entity.id);}catch(_){}}
    const planned=state.pending.get(entity.id);
    const derived=id=>engine.getStat(entity.id,id);
    return `<article class="entity-card ${entity.hp>0?'selectable':''} ${selected?'is-selected':''} ${target?'is-target':''} ${entity.hp<=0?'is-dead':''}" data-entity-id="${entity.id}">
      <div class="entity-top"><div><div class="entity-name">${esc(entity.name)}</div></div><span class="entity-role">${esc(entity.role)}</span></div>
      <div class="meter-group">${meter('生命',entity.hp,entity.maxHp)}${meter('护盾',entity.shield,entity.maxHp)}${resourceMeters(entity)}</div>
      <div class="stat-line"><span class="stat-chip">攻击<b>${derived('ATK')}</b></span><span class="stat-chip">防御<b>${derived('DEF')}</b></span><span class="stat-chip">速度<b>${derived('SPD')}</b></span><span class="stat-chip">暴击<b>${derived('CRIT')}%</b></span></div>
      <div class="status-line">${statusLine(entity)}</div>
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
    return filtered.slice().reverse().map(entry=>`<div class="log-row ${esc(entry.kind)}"><span class="log-index">#${entry.id} R${entry.round}</span>${esc(entry.text||entry.kind)}${entry.trace?.length?`<details><summary>计算详情</summary><ol class="trace">${entry.trace.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></details>`:''}</div>`).join('');
  }
  function outcomeBanner(){const o=state.engine.outcome();if(!o.ended)return'';return `<div class="result-banner">${o.winner==='draw'?'平局':`${o.winner==='A'?'我方':'对手'}胜利！`}</div>`;}

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
  function autoPlanPlayer(){state.pending.clear();for(const a of NCB.planAI(state.engine,'A','hard'))state.pending.set(a.actorId,a);state.selectedActorId=null;state.selectedSkillId=null;ensureActor();renderBattle();}
  function resolveRound(){const required=state.engine.getLiving('A').filter(e=>state.engine.getLegalSkills(e.id).length);if(!required.every(e=>state.pending.has(e.id)))return;const enemy=NCB.planAI(state.engine,'B',state.setup.opponentDifficulty);state.engine.resolveRound([...state.pending.values(),...enemy]);state.pending.clear();state.selectedActorId=null;state.selectedSkillId=null;ensureActor();renderBattle();}
  function autoFinish(){let guard=0;while(!state.engine.outcome().ended&&guard++<60){state.engine.resolveRound([...NCB.planAI(state.engine,'A','hard'),...NCB.planAI(state.engine,'B',state.setup.opponentDifficulty)]);}state.pending.clear();state.selectedActorId=null;state.selectedSkillId=null;renderBattle();}
  function autoStep(){if(!state.engine||state.engine.outcome().ended)return;state.engine.resolveRound([...NCB.planAI(state.engine,'A','hard'),...NCB.planAI(state.engine,'B',state.setup.opponentDifficulty)]);renderBattle();}
  function autoTogglePause(){state.autoPaused=!state.autoPaused;renderBattle();}
  function setAutoSpeed(s){state.autoSpeed=s;renderBattle();}

  // Auto-play loop with speed control (used by the 自动推演 mode).
  let autoTimer=null;
  function startAuto(){
    if(state.battleMode!=='auto'){state.battleMode='auto';state.autoPaused=false;}
    if(autoTimer)clearInterval(autoTimer);
    autoTimer=setInterval(()=>{
      if(!state.engine||state.engine.outcome().ended){clearInterval(autoTimer);autoTimer=null;renderBattle();return;}
      if(state.autoPaused)return;
      autoStep();
    },400/state.autoSpeed);
  }

  // ===========================================================================
  // CARDS (card library)
  // ===========================================================================
  function renderCards(){
    const view=$('#view-cards');if(!view)return;
    const lib=state.library;
    view.innerHTML=`<div class="cards-toolbar"><h2>我的卡牌</h2><span class="hint">本地保存 · ${lib.length} 张</span><span class="spacer"></span><button class="btn small" data-action="cards-to-generate">生成新卡</button></div>
      ${lib.length?`<div class="card-grid">${lib.map((c,i)=>`<div class="card-collection-item" data-lib-index="${i}">
        ${NCB.renderCard(c,{showId:false})}
        <div class="card-collection-actions">
          <button class="btn small primary" data-lib-action="battle" data-lib-index="${i}">立即对战</button>
          <button class="btn small" data-lib-action="rename" data-lib-index="${i}">改名</button>
          <button class="btn small" data-lib-action="copyseed" data-lib-index="${i}">复制种子</button>
          <button class="btn small" data-lib-action="regenerate" data-lib-index="${i}">同种子再生成</button>
          <button class="btn small ghost" data-lib-action="delete" data-lib-index="${i}">删除</button>
        </div>
      </div>`).join('')}</div>`:'<div class="empty-state"><p>卡牌库为空。</p><button class="btn primary" data-action="cards-to-generate">去生成第一张卡</button></div>'}`;
  }

  // ===========================================================================
  // GENERATE view
  // ===========================================================================
  function renderGenerate(){
    const view=$('#view-generate');if(!view)return;
    const card=state.lastGenerated;
    view.innerHTML=`<div class="generate-layout">
      <div class="panel"><div class="panel-head"><h2>生成卡牌</h2><span class="hint">选择稀有度 / 等级 / 定位，随机生成</span></div><div class="panel-body">
        <div class="field-row">
          <label class="field"><span>稀有度</span><select data-gen-rarity>${RARITY_OPTIONS.map(r=>`<option value="${r}" ${r===state.genRarity?'selected':''}>${esc(NCB.V2_RARITY_DISPLAY?.[r]||r)}</option>`).join('')}</select></label>
          <label class="field"><span>等级</span><select data-gen-level>${[1,20,40,60,80,100].map(l=>`<option ${l===state.genLevel?'selected':''}>${l}</option>`).join('')}</select></label>
          <label class="field"><span>类型定位</span><select data-gen-archetype>${ARCHETYPE_OPTIONS.map(a=>`<option value="${a}" ${a===state.genArchetype?'selected':''}>${esc(ROLE_ZH[a]||a)}</option>`).join('')}</select></label>
        </div>
        <details class="advanced-note"><summary>Seed（高级）</summary>
          <label class="field"><span>固定种子</span><input type="text" data-gen-seed value="${esc(state.genSeed)}" placeholder="留空则自动随机"></label>
          <p class="hint">默认自动随机种子；只有高级模式下手动指定。</p>
        </details>
        <div class="row"><button class="btn big primary" data-action="generate-roll">随机生成</button></div>
      </div></div>
      ${card?`<div class="panel"><div class="panel-head"><h2>生成结果</h2></div><div class="panel-body">
        <div class="card-center">${NCB.renderCard(card,{showId:false})}</div>
        <div class="row"><button class="btn primary" data-action="add-to-library">加入我的卡牌</button><button class="btn" data-action="battle-generated">立即对战</button><button class="btn" data-action="generate-roll">再次生成</button></div>
      </div></div>`:''}
    </div>`;
  }

  // ===========================================================================
  // HELP (玩法说明)
  // ===========================================================================
  function renderHelp(){
    const view=$('#view-help');if(!view)return;
    view.innerHTML=`<div class="help-layout">
      <div class="panel"><div class="panel-head"><h2>怎么玩</h2></div><div class="panel-body">
        <ol class="help-steps">
          <li><b>生成卡牌</b>：在「生成卡牌」选择稀有度 / 等级 / 定位，点「随机生成」得到一张卡。</li>
          <li><b>加入卡牌库</b>：把生成的卡加入「我的卡牌」。</li>
          <li><b>开始对战</b>：进入「对战」，选择你的卡牌和对手难度，点「开始对战」。</li>
          <li><b>选择行动</b>：点击我方卡牌，选择技能，再点击目标；所有行动安排好后点「结算回合」。</li>
          <li><b>胜负</b>：把对手全部生命打到 0 即胜利。也可以使用「自动推演」让双方 AI 自动对战。</li>
        </ol>
        <h3>基础规则</h3>
        <ul class="help-list">
          <li>每张卡有生命、攻击、防御、抗性、速度、暴击六项基础属性。</li>
          <li>技能造成伤害或提供治疗 / 护盾 / 状态。命中取决于命中率与闪避，暴击造成更高伤害。</li>
          <li>防御降低物理伤害，抗性降低元素伤害，穿透可无视部分防御。</li>
          <li>速度决定出手顺序。</li>
          <li>战力是一个展示用的综合评分，不代表绝对胜负。</li>
        </ul>
      </div></div>
      <div class="panel"><div class="panel-head"><h2>稀有度</h2></div><div class="panel-body">
        <p>共 12 个稀有度档位，从低到高：C、C+、B、B+、A、A+、S、SS、SSS、SSS 典藏版、XS、XS 典藏版。稀有度影响生成卡牌的数值上限，典藏版拥有更特殊的卡框与标记。</p>
      </div></div>
      <div class="panel"><div class="panel-head"><h2>常见问题</h2></div><div class="panel-body">
        <p><b>战力是什么意思？</b>战力由生命/攻击/速度等数值综合计算，是展示指标，供你比较两张卡；实际胜负由战斗结算决定。</p>
        <p><b>能联网吗？</b>不能也不需要。所有内容都在本地运行和保存。</p>
        <p><b>卡牌丢了？</b>卡牌保存在浏览器本地存储里，换浏览器/清缓存会丢失。</p>
      </div></div>
    </div>`;
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
    state.simulation=NCB.runSimulation({battles:Number(get('battles'))||500,seedBase:Number(get('seedBase'))||9000,teamA:[a],teamB:[b],difficultyA:'normal',difficultyB:'normal',maxRounds:50});renderSimulation();}

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
    const tab=event.target.closest('[data-tab]');if(tab){setTab(tab.dataset.tab);if(tab.dataset.tab==='battle'){renderBattle();}return;}
    const libBtn=event.target.closest('[data-lib-action]');
    if(libBtn){
      const i=Number(libBtn.dataset.libIndex);const card=state.library[i];
      if(!card)return;
      const act=libBtn.dataset.libAction;
      if(act==='battle')startBattleWithCard(card);
      if(act==='rename'){const n=prompt('输入新名称：',card.displayName||card.name||'');if(n&&n.trim()){card.displayName=n.trim();saveLibrary();renderCards();}}
      if(act==='copyseed'){const seed=card.seed??'';if(navigator.clipboard?.writeText){navigator.clipboard.writeText(seed).then(()=>alert('种子已复制：'+seed)).catch(()=>alert('种子：'+seed));}else alert('种子：'+seed);}
      if(act==='regenerate'){const c=NCB.generateCardV2({rarity:card.rarity,level:card.level,archetype:card.archetype,seed:card.seed});state.library[i]=NCB.deepClone(c);saveLibrary();renderCards();}
      if(act==='delete'){if(confirm(`删除「${card.displayName||card.name}」？`)){state.library.splice(i,1);saveLibrary();renderCards();}}
      return;
    }
    const card=event.target.closest('[data-entity-id]');
    if(card&&state.tab==='battle'){
      const id=card.dataset.entityId,e=state.engine.entity(id);if(e.hp<=0)return;
      if(state.selectedSkillId&&state.selectedActorId){const targets=state.engine.getValidTargets(state.selectedActorId,state.selectedSkillId);if(targets.some(t=>t.id===id)){queueAction(state.selectedActorId,state.selectedSkillId,id);return;}}
      if(e.teamId==='A'&&!state.pending.has(e.id)){state.selectedActorId=e.id;state.selectedSkillId=null;renderBattle();}return;
    }
    const skill=event.target.closest('[data-skill-id]');if(skill){handleSkill(skill.dataset.skillId);return;}
    const remove=event.target.closest('[data-remove-action]');if(remove){state.pending.delete(remove.dataset.removeAction);ensureActor();renderBattle();return;}
    const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
    if(action==='battle-start'){
      const sel=$('[data-battle-card]');const ci=Number(sel?.value??0);
      if(!state.library.length||!state.library[ci]){alert('请先生成一张卡。');setTab('generate');return;}
      state.setup.opponentDifficulty=$('[data-battle-diff]')?.value||'normal';
      const sizeA=Number($('[data-battle-size-a]')?.value||1),sizeB=Number($('[data-battle-size-b]')?.value||1);
      state.setup.battleSizeA=sizeA;state.setup.battleSizeB=sizeB;saveSetup();
      startBattleWithCard(state.library[ci]);
    }
    if(action==='battle-auto'){createBattleFromLibrary();state.battleMode='auto';state.autoPaused=false;renderBattle();startAuto();}
    if(action==='battle-restart'){if(state.engine)createBattleWithSameCard();}
    if(action==='battle-back'){state.engine=null;renderBattle();}
    if(action==='auto-plan')autoPlanPlayer();
    if(action==='resolve-round')resolveRound();
    if(action==='auto-finish')autoFinish();
    if(action==='auto-pause')autoTogglePause();
    if(action==='auto-step'){state.battleMode='auto';renderBattle();autoStep();}
    if(action==='auto-speed'){state.autoSpeed=Number(event.target.dataset.speed||1);if(state.battleMode==='auto')startAuto();else{state.battleMode='auto';startAuto();}}
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
    if(event.target.matches('[data-log-filter]')){state.logFilter=event.target.value;renderBattle();return;}
    if(event.target.matches('[data-gen-rarity]')){state.genRarity=event.target.value;return;}
    if(event.target.matches('[data-gen-level]')){state.genLevel=Number(event.target.value);return;}
    if(event.target.matches('[data-gen-archetype]')){state.genArchetype=event.target.value;return;}
    if(event.target.matches('[data-gen-seed]')){state.genManualSeed=true;state.genSeed=event.target.value;return;}
    if(event.target.id==='replay-file'){const file=event.target.files[0];if(file)file.text().then(text=>{try{applyReplay(JSON.parse(text),JSON.parse(text).rounds?.length);setTab('replay');}catch(e){alert(`Replay 无效: ${e.message}`);}});}
    if(event.target.id==='content-file'){const file=event.target.files[0];if(file)file.text().then(text=>{try{importContent(JSON.parse(text));}catch(e){alert(`内容包无效: ${e.message}`);}});}
  });

  document.addEventListener('input',event=>{
    if(event.target.matches('[data-gen-seed]')){state.genSeed=event.target.value;state.genManualSeed=true;}
  });

  function createBattleWithSameCard(){
    const first=state.engine?.teams?.A?.entities?.[0]?.templateId;
    const card=state.library.find(c=>c.id===first)||state.library[0];
    if(card)startBattleWithCard(card);
  }
  function downloadJson(filename,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
  function applyReplay(replay,index=replay.rounds.length){const engine=NCB.createBattle({seed:replay.seed,teamA:replay.teamA,teamB:replay.teamB});for(let i=0;i<Math.min(index,replay.rounds.length);i++){if(engine.outcome().ended)break;engine.resolveRound(replay.rounds[i]);}state.engine=engine;state.replay=replay;state.replayIndex=Math.min(index,replay.rounds.length);state.pending.clear();state.selectedActorId=null;state.selectedSkillId=null;}
  function importContent(data){if(!data?.units||!data?.skills||!data?.statuses)throw new Error('JSON 缺少 units / skills / statuses');const validation=NCB.validateContentPack(data);if(!validation.ok)throw new Error(`内容验证失败:\n${validation.errors.slice(0,12).join('\n')}`);const repl=k=>{for(const key of Object.keys(NCB[k]))delete NCB[k][key];Object.assign(NCB[k],NCB.deepClone(data[k]));};repl('UNIT_DEFS');repl('SKILL_DEFS');repl('STATUS_DEFS');alert('内容已导入。');setTab('guide');}

  function updateHeader(){
    const formula=$('#formula-state');if(formula){const info=NCB.formulaEngineInfo?.()||{};formula.textContent=info.offline?`${(info.name||'公式').toUpperCase()} ${info.version||''} / 离线`.replace(/\s+/g,' ').trim():'公式检查';}
    const engine=$('#engine-state');if(engine)engine.textContent='引擎就绪';
  }

  function qaSelfTest(){try{const engine=NCB.createBattle({seed:'gen5,77,88,99,111',teamA:['vanguard','ranger'],teamB:['warden','assassin']});for(let i=0;i<2;i++)engine.resolveRound([...NCB.planAI(engine,'A','hard'),...NCB.planAI(engine,'B','normal')]);const replay=NCB.replayBattle(engine.exportReplay());const same=JSON.stringify(replay.serializableSnapshot())===JSON.stringify(engine.serializableSnapshot());const sim=NCB.runSimulation({battles:10,seedBase:500,teamA:['vanguard','ranger'],teamB:['warden','assassin'],difficultyA:'normal',difficultyB:'normal',maxRounds:25});const ok=same&&sim.battles===10&&engine.log.length>0;document.body.dataset.qaPass=String(ok);const marker=document.createElement('div');marker.id='qa-result';marker.textContent=ok?'QA_PASS':'QA_FAIL';marker.style.cssText='position:fixed;right:8px;bottom:8px;padding:4px 6px;background:#111;color:#fff;font:10px monospace;z-index:9999';document.body.appendChild(marker);}catch(e){document.body.dataset.qaPass='false';console.error(e);}}

  renderHelp();updateHeader();setTab('battle');
  if(new URLSearchParams(location.search).get('qa')==='1')setTimeout(qaSelfTest,50);
})(window);
