'use strict';
function wilsonIntervalV7(successes,total,z=1.959963984540054){
  if(total<=0)return {lower:0,upper:1};
  const p=successes/total,z2=z*z,denominator=1+z2/total;
  const center=(p+z2/(2*total))/denominator;
  const margin=z*Math.sqrt((p*(1-p)+z2/(4*total))/total)/denominator;
  return {lower:Math.max(0,center-margin),upper:Math.min(1,center+margin)};
}
function evaluateProductScenarioV7(counts,gate){
  const battles=counts.higherWins+counts.lowerWins+counts.draws;
  const higherRate=counts.higherWins/battles,lowerRate=counts.lowerWins/battles;
  const higherWilson95=wilsonIntervalV7(counts.higherWins,battles);
  const checks={};
  if(gate.higherMin!==undefined)checks.higherMin=higherRate>=gate.higherMin;
  if(gate.higherMax!==undefined)checks.higherMax=higherRate<=gate.higherMax;
  if(gate.lowerMin!==undefined)checks.lowerMin=lowerRate>=gate.lowerMin;
  if(gate.lowerMax!==undefined)checks.lowerMax=lowerRate<=gate.lowerMax;
  if(gate.wilsonLowerMin!==undefined)checks.wilsonLowerMin=higherWilson95.lower>=gate.wilsonLowerMin;
  return {...counts,battles,higherRate,lowerRate,drawRate:counts.draws/battles,higherWilson95,gate,checks,pass:Object.values(checks).every(Boolean)};
}
module.exports={wilsonIntervalV7,evaluateProductScenarioV7};
