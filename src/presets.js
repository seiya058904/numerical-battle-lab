// Canonical v6 content (frozen, curated). v4/v5 content stays legacy/compatible.
// fixture (content/presets-v4.js). Kept separate from editable browser storage.
(function(root){
 'use strict';const NCB=root.NCB;
 const content=(typeof module!=='undefined'&&module.exports)?require('../content/presets-v6.json'):NCB.PRESET_V6_CONTENT;
 if(!content||content.cards.length!==60)throw new Error('Missing canonical v6 presets');
  // Unified battle-card metadata resolver (replaces ad-hoc state.library.find).
  // ctx = { system:[...presets], library:[...userCards], deployed:Map(templateId->card) }
  NCB.resolveCardMeta=function(templateId,ctx){
    if(!templateId)return null;
    if(ctx&&Array.isArray(ctx.system)){const c=ctx.system.find(x=>x&&x.id===templateId);if(c)return c;}
    if(ctx&&Array.isArray(ctx.library)){const c=ctx.library.find(x=>x&&x.id===templateId);if(c)return c;}
    if(ctx&&ctx.deployed&&ctx.deployed.has){const c=ctx.deployed.get(templateId);if(c)return c;}
    return null;
  };


 NCB.SYSTEM_PRESETS=content.cards;
 NCB.SYSTEM_PRESETS_V6=content.cards;
 for(const c of content.cards)NCB.cachePresetPower?.(c);
 NCB.buildSystemPresets=()=>NCB.deepClone(content.cards);
 if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
