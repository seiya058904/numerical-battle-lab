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
    {key:'RES',zh:'抗性',abbr:'RES'},
    {key:'SPD',zh:'速度',abbr:'SPD'},
    {key:'CRIT',zh:'暴击',abbr:'CRIT'},
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
  function artPlaceholder(rarityId,seed){
    const id=NCB.toV2RarityId?.(rarityId)||'C';
    const s=String(seed||'');let h=2166136261>>>0;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    const hue=(h%360);
    const coll=NCB.RARITY_V2_RPI&&NCB.RARITY_V2_RPI[id]>=218;
    const glyph=coll?'◆':'▲';
    return `<svg class="card-art" viewBox="0 0 120 120" role="img" aria-label="卡图占位">
      <defs><radialGradient id="artg${id}" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stop-color="hsl(${hue} 70% 78%)"/>
        <stop offset="100%" stop-color="hsl(${(hue+40)%360} 55% 45%)"/>
      </radialGradient></defs>
      <rect width="120" height="120" rx="10" fill="url(#artg${id})"/>
      <text x="60" y="72" text-anchor="middle" font-size="40" fill="rgba(255,255,255,.9)" font-family="sans-serif">${glyph}</text>
      <text x="60" y="104" text-anchor="middle" font-size="12" fill="rgba(255,255,255,.75)">${esc(NCB.V2_RARITY_DISPLAY?.[id]||id)}</text>
    </svg>`;
  }

  // BattlePower display number.
  function battlePowerOf(card){
    try{const bp=NCB.battlePower?.(card);return bp?Math.round(bp.power):null;}catch(_){return null;}
  }

  // Chinese skill description via describeSkill (unified, data-driven).
  function describe(skill){try{return NCB.describeSkill?.(skill)||'';}catch(_){return '';}}

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
    const skills=card.skills||[];
    if(!skills.length)return'';
    return `<div class="card-skills"><div class="card-skills-title">技能</div>${skills.map(s=>{
      const desc=describe(s);
      const free=s.cost==null||s.cost===0||s.cost==='FREE';
      const costHtml=free?'<span class="skill-free">无消耗</span>':`<span class="skill-cost">消耗 ${esc(s.cost)}</span>`;
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
    const role=ROLE_ZH[card.archetype]||card.archetype||'';
    const st=card.stats||{};
    const hp=Math.round(Number(st.MAX_HP)||0);
    const atk=Math.round(Number(st.ATK)||0);
    const def=Math.round(Number(st.DEF)||0);
    const res=Math.round(Number(st.RES)||0);
    const spd=Math.round(Number(st.SPD)||0);
    const crit=Math.round(Number(st.CRIT)||0);
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
          ${bp?`<span class="card-power">战力 ${bp}</span>`:''}
          <span class="card-role">${esc(role)}</span>
        </div>
        <div class="card-stats">${coreStatChips(card)}</div>
        ${detailStatsHtml(card)}
        ${skillListHtml(card)}
        ${tagListHtml(card)}
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
      <div class="card-tile-meta">Lv.${card.level??100} ${bp?'· 战力 '+bp:''} ${esc(ROLE_ZH[card.archetype]||card.archetype||'')}</div>
      <div class="card-tile-stats">生命 ${Math.round(Number(st.MAX_HP)||0)} · 攻击 ${Math.round(Number(st.ATK)||0)}</div>
    </div>`;
  }

  NCB.CORE_STATS=CORE_STATS;
  NCB.DETAIL_STATS=DETAIL_STATS;
  NCB.ROLE_ZH=ROLE_ZH;
  NCB.RARITY_UI=RARITY_UI;
  NCB.rarityUI=rarityUI;
  NCB.artPlaceholder=artPlaceholder;
  NCB.battlePowerOf=battlePowerOf;
  NCB.renderCard=renderCard;
  NCB.renderCompactCard=renderCompactCard;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
