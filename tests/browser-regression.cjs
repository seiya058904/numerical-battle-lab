'use strict';
// Optional integration gate; core `npm test` remains dependency-free.
// NBL_PLAYWRIGHT_MODULE may point to an existing Playwright installation.
const { chromium } = require(process.env.NBL_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createServer } = require('../scripts/serve.js');
const { CARDS, RARITY_LIST } = require('../src/cards.js');
const { naturalEmblemMarkup } = require('../src/app.js');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.NBL_EVIDENCE_DIR || path.join(require('node:os').tmpdir(), `nbl-browser-${Date.now()}`));
assert.ok(!out.startsWith(root + path.sep), 'Evidence must remain outside the repository');
fs.mkdirSync(out, { recursive: true });
const ids = ['collector', 'lumen', 'folio', 'pulse', 'nocturne', 'sumi', 'arcade', 'verdant'];
const report = { started: new Date().toISOString(), checks: [], screenshots: [], metrics: {}, errors: [], uncovered: ['Firefox', 'WebKit', 'physical mobile device', 'FPS and energy measurements'] };
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
let browser, server, base;
function record(name, data = {}) { report.checks.push({ name, status: 'PASS', ...data }); console.log(`PASS ${name}`); }
async function instrument(page) {
  await page.route('**/src/app.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: `
      window.__nblTest={calls:0,results:[],fail:false,draw:false,longTasks:[]};
      if(PerformanceObserver.supportedEntryTypes.includes('longtask')) new PerformanceObserver(list=>__nblTest.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
      const originalSimulate=NCB.simulate;
      NCB.simulate=(...args)=>{__nblTest.calls++;if(__nblTest.fail)throw new Error('EXPECTED TEST FAILURE');const r=originalSimulate(...args);if(__nblTest.draw)r.winner=-1;__nblTest.results.push(r);return r;};
      ${source}
      const originalInit=NCB.initApp;NCB.initApp=()=>{const app=originalInit();__nblTest.app=app;return app;};` });
  });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', msg => { if (['error', 'warning'].includes(msg.type()) && !msg.text().includes('EXPECTED TEST FAILURE')) report.errors.push(msg.text()); });
}
async function fresh(viewport = { width: 1536, height: 960 }, storage) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  if (storage) await context.addInitScript(storage);
  const page = await context.newPage(); await instrument(page); await page.goto(base);
  await page.waitForFunction(() => window.__nblTest?.app);
  return { context, page };
}
async function phase(page, value) { await page.waitForFunction(v => document.querySelector('.app').dataset.phase === v, value); }
async function result(page) { await phase(page, 'result'); await page.waitForFunction(() => !__nblTest.app.state.playing); }
async function finish(page) { await page.locator('[data-speed=instant]').click(); await result(page); }
async function edit(page) { if (await page.locator('#resultEditBtn').isVisible()) await page.locator('#resultEditBtn').click(); }
async function fixed(page) {
  await edit(page); await page.selectOption('#selA', String(CARDS.findIndex(c=>c.id==='origin_star'))); await page.selectOption('#selB', String(CARDS.findIndex(c=>c.id==='iron_guard')));
  for (const [side, level] of [['A', '55'], ['B', '100']]) { await page.locator('#lvl' + side + 'Val').fill(level); await page.locator('#lvl' + side + 'Val').press('Tab'); }
  await page.locator('#seedInput').fill('424242');
}
async function shot(page, name, fullPage = true) {
  const file = `${name}.png`; await page.screenshot({ path: path.join(out, file), fullPage });
  report.screenshots.push({ file, ...(await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio, theme: document.documentElement.dataset.theme, phase: document.querySelector('.app')?.dataset.phase }))) });
}
async function overflow(page) {
  const sizes = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(sizes.document <= sizes.width + 1, JSON.stringify(sizes));
}
async function snapshot(page) {
  return page.evaluate(() => ({ calls: __nblTest.calls, events: __nblTest.app.state.events, count: __nblTest.app.state.eventCount, seed: __nblTest.app.state.seed,
    rows: [...document.querySelectorAll('#logbox .le')].map(n=>n.textContent), hp: ['hpTA','hpTB'].map(id=>document.getElementById(id).dataset.value), round: document.getElementById('roundTxt').textContent,
    summary: document.getElementById('summaryBody').textContent, winner: document.getElementById('resultName').textContent }));
}
async function keyboardStart(page, id) { await page.locator('#'+id).focus(); await page.keyboard.press('Enter'); }

(async () => {
  if (process.env.NBL_BASE_URL) base = process.env.NBL_BASE_URL;
  else { server = createServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r)); base = `http://127.0.0.1:${server.address().port}/`; }
  browser = await chromium.launch({ headless: true, ...(process.env.NBL_BROWSER_PATH ? { executablePath: process.env.NBL_BROWSER_PATH } : {}) });
  report.environment = { base, browser: browser.version(), node: process.version, playwright: require((process.env.NBL_PLAYWRIGHT_MODULE || 'playwright') + '/package.json').version };
  let { context, page } = await fresh();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'collector');
  assert.match(await page.title(), /数值卡牌/); assert.equal(await page.locator('#themeSelect option').count(), 8);
  assert.equal(await page.locator('#themeGallery button').count(), 8);
  assert.equal(await page.locator('.theme-browser').getAttribute('open'), null);
  record('clean first paint, identity, eight options and collapsed catalogue');
  for (const id of ids) {
    await page.selectOption('#themeSelect',id); await page.reload();
    assert.equal(await page.locator('#themeSelect').inputValue(),id);
    const surfaces = await page.evaluate(() => {const t=NCB_THEME.resolve(document.documentElement.dataset.theme);return [getComputedStyle(document.documentElement).colorScheme,document.querySelector('meta[name=theme-color]').content,t.scheme,t.color];});
    assert.equal(surfaces[0],surfaces[2]);assert.equal(surfaces[1],surfaces[3]);
  }
  record('all eight persisted themes restore browser color surfaces');
  await page.locator('.theme-browser summary').click();
  await page.locator('[data-theme-id=sumi]').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#themeSelect').inputValue(),'sumi');
  assert.equal(await page.locator('[data-theme-id=sumi]').getAttribute('aria-pressed'),'true');
  await page.locator('.theme-browser summary').click();
  await page.locator('#searchA').fill('起源');await page.locator('#seedInput').fill('123456');
  const ready = await page.evaluate(()=>({selection:selA.value,level:lvlAVal.value,search:searchA.value,seed:seedInput.value,expanded:document.querySelector('.stats-toggle')?.getAttribute('aria-expanded')}));
  await page.selectOption('#themeSelect','nocturne');
  assert.deepEqual(await page.evaluate(()=>({selection:selA.value,level:lvlAVal.value,search:searchA.value,seed:seedInput.value,expanded:document.querySelector('.stats-toggle')?.getAttribute('aria-expanded')})),ready);
  await page.locator('#searchA').fill('NOT A CARD MATCH');
  assert.equal(await page.locator('#selA').inputValue(),ready.selection);await page.locator('#searchA').fill('');
  record('keyboard catalogue and READY selection/search/seed/disclosure preservation');
  await fixed(page);await page.locator('[data-speed=slow]').click();await keyboardStart(page,'startBtn');
  await phase(page,'engage');const callCount=await page.evaluate(()=>__nblTest.calls);
  await page.selectOption('#themeSelect','arcade');await phase(page,'battle');
  await page.waitForFunction(()=>__nblTest.app.state.eventCount>2);
  await page.locator('#followLog').click();await page.evaluate(()=>logbox.scrollTop=0);
  await page.locator('#themeSelect').focus();
  let previousCount=await page.evaluate(()=>__nblTest.app.state.eventCount);
  for (const id of ids) {
    await page.selectOption('#themeSelect',id);
    const progress=await page.evaluate(()=>({calls:__nblTest.calls,count:__nblTest.app.state.eventCount,locked:selA.disabled,follow:__nblTest.app.state.follow,scroll:logbox.scrollTop}));
    assert.equal(progress.calls,callCount);assert.ok(progress.count>=previousCount);assert.equal(progress.locked,true);assert.equal(progress.follow,false);assert.equal(progress.scroll,0);previousCount=progress.count;
  }
  await page.locator('[data-speed=fast]').click();await page.locator('[data-speed=instant]').click();await result(page);
  const canonical=await snapshot(page);assert.equal(canonical.events.length,42);assert.deepEqual(canonical.hp,['0','10918']);
  assert.equal(canonical.rows.length,42);assert.equal(canonical.winner,'铁盾卫兵');
  for(const id of ids){await page.selectOption('#themeSelect',id);assert.deepEqual(await snapshot(page),canonical);}
  report.canonical={events:42,digest:digest(canonical.events),hp:canonical.hp,seed:canonical.seed};
  record('ENGAGE/BATTLE/RESULT theme changes preserve one simulation, ordered logs, HP and user log position');
  // Fast playback stays real; test every disabled/hidden trigger and its next Tab.
  for(const id of ['startBtn','againBtn','resultAgainBtn','replayBtn','resultReplayBtn']){
    await page.locator('[data-speed=fast]').click();await keyboardStart(page,id);
    await page.waitForFunction(()=>__nblTest.app.state.playing);await result(page);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'resultAgainBtn',id);
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'resultReplayBtn',id+' next Tab');
  }
  record('five keyboard entry points restore result focus and next Tab at real fast speed');
  await page.locator('[data-speed=fast]').click();await keyboardStart(page,'startBtn');
  await page.locator('#themeSelect').focus();await result(page);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'themeSelect');
  await page.locator('#seedInput').fill('-1');await keyboardStart(page,'startBtn');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'seedInput');assert.equal(await page.locator('#seedInput').getAttribute('aria-invalid'),'true');
  await page.locator('#seedInput').fill('1');await page.evaluate(()=>__nblTest.fail=true);await keyboardStart(page,'startBtn');
  await page.waitForFunction(()=>document.getElementById('hudState').textContent==='ERROR');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'startBtn');assert.equal(await page.locator('#resultBox').isVisible(),false);
  await page.evaluate(()=>__nblTest.fail=false);record('user focus is respected; invalid seed and injected simulation exception recover visibly');
  await fixed(page);await page.locator('[data-speed=instant]').click();
  for(const seed of ['0','4294967295']){await page.locator('#seedInput').fill(seed);await page.locator('#startBtn').click();await result(page);assert.equal(await page.evaluate(()=>__nblTest.app.state.seed),Number(seed));}
  await fixed(page);await page.locator('#lvlAVal').fill('');await page.locator('#lvlAVal').press('Tab');assert.equal(await page.locator('#lvlAVal').inputValue(),'55');
  for(const level of ['1','100']){await page.locator('#lvlAVal').fill(level);await page.locator('#lvlAVal').press('Tab');assert.equal(await page.locator('#lvlAVal').inputValue(),level);}
  await page.selectOption('#selA',String(CARDS.findIndex(c=>c.id==='iron_guard')));await page.selectOption('#selB',String(CARDS.findIndex(c=>c.id==='iron_guard')));await page.locator('#seedInput').fill('424242');await page.locator('#startBtn').click();await result(page);
  assert.ok((await snapshot(page)).rows.some(s=>s.includes('蓝方')));assert.ok((await snapshot(page)).rows.some(s=>s.includes('红方')));
  record('seed uint32 endpoints, incomplete/boundary levels and side-labelled mirror match');
  await fixed(page);await page.locator('#seedInput').fill('424242');await page.locator('#startBtn').click();await result(page);
  const fixedEvents=(await snapshot(page)).events;
  for(const id of ids){await page.selectOption('#themeSelect',id);await page.locator('#resultReplayBtn').click();await result(page);assert.deepEqual((await snapshot(page)).events,fixedEvents);}
  record('same-Seed full events match across all eight themes');
  // Capture real stages in both primary viewports, including lifesteal and regeneration.
  for(const viewport of [{width:1536,height:960},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    for(const id of ids){
      await fixed(page);await page.selectOption('#themeSelect',id);await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(1200);
      await overflow(page);await shot(page,`${id}-${viewport.width}-ready`);
      await page.locator('[data-speed=slow]').click();await page.locator('#startBtn').click();await phase(page,'battle');
      await page.waitForFunction(()=>__nblTest.app.state.eventCount>2);await overflow(page);await shot(page,`${id}-${viewport.width}-battle`,false);
      if(id==='collector'&&viewport.width===1536){
        for(const type of ['吸取','再生']){
          await page.waitForFunction(type=>__nblTest.app.state.previous?.text.includes(type),type);
          const heal=await page.evaluate(()=>{const node=document.querySelector('.pcard[data-action=recover] .rank-detail');return {text:__nblTest.app.state.previous.text,stroke:node&&getComputedStyle(node).stroke,green:getComputedStyle(document.documentElement).getPropertyValue('--green').trim()};});
          const expectedGreen = 'rgb(' + [1,3,5].map(i=>parseInt(heal.green.slice(i,i+2),16)).join(', ') + ')';
          assert.equal(heal.stroke,expectedGreen);report.metrics[type]=heal;await shot(page,`collector-${type}-feedback`,false);
        }
        await page.waitForFunction(()=>document.querySelector('.pcard[data-action=impact]'));
        const otherStroke=await page.locator('.pcard[data-action=impact] .rank-detail').evaluate(n=>getComputedStyle(n).stroke);
        assert.notEqual(otherStroke,report.metrics['再生'].stroke);
      }
      await finish(page);await page.waitForTimeout(350);await overflow(page);await shot(page,`${id}-${viewport.width}-result`);
      assert.deepEqual((await snapshot(page)).events,fixedEvents);
    }
  }
  record('eight themes x desktop/mobile x READY/BATTLE/RESULT screenshots and fixed events');
  for(const viewport of [{width:320,height:720},{width:768,height:1024},{width:1180,height:757},{width:3840,height:2160}]){
    await page.setViewportSize(viewport);
    for(const id of ['collector','nocturne','sumi','arcade','verdant']){
      await fixed(page);await page.selectOption('#themeSelect',id);await page.evaluate(()=>scrollTo(0,0));await overflow(page);
      await shot(page,`${id}-${viewport.width}-edge-ready`,false);
      await page.locator('[data-speed=slow]').click();await page.locator('#startBtn').click();await phase(page,'battle');await page.waitForTimeout(100);await overflow(page);
      if(viewport.width===1180){
        const bounds=await page.evaluate(()=>['hpTA','hpTB','roundTxt'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,top:r.top,bottom:r.bottom}}));
        report.metrics[`short-${id}`]=bounds;for(const b of bounds)assert.ok(b.top>=0&&b.bottom<=757,JSON.stringify(b));
      }
      await shot(page,`${id}-${viewport.width}-edge-battle`,false);await finish(page);
    }
  }
  record('320, tablet, short desktop and 4K edge matrix; short desktop HP and round visible');
  await page.setViewportSize({width:390,height:844});await edit(page);
  const longIndex=CARDS.reduce((best,card,i)=>card.name.length>CARDS[best].name.length?i:best,0);
  const englishIndex=CARDS.reduce((best,card,i)=>card.id.length>CARDS[best].id.length?i:best,0);
  await page.selectOption('#selA',String(longIndex));await page.selectOption('#selB',String(englishIndex));
  await page.locator('#statsToggleA').click();
  for(const id of ids){
    await page.selectOption('#themeSelect',id);await overflow(page);
    assert.equal(await page.locator('#statsToggleA').getAttribute('aria-expanded'),'true');
    const bounds=await page.evaluate(()=>[...document.querySelectorAll('.cname,.card-english')].map(n=>({text:n.textContent,width:n.clientWidth,scroll:n.scrollWidth})));
    for(const n of bounds)assert.ok(n.scroll<=n.width+1,JSON.stringify({id,...n}));
  }
  await shot(page,'long-names-expanded-mobile');
  await page.selectOption('#selA',String(CARDS.findIndex(c=>c.rarity===9)));
  await page.selectOption('#selB',String(CARDS.findIndex(c=>c.rarity===8)));
  for(const id of ids){await page.selectOption('#themeSelect',id);await overflow(page);await shot(page,`${id}-SSS-mobile`,false);}
  record('longest real Chinese/English identities, expanded mobile stats and SSS/Collector labels');
  await page.setViewportSize({width:1536,height:960});await fixed(page);
  await page.evaluate(()=>document.documentElement.style.fontSize='32px');await page.selectOption('#themeSelect','sumi');await overflow(page);await shot(page,'sumi-text-size-200-percent');
  await page.evaluate(()=>document.documentElement.style.removeProperty('font-size'));
  await page.emulateMedia({reducedMotion:'reduce'});await page.selectOption('#themeSelect','verdant');await page.locator('[data-speed=fast]').click();await page.locator('#startBtn').click();await result(page);await overflow(page);await shot(page,'verdant-reduced-motion');
  assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
  record('200% root text-size reflow and reduced-motion real playback');
  await page.emulateMedia({reducedMotion:'no-preference'});await fixed(page);await page.locator('[data-speed=slow]').click();await page.locator('#startBtn').click();await phase(page,'battle');
  // Chromium lifecycle freeze is an actual background suspension, not a synthetic event.
  const cdp=await context.newCDPSession(page);await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await new Promise(r=>setTimeout(r,250));await cdp.send('Page.setWebLifecycleState',{state:'active'});await finish(page);assert.deepEqual((await snapshot(page)).events,fixedEvents);
  record('Chromium background freeze/resume preserves event sequence');
  // Real blue win, real red win, and explicitly labelled test-only draw presentation.
  await fixed(page);await page.locator('#lvlAVal').fill('100');await page.locator('#lvlAVal').press('Tab');await page.locator('#startBtn').click();await result(page);
  assert.match(await page.locator('#resultBox').getAttribute('class'),/win0/);
  for(const id of ids){await page.selectOption('#themeSelect',id);await shot(page,`${id}-blue-result`,false);}
  await page.evaluate(()=>__nblTest.draw=true);await page.locator('#resultReplayBtn').click();await result(page);
  for(const id of ids){await page.selectOption('#themeSelect',id);assert.equal(await page.locator('#resultMedal svg').count(),0);assert.equal(await page.locator('#resultVerdict').innerText(),'DRAW');await shot(page,`${id}-TEST-FIXTURE-draw`,false);}
  await page.evaluate(()=>__nblTest.draw=false);record('all themes real blue/red victory and explicitly synthetic neutral DRAW fixture');
  await fixed(page);await page.selectOption('#themeSelect','collector');await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(1300);
  const sample=async()=>{await cdp.send('HeapProfiler.collectGarbage');return {...await cdp.send('Memory.getDOMCounters'),animations:await page.evaluate(()=>document.getAnimations().length)};};
  const samples=[];samples.push(await sample());
  for(let batch=0;batch<3;batch++){
    const timings=await page.evaluate(async ids=>{const samples=[];for(let i=0;i<32;i++){const t=performance.now();const s=document.querySelector('#themeSelect');s.value=ids[i%ids.length];s.dispatchEvent(new Event('change'));const script=performance.now()-t;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));samples.push({script,frame:performance.now()-t});}return samples;},ids);
    await page.selectOption('#themeSelect','collector');await page.waitForTimeout(1300);samples.push(await sample());if(batch===0)report.metrics.switchTimings=timings;
  }
  report.metrics.memory=samples;
  assert.ok(samples.at(-1).jsEventListeners<=samples[1].jsEventListeners+2,JSON.stringify(samples));
  assert.ok(samples.at(-1).nodes<=samples[1].nodes+20,JSON.stringify(samples));
  report.metrics.themes={};
  for(const id of ids){await page.selectOption('#themeSelect',id);report.metrics.themes[id]=await page.evaluate(()=>({dom:document.querySelectorAll('*').length,svg:document.querySelectorAll('svg').length,crestNodes:[...document.querySelectorAll('.emblem')].map(n=>n.querySelectorAll('*').length)}));assert.equal(await page.locator('.emblem>svg').count(),2);}
  report.metrics.resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({name:r.name,transfer:r.transferSize,encoded:r.encodedBodySize})));
  report.metrics.longTasks=await page.evaluate(()=>__nblTest.longTasks);
  record('96 switches: post-GC DOM/listeners and animation counts bounded; exactly one SVG per card');
  report.metrics.contrast={};
  for(const id of ids.slice(4)){
    await page.selectOption('#themeSelect',id);
    // Buttons interpolate background for 180ms. Measure the settled surface,
    // matching the screenshots, not an intermediate cross-theme blend.
    await page.waitForTimeout(250);
    const pairs=await page.evaluate(()=>{
      const lum=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
      return [['.log-head','.telemetry'],['.summary-panel caption','.telemetry'],['.theme-picker select','.theme-picker select'],['#startBtn','#startBtn'],['.spdbtn.on','.spdbtn.on']].map(([fg,bg])=>{const color=getComputedStyle(document.querySelector(fg)).color,background=getComputedStyle(document.querySelector(bg)).backgroundColor;const a=lum(color),b=lum(background);return {fg,bg,color,background,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});
    });
    report.metrics.contrast[id]=pairs;for(const p of pairs)assert.ok(p.ratio>=4.5,JSON.stringify({id,...p}));
  }
  record('new-theme representative text/control contrast calculated against rendered opaque backgrounds');
  // No invalid duplicate IDs or unresolved local paint references after mounting.
  const paint=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);const missing=[];for(const n of document.querySelectorAll('svg *'))for(const a of n.attributes)for(const m of a.value.matchAll(/url\(#([^)]+)\)/g))if(!document.getElementById(m[1]))missing.push(m[1]);return {duplicate:ids.length-new Set(ids).size,missing};});
  assert.deepEqual(paint,{duplicate:0,missing:[]});record('live page IDs and SVG paint references resolve');
  await context.close();
  for(const mode of ['read','write','unknown']){
    ({context,page}=await fresh(undefined,mode==='unknown'?()=>localStorage.setItem('nbl.visual-theme','obsolete'):mode==='read'?()=>{Storage.prototype.getItem=()=>{throw new Error('blocked read')}}:()=>{Storage.prototype.setItem=()=>{throw new Error('blocked write')}}));
    assert.equal(await page.locator('#themeSelect').inputValue(),'collector');await page.selectOption('#themeSelect','arcade');assert.equal(await page.locator('html').getAttribute('data-theme'),'arcade');await context.close();
  }
  record('real browser blocked reads/writes and unknown stored ID keep switching usable');
  // Isolated, clearly labelled geometry fixture. Never loaded by the product.
  const board=await browser.newPage({viewport:{width:1536,height:1000}});
  await board.goto(base);
  for(const id of ['nocturne','sumi','arcade','verdant']){
    const marks=Array.from({length:12},(_,tier)=>`<figure>${naturalEmblemMarkup(tier,id)}<figcaption>${tier+1} · ${RARITY_LIST[tier]}</figcaption></figure>`).join('');
    await board.evaluate(({id,marks})=>{NCB_THEME.apply(id);document.body.innerHTML=`<main style="padding:32px"><h1>${id.toUpperCase()} · 12 RARITIES — TEST DISPLAY</h1><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:24px;margin-top:32px">${marks}</div></main>`;const style=document.createElement('style');style.textContent='figure{background:var(--surface);padding:10px;color:var(--edition)}figure svg{width:100%;height:320px}figcaption{text-align:center;font:16px Segoe UI}';document.head.append(style);},{id,marks});
    await board.screenshot({path:path.join(out,`${id}-12-ranks.png`),fullPage:true});
  }
  await board.close();record('four twelve-rank comparison boards generated outside production');
  assert.deepEqual(report.errors,[]);record('no unexpected console warnings/errors');
  report.status='PASS';
})().catch(error=>{report.status='FAIL';report.failure=error.stack;console.error(error);process.exitCode=1;}).finally(async()=>{
  report.finished=new Date().toISOString();fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));
  await browser?.close();if(server)await new Promise(r=>server.close(r));console.log(`Evidence: ${out}`);
});
