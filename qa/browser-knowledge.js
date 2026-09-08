// v1.3.1 Numerical Knowledge UI QA — 390×844 mobile browser flow (§58).
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const OUT=__dirname,BASE='http://127.0.0.1:8774/';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',args:['--no-proxy-server']});
 const report={checks:[],errors:[]};
 const check=(name,ok)=>{report.checks.push({name,pass:!!ok});assert.ok(ok,name);};
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p=await context.newPage();
  p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await p.goto(BASE);
  // open help tab -> 数值百科 button
  await p.evaluate(()=>{const tabs=[...document.querySelectorAll('.tab')];const t=tabs.find(b=>b.dataset.tab==='help');if(t)t.click();});
  await p.waitForSelector('[data-action="open-knowledge"]');
  await p.locator('[data-action="open-knowledge"]').click();
  check('encyclopedia opens',await p.locator('.picker-overlay .kb').count()===1);
  // search 吸血
  await p.locator('[data-kb-search]').fill('吸血');
  await p.waitForSelector('.kb-row[data-knowledge="LIFESTEAL"]');
  check('search 吸血 -> LIFESTEAL',await p.locator('.kb-row[data-knowledge="LIFESTEAL"]').count()===1);
  await p.locator('.kb-row[data-knowledge="LIFESTEAL"]').click();
  await p.waitForSelector('.knowledge-sheet');
  check('sheet opens',await p.locator('.knowledge-sheet').count()===1);
  const sheetText=await p.locator('.knowledge-sheet-card').innerText();
  check('sheet explains 吸血',sheetText.includes('吸血')&&sheetText.includes('HP'));
  await p.locator('[data-knowledge-close]').click();
  check('sheet closes',await p.locator('.knowledge-sheet').count()===0);
  // search 疲劳 -> FATIGUE_RATE + BATTLE_WEAR
  await p.locator('[data-kb-search]').fill('疲劳');
  await p.waitForSelector('.kb-row[data-knowledge="FATIGUE_RATE"]');
  check('search 疲劳 -> FATIGUE_RATE',await p.locator('.kb-row[data-knowledge="FATIGUE_RATE"]').count()===1);
  check('search 疲劳 -> BATTLE_WEAR',await p.locator('.kb-row[data-knowledge="BATTLE_WEAR"]').count()===1);
  // search 攻击 (Chinese) -> ATK (参数 + 公式变量 both carry data-knowledge=ATK)
  await p.locator('[data-kb-search]').fill('攻击');
  await p.waitForSelector('.kb-row[data-knowledge="ATK"]');
  check('search 攻击 -> ATK',await p.locator('.kb-row[data-knowledge="ATK"]').count()>=1);
  // category browse
  await p.locator('[data-kb-search]').fill('');
  await p.selectOption('[data-kb-cat]','time');
  await p.waitForSelector('.kb-row[data-knowledge="BATTLE_WEAR"]');
  check('category 成长与疲劳 lists BATTLE_WEAR',await p.locator('.kb-row[data-knowledge="BATTLE_WEAR"]').count()===1);
  // close encyclopedia, go to battle tab -> card picker -> detail -> stat ⓘ
  await p.screenshot({path:path.join(OUT,'v4-mobile-encyclopedia.png')});
  await p.locator('[data-kb-close]').click();
  check('encyclopedia closes with real control',await p.locator('.picker-overlay').count()===0);
  check('scroll unlocks',await p.locator('body').evaluate(el=>!el.classList.contains('picker-open')));
  await p.locator('[data-action="open-knowledge"]').click();
  await p.goBack();
  await p.waitForFunction(()=>!document.querySelector('.picker-overlay'));
  check('browser back closes overlay',await p.locator('.picker-overlay').count()===0);
  await p.locator('[data-tab="battle"]').click();
  await p.waitForSelector('[data-open-picker="left"]');
  await p.locator('[data-open-picker="left"]').click();
  await p.locator('.selection-card [data-browser-detail]').first().click();
  await p.locator('.browser-detail summary').first().click(); // open 详细数值
  check('detail stat rows have knowledge buttons',await p.locator('.browser-detail [data-knowledge]').count()>=4);
  await p.locator('.browser-detail [data-knowledge="ATK"]').first().click();
  await p.waitForSelector('.knowledge-sheet');
  check('stat ⓘ opens sheet',await p.locator('.knowledge-sheet').count()===1);
  await p.screenshot({path:path.join(OUT,'v4-mobile-stat.png'),animations:'disabled'});await p.keyboard.press('Escape');
  check('escape closes top sheet only',await p.locator('.knowledge-sheet').count()===0&&await p.locator('.picker-overlay').count()===1);
  check('focus returns to stat',await p.locator('.browser-detail [data-knowledge="ATK"]').first().evaluate(el=>el===document.activeElement));
  check('no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check('console healthy',report.errors.length===0);
  await p.screenshot({path:path.join(OUT,'v4-knowledge-mobile.png')});
 }catch(e){report.failure=e.stack;process.exitCode=1;}
 finally{fs.writeFileSync(path.join(OUT,'browser-knowledge.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks,errors:report.errors,failure:report.failure}));await browser.close();}
})();