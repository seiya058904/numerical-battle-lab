'use strict';
// Generates docs/CARD-NUMERICAL-REFERENCE.md from the canonical Numerical
// Knowledge Registry. GENERATED FROM CANONICAL — DO NOT HAND EDIT.
// Any drift between the registry and this file is a generation bug, not a doc edit.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4','behavior','battlepower-v2','numerical-knowledge'])require(path.join(ROOT,'src',f+'.js'));
const N=global.NCB;
const k=N.NUMERICAL_KNOWLEDGE();
const esc=s=>String(s??'').replace(/\|/g,'｜').replace(/\n/g,' ');

const lines=[];
lines.push('# CARD-NUMERICAL-REFERENCE — 卡牌数值知识参考');
lines.push('');
lines.push('> **GENERATED FROM CANONICAL NUMERICAL KNOWLEDGE REGISTRY. DO NOT HAND EDIT.**');
lines.push('> 唯一真源：`src/numerical-knowledge.js`（+ `src/components.js` 注册表）。生成：`npm run numerical-reference`。');
lines.push('> 玩家向说明在游戏内「数值百科」；本文件服务开发者 / Coding Agent / Content AI。');
lines.push('');

// 1. coverage summary
lines.push('## 0. 覆盖率总览');
lines.push('');
lines.push(`| 类别 | 已文档化 |`);
lines.push('|---|---:|');
lines.push(`| 参数 Card Stats / Resources | ${Object.keys(k.params).length} |`);
lines.push(`| 效果 Effect types | ${Object.keys(k.effects).length} |`);
lines.push(`| 条件 Conditions | ${Object.keys(k.conditions).length} |`);
lines.push(`| 目标 Targets | ${Object.keys(k.targets).length} |`);
lines.push(`| 事件 Events | ${Object.keys(k.events).length} |`);
lines.push(`| 修饰操作 Modifier ops | ${Object.keys(k.modifierOps).length} |`);
lines.push(`| 公式变量 Formula symbols | ${Object.keys(k.formulaSymbols).length} |`);
lines.push(`| 公式函数 Formula functions | ${Object.keys(k.formulaFunctions).length} |`);
lines.push(`| 伤害类型 Damage types | ${Object.keys(k.damageTypes).length} |`);
lines.push('');

lines.push('## 1. 卡牌参数（Card Stats / Resources）');
lines.push('');
lines.push('| 字段 | 中文名 | 方向 | 它是什么 | 调高会怎样 | 调低会怎样 | 谁读取 | 交互 |');
lines.push('|---|---|---|---|---|---|---|---|');
const cats=['实体基础','实体基础','实体基础','实体基础','实体基础'];
for(const [id,e] of Object.entries(k.params)){
  lines.push(`| ${id} | ${esc(e.nameZh)} | ${e.direction||''} | ${esc(e.summary)} | ${esc(e.higherEffect)} | ${esc(e.lowerEffect)} | ${esc((e.readBy||[]).join(' / '))} | ${esc((e.interactions||[]).join(' / '))} |`);
}
lines.push('');

lines.push('## 2. 效果组件（Effects）');
lines.push('');
lines.push('| 类型 | 说明 | 方向 | 字段 |');
lines.push('|---|---|---|---|');
for(const [id,e] of Object.entries(k.effects))lines.push(`| ${id} | ${esc(e.human)} | ${e.direction||''} | ${esc((e.fields||[]).join(' / '))} |`);
lines.push('');

lines.push('## 3. 条件组件（Conditions）');
lines.push('');
lines.push('| 类型 | 含义 |');
lines.push('|---|---|');
for(const [id,c] of Object.entries(k.conditions))lines.push(`| ${id} | ${esc(c.human)} |`);
lines.push('');

lines.push('## 4. 目标组件（Targets）');
lines.push('');
lines.push('| 类型 | 含义 |');
lines.push('|---|---|');
for(const [id,t] of Object.entries(k.targets))lines.push(`| ${id} | ${esc(t.human)} |`);
lines.push('');

lines.push('## 5. 事件 / Modifier（Events）');
lines.push('');
lines.push('| 事件 | 含义 |');
lines.push('|---|---|');
for(const [id,e] of Object.entries(k.events))lines.push(`| ${id} | ${esc(e.human)} |`);
lines.push('');

lines.push('## 6. Modifier 操作（band 顺序：SET → ADD → MULTIPLY → CAP → FINAL）');
lines.push('');
lines.push('| 操作 | 含义 |');
lines.push('|---|---|');
for(const [id,m] of Object.entries(k.modifierOps))lines.push(`| ${id} | ${esc(m.human)} |`);
lines.push('');

lines.push('## 7. 公式变量（Formula Symbols）');
lines.push('');
lines.push('| 符号 | 它是什么 | 可用上下文 | 示例 |');
lines.push('|---|---|---|---|');
for(const [id,s] of Object.entries(k.formulaSymbols))lines.push(`| ${id} | ${esc(s.what)} | ${esc(s.context)} | \`${esc(s.example)}\` |`);
lines.push('');

lines.push('## 8. 公式函数（Formula Functions）');
lines.push('');
lines.push('| 函数 | 说明 |');
lines.push('|---|---|');
for(const [id,f] of Object.entries(k.formulaFunctions))lines.push(`| ${id} | ${esc(f)} |`);
lines.push('');

lines.push('## 9. 伤害类型（Damage Types）');
lines.push('');
lines.push('| 类型 | 说明 |');
lines.push('|---|---|');
for(const [id,d] of Object.entries(k.damageTypes))lines.push(`| ${id} | ${esc(d)} |`);
lines.push('');

lines.push('## 10. 战斗实时状态（Runtime State，非卡牌永久属性）');
lines.push('');
lines.push('| 状态 | 说明 |');
lines.push('|---|---|');
for(const [id,s] of Object.entries(k.runtimeState))lines.push(`| ${id} | ${esc(s)} |`);
lines.push('');

lines.push('## 11. 计算链（Damage / Heal / Time / Randomness）');
lines.push('');
lines.push('```text');
lines.push('ATK → Damage Formula → Accuracy/Hit → Variance(×VOLATILITY,LUCK) → Crit → Defense/PEN → Type Resistance → Ward → Shield → HP → Lifesteal/Triggers');
lines.push('Heal Formula → HEAL_POWER → HEAL_TAKEN → Battle Wear Heal Factor → Missing-HP Cap → Actual Healing');
lines.push('ROUND → RAMP / FATIGUE → Dynamic Stats');
lines.push('ROUND → Battle Wear → Healing reduction → Terminal pressure (max-HP decay)');
lines.push('battle seed → hit → variance → LUCK distribution → crit → other random effects (deterministic replay)');
lines.push('```');
lines.push('');

const out=lines.join('\n');
fs.writeFileSync(path.join(ROOT,'docs/CARD-NUMERICAL-REFERENCE.md'),out);
console.log('docs/CARD-NUMERICAL-REFERENCE.md written:',out.length,'chars');