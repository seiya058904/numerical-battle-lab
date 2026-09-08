(function(root){
  'use strict';
  const N=root.NCB,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const metadata=new WeakMap();
  function cardInfo(card){
    const signature=JSON.stringify([card.stats,card.actions||card.skills,card.statuses,card.triggers,card.displayName,card.generationBudget]);
    const old=metadata.get(card);if(old?.signature===signature)return old;
    const behavior=N.analyzeBehavior(card),power=N.battlePowerOf(card);
    const info={signature,behavior,power,search:[card.displayName,card.name,behavior.summary,...(behavior.allTags||behavior.tags),...(card.actions||card.skills||[]).map(a=>a.name)].join(' ').toLowerCase()};
    metadata.set(card,info);return info;
  }
  function filterCards(cards,f={}){
    const rows=cards.filter(c=>{
      if(f.rarity&&c.rarity!==f.rarity)return false;
      if(f.min!==''&&f.min!=null&&c.level<Number(f.min))return false;
      if(f.max!==''&&f.max!=null&&c.level>Number(f.max))return false;
      const i=cardInfo(c);
      return (!f.tag||(i.behavior.allTags||i.behavior.tags).includes(f.tag))&&(!f.search||i.search.includes(f.search.trim().toLowerCase()));
    });
    const [key,dir]=(f.sort||'recommended').split('-'),sign=dir==='desc'?-1:1;
    if(key!=='recommended')rows.sort((a,b)=>sign*((key==='power'?cardInfo(a).power:key==='level'?a.level:N.RARITY_V2_ORDER.indexOf(a.rarity))-(key==='power'?cardInfo(b).power:key==='level'?b.level:N.RARITY_V2_ORDER.indexOf(b.rarity))));
    return rows;
  }
  function tagEvidence(card,tag){
    const s=card.stats||{};
    const E=[];
    const f=(k,fmt)=>s[k]!=null?`${k} = ${fmt?fmt(s[k]):s[k]}`:null;
    const add=(x)=>x&&E.push(x);
    if(tag==='高波动')add(f('VOLATILITY',v=>v>=1.6?v.toFixed(2)+'（≥1.6）':v.toFixed(2)));
    if(tag==='稳定')add(f('VOLATILITY',v=>v<=0.6?v.toFixed(2)+'（≤0.6）':v.toFixed(2)));
    if(tag==='赌徒型')add(f('LUCK'));
    if(tag==='后期成长'){add(f('RAMP_RATE',v=>v.toFixed(3)));add(f('RAMP_START'));}
    if(tag==='易疲劳'){add(f('FATIGUE_RATE',v=>v.toFixed(3)));add(f('FATIGUE_START'));}
    if(tag==='高耐力')add(f('ENDURANCE'));
    if(tag==='高爆发'){add(f('ATK'));}
    if(tag==='低爆发')add(f('ATK'));
    if(tag==='吸血')add(f('LIFESTEAL',v=>v+'%'));
    if(tag==='穿透')add(f('PEN',v=>v+'%'));
    if(tag==='高速')add(f('SPD'));
    if(tag==='慢速')add(f('SPD'));
    if(tag==='高暴击')add(f('CRIT',v=>v+'%'));
    if(tag==='高回复'||tag==='护盾型'){const k=tag==='高回复'?'HEAL_POWER':'DEF';add(f(k));}
    if(tag==='DoT'||tag==='状态压制'||tag==='状态引爆'){add((card.statuses||[]).length?'状态 '+card.statuses.map(x=>x.id.split(':').pop()).join('、'):null);}
    if(tag==='资源循环'){add(f('ENERGY_REGEN'));}
    return E.length?`<span class="tag-evidence">因为：${esc(E.join(' · '))}</span>`:'';
  }
  function selectionCard(card){
    const i=cardInfo(card),r=N.rarityUI(card.rarity);
    return `<article class="selection-card ${r.frame}" data-card-id="${esc(card.id)}"><div class="selection-head"><h3>${esc(card.displayName||card.name)}</h3><span class="rarity-badge">${esc(r.badge)}</span></div><div class="selection-meta">Lv.${card.level} · ${esc(N.formatBattlePower(i.power))}</div>${N.artPlaceholder(card.rarity,card.seed)}<div class="selection-stats">${N.CORE_STATS.map(x=>`<span>${x.abbr} <b>${Math.round(card.stats[x.key]||0)}</b></span>`).join('')}</div><p class="card-tags">${i.behavior.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</p><p class="selection-summary">${esc(i.behavior.summary)}</p><p class="selection-actions">${(card.actions||card.skills||[]).map(a=>esc(a.name)).join(' · ')}</p><button class="btn" data-browser-detail="${esc(card.id)}">查看详情</button></article>`;
  }
  class CardBrowser{
    constructor(container,cards,options={}){this.container=container;this.cards=cards;this.options=options;this.filters={};this.limit=12;this.render();}
    render(){
      const tags=[...new Set(this.cards.flatMap(c=>cardInfo(c).behavior.allTags||cardInfo(c).behavior.tags))];
      this.container.innerHTML=`<div class="card-browser"><div class="browser-heading"><h2>${esc(this.options.title||'卡牌库')}</h2>${this.options.onClose?'<button class="btn" data-browser-close>返回</button>':''}</div><div class="card-filters"><label class="search-field">搜索卡牌 / 特点 / 行动<input type="search" data-filter="search" placeholder="例如：吸血、后期、侵蚀"></label><div class="rarity-filters" role="group" aria-label="稀有度">${['',...N.RARITY_V2_ORDER].map(r=>`<button class="btn small" data-rarity="${r}">${r?esc(N.rarityUI(r).badge):'全部'}</button>`).join('')}</div><div class="filter-row"><label>等级区间<select data-level-bucket><option value="">全部等级</option>${Array.from({length:9},(_,i)=>10+i*10).map(n=>`<option value="${n}-${n+9}">${n}–${n+9}</option>`).join('')}<option value="100-100">100</option></select></label><label>排序<select data-filter="sort">${[['recommended','推荐'],['power-desc','战力：高→低'],['power-asc','战力：低→高'],['level-desc','等级：高→低'],['level-asc','等级：低→高'],['rarity-desc','稀有度：高→低'],['rarity-asc','稀有度：低→高']].map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label></div><details><summary>自定等级范围</summary><div class="filter-row"><label>最低等级<input type="number" min="1" max="100" data-filter="min"></label><label>最高等级<input type="number" min="1" max="100" data-filter="max"></label></div></details><div class="behavior-filters">${tags.slice(0,8).map(t=>`<button class="btn small" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}<details><summary>更多特点</summary>${tags.slice(8).map(t=>`<button class="btn small" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</details></div><div class="active-filters"></div></div><div class="browser-results"></div></div>`;
      this.container.oninput=e=>{const key=e.target.dataset.filter;if(key){this.filters[key]=e.target.value;this.limit=12;this.results();}};
      this.container.onchange=e=>{if(e.target.hasAttribute('data-level-bucket')){const [min,max]=(e.target.value||'-').split('-');Object.assign(this.filters,{min,max});for(const k of ['min','max'])this.container.querySelector(`[data-filter="${k}"]`).value=this.filters[k]||'';this.limit=12;this.results();}};
      this.container.onclick=e=>{
        const b=e.target.closest('button');if(!b)return;
        if(b.hasAttribute('data-browser-close'))return this.options.onClose?.();
        if(b.hasAttribute('data-rarity')){this.filters.rarity=b.dataset.rarity;this.limit=12;this.results();}
        if(b.hasAttribute('data-tag')){this.filters.tag=this.filters.tag===b.dataset.tag?'':b.dataset.tag;this.limit=12;this.results();}
        if(b.hasAttribute('data-clear-filter')){const k=b.dataset.clearFilter;if(k==='all')this.filters={};else delete this.filters[k];this.limit=12;this.render();this.restoreControls();this.results();}
        if(b.hasAttribute('data-browser-more')){this.limit+=12;this.results();}
        if(b.hasAttribute('data-browser-random')){const rows=filterCards(this.cards,this.filters);if(rows.length){const r=new N.Gen5PRNG(N.deriveSeed(Date.now()));this.options.onSelect?.(rows[r.random(rows.length)]);}}
        if(b.dataset.browserDetail)this.detail(this.cards.find(c=>c.id===b.dataset.browserDetail));
        if(b.dataset.browserSelect)this.options.onSelect?.(this.cards.find(c=>c.id===b.dataset.browserSelect));
      };
      this.results();
    }
    restoreControls(){for(const [k,v] of Object.entries(this.filters)){const input=this.container.querySelector(`[data-filter="${k}"]`);if(input)input.value=v;}}
    results(){
      const rows=filterCards(this.cards,this.filters);this.visibleCards=rows.slice(0,this.limit);
      this.container.querySelector('.active-filters').innerHTML=`${Object.entries(this.filters).filter(([k,v])=>v!==''&&v!=null&&k!=='sort').map(([k,v])=>`<button class="filter-token" data-clear-filter="${k}">${esc(k==='rarity'?N.rarityUI(v).badge:k==='min'?'最低 Lv.'+v:k==='max'?'最高 Lv.'+v:v)} ×</button>`).join('')}<button class="btn small ghost" data-clear-filter="all">清除全部</button><b class="result-count">找到 ${rows.length} 张</b>`;
      for(const b of this.container.querySelectorAll('[data-rarity]'))b.classList.toggle('is-active',b.dataset.rarity===(this.filters.rarity||''));
      for(const b of this.container.querySelectorAll('[data-tag]'))b.classList.toggle('is-active',b.dataset.tag===this.filters.tag);
      this.container.querySelector('.browser-results').innerHTML=`${this.options.onSelect?`<button class="btn random-pick" data-browser-random ${rows.length?'':'disabled'}>随机一张</button>`:''}<div class="selection-grid">${this.visibleCards.map(c=>`<div class="selection-wrap">${selectionCard(c)}${this.options.onSelect?`<button class="btn primary select-card" data-browser-select="${esc(c.id)}">${esc(this.options.selectLabel||'选择这张卡')}</button>`:''}</div>`).join('')}</div>${!rows.length?'<p class="empty">没有符合条件的卡牌，试试清除筛选。</p>':''}${rows.length>this.limit?'<button class="btn load-more" data-browser-more>再加载 12 张</button>':''}`;
    }
    detail(card){
      if(!card)return;const previousScroll=this.container.scrollTop;
      const statRows=Object.entries(card.stats||{}).map(([k,v])=>`<div class="detail-row"><button class="detail-stat" data-knowledge="${esc(k)}"><span>${esc(k)}</span><b>${esc(v)}</b><i aria-label="查看说明">ⓘ</i></button></div>`).join('');
      this.container.innerHTML=`<div class="browser-detail"><button class="btn" data-detail-back>返回卡牌</button>${N.renderCard(card)}<p>${esc(cardInfo(card).behavior.summary)}</p><details><summary>详细数值 <small>（点击字段查看说明）</small></summary><div class="detail-grid">${statRows}</div></details><details><summary>为什么它有这些特点</summary><div class="behavior-evidence">${(cardInfo(card).behavior.tags||[]).map(t=>`<div class="behavior-evidence-row"><b>${esc(t)}</b>${tagEvidence(card,t)}</div>`).join('')}</div></details><details><summary>高级：行动公式</summary><pre>${esc(JSON.stringify(card.actions||card.skills,null,2))}</pre></details><div class="detail-footer">${this.options.onSelect?`<button class="btn primary" data-detail-select>${esc(this.options.selectLabel||'立即对战')}</button>`:''}<button class="btn" data-detail-copy>复制</button>${this.options.canEdit?.(card)?'<button class="btn" data-detail-edit>编辑</button><button class="btn" data-detail-delete>删除</button>':''}</div></div>`;
      this.container.scrollTop=0;
      this.container.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-detail-back')){this.render();this.restoreControls();this.results();this.container.scrollTop=previousScroll;}if(b.hasAttribute('data-detail-select'))this.options.onSelect?.(card);if(b.hasAttribute('data-detail-copy'))this.options.onCopy?.(card);if(b.hasAttribute('data-detail-edit'))this.options.onEdit?.(card);if(b.hasAttribute('data-detail-delete'))this.options.onDelete?.(card);};
    }
  }
  Object.assign(N,{CardBrowser,filterCards,cardInfo,selectionCard});
})(typeof globalThis!=='undefined'?globalThis:window);
