'use strict';

const round3=value=>Math.round(value*1000)/1000;

function wilson95(successes,trials){
  if(!trials)return {low:0,high:1};
  const z=1.959963984540054;
  const p=successes/trials;
  const denominator=1+(z*z/trials);
  const centre=(p+(z*z/(2*trials)))/denominator;
  const margin=(z*Math.sqrt((p*(1-p)/trials)+(z*z/(4*trials*trials))))/denominator;
  return {low:round3(Math.max(0,centre-margin)),high:round3(Math.min(1,centre+margin))};
}

function emptyBattleCounts(){
  return {pairCount:0,battleCount:0,higherWins:0,lowerWins:0,draws:0,teamAWins:0,teamBWins:0};
}

function addBattleCounts(target,source){
  for(const key of Object.keys(emptyBattleCounts()))target[key]+=source[key];
  return target;
}

function scoreMirroredPair(low,high,pairedSeed,fight){
  const result=emptyBattleCounts();
  result.pairCount=1;
  result.battleCount=2;
  const lowAsA=fight(low,high,pairedSeed);
  const highAsA=fight(high,low,pairedSeed);

  if(lowAsA===1){result.lowerWins++;result.teamAWins++;}
  else if(lowAsA===-1){result.higherWins++;result.teamBWins++;}
  else result.draws++;

  if(highAsA===1){result.higherWins++;result.teamAWins++;}
  else if(highAsA===-1){result.lowerWins++;result.teamBWins++;}
  else result.draws++;
  return result;
}

function summarizeBattleCounts(counts){
  const n=counts.battleCount||0;
  const rate=value=>n?round3(value/n):0;
  return {
    ...counts,
    higherWinRate:rate(counts.higherWins),
    lowerWinRate:rate(counts.lowerWins),
    drawRate:rate(counts.draws),
    teamAWinRate:rate(counts.teamAWins),
    teamBWinRate:rate(counts.teamBWins),
    ci95:wilson95(counts.higherWins,n),
  };
}

module.exports={wilson95,emptyBattleCounts,addBattleCounts,scoreMirroredPair,summarizeBattleCounts};
