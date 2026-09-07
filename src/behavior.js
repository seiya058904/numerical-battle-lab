// Behavior Analyzer — post-hoc, presentation-only card characterization.
//
// Strict order: the card is FULLY generated first, then this module reads its
// final stats/actions/statuses/triggers/time variables and derives behavior
// tags + a one-line summary. It NEVER feeds generation or AI:
//   - generator never calls it (proven by tests: cards carry no behaviorTags)
//   - AI reads only real stats/actions/state (proven by tests: adding tags to a
//     card does not change planAI output)
// It replaces the old "class" (Balanced/Tank/...) as the player-facing label.
(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};

  function stat(card,key,dflt=0){const v=Number(card.stats?.[key]);return Number.isFinite(v)?v:dflt;}
  function walk(effects){
    const out=[];
    const go=e=>{if(!e||typeof e!=='object')return;if(e.type)out.push(e.type);if(e.effects)for(const x of e.effects)go(x);if(e.then)go(e.then);if(e.else)go(e.else);};
    for(const e of effects||[])go(e);
    return out;
  }

  function analyzeBehavior(card){
    if(!card)return{tags:['未知'],summary:''};
    const tags=[];
    const s=card.stats||{};
    const actions=card.actions||card.skills||[];
    const effects=actions.flatMap(a=>walk(a.effects));
    const kinds=new Set(actions.map(a=>a.kind));
    const damageActions=actions.filter(a=>effectsOfKind(a,'damage').length>0);
    const healActions=actions.filter(a=>effectsOfKind(a,'heal').length>0);
    const shieldActions=actions.filter(a=>effectsOfKind(a,'shield').length>0||effectsOfKind(a,'ward').length>0);
    const dotActions=actions.filter(a=>effectsOfKind(a,'dot').length>0||effectsOfKind(a,'status').length>0);
    const statusActions=actions.filter(a=>effectsOfKind(a,'status').length>0);
    const triggers=(card.triggers||[]).map(t=>t.event);

    // ---- salience: each candidate tag carries a signal strength ----
    const vol=stat(card,'VOLATILITY',1),luck=stat(card,'LUCK',0);
    const rampRate=stat(card,'RAMP_RATE',0),fatRate=stat(card,'FATIGUE_RATE',0),end=stat(card,'ENDURANCE',50);
    const atk=stat(card,'ATK'),hp=stat(card,'MAX_HP'),crit=stat(card,'CRIT',0);
    const burstScore=damageActions.reduce((n,a)=>{const eff=effectsOfKind(a,'damage');let multi=0;for(const e of eff){if(e.effects&&e.repeat)multi+=(Number(e.repeat.times)||1);if(e.critBonus)multi+=0.5;}return n+Math.max(1,multi);},0);
    const spd=stat(card,'SPD'),def=stat(card,'DEF'),res=stat(card,'RES',0);
    const effHp=hp+def*0.6+res*0.6;
    const cand=[];const add=(t,s)=>cand.push([t,Number(s)||0]);
    if(vol>=1.6)add('高波动',(vol-1.6)*2+1);else if(vol<=0.6)add('稳定',(0.6-vol)*2+1);
    if(Math.abs(luck)>=0.6)add('赌徒型',Math.abs(luck));
    if(rampRate>0&&fatRate>0)add('长线型',rampRate*40+fatRate*20);
    else if(rampRate>0)add('后期成长',rampRate*40);
    if(fatRate>0&&stat(card,'FATIGUE_START',999)<10)add('易疲劳',fatRate*30);
    if(end>=75)add('高耐力',end/100*2);
    if(atk>=80&&burstScore>=2)add('高爆发',(atk-80)/10+burstScore);
    else if(atk<=35)add('低爆发',(35-atk)/5);
    if(crit>=30)add('高暴击',crit/25);
    if(stat(card,'EVA',0)>=20)add('高闪避',stat(card,'EVA',0)/12);
    if(stat(card,'ACC',0)>=105)add('高命中',stat(card,'ACC',0)/30);
    if(spd>=85)add('高速',spd/45);else if(spd<=40)add('慢速',(40-spd)/10);
    if(effHp>=300)add('高耐久',effHp/120);else if(effHp<=140)add('低耐久',(140-effHp)/30);
    if(healActions.length>0||effects.includes('heal'))add('高回复',healActions.length*1.5+(effects.includes('heal')?0.5:0));
    if(shieldActions.length>0)add('护盾型',shieldActions.length*1.5);
    if(stat(card,'LIFESTEAL',0)>=12)add('吸血',stat(card,'LIFESTEAL',0)/8);
    if((card.statuses||[]).some(x=>{const d=NCB.STATUS_DEFS[x.id];return d?.reflectPerStack||d?.eventModifiers?.some(m=>m.event==='ModifyDamageTaken'&&m.reflect);}))add('反伤',2);
    if(stat(card,'PEN',0)>=25)add('穿透',stat(card,'PEN',0)/10);
    if(dotActions.length>0||(card.statuses||[]).some(x=>NCB.STATUS_DEFS[x.id]?.periodic))add('DoT',(dotActions.length+((card.statuses||[]).some(x=>NCB.STATUS_DEFS[x.id]?.periodic)?1:0))*1.5);
    if(effects.includes('consumeStatus'))add('状态引爆',2);
    if(statusActions.length>0&&damageActions.length<=1)add('状态压制',statusActions.length*1.2);
    if(effects.includes('gain')||effects.includes('resource')||effects.includes('convertResource')||stat(card,'ENERGY_REGEN',0)>=3)add('资源循环',2);
    if(effects.includes('cooldownReduce'))add('冷却循环',1.5);
    if(effects.includes('selfDamagePct'))add('自残',1.5);
    if(damageActions.length===0)add('低伤控制',2);
    if(damageActions.length===0&&healActions.length===0&&shieldActions.length===0&&statusActions.length===0)add('防御型',3);

    cand.sort((a,b)=>b[1]-a[1]);
    const picked=cand.map(x=>x[0]).slice(0,4);
    if(!picked.length)picked.push('均衡');

    const summary=buildSummary(picked,card);
    return{tags:picked,summary};
  }

  function buildSummary(tags,card){
    const has=(t)=>tags.includes(t);
    if(has('后期成长'))return '前期输出普通，但战斗拖长后逐渐增强，适合打持久战。';
    if(has('易疲劳')&&has('高波动'))return '出手猛烈但不稳定，且随着战斗进行迅速疲惫，需要速战速决。';
    if(has('高波动')&&has('赌徒型'))return '运气成分很大，一回合可能打出极高或极低的发挥。';
    if(has('高爆发'))return '擅长在短时间内打出极高伤害，把战斗压缩到几个回合内。';
    if(has('状态压制')||has('DoT'))return '不依赖直接伤害，通过状态与持续效果逐步压垮对手。';
    if(has('高回复')&&has('高耐力'))return '恢复力强且极耐消耗，是典型的长期战专家。';
    if(has('资源循环'))return '依靠资源循环驱动行动，节奏稳定但需要时间运转。';
    if(has('自残'))return '愿意牺牲自身生命换取更强输出，风险与收益并存。';
    if(has('吸血'))return '伤害同时回复自身生命，越打越站的战斗风格。';
    if(has('反伤')||has('护盾型'))return '以防御姿态见长，把对手的攻击转化为自己的优势。';
    if(has('高速'))return '速度快，往往先手发动行动。';
    if(has('稳定'))return '输出平稳可靠，很少出现极端发挥。';
    return `以${tags.join('、')}见长的战斗个体。`;
  }

  function effectsOfKind(action,kind){
    const out=[];
    const go=e=>{if(!e||typeof e!=='object')return;if(e.type===kind)out.push(e);if(e.effects)for(const x of e.effects)go(x);if(e.then)go(e.then);if(e.else)go(e.else);};
    for(const e of action.effects||[])go(e);
    return out;
  }

  NCB.analyzeBehavior=analyzeBehavior;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);