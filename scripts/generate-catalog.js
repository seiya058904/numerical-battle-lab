const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
global.NCB={};
for(const f of ['components.js','rules.js','content.js']) require(path.join(root,'src',f));
const NCB=global.NCB;
const basicCats=new Set(['实体基础','技能','防御','状态']);
const rows=NCB.PARAMETER_LIST.map(def=>({...def,tier:basicCats.has(def.category)?'core':'advanced'}));
const cleanRegistry=r=>Object.fromEntries(Object.entries(r).map(([id,s])=>[id,Object.fromEntries(Object.entries(s).filter(([,v])=>typeof v!=='function'))]));
const machine={
  schemaVersion:1,
  generatedFrom:'src/components.js',
  counts:{
    parameters:rows.length,
    effects:Object.keys(NCB.EFFECT_COMPONENTS).length,
    conditions:Object.keys(NCB.CONDITION_COMPONENTS).length,
    targets:Object.keys(NCB.TARGET_COMPONENTS).length,
    events:Object.keys(NCB.EVENT_COMPONENTS).length,
    damageTypes:Object.keys(NCB.DAMAGE_TYPES).length,
    units:Object.keys(NCB.UNIT_DEFS).length,
    skills:Object.keys(NCB.SKILL_DEFS).length,
    statuses:Object.keys(NCB.STATUS_DEFS).length,
  },
  parameters:rows,
  effects:cleanRegistry(NCB.EFFECT_COMPONENTS),
  conditions:cleanRegistry(NCB.CONDITION_COMPONENTS),
  targets:cleanRegistry(NCB.TARGET_COMPONENTS),
  events:cleanRegistry(NCB.EVENT_COMPONENTS),
  damageTypes:NCB.DAMAGE_TYPES,
};
fs.mkdirSync(path.join(root,'docs'),{recursive:true});
fs.writeFileSync(path.join(root,'docs','numeric-component-catalog.json'),JSON.stringify(machine,null,2));
const byCat=new Map();for(const row of rows){if(!byCat.has(row.category))byCat.set(row.category,[]);byCat.get(row.category).push(row);}
let md=`# 数值组件目录 / Numeric Component Catalog\n\n`;
md+=`这不是角色技能表，而是整个战斗系统的“积木盒”。角色、技能、状态只允许组合这些通用积木和参数；新增普通内容不应要求修改 BattleEngine。\n\n`;
md+=`当前固定能力面：**${rows.length} 个参数旋钮 / ${machine.counts.effects} 个 Effect 组件 / ${machine.counts.conditions} 个 Condition 组件 / ${machine.counts.targets} 个 Target 组件 / ${machine.counts.events} 个 Event 插入点 / ${machine.counts.damageTypes} 个 Damage Type**。\n\n`;
md+=`当前内容只是示例组合：${machine.counts.units} 个实体、${machine.counts.skills} 个技能、${machine.counts.statuses} 个状态。理论组合空间远大于这些示例。\n\n`;
md+=`## 设计原则\n\n1. **角色不是代码。** 角色只提供基础 Stat、资源、技能 ID、被动组件和 Trigger 数据。\n2. **技能不是函数。** 技能由 Target + Cost + Requirement + Effect[] + Formula 组合。\n3. **数值不是硬编码逻辑。** 伤害、治疗、护盾、DoT、资源转换都使用公式和参数。\n4. **插件只扩原语。** 只有出现全新规则原语时才注册新 Damage Type / Effect / Condition / Target / Event；普通新卡不改引擎。\n5. **同一语义只实现一次。** 例如穿透、暴击、命中、状态层数都只有一个 canonical pipeline。\n\n`;
md+=`## 成熟项目给我们的参照\n\n- **Pokémon Showdown**：不是靠几百个独立公式，而是 6 个基础 Stat + Move 参数（basePower、accuracy、priority、critRatio、multihit、recoil、drain 等）+ 大量 Event modifier 插入点组合出海量机制。我们的 Event/Queue/RNG 思路以它为主要成熟参考。\n- **Cataclysm-DDA**：一次攻击是多个 damage unit 的集合，每个分量独立拥有类型、穿透、倍率；对应本项目 damageComponents。\n- **Wesnoth**：weapon special 可以修改 damage、attacks、chance_to_hit 等攻击参数；对应本项目 Event Modifier。\n- **ToME 风格 RPG**：多资源、持续技能、抗性/穿透、维持费用与资源转换；对应 Resource/Sustain/Resistance 组件。\n- **Freeciv / Unciv**：Effect 与 Requirement 数据化组合；对应 Condition tree + Effect DSL。\n\n`;
for(const [cat,list] of byCat){
  md+=`## ${cat}\n\n| ID | 名称 | 类型 | 单位 | 默认 | 建议范围 | 人类说明 | AI/数值含义 |\n|---|---|---|---|---:|---|---|---|\n`;
  for(const x of list){
    const safe=v=>String(v??'').replace(/\|/g,'\\|').replace(/\n/g,' ');
    md+=`| \`${x.id}\` | ${safe(x.name)} | ${safe(x.kind)} | ${safe(x.unit)} | ${safe(x.defaultValue)} | ${safe(x.range)} | ${safe(x.human)} | ${safe(x.ai)} |\n`;
  }
  md+='\n';
}
md+=`## Effect 组件\n\n`;
for(const x of Object.values(NCB.EFFECT_COMPONENTS))md+=`- **${x.id} / ${x.name}** — ${x.human} 可配置字段：${(x.fields||[]).map(v=>'`'+v+'`').join(', ')||'无'}。\n`;
md+=`\n## Condition 组件\n\n${Object.keys(NCB.CONDITION_COMPONENTS).map(id=>'`'+id+'`').join(' · ')}\n`;
md+=`\n## Target 组件\n\n${Object.entries(NCB.TARGET_COMPONENTS).map(([id,s])=>`- \`${id}\` — ${s.human}`).join('\n')}\n`;
md+=`\n## Event 插入点\n\n${Object.entries(NCB.EVENT_COMPONENTS).map(([id,s])=>`- \`${id}\` — ${s.human}`).join('\n')}\n`;
md+=`\n## 一张“卡 / 实体技能”到底能调什么？\n\n普通技能通常只需要 6–12 个旋钮，例如：目标、费用、冷却、优先级、命中、伤害类型、公式、攻击段数、暴击加成、穿透、附加状态概率、状态持续时间。复杂技能可以再组合 Requirement、Condition、Repeat、多个 Damage Component、资源转换、状态消费、Trigger 等，但仍然只使用本目录的固定积木。\n\nAI 工具应优先读取 \`docs/numeric-component-catalog.json\`，不要从角色 ID 猜规则。\n`;
fs.writeFileSync(path.join(root,'docs','NUMERIC-COMPONENT-CATALOG.md'),md);
console.log(JSON.stringify(machine.counts));
