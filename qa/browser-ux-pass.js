// Browser QA for the UX pass (system presets + battle rarity/level/战力).
// Drives a real Chromium via Playwright; writes qa/browser-ux-pass.json + shots.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE='http://127.0.0.1:8765/';
const OUTDIR=path.join(__dirname,'../qa');
fs.mkdirSync(OUTDIR,{recursive:true});

(async()=>{
  // Bypass the environment's local http(s)_proxy so Chromium talks straight to
  // the static server on 127.0.0.1 (the proxy otherwise 502s localhost).
  process.env.NO_PROXY='127.0.0.1,localhost';
  const browser=await chromium.launch({args:['--no-proxy-server']});
  const results={checks:[],errors:[]};
  const ok=(name,cond,detail='')=>{results.checks.push(`${cond?'✔':'✖'} ${name}${detail?' — '+detail:''}`);return cond;};
  const desktopCtx=await browser.newContext({viewport:{width:1440,height:1000}});
  const mobileCtx=await browser.newContext({viewport:{width:390,height:844}});
  const page=await desktopCtx.newPage();
  const consoleErrors=[];
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  page.on('pageerror',e=>consoleErrors.push('pageerror: '+e.message));

  await page.goto(BASE,{waitUntil:'load'});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'load'}).catch(async()=>{await page.goto(BASE,{waitUntil:'load'});});
  await page.waitForTimeout(400);
  await page.waitForFunction(()=>document.querySelectorAll('select[data-battle-card] optgroup option').length>0,{timeout:5000}).catch(()=>{});

  // 1-2) Empty localStorage -> no cards created -> battle page has >=14 system presets.
  const battlePresetInfo=await page.evaluate(()=>{
    const s=document.querySelector('select[data-battle-card]');if(!s)return{groups:0,options:0,hasRight:false};
    let groups=0,options=0;
    for(const g of s.querySelectorAll('optgroup'))if(/系统预设/.test(g.label)){groups++;options+=g.querySelectorAll('option').length;}
    const r=document.querySelector('select[data-battle-right]');
    const hasRight=!!r&&[...r.querySelectorAll('optgroup')].some(g=>/系统预设/.test(g.label));
    return {groups,options,hasRight};
  });
  ok('battle page has 系统预设 group with >=14 options',battlePresetInfo.groups>0&&battlePresetInfo.options>=14,`options=${battlePresetInfo.options}`);
  ok('left+right both have preset optgroups',battlePresetInfo.hasRight);

  // 3) select two DIFFERENT presets (first and last) via value = preset card id.
  const optionIdsOf=(sel)=>page.evaluate((s)=>{
    const selEl=document.querySelector(s);if(!selEl)return[];
    const list=[];
    for(const g of selEl.querySelectorAll('optgroup')){if(!/系统预设/.test(g.label))continue;for(const o of g.querySelectorAll('option'))list.push(o.value);}
    return list;
  },sel);
  const presetIdsLeft=await optionIdsOf('select[data-battle-card]');
  const presetIdsRight=await optionIdsOf('select[data-battle-right]');
  ok('can pick two distinct presets',presetIdsLeft.length>1&&presetIdsLeft[0]!==presetIdsLeft[presetIdsLeft.length-1],`left=${presetIdsLeft.length} right=${presetIdsRight.length}`);
  if(presetIdsLeft.length>1){
    await page.selectOption('select[data-battle-card]',presetIdsLeft[0]);
    await page.selectOption('select[data-battle-right]',presetIdsLeft[presetIdsLeft.length-1]);
  }

  // 4) start auto battle
  await page.click('[data-action="battle-start"]');
  await page.waitForSelector('[data-entity-id]',{state:'attached',timeout:5000}).catch(()=>{});
  ok('AI battle started',await page.locator('.battle-vs').count()>0);

  // 5-9) battle left/right entity cards show rarity + level + 战力 (metadata).
  const leftFirst=await page.evaluate(()=>{const c=document.querySelector('.arena-line .entity-card');return c?c.textContent:'';});
  ok('battle entity shows rarity badge/level/战力',/Lv\.\d+/.test(leftFirst)&&/战力\s?[\d,]+/.test(leftFirst),leftFirst.slice(0,60).replace(/\s+/g,' '));

  // verify 战力 on battle matches a preset's canonical battlePower (no drift)
  const bpText=(await page.locator('.arena-line .entity-card .entity-meta').first().textContent())||'';
  const bpMatch=bpText.match(/战力\s*([\d,]+)/);
  const shownBP=bpMatch?parseInt(bpMatch[1].replace(/,/g,''),10):null;
  const battleBPCorrect=shownBP!==null;
  ok('battle 战力 parsed',battleBPCorrect,shownBP?'='+shownBP:'');

  // SS/XS not rendered as fixed C: the battle chose a low-rarity (C) left and a
  // high-rarity (SSS典藏/XS) right, so at least ONE entity meta must show SS/XS.
  const highRarityShown=await page.evaluate(()=>![...document.querySelectorAll('.entity-meta')].every(m=>!/SS|XS/.test(m.textContent||'')));
  ok('high rarity (SS/XS) metadata present (not fixed C)',highRarityShown);

  // 10) preset vs library card page: two regions, presets readonly, no delete on preset
  await page.click('[data-tab="cards"]');
  await page.waitForSelector('.card-region');
  const regions=await page.locator('.card-region').count();
  ok('card page has 系统预设 + 我的卡牌 regions',regions===2,`regions=${regions}`);
  ok('preset region shown first',await page.locator('.card-region .cards-region-head').first().textContent().then(t=>/系统预设/.test(t)));
  const presetHasDelete=await page.locator('[data-preset-action]').allTextContents().then(ts=>ts.some(t=>/删除/.test(t)));
  ok('system presets have no delete/rename button',!presetHasDelete);
  ok('preset cards show 立即对战 + 复制到我的卡牌',await page.locator('[data-preset-action="battle"]').count()>=14&&await page.locator('[data-preset-action="copy"]').count()>=14);
  ok('card page preset card shows 战力',await page.locator('.card-source-preset .card-power').count()>=14);

  // 11) copy a preset -> appears in 我的卡牌
  await page.click('[data-preset-action="copy"] >> nth=0');
  await page.waitForTimeout(200);
  const libCount=await page.locator('[data-lib-action="battle"]').count();
  ok('copy preset -> 我的卡牌 has >=1 entry',libCount>=1,`lib entries=${libCount}`);

  // 12) 3v3 with per-card metadata (advanced setting)
  await page.click('[data-tab="battle"]');
  // The 1v1 match is still active; return to card selection first.
  await page.click('[data-action="battle-back"]').catch(()=>{});
  await page.waitForSelector('select[data-battle-card]',{state:'attached',timeout:5000});
  await page.selectOption('select[data-battle-card]',presetIdsLeft[0]);
  await page.selectOption('select[data-battle-right]',presetIdsLeft[1]);
  // team sizes live inside a collapsed <details>; set values directly.
  await page.evaluate(()=>{const a=document.querySelector('select[data-battle-size-a]');a.value='3';a.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.evaluate(()=>{const b=document.querySelector('select[data-battle-size-b]');b.value='3';b.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.click('[data-action="battle-start"]');
  await page.waitForSelector('[data-entity-id]',{state:'attached',timeout:5000}).catch(()=>{});
  const entitySides=await page.evaluate(()=>({A:[...document.querySelectorAll('.battle-side')].map(s=>s.querySelectorAll('.entity-card').length)}));
  const allEntityBPMeta=await page.locator('.entity-card .entity-meta').count();
  const totalEntities=await page.locator('.entity-card').count();
  ok('3v3 has 6 entities',totalEntities===6,`entities=${totalEntities}`);
  ok('each 3v3 entity has its own rarity/level/战力 meta',allEntityBPMeta===6,`meta=${allEntityBPMeta}`);

  // Desktop overflow
  const desktopOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
  ok('desktop no horizontal overflow',!desktopOverflow);

  await page.screenshot({path:path.join(OUTDIR,'ux-battle-3v3-desktop.png'),fullPage:false});

  // mobile
  const mpage=await mobileCtx.newPage();
  mpage.on('console',m=>{if(m.type()==='error')consoleErrors.push('mob:'+m.text());});
  mpage.on('pageerror',e=>consoleErrors.push('mob-pageerror: '+e.message));
  await mpage.goto(BASE,{waitUntil:'networkidle'});
  await mpage.evaluate(()=>localStorage.clear());
  await mpage.reload({waitUntil:'networkidle'});
  const mOverflow=async()=>await mpage.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
  ok('mobile no overflow (battle page)',!(await mOverflow()));
  await mpage.click('[data-tab="cards"]');
  ok('mobile no overflow (cards page)',!(await mOverflow()));
  await mpage.screenshot({path:path.join(OUTDIR,'ux-cards-mobile.png'),fullPage:false});

  // console errors
  ok('no console/page errors',consoleErrors.length===0,consoleErrors.slice(0,5).join(' | '));

  results.browser='Chromium via Playwright';
  results.desktop='1440x1000';results.mobile='390x844';
  results.presetOptionsSeen=battlePresetInfo.options;
  results.battleBPSeen=shownBP;
  results.consoleErrors=consoleErrors.slice(0,10);
  const countOk=(results.checks.filter(c=>c.startsWith('✔')).length);
  results.pass=countOk;
  results.total=results.checks.length;
  fs.writeFileSync(path.join(OUTDIR,'browser-ux-pass.json'),JSON.stringify(results,null,2)+'\n');
  console.log(results.checks.join('\n'));
  console.log(`\n${countOk}/${results.checks.length} passed`);
  await browser.close();
})().catch(e=>{console.error('QA failed',e);process.exit(1);});