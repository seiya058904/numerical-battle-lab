'use strict';

function sigmoid(value){return value>=0?1/(1+Math.exp(-value)):Math.exp(value)/(1+Math.exp(value));}

function isConnectedGraphV7(nodes,edges){
  if(nodes.length<2)return true;
  const adjacency=new Map(nodes.map(id=>[id,new Set()]));
  for(const edge of edges){if(adjacency.has(edge.a)&&adjacency.has(edge.b)){adjacency.get(edge.a).add(edge.b);adjacency.get(edge.b).add(edge.a);}}
  const seen=new Set([nodes[0]]),queue=[nodes[0]];
  while(queue.length){for(const next of adjacency.get(queue.shift()))if(!seen.has(next)){seen.add(next);queue.push(next);}}
  return seen.size===nodes.length;
}

function fitBradleyTerryV7(nodes,edges,options={}){
  if(!isConnectedGraphV7(nodes,edges))throw new Error('battle graph must be connected');
  const regularization=Number(options.regularization??.01);
  const iterations=Number(options.iterations??40000);
  const theta=Object.fromEntries(nodes.map(id=>[id,0]));
  let converged=false;
  for(let iteration=0;iteration<iterations;iteration++){
    const gradient=Object.fromEntries(nodes.map(id=>[id,-regularization*theta[id]]));
    const information=Object.fromEntries(nodes.map(id=>[id,regularization]));
    for(const edge of edges){
      const games=Number(edge.winsA||0)+Number(edge.winsB||0)+Number(edge.draws||0);
      if(!games)continue;
      const scoreA=Number(edge.winsA||0)+Number(edge.draws||0)*0.5;
      const probability=sigmoid(theta[edge.a]-theta[edge.b]);
      const residual=scoreA-games*probability;
      const info=Math.max(1e-9,games*probability*(1-probability));
      gradient[edge.a]+=residual;gradient[edge.b]-=residual;
      information[edge.a]+=info;information[edge.b]+=info;
    }
    let maxStep=0;
    for(const id of nodes){const step=0.65*gradient[id]/information[id];theta[id]+=step;maxStep=Math.max(maxStep,Math.abs(step));}
    const mean=nodes.reduce((sum,id)=>sum+theta[id],0)/nodes.length;
    for(const id of nodes)theta[id]-=mean;
    if(maxStep<1e-9){converged=true;break;}
  }
  const info=Object.fromEntries(nodes.map(id=>[id,regularization]));
  let logLoss=0,games=0;
  for(const edge of edges){
    const count=Number(edge.winsA||0)+Number(edge.winsB||0)+Number(edge.draws||0);
    if(!count)continue;
    const p=Math.min(1-1e-12,Math.max(1e-12,sigmoid(theta[edge.a]-theta[edge.b])));
    const scoreA=Number(edge.winsA||0)+Number(edge.draws||0)*0.5;
    logLoss-=scoreA*Math.log(p)+(count-scoreA)*Math.log(1-p);games+=count;
    const edgeInfo=count*p*(1-p);info[edge.a]+=edgeInfo;info[edge.b]+=edgeInfo;
  }
  const standardError=Object.fromEntries(nodes.map(id=>[id,1/Math.sqrt(info[id])]));
  return {theta,standardError,converged,iterations,logLoss:games?logLoss/games:0,games};
}

function stableHash(text){let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function splitCardFamiliesV7(cards,familyOf=card=>card.seed){
  const byFamily=new Map();
  for(const card of cards){const family=familyOf(card);if(!byFamily.has(family))byFamily.set(family,[]);byFamily.get(family).push(card);}
  const out={train:[],validation:[],test:[]};
  const families=[...byFamily].sort((a,b)=>stableHash(a[0])-stableHash(b[0])||String(a[0]).localeCompare(String(b[0])));
  const n=families.length,testCount=n>=3?Math.max(1,Math.round(n*.15)):0,validationCount=n>=3?Math.max(1,Math.round(n*.15)):0;
  const trainCount=Math.max(1,n-testCount-validationCount);
  families.forEach(([,rows],index)=>out[index<trainCount?'train':index<trainCount+validationCount?'validation':'test'].push(...rows));
  return out;
}

function buildSparsePairsV7(cards){
  const sorted=cards.slice().sort((a,b)=>a.targetTheta-b.targetTheta||a.id.localeCompare(b.id));
  const pairs=[],seen=new Set();
  const add=(left,right,kind)=>{
    if(!left||!right||left.id===right.id)return;
    const ids=[left.id,right.id].sort(),key=ids.join('|');
    if(seen.has(key))return;seen.add(key);pairs.push({a:ids[0],b:ids[1],kind});
  };
  const tierGroups=new Map(),seedGroups=new Map();
  for(const card of sorted){
    const tier=`${card.level}|${card.rarity}`;if(!tierGroups.has(tier))tierGroups.set(tier,[]);tierGroups.get(tier).push(card);
    if(card.seed!==undefined){if(!seedGroups.has(card.seed))seedGroups.set(card.seed,[]);seedGroups.get(card.seed).push(card);}
  }
  for(const group of tierGroups.values())for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++)add(group[i],group[j],'same-tier');
  for(const group of seedGroups.values()){
    group.sort((a,b)=>a.targetTheta-b.targetTheta||a.id.localeCompare(b.id));
    for(let i=0;i<group.length-1;i++)add(group[i],group[i+1],'same-seed-level');
  }
  for(let i=0;i<sorted.length-1;i++)add(sorted[i],sorted[i+1],'near-tier');
  for(let i=0;i<sorted.length-3;i++)add(sorted[i],sorted[i+3],'cross-tier');
  const half=Math.floor(sorted.length/2);
  for(let i=0;i<half;i++)add(sorted[i],sorted[i+half],'cross-style');
  add(sorted[0],sorted.at(-1),'extreme-gap');
  if(sorted.length>4){add(sorted[0],sorted.at(-2),'extreme-gap');add(sorted[1],sorted.at(-1),'extreme-gap');}
  return pairs;
}

module.exports={fitBradleyTerryV7,isConnectedGraphV7,splitCardFamiliesV7,buildSparsePairsV7};
