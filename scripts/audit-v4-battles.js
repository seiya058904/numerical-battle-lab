'use strict';
const fs=require('node:fs'),path=require('node:path');
for(const f of ['kernel','components','rules','content','status-runtime','formula','validator','effects','engine','ai','power','gen-stats','gen-skills','generator','gen-names','gen-v2','gen-v3','gen-v4'])require('../src/'+f+'.js');
const N=global.NCB;
function undeploy(c){for(const [registry,key] of [[N.UNIT_DEFS,c.id],...c.actions.map(a=>[N.SKILL_DEFS,a.id]),...c.statuses.filter(s=>s.id.startsWith(c.id)).map(s=>[N.STATUS_DEFS,s.id])])delete registry[key];}
function fight(a,b,seed,maxRounds=100){
 N.deployCard(a);N.deployCard(b);const e=N.createBattle({seed:N.deriveSeed(seed),teamA:[a.id],teamB:[b.id],maxRounds});
 const atk=[];while(!e.outcome().ended){atk.push([e.round,e.getStat('A1','ATK'),e.getStat('B1','ATK')]);e.resolveRound([...N.planAI(e,'A','canonical'),...N.planAI(e,'B','canonical')]);}
 const result={rounds:e.history.length,winner:e.outcome().winner,hardCap:e.history.length>=maxRounds,actions:[...new Set(e.log.filter(x=>x.kind==='action').map(x=>x.skillId))],damage:e.log.filter(x=>x.kind==='damage'&&x.sourceId==='A1').reduce((n,x)=>n+x.hpDamage,0),healing:e.log.filter(x=>x.kind==='heal'&&x.sourceId==='A1').reduce((n,x)=>n+x.amount,0),atk};
 undeploy(a);if(a.id!==b.id)undeploy(b);return result;
}
function audit(n=3000){const rounds=[],counts={hardCap:0,draws:0,early:0,long:0};
 for(let i=0;i<n;i++){
  const level=10+(i*37)%91,rarity=N.RARITY_V2_ORDER[i%12];
  const a=N.generateCardV4({seed:'long-v4-a-'+i,rarity,level});
  const b=N.generateCardV4({seed:'long-v4-b-'+i,rarity:i%2?rarity:N.RARITY_V2_ORDER[(i*7+3)%12],level:i%2?level:10+(i*53)%91});
  const r=fight(a,b,812000+i);rounds.push(r.rounds);counts.hardCap+=r.hardCap;counts.draws+=r.winner==='draw';counts.early+=r.rounds<=3;counts.long+=r.rounds>40;
  if((i+1)%500===0)console.log('battles',i+1);
 }
 rounds.sort((a,b)=>a-b);const q=p=>rounds[Math.min(n-1,Math.floor((n-1)*p))];
 return {sample:n,maxRounds:100,seedProtocol:'long-v4-a/b-i; half same rarity and level, half varied; canonical AI, alternate strength distribution',median:q(.5),p90:q(.9),p95:q(.95),max:q(1),maxRoundsRate:counts.hardCap/n,drawRate:counts.draws/n,atMost3RoundRate:counts.early/n,over40RoundRate:counts.long/n,counts};
}
if(require.main===module){const r=audit(Number(process.argv[2])||3000);fs.writeFileSync(path.join(__dirname,'../qa/v4-long-battles.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r));}
module.exports={fight,audit,undeploy};
