(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};

  function registry(){return Object.create(null);}
  const CONDITION_COMPONENTS=registry();
  const EFFECT_COMPONENTS=registry();
  const TARGET_COMPONENTS=registry();
  const EVENT_COMPONENTS=registry();
  const MODIFIER_OPERATIONS=registry();

  function normalizeSpec(id,spec={}){return {id,name:id,human:'',ai:'',fields:[],...spec};}
  function registerConditionComponent(id,spec){CONDITION_COMPONENTS[id]=normalizeSpec(id,spec);return CONDITION_COMPONENTS[id];}
  function registerEffectComponent(id,spec){EFFECT_COMPONENTS[id]=normalizeSpec(id,spec);return EFFECT_COMPONENTS[id];}
  function registerTargetComponent(id,spec){TARGET_COMPONENTS[id]=normalizeSpec(id,spec);return TARGET_COMPONENTS[id];}
  function registerEventComponent(id,spec){EVENT_COMPONENTS[id]=normalizeSpec(id,spec);return EVENT_COMPONENTS[id];}
  function registerModifierOperation(id,spec){MODIFIER_OPERATIONS[id]=normalizeSpec(id,spec);return MODIFIER_OPERATIONS[id];}

  const MODIFIER_PHASES={SET:10,ADD:20,MULTIPLY:30,CAP:40,FINAL:50};
  function modifierNumericValue(mod,ctx={}){
    if(mod.formula){
      const extra={STACKS:Number(ctx.stacks||1),MODIFIER_VALUE:Number(mod.value||0),...(ctx.extra||{})};
      if(ctx.scope&&typeof NCB.evaluateExpression==='function')return Number(NCB.evaluateExpression(mod.formula,{...ctx.scope,...extra}));
      if(ctx.battle?.evaluateFormula){
        const source=ctx.source||ctx.actor||ctx.target,target=ctx.target||source;
        return Number(ctx.battle.evaluateFormula(mod.formula,source,target,extra));
      }
    }
    return Number(mod.value??0);
  }
  function applyModifierOperation(current,mod,ctx={}){
    const spec=MODIFIER_OPERATIONS[mod.operation||'add'];if(!spec||typeof spec.apply!=='function')return Number(current);
    const value=modifierNumericValue(mod,ctx);return Number(spec.apply({current:Number(current),value,stacks:Number(ctx.stacks||1),mod,ctx}));
  }
  function modifierStableKey(entry,index){return String(entry.stableKey??`${entry.statusId||''}:${entry.index??index}:${entry.sourceId||''}`);}
  function applyModifierBand(base,entries=[],ctx={}){
    const ordered=entries.map((entry,index)=>{const spec=MODIFIER_OPERATIONS[entry.mod?.operation||'add'];return{...entry,_index:index,_phase:MODIFIER_PHASES[spec?.phase]??MODIFIER_PHASES.ADD,_key:modifierStableKey(entry,index)};})
      .sort((a,b)=>a._phase-b._phase||a._key.localeCompare(b._key)||a._index-b._index);
    let value=Number(base);for(const entry of ordered)value=applyModifierOperation(value,entry.mod,{...ctx,stacks:entry.stacks||1,entry});return value;
  }

  registerModifierOperation('set',{name:'设定',phase:'SET',human:'把当前值直接设为参数值。',apply:({value})=>value});
  registerModifierOperation('add',{name:'加法',phase:'ADD',human:'在 SET 后增加固定值。',apply:({current,value})=>current+value});
  registerModifierOperation('addPerStack',{name:'每层加法',phase:'ADD',human:'每层状态增加固定值。',apply:({current,value,stacks})=>current+value*stacks});
  registerModifierOperation('multiply',{name:'乘法',phase:'MULTIPLY',human:'对 SET+ADD 后结果乘算。',apply:({current,value})=>current*value});
  registerModifierOperation('multiplyPerStack',{name:'每层倍率',phase:'MULTIPLY',human:'每层线性增加倍率：×(1+value×stacks)。',apply:({current,value,stacks})=>current*(1+value*stacks)});
  registerModifierOperation('compoundPerStack',{name:'每层复合倍率',phase:'MULTIPLY',human:'每层独立复合乘算：×value^stacks。',apply:({current,value,stacks})=>current*Math.pow(value,stacks)});
  registerModifierOperation('min',{name:'上限',phase:'CAP',human:'把结果限制为不高于参数值。',apply:({current,value})=>Math.min(current,value)});
  registerModifierOperation('max',{name:'下限',phase:'CAP',human:'把结果限制为不低于参数值。',apply:({current,value})=>Math.max(current,value)});

  const p=(id,name,category,kind,unit,defaultValue,range,human,ai,effect,source)=>({id,name,category,kind,unit,defaultValue,range,human,ai,effect,source});
  const PARAMETER_LIST=[
    p('MAX_HP','最大生命','实体基础','number','HP',120,'20–10000','决定实体可承受的总生命伤害。','提高生存时间并放大基于 MAX_HP 的治疗、护盾和伤害公式。','+10% 通常约等于 +10% 纯生命耐久，但会与护盾/回复产生乘法协同。','通用 RPG / Pokémon HP'),
    p('ATK','攻击强度','实体基础','number','point',70,'0–1000','多数伤害公式的主要进攻输入。','提高所有引用 ATK 的公式结果。','实际收益取决于技能系数、暴击、穿透和目标防御。','Pokémon Attack/SpA'),
    p('DEF','物理防御','实体基础','number','point',50,'0–1000','降低使用 DEF 防御轴的伤害。','提高对 physical/bleed 等物理轴伤害的有效减伤。','边际收益随当前 DEF 和穿透变化。','Pokémon Defense / CDDA armor'),
    p('RES','法术抗性','实体基础','number','point',50,'0–1000','降低使用 RES 防御轴的元素/奥术伤害。','提高对 arcane/fire/frost/lightning/toxic 的有效减伤。','边际收益随 RES 和穿透变化。','Pokémon SpD / ToME saves-resists'),
    p('SPD','速度','实体基础','number','point',70,'0–1000','同优先级下决定行动先后。','提高队列中的 speed 排序值。','只有在 priority 相同时影响先手。','Pokémon Speed / Showdown queue'),
    p('ACC','命中','实体基础','number','point',100,'0–500','提高技能命中概率。','进入 ACC 对 EVA 的命中公式。','对高闪避目标价值更高，受技能基础 accuracy 限制。','Pokémon accuracy stages'),
    p('EVA','闪避','实体基础','number','point',5,'0–500','降低敌方可被闪避技能的命中率。','作为命中公式的防守输入。','对 always-hit/canMiss=false 无效。','Pokémon evasion stages'),
    p('CRIT','暴击率','实体基础','number','%',10,'0–80','增加可暴击伤害段的暴击概率。','与技能 critBonus 和 ModifyCritChance 叠加。','提高期望伤害，收益由 CRIT_DMG 决定。','Pokémon critRatio / RPG crit'),
    p('CRIT_DMG','暴击倍率','实体基础','number','%',160,'100–500','决定暴击时伤害倍率。','CRIT 触发后将伤害公式结果乘以此倍率。','只在暴击发生时生效，与 CRIT 形成乘法协同。','RPG crit damage'),
    p('PEN','通用穿透','实体基础','number','%',10,'0–95','按比例忽略 DEF/RES。','与技能 penetrationBonus 合并后减少有效防御。','对高防目标收益更大。','CDDA armor penetration / ToME penetration'),
    p('LIFESTEAL','吸血','实体基础','number','%',0,'0–100','按造成的 HP 伤害回复施法者。','根据实际 HP_DAMAGE 回收生命。','被护盾完全吸收的部分通常不产生吸血。','RPG life steal'),
    p('HEAL_POWER','治疗强度','实体基础','number','%',100,'0–500','放大自身施放的治疗。','治疗公式结果乘以 HEAL_POWER/100。','与目标 HEAL_TAKEN 乘算。','RPG healing power'),
    p('HEAL_TAKEN','受疗倍率','实体基础','number','%',100,'0–500','控制收到治疗的倍率。','治疗结算乘以 HEAL_TAKEN/100。','可用于重伤、治疗增益、吸收类机制。','RPG healing received'),
    p('ENERGY_MAX','能量上限','资源','number','point',5,'0–100','标准技能资源池上限。','限制 ENERGY 可存储的最大值。','上限提高偏向爆发回合，回复提高偏向持续循环。','ToME resource pools'),
    p('ENERGY_REGEN','能量回复','资源','number','point/round',2,'0–100','每回合恢复标准能量。','回合开始增加 ENERGY。','直接影响技能循环周期。','ToME resource regeneration'),
    p('RESOURCE_MAX','自定义资源上限','资源','number','point',5,'0–1000','任意资源 X 通过 X_MAX 定义上限。','允许 SOUL/RAGE/CHRONO 等无需改引擎。','决定资源构筑的蓄积空间。','ToME multiple resources'),
    p('RESOURCE_REGEN','自定义资源回复','资源','number','point/round',0,'0–100','任意资源每回合的自然回复。','由 resourceRegens 数据驱动。','决定资源获取是否依赖事件还是稳定循环。','ToME multiple resources'),
    p('BASE_FORMULA','基础公式','技能','formula','expression','ATK * 1.0','safe expression','技能数值的主公式。','在只读 scope 中计算基础伤害/治疗/护盾值。','是最核心的可调参数，可组合任意开放 Stat/Resource/目标变量。','math.js / formula-driven RPG'),
    p('FORMULA_MULTIPLIER','公式倍率','技能','number','×',1,'0–20','在单个 damage component 上额外乘算。','用于同一公式生成不同分量。','比复制整条公式更适合复合伤害包。','CDDA damage_unit multiplier'),
    p('DAMAGE_TYPE','伤害类型','技能','enum','type','physical','registered type','决定使用哪条防御轴、抗性、护符和亲和。','查 DAMAGE_TYPES 注册表。','改变类型会改变 DEF/RES、抗性、亲和、Ward 等整条结算。','Pokémon type / CDDA damage_type'),
    p('SKILL_ACCURACY','技能基础命中','技能','number','ratio',1,'0.05–1.5','技能自身命中系数。','与 ACC/EVA 和 ModifyAccuracy 共同决定最终命中率。','1.0 是标准；低命中可换取高强度。','Pokémon move accuracy'),
    p('PRIORITY','行动优先级','技能','number','tier',0,'-10–10','高于速度的行动顺序层。','队列先按 priority 再按 SPD。','少量变化即可改变整场节奏，属于高价值参数。','Pokémon priority / Showdown queue'),
    p('COOLDOWN','冷却','技能','number','round',0,'0–20','技能再次使用前等待回合数。','使用后写入 cooldown 状态。','是控制强技能频率的主要旋钮。','RPG cooldowns'),
    p('RESOURCE_COST','资源费用','技能','number','point',1,'0–1000','技能消耗任意资源。','所有成本先验证再原子支付。','直接限制频率，并与资源转换/回复联动。','ToME talent costs'),
    p('HP_COST','生命费用','技能','number','HP',0,'0–MAX_HP','把生命作为施法成本。','默认不可支付致死成本，除非 allowLethal。','把输出/辅助强度转化为生存风险。','blood magic archetypes'),
    p('HITS','攻击段数','技能','number','hit',1,'1–32','同一伤害效果重复结算的段数。','每段独立命中/暴击/伤害/触发。','增加触发次数和方差，不等价于简单伤害倍率。','Pokémon multihit / Wesnoth attacks'),
    p('CRIT_BONUS','技能暴击加成','技能','number','%',0,'-100–100','只影响当前技能的暴击概率。','叠加到角色 CRIT 再经过 ModifyCritChance。','适合高暴击技能而不污染角色基础属性。','Pokémon critRatio'),
    p('PENETRATION_BONUS','技能穿透加成','技能','number','%',0,'-95–95','只影响当前技能的防御穿透。','叠加到 PEN 再进入 ModifyPenetration。','适合破甲技能和高防目标特攻。','CDDA technique armor penetration'),
    p('TYPE_PENETRATION','类型穿透','技能','number','ratio',0,'0–1','忽略目标对应伤害类型的一部分抗性。','在类型抗性阶段扣减 resistance。','和 DEF/RES 穿透属于不同防御层。','ToME resistance penetration'),
    p('CAN_CRIT','允许暴击','技能','boolean','bool',true,'true/false','决定伤害段能否暴击。','false 时直接跳过暴击随机。','用于 DoT、固定伤害或规则特殊技能。','generic battle rule'),
    p('CAN_MISS','允许未命中','技能','boolean','bool',true,'true/false','决定是否执行命中判定。','false 时命中率强制为 100%。','适合必中特性和环境效果。','Pokémon always hit / ignoreAccuracy'),
    p('CAN_REFLECT','允许反射','技能','boolean','bool',true,'true/false','决定该伤害是否可触发反伤链。','防止反射伤害再次反射形成死循环。','是反应链安全的重要结构参数。','Showdown recursion / RPG reflect'),
    p('SECONDARY_CHANCE','附加效果概率','技能','number','ratio',1,'0–1','控制状态/次级效果触发概率。','PRNG 判定后决定是否执行子效果。','把主伤害与控制概率解耦。','Pokémon secondary chance'),
    p('TARGET_MODE','目标模式','技能','enum','target','enemy','registered target','决定技能可选目标集合。','由 Target 组件产生合法目标。','同一效果组件可因目标模式变成单体、群体、自身或随机。','Pokémon MoveTarget'),
    p('TARGET_RELATION','目标关系','目标查询','enum','relation','enemy','self/ally/enemy/any','定义候选目标与施法者的关系。','Query Target 的第一层候选集。','只改变候选关系，不改变效果本身。','Pokémon MoveTarget / generic selector'),
    p('TARGET_FILTER','目标过滤条件','目标查询','condition','rule',null,'condition tree','使用通用 Condition 树筛选候选目标。','与技能/AI 共用同一 predicate registry。','可以组合出低血、带状态、特定标签等任意合法目标。','Freeciv Requirements / Unciv conditionals'),
    p('TARGET_SORT','目标排序','目标查询','enum','sort','hpPct','hpPct/hp/maxHp/shield/stat/resource','决定自动目标的排序依据。','Query Target 对候选集做稳定排序。','配合 order 与 limit 可表达最低血、最高防、最高资源等。','OpenSpiel legal-action filtering / generic query'),
    p('TARGET_ORDER','目标排序方向','目标查询','enum','order','asc','asc/desc','控制目标排序升序或降序。','与 TARGET_SORT 一起决定自动优先目标。','asc 常用于最低血，desc 常用于最高属性。','generic selector'),
    p('TARGET_LIMIT','目标数量上限','目标查询','number','entity',1,'0–99','限制查询结果最多保留多少目标。','排序/过滤后截取前 N 个。','把单体、双目标、前三目标等统一为一个参数。','generic selector'),
    p('TARGET_SELECTION','目标选择模式','目标查询','enum','mode','choose','choose/first/all','决定查询结果由玩家选一个、自动取第一或全部应用。','影响 LegalActions 与效果展开方式。','同一 Query 可在手动选择、自动锁定和群体执行之间切换。','Pokémon target modes / generic selector'),
    p('TARGET_REQUIREMENT','目标条件','技能','condition','rule',null,'condition tree','进一步过滤合法目标。','使用 Condition 插件树进行筛选。','让“只能打燃烧目标/机械目标/低血目标”等无需写技能特判。','Freeciv Requirements / Unciv conditionals'),
    p('REQUIREMENT','施放条件','技能','condition','rule',null,'condition tree','控制技能是否进入 LegalActions。','AI 与 UI 共用同一条件。','避免“先点击再失败”的规则分叉。','Freeciv Requirements / OpenSpiel legal actions'),
    p('RECOIL_RATIO','反噬倍率','技能','number','ratio',0,'0–1','按生命或伤害产生自伤成本。','可由通用 selfDamage/resource effect 组合。','用自伤换取更高输出。','Pokémon recoil'),
    p('DRAIN_RATIO','汲取倍率','技能','number','ratio',0,'0–1','把本技能实际造成的 HP 伤害按比例转为施法者治疗。','伤害效果结算后读取 committed HP damage，使用统一治疗管线。','只对真正写入 HP 的伤害生效，可与角色 LIFESTEAL 叠加。','Pokémon drain / RPG vampirism'),
    p('DAMAGE_VARIANCE_MIN','随机伤害下限','技能','number','×',1,'0–5','每个伤害分量在暴击前乘上的确定性随机倍率下限。','与 DAMAGE_VARIANCE_MAX 之间使用 canonical PRNG 抽样。','0.85–1.00 可制造经典伤害浮动；1/1 表示完全固定。','Pokémon random damage roll / RPG variance'),
    p('DAMAGE_VARIANCE_MAX','随机伤害上限','技能','number','×',1,'0–5','每个伤害分量的随机倍率上限。','与下限共同决定均匀随机区间，Replay 可精确复现。','区间越宽，输出方差越大；平均值约为上下限均值。','Pokémon random damage roll / RPG variance'),
    p('IGNORE_DEFENSE','忽略防御','技能','boolean','bool',false,'true/false','让对应 Damage Component 跳过 DEF/RES 等防御轴。','把 defenseStat 视为 none，但仍可经过类型抗性和承伤事件。','适合穿甲/纯技巧类技能；与 true damage 仍有语义区别。','Pokémon ignoreDefensive / RPG armor bypass'),
    p('IGNORE_RESISTANCE','忽略类型抗性','技能','boolean','bool',false,'true/false','让对应 Damage Component 跳过目标类型抗性。','resistance 阶段强制为 0，但仍可经过防御轴。','可单独绕过元素抗性，而不必改成 true damage。','Pokémon ignoreImmunity concepts / ToME penetration'),
    p('IGNORE_EVASION','忽略闪避','技能','boolean','bool',false,'true/false','命中公式忽略目标 EVA。','Accuracy 仍然生效，但 target EVA 当作 0。','适合精准/锁定技能，又不同于 canMiss=false 的绝对必中。','Pokémon ignoreEvasion'),
    p('DEFENSE_STAT','防御属性选择','技能','enum','stat','type default','DEF/RES/none/custom','指定该伤害分量使用哪个目标 Stat 作为防御轴。','Damage Component 可覆盖 Damage Type 的默认 defenseStat。','允许“物理伤害看 RES”“攻击意志/护甲等自定义 Stat”而无需新伤害类型。','Pokémon overrideDefensiveStat'),
    p('MIN_DAMAGE','最小伤害钳制','技能','number','HP',null,'>=0 / none','给单个伤害分量设置结算前的最低伤害。','防御/抗性后对 finalDamage 执行下限 clamp。','适合保底伤害和最低穿透效果。','generic RPG damage floor'),
    p('MAX_DAMAGE','最大伤害钳制','技能','number','HP',null,'>=0 / none','给单个伤害分量设置结算前的最高伤害。','防御/抗性后对 finalDamage 执行上限 clamp。','适合百分比伤害封顶、Boss 保护等。','generic RPG damage cap'),
    p('SPREAD_MULTIPLIER','群体伤害倍率','技能','number','×',1,'0–2','群攻时统一调节每个目标伤害。','作用于每个 damage component 的基础结果。','控制 AoE 总价值避免人数越多无限超模。','Pokémon spreadModifier'),
    p('SHIELD_AMOUNT','通用屏障量','防御','formula','HP','MAX_HP * 0.1','>=0','所有类型伤害前的通用吸收层。','先消耗 shield 再写入 HP。','对所有伤害通用，但可能被多段快速消耗。','RPG barriers'),
    p('WARD_AMOUNT','类型护符量','防御','formula','HP','MAX_HP * 0.1','>=0','只吸收指定 damage type。','匹配类型时在通用 shield 前结算。','比通用盾更窄但可设计更高效率。','ToME damage shields / wards'),
    p('RESISTANCE','类型抗性','防御','number','ratio',0,'-0.75–0.85','按伤害类型降低或放大最终伤害。','类型阶段乘以 (1-resistance)。','负数代表弱点，正数代表抗性。','Pokémon type effectiveness / ToME resists'),
    p('AFFINITY','类型亲和','防御','number','ratio',0,'0–1','受到匹配类型 HP 伤害后恢复一部分生命。','基于实际 hpDamage 产生恢复。','可把某类型从威胁转成资源。','ToME damage affinity'),
    p('IMMUNITY','状态免疫','防御','number','ratio',0,'0–1','按状态标签抵抗施加。','状态应用前进行 deterministic PRNG 判定。','1 表示完全免疫，0.5 表示 50% 抵抗。','RPG status immunity'),
    p('STATUS_CHANCE','状态施加率','状态','number','ratio',1,'0–1','技能附加 Status 的成功概率。','先经过 chance，再经过目标 immunity。','把伤害与控制可靠性分离。','Pokémon secondary status chance'),
    p('STATUS_DURATION','持续时间','状态','number','round',2,'1–99 / ∞','状态保留回合数。','每轮生命周期递减；null 表示 sustain/permanent。','持续时间影响总收益和净化价值。','RPG timed effects'),
    p('STATUS_STACKS','施加层数','状态','number','stack',1,'1–99','一次施加增加/设置的层数。','由 stacking policy 与 maxStacks 解释。','层数可驱动线性、指数或条件公式。','DoT/curse stack systems'),
    p('MAX_STACKS','最大层数','状态','number','stack',1,'1–999','状态最多可积累层数。','应用前 clamp。','决定叠层构筑的蓄力上限。','RPG stack caps'),
    p('STACKING_POLICY','叠层策略','状态','enum','policy','stack','stack/refresh/replace','决定重复施加如何处理。','stack 增层；refresh 刷新时间；replace 覆盖实例。','同一状态可通过策略获得完全不同玩法。','mature status engines'),
    p('STAT_ADD','属性加值','状态','number','point',0,'any','对任意 Stat 添加固定值。','固定 aggregation band 的 Add 层。','对低基础值相对收益更高。','GAS-style modifier band'),
    p('STAT_MULTIPLIER','属性倍率','状态','number','×',1,'0–10','对任意 Stat 乘算。','在 Add 层之后进入 Multiply 层。','与固定加值形成可预测组合。','GAS / Showdown chainModify'),
    p('RESISTANCE_MOD','抗性修正','状态','number','ratio',0,'-1–1','临时改变某类型或全部抗性。','进入 resistance modifier band。','实现元素易伤、护甲破坏、元素姿态。','ToME resistance effects'),
    p('DAMAGE_DEALT_MULT','输出倍率','事件','number','×',1,'0–10','修改最终输出伤害。','ModifyDamageDealt relay-event。','位于公式与防御之外，适合全局增伤/减伤。','Pokémon onModifyDamage'),
    p('DAMAGE_TAKEN_MULT','承伤倍率','事件','number','×',1,'0–10','修改目标最终收到的伤害。','ModifyDamageTaken relay-event。','实现易伤、守护、团队减伤。','Pokémon onModifyDamage'),
    p('ACCURACY_MOD','命中修正','事件','number','add/mul/set',0,'component op','临时修改技能基础命中。','ModifyAccuracy event modifier。','不改角色 ACC，也能塑造“下一击必中/失准”。','Pokémon onModifyAccuracy'),
    p('HITS_MOD','段数修正','事件','number','add/set',0,'1–32','临时改变技能攻击次数。','ModifyHits event modifier。','可把普通攻击变成连击，不需写新技能。','Wesnoth attacks / Pokémon multihit'),
    p('CRIT_CHANCE_MOD','暴击修正','事件','number','%',0,'component op','临时改变技能暴击率。','ModifyCritChance event modifier。','适合姿态、标记、爆发窗口。','Pokémon onModifyCritRatio'),
    p('PENETRATION_MOD','穿透修正','事件','number','%',0,'component op','临时改变技能穿透。','ModifyPenetration event modifier。','适合破防窗口和条件增益。','CDDA armor penetration effects'),
    p('EVENT_PRIORITY','事件优先级','事件','number','tier',0,'integer','决定多个同类 Modifier 的结算顺序。','EventKernel 按 priority/order/id 稳定排序。','保证复杂组合可预测和可重放。','Pokémon Showdown event priority'),
    p('HEAL_DEALT_MULT','治疗输出事件倍率','事件','number','×',1,'0–10','在治疗公式和治疗强度之后进一步修改施法者产生的治疗。','ModifyHealDealt relay-event，可按技能标签或状态条件生效。','适合治疗姿态、治疗类型专精和临时治疗衰减，不需要改 HEAL_POWER。','Pokémon TryHeal / generic RPG healing modifiers'),
    p('HEAL_TAKEN_EVENT_MULT','受疗事件倍率','事件','number','×',1,'0–10','在目标受疗属性之外进一步修改本次收到的治疗。','ModifyHealTaken relay-event。','适合重伤、治疗屏障、特殊治疗易伤等条件化规则。','Pokémon TryHeal / RPG grievous wounds'),
    p('RESOURCE_COST_MOD','资源费用修正','事件','number','add/mul/set',1,'component op','修改某类技能资源费用。','ModifyResourceCost relay-event，data.resource 提供资源类型。','可以制作火系减费、生命法术增费、临时免费施法等，而不认识具体技能。','ToME talent costs / card cost modifiers'),
    p('RESOURCE_GAIN_MOD','资源获得修正','事件','number','add/mul/set',1,'component op','修改资源回复与效果产生的资源量。','ModifyResourceGain relay-event。','把资源回复、击杀收益、转换收益都纳入同一可调面。','ToME resource modifiers'),
    p('COOLDOWN_MOD','冷却修正','事件','number','round',0,'component op','修改技能使用后写入的冷却。','ModifyCooldown relay-event。','实现加速、时间膨胀、某类技能冷却缩短等。','ToME cooldown manipulation'),
    p('SHIELD_MOD','屏障获得修正','事件','number','×',1,'component op','修改本次获得的通用屏障量。','ModifyShield relay-event。','允许护盾专精和受盾削弱，不必改变公式。','RPG barrier modifiers'),
    p('WARD_MOD','类型护符获得修正','事件','number','×',1,'component op','修改本次获得的类型护符量。','ModifyWard relay-event，data.damageType 提供类型。','允许只强化某一元素护符。','ToME shields / wards'),
    p('RESISTANCE_EVENT_MOD','抗性事件修正','事件','number','ratio',0,'component op','在基础抗性与状态抗性带之后修正最终类型抗性。','ModifyResistance relay-event。','适合条件化抗性，例如低血时火抗提高、对特定来源减抗。','ToME resist modifiers'),
    p('PRIORITY_MOD','行动优先级修正','事件','number','tier',0,'component op','临时修改技能在队列中的优先级。','ModifyPriority relay-event。','比 SPD 更强地改变行动顺序，可做先制、迟缓和反应姿态。','Pokémon onModifyPriority'),
    p('TRIGGER_CHANCE','触发概率','触发','number','ratio',1,'0–1','控制被动反应发生概率。','触发事件命中后通过 deterministic PRNG。','适合 proc、被动反击和随机资源获取。','RPG proc systems'),
    p('TRIGGER_LIMIT','触发链上限','触发','number','depth',16,'1–128','限制反射/反击等递归链深度。','超过上限后停止后续 proc。','防止无限反射和恶意内容冻结。','Showdown recursion caps / mature trigger engines'),
    p('PERIOD','周期间隔','周期效果','number','round',1,'1–99','DoT/HoT 每隔多少回合触发。','周期调度器按 elapsed % period 执行。','同总持续时间下，频率决定触发次数与反应链数量。','RPG periodic effects'),
    p('SNAPSHOT_MODE','快照模式','周期效果','enum','mode','apply','apply/dynamic','决定周期效果使用施加时还是每跳实时属性。','apply 保存公式结果；dynamic 每跳重新计算。','快照更可预测，动态更能与后续 Buff 联动。','MMO/RPG DoT snapshot semantics'),
    p('UPKEEP_AMOUNT','维持费用','持续技能','number','resource/round',0,'0–1000','Sustain 每回合支付的资源。','回合开始/结束检查；资源不足自动解除。','形成长期强度与资源经济之间的选择。','ToME sustain talents'),
    p('CONVERT_RATIO','资源转换率','资源','number','ratio',1,'0–100','一种资源转为另一种资源的比例。','convertResource 先扣 from 再按 ratio 增加 to。','连接多个资源循环，是构筑经济的重要轴。','multi-resource RPG systems'),
    p('CONSUME_STACKS','状态消费量','组合','number','stack',1,'1–all','从目标状态中消费层数。','写入 CONSUMED_STACKS 供后续公式读取。','支持“叠层→引爆/换资源/转控制”等组合。','curse/poison detonation systems'),
    p('REPEAT_TIMES','效果重复次数','组合','number','times',1,'0–32','重复执行一个效果块。','repeat 组件逐次解析子效果。','适合多次抽样、连锁或程序化复合技能。','task/effect composition engines'),
    p('CONDITION_BRANCH','条件分支','组合','condition','rule',null,'condition tree','依据通用条件选择 then/else 效果块。','Condition 插件树决定分支。','是把复杂技能从代码迁移到数据的核心。','Unciv uniques / Freeciv requirements'),
  ];
  const PARAMETER_CATALOG=Object.fromEntries(PARAMETER_LIST.map(x=>[x.id,x]));
  function registerParameter(def){
    if(!def?.id)throw new Error('parameter id required');
    const normalized={category:'plugin',kind:'number',unit:'',defaultValue:0,range:'any',human:'',ai:'',effect:'',...def};
    const existingIndex=PARAMETER_LIST.findIndex(x=>x.id===normalized.id);
    if(existingIndex>=0)PARAMETER_LIST.splice(existingIndex,1,normalized);else PARAMETER_LIST.push(normalized);
    PARAMETER_CATALOG[normalized.id]=normalized;
    return normalized;
  }
  function registerCombatPlugin(manifest={}){
    if(Number(manifest.apiVersion||1)!==1)throw new Error(`unsupported combat plugin apiVersion: ${manifest.apiVersion}`);
    for(const def of manifest.parameters||[])registerParameter(def);
    for(const [id,spec] of Object.entries(manifest.conditions||{}))registerConditionComponent(id,spec);
    for(const [id,spec] of Object.entries(manifest.targets||{}))registerTargetComponent(id,spec);
    for(const [id,spec] of Object.entries(manifest.effects||{}))registerEffectComponent(id,spec);
    for(const [id,spec] of Object.entries(manifest.events||{}))registerEventComponent(id,spec);
    if(manifest.damageTypes&&typeof NCB.registerDamageType==='function')for(const [id,spec] of Object.entries(manifest.damageTypes))NCB.registerDamageType(id,spec);
    return {id:manifest.id||'anonymous',version:manifest.version||'0.0.0',apiVersion:1};
  }

  // Target primitives: presentation-independent selectors.
  function targetQueryValue(battle,entity,sortBy={}){
    const kind=sortBy.kind||'hpPct';
    if(kind==='hpPct')return entity.maxHp?entity.hp/entity.maxHp:0;
    if(kind==='hp')return entity.hp;
    if(kind==='maxHp')return entity.maxHp;
    if(kind==='shield')return entity.shield||0;
    if(kind==='stat')return battle.getStat(entity.id,sortBy.key||'SPD');
    if(kind==='resource')return battle.getResource(entity,sortBy.key||'ENERGY');
    return 0;
  }
  function selectTargetQuery({battle,actor,skill}){
    const q=skill.targetQuery||{};const relation=q.relation||'enemy';let candidates=[];
    if(relation==='self')candidates=[actor];
    else if(relation==='ally')candidates=battle.getLiving(actor.teamId);
    else if(relation==='enemy')candidates=battle.getLiving(battle.enemyTeam(actor.teamId));
    else if(relation==='any'){
      const seen=new Set();
      candidates=[...battle.getLiving('A'),...battle.getLiving('B')].filter(e=>!seen.has(e.id)&&seen.add(e.id));
    }
    if(q.where)candidates=candidates.filter(target=>NCB.conditionMatches(q.where,{battle,source:actor,actor,target,skill}));
    if(q.sortBy){
      const direction=q.order==='desc'?-1:1;
      candidates=candidates.slice().sort((a,b)=>{
        const av=Number(targetQueryValue(battle,a,q.sortBy)),bv=Number(targetQueryValue(battle,b,q.sortBy));
        if(av!==bv)return (av-bv)*direction;
        return String(a.id).localeCompare(String(b.id));
      });
    }
    if(Number.isFinite(Number(q.limit))&&Number(q.limit)>=0)candidates=candidates.slice(0,Math.floor(Number(q.limit)));
    if(q.mode==='first')candidates=candidates.slice(0,1);
    return candidates;
  }
  const targetSpecs={
    self:{name:'自己',select:({actor})=>[actor]},
    ally:{name:'单个友方',select:({battle,actor})=>battle.getLiving(actor.teamId)},
    enemy:{name:'单个敌方',enemy:true,select:({battle,actor})=>battle.getLiving(battle.enemyTeam(actor.teamId))},
    'all-allies':{name:'全体友方',multi:true,select:({battle,actor})=>battle.getLiving(actor.teamId)},
    'all-enemies':{name:'全体敌方',enemy:true,multi:true,select:({battle,actor})=>battle.getLiving(battle.enemyTeam(actor.teamId))},
    'random-ally':{name:'随机友方',random:true,select:({battle,actor})=>battle.getLiving(actor.teamId)},
    'random-enemy':{name:'随机敌方',enemy:true,random:true,select:({battle,actor})=>battle.getLiving(battle.enemyTeam(actor.teamId))},
    query:{name:'目标查询',enemy:({skill})=>(skill.targetQuery?.relation||'enemy')==='enemy',multi:({skill})=>skill.targetQuery?.mode==='all',select:selectTargetQuery,fields:['targetQuery.relation','targetQuery.where','targetQuery.sortBy','targetQuery.order','targetQuery.limit','targetQuery.mode']},
  };
  for(const [id,spec] of Object.entries(targetSpecs))registerTargetComponent(id,{...spec,human:`选择${spec.name}作为效果目标。`,ai:`legal-target selector: ${id}`});

  // Effect primitives: these are the fixed building blocks content authors combine.
  const effects={
    damage:['伤害','执行命中→随机倍率→暴击→复合伤害包→防御/抗性→Ward/Shield/HP→汲取/反噬。',['formula','components','hits','accuracy','varianceMin','varianceMax','canCrit','canMiss','canReflect','ignoreDefense','ignoreResistance','ignoreEvasion','defenseStat','minDamage','maxDamage','drainRatio','recoilRatio','tags']],
    heal:['治疗','根据公式产生治疗并应用治疗强度/受疗倍率。',['formula']],
    shield:['屏障','增加通用伤害吸收层。',['formula']],
    ward:['类型护符','增加指定伤害类型的专用吸收层。',['damageType','formula','amount']],
    status:['状态','按概率/免疫规则施加可叠层状态。',['status','chance','duration','stacks']],
    toggleStatus:['持续状态开关','在存在/不存在之间切换一个状态，用于 Sustain。',['status','duration','stacks']],
    consumeStatus:['消费状态','消费指定状态层数并把数量写入后续公式上下文。',['status','stacks']],
    cleanse:['净化','按标签移除负面状态。',['tags','count']],
    dispel:['驱散/夺取','按类型和标签移除状态，可转移给施法者。',['kind','tags','count','transfer']],
    resource:['资源变化','给目标增加或减少任意资源。',['resource','amount','resourceTarget']],
    gain:['施法者资源变化','给施法者增加任意资源。',['resource','amount']],
    energy:['能量变化','兼容旧内容的 ENERGY 资源变化组件。',['amount']],
    convertResource:['资源转换','从一种资源扣除并按比例转化为另一资源。',['from','to','amount','ratio','resourceTarget']],
    cooldownReduce:['冷却缩减','减少目标全部已存在冷却。',['amount']],
    selfDamagePct:['百分比反噬','按施法者最大生命造成不可反射的自伤。',['pct']],
    conditional:['条件分支','根据通用 Condition 树执行 then 或 else。',['condition','then','else']],
    repeat:['重复块','重复执行子效果块。',['times','effects']],
    emitEvent:['发射事件','发射一个已注册 Trigger Event，让状态/被动通过统一事件链响应。',['event','eventSubject','tags','payload']],
  };
  for(const [id,[name,human,fields]] of Object.entries(effects))registerEffectComponent(id,{name,human,ai:`generic effect primitive ${id}`,fields});

  const conditions={
    hpPctAbove:(c,x)=>!!(x.source||x.actor)&&((x.source||x.actor).hp/(x.source||x.actor).maxHp)>Number(c.value),
    hpPctBelow:(c,x)=>!!(x.source||x.actor)&&((x.source||x.actor).hp/(x.source||x.actor).maxHp)<Number(c.value),
    targetHpPctAbove:(c,x)=>!!x.target&&x.target.hp/x.target.maxHp>Number(c.value),
    targetHpPctBelow:(c,x)=>!!x.target&&x.target.hp/x.target.maxHp<Number(c.value),
    hasStatus:(c,x)=>!!x.battle?.hasStatus(x.source||x.actor,c.status),
    missingStatus:(c,x)=>!x.battle?.hasStatus(x.source||x.actor,c.status),
    targetHasStatus:(c,x)=>!!x.battle?.hasStatus(x.target,c.status),
    targetMissingStatus:(c,x)=>!x.battle?.hasStatus(x.target,c.status),
    resourceAtLeast:(c,x)=>Number(x.battle?.getResource?x.battle.getResource(x.source||x.actor,c.resource):((x.source||x.actor)?.stats?.[c.resource]??0))>=Number(c.value||0),
    targetResourceAtLeast:(c,x)=>Number(x.battle?.getResource?x.battle.getResource(x.target,c.resource):(x.target?.stats?.[c.resource]??0))>=Number(c.value||0),
    resourceIs:(c,x)=>String(x.resource||x.event?.resource||'').toUpperCase()===String(c.resource||'').toUpperCase(),
    statusStacksAtLeast:(c,x)=>Number(x.battle?.status(x.source||x.actor,c.status)?.stacks||0)>=Number(c.value||1),
    targetStatusStacksAtLeast:(c,x)=>Number(x.battle?.status(x.target,c.status)?.stacks||0)>=Number(c.value||1),
    sourceTag:(c,x)=>!!(x.source||x.actor)?.tags?.includes(c.tag),
    targetTag:(c,x)=>!!x.target?.tags?.includes(c.tag),
    statusTag:(c,x)=>!!(x.source||x.actor)?.statuses?.some(s=>(NCB.STATUS_DEFS?.[s.id]?.tags||[]).includes(c.tag)),
    targetStatusTag:(c,x)=>!!x.target?.statuses?.some(s=>(NCB.STATUS_DEFS?.[s.id]?.tags||[]).includes(c.tag)),
    consumedStacksAtLeast:(c,x)=>Number(x.CONSUMED_STACKS||0)>=Number(c.value||1),
    lastHit:(_c,x)=>x.LAST_HIT===true,
    lastCrit:(_c,x)=>x.LAST_CRIT===true,
    lastKill:(_c,x)=>x.LAST_KILL===true,
    dealtDamageAtLeast:(c,x)=>Number(x.LAST_DAMAGE||0)>=Number(c.value||0),
    dealtHpDamageAtLeast:(c,x)=>Number(x.LAST_HP_DAMAGE||0)>=Number(c.value||0),
    tag:(c,x)=>!!x.tags?.includes(c.tag),
    damageType:(c,x)=>x.damageType===c.damageType,
    livingAlliesAtMost:(c,x)=>!!(x.source||x.actor)&&x.battle.getLiving((x.source||x.actor).teamId).length<=Number(c.value),
    livingEnemiesAtMost:(c,x)=>!!(x.source||x.actor)&&x.battle.getLiving(x.battle.enemyTeam((x.source||x.actor).teamId)).length<=Number(c.value),
  };
  for(const [id,test] of Object.entries(conditions))registerConditionComponent(id,{name:id,human:`通用条件 ${id}。`,ai:`predicate ${id}`,test});

  [
    ['ModifyStat','属性修正'],['ModifyAccuracy','技能命中修正'],['ModifyHits','攻击段数修正'],['ModifyCritChance','暴击概率修正'],
    ['ModifyPenetration','防御穿透修正'],['ModifyDamageDealt','输出伤害修正'],['ModifyDamageTaken','承受伤害修正'],
    ['ModifyHealDealt','治疗输出修正'],['ModifyHealTaken','治疗承受修正'],['ModifyResourceCost','资源费用修正'],['ModifyResourceGain','资源获得修正'],
    ['ModifyCooldown','冷却修正'],['ModifyShield','屏障获得修正'],['ModifyWard','类型护符获得修正'],['ModifyResistance','最终抗性修正'],
    ['ModifyPriority','行动优先级修正'],['EntityDefeated','实体击倒']
  ].forEach(([id,name])=>registerEventComponent(id,{name,kind:'relay',human:`统一事件插入点：${name}。`,ai:`relay-event ${id}`}));
  [
    ['afterDamageTaken','受伤后'],['afterDamageDealt','造成伤害后'],['afterHealTaken','受到治疗后'],['afterHealDealt','造成治疗后'],
    ['afterDefeated','被击倒后'],['afterKill','击杀后'],['afterStatusApplied','获得状态后'],['afterStatusInflicted','施加状态后'],
    ['afterStatusRemoved','状态移除后'],['roundStart','回合开始'],['roundEnd','回合结束']
  ].forEach(([id,name])=>registerEventComponent(id,{name,kind:'trigger',human:`标准 Trigger Event：${name}。`,ai:`trigger-event ${id}`}));

  function describeParameter(id,value){const def=PARAMETER_CATALOG[id];if(!def)return null;return{...def,value,summary:`${def.name}: ${value ?? def.defaultValue}${def.unit?` ${def.unit}`:''}。${def.effect}`};}

  NCB.PARAMETER_CATALOG=PARAMETER_CATALOG;
  NCB.PARAMETER_LIST=PARAMETER_LIST;
  NCB.CONDITION_COMPONENTS=CONDITION_COMPONENTS;
  NCB.EFFECT_COMPONENTS=EFFECT_COMPONENTS;
  NCB.TARGET_COMPONENTS=TARGET_COMPONENTS;
  NCB.EVENT_COMPONENTS=EVENT_COMPONENTS;
  NCB.MODIFIER_OPERATIONS=MODIFIER_OPERATIONS;
  NCB.MODIFIER_PHASES=MODIFIER_PHASES;
  NCB.registerConditionComponent=registerConditionComponent;
  NCB.registerEffectComponent=registerEffectComponent;
  NCB.registerTargetComponent=registerTargetComponent;
  NCB.registerEventComponent=registerEventComponent;
  NCB.registerModifierOperation=registerModifierOperation;
  NCB.applyModifierOperation=applyModifierOperation;
  NCB.applyModifierBand=applyModifierBand;
  NCB.registerParameter=registerParameter;
  NCB.registerCombatPlugin=registerCombatPlugin;
  NCB.COMBAT_PLUGIN_API_VERSION=1;
  NCB.describeParameter=describeParameter;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
