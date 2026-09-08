'use strict';
// v1.3.1 curation apply: applies the per-card tuning decisions from the design
// review to content/presets-v4.json, records curationVersion=2 + designNotes +
// adjustments[], and regenerates presentation (canonical BP + behavior).
// Pure data transform — never card-specific engine code.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const PATH=path.join(ROOT,'content/presets-v4.json');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior','battlepower-v2'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;
const doc=JSON.parse(fs.readFileSync(PATH,'utf8'));
const cards=doc.cards;
const byName={};for(const c of cards)byName[c.displayName]=c;

// ---- small helpers ----
// walk action effects collecting all nodes (for targeted edits)
function eachEffect(effs,fn){
  for(const e of effs||[]){
    fn(e);
    if(e.effects)eachEffect(e.effects,fn);
    if(e.then)eachEffect(e.then,fn);
    if(e.else)eachEffect(e.else,fn);
  }
}
function findFirstDamage(effs){let out=null;eachEffect(effs,e=>{if(!out&&e.type==='damage')out=e;});return out;}
function findFirstHealOrShield(effs,kinds){let out=null;eachEffect(effs,e=>{if(!out&&kinds.includes(e.type))out=e;});return out;}

// ops structure: {cardName, designNote, ops:[...]}
// each op is one of:
//   {k:'stat', key, after}
//   {k:'cooldown', action, after}
//   {k:'priority', action, after}
//   {k:'unconditional', action}  -> unwrap hpPctBelow-gated conditional around damage/shield, keep inner effects
//   {k:'damageCoef', action, factor, onlyConsume} -> multiply damage numeric coefficients by factor (e.g. * CONSUMED_STACKS forms)
//   {k:'healCoef', action, old, after}
//   {k:'reflect', after}  (stance reflect damage coefficient)
//   {k:'atk', after}
//   {k:'shieldCoef', action, old, after}
const PLAN=[
 // ---- C ----
 {cardName:'砂砾',designNote:'低稀有度状态型长线样本：坚守+破咒叠盾减伤撑到后期成长，蚀爆耗蚀层爆发。压速局：为成长峰值（约第40回合）后接轻度疲劳，让对称长局能收束而不是无限平局。',ops:[
  {k:'stat',key:'FATIGUE_RATE',after:0.006},{k:'stat',key:'FATIGUE_START',after:40},{k:'stat',key:'FATIGUE_CAP',after:0.85}]},
 {cardName:'苔痕',designNote:'高波动低爆发纯防守/损耗卡：EVA姿态减伤拖时间，承诺的“长期损耗”此前从未开启（FATIGUE=0+ENDURANCE 98近似无敌，镜像83回合0伤害）。真正点亮损耗收尾，让磨损局有限回合内必然分胜负。',ops:[
  {k:'stat',key:'FATIGUE_RATE',after:0.012},{k:'stat',key:'FATIGUE_START',after:30},{k:'stat',key:'FATIGUE_CAP',after:0.55},{k:'stat',key:'ENDURANCE',after:35}]},
 // ---- C_PLUS ----
 {cardName:'霜芽',designNote:'后期成长护盾型卡：第7回合起ATK 161→214第40回合触顶，但唯一终结蚀爆被AI零使用，镜像72回合0伤害平局。为成长高峰加真实疲劳，让护盾僵持有尽头。',ops:[
  {k:'stat',key:'FATIGUE_RATE',after:0.02},{k:'stat',key:'ENDURANCE',after:35}]},
 // ---- B ----
 {cardName:'影足',designNote:'宣称“后期成长”的高耐久重坦，实为0伤害纯肉盾（镜像87回合、面板62-87回合互磨盾）。RAMP_START顶格使成长假化。引入真实疲劳磨损 + 后期成长放大，把无限气泡改造成有推进的后期对局。',ops:[
  {k:'stat',key:'FATIGUE_RATE',after:0.03},{k:'stat',key:'FATIGUE_START',after:10},{k:'stat',key:'ENDURANCE',after:35},{k:'stat',key:'RAMP_CAP',after:1.6}]},
 // ---- B_PLUS ----
 {cardName:'暮潮',designNote:'易疲劳高耐久穿透卡，镜像69回合0伤害平局。FATIGUE_RATE过高把ATK 13回合内压到42.4平台，FATIGUE_CAP 0.53锁死爆发/DoT。放缓衰减、抬高峰值，并提升蚀爆（0.72系数过低）让DoT后期能终结。',ops:[
  {k:'stat',key:'FATIGUE_RATE',after:0.02},{k:'stat',key:'FATIGUE_CAP',after:0.75},{k:'damageCoef',action:'蚀爆',factor:1.25}]},
 {cardName:'星隙',designNote:'后期成长高耐久吸血低伤控制，镜像53回合0伤害。RAMP只把ATK 28→35、上限1.25，成长不足。强化ramp斜率与峰值让后期能击穿耐久。',ops:[
  {k:'stat',key:'RAMP_RATE',after:0.04},{k:'stat',key:'RAMP_CAP',after:1.5}]},
 {cardName:'羽冠',designNote:'高耐久长线治愈位，镜像55回合 heal 2214>damage 1931 纯互磨。下调0.24大额治疗并加深后期疲劳，让战斗在成长/疲劳下真正分出胜负。',ops:[
  {k:'healCoef',action:'复苏',old:0.24,after:0.18},{k:'stat',key:'FATIGUE_RATE',after:0.025}]},
 // ---- A ----
 {cardName:'赤隼',designNote:'纯防御坦克（HP222/DEF87），零疲劳零成长，镜像72回合0伤害、面板54-62回合0-24伤害。保留“稳定”身份，仅在60+回合僵持局施加后期疲劳时钟；同时解除蚀爆的hpPctBelow死门控（墙壁互磨时双方永不跌破50%，蚀爆永不触发），让它拥有真实伤害出口。',ops:[
  {k:'stat',key:'FATIGUE_START',after:55},{k:'stat',key:'FATIGUE_RATE',after:0.03},{k:'stat',key:'FATIGUE_CAP',after:0.5},{k:'unconditional',action:'蚀爆'}]},
 {cardName:'苍岩',designNote:'高爆发穿透吸血打手，但过度自续航（回血+护盾+减伤），镜像62回合0伤害、SS面板56回合4伤害。保留前40+回合高速爆发窗口，仅在50+回合僵持施加后期疲劳。',ops:[
  {k:'stat',key:'FATIGUE_START',after:50},{k:'stat',key:'FATIGUE_RATE',after:0.025},{k:'stat',key:'FATIGUE_CAP',after:0.5}]},
 {cardName:'夜枭',designNote:'后期成长DoT高耐坦克，但RAMP第22回合封顶后进入40-84回合零伤害平台，“后期成长”名不副实。成长窗口后加疲劳段强制收束，并提升蚀爆消耗伤害（ATK低基数下1.39系数不足）让后期有击杀能力。',ops:[
  {k:'stat',key:'FATIGUE_START',after:60},{k:'stat',key:'FATIGUE_RATE',after:0.02},{k:'stat',key:'FATIGUE_CAP',after:0.5},{k:'damageCoef',action:'蚀爆',factor:1.22}]},
 {cardName:'孤峰',designNote:'高速高伤脆皮玻璃炮，但突袭依赖targetHasStatus(dot)而此dot全场无人施加，永远走else只囤CHRONO。镜像55回合0伤害、对C+反输。修正死机制：移除突袭对不存在dot的依赖并以CHRONO直接伤害，配合疲劳时钟。',ops:[
  {k:'unconditional',action:'突袭'},{k:'stat',key:'FATIGUE_START',after:30},{k:'stat',key:'FATIGUE_RATE',after:0.03},{k:'stat',key:'FATIGUE_CAP',after:0.5}]},
 // ---- A_PLUS ----
 {cardName:'曜甲',designNote:'高速雷系DoT消耗，镜像50回合0伤害。FATIGUE_CAP 0.6把ATK压到47.4平台。抬高ATK下限(0.78)让蚀爆/DoT能收尾。',ops:[
  {k:'stat',key:'FATIGUE_CAP',after:0.78}]},
 {cardName:'渊鳞',designNote:'高回复穿透长线坦克，镜像54回合0伤害，自疗(0.19)远超条件式输出。下调主回血系数，让成长后的攻击能终结。',ops:[
  {k:'healCoef',action:'复苏',old:0.19,after:0.13}]},
 {cardName:'月镰',designNote:'高速高暴击冰DoT刺客，镜像54回合0伤害，FATIGUE_CAP 0.37把ATK压到48.84。抬高ATK保留下限让高速DoT能终结。',ops:[
  {k:'stat',key:'FATIGUE_CAP',after:0.6}]},
 // ---- S ----
 {cardName:'苍翼',designNote:'先成长后疲劳、靠高防御墙拖长线，镜像79回合0进度。抬高终结技对DEF墙的系数并下调高低免死韧性，让疲劳后期仍能击杀。',ops:[
  {k:'damageCoef',action:'血性猛击',factor:1.3},{k:'stat',key:'ENDURANCE',after:62},{k:'stat',key:'FATIGUE_CAP',after:0.8}]},
 {cardName:'绝刃',designNote:'易疲劳低爆发DoT出血流，镜像81回合 heal 354>damage 177。削超越回复(0.18→0.10)、抬疲劳峰顶(0.54→0.72)并把DoT引爆转为有效DPS。',ops:[
  {k:'healCoef',action:'复苏',old:0.18,after:0.10},{k:'stat',key:'FATIGUE_CAP',after:0.72},{k:'damageCoef',action:'蚀爆',factor:1.3}]},
 {cardName:'暗星',designNote:'高速稳定高耐久空手，镜像88回合0伤害。蚀爆被targetHp<0.4门控锁死而自愈/护盾让双方永不跌破。解除伤害门控、削减自愈，并提升蚀爆消耗伤害，让稳定穿透身份落地终结。',ops:[
  {k:'unconditional',action:'蚀爆'},{k:'stat',key:'FATIGUE_RATE',after:0.02},{k:'stat',key:'ENDURANCE',after:70},{k:'damageCoef',action:'蚀爆',factor:1.13}]},
 // ---- SS ----
 {cardName:'渊影',designNote:'慢速DoT高血坦克，镜像86回合0伤害平局。复苏0.24两次+冷却1+ENDURANCE89锁死。加装疲劳打破互奶锁、提高蚀爆消耗伤害、拉长复苏冷却。',ops:[
  {k:'stat',key:'FATIGUE_RATE',after:0.02},{k:'stat',key:'FATIGUE_START',after:50},{k:'stat',key:'FATIGUE_CAP',after:0.8},{k:'damageCoef',action:'蚀爆',factor:1.1},{k:'cooldown',action:'复苏',after:2}]},
 {cardName:'棱镜',designNote:'资源循环低伤控制，蚀爆伤害+护盾锁在hpPctBelow<0.5，满血时永远走else，镜像50回合0伤害。解除伤害门控使其无条件耗蚀层造成伤害，并补轻度疲劳防无限刷CHRONO。',ops:[
  {k:'unconditional',action:'蚀爆'},{k:'stat',key:'FATIGUE_RATE',after:0.015},{k:'stat',key:'FATIGUE_START',after:60},{k:'stat',key:'FATIGUE_CAP',after:0.8}]},
 {cardName:'时尘',designNote:'易疲劳DoT状态压制，镜像77回合仅36伤害。斩杀突袭被targetHp<0.4锁死。加强蚀爆消耗输出、加快疲劳、放宽突袭门槛到0.6。',ops:[
  {k:'damageCoef',action:'蚀爆',factor:1.15},{k:'stat',key:'FATIGUE_RATE',after:0.03},{k:'stat',key:'FATIGUE_CAP',after:0.7}]},
 // ---- SSS ----
 {cardName:'穹顶',designNote:'高耐久护盾墙，镜像64回合伤害5 vs 治疗290 纯互磨。后期攻势归零。加速疲惫衰并降ENDURANCE，让晚局走向决定性终结。',ops:[
  {k:'stat',key:'FATIGUE_RATE',after:0.05},{k:'stat',key:'ENDURANCE',after:22}]},
 {cardName:'湮灭',designNote:'三连ward+stance减伤护盾墙，SS/SSS_COLLECTOR/镜像三场54回合且我方0伤害。加大并加深疲惫让晚局防护崩解、逼出胜负。',ops:[
  {k:'stat',key:'FATIGUE_RATE',after:0.04},{k:'stat',key:'FATIGUE_CAP',after:0.65}]},
 // ---- SSS_COLLECTOR ----
 {cardName:'虚影',designNote:'第12回合起发力的后期成长DoT高速卡，FATIGUE_START=999永不疲劳，配合护盾第50-69回合互磨不出结果。保留1-30回合成长身份，其后启动疲劳让极限长线收束。',ops:[
  {k:'stat',key:'FATIGUE_START',after:32},{k:'stat',key:'FATIGUE_RATE',after:0.02}]},
 {cardName:'终焉',designNote:'易疲劳巨型护盾坦克（DEF475/ATK71），镜像79回合damage仅50。补足进攻转化：提升ATK与蚀爆消耗系数，让疲劳坦能兑现击杀。',ops:[
  {k:'stat',key:'ATK',after:95},{k:'damageCoef',action:'蚀爆',factor:1.4}]},
 {cardName:'幻梦',designNote:'纯回复+护盾+反击超级高闪避耐久卡，镜像87回合DRAW、全部myDamage 0（最严重）。回收永动回复（复苏冷却2→4）、强化反击转化、加速疲劳，把无限平局变可收束消耗。',ops:[
  {k:'cooldown',action:'复苏',after:4},{k:'reflect',after:0.45},{k:'stat',key:'FATIGUE_RATE',after:0.02}]},
 // ---- XS ----
 {cardName:'深渊',designNote:'延后成长慢防御塔，镜像76回合0伤害、面板56-76回合全程0伤害。唯一输出被hp<0.5锁死。抬高输出动作优先级并绑定战斗时长（疲劳）终结僵持。',ops:[
  {k:'stat',key:'ENDURANCE',after:50},{k:'stat',key:'FATIGUE_RATE',after:0.004},{k:'stat',key:'FATIGUE_START',after:28},{k:'priority',action:'血性猛击',after:3}]},
 {cardName:'破晓',designNote:'高耐久资源循环后期成长，镜像82回合0伤害，无任何直伤出口。降低ENDURANCE、给长期战争取损耗收尾，并提升唯一输出的反击转化。',ops:[
  {k:'stat',key:'ENDURANCE',after:56},{k:'stat',key:'FATIGUE_RATE',after:0.005},{k:'stat',key:'FATIGUE_START',after:35},{k:'reflect',after:0.28}]},
 // ---- XS_COLLECTOR ----
 {cardName:'无极',designNote:'后期成长高爆发DoT，但RAMP第1回合即满、FATIGUE无限，镜像/65回合磨活。注入第30回合起0.8封顶疲劳，让成长峰值后可收束。',ops:[
  {k:'stat',key:'FATIGUE_RATE',after:0.02},{k:'stat',key:'FATIGUE_START',after:30},{k:'stat',key:'FATIGUE_CAP',after:0.8}]},
];

// ---- apply ----
const appliedAdjustments=[];
function setStat(c,k,v){const old=c.stats[k];c.stats[k]=v;return{field:'stats.'+k,before:old,after:v};}
function applyCard(entry){
  const c=byName[entry.cardName];
  if(!c){console.error('MISSING CARD '+entry.cardName);return false;}
  const local=[];
  for(const op of entry.ops){
    if(op.k==='stat'){local.push(setStat(c,op.key,op.after));continue;}
    if(op.k==='atk'){local.push(setStat(c,'ATK',op.after));continue;}
    if(op.k==='cooldown'){const a=c.actions.find(x=>x.name===op.action);if(!a){console.error(entry.cardName+' no action '+op.action);continue;}const old=a.cooldown;a.cooldown=op.after;local.push({field:'actions.'+op.action+'.cooldown',before:old,after:op.after});continue;}
    if(op.k==='priority'){const a=c.actions.find(x=>x.name===op.action);if(!a){console.error(entry.cardName+' no action '+op.action);continue;}const old=a.priority;a.priority=op.after;local.push({field:'actions.'+op.action+'.priority',before:old,after:op.after});continue;}
    if(op.k==='reflect'){
      let changed=false;
      for(const st of c.statuses||[]){for(const t of st.triggers||[]){if(t.event==='afterDamageTaken'){for(const e of t.effects||[]){if(e.type==='damage'){const m=e.formula.match(/(\d+\.?\d*)/);if(m){const old=Number(m[1]);e.formula=e.formula.replace(m[1],String(op.after));changed=true;local.push({field:'statuses.'+st.id.split(':').pop()+'.reflect',before:old,after:op.after});}}}}}}
      if(!changed)console.warn(entry.cardName+' reflect not found');
      continue;
    }
    if(op.k==='unconditional'){
      const a=c.actions.find(x=>x.name===op.action);if(!a){console.error(entry.cardName+' no action '+op.action);continue;}
      // Recursively unwrap ANY conditional whose condition indefinitely blocks
      // the card's own damage/status (hpPctBelow / targetHpPctBelow on a healthy
      // card, or targetHasStatus on a status no source applies). Replace each such
      // gated node with its 'then' effects in place (also inside repeat/then/etc.).
      const UNWRAP=new Set(['hpPctBelow','targetHpPctBelow','targetHasStatus']);
      let unwrapped=0;
      const rebuild=(effs)=>{
        const out=[];
        for(const e of effs||[]){
          if(e.type==='conditional'&&e.condition&&UNWRAP.has(e.condition.type)){
            out.push(...(e.then?rebuild(e.then):[]));
            if(e.else)out.push(...rebuild(e.else));
            unwrapped++;
            continue;
          }
          const clone={...e};
          if(e.effects)clone.effects=rebuild(e.effects);
          if(e.then)clone.then=rebuild(e.then);
          if(e.else)clone.else=rebuild(e.else);
          out.push(clone);
        }
        return out;
      };
      a.effects=rebuild(a.effects);
      if(unwrapped)local.push({field:'actions.'+op.action+'.unconditional('+unwrapped+' dead-gate removed)',before:'gated',after:'always'});
      else console.warn(entry.cardName+' '+op.action+' had no gate to unwrap');
      continue;
    }
    if(op.k==='damageCoef'){
      const a=c.actions.find(x=>x.name===op.action);if(!a){console.error(entry.cardName+' no action '+op.action);continue;}
      let changed=false;
      eachEffect(a.effects,e=>{if(e.type==='damage'){
        const m=e.formula.match(/(\d+\.?\d*)/);if(m&&!e.formula.includes('/')){const old=Number(m[1]);const after=Math.round(old*op.factor*100)/100;e.formula=e.formula.replace(m[1],String(after));changed=true;local.push({field:'actions.'+op.action+'.damage.coef',before:old,after});}
      }});
      if(!changed)console.warn(entry.cardName+' damageCoef not applied to '+op.action);
      continue;
    }
    if(op.k==='healCoef'){
      const a=c.actions.find(x=>x.name===op.action);if(!a){console.error(entry.cardName+' no action '+op.action);continue;}
      const e=findFirstHealOrShield(a.effects,['heal','shield']);if(!e){console.warn(entry.cardName+' no heal/shield in '+op.action);continue;}
      const m=e.formula.match(/(\d+\.?\d*)/);if(!m){console.warn(entry.cardName+' no coeff in '+op.action+' formula '+e.formula);continue;}
      const old=Number(m[1]);e.formula=e.formula.replace(m[1],String(op.after));local.push({field:'actions.'+op.action+'.'+e.type+'.coef',before:old,after:op.after});
      continue;
    }
    if(op.k==='shieldCoef'){
      const a=c.actions.find(x=>x.name===op.action);if(!a){console.error(entry.cardName+' no action '+op.action);continue;}
      const e=findFirstHealOrShield(a.effects,['shield','ward']);if(!e){console.warn(entry.cardName+' no shield in '+op.action);continue;}
      const m=e.formula.match(/(\d+\.?\d*)/);const old=Number(m[1]);e.formula=e.formula.replace(m[1],String(op.after));local.push({field:'actions.'+op.action+'.shield.coef',before:old,after:op.after});
      continue;
    }
    console.warn('unknown op '+op.k);
  }
  c.adjustments=local;
  c.designNote=entry.designNote;
  appliedAdjustments.push({card:entry.cardName,count:local.length,adjustments:local});
  return true;
}

let tuned=0,unchanged=0;
const tunedNames=new Set(PLAN.map(p=>p.cardName));
for(const c of cards){
  if(tunedNames.has(c.displayName)){const ok=applyCard(PLAN.find(p=>p.cardName===c.displayName));if(ok)tuned++;}
  else{unchanged++;c.adjustments=[];c.designNote=(c.designNote||c.displayName)+'（本轮逐张复审通过，无需调整。）';}
}

// curationVersion 2 + provenance
doc.curationVersion=2;
for(const c of cards){c.curationVersion=2;c.curated=true;}

// regenerate presentation: canonical BP + behavior (post-tune)
let bpMismatch=0;
for(const c of cards){
  const bp=N.battlePowerV2(c).power;
  const beh=N.analyzeBehavior(c);
  c.presentation={power:bp,behaviorTags:beh.tags,behaviorSummary:beh.summary};
}
for(const c of cards){if(!Number.isFinite(c.presentation.power))bpMismatch++;}

fs.writeFileSync(PATH,JSON.stringify(doc,null,2)+'\n');
fs.writeFileSync(path.join(ROOT,'content/presets-v4.js'),'// Generated from presets-v4.json; offline browser transport.\n(function(r){r.NCB.PRESET_V4_CONTENT='+JSON.stringify(doc)+';})(globalThis);\n');
console.log('tuned cards:',tuned,'unchanged:',unchanged,'total:',cards.length);
console.log('bpMismatch:',bpMismatch);
console.log('total adjustments:',appliedAdjustments.reduce((n,x)=>n+x.count,0));
for(const a of appliedAdjustments){if(a.count)console.log('  '+a.card+': '+a.count+' adj');}