(function (root) {
  'use strict';
  const NCB = root.NCB;
  if (!NCB) throw new Error('NCB engine not loaded');

  const $ = (selector, el=document) => el.querySelector(selector);
  const $$ = (selector, el=document) => [...el.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const pct = value => `${(Number(value||0)*100).toFixed(1)}%`;
  const STORAGE_CONTENT = 'numerical-battle-content-v1';
  const STORAGE_SETUP = 'numerical-battle-setup-v1';
  const memoryStorage = new Map();
  const storage = {
    get(key){try{return root.localStorage?.getItem(key) ?? memoryStorage.get(key) ?? null;}catch(_){return memoryStorage.get(key) ?? null;}},
    set(key,value){memoryStorage.set(key,String(value));try{root.localStorage?.setItem(key,String(value));}catch(_){ }},
    remove(key){memoryStorage.delete(key);try{root.localStorage?.removeItem(key);}catch(_){ }}
  };

  const BUILTIN = NCB.deepClone({units:NCB.UNIT_DEFS,skills:NCB.SKILL_DEFS,statuses:NCB.STATUS_DEFS});
  const rosterIds = () => Object.keys(NCB.UNIT_DEFS);
  const defaultSetup = {
    sizeA:4,sizeB:4,
    teamA:NCB.DEFAULT_TEAM_A.slice(),
    teamB:NCB.DEFAULT_TEAM_B.slice(),
    seedNumber:20260901,
    difficultyB:'normal',
  };

  const state = {
    tab:'battle',
    setup:loadSetup(),
    engine:null,
    pending:new Map(),
    selectedActorId:null,
    selectedSkillId:null,
    logFilter:'all',
    editorUnitId:'vanguard',
    editorStatusId:'fortified',
    simulation:null,
    replay:null,
    replayIndex:0,
  };

  function loadSetup() {
    try {
      const saved = JSON.parse(storage.get(STORAGE_SETUP) || 'null');
      return normalizeSetup(saved || defaultSetup);
    } catch (_) { return normalizeSetup(defaultSetup); }
  }
  function normalizeSetup(input) {
    const ids=rosterIds();
    const out={...defaultSetup,...input};
    out.sizeA=Math.max(1,Math.min(6,Number(out.sizeA)||4));
    out.sizeB=Math.max(1,Math.min(6,Number(out.sizeB)||4));
    out.teamA=Array.from({length:out.sizeA},(_,i)=>ids.includes(out.teamA?.[i])?out.teamA[i]:ids[i%ids.length]);
    out.teamB=Array.from({length:out.sizeB},(_,i)=>ids.includes(out.teamB?.[i])?out.teamB[i]:ids[(i+6)%ids.length]);
    out.seedNumber=Number(out.seedNumber)||20260901;
    return out;
  }
  function saveSetup(){storage.set(STORAGE_SETUP,JSON.stringify(state.setup));}
  function replaceObject(target, source){for(const key of Object.keys(target))delete target[key];Object.assign(target,NCB.deepClone(source));}
  function loadContentOverrides(){try{const saved=JSON.parse(storage.get(STORAGE_CONTENT)||'null');if(saved?.units&&saved?.skills){replaceObject(NCB.UNIT_DEFS,saved.units);replaceObject(NCB.SKILL_DEFS,saved.skills);if(saved.statuses)replaceObject(NCB.STATUS_DEFS,saved.statuses);}}catch(_) {}}
  loadContentOverrides();

  function createCurrentBattle(seedOverride) {
    state.setup=normalizeSetup(state.setup);saveSetup();
    state.pending.clear();state.selectedSkillId=null;state.selectedActorId=null;state.replay=null;state.replayIndex=0;
    const seed=seedOverride || NCB.deriveSeed(state.setup.seedNumber);
    state.engine=NCB.createBattle({seed,teamA:state.setup.teamA,teamB:state.setup.teamB});
    ensureActor();
    renderBattle();
  }

  function ensureActor(){
    if(!state.engine)return;
    const candidate=state.engine.getLiving('A').find(e=>!state.pending.has(e.id)&&state.engine.getLegalSkills(e.id).length);
    const existing=state.selectedActorId && state.engine.getLiving('A').some(e=>e.id===state.selectedActorId) ? state.engine.entity(state.selectedActorId) : null;
    if(!existing || state.pending.has(existing.id) || !state.engine.getLegalSkills(existing.id).length) state.selectedActorId=candidate?.id || state.engine.getLiving('A')[0]?.id || null;
  }

  function unitOptions(selected){return rosterIds().map(id=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(NCB.UNIT_DEFS[id].name)} / ${esc(NCB.UNIT_DEFS[id].role)}</option>`).join('');}
  function teamEditor(teamId){
    const size=state.setup[`size${teamId}`], team=state.setup[`team${teamId}`];
    return `<div class="team-editor"><div class="row space"><h3>TEAM ${teamId}</h3><label class="field"><span>ACTIVE</span><select data-team-size="${teamId}">${[1,2,3,4,5,6].map(n=>`<option ${n===size?'selected':''}>${n}</option>`).join('')}</select></label></div><div class="team-slots">${team.map((id,i)=>`<select data-team-slot="${teamId}:${i}">${unitOptions(id)}</select>`).join('')}</div></div>`;
  }

  function meter(label,value,max){const ratio=max?Math.max(0,Math.min(1,value/max)):0;return `<div class="meter-row"><span>${label}</span><span class="meter"><i style="width:${ratio*100}%"></i></span><span>${Number(value)%1?Number(value).toFixed(1):Math.round(value)}/${Number(max)%1?Number(max).toFixed(1):Math.round(max)}</span></div>`;}
  function resourceIds(entity){const keys=Object.keys(entity.stats||{});const out=[];if((entity.stats.ENERGY_MAX??0)>0)out.push('ENERGY');for(const key of keys){if(!key.endsWith('_MAX'))continue;const id=key.slice(0,-4);if(id==='ENERGY'||id==='HP')continue;if((entity.stats[key]??0)>0)out.push(id);}return [...new Set(out)];}
  function resourceMeters(entity){return resourceIds(entity).map(id=>meter(id.slice(0,4),state.engine.getResource(entity,id),state.engine.resourceMax(entity,id))).join('');}
  function resourceSummary(entity){return resourceIds(entity).map(id=>`${id} ${Number(state.engine.getResource(entity,id)).toFixed(Number(state.engine.getResource(entity,id))%1?1:0)}/${Number(state.engine.resourceMax(entity,id)).toFixed(Number(state.engine.resourceMax(entity,id))%1?1:0)}`).join(' · ');}
  function formatSkillCosts(skill){const costs=state.engine?.skillCosts(skill)||[];return costs.length?costs.map(c=>`${c.resource} ${c.amount}`).join(' + '):'FREE';}
  function statusLine(entity){const statuses=entity.statuses.map(s=>{const d=NCB.STATUS_DEFS[s.id]||{name:s.id,kind:''};return `<span class="status ${d.kind==='debuff'?'debuff':''}" title="${esc(s.id)}">${esc(d.name)}${s.stacks>1?` ×${s.stacks}`:''}<small> ${s.duration===null?'∞':`${s.duration}T`}</small></span>`;});const wards=Object.entries(entity.wards||{}).filter(([,v])=>Number(v)>0).map(([type,v])=>`<span class="status" title="${esc(type)} ward">${esc(NCB.DAMAGE_TYPES[type]?.name||type)}护符 <small>${Math.round(v)}</small></span>`);return [...statuses,...wards].join('')||`<span class="inline-note">NO STATUS</span>`;}
  function entityCard(entity){
    const engine=state.engine;const selected=state.selectedActorId===entity.id;let target=false;
    if(state.selectedSkillId&&state.selectedActorId){try{target=engine.getValidTargets(state.selectedActorId,state.selectedSkillId).some(t=>t.id===entity.id);}catch(_){}}
    const planned=state.pending.get(entity.id);
    const derived=id=>engine.getStat(entity.id,id);
    return `<article class="entity-card ${entity.hp>0?'selectable':''} ${selected?'is-selected':''} ${target?'is-target':''} ${entity.hp<=0?'is-dead':''}" data-entity-id="${entity.id}">
      <div class="entity-top"><div><div class="entity-id">${entity.id}</div><div class="entity-name">${esc(entity.name)}</div></div><span class="entity-role">${esc(entity.role)}</span></div>
      <div class="meter-group">${meter('HP',entity.hp,entity.maxHp)}${meter('SHD',entity.shield,entity.maxHp)}${resourceMeters(entity)}</div>
      <div class="stat-line"><span class="stat-chip">ATK<b>${derived('ATK')}</b></span><span class="stat-chip">DEF<b>${derived('DEF')}</b></span><span class="stat-chip">SPD<b>${derived('SPD')}</b></span><span class="stat-chip">CRIT<b>${derived('CRIT')}%</b></span></div>
      <div class="status-line">${statusLine(entity)}</div>
      ${planned?`<span class="action-marker">QUEUED</span>`:''}
    </article>`;
  }
  function teamCards(teamId){const entities=state.engine.teams[teamId].entities;return `<div class="team-line" style="--team-cols:${Math.min(entities.length,4)}">${entities.map(entityCard).join('')}</div>`;}

  function skillTargetLabel(skill){return ({self:'自己',ally:'单个友方','all-allies':'全体友方',enemy:'单个敌方','all-enemies':'全体敌方'})[skill.target]||skill.target;}
  function commandPanel(){
    const engine=state.engine;if(!engine)return '';
    ensureActor();const actor=state.selectedActorId?engine.entity(state.selectedActorId):null;
    const required=engine.getLiving('A').filter(e=>engine.getLegalSkills(e.id).length);
    const allReady=required.every(e=>state.pending.has(e.id));
    const selectedSkill=state.selectedSkillId?NCB.SKILL_DEFS[state.selectedSkillId]:null;
    const pending=[...state.pending.values()];
    return `<div class="stack">
      <div class="panel"><div class="panel-head"><h3>COMMAND</h3><span class="inline-note">ROUND ${engine.round}</span></div><div class="panel-body command-panel">
        ${actor?`<div><div class="actor-title">${esc(actor.name)}</div><div class="actor-sub">${actor.id} · ${esc(resourceSummary(actor))} · 请选择技能${selectedSkill?'，再选择高亮目标':''}</div></div>
        <div class="skill-list">${engine.getLegalSkills(actor.id).map(skill=>`<button class="skill-btn ${state.selectedSkillId===skill.id?'is-active':''}" data-skill-id="${skill.id}"><span><span class="skill-name">${esc(skill.name)}</span><span class="skill-meta">${esc(skillTargetLabel(skill))} · P${skill.priority||0} · CD${skill.cooldown||0}${skill.formula?`<br>${esc(skill.formula)}`:''}</span></span><span class="skill-cost">${esc(formatSkillCosts(skill))}</span></button>`).join('')||'<div class="empty">当前无法行动</div>'}</div>`:'<div class="empty">没有可操作实体</div>'}
        <div class="row"><button class="btn" data-action="auto-plan">AI 填充我方</button><button class="btn primary" data-action="resolve-round" ${allReady?'':'disabled'}>结算回合</button><button class="btn" data-action="auto-finish">自动演算到结束</button></div>
      </div></div>
      <div class="panel"><div class="panel-head"><h3>QUEUED ACTIONS</h3><span>${pending.length}/${required.length}</span></div><div class="panel-body pending-list">${pending.length?pending.map(a=>{const actor=engine.entity(a.actorId),skill=NCB.SKILL_DEFS[a.skillId],target=engine.entity(a.targetId);return `<div class="pending-item"><span>${actor.id} ${esc(actor.name)} → ${esc(skill.name)} → ${target.id} ${esc(target.name)}</span><button class="btn small ghost" data-remove-action="${actor.id}">×</button></div>`}).join(''):'<div class="inline-note">尚未安排动作。</div>'}</div></div>
    </div>`;
  }

  function logRows(){
    const log=state.engine?.log||[];const filtered=state.logFilter==='all'?log:log.filter(x=>x.kind===state.logFilter);
    if(!filtered.length)return `<div class="empty">暂无战斗日志</div>`;
    return filtered.slice().reverse().map(entry=>`<div class="log-row ${esc(entry.kind)}"><span class="log-index">#${entry.id} R${entry.round}</span>${esc(entry.text||entry.kind)}${entry.trace?.length?`<details><summary>计算链 / TRACE</summary><ol class="trace">${entry.trace.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></details>`:''}</div>`).join('');
  }
  function outcomeBanner(){const o=state.engine.outcome();if(!o.ended)return '';return `<div class="result-banner">${o.winner==='draw'?'DRAW':`TEAM ${o.winner} // WIN`}</div>`;}

  function renderBattle(){
    const view=$('#view-battle');if(!view)return;
    const engine=state.engine;
    view.innerHTML=`<div class="setup-strip">${teamEditor('A')}<div class="vs">VS</div>${teamEditor('B')}</div>
      <div class="panel" style="margin-bottom:14px"><div class="panel-body controls">
        <label class="field"><span>SEED NUMBER</span><input type="number" data-setup="seedNumber" value="${state.setup.seedNumber}"></label>
        <label class="field"><span>ENEMY AI</span><select data-setup="difficultyB"><option value="easy" ${state.setup.difficultyB==='easy'?'selected':''}>EASY</option><option value="normal" ${state.setup.difficultyB==='normal'?'selected':''}>NORMAL</option><option value="hard" ${state.setup.difficultyB==='hard'?'selected':''}>HARD</option></select></label>
        <button class="btn primary" data-action="new-battle">新对局</button><button class="btn" data-action="restart">同 Seed 重开</button><button class="btn" data-action="next-seed">下一 Seed</button>
        <button class="btn" data-action="export-replay">导出 Replay</button><label class="btn" for="replay-file">导入 Replay</label><input id="replay-file" class="hidden" type="file" accept="application/json">
      </div></div>
      ${outcomeBanner()}
      <div class="battle-layout" ${engine?.outcome().ended?'style="margin-top:14px"':''}>
        <div class="stack"><div class="panel"><div class="panel-head"><h2>Battlefield</h2><span class="inline-note">SEED ${esc(engine?.config.seed||'')}</span></div><div class="panel-body arena"><div><div class="row space"><strong>TEAM B / AI</strong><span class="inline-note">${engine?.getLiving('B').length||0} ACTIVE</span></div>${teamCards('B')}</div><div><div class="row space"><strong>TEAM A / PLAYER</strong><span class="inline-note">${engine?.getLiving('A').length||0} ACTIVE</span></div>${teamCards('A')}</div></div></div>
          <div class="panel"><div class="panel-head"><h3>BATTLE LOG</h3><div class="log-tools"><select data-log-filter><option value="all">ALL</option><option value="damage">DAMAGE</option><option value="heal">HEAL</option><option value="status">STATUS</option><option value="system">SYSTEM</option></select><button class="btn small" data-action="clear-log-view">TOP</button></div></div><div class="battle-log">${logRows()}</div></div></div>
        ${commandPanel()}
      </div>`;
    const filter=$('[data-log-filter]',view);if(filter)filter.value=state.logFilter;
  }

  function queueAction(actorId,skillId,targetId){state.pending.set(actorId,{actorId,skillId,targetId});state.selectedSkillId=null;state.selectedActorId=null;ensureActor();renderBattle();}
  function handleSkill(skillId){
    const engine=state.engine,actor=state.selectedActorId?engine.entity(state.selectedActorId):null;if(!actor)return;
    const skill=NCB.SKILL_DEFS[skillId];const targets=engine.getValidTargets(actor.id,skill.id);if(!targets.length)return;
    if(skill.target==='self'||skill.target==='all-allies'||skill.target==='all-enemies')queueAction(actor.id,skill.id,targets[0].id);
    else {state.selectedSkillId=skill.id;renderBattle();}
  }
  function autoPlanPlayer(){state.pending.clear();for(const a of NCB.planAI(state.engine,'A','hard'))state.pending.set(a.actorId,a);state.selectedActorId=null;state.selectedSkillId=null;ensureActor();renderBattle();}
  function resolveRound(){const required=state.engine.getLiving('A').filter(e=>state.engine.getLegalSkills(e.id).length);if(!required.every(e=>state.pending.has(e.id)))return;const enemy=NCB.planAI(state.engine,'B',state.setup.difficultyB);state.engine.resolveRound([...state.pending.values(),...enemy]);state.pending.clear();state.selectedActorId=null;state.selectedSkillId=null;ensureActor();renderBattle();}
  function autoFinish(){let guard=0;while(!state.engine.outcome().ended&&guard++<60){state.engine.resolveRound([...NCB.planAI(state.engine,'A','hard'),...NCB.planAI(state.engine,'B',state.setup.difficultyB)]);}state.pending.clear();state.selectedActorId=null;state.selectedSkillId=null;renderBattle();}

  function downloadJson(filename,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
  function applyReplay(replay,index=replay.rounds.length){const engine=NCB.createBattle({seed:replay.seed,teamA:replay.teamA,teamB:replay.teamB});for(let i=0;i<Math.min(index,replay.rounds.length);i++){if(engine.outcome().ended)break;engine.resolveRound(replay.rounds[i]);}state.engine=engine;state.replay=replay;state.replayIndex=Math.min(index,replay.rounds.length);state.setup=normalizeSetup({...state.setup,sizeA:replay.teamA.length,sizeB:replay.teamB.length,teamA:replay.teamA,teamB:replay.teamB});state.pending.clear();state.selectedActorId=null;state.selectedSkillId=null;renderBattle();}

  function currentPack(){return{units:NCB.UNIT_DEFS,skills:NCB.SKILL_DEFS,statuses:NCB.STATUS_DEFS};}
  function editorSampleScope(unit){const target=NCB.UNIT_DEFS.vanguard||Object.values(NCB.UNIT_DEFS)[0];const scope={};for(const key of NCB.collectFormulaSymbols?.(currentPack())||NCB.FORMULA_SYMBOLS||[])scope[key]=0;for(const [key,value] of Object.entries(unit.stats||{}))scope[key]=Number(value)||0;for(const [key,value] of Object.entries(target?.stats||{}))scope[`TARGET_${key}`]=Number(value)||0;Object.assign(scope,{MAX_HP:unit.stats.MAX_HP||100,HP:unit.stats.MAX_HP||100,HP_PCT:1,MISSING_HP:0,ENERGY:Math.min(2,unit.stats.ENERGY_MAX||2),TARGET_HP:target?.stats?.MAX_HP||100,TARGET_MAX_HP:target?.stats?.MAX_HP||100,TARGET_HP_PCT:1,STACKS:2,CONSUMED_STACKS:3,EVENT_DAMAGE:50,EVENT_HP_DAMAGE:40,EVENT_SHIELD_DAMAGE:10,EVENT_WARD_DAMAGE:5,LAST_DAMAGE:50,LAST_HP_DAMAGE:40,LAST_SHIELD_DAMAGE:10,LAST_WARD_DAMAGE:5,LAST_HIT:1,LAST_CRIT:0,LAST_KILL:0,REPEAT_INDEX:0,MODIFIER_VALUE:1});return scope;}
  function editorStatOrder(unit){const preferred=['MAX_HP','ATK','DEF','RES','SPD','CRIT','CRIT_DMG','PEN','ACC','EVA','ENERGY_MAX','ENERGY_REGEN','RAGE','RAGE_MAX','SOUL','SOUL_MAX','CHRONO','CHRONO_MAX','LIFESTEAL','HEAL_POWER','HEAL_TAKEN'];const keys=Object.keys(unit.stats||{});return [...preferred.filter(k=>keys.includes(k)||['HEAL_TAKEN'].includes(k)),...keys.filter(k=>!preferred.includes(k)).sort()];}
  function formulaResult(expr,unit){if(!expr)return {ok:true,text:'无公式'};const allowed=NCB.collectFormulaSymbols?.(currentPack())||Object.keys(editorSampleScope(unit));const check=NCB.validateExpression?.(expr,allowed)||{ok:false,error:'公式引擎不可用'};if(!check.ok)return {ok:false,text:check.error};try{return{ok:true,text:`示例值 ${Number(NCB.evaluateExpression(expr,editorSampleScope(unit))).toFixed(2)}`};}catch(e){return{ok:false,text:e.message};}}
  function damageTypeOptions(selected){return Object.values(NCB.DAMAGE_TYPES||{}).map(d=>`<option value="${esc(d.id)}" ${d.id===selected?'selected':''}>${esc(d.name)} / ${esc(d.id)}</option>`).join('');}
  function targetOptions(selected){return Object.entries(NCB.TARGET_COMPONENTS||{}).map(([id,d])=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(d.name||id)} / ${esc(id)}</option>`).join('');}
  function boolOptions(value){return `<option value="true" ${value!==false?'selected':''}>true</option><option value="false" ${value===false?'selected':''}>false</option>`;}
  function jsonText(value,fallback){return esc(JSON.stringify(value===undefined?fallback:value,null,2));}
  function advancedNumber(label,field,value,step='0.01'){return `<label class="field"><span>${label}</span><input type="number" step="${step}" data-skill-field="${field}" value="${value??''}"></label>`;}
  function skillEditorCard(skill,unit){
    const r=formulaResult(skill.formula,unit);
    const componentEditors=(skill.damageComponents||[]).map((c,i)=>`<details class="parameter-group" data-component-index="${i}"><summary><b>DAMAGE COMPONENT ${i+1}</b><span class="inline-note">${esc(c.type||skill.damageType||'physical')}</span></summary><div class="stack"><div class="grid two"><label class="field"><span>TYPE</span><select data-component-field="type">${damageTypeOptions(c.type||skill.damageType||'physical')}</select></label><label class="field"><span>FORMULA</span><textarea rows="2" data-component-field="formula">${esc(c.formula||skill.formula||'')}</textarea></label></div><div class="form-grid">${['multiplier','varianceMin','varianceMax','penetration','typePenetration','minDamage','maxDamage'].map(key=>`<label class="field"><span>${key.toUpperCase()}</span><input type="number" step="0.01" data-component-field="${key}" value="${c[key]??''}"></label>`).join('')}<label class="field"><span>DEFENSE STAT</span><input data-component-field="defenseStat" value="${esc(c.defenseStat??'')}" placeholder="DEF / RES / none"></label><label class="field"><span>IGNORE DEF</span><select data-component-field="ignoreDefense">${boolOptions(c.ignoreDefense)}</select></label><label class="field"><span>IGNORE RES</span><select data-component-field="ignoreResistance">${boolOptions(c.ignoreResistance)}</select></label></div></div></details>`).join('');
    return `<div class="formula-card" data-skill-editor="${skill.id}"><div class="formula-header"><div><strong>${esc(skill.name)}</strong><div class="inline-note">${skill.id} · ${esc(skillTargetLabel(skill))} · ${esc(skill.damageType||skill.kind)}</div></div><span class="formula-state ${r.ok?'ok':'bad'}" data-formula-state>${esc(r.text)}</span></div>
      <div class="grid two"><label class="field"><span>TARGET COMPONENT</span><select data-skill-field="target">${targetOptions(skill.target)}</select></label><label class="field"><span>DAMAGE TYPE</span><select data-skill-field="damageType">${damageTypeOptions(skill.damageType||'physical')}</select></label></div>
      ${skill.formula!==undefined?`<label class="field"><span>FORMULA</span><textarea rows="2" data-skill-field="formula">${esc(skill.formula||'')}</textarea></label>`:'<div class="inline-note">该技能没有直接数值公式，主要由 Effect Program 组成。</div>'}
      ${componentEditors}
      <details class="parameter-group"><summary><b>STANDARD NUMERIC KNOBS</b><span class="inline-note">Pokémon/RPG-style parameters</span></summary><div class="form-grid">${advancedNumber('ENERGY COST','cost',skill.cost,1)}${advancedNumber('COOLDOWN','cooldown',skill.cooldown,1)}${advancedNumber('PRIORITY','priority',skill.priority,1)}${advancedNumber('ACCURACY','accuracy',skill.accuracy)}${advancedNumber('HITS','hits',skill.hits,1)}${advancedNumber('CRIT BONUS %','critBonus',skill.critBonus)}${advancedNumber('PEN BONUS %','penetrationBonus',skill.penetrationBonus)}${advancedNumber('TYPE PEN','typePenetrationBonus',skill.typePenetrationBonus)}${advancedNumber('VARIANCE MIN','varianceMin',skill.varianceMin)}${advancedNumber('VARIANCE MAX','varianceMax',skill.varianceMax)}${advancedNumber('DRAIN RATIO','drainRatio',skill.drainRatio)}${advancedNumber('RECOIL RATIO','recoilRatio',skill.recoilRatio)}${advancedNumber('SPREAD MULT','spreadMultiplier',skill.spreadMultiplier)}${advancedNumber('MIN DAMAGE','minDamage',skill.minDamage)}${advancedNumber('MAX DAMAGE','maxDamage',skill.maxDamage)}<label class="field"><span>DEFENSE STAT</span><input data-skill-field="defenseStat" value="${esc(skill.defenseStat??'')}" placeholder="type default / DEF / RES / none"></label>${[['CAN CRIT','canCrit'],['CAN MISS','canMiss'],['CAN REFLECT','canReflect'],['IGNORE DEF','ignoreDefense'],['IGNORE RES','ignoreResistance'],['IGNORE EVA','ignoreEvasion']].map(([label,key])=>`<label class="field"><span>${label}</span><select data-skill-field="${key}">${boolOptions(skill[key])}</select></label>`).join('')}</div></details>
      <details class="parameter-group"><summary><b>PROGRAM / JSON</b><span class="inline-note">advanced component composition</span></summary><div class="stack"><label class="field"><span>MULTI-RESOURCE COSTS</span><textarea rows="3" data-skill-json="costs">${jsonText(skill.costs,[])}</textarea></label><label class="field"><span>CAST REQUIREMENTS</span><textarea rows="4" data-skill-json="requirements">${jsonText(skill.requirements,null)}</textarea></label><label class="field"><span>TARGET REQUIREMENTS</span><textarea rows="4" data-skill-json="targetRequirements">${jsonText(skill.targetRequirements,null)}</textarea></label><label class="field"><span>TARGET QUERY</span><textarea rows="5" data-skill-json="targetQuery">${jsonText(skill.targetQuery,null)}</textarea></label><label class="field"><span>EFFECT PROGRAM</span><textarea rows="10" data-skill-json="effects">${jsonText(skill.effects,[])}</textarea></label></div></details></div>`;
  }
  function renderEditor(){
    const view=$('#view-editor'),unit=NCB.UNIT_DEFS[state.editorUnitId]||NCB.UNIT_DEFS[rosterIds()[0]];state.editorUnitId=unit.id;
    const statOrder=editorStatOrder(unit);
    const resistTypes=Object.keys(NCB.DAMAGE_TYPES||{}).filter(x=>x!=='true');
    view.innerHTML=`<div class="editor-layout"><div class="panel"><div class="panel-head"><h2>ENTITY CATALOG</h2><span>${rosterIds().length}</span></div><div class="panel-body roster-list">${rosterIds().map(id=>{const u=NCB.UNIT_DEFS[id];return`<button class="roster-btn ${id===unit.id?'is-active':''}" data-editor-unit="${id}"><b>${esc(u.name)}</b><span>${esc(u.role)} · ${u.skills.length} SKILLS</span></button>`}).join('')}</div></div>
      <div class="stack"><div class="panel"><div class="panel-head"><h2>ENTITY NUMBERS</h2><div class="row"><button class="btn small primary" data-action="save-content">保存数值</button><button class="btn small" data-action="export-content">导出 JSON</button><label class="btn small" for="content-file">导入 JSON</label><input class="hidden" id="content-file" type="file" accept="application/json"><button class="btn small ghost" data-action="reset-content">恢复内置</button></div></div><div class="panel-body">
        <div class="grid two" style="margin-bottom:12px"><label class="field"><span>NAME</span><input data-unit-field="name" value="${esc(unit.name)}"></label><label class="field"><span>ROLE</span><input data-unit-field="role" value="${esc(unit.role)}"></label><label class="field" style="grid-column:1/-1"><span>DESCRIPTION</span><input data-unit-field="description" value="${esc(unit.description)}"></label></div>
        <div class="form-grid">${statOrder.map(stat=>`<label class="field"><span>${stat}</span><input type="number" step="0.01" data-stat="${stat}" value="${unit.stats[stat]??(stat==='HEAL_TAKEN'?100:0)}"></label>`).join('')}</div>
        <h3 style="margin-top:16px">DAMAGE RESISTANCE / AFFINITY</h3><div class="form-grid">${resistTypes.map(type=>`<label class="field"><span>${type.toUpperCase()} RES</span><input type="number" step="0.01" min="-0.75" max="0.85" data-resistance="${type}" value="${unit.resistances?.[type]??0}"></label><label class="field"><span>${type.toUpperCase()} AFFINITY</span><input type="number" step="0.01" min="0" max="1" data-affinity="${type}" value="${unit.affinities?.[type]??0}"></label>`).join('')}</div>
        <p class="inline-note">抗性允许负数（弱点）；亲和会把对应类型的部分 HP 伤害转化为恢复。任意 *_MAX 数值会自动成为战斗资源（例如 RAGE / SOUL / CHRONO），状态与被动只生成 Derived Stat，不永久污染基础值。</p>
      </div></div>
      <div class="panel"><div class="panel-head"><h2>SKILL PROGRAMS</h2><span class="inline-note">FORMULA + COMPONENT + PLUGIN DATA</span></div><div class="panel-body stack">${unit.skills.map(skillId=>skillEditorCard(NCB.SKILL_DEFS[skillId],unit)).join('')}</div></div>
      <div class="panel"><div class="panel-head"><h2>STATUS PROGRAM</h2><select data-status-select>${Object.values(NCB.STATUS_DEFS).map(def=>`<option value="${esc(def.id)}" ${def.id===state.editorStatusId?'selected':''}>${esc(def.name)} / ${esc(def.id)}</option>`).join('')}</select></div><div class="panel-body"><p class="inline-note">Status 本身也是组件容器：Modifier / Resistance Modifier / Event Modifier / Trigger / Periodic / Sustain 全部可数据化。</p><label class="field"><span>STATUS JSON</span><textarea rows="18" data-status-json>${jsonText(NCB.STATUS_DEFS[state.editorStatusId]||{}, {})}</textarea></label></div></div>
      <div class="panel"><div class="panel-head"><h3>FORMULA DSL</h3><span>LOCAL / DETERMINISTIC</span></div><div class="panel-body"><div class="warning">公式由随包固定的 Acorn 8.15.0 解析 AST，再由本地白名单解释层执行：零网络依赖、无 eval/new Function、无赋值/成员访问/随机函数。支持条件、多项式、sqrt/log/pow/clamp 等纯数学组合，并允许插件注册纯函数。</div><div class="code" style="margin-top:9px">ATK * 1.2 + sqrt(SPD)\nATK * (TARGET_HP_PCT &lt; 0.35 ? 2 : 0.9)\nTARGET_MAX_HP * 0.025 * STACKS\nEVENT_HP_DAMAGE * 0.12 * STACKS</div></div></div></div></div>`;
  }
  function parseJsonField(el,label){try{return JSON.parse(el.value);}catch(e){throw new Error(`${label}: ${e.message}`);}}
  function saveContentFromEditor(){
    const view=$('#view-editor'),draft=NCB.deepClone(currentPack()),unit=draft.units[state.editorUnitId];
    try{
      $$('[data-unit-field]',view).forEach(el=>unit[el.dataset.unitField]=el.value);$$('[data-stat]',view).forEach(el=>unit.stats[el.dataset.stat]=Number(el.value));unit.resistances=unit.resistances||{};unit.affinities=unit.affinities||{};$$('[data-resistance]',view).forEach(el=>unit.resistances[el.dataset.resistance]=Number(el.value));$$('[data-affinity]',view).forEach(el=>unit.affinities[el.dataset.affinity]=Number(el.value));
      for(const box of $$('[data-skill-editor]',view)){const skill=draft.skills[box.dataset.skillEditor];for(const el of $$('[data-skill-field]',box)){const key=el.dataset.skillField;if(key==='formula'||key==='target'||key==='damageType'||key==='defenseStat'){if(key==='defenseStat'&&!el.value.trim())delete skill[key];else skill[key]=el.value;}else if(['canCrit','canMiss','canReflect','ignoreDefense','ignoreResistance','ignoreEvasion'].includes(key))skill[key]=el.value==='true';else{if(el.value==='')delete skill[key];else skill[key]=Number(el.value);}}for(const compBox of $$('[data-component-index]',box)){const comp=skill.damageComponents?.[Number(compBox.dataset.componentIndex)];if(!comp)continue;for(const el of $$('[data-component-field]',compBox)){const key=el.dataset.componentField;if(['type','formula','defenseStat'].includes(key)){if(key==='defenseStat'&&!el.value.trim())delete comp[key];else comp[key]=el.value;}else if(['ignoreDefense','ignoreResistance'].includes(key))comp[key]=el.value==='true';else{if(el.value==='')delete comp[key];else comp[key]=Number(el.value);}}}for(const el of $$('[data-skill-json]',box))skill[el.dataset.skillJson]=parseJsonField(el,`${skill.name} / ${el.dataset.skillJson}`);}
      const statusEl=$('[data-status-json]',view);if(statusEl){const status=parseJsonField(statusEl,`Status ${state.editorStatusId}`);status.id=state.editorStatusId;draft.statuses[state.editorStatusId]=status;}
      const validation=NCB.validateContentPack(draft);if(!validation.ok)throw new Error(`内容验证失败:
${validation.errors.slice(0,12).join('\n')}`);
      replaceObject(NCB.UNIT_DEFS,draft.units);replaceObject(NCB.SKILL_DEFS,draft.skills);replaceObject(NCB.STATUS_DEFS,draft.statuses);storage.set(STORAGE_CONTENT,JSON.stringify(draft));renderEditor();createCurrentBattle();
    }catch(e){alert(e.message);}
  }

  function importContent(data){if(!data?.units||!data?.skills||!data?.statuses)throw new Error('JSON 缺少 units / skills / statuses');const validation=NCB.validateContentPack(data);if(!validation.ok)throw new Error(`内容验证失败:
${validation.errors.slice(0,12).join('\n')}`);replaceObject(NCB.UNIT_DEFS,data.units);replaceObject(NCB.SKILL_DEFS,data.skills);replaceObject(NCB.STATUS_DEFS,data.statuses);storage.set(STORAGE_CONTENT,JSON.stringify({units:NCB.UNIT_DEFS,skills:NCB.SKILL_DEFS,statuses:NCB.STATUS_DEFS}));state.setup=normalizeSetup(state.setup);renderEditor();createCurrentBattle();}

  function simulationLineup(team){return state.setup[`team${team}`].map(id=>`<span class="status">${esc(NCB.UNIT_DEFS[id].name)}</span>`).join(' ');}
  function topMetricRows(obj,limit=8,format=v=>String(v)){return Object.entries(obj||{}).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([k,v])=>`<div class="pending-item"><span>${esc(NCB.SKILL_DEFS[k]?.name||NCB.STATUS_DEFS[k]?.name||NCB.DAMAGE_TYPES[k]?.name||k)}</span><b>${esc(format(v))}</b></div>`).join('')||'<div class="inline-note">暂无数据</div>';}
  function renderSimulation(){const view=$('#view-simulation'),r=state.simulation;view.innerHTML=`<div class="sim-layout"><div class="panel"><div class="panel-head"><h2>MONTE CARLO</h2><span>HEADLESS</span></div><div class="panel-body stack"><div><strong>TEAM A</strong><div class="status-line" style="margin-top:7px">${simulationLineup('A')}</div></div><div><strong>TEAM B</strong><div class="status-line" style="margin-top:7px">${simulationLineup('B')}</div></div><label class="field"><span>BATTLES</span><input type="number" min="1" max="5000" value="${r?.battles||500}" data-sim="battles"></label><label class="field"><span>SEED BASE</span><input type="number" value="9000" data-sim="seedBase"></label><label class="field"><span>TEAM A AI</span><select data-sim="difficultyA"><option>easy</option><option selected>normal</option><option>hard</option></select></label><label class="field"><span>TEAM B AI</span><select data-sim="difficultyB"><option>easy</option><option selected>normal</option><option>hard</option></select></label><button class="btn primary" data-action="run-simulation">运行批量模拟</button><div class="inline-note">每场战斗使用独立确定性 Seed；战术 AI 按实际预期伤害、治疗、护盾、状态与资源收益评分。</div></div></div>
      <div class="stack">${r?`<div class="metric-grid"><div class="metric"><label>TEAM A WIN</label><strong>${pct(r.winRateA)}</strong></div><div class="metric"><label>TEAM B WIN</label><strong>${pct(r.winRateB)}</strong></div><div class="metric"><label>AVG ROUNDS</label><strong>${r.avgRounds}</strong></div><div class="metric"><label>AVG HP DAMAGE</label><strong>${r.avgDamage}</strong></div></div><div class="panel"><div class="panel-head"><h3>OUTCOME DISTRIBUTION</h3><span>${r.battles} MATCHES</span></div><div class="panel-body"><div class="bar" title="A / Draw / B"><span class="a" style="width:${r.winRateA*100}%"></span><span class="d" style="width:${r.draws/r.battles*100}%"></span><span class="b" style="width:${r.winRateB*100}%"></span></div><div class="row space inline-note" style="margin-top:8px"><span>A ${r.winsA}</span><span>DRAW ${r.draws}</span><span>B ${r.winsB}</span></div></div></div><div class="grid two"><div class="panel"><div class="panel-head"><h3>DAMAGE BY TYPE</h3></div><div class="panel-body pending-list">${topMetricRows(r.damageByType,8,v=>Math.round(v).toLocaleString())}</div></div><div class="panel"><div class="panel-head"><h3>TOP SKILLS</h3></div><div class="panel-body pending-list">${topMetricRows(r.skillUsage)}</div></div><div class="panel"><div class="panel-head"><h3>STATUS APPLICATIONS</h3></div><div class="panel-body pending-list">${topMetricRows(r.statusApplications)}</div></div><div class="panel"><div class="panel-head"><h3>QUALITY SIGNALS</h3></div><div class="panel-body"><div class="pending-item"><span>MISSES</span><b>${r.misses}</b></div><div class="pending-item"><span>STATUS RESISTS</span><b>${r.resistedStatuses}</b></div><div class="pending-item"><span>AVG HEAL A / B</span><b>${r.avgHealingA} / ${r.avgHealingB}</b></div><div class="pending-item"><span>AVG SURVIVORS A / B</span><b>${r.avgSurvivorsA} / ${r.avgSurvivorsB}</b></div></div></div></div>`:`<div class="panel"><div class="empty">选择参数并运行。模拟器直接调用同一 BattleEngine，不维护第二套“平衡公式”。</div></div>`}</div></div>`;}

  function runSimulationFromUI(){const view=$('#view-simulation'),get=k=>$(`[data-sim="${k}"]`,view)?.value;state.simulation=NCB.runSimulation({battles:Number(get('battles'))||500,seedBase:Number(get('seedBase'))||9000,teamA:state.setup.teamA,teamB:state.setup.teamB,difficultyA:get('difficultyA')||'normal',difficultyB:get('difficultyB')||'normal',maxRounds:50});renderSimulation();}


  function parameterLibraryHtml(){
    const groups=new Map();for(const def of NCB.PARAMETER_LIST||[]){if(!groups.has(def.category))groups.set(def.category,[]);groups.get(def.category).push(def);}
    return [...groups.entries()].map(([category,defs])=>`<details class="parameter-group"><summary><b>${esc(category)}</b><span class="inline-note">${defs.length} KNOBS</span></summary><div class="definition-list">${defs.map(def=>`<div class="definition"><b>${esc(def.id)} · ${esc(def.name)}</b><br><span>${esc(def.human)}</span><br><span class="inline-note">类型 ${esc(def.kind)} · 单位 ${esc(def.unit||'-')} · 默认 ${esc(def.defaultValue)} · 范围 ${esc(def.range)}<br>结果：${esc(def.effect)}<br>AI：${esc(def.ai)}</span></div>`).join('')}</div></details>`).join('');
  }

  function renderGuide(){const view=$('#view-guide');view.innerHTML=`<div class="reference-grid"><div class="panel"><div class="panel-head"><h2>CORE MODEL</h2></div><div class="panel-body"><h3>卡牌不是内核</h3><p>Engine 只认识 <b>CombatEntity</b>、Skill、Status、Action、Event 和数值。网页把实体画成卡片只是 Presentation Adapter。同一个内核也可以接 CLI、纯文字列表或其他 UI。</p><div class="code">CombatEntity[]\n  ↓ Actions\nPriority / Speed Queue\n  ↓\nRelay Event Modifiers\n  ↓\nFormula → Accuracy → Crit → Defense/Penetration\n  ↓\nShield Replacement → HP → Trigger / Status\n  ↓\nDeterministic State + Replay</div></div></div>
    <div class="panel"><div class="panel-head"><h2>BORROW / ADAPT</h2></div><div class="panel-body"><h3>成熟系统语义优先</h3><p>确定性 Gen5 PRNG、Priority/Speed 排序和 relay-event 内核直接派生/泛化自 Pokémon Showdown。Damage Packet、复合伤害与穿透借鉴 Cataclysm-DDA；攻击参数 Event Modifier 借鉴 Wesnoth；多资源/Sustain/抗性穿透借鉴 ToME 类大型 RPG。公式 DSL 保留 math.js 风格的纯表达式写法，但语法解析不再自造轮子：运行时固定使用 Acorn 8.15.0（MIT）生成 AST，再由极小的白名单解释层执行。这样最终 ZIP 完全离线，并且 Node/浏览器共用同一解析语义。</p><p class="inline-note">Showdown pinned audit: 833d0da4431cb58bda485ba2204d6066a87e773c · MIT<br>Formula parser: Acorn 8.15.0 / offline / pure / restricted AST</p></div></div>
    <div class="panel"><div class="panel-head"><h2>FORMULA VARIABLES</h2></div><div class="panel-body"><div class="definition-list">${(NCB.FORMULA_SYMBOLS||[]).filter(x=>!['true','false','pi','e'].includes(x)).map(x=>`<div class="definition"><b>${esc(x)}</b></div>`).join('')}</div><p class="inline-note">函数：${esc((NCB.FORMULA_FUNCTIONS||[]).join(', '))}</p></div></div>
    <div class="panel"><div class="panel-head"><h2>STATUS LIBRARY</h2></div><div class="panel-body"><div class="definition-list">${Object.values(NCB.STATUS_DEFS).map(s=>`<div class="definition"><b>${esc(s.name)}</b><br><span class="inline-note">${esc(s.id)} · ${esc(s.kind)} · MAX ${s.maxStacks||1}</span></div>`).join('')}</div></div></div>
    <div class="panel"><div class="panel-head"><h2>NUMERIC PIPELINE</h2></div><div class="panel-body"><ol><li>Formula 计算基础值。</li><li>Accuracy / Evasion 判定。</li><li>Crit 与 Crit Damage。</li><li>DEF 或 RES + Penetration 计算减伤。</li><li>ModifyDamageDealt / ModifyDamageTaken relay modifiers。</li><li>Shield 先吸收，再写入 HP。</li><li>吸血、反伤、DoT/HoT、死亡与状态生命周期。</li></ol><p>所有关键阶段进入可展开的 TRACE 日志。</p></div></div>
    <div class="panel"><div class="panel-head"><h2>COMPONENT LANGUAGE</h2><span>${Object.keys(NCB.PARAMETER_CATALOG||{}).length} KNOBS</span></div><div class="panel-body"><p>内容不是角色专属代码，而是固定组件语言的组合。目前注册 <b>${Object.keys(NCB.PARAMETER_CATALOG||{}).length}</b> 个参数旋钮、<b>${Object.keys(NCB.EFFECT_COMPONENTS||{}).length}</b> 个 Effect、<b>${Object.keys(NCB.CONDITION_COMPONENTS||{}).length}</b> 个 Condition、<b>${Object.keys(NCB.TARGET_COMPONENTS||{}).length}</b> 个 Target、<b>${Object.keys(NCB.EVENT_COMPONENTS||{}).length}</b> 个 Event 插入点。</p>${parameterLibraryHtml()}</div></div>
    <div class="panel"><div class="panel-head"><h2>PLUGIN SURFACES</h2></div><div class="panel-body"><p><b>Effect:</b> ${esc(Object.keys(NCB.EFFECT_COMPONENTS||{}).join(', '))}</p><p><b>Condition:</b> ${esc(Object.keys(NCB.CONDITION_COMPONENTS||{}).join(', '))}</p><p><b>Target:</b> ${esc(Object.keys(NCB.TARGET_COMPONENTS||{}).join(', '))}</p><p><b>Event:</b> ${esc(Object.keys(NCB.EVENT_COMPONENTS||{}).join(', '))}</p><p class="inline-note">只有出现全新的规则原语时才注册新插件；普通新角色/新技能只调整现有参数和组件。</p></div></div>
    <div class="panel"><div class="panel-head"><h2>DEFAULT CONTENT</h2></div><div class="panel-body"><p><b>${Object.keys(NCB.UNIT_DEFS).length}</b> 个实体模板，<b>${Object.keys(NCB.SKILL_DEFS).length}</b> 个技能，<b>${Object.keys(NCB.STATUS_DEFS).length}</b> 个状态。每队支持 1–6 个同时 active 实体，默认 4v4，允许人数不对称。</p><p>这些只是通用参数与组件的示例组合，不是引擎上限。完整人类说明见 <code>docs/NUMERIC-COMPONENT-CATALOG.md</code>，AI 读取 <code>docs/numeric-component-catalog.json</code>。</p></div></div></div>`;}

  function setTab(tab){state.tab=tab;$$('.tab').forEach(b=>b.classList.toggle('is-active',b.dataset.tab===tab));$$('.view').forEach(v=>v.classList.toggle('is-active',v.id===`view-${tab}`));if(tab==='battle')renderBattle();if(tab==='editor')renderEditor();if(tab==='simulation')renderSimulation();if(tab==='guide')renderGuide();}

  document.addEventListener('click',event=>{
    const tab=event.target.closest('[data-tab]');if(tab){setTab(tab.dataset.tab);return;}
    const editorUnit=event.target.closest('[data-editor-unit]');if(editorUnit){state.editorUnitId=editorUnit.dataset.editorUnit;renderEditor();return;}
    const card=event.target.closest('[data-entity-id]');if(card&&state.tab==='battle'){
      const id=card.dataset.entityId,e=state.engine.entity(id);if(e.hp<=0)return;
      if(state.selectedSkillId&&state.selectedActorId){const targets=state.engine.getValidTargets(state.selectedActorId,state.selectedSkillId);if(targets.some(t=>t.id===id)){queueAction(state.selectedActorId,state.selectedSkillId,id);return;}}
      if(e.teamId==='A'&&!state.pending.has(e.id)){state.selectedActorId=e.id;state.selectedSkillId=null;renderBattle();}return;
    }
    const skill=event.target.closest('[data-skill-id]');if(skill){handleSkill(skill.dataset.skillId);return;}
    const remove=event.target.closest('[data-remove-action]');if(remove){state.pending.delete(remove.dataset.removeAction);ensureActor();renderBattle();return;}
    const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
    if(action==='new-battle'){state.setup.seedNumber=Number($('[data-setup="seedNumber"]')?.value)||state.setup.seedNumber;state.setup.difficultyB=$('[data-setup="difficultyB"]')?.value||'normal';createCurrentBattle();}
    if(action==='restart')createCurrentBattle(state.engine.config.seed);
    if(action==='next-seed'){state.setup.seedNumber++;createCurrentBattle();}
    if(action==='auto-plan')autoPlanPlayer();
    if(action==='resolve-round')resolveRound();
    if(action==='auto-finish')autoFinish();
    if(action==='export-replay')downloadJson(`numerical-replay-${Date.now()}.json`,state.engine.exportReplay());
    if(action==='clear-log-view'){const log=$('.battle-log');if(log)log.scrollTop=0;}
    if(action==='save-content')saveContentFromEditor();
    if(action==='export-content')downloadJson('numerical-content.json',{version:1,units:NCB.UNIT_DEFS,skills:NCB.SKILL_DEFS,statuses:NCB.STATUS_DEFS});
    if(action==='reset-content'){if(confirm('恢复全部内置数值？')){replaceObject(NCB.UNIT_DEFS,BUILTIN.units);replaceObject(NCB.SKILL_DEFS,BUILTIN.skills);replaceObject(NCB.STATUS_DEFS,BUILTIN.statuses);storage.remove(STORAGE_CONTENT);renderEditor();createCurrentBattle();}}
    if(action==='run-simulation')runSimulationFromUI();
  });

  document.addEventListener('change',event=>{
    if(event.target.matches('[data-team-size]')){const team=event.target.dataset.teamSize;state.setup[`size${team}`]=Number(event.target.value);state.setup=normalizeSetup(state.setup);saveSetup();renderBattle();return;}
    if(event.target.matches('[data-team-slot]')){const [team,index]=event.target.dataset.teamSlot.split(':');state.setup[`team${team}`][Number(index)]=event.target.value;saveSetup();return;}
    if(event.target.matches('[data-log-filter]')){state.logFilter=event.target.value;renderBattle();return;}
    if(event.target.matches('[data-status-select]')){state.editorStatusId=event.target.value;renderEditor();return;}
    if(event.target.id==='replay-file'){const file=event.target.files[0];if(file)file.text().then(text=>{try{const data=JSON.parse(text);applyReplay(data);}catch(e){alert(`Replay 无效: ${e.message}`);}});}
    if(event.target.id==='content-file'){const file=event.target.files[0];if(file)file.text().then(text=>{try{importContent(JSON.parse(text));}catch(e){alert(`内容包无效: ${e.message}`);}});}
  });

  document.addEventListener('input',event=>{
    if(event.target.matches('[data-skill-field="formula"]')){const box=event.target.closest('[data-skill-editor]'),unit=NCB.UNIT_DEFS[state.editorUnitId],result=formulaResult(event.target.value,unit),status=$('[data-formula-state]',box);status.textContent=result.text;status.className=`formula-state ${result.ok?'ok':'bad'}`;}
  });

  function updateHeader(){const formula=$('#formula-state');if(formula){const info=NCB.formulaEngineInfo?.()||{};formula.textContent=info.offline?`${(info.name||'FORMULA').toUpperCase()} ${info.version||''} / OFFLINE`.replace(/\s+/g,' ').trim():'FORMULA';}}
  function qaSelfTest(){try{const engine=NCB.createBattle({seed:'gen5,77,88,99,111',teamA:['vanguard','ranger','medic','duelist'],teamB:['warden','pyromancer','alchemist','assassin']});for(let i=0;i<2;i++)engine.resolveRound([...NCB.planAI(engine,'A','hard'),...NCB.planAI(engine,'B','normal')]);const replay=NCB.replayBattle(engine.exportReplay());const same=JSON.stringify(replay.serializableSnapshot())===JSON.stringify(engine.serializableSnapshot());const sim=NCB.runSimulation({battles:10,seedBase:500,teamA:['vanguard','ranger'],teamB:['warden','assassin'],difficultyA:'normal',difficultyB:'normal',maxRounds:25});const ok=same&&sim.battles===10&&engine.log.length>0;document.body.dataset.qaPass=String(ok);const marker=document.createElement('div');marker.id='qa-result';marker.textContent=ok?'QA_PASS':'QA_FAIL';marker.style.cssText='position:fixed;right:8px;bottom:8px;padding:4px 6px;background:#111;color:#fff;font:10px monospace;z-index:9999';document.body.appendChild(marker);}catch(e){document.body.dataset.qaPass='false';console.error(e);}}

  createCurrentBattle();renderEditor();renderSimulation();renderGuide();updateHeader();setTab('battle');
  if(new URLSearchParams(location.search).get('qa')==='1')setTimeout(qaSelfTest,50);
})(window);
