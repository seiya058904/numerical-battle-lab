// Canonical v6 presets (Generator v6 Power Budget Contract), loaded from
// content/presets-v6.js/json. Kept SEPARATE from NCB.SYSTEM_PRESETS (which stays
// the v5 catalog so the default generator/presets behavior is unchanged). Exposed
// as NCB.SYSTEM_PRESETS_V6 for the v6 path (lab/audit/tests).
(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  const content=(typeof module!=='undefined'&&module.exports)?require('../content/presets-v6.json'):NCB.PRESET_V6_CONTENT;
  if(!content||content.cards.length!==60)throw new Error('Missing canonical v6 presets');
  NCB.SYSTEM_PRESETS_V6=content.cards;
  NCB.buildSystemPresetsV6=()=>NCB.deepClone(content.cards);
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);