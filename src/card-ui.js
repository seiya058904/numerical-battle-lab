(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  // ---------------------------------------------------------------------------
  // Card Presentation Adapter (spec 8-10): the engine only knows CombatEntity /
  // Skill / Status. This module renders a GENERATED CARD as a player-facing 卡牌
  // (art placeholder, rarity frame, 战力, 定位, 6 core stats, skill names, tags),
  // WITHOUT any external image assets and WITHOUT exposing internal ids by default.
  //
  // It is a display adapter only: it never mutates the card, never feeds the
  // BattleEngine, and never reads rarity/level as a damage multiplier.
  // ---------------------------------------------------------------------------

  const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  // Chinese short labels for the six core stats (spec: HP/ATK/DEF/RES/SPD must
  // show 中文 + 缩写).
  const CORE_STATS=[
    {key:'MAX_HP',zh:'生命',abbr:'HP'},
    {key:'ATK',zh:'攻击',abbr:'ATK'},
    {key:'DEF',zh:'防御',abbr:'DEF'},
    {key:'SPD',zh:'速度',abbr:'SPD'},
  ];
  // Secondary stat labels for the expandable 详细数值 panel (spec 9).
  const DETAIL_STATS=[
    {key:'ACC',zh:'命中'},
    {key:'EVA',zh:'闪避'},
    {key:'CRIT_DMG',zh:'暴伤'},
    {key:'PEN',zh:'穿透'},
    {key:'RES_PEN',zh:'抗穿'},
    {key:'HEAL_POWER',zh:'治疗强度'},
    {key:'LIFESTEAL',zh:'吸血'},
    {key:'RESOURCE_GAIN',zh:'资源获取'},
  ];

  // 定位 (role) Chinese labels for the 7 archetypes.
  const ROLE_ZH={
    Balanced:'均衡',Tank:'坦克',Bruiser:'斗士',Assassin:'刺客',
    Mage:'法师',Support:'辅助',Controller:'控制',
  };

  // Rarity visual config (spec 33): distinct card frames; collectors clearly
  // different by border style + badge text + small graphic (not color-only, so
  // color-blind players can still tell them apart).
  const RARITY_UI={
    C:{frame:'rarity-c',badge:'C',name:'普通'},
    C_PLUS:{frame:'rarity-cplus',badge:'C+',name:'普通+'},
    B:{frame:'rarity-b',badge:'B',name:'精良'},
    B_PLUS:{frame:'rarity-bplus',badge:'B+',name:'精良+'},
    A:{frame:'rarity-a',badge:'A',name:'稀有'},
    A_PLUS:{frame:'rarity-aplus',badge:'A+',name:'稀有+'},
    S:{frame:'rarity-s',badge:'S',name:'史诗'},
    SS:{frame:'rarity-ss',badge:'SS',name:'传说'},
    SSS:{frame:'rarity-sss',badge:'SSS',name:'神话'},
    SSS_COLLECTOR:{frame:'rarity-sss-coll',badge:'SSS 典藏版',name:'神话典藏',collector:true},
    XS:{frame:'rarity-xs',badge:'XS',name:'幻神'},
    XS_COLLECTOR:{frame:'rarity-xs-coll',badge:'XS 典藏版',name:'幻神典藏',collector:true},
  };
  function rarityUI(rarity){return RARITY_UI[NCB.toV2RarityId?.(rarity)||rarity]||RARITY_UI.C;}

  // SVG placeholder "卡图" (art area). Pure inline SVG so there are no image
  // files and no external assets. Design varies by rarity frame / collector.
  // The rarity is REFLECTED (not hardcoded): a small black tier tag + on higher
  // tiers extra inner strokes, still strictly black/grey — no color.
  function artPlaceholder(rarityId,seed){
    let h=0;for(const c of String(seed||''))h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;
    const ears=h%2?'<path d="M30 48 22 18 49 35M72 35 99 18 91 49"/>':'<path d="M30 47 15 36 34 28M84 28 105 36 90 48"/>';
    const tier=(NCB.RARITY_V2_ORDER||[]).indexOf(NCB.toV2RarityId?.(rarityId)||rarityId);
    const tierLabel=tier>=0?tier+1:0; // 1..12 ranking
    const inner=tier>=9?'<path d="M52 40h16M52 47h10" stroke="#595959" stroke-width="3"/>':'';
    return `<svg class="card-art" viewBox="0 0 120 110" role="img" aria-label="黑白战斗角色 稀有度阶 ${tierLabel}"><g fill="#fff" stroke="#171717" stroke-width="4" stroke-linejoin="round">${ears}<ellipse cx="60" cy="65" rx="37" ry="32"/><path d="M35 91 29 102 49 102M73 102 91 102 86 91"/><path d="M47 77 Q60 ${h%3?90:71} 74 77" fill="none"/></g><circle cx="46" cy="59" r="5"/><circle cx="75" cy="59" r="5"/>${h%3===0?'<path d="m37 47 17 4m12 0 18-4" stroke="#171717" stroke-width="4"/>':''}${inner}<text x="10" y="18" fill="#171717" font-size="12" font-family="monospace">${tierLabel||''}</text></svg>`;
  }

  // BattlePower display number (v2 for v4 cards, legacy model otherwise).
  // Both are display/diagnostic only — never read by the engine.
  function battlePowerOf(card){
    try{
      if(card?.generatorVersion===4&&NCB.battlePowerV2){const r=NCB.battlePowerV2(card);return r&&Number.isFinite(r.power)?Math.round(r.power):null;}
      const bp=NCB.battlePower?.(card);return bp&&Number.isFinite(bp.power)?Math.round(bp.power):null;
    }catch(_){return null;}
  }
  // "战力 12,840" — thousands-separated, integer only (no fractional/winrate).
  function formatBattlePower(power){
    if(power==null||!Number.isFinite(power))return '';
    return '战力 ' + Math.round(power).toLocaleString('en-US');
  }

  // v1.2.1 (audit §8): BattlePower is a 1v1 ordering indicator, NOT a precise
  // win-probability predictor. The UI therefore does NOT show a card-vs-card
  // "预计胜率 64%" percentage. When a relative comparison is needed we show one of
  // three qualitative labels (战力较高 / 战力接近 / 战力较低). A precise percentage
  // would require a separately calibrated WinProbabilityModel (scripts/
  // power-calibration.js §12) whose calibration-error gate is not yet met, so we
  // deliberately avoid overclaiming.
  function bpRelation(powerA,powerB){
    if(powerA==null||powerB==null||powerA<=0||powerB<=0)return '';
    const ratio=Math.max(powerA,powerB)/Math.min(powerA,powerB);
    if(ratio<=1.03)return'战力接近';
    return powerA>powerB?'战力较高':'战力较低';
  }
  // Coarse qualitative comparison of two cards (no precise percentage).
  function compareCards(a,b){
    return bpRelation(battlePowerOf(a),battlePowerOf(b));
  }

  // Chinese skill description via describeSkill (unified, data-driven).
  const ACTION_WORDS={damage:'造成伤害',heal:'恢复生命',shield:'获得护盾',ward:'抵挡特定类型伤害',status:'施加状态',toggleStatus:'切换战意',consumeStatus:'消耗状态层数',cleanse:'净化负面状态',dispel:'驱散增益',resource:'调整资源',gain:'积蓄资源',convertResource:'转换资源',cooldownReduce:'缩短行动冷却',selfDamagePct:'牺牲生命',emitEvent:'触发事件能力'};
  function describeAction(action,statusDefs=NCB.STATUS_DEFS){
    const words=[];
    const walk=effects=>{for(const e of effects||[]){
      if(e.type==='conditional'){words.push(({hpPctBelow:'生命较低时强化',targetHpPctBelow:'针对虚弱目标',resourceAtLeast:'蓄能后强化',targetHasStatus:'利用目标已有状态',missingStatus:'未强化时发动'})[e.condition?.type]||'满足条件时发动');walk(e.then);walk(e.else);}
      else if(e.type==='repeat'){words.push('连续发动');walk(e.effects);}
      else {let word=ACTION_WORDS[e.type]||'影响战场';if(e.type==='status')word=(e.effectTarget==='actor'?'自身获得':'施加')+(statusDefs?.[e.status]?.name||'战斗状态');if(!words.includes(word))words.push(word);}
    }};walk(action.effects);
    return words.slice(0,3).join('，')+'。';
  }
  function presentCard(card){
    const actions=card.actions||card.skills||[],st=card.stats||{};const defs={...NCB.STATUS_DEFS,...Object.fromEntries((card.statuses||[]).map(x=>[x.id,x]))};
    const kinds=new Set(actions.map(a=>a.kind));
    const style=kinds.has('heal')?'擅长恢复与持久作战':kinds.has('status')?'善于利用状态改变战局':'依靠行动组合寻找胜机';
    return {name:card.displayName||card.name,summary:style,actions:actions.map(a=>({name:a.name,description:describeAction(a,defs)})),stats:st};
  }
  function describe(skill){return describeAction(skill);}

  // Core stat chips (中文+缩写).
  function coreStatChips(card){
    const st=card.stats||{};
    return CORE_STATS.map(({key,zh,abbr})=>{
      const v=st[key];
      if(v===undefined||v===null)return '';
      const unit=(key==='CRIT')?'%':'';
      return `<span class="card-stat"><b>${zh}</b><i>${abbr}</i><em>${Math.round(Number(v))}${unit}</em></span>`;
    }).join('');
  }
  // Expandable 详细数值 (secondary stats) — collapsed by default.
  function detailStatsHtml(card){
    const st=card.stats||{};
    const rows=DETAIL_STATS.map(({key,zh})=>{
      const v=st[key];
      if(v===undefined||v===null)return '';
      return `<div class="detail-row"><span>${zh}</span><b>${Math.round(Number(v)*10)/10}${key==='ACC'||key==='EVA'||key==='CRIT_DMG'?'%':''}</b></div>`;
    }).filter(Boolean).join('');
    return rows?`<details class="card-detail"><summary>详细数值</summary><div class="detail-grid">${rows}</div></details>`:'';
  }

  // Skill list: name + unified Chinese description (spec 7).
  function skillListHtml(card){
    const skills=card.actions||card.skills||[];
    if(!skills.length)return'';
    return `<div class="card-skills"><div class="card-skills-title">行动</div>${skills.map(s=>{
      const desc=describeAction(s,{...NCB.STATUS_DEFS,...Object.fromEntries((card.statuses||[]).map(x=>[x.id,x]))});
      const costs=[...(Number(s.cost)>0?[{resource:'ENERGY',amount:s.cost}]:[]),...(s.costs||[])];const free=!costs.length;
      const costHtml=free?'<span class="skill-free">无消耗</span>':`<span class="skill-cost">消耗 ${esc(costs.map(c=>`${({ENERGY:'能量',HP:'生命',RAGE:'怒气',SOUL:'魂力',CHRONO:'时能'})[c.resource]||c.resource} ${c.amount}`).join(' / '))}</span>`;
      const cd=s.cooldown?`<span class="skill-cd">冷却 ${s.cooldown}</span>`:'';
      return `<div class="card-skill"><div class="card-skill-head"><b>${esc(s.name)}</b><span class="card-skill-meta">${costHtml}${cd}</span></div>${desc?`<p class="card-skill-desc">${esc(desc)}</p>`:''}</div>`;
    }).join('')}</div>`;
  }

  // Tags (rarity/archetype tags), shown in Chinese where possible.
  function tagListHtml(card){
    const tags=(card.tags||[]).filter(t=>!String(t).startsWith('rarity:')&&!String(t).startsWith('archetype:'));
    const role=ROLE_ZH[card.archetype]||card.archetype||'';
    const parts=[];
    if(role)parts.push(role);
    for(const t of tags)parts.push(t);
    return parts.length?`<div class="card-tags">${parts.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>`:'';
  }

  // ---- Public render helpers ----

  // Full player-facing card. `opts.showId` defaults to false (hide internal id);
  // advanced/lab contexts may set it true.
  function renderCard(card,opts={}){
    if(!card)return'';
    const ui=rarityUI(card.rarity);
    const bp=battlePowerOf(card);
    const lv=card.level??100;
    const st=card.stats||{};
    const hp=Math.round(Number(st.MAX_HP)||0);
    const atk=Math.round(Number(st.ATK)||0);
    const def=Math.round(Number(st.DEF)||0);
    const res=Math.round(Number(st.RES)||0);
    const spd=Math.round(Number(st.SPD)||0);
    const crit=Math.round(Number(st.CRIT)||0);
    // v4: the card's 特点 come from the Behavior Analyzer (post-hoc), never a class.
    const beh=(NCB.analyzeBehavior&&!card._beh)?(card._beh=NCB.analyzeBehavior(card)):(card._beh||null);
    const behLine=beh&&beh.tags&&beh.tags.length?`<span class="card-beh">特点 ${beh.tags.map(t=>`<b>${esc(t)}</b>`).join(' · ')}</span>`:'';
    return `<article class="card ${ui.frame} ${ui.collector?'is-collector':''}" data-card-id="${esc(card.id)}">
      <div class="card-frame-glow"></div>
      ${artPlaceholder(card.rarity,card.seed)}
      <div class="card-body">
        <div class="card-headline">
          <div class="card-name">${esc(card.displayName||card.name||'未命名')}</div>
          ${opts.showId?`<div class="card-id">${esc(card.id)}</div>`:''}
          <span class="rarity-badge">${esc(ui.badge)}</span>
          ${ui.collector?'<span class="collector-mark" aria-label="典藏版">★</span>':''}
        </div>
        <div class="card-meta-line">
          <span class="card-lv">Lv.${lv}</span>
          ${bp?`<span class="card-power">${esc(formatBattlePower(bp))}</span>`:''}
        </div>
        <div class="card-stats">${coreStatChips(card)}</div>
        ${behLine?`<p class="card-summary card-summary-beh">${behLine}</p>`:`<p class="card-summary">${esc(presentCard(card).summary)}</p>`}
        ${skillListHtml(card)}

      </div>
    </article>`;
  }

  // A compact card tile (used in the card library list / multi-battle).
  function renderCompactCard(card){
    if(!card)return'';
    const ui=rarityUI(card.rarity);
    const bp=battlePowerOf(card);
    const st=card.stats||{};
    return `<div class="card-tile ${ui.frame} ${ui.collector?'is-collector':''}" data-card-id="${esc(card.id)}">
      <span class="rarity-badge">${esc(ui.badge)}</span>
      ${ui.collector?'<span class="collector-mark">★</span>':''}
      <div class="card-tile-name">${esc(card.displayName||card.name||'未命名')}</div>
      <div class="card-tile-meta">Lv.${card.level??100} ${bp?'· '+esc(formatBattlePower(bp)):''} ${esc(ROLE_ZH[card.archetype]||card.archetype||'')}</div>
      <div class="card-tile-stats">生命 ${Math.round(Number(st.MAX_HP)||0)} · 攻击 ${Math.round(Number(st.ATK)||0)}</div>
    </div>`;
  }

  NCB.describeAction=describeAction;NCB.presentCard=presentCard;
  NCB.CORE_STATS=CORE_STATS;
  NCB.DETAIL_STATS=DETAIL_STATS;
  NCB.ROLE_ZH=ROLE_ZH;
  NCB.RARITY_UI=RARITY_UI;
  NCB.rarityUI=rarityUI;
  NCB.artPlaceholder=artPlaceholder;
  NCB.battlePowerOf=battlePowerOf;
  NCB.formatBattlePower=formatBattlePower;
  NCB.bpRelation=bpRelation;
  NCB.compareCards=compareCards;
  NCB.renderCard=renderCard;
  NCB.renderCompactCard=renderCompactCard;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
