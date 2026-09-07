// System preset cards for the player-facing UX.
//
// This is a small, read-only, deterministic library so a brand-new player can
// jump straight into AI-vs-AI spectating without creating any card first.
// Presets are generated at startup from the SAME Generator v3 the user uses:
//   - fixed deterministic seeds (same seed => identical card forever)
//   - no hand-written combat logic, no card-specific engine branch
//   - NOT written into the user's localStorage library (kept separate & read-only)
//
// BattlePower here is display-only reference (via NCB.battlePower); it never
// enters damage / AI / matchup math.
(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};

  // 14 presets: 7 archetypes x 2, covering all 12 rarity tiers and a broad
  // level span (10..100) so the user can immediately see rarity/level/战力的差异.
  // displayName override is presentation-only and never changes combat identity
  // (id/identity/stats/actions derive from seed+rarity+level+archetype).
  const PRESET_SPECS=[
    // --- Balanced ---
    {seed:'preset-balanced-c-low',   rarity:'C',         level:90, archetype:'Balanced', displayName:'磐石',
     blurb:'低配均衡：不突出的属性与多段行动。'},
    {seed:'preset-balanced-bp-hi',   rarity:'B_PLUS',    level:30, archetype:'Balanced', displayName:'棘甲',
     blurb:'低等级均衡：组合行动靠数量取胜。'},
    // --- Tank ---
    {seed:'preset-tank-s',           rarity:'S',         level:60, archetype:'Tank',     displayName:'岩甲兽',
     blurb:'高稀有坦克：高防厚血，护盾与减伤。'},
    {seed:'preset-tank-cp-hi',       rarity:'C_PLUS',    level:100,archetype:'Tank',     displayName:'方碑',
     blurb:'满级低配坦克：靠等级撑起高生存。'},
    // --- Bruiser ---
    {seed:'preset-bruiser-a',        rarity:'A',         level:80, archetype:'Bruiser',  displayName:'血性',
     blurb:'斗士：自伤换爆发，攻防兼顾。'},
    {seed:'preset-bruiser-b-mid',    rarity:'B',         level:50, archetype:'Bruiser',  displayName:'铁砧',
     blurb:'中规中矩的斗士，简单直接。'},
    // --- Assassin ---
    {seed:'preset-assassin-ss',      rarity:'SS',        level:40, archetype:'Assassin', displayName:'蚀脊',
     blurb:'高稀有刺客：高速、暴击、收割残血。'},
    {seed:'preset-assassin-a-low',   rarity:'A',         level:20, archetype:'Assassin', displayName:'迅影',
     blurb:'低等级刺客：靠机制而非数值。'},
    // --- Mage ---
    {seed:'preset-mage-sss',         rarity:'SSS',       level:50, archetype:'Mage',     displayName:'炽核',
     blurb:'高稀有法师：AOE 与状态引爆。'},
    {seed:'preset-mage-b-mid',       rarity:'B',         level:70, archetype:'Mage',     displayName:'静霜',
     blurb:'满级中配法师：持续法与资源循环。'},
    // --- Support ---
    {seed:'preset-support-xs-col',   rarity:'XS_COLLECTOR',level:30,archetype:'Support', displayName:'星辉',
     blurb:'典藏辅助：治疗、净化与资源。'},
    {seed:'preset-support-ap-hi',    rarity:'A_PLUS',    level:90, archetype:'Support', displayName:'甘霖',
     blurb:'高等级辅助：续航与团队恢复。'},
    // --- Controller ---
    {seed:'preset-controller-xs',    rarity:'XS',        level:60, archetype:'Controller',displayName:'幽语',
     blurb:'高稀有控制：状态与资源压制。'},
    {seed:'preset-controller-sss-col',rarity:'SSS_COLLECTOR',level:10,archetype:'Controller',displayName:'诡术',
     blurb:'典藏低等级控制：机制贵在组合。'},
  ];

  // Deterministic config templates; cards are built on load via Generator v3.
  function buildPresets(specs){
    const out=[];
    for(const spec of specs){
      const card=NCB.generateCardV3({seed:spec.seed,rarity:spec.rarity,level:spec.level,archetype:spec.archetype});
      if(spec.displayName)card.displayName=spec.displayName;
      if(spec.blurb)card.blurb=spec.blurb;
      out.push(card);
    }
    return out;
  }
  function validateAll(presets){
    const seen=new Map();
    for(const c of presets){
      if(!c||c.generatorVersion!==3)throw new Error(`preset ${c?.seed} is not a v3 card`);
      const key=Number(c.level)+'|'+c.rarity+'|'+c.archetype+'|'+c.seed;
      if(seen.has(key))throw new Error(`preset identity collision: ${key}`);
      seen.set(key,true);
    }
    // distinct display names
    const names=new Set(presets.map(c=>c.displayName||c.name));
    if(names.size!==presets.length)throw new Error('preset displayName collision');
  }

  // Unified battle-card metadata resolver (replaces ad-hoc state.library.find).
  // ctx = { system:[...presets], library:[...userCards], deployed:Map(templateId->card) }
  NCB.resolveCardMeta=function(templateId,ctx){
    if(!templateId)return null;
    if(ctx&&Array.isArray(ctx.system)){const c=ctx.system.find(x=>x&&x.id===templateId);if(c)return c;}
    if(ctx&&Array.isArray(ctx.library)){const c=ctx.library.find(x=>x&&x.id===templateId);if(c)return c;}
    if(ctx&&ctx.deployed&&ctx.deployed.has){const c=ctx.deployed.get(templateId);if(c)return c;}
    return null;
  };

  NCB.SYSTEM_PRESET_SPECS=PRESET_SPECS;
  NCB.buildSystemPresets=buildPresets;
  // Built once on load; read-only from the app.
  NCB.SYSTEM_PRESETS=buildPresets(PRESET_SPECS);
  validateAll(NCB.SYSTEM_PRESETS);
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);