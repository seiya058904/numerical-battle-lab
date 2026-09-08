'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const file of ['kernel','components','rules','power','power-v5','strength-geometry-v7'])require(path.join(ROOT,'src',file+'.js'));
const N=global.NCB;
const levels=[1,10,20,30,40,50,60,70,75,80,90,100];
const levelScores=Object.fromEntries(levels.map(level=>[level,+N.levelScoreV7(level).toFixed(6)]));
const rarityScores=Object.fromEntries(N.RARITY_SCORE_V7);
const geometry=N.assertStrengthGeometryV7();
const cases={
  lv100C:{theta:+N.targetThetaV7(100,'C').toFixed(6)},
  lv40XC:{theta:+N.targetThetaV7(40,'XS_COLLECTOR').toFixed(6)},
  lv70XC:{theta:+N.targetThetaV7(70,'XS_COLLECTOR').toFixed(6)},
  lv70XS:{theta:+N.targetThetaV7(70,'XS').toFixed(6)},
  lv50C:{theta:+N.targetThetaV7(50,'C').toFixed(6)},
  lv50XC:{theta:+N.targetThetaV7(50,'XS_COLLECTOR').toFixed(6)},
};
const artifact={schemaVersion:1,formula:{levelSpan:N.LEVEL_SPAN_V7,levelExponent:N.LEVEL_EXPONENT_V7,anchor:N.STRENGTH_ANCHOR_V7},levelScores,rarityScores,geometry:{...geometry,
  highVsLowLevelGapRatio:(N.levelScoreV7(100)-N.levelScoreV7(70))/(N.levelScoreV7(50)-N.levelScoreV7(20))},cases,
  comparisons:{lv100CMinusLv40XC:cases.lv100C.theta-cases.lv40XC.theta,lv70XCMinusLv100C:cases.lv70XC.theta-cases.lv100C.theta,lv70XSMinusLv100C:cases.lv70XS.theta-cases.lv100C.theta}};
const output=path.join(ROOT,'qa/v7-strength-geometry.json');
fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify(artifact,null,2));
