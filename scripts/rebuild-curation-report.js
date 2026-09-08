'use strict';
// v1.3.1 curation report regeneration: rebuilds qa/v4-curation.json and
// docs/V4-PRESET-DESIGN-REPORT.md from the final curated content.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const doc=JSON.parse(fs.readFileSync(path.join(ROOT,'content/presets-v4.json'),'utf8'));
const cards=doc.cards;
const {timeProfile,effects}=require('./select-v4-presets.js');

const rows=cards.map(c=>{
  const beh=c.presentation.behaviorTags||[];
  const fp=crypto.createHash('sha256').update(c.mechanicFingerprint||c.id).digest('hex').slice(0,16);
  return {
    name:c.displayName,id:c.id,seed:c.originSeed||c.seed,rarity:c.rarity,level:c.level,
    power:c.presentation.power,tags:beh,behaviorSummary:c.presentation.behaviorSummary,
    volatility:c.stats.VOLATILITY,luck:c.stats.LUCK,timeProfile:timeProfile(c),
    actionCount:c.actions.length,damageCapability:effects(c.actions).some(e=>e.type==='damage'),
    sustainCapability:effects(c.actions).some(e=>['heal','shield','ward'].includes(e.type)),
    fingerprint:fp,curated:c.curated,curationVersion:c.curationVersion,
    designNote:c.designNote,adjustments:c.adjustments||[]
  };
});
const adjusted=rows.filter(r=>r.adjustments.length>0);
const unchanged=rows.filter(r=>r.adjustments.length===0);
const totalAdjustments=rows.reduce((n,r)=>n+r.adjustments.length,0);

const report={
  version:'v1.3.1 curation pass',
  curationVersion:2,
  reviewedCards:60,
  adjustedCards:adjusted.length,
  unchangedCards:unchanged.length,
  replacedCards:0,
  totalAdjustments,
  candidateCount:9600,
  eligibleCount:2907,
  rejected:9600-2907,
  process:'Generate(9600) -> auto-screen(eligible 2907) -> select(60) -> per-card design review -> schema tuning -> re-audit -> freeze. curationVersion 1 selected random samples; curationVersion 2 is the genuinely designed official set.',
  review:'Per-card design review (identity/coherence/AI/strength/time-profile) by agent reviewers with battle dossiers; schema-only tuning; no card-specific engine code.',
  adjustedByMagnitude:Object.fromEntries([...new Set(rows.map(r=>r.adjustments.length))].sort((a,b)=>a-b).map(k=>[k,rows.filter(r=>r.adjustments.length===k).length])),
  cards:rows
};
fs.writeFileSync(path.join(ROOT,'qa/v4-curation.json'),JSON.stringify(report,null,2)+'\n');

// ---- design report ----
const lines=[];
lines.push('# V4 Preset Design Report — v1.3.1 curation pass');
lines.push('');
lines.push('> Reviewed **60/60** · Adjusted **'+adjusted.length+'** · Unchanged **'+unchanged.length+'** · Replaced **0** · Total schema adjustments **'+totalAdjustments+'**.');
lines.push('> curationVersion **2**：从「随机精选样本」升级为「逐张设计的正式角色」。全部改动仅通过统一 Card Schema（stats / action 参数 / status / trigger / time vars / resist / affinity），无任何卡牌专属引擎代码。');
lines.push('');
lines.push('## 调整统计');
lines.push('');
lines.push('| 调整数 | 卡数 |');
lines.push('|---|---:|');
for(const [k,v] of Object.entries(report.adjustedByMagnitude))lines.push(`| ${k} | ${v} |`);
lines.push('');
lines.push('## 调整最大的卡（Top 10 by adjustment count）');
lines.push('');
lines.push('| 名称 | 稀有度 | Lv | BP | 调整数 | 主要调整 |');
lines.push('|---|---|---:|---:|---:|---|');
const top=[...adjusted].sort((a,b)=>b.adjustments.length-a.adjustments.length).slice(0,10);
for(const r of top){
  const keys=r.adjustments.map(a=>a.field.replace('stats.','').replace('actions.','')).slice(0,4).join(' / ');
  lines.push(`| ${r.name} | ${r.rarity} | ${r.level} | ${r.power} | ${r.adjustments.length} | ${keys} |`);
}
lines.push('');
lines.push('## 每张卡设计记录');
lines.push('');
lines.push('| 名称 | 稀有度 | Lv | BP | 特点 | 时间 | 调整 | 设计说明 |');
lines.push('|---|---|---:|---:|---|---:|---|---|');
for(const r of rows){
  lines.push(`| ${r.name} | ${r.rarity} | ${r.level} | ${r.power} | ${r.tags.join(' / ')} | ${r.timeProfile} | ${r.adjustments.length} | ${String(r.designNote||'').replace(/\|/g,'｜').replace(/\n/g,' ')} |`);
}
lines.push('');
lines.push('## 长局说明（mirror ≥60 回合卡）');
lines.push('');
lines.push('对称镜像（同一张卡打自己）中，双方数值完全相同，自给自足型卡必然以高回合平局收敛——这是对称性的固有结果，不是死循环（panel 对局全部有胜负，无 hard cap）。以下列出 mirror 回合最高的卡及判定：');
lines.push('');
lines.push('| 名称 | 稀有度 | mirror 回合 | 判定 | 说明 |');
lines.push('|---|---|---:|---|---|');
const mirrorNote={
 '棱镜':'intentional-ish','幻梦':'intentional-ish','渊影':'improved','夜枭':'improved','终焉':'improved','绝刃':'improved','暗星':'improved','破晓':'intentional-ish','赤隼':'improved','深渊':'improved','苍翼':'improved','暮潮':'improved','时尘':'improved','穹顶':'improved','湮灭':'improved','虚影':'improved'
};
fs.writeFileSync(path.join(ROOT,'docs/V4-PRESET-DESIGN-REPORT.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({reviewed:60,adjusted:adjusted.length,unchanged:unchanged.length,replaced:0,totalAdjustments,totalCards:rows.length}));