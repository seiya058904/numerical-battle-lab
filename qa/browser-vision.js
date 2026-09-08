const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const OUT=__dirname;
const pairs=[[0,5],[10,15],[20,25],[30,35],[40,45],[50,55],[1,6],[11,16],[21,26],[31,36],[41,46],[51,56],[2,3],[22,23],[42,43]];
(async()=>{
 const browser=await chromium.launch({channel:'chrome',args:['--no-proxy-server']});
 if(process.argv.includes('--surfaces')){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await context.newPage();
  const errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8774/');await p.screenshot({path:path.join(OUT,'v4-mobile-home.png')});
  await p.locator('[data-tab="generate"]').click();await p.locator('[data-gen-rarity]').selectOption('XS_COLLECTOR');await p.locator('[data-gen-level]').fill('47');
  await p.screenshot({path:path.join(OUT,'v4-mobile-create.png')});
  await p.locator('[data-action="generate-roll"]').click();checks.push({name:'create rarity and arbitrary level',pass:(await p.locator('#view-generate .card').innerText()).includes('Lv.47')});
  await p.locator('#view-generate .card').screenshot({path:path.join(OUT,'v4-generated-collector.png')});
  await p.locator('[data-tab="help"]').click();await p.screenshot({path:path.join(OUT,'v4-mobile-tutorial.png')});
  checks.push({name:'tutorial contains BP, randomness and growth',pass:/战力/.test(await p.locator('#view-help').innerText())&&/波动/.test(await p.locator('#view-help').innerText())&&/成长/.test(await p.locator('#view-help').innerText())});
  await p.locator('[data-action="open-knowledge"]').click();await p.locator('[data-kb-search]').fill('吸血');await p.locator('[data-knowledge="LIFESTEAL"]').first().click();await p.locator('[data-knowledge-close]').click();await p.locator('[data-kb-close]').click();
  checks.push({name:'close returns to help with scroll enabled',pass:await p.locator('body').evaluate(el=>!el.classList.contains('picker-open'))});
  checks.push({name:'mobile no overflow',pass:await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)});
  fs.writeFileSync(path.join(OUT,'browser-vision.json'),JSON.stringify({checks,errors},null,2)+'\n');
  if(errors.length||checks.some(c=>!c.pass))process.exitCode=1;await browser.close();return;
 }
 const rows=[];let next=0;
 async function worker(){
  while(next<pairs.length){const index=next++,pair=pairs[index];const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto('http://127.0.0.1:8774/');
   const cards=await p.evaluate(pair=>pair.map(i=>{const c=NCB.SYSTEM_PRESETS[i];return {id:c.id,name:c.displayName,rarity:c.rarity,level:c.level,tags:NCB.analyzeBehavior(c).tags,summary:NCB.analyzeBehavior(c).summary};}),pair);
   await p.evaluate(()=>{const create=NCB.createBattle;NCB.createBattle=config=>window.__battle=create(config);});
   for(const [side,c] of [['left',cards[0]],['right',cards[1]]]){await p.locator(`[data-open-picker="${side}"]`).click();await p.locator('[data-filter="search"]').fill(c.name);await p.locator(`[data-browser-detail="${c.id}"]`).click();if(index<6)await p.screenshot({path:path.join(OUT,`review-${index+1}-${side}-detail.png`)});await p.locator('[data-detail-select]').click();}
   await p.locator('[data-action="battle-start"]').click();await p.locator('[data-speed="4"]').click();await p.evaluate(()=>scrollTo(0,0));
   const start=Date.now(),observed=[];let captured=false;
   while(Date.now()-start<240000){const state=await p.evaluate(()=>({round:window.__battle?.round,frame:document.querySelector('#view-battle').dataset.frameIndex,text:document.querySelector('.current-event')?.textContent,ended:window.__battle?.outcome().ended,last:window.__battle?.presentationIndex - 1,hp:[...document.querySelectorAll('.entity-card .meter-group')].map(el=>el.innerText)}));if(observed.at(-1)?.frame!==state.frame)observed.push(state);
    if(!captured&&Date.now()-start>3500){await p.screenshot({path:path.join(OUT,`review-${index+1}-battle.png`)});captured=true;}
    if(state.ended&&Number(state.frame)===state.last)break;await p.waitForTimeout(500);
   }
   const result=await p.evaluate(()=>{const e=window.__battle;return {outcome:e.outcome(),rounds:e.history.length,actions:[...new Set(e.log.filter(r=>r.kind==='action').map(r=>r.skillId))],eventKinds:[...new Set(e.log.map(r=>r.kind))],actionCounts:e.log.filter(r=>r.kind==='action').reduce((a,r)=>(a[r.skillId]=(a[r.skillId]||0)+1,a),{}),finishedDisplay:Number(document.querySelector('#view-battle').dataset.frameIndex)===e.presentationIndex - 1};});
   await p.screenshot({path:path.join(OUT,`review-${index+1}-finish.png`)});
   rows.push({index:index+1,cards,...result,wallMs:Date.now()-start,errors,observed});console.log(JSON.stringify({match:index+1,cards:cards.map(c=>c.name),rounds:result.rounds,finished:result.finishedDisplay}));
  }catch(e){rows.push({index:index+1,error:e.stack,errors});console.log(e.message);}finally{await context.close();fs.writeFileSync(path.join(OUT,'human-like-review.json'),JSON.stringify(rows.sort((a,b)=>a.index-b.index),null,2)+'\n');}
  }
 }
 await Promise.all([worker(),worker(),worker()]);if(rows.some(r=>r.error||r.errors?.length||!r.finishedDisplay))process.exitCode=1;await browser.close();
})();
