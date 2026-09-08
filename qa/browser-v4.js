// Real browser acceptance flows. No production test hooks or runtime dependencies.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const OUT=__dirname,BASE='http://127.0.0.1:8774/';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',args:['--no-proxy-server']});
 const report={browser:'Installed Chrome via Playwright; Browser plugin not available',checks:[],errors:[],performance:{}};
 const check=(name,ok)=>{report.checks.push({name,pass:!!ok});assert.ok(ok,name);};
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await p.goto(BASE);check('page identity',(await p.title()).includes('数值'));check('no main card select',await p.locator('[data-battle-card]').count()===0);
 report.performance.initialLoadMs=await p.evaluate(()=>performance.getEntriesByType('navigation')[0].loadEventEnd);
 const start=Date.now();await p.locator('[data-open-picker="picker:A:0"]').click();report.performance.pickerOpenMs=Date.now()-start;
 const overlay=p.locator('.picker-overlay');check('initial 12 cards',await overlay.locator('.selection-card').count()===12);
 check('candidate has metadata',/HP[\s\S]*ATK/.test(await overlay.locator('.selection-card').first().innerText()));
 await p.screenshot({path:path.join(OUT,'v4-mobile-presets.png')});
 await overlay.locator('[data-rarity="A_PLUS"]').click();check('rarity filter',await overlay.locator('.selection-card').count()===5);
 await overlay.locator('.browser-options > summary').click();await overlay.locator('[data-level-bucket]').selectOption('40-49');check('combined rarity and level',await overlay.locator('.selection-card').count()===1);
 const target=await overlay.locator('.selection-card').first().getAttribute('data-card-id');
 const data=await p.evaluate(id=>{const c=NCB.SYSTEM_PRESETS.find(c=>c.id===id);return{name:c.displayName,action:c.actions[0].name,tag:NCB.cardInfo(c).behavior.allTags[0]};},target);
 await overlay.locator('[data-filter="search"]').fill(data.name);check('name search',await overlay.locator('.selection-card').count()===1);
 await overlay.locator('[data-filter="search"]').fill(data.action);check('action search',await overlay.locator('.selection-card').count()===1);
 await overlay.locator('[data-browser-detail]').first().click();await overlay.locator('[data-detail-back]').click();
 check('filtered detail back restores results',await overlay.locator('.selection-card').count()===1);
 check('filtered detail back restores level control',await overlay.locator('[data-level-bucket]').inputValue()==='40-49');
 await overlay.locator('.browser-options > summary').click();await overlay.locator('.behavior-filter-group > summary').click();const tag=overlay.locator('[data-tag]').filter({hasText:data.tag}).first();if(!await tag.isVisible())await overlay.locator('.behavior-filters summary').click();await tag.click();check('behavior intersection',await overlay.locator('.selection-card').count()===1);
 await overlay.locator('[data-clear-filter="all"]').click();check('clear all',await overlay.locator('.result-count').innerText()==='找到 60 张');
 await overlay.locator('[data-browser-more]').click();check('load next batch',await overlay.locator('.selection-card').count()===24);
 await overlay.locator('[data-browser-detail]').first().click();check('detail opened',await overlay.locator('.browser-detail').count()===1);
 await p.screenshot({path:path.join(OUT,'v4-mobile-detail.png')});await overlay.locator('[data-detail-back]').click();check('detail returns with page size',await overlay.locator('.selection-card').count()===24);
 await overlay.locator('[data-browser-detail]').first().click();await overlay.locator('[data-detail-select]').click();check('detail selects left',await p.locator('.setup-slot .selection-card').count()===1);
 await p.locator('[data-open-picker="picker:B:0"]').click();await p.locator('.picker-overlay [data-browser-select]').nth(1).click();check('right selects',await p.locator('.setup-slot .selection-card').count()===2);
 check('picker no overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.locator('[data-action="battle-start"]').click();await p.locator('[data-action="auto-pause"]').click();
 await p.screenshot({path:path.join(OUT,'v4-mobile-battle-1.png')});
 check('battle starts',await p.locator('.entity-card').count()===2);check('resources visible',await p.locator('.battle-resources [data-resource]').count()>=2);
 // Replace only this isolated context's user library with deterministic test cards.
 // The repeated damage and lifesteal fixture guarantees atomic HP changes are observed.
 await p.evaluate(()=>{
  const cards=['逐事件甲','逐事件乙'].map((name,i)=>{const c=NCB.generateCardV4({seed:'browser-timeline-'+i,rarity:'C',level:60});c.displayName=name;c.stats={...c.stats,MAX_HP:300,ATK:24,DEF:10,SPD:50+i,LIFESTEAL:30,HEAL_POWER:100,HEAL_TAKEN:100,RAMP_RATE:0,FATIGUE_RATE:0,VOLATILITY:1,LUCK:0};c.actions=[{id:c.id+':test',name:'连续侵蚀',target:'enemy',cost:0,cooldown:0,effects:[{type:'repeat',times:3,effects:[{type:'damage',damageType:'physical',formula:'ATK',canMiss:false,canCrit:false}]}]},{id:c.id+':rest',name:'休整',target:'self',cost:0,cooldown:2,effects:[{type:'heal',formula:'MAX_HP * .1'}]}];c.triggers=[];c.statuses=[];c.passives=[];c.affinities={};return c;});localStorage.setItem('nbl-card-library-v1',JSON.stringify(cards));
 });await p.reload();
 await p.evaluate(()=>{const original=NCB.createBattle;NCB.createBattle=config=>{const e=original(config);window.__engine=e;window.__frames=[...e.presentationFrames||[]];const capture=e.captureFrame.bind(e);e.captureFrame=row=>{capture(row);window.__frames.push(e.presentationFrames.at(-1));};return e;};});
 for(const [side,name] of [['picker:A:0','逐事件甲'],['picker:B:0','逐事件乙']]){await p.locator(`[data-open-picker="${side}"]`).click();await p.locator('.picker-overlay [data-filter="search"]').fill(name);await p.locator('.picker-overlay [data-browser-select]').click();}
 await p.locator('#view-battle .advanced-note summary').click();await p.locator('[data-max-rounds]').fill('3');
 const battleStart=Date.now();await p.locator('[data-action="battle-start"]').click();report.performance.battleStartMs=Date.now()-battleStart;
 await p.locator('[data-action="auto-pause"]').click();
 await p.evaluate(()=>{
  window.__observed=[];window.__mismatch=[];new MutationObserver(()=>{
   const idx=Number(document.querySelector('#view-battle').dataset.frameIndex),f=window.__frames.find(f=>f?.index===idx);if(!f)return;
   const counts=[...document.querySelectorAll('.entity-card')].map(el=>el.querySelectorAll('.combat-float-slot').length);if(counts.some(n=>n>1))window.__mismatch.push('overlap');
   for(const t of ['A','B'])for(const e of f.snapshot.teams[t].entities){const el=document.querySelector(`[data-entity-id="${e.id}"] .meter-group .meter-row:last-child`);const hp=document.querySelector(`[data-entity-id="${e.id}"] .meter-group .meter-row:first-child`);if(hp&&!hp.textContent.endsWith(Math.round(e.hp)+'/'+Math.round(e.maxHp)))window.__mismatch.push('HP '+idx);
   const card=document.querySelector(`[data-entity-id="${e.id}"]`);for(const resource of card?.querySelectorAll('[data-resource]')||[]){const key=resource.dataset.resource;if(resource.querySelector('b').textContent!==Math.round(window.__engine.getResource(e,key))+'/'+Math.round(window.__engine.resourceMax(e,key)))window.__mismatch.push('resource '+idx);}
   for(const ward of card?.querySelectorAll('[data-ward]')||[])if(Number(ward.querySelector('b').textContent)!==Math.round(e.wards[ward.dataset.ward]))window.__mismatch.push('ward '+idx);}
   if(!window.__observed.some(x=>x.index===idx))window.__observed.push({index:idx,time:performance.now(),kind:f.row?.kind});
  }).observe(document.querySelector('#view-battle'),{childList:true,subtree:true});
 });
 const paused=await p.locator('#view-battle').getAttribute('data-frame-index');await p.waitForTimeout(850);check('pause holds display',paused===await p.locator('#view-battle').getAttribute('data-frame-index'));
 await p.locator('[data-action="auto-step"]').click();await p.waitForTimeout(3800);
 const stepped=await p.locator('#view-battle').getAttribute('data-frame-index');check('step advanced',Number(stepped)>Number(paused));await p.waitForTimeout(900);check('step stops after group',stepped===await p.locator('#view-battle').getAttribute('data-frame-index'));
 for(const speed of [1,2,4]){
  await p.locator(`[data-speed="${speed}"]`).click();check(speed+'x control',await p.locator(`[data-speed="${speed}"]`).getAttribute('class').then(c=>c.includes('is-active')));
 }
 await p.locator('[data-action="auto-pause"]').click();
 await p.waitForFunction(()=>document.querySelector('.combat-float-slot'),{timeout:10000});await p.screenshot({path:path.join(OUT,'v4-mobile-battle-timeline.png')});
 await p.waitForFunction(()=>window.__engine?.outcome().ended&&Number(document.querySelector('#view-battle').dataset.frameIndex)===window.__frames.at(-1).index,{timeout:45000});
 const result=await p.evaluate(()=>({mismatches:window.__mismatch,observed:window.__observed,hp:['A','B'].flatMap(t=>window.__engine.teams[t].entities.map(e=>e.hp)),end:window.__frames.at(-1).snapshot.outcome}));
 check('all observed frame HP match captured engine state',result.mismatches.length===0);check('damage and healing frames observed',result.observed.some(f=>f.kind==='damage')&&result.observed.some(f=>f.kind==='heal'));check('final display equals final engine',result.end.ended);
 report.timeline=result;report.performance.frameIntervalsMs=result.observed.slice(1).map((x,i)=>Math.round(x.time-result.observed[i].time));
 check('battle no overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.setViewportSize({width:1440,height:1000});await p.screenshot({path:path.join(OUT,'v4-desktop-battle.png')});check('desktop no overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const offline=await context.newPage();await offline.goto('file:///'+path.resolve(__dirname,'../index.html').replace(/\\/g,'/'));check('file protocol loads',await offline.locator('[data-open-picker]').count()===2);
 check('console healthy',report.errors.length===0);
 }catch(e){report.failure=e.stack;process.exitCode=1;}finally{fs.writeFileSync(path.join(OUT,'browser-v4.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks,errors:report.errors,failure:report.failure,performance:report.performance}));await browser.close();}
})();
