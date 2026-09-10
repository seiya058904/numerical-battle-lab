// Canonical v7 content (frozen, curated). v6/v5/v4 content stays legacy.
// fixture (content/presets-v6.js). Kept separate from editable browser storage.
(function(root){
 'use strict';const NCB=root.NCB;
 const content=(typeof module!=='undefined'&&module.exports)?require('../content/presets-v7.json'):NCB.PRESET_V7_CONTENT;
 if(!content||content.cards.length!==60)throw new Error('Missing canonical v7 presets');
 NCB.SYSTEM_PRESETS_V7=content.cards;
 for(const c of content.cards)NCB.cachePresetPower?.(c);
 NCB.buildSystemPresetsV7=()=>NCB.deepClone(content.cards);
 if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
