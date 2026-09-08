// Real-browser QA for explicit multi-team selection + fresh match seeds.
// Requires the static server at http://127.0.0.1:8774/ (same as browser-v4.js).
// Verifies: no auto-fill, start disabled until filled, explicit teams reach the
// engine config, same-card duplicates allowed, return preserves roster, restart
// rolls a new seed while keeping the lineup, and mobile has no overflow.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const OUT=__dirname,BASE='http://127.0.0.1:8774/';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',args:['--no-proxy-server']});
 const report={browser:'Installed Chrome via Playwright',checks:[],errors:[]};
 const check=(name,ok)=>{report.checks.push({name,pass:!!ok});assert.ok(ok,name);};
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await p.goto(BASE);
  // Capture every createBattle config so we can compare with explicit selections.
  await p.evaluate(()=>{const original=NCB.createBattle;window.__configs=[];NCB.createBattle=cfg=>{window.__configs.push({...cfg,seed:String(cfg.seed)});return original(cfg);};});

  // ---- 1v1 explicit selection ----
  await p.locator('[data-open-picker="picker:A:0"]').click();
  const poolA=await p.locator('.picker-overlay .selection-card').count();
  await p.locator('.picker-overlay [data-browser-select]').first().click();
  check('1v1 A slot 0 selected',await p.locator('.setup-slot[data-team-slot="picker:A:0"] .selection-card').count()===1);
  await p.locator('[data-open-picker="picker:B:0"]').click();
  await p.locator('.picker-overlay [data-browser-select]').nth(1).click();
  check('1v1 B slot 0 selected',await p.locator('.setup-slot[data-team-slot="picker:B:0"] .selection-card').count()===1);
  check('start enabled when 1v1 filled',await p.locator('[data-action="battle-start"]').isEnabled());
  await p.locator('[data-action="battle-start"]').click();
  check('1v1 battle starts',await p.locator('.entity-card').count()===2);
  const c1=await p.evaluate(()=>window.__configs.at(-1));
  check('1v1 config has exactly 2 units',c1.teamA.length===1&&c1.teamB.length===1);
  // restart -> new seed, same lineup
  await p.locator('[data-action="battle-restart"]').click();
  const c2=await p.evaluate(()=>window.__configs.at(-1));
  check('restart keeps lineup',c2.teamA[0]===c1.teamA[0]&&c2.teamB[0]===c1.teamB[0]);
  check('restart rolls a NEW match seed',c2.seed!==c1.seed);
  // return preserves roster
  await p.locator('[data-action="battle-back"]').click();
  check('return preserves A slot',await p.locator('.setup-slot[data-team-slot="picker:A:0"] .selection-card').count()===1);
  check('return preserves B slot',await p.locator('.setup-slot[data-team-slot="picker:B:0"] .selection-card').count()===1);

  // ---- 3v2 explicit selection (no autofill) ----
  await p.evaluate(()=>{const a=document.querySelector('select[data-battle-size-a]');a.value='3';a.dispatchEvent(new Event('change',{bubbles:true}));
    const b=document.querySelector('select[data-battle-size-b]');b.value='2';b.dispatchEvent(new Event('change',{bubbles:true}));});
  check('3v2 shows 3+2 slots',await p.locator('[data-team-slot^="picker:A:"]').count()===3&&await p.locator('[data-team-slot^="picker:B:"]').count()===2);
  check('start disabled when incomplete',await p.locator('[data-action="battle-start"]').isDisabled());
  check('no autofill: extra A slot empty',await p.locator('.setup-slot[data-team-slot="picker:A:2"] .selection-card').count()===0);
  // pick explicit five distinct cards: A=[0,1,2], B=[0,1] of the pool
  const chosen=await p.evaluate(()=>{const pool=NCB.SYSTEM_PRESETS.slice(0,5).map(c=>c.id);return {a:pool.slice(0,3),b:pool.slice(3,5)};});
  for(const spec of ['picker:A:0','picker:A:1','picker:A:2']){
    await p.locator(`[data-open-picker="${spec}"]`).click();
    const id=spec==='picker:A:0'?chosen.a[0]:spec==='picker:A:1'?chosen.a[1]:chosen.a[2];
    await p.locator(`.picker-overlay [data-browser-select="${id}"]`).click();
  }
  for(const spec of ['picker:B:0','picker:B:1']){
    await p.locator(`[data-open-picker="${spec}"]`).click();
    const id=spec==='picker:B:0'?chosen.b[0]:chosen.b[1];
    await p.locator(`.picker-overlay [data-browser-select="${id}"]`).click();
  }
  check('3v2 all five slots filled',await p.locator('.setup-slot .selection-card').count()===5);
  check('start enabled when 3v2 filled',await p.locator('[data-action="battle-start"]').isEnabled());
  await p.locator('[data-action="battle-start"]').click();
  const c3=await p.evaluate(()=>window.__configs.at(-1));
  check('3v2 config teamA === explicit [a,b,c]',JSON.stringify(c3.teamA)===JSON.stringify(chosen.a));
  check('3v2 config teamB === explicit [d,e]',JSON.stringify(c3.teamB)===JSON.stringify(chosen.b));
  check('3v2 battle shows 5 entities',await p.locator('.entity-card').count()===5);
  check('mobile no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));

  // ---- same-card duplicate allowed ----
  await p.locator('[data-action="battle-back"]').click();
  await p.evaluate(()=>{const a=document.querySelector('select[data-battle-size-a]');a.value='3';a.dispatchEvent(new Event('change',{bubbles:true}));});
  const dupId=await p.evaluate(()=>NCB.SYSTEM_PRESETS[0].id);
  for(const spec of ['picker:A:0','picker:A:1','picker:A:2']){
    await p.locator(`[data-open-picker="${spec}"]`).click();
    await p.locator(`.picker-overlay [data-browser-select="${dupId}"]`).click();
  }
  const dupIds=await p.evaluate(()=>[...document.querySelectorAll('.setup-slot[data-team-slot^="picker:A:"]')].map(s=>s.querySelector('[data-card-id]')?.getAttribute('data-card-id')));
  check('duplicate [X,X,X] allowed in A',dupIds.length===3&&dupIds.every(x=>x===dupId),JSON.stringify(dupIds));

  // ---- incomplete roster: 3v3 with only 5 chosen => disabled ----
  await p.evaluate(()=>{const b=document.querySelector('select[data-battle-size-b]');b.value='3';b.dispatchEvent(new Event('change',{bubbles:true}));});
  check('3v3 incomplete start disabled',await p.locator('[data-action="battle-start"]').isDisabled());
  check('hint shows remaining count',/还需选择 1 张卡牌/.test(await p.locator('.battle-setup-panel').innerText()));

  fs.writeFileSync(path.join(OUT,'browser-multi.json'),JSON.stringify(report,null,2)+'\n');
  console.log('multi-team QA:',report.checks.length,'checks,',report.checks.filter(c=>!c.pass).length,'failed');
  await p.screenshot({path:path.join(OUT,'v4-mobile-multiteam-3v2.png')});
 }catch(e){console.error(e);process.exitCode=1;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});