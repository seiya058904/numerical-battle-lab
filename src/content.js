(function (root) {
  'use strict';
  const NCB = root.NCB = root.NCB || {};

  const STATUSES = {
    fortified:{id:'fortified',name:'坚固',kind:'buff',maxStacks:1,stacking:'refresh',modifiers:[{stat:'DEF',operation:'multiply',value:1.35},{stat:'RES',operation:'multiply',value:1.20}]},
    vulnerable:{id:'vulnerable',name:'易伤',kind:'debuff',maxStacks:3,stacking:'stack',incomingMultPerStack:0.12},
    weak:{id:'weak',name:'虚弱',kind:'debuff',maxStacks:2,stacking:'stack',outgoingMultPerStack:-0.13},
    haste:{id:'haste',name:'迅捷',kind:'buff',maxStacks:2,stacking:'stack',modifiers:[{stat:'SPD',operation:'multiplyPerStack',value:0.18}]},
    slow:{id:'slow',name:'迟缓',kind:'debuff',maxStacks:2,stacking:'stack',tags:['slow'],modifiers:[{stat:'SPD',operation:'multiplyPerStack',value:-0.18}]},
    focus:{id:'focus',name:'专注',kind:'buff',maxStacks:2,stacking:'stack',modifiers:[{stat:'CRIT',operation:'addPerStack',value:12},{stat:'ACC',operation:'addPerStack',value:8}]},
    evasion:{id:'evasion',name:'闪避',kind:'buff',maxStacks:2,stacking:'stack',modifiers:[{stat:'EVA',operation:'addPerStack',value:15}]},
    marked:{id:'marked',name:'标记',kind:'debuff',maxStacks:1,stacking:'refresh',incomingMultPerStack:0.18},
    guard:{id:'guard',name:'守护',kind:'buff',maxStacks:1,stacking:'refresh',incomingMultPerStack:-0.30,flags:{guard:true}},
    stun:{id:'stun',name:'眩晕',kind:'debuff',maxStacks:1,stacking:'refresh',tags:['control','stun'],flags:{stun:true}},
    silence:{id:'silence',name:'沉默',kind:'debuff',maxStacks:1,stacking:'refresh',tags:['control','silence'],flags:{silence:true}},
    poison:{id:'poison',name:'中毒',kind:'debuff',maxStacks:5,stacking:'stack',tags:['poison','dot'],periodic:{timing:'turnEnd',effects:[{type:'damage',damageType:'toxic',formula:'TARGET_MAX_HP * 0.025 * STACKS',penetration:0,canMiss:false,canCrit:false,canReflect:false,tags:['dot','poison']}]}},
    burn:{id:'burn',name:'灼烧',kind:'debuff',maxStacks:3,stacking:'stack',tags:['fire','dot'],modifiers:[{stat:'ATK',operation:'multiplyPerStack',value:-0.06}],periodic:{timing:'turnEnd',effects:[{type:'damage',damageType:'fire',formula:'TARGET_MAX_HP * 0.022 * STACKS',penetration:0,canMiss:false,canCrit:false,canReflect:false,tags:['dot','burn']}]}},
    bleed:{id:'bleed',name:'流血',kind:'debuff',maxStacks:5,stacking:'stack',tags:['bleed','dot'],turnEnd:{type:'damagePctCurrentHp',pct:0.035,perStack:true,min:2}},
    regen:{id:'regen',name:'再生',kind:'buff',maxStacks:3,stacking:'stack',periodic:{timing:'turnEnd',effects:[{type:'heal',formula:'TARGET_MAX_HP * 0.035 * STACKS'}]}},
    thorns:{id:'thorns',name:'荆棘',kind:'buff',maxStacks:2,stacking:'stack',triggers:[{event:'afterDamageTaken',target:'other',condition:{not:{type:'tag',tag:'reflect'}},effects:[{type:'damage',damageType:'true',formula:'EVENT_HP_DAMAGE * 0.12 * STACKS',canMiss:false,canCrit:false,canReflect:false,tags:['reflect']}]}]},
    overdrive:{id:'overdrive',name:'超载',kind:'buff',maxStacks:1,stacking:'refresh',modifiers:[{stat:'ATK',operation:'multiply',value:1.25},{stat:'SPD',operation:'multiply',value:1.20}],periodic:{timing:'turnEnd',effects:[{type:'damage',damageType:'true',formula:'TARGET_MAX_HP * 0.035 * STACKS',canMiss:false,canCrit:false,canReflect:false,tags:['recoil']}]}},

    'armor-break':{id:'armor-break',name:'破甲',kind:'debuff',maxStacks:3,stacking:'stack',tags:['armor-break'],modifiers:[{stat:'DEF',operation:'multiplyPerStack',value:-0.12}]},
    'spell-break':{id:'spell-break',name:'破法抗',kind:'debuff',maxStacks:3,stacking:'stack',tags:['spell-break'],modifiers:[{stat:'RES',operation:'multiplyPerStack',value:-0.12}]},
    shock:{id:'shock',name:'感电',kind:'debuff',maxStacks:3,stacking:'stack',tags:['lightning'],modifiers:[{stat:'SPD',operation:'multiplyPerStack',value:-0.10},{stat:'ACC',operation:'addPerStack',value:-6}]},
    grievous:{id:'grievous',name:'重伤',kind:'debuff',maxStacks:3,stacking:'stack',tags:['healing-reduction'],modifiers:[{stat:'HEAL_TAKEN',operation:'addPerStack',value:-18}]},
    'fire-ward':{id:'fire-ward',name:'火焰护持',kind:'buff',maxStacks:1,stacking:'refresh',resistanceMods:[{type:'fire',operation:'add',value:0.30}]},
    'frost-ward':{id:'frost-ward',name:'寒霜护持',kind:'buff',maxStacks:1,stacking:'refresh',resistanceMods:[{type:'frost',operation:'add',value:0.30}]},
    aegis:{id:'aegis',name:'圣盾祝福',kind:'buff',maxStacks:1,stacking:'refresh',modifiers:[{stat:'DEF',operation:'multiply',value:1.12},{stat:'RES',operation:'multiply',value:1.12},{stat:'HEAL_TAKEN',operation:'add',value:12}]},
    hex:{id:'hex',name:'咒印',kind:'debuff',maxStacks:5,stacking:'stack',tags:['curse'],modifiers:[{stat:'RES',operation:'multiplyPerStack',value:-0.04}]},
    'soul-fed':{id:'soul-fed',name:'噬魂',kind:'buff',maxStacks:3,stacking:'stack',modifiers:[{stat:'ATK',operation:'addPerStack',value:6},{stat:'CRIT',operation:'addPerStack',value:4}]},
    'temporal-focus':{id:'temporal-focus',name:'时序聚焦',kind:'buff',maxStacks:2,stacking:'stack',modifiers:[{stat:'SPD',operation:'addPerStack',value:12},{stat:'ACC',operation:'addPerStack',value:6}]},
    'blood-pact':{id:'blood-pact',name:'血契',kind:'buff',maxStacks:2,stacking:'stack',modifiers:[{stat:'LIFESTEAL',operation:'addPerStack',value:8},{stat:'HEAL_TAKEN',operation:'addPerStack',value:6}]},
    precision:{id:'precision',name:'精确姿态',kind:'buff',maxStacks:1,stacking:'refresh',eventModifiers:[{event:'ModifyAccuracy',operation:'add',value:0.06},{event:'ModifyPenetration',operation:'add',value:8}]},
    'battle-trance':{id:'battle-trance',name:'战斗狂热',kind:'buff',maxStacks:1,stacking:'refresh',eventModifiers:[{event:'ModifyCritChance',operation:'add',value:14}]},
    kindled:{id:'kindled',name:'炽燃',kind:'buff',maxStacks:1,stacking:'refresh',eventModifiers:[{event:'ModifyDamageDealt',operation:'multiply',value:1.14,condition:{type:'tag',tag:'fire'}}]},
    'runic-guard':{id:'runic-guard',name:'符文架势',kind:'buff',maxStacks:1,stacking:'refresh',duration:null,tags:['sustain','stance'],upkeep:{resource:'ENERGY',amount:1,timing:'roundStart'},modifiers:[{stat:'DEF',operation:'multiply',value:1.14},{stat:'RES',operation:'multiply',value:1.14}],resistanceMods:[{type:'all',operation:'add',value:0.08}]},
    'radiant-aura':{id:'radiant-aura',name:'辉光圣环',kind:'buff',maxStacks:1,stacking:'refresh',duration:null,tags:['sustain','aura'],upkeep:{resource:'ENERGY',amount:1,timing:'roundStart'},modifiers:[{stat:'RES',operation:'multiply',value:1.08}],triggers:[{event:'roundStart',target:'all-allies',effects:[{type:'status',status:'aegis',duration:1}]}]},
  };

  function dmg(id,name,formula,power,type='physical',extra={}) {
    return {id,name,kind:'damage',target:'enemy',cost:1,cooldown:0,priority:0,accuracy:0.94,damageType:type,formula,power,effects:[{type:'damage'}],...extra};
  }
  const SKILLS = {
    'shield-bash':{...dmg('shield-bash','盾击','ATK * 0.72 + DEF * 0.35',0.72),cost:1,effects:[{type:'damage'},{type:'status',status:'stun',chance:0.28,duration:1,condition:{type:'lastHit'}}]},
    'fortify':{id:'fortify',name:'壁垒',kind:'support',target:'self',cost:1,cooldown:2,effects:[{type:'status',status:'fortified',duration:2},{type:'shield',formula:'MAX_HP * 0.18'}]},
    'last-stand':{id:'last-stand',name:'最后阵线',kind:'support',target:'all-allies',cost:3,cooldown:4,priority:1,effects:[{type:'status',status:'guard',duration:1},{type:'shield',formula:'MAX_HP * 0.10'}]},

    'quick-cut':{...dmg('quick-cut','迅斩','ATK * 0.82',0.82),priority:2,cost:1,accuracy:0.98},
    'riposte':{...dmg('riposte','反击式','ATK * 1.05 + SPD * 0.18',1.05),cost:2,effects:[{type:'damage'},{type:'status',status:'evasion',duration:1,effectTarget:'actor'}]},
    'execution':{...dmg('execution','处决','ATK * (1.05 + (1 - TARGET_HP_PCT) * 1.10)',1.2),cost:3,cooldown:2,critBonus:15},

    'rage-slash':{...dmg('rage-slash','怒斩','ATK * (0.88 + RAGE * 0.08)',0.9),cost:1,effects:[{type:'damage'},{type:'gain',resource:'RAGE',amount:1}]},
    'blood-rush':{id:'blood-rush',name:'血涌',kind:'support',target:'self',cost:1,cooldown:2,effects:[{type:'status',status:'overdrive',duration:2},{type:'status',status:'battle-trance',duration:2},{type:'heal',formula:'MAX_HP * 0.08'}]},
    'reckless-cleave':{...dmg('reckless-cleave','狂乱横扫','ATK * (0.72 + RAGE * 0.05)',0.75),target:'all-enemies',cost:2,costs:[{resource:'RAGE',amount:2}],cooldown:2,accuracy:0.90,effects:[{type:'damage'},{type:'selfDamagePct',pct:0.06}]},

    'piercing-shot':{...dmg('piercing-shot','穿甲射击','ATK * 1.02 + SPD * 0.12',1.05),cost:1,penetrationBonus:30},
    'mark-target':{id:'mark-target',name:'猎手标记',kind:'debuff',target:'enemy',cost:1,cooldown:1,accuracy:1,effects:[{type:'status',status:'marked',duration:3},{type:'status',status:'precision',duration:2,effectTarget:'actor'}]},
    'volley':{...dmg('volley','齐射','ATK * 0.62',0.62),target:'all-enemies',cost:3,cooldown:2,accuracy:0.90},

    'firebolt':{...dmg('firebolt','火矢','ATK * 0.95 + 18',1.0,'fire'),cost:1,effects:[{type:'damage'},{type:'status',status:'burn',chance:0.45,duration:3,condition:{type:'lastHit'}}]},
    'ignite':{...dmg('ignite','点燃','ATK * 0.62 + TARGET_MAX_HP * 0.035',0.7,'fire'),cost:2,cooldown:1,effects:[{type:'damage'},{type:'status',status:'burn',duration:3,stacks:2,condition:{type:'lastHit'}},{type:'status',status:'kindled',duration:2,effectTarget:'actor',condition:{type:'lastHit'}}]},
    'inferno':{...dmg('inferno','炼狱','ATK * 0.78 + 26',0.85,'fire'),target:'all-enemies',cost:3,cooldown:3,accuracy:0.88,effects:[{type:'damage'},{type:'status',status:'burn',chance:0.70,duration:2,condition:{type:'lastHit'}}]},

    'ice-lance':{...dmg('ice-lance','冰枪','ATK * 0.92 + (TARGET_STATUS_SLOW * 22)',0.95,'frost'),cost:1,effects:[{type:'damage'},{type:'status',status:'slow',chance:0.45,duration:2,condition:{type:'lastHit'}}]},
    'slow-field':{id:'slow-field',name:'霜域',kind:'debuff',target:'all-enemies',cost:2,cooldown:2,accuracy:1,effects:[{type:'status',status:'slow',duration:2}]},
    'shatter':{...dmg('shatter','碎冰','ATK * (TARGET_STATUS_SLOW ? 1.65 : 0.72)',1.1,'frost'),cost:3,cooldown:2,critBonus:10},

    'pulse-heal':{id:'pulse-heal',name:'脉冲治疗',kind:'heal',target:'ally',cost:1,formula:'ATK * 0.60 + MAX_HP * 0.11',effects:[{type:'heal'}]},
    'cleanse':{id:'cleanse',name:'净化',kind:'support',target:'ally',cost:2,cooldown:2,effects:[{type:'cleanse',count:2},{type:'heal',formula:'MAX_HP * 0.08'}]},
    'barrier':{id:'barrier',name:'屏障',kind:'support',target:'ally',cost:2,cooldown:1,effects:[{type:'shield',formula:'ATK * 0.45 + MAX_HP * 0.12'}]},

    'focus-beam':{...dmg('focus-beam','聚焦束','ATK * 1.08 + CRIT * 0.7',1.1,'arcane'),cost:1,critBonus:12},
    'haste':{id:'haste',name:'时间加速',kind:'support',target:'ally',cost:1,cooldown:1,effects:[{type:'status',status:'haste',duration:2},{type:'status',status:'focus',duration:2}]},
    'rewind':{id:'rewind',name:'回溯',kind:'support',target:'ally',cost:3,cooldown:4,effects:[{type:'cooldownReduce',amount:2},{type:'energy',amount:1}]},
    'fate-theft':{id:'fate-theft',name:'命运剥离',kind:'debuff',target:'enemy',cost:2,cooldown:2,effects:[{type:'dispel',kind:'buff',count:1,transfer:'actor'}]},

    'warden-strike':{...dmg('warden-strike','镇压','ATK * 0.78 + DEF * 0.42',0.9),cost:1,effects:[{type:'damage'},{type:'status',status:'weak',chance:0.45,duration:2,condition:{type:'lastHit'}}]},
    'challenge':{id:'challenge',name:'挑战',kind:'support',target:'self',cost:1,cooldown:1,priority:1,effects:[{type:'status',status:'guard',duration:2},{type:'status',status:'thorns',duration:2}]},
    'iron-wall':{id:'iron-wall',name:'铁壁',kind:'support',target:'all-allies',cost:3,cooldown:3,effects:[{type:'status',status:'fortified',duration:2},{type:'shield',formula:'MAX_HP * 0.09'}]},

    'backstab':{...dmg('backstab','背刺','ATK * 1.12 + SPD * 0.20',1.15),cost:1,critBonus:20,accuracy:0.96},
    'smoke':{id:'smoke',name:'烟幕',kind:'support',target:'self',cost:1,cooldown:2,effects:[{type:'status',status:'evasion',duration:2},{type:'status',status:'haste',duration:1}]},
    'death-mark':{...dmg('death-mark','死亡印记','ATK * (TARGET_HP_PCT < 0.35 ? 2.05 : 0.88)',1.25),cost:3,cooldown:3,penetrationBonus:20},

    'corrosive-flask':{...dmg('corrosive-flask','腐蚀瓶','ATK * 0.72 + 16',0.75,'toxic'),cost:1,effects:[{type:'damage'},{type:'status',status:'vulnerable',duration:3,condition:{type:'lastHit'}},{type:'status',status:'poison',chance:0.65,duration:3,condition:{type:'lastHit'}}]},
    'regeneration':{id:'regeneration',name:'再生药剂',kind:'heal',target:'ally',cost:2,cooldown:1,effects:[{type:'heal',formula:'MAX_HP * 0.10'},{type:'status',status:'regen',duration:3}]},
    'catalyst':{id:'catalyst',name:'催化',kind:'debuff',target:'all-enemies',cost:3,cooldown:3,effects:[{type:'status',status:'poison',duration:3},{type:'status',status:'vulnerable',duration:2}]},

    'arc-bolt':{...dmg('arc-bolt','电弧','ATK * 0.92 + ENERGY * 6',0.95,'lightning'),cost:1,accuracy:0.96},
    'overcharge':{id:'overcharge',name:'过充',kind:'support',target:'self',cost:1,cooldown:2,effects:[{type:'energy',amount:2},{type:'status',status:'focus',duration:2}]},
    'emp':{...dmg('emp','电磁脉冲','ATK * 0.68 + 20',0.75,'lightning'),target:'all-enemies',cost:3,cooldown:3,effects:[{type:'damage'},{type:'status',status:'stun',chance:0.32,duration:1,condition:{type:'lastHit'}},{type:'energy',amount:-1,targetResource:true,condition:{type:'lastHit'}}]},

    'radiant-edge':{...dmg('radiant-edge','辉光刃','ATK * 0.72',0.8),cost:1,damageComponents:[{type:'physical',formula:'ATK * 0.58 + DEF * 0.10'},{type:'arcane',formula:'ATK * 0.38 + RES * 0.08'}]},
    'consecrate':{id:'consecrate',name:'祝圣',kind:'heal',target:'all-allies',cost:2,cooldown:2,effects:[{type:'heal',formula:'ATK * 0.28 + TARGET_MAX_HP * 0.06'},{type:'status',status:'aegis',duration:2}]},
    'judgment':{...dmg('judgment','裁决','ATK * (TARGET_HP_PCT < 0.5 ? 1.25 : 0.85)',1.0,'arcane'),cost:3,cooldown:2,effects:[{type:'damage'},{type:'conditional',condition:{all:[{type:'lastHit'},{type:'targetHasStatus',status:'vulnerable'}]},then:[{type:'status',status:'stun',chance:0.45,duration:1}]}]},
    'radiant-aura':{id:'radiant-aura',name:'辉光圣环',kind:'support',target:'self',cost:1,cooldown:0,effects:[{type:'toggleStatus',status:'radiant-aura'}]},

    'chain-spark':{...dmg('chain-spark','连锁火花','ATK * 0.34 + 8',0.42,'lightning'),cost:1,effects:[{type:'damage',hits:3}]},
    'static-field':{id:'static-field',name:'静电场',kind:'debuff',target:'all-enemies',cost:2,cooldown:2,effects:[{type:'status',status:'shock',duration:2}]},
    'thunderhead':{...dmg('thunderhead','雷暴核心','ATK * 0.74 + 18',0.82,'lightning'),target:'all-enemies',cost:3,cooldown:3,accuracy:0.90,effects:[{type:'damage'},{type:'status',status:'shock',chance:0.55,duration:2,condition:{type:'lastHit'}}]},

    'toxic-needle':{...dmg('toxic-needle','毒针','ATK * 0.75 + 12',0.78,'toxic'),cost:1,effects:[{type:'damage'},{type:'status',status:'poison',chance:0.75,duration:3,condition:{type:'lastHit'}}]},
    'grievous-cloud':{id:'grievous-cloud',name:'致残云雾',kind:'debuff',target:'all-enemies',cost:2,cooldown:2,effects:[{type:'status',status:'grievous',duration:3},{type:'status',status:'poison',chance:0.45,duration:3}]},
    'virulent-burst':{...dmg('virulent-burst','毒爆','ATK * 0.52 + TARGET_MAX_HP * 0.025',0.62,'toxic'),cost:3,cooldown:2,effects:[{type:'damage'},{type:'status',status:'vulnerable',duration:2,condition:{type:'lastHit'}}]},

    'rune-cleave':{id:'rune-cleave',name:'符文斩',kind:'damage',target:'enemy',cost:1,cooldown:0,priority:0,accuracy:0.95,formula:'ATK * 0.7',damageComponents:[{type:'physical',formula:'ATK * 0.52 + DEF * 0.08'},{type:'arcane',formula:'ATK * 0.36 + RES * 0.08'}],effects:[{type:'damage'}]},
    'null-ward':{id:'null-ward',name:'双相结界',kind:'support',target:'self',cost:2,cooldown:2,effects:[{type:'ward',damageType:'fire',formula:'34'},{type:'ward',damageType:'frost',formula:'34'},{type:'shield',formula:'MAX_HP * 0.08'}]},
    'runic-guard':{id:'runic-guard',name:'符文架势',kind:'support',target:'self',cost:1,cooldown:0,effects:[{type:'toggleStatus',status:'runic-guard'}]},
    'sundering-seal':{...dmg('sundering-seal','崩解印记','ATK * 0.78 + 12',0.85,'arcane'),cost:3,cooldown:3,effects:[{type:'damage'},{type:'status',status:'armor-break',duration:3,condition:{type:'lastHit'}},{type:'status',status:'spell-break',duration:3,condition:{type:'lastHit'}}]},

    'hex-bolt':{...dmg('hex-bolt','咒蚀弹','ATK * 0.78 + 12',0.82,'arcane'),cost:1,effects:[{type:'damage'},{type:'status',status:'hex',duration:4,condition:{type:'lastHit'}}]},
    'malison':{id:'malison',name:'群体恶咒',kind:'debuff',target:'all-enemies',cost:2,cooldown:2,effects:[{type:'status',status:'hex',duration:4,stacks:2},{type:'status',status:'weak',duration:2}]},
    'hex-collapse':{id:'hex-collapse',name:'咒印崩解',kind:'damage',target:'enemy',cost:3,cooldown:2,priority:0,accuracy:1,damageType:'true',formula:'0',targetRequirements:{type:'targetHasStatus',status:'hex'},effects:[{type:'consumeStatus',status:'hex',stacks:'all'},{type:'damage',damageType:'true',formula:'CONSUMED_STACKS * 24',canMiss:false,canCrit:false},{type:'conditional',condition:{type:'consumedStacksAtLeast',value:3},then:[{type:'status',status:'stun',chance:0.40,duration:1}]}]},

    'soul-cut':{...dmg('soul-cut','魂刃','ATK * 1.05 + SPD * 0.18',1.05,'physical'),cost:1,effects:[{type:'damage'},{type:'status',status:'bleed',chance:0.50,duration:3,condition:{type:'lastHit'}}]},
    'reap':{...dmg('reap','收魂','ATK * (TARGET_HP_PCT < 0.35 ? 2.05 : 0.88)',1.25,'arcane'),cost:2,cooldown:1,penetrationBonus:16},
    'soulstorm':{...dmg('soulstorm','魂潮','ATK * 0.62',0.66,'arcane'),target:'all-enemies',cost:2,costs:[{resource:'SOUL',amount:2}],cooldown:3,effects:[{type:'damage'},{type:'status',status:'marked',chance:0.45,duration:2,condition:{type:'lastHit'}}]},

    'time-needle':{...dmg('time-needle','时针','ATK * 0.82',0.82,'arcane'),cost:1,priority:1,effects:[{type:'damage'},{type:'status',status:'slow',chance:0.45,duration:2,condition:{type:'lastHit'}}]},
    'phase-convert':{id:'phase-convert',name:'相位转换',kind:'support',target:'self',cost:0,cooldown:1,requirements:{type:'resourceAtLeast',resource:'CHRONO',value:2},effects:[{type:'convertResource',from:'CHRONO',to:'ENERGY',amount:2,ratio:1},{type:'status',status:'temporal-focus',duration:2}]},
    'temporal-wave':{id:'temporal-wave',name:'时间浪潮',kind:'support',target:'all-allies',cost:2,costs:[{resource:'CHRONO',amount:2}],cooldown:3,effects:[{type:'status',status:'haste',duration:2},{type:'status',status:'focus',duration:2}]},

    'blood-lance':{...dmg('blood-lance','血枪','ATK * 1.12 + SPD * 0.20',1.15,'bleed'),cost:1,costs:[{resource:'HP',amount:16}],effects:[{type:'damage'},{type:'status',status:'bleed',duration:3,stacks:2,condition:{type:'lastHit'}}]},
    'sanguine-drain':{...dmg('sanguine-drain','猩红汲取','ATK * 0.78 + 12',0.82,'toxic'),cost:2,cooldown:1,effects:[{type:'damage'},{type:'heal',formula:'MAX_HP * 0.08',effectTarget:'actor',condition:{type:'lastHit'}},{type:'status',status:'blood-pact',duration:2,effectTarget:'actor',condition:{type:'lastHit'}}]},
    'crimson-covenant':{id:'crimson-covenant',name:'血誓结界',kind:'support',target:'all-allies',cost:2,costs:[{resource:'HP',amount:24}],cooldown:3,effects:[{type:'shield',formula:'MAX_HP * 0.12'},{type:'status',status:'regen',duration:2}]},
  };

  const UNITS = {
    vanguard:{id:'vanguard',tags:['armored','martial','human'],name:'先锋',role:'坦克',description:'稳定前排，护盾与团队保护。',stats:{MAX_HP:190,ATK:52,DEF:82,RES:62,SPD:48,CRIT:8,CRIT_DMG:155,PEN:5,ACC:98,EVA:4,ENERGY_MAX:4,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:0,HEAL_POWER:100},skills:['shield-bash','fortify','last-stand'],resistances:{physical:0.08},roundStart:[{type:'shield',amount:10}]},
    duelist:{id:'duelist',tags:['martial','human'],name:'决斗者',role:'爆发',description:'高速单体输出，擅长收割。',stats:{MAX_HP:132,ATK:78,DEF:38,RES:34,SPD:92,CRIT:20,CRIT_DMG:170,PEN:12,ACC:104,EVA:13,ENERGY_MAX:4,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:4,HEAL_POWER:100},skills:['quick-cut','riposte','execution'],passives:[{stat:'SPD',operation:'add',value:10,condition:{type:'hpPctAbove',value:0.7}}]},
    berserker:{id:'berserker',tags:['martial','human'],name:'狂战士',role:'持续输出',description:'受伤积累怒气，越战越凶。',stats:{MAX_HP:168,ATK:72,DEF:44,RES:30,SPD:64,CRIT:14,CRIT_DMG:165,PEN:8,ACC:96,EVA:5,ENERGY_MAX:4,ENERGY_REGEN:2,RAGE:1,RAGE_MAX:10,LIFESTEAL:8,HEAL_POWER:100},skills:['rage-slash','blood-rush','reckless-cleave'],passives:[{stat:'ATK',operation:'multiply',formula:'1 + (1 - HP_PCT) * 0.35'}],triggers:[{event:'afterDamageTaken',target:'self',effects:[{type:'resource',resource:'RAGE',amount:1}]}]},
    ranger:{id:'ranger',tags:['martial','ranged','human'],name:'游侠',role:'穿透',description:'高命中、标记与群体射击。',stats:{MAX_HP:128,ATK:70,DEF:34,RES:38,SPD:84,CRIT:18,CRIT_DMG:160,PEN:20,ACC:115,EVA:10,ENERGY_MAX:4,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:0,HEAL_POWER:100},skills:['piercing-shot','mark-target','volley'],passives:[{stat:'ACC',operation:'add',value:10}]},
    pyromancer:{id:'pyromancer',tags:['caster','elemental','human'],name:'炎术师',role:'持续法伤',description:'灼烧叠层与群体压制。',stats:{MAX_HP:120,ATK:82,DEF:25,RES:52,SPD:67,CRIT:13,CRIT_DMG:160,PEN:13,ACC:104,EVA:6,ENERGY_MAX:5,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:0,HEAL_POWER:105},skills:['firebolt','ignite','inferno'],resistances:{fire:0.28,frost:-0.10},affinities:{fire:0.06}},
    frostbinder:{id:'frostbinder',tags:['caster','elemental','human'],name:'霜缚者',role:'控制',description:'迟缓控制并对受控目标爆发。',stats:{MAX_HP:126,ATK:74,DEF:30,RES:58,SPD:70,CRIT:12,CRIT_DMG:165,PEN:10,ACC:107,EVA:7,ENERGY_MAX:5,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:0,HEAL_POWER:100},skills:['ice-lance','slow-field','shatter'],resistances:{frost:0.28,fire:-0.10}},
    medic:{id:'medic',tags:['support','human'],name:'战地医师',role:'治疗',description:'治疗、净化与屏障。',stats:{MAX_HP:142,ATK:56,DEF:42,RES:64,SPD:61,CRIT:6,CRIT_DMG:150,PEN:0,ACC:100,EVA:6,ENERGY_MAX:5,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:0,HEAL_POWER:125},skills:['pulse-heal','cleanse','barrier']},
    oracle:{id:'oracle',tags:['support','caster','human'],name:'先知',role:'辅助',description:'强化速度、暴击并重置节奏。',stats:{MAX_HP:124,ATK:62,DEF:30,RES:66,SPD:78,CRIT:14,CRIT_DMG:155,PEN:5,ACC:108,EVA:9,ENERGY_MAX:5,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:0,HEAL_POWER:110},skills:['focus-beam','haste','rewind','fate-theft']},
    warden:{id:'warden',tags:['armored','martial','human'],name:'守望者',role:'防护',description:'吸引火力、反伤与团队减伤。',stats:{MAX_HP:204,ATK:48,DEF:88,RES:70,SPD:42,CRIT:5,CRIT_DMG:150,PEN:0,ACC:96,EVA:2,ENERGY_MAX:4,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:0,HEAL_POWER:100},skills:['warden-strike','challenge','iron-wall'],resistances:{physical:0.10},immunities:{control:0.15},passives:[{stat:'RES',operation:'add',value:15}]},
    assassin:{id:'assassin',tags:['martial','human'],name:'刺客',role:'收割',description:'高闪避、高暴击，擅长低血斩杀。',stats:{MAX_HP:112,ATK:82,DEF:27,RES:29,SPD:104,CRIT:25,CRIT_DMG:180,PEN:18,ACC:108,EVA:18,ENERGY_MAX:4,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:5,HEAL_POWER:100},skills:['backstab','smoke','death-mark'],passives:[{stat:'CRIT',operation:'add',value:8}]},
    alchemist:{id:'alchemist',tags:['caster','support','human'],name:'炼金师',role:'削弱',description:'中毒、易伤与持续恢复。',stats:{MAX_HP:136,ATK:64,DEF:38,RES:56,SPD:65,CRIT:8,CRIT_DMG:150,PEN:8,ACC:104,EVA:6,ENERGY_MAX:5,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:0,HEAL_POWER:115},skills:['corrosive-flask','regeneration','catalyst'],resistances:{toxic:0.25},immunities:{poison:0.35}},
    sentinel:{id:'sentinel',tags:['caster','armored','construct'],name:'哨兵',role:'能量控制',description:'能量循环、群控与稳定法伤。',stats:{MAX_HP:148,ATK:68,DEF:51,RES:59,SPD:69,CRIT:10,CRIT_DMG:155,PEN:9,ACC:105,EVA:5,ENERGY_MAX:6,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:0,HEAL_POWER:100},skills:['arc-bolt','overcharge','emp'],resistances:{lightning:0.20},passives:[{stat:'ENERGY_REGEN',operation:'add',value:1}]},
    templar:{id:'templar',tags:['armored','martial','support','human'],name:'圣裁骑士',role:'混合防护',description:'物理与奥术复合伤害，同时强化团队生存。',stats:{MAX_HP:176,ATK:66,DEF:69,RES:72,SPD:54,CRIT:9,CRIT_DMG:155,PEN:7,ACC:101,EVA:4,ENERGY_MAX:5,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:0,HEAL_POWER:112},skills:['radiant-edge','consecrate','judgment','radiant-aura'],resistances:{arcane:0.16},immunities:{silence:0.12}},
    stormcaller:{id:'stormcaller',tags:['caster','elemental','human'],name:'雷鸣术士',role:'多段压制',description:'以多段雷击和感电削弱敌方行动效率。',stats:{MAX_HP:122,ATK:79,DEF:27,RES:55,SPD:82,CRIT:16,CRIT_DMG:160,PEN:12,ACC:108,EVA:8,ENERGY_MAX:5,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:0,HEAL_POWER:100},skills:['chain-spark','static-field','thunderhead'],resistances:{lightning:0.30},affinities:{lightning:0.05}},
    plague:{id:'plague',tags:['caster','support','human'],name:'疫医',role:'持续削弱',description:'毒素、重伤与易伤联动，压制回复体系。',stats:{MAX_HP:134,ATK:67,DEF:36,RES:61,SPD:68,CRIT:9,CRIT_DMG:150,PEN:11,ACC:105,EVA:6,ENERGY_MAX:5,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:0,HEAL_POWER:108},skills:['toxic-needle','grievous-cloud','virulent-burst'],resistances:{toxic:0.34},immunities:{poison:0.55}},
    runeknight:{id:'runeknight',tags:['armored','martial','caster','human'],name:'符文骑士',role:'混合破防',description:'复合伤害、元素护持和双防削弱。',stats:{MAX_HP:162,ATK:70,DEF:61,RES:68,SPD:58,CRIT:11,CRIT_DMG:158,PEN:10,ACC:102,EVA:5,ENERGY_MAX:5,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:2,HEAL_POWER:100},skills:['rune-cleave','null-ward','sundering-seal','runic-guard'],resistances:{arcane:0.20}},
    hexer:{id:'hexer',tags:['caster','curse','human'],name:'咒蚀师',role:'叠层爆发',description:'叠加咒印削弱法抗，再一次性引爆层数。',stats:{MAX_HP:126,ATK:76,DEF:30,RES:65,SPD:72,CRIT:12,CRIT_DMG:158,PEN:10,ACC:106,EVA:7,ENERGY_MAX:5,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:0,HEAL_POWER:100},skills:['hex-bolt','malison','hex-collapse'],resistances:{arcane:0.18}},
    reaper:{id:'reaper',tags:['martial','caster','human'],name:'魂猎者',role:'击杀滚雪球',description:'击杀敌人积累灵魂，以灵魂发动群体压制。',stats:{MAX_HP:128,ATK:80,DEF:34,RES:42,SPD:88,CRIT:19,CRIT_DMG:172,PEN:14,ACC:106,EVA:11,ENERGY_MAX:4,ENERGY_REGEN:2,SOUL:0,SOUL_MAX:5,RAGE:0,LIFESTEAL:5,HEAL_POWER:100},skills:['soul-cut','reap','soulstorm'],triggers:[{event:'afterKill',target:'self',effects:[{type:'resource',resource:'SOUL',amount:1},{type:'status',status:'soul-fed',duration:3}]}]},
    chronomancer:{id:'chronomancer',tags:['caster','support','human'],name:'时术师',role:'资源与节奏',description:'积累时序资源，在能量和团队速度之间转换。',stats:{MAX_HP:121,ATK:68,DEF:29,RES:69,SPD:86,CRIT:11,CRIT_DMG:155,PEN:7,ACC:110,EVA:10,ENERGY_MAX:5,ENERGY_REGEN:1,CHRONO:3,CHRONO_MAX:6,RAGE:0,LIFESTEAL:0,HEAL_POWER:105},skills:['time-needle','phase-convert','temporal-wave'],resourceRegens:{CHRONO:1},resistances:{arcane:0.16}},
    bloodweaver:{id:'bloodweaver',tags:['caster','blood','human'],name:'血契师',role:'生命换强度',description:'用生命支付技能成本，通过吸血、再生和屏障回收风险。',stats:{MAX_HP:174,ATK:72,DEF:40,RES:52,SPD:66,CRIT:13,CRIT_DMG:162,PEN:10,ACC:103,EVA:6,ENERGY_MAX:5,ENERGY_REGEN:2,RAGE:0,LIFESTEAL:10,HEAL_POWER:112},skills:['blood-lance','sanguine-drain','crimson-covenant'],resistances:{bleed:0.28,toxic:0.08}},
  };

  NCB.STATUS_DEFS = STATUSES;
  NCB.SKILL_DEFS = SKILLS;
  NCB.UNIT_DEFS = UNITS;
  NCB.DEFAULT_TEAM_A = ['vanguard','ranger','medic','duelist'];
  NCB.DEFAULT_TEAM_B = ['runeknight','pyromancer','duelist','warden'];
  NCB.deepClone = obj => JSON.parse(JSON.stringify(obj));
  if (typeof module !== 'undefined') module.exports = NCB;
})(typeof globalThis !== 'undefined' ? globalThis : window);
