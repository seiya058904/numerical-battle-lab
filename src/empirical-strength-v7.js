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
  const regularization=Number(options.regularization??1e-4);
  const iterations=Number(options.iterations??300);
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
  for(const [family,rows] of byFamily){const bucket=stableHash(family)%100;const partition=bucket<70?'train':bucket<85?'validation':'test';out[partition].push(...rows);}
  return out;
}

module.exports={fitBradleyTerryV7,isConnectedGraphV7,splitCardFamiliesV7};
