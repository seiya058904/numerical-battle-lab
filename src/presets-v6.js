// Canonical v6 presets (current product default), loaded from presets-v6 content.
// The frozen v5 catalog remains available as a legacy artifact.
(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  const content=(typeof module!=='undefined'&&module.exports)?require('../content/presets-v6.json'):NCB.PRESET_V6_CONTENT;
  if(!content||content.cards.length!==60)throw new Error('Missing canonical v6 presets');
  NCB.SYSTEM_PRESETS_V6=content.cards;
  NCB.buildSystemPresetsV6=()=>NCB.deepClone(content.cards);
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
