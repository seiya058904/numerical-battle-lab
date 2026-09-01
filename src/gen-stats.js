(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  const PRIMARY_STAT_LIST=['MAX_HP','ATK','DEF','RES','SPD'];
  const ARCHETYPES={
    Balanced:{MAX_HP:.30,ATK:.25,DEF:.18,RES:.18,SPD:.09},
    Tank:{MAX_HP:.38,ATK:.14,DEF:.22,RES:.20,SPD:.06},
    Bruiser:{MAX_HP:.31,ATK:.29,DEF:.16,RES:.14,SPD:.10},
    Assassin:{MAX_HP:.20,ATK:.35,DEF:.10,RES:.08,SPD:.27},
    Mage:{MAX_HP:.23,ATK:.34,DEF:.08,RES:.17,SPD:.18},
    Support:{MAX_HP:.30,ATK:.14,DEF:.14,RES:.20,SPD:.22},
    Controller:{MAX_HP:.27,ATK:.17,DEF:.12,RES:.18,SPD:.26},
  };
  // BP->stat conversion (registry, spec 10). The spec's example constants
  // (MAX_HP=600+BP*30, ATK=60+BP*3, ...) produce stats ~40x the existing engine's
  // content band and make generated cards unable to fight alongside built-in units,
  // so these registry values are calibrated to land C Lv100 in the same band as
  // existing demo units (MAX_HP ~120-250, ATK ~60-100, DEF ~45-85, SPD ~60-95).
  // Structure stays exactly as spec: BASE + BP * K. Tune here to rescale the whole
  // generated-card power level.
  const PRIMARY_CONVERSION={
    MAX_HP:bp=>90+Number(bp)*0.70,
    ATK:bp=>40+Number(bp)*0.32,
    DEF:bp=>30+Number(bp)*0.45,
    RES:bp=>30+Number(bp)*0.45,
    SPD:bp=>55+Number(bp)*0.28,
  };
  function registerArchetype(id,weights){
    if(!id)throw new Error('archetype id required');
    if(!weights||typeof weights!=='object')throw new Error('archetype weights required');
    ARCHETYPES[id]={...weights};
    return ARCHETYPES[id];
  }
  // Deterministic FNV-1a seed for Gen5PRNG from a string.
  function deterministicSeed(seed){
    let h=2166136261>>>0;const s=String(seed==null?'':seed);
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    return 'gen5,'+((h>>>0)&0xffff)+','+((h>>>16)&0xffff)+',1,2';
  }
  // Primary: archetype weights x jitter, renormalized, then BP->stat conversion.
  function allocatePrimary({budget,archetype,seed}){
    const w=ARCHETYPES[archetype];
    if(!w)throw new Error('unknown archetype: '+archetype);
    const prng=new NCB.Gen5PRNG(deterministicSeed('primary:'+seed));
    let raw={},sum=0;
    for(const s of PRIMARY_STAT_LIST){
      const j=1+(prng.random(-1200,1201)/10000);
      raw[s]=(w[s]||0)*j;sum+=raw[s];
    }
    const weight={};for(const s of PRIMARY_STAT_LIST)weight[s]=raw[s]/sum;
    const statBP={};for(const s of PRIMARY_STAT_LIST)statBP[s]=Math.round(Number(budget)*weight[s]);
    // fix rounding so BP sum equals budget exactly
    const diff=Math.round(Number(budget))-PRIMARY_STAT_LIST.reduce((x,s)=>x+statBP[s],0);
    statBP[PRIMARY_STAT_LIST[0]]+=diff;
    const stats={};for(const s of PRIMARY_STAT_LIST)stats[s]=PRIMARY_CONVERSION[s](statBP[s]);
    return{statBP,stats,weights:weight};
  }
  const SECONDARY_BASELINE={
    ACC:88,EVA:3,CRIT:5,CRIT_DMG:140,PEN:0,RES_PEN:0,
    HEAL_POWER:100,HEAL_TAKEN:100,SHIELD_POWER:100,STATUS_POWER:100,STATUS_RESIST:0,
    LIFESTEAL:0,REFLECT:0,RESOURCE_GAIN:100,RESOURCE_COST_MULT:100,COOLDOWN_RATE:100,
  };
  const SECONDARY_COST={ACC:2,EVA:4,CRIT:3,CRIT_DMG:1,PEN:2.5,RES_PEN:2.5,HEAL_POWER:1.5,HEAL_TAKEN:2,SHIELD_POWER:1.5,STATUS_POWER:1.5,STATUS_RESIST:2,LIFESTEAL:3,REFLECT:4};
  const SECONDARY_BOUNDS={
    ACC:[50,99],EVA:[0,40],CRIT:[0,60],CRIT_DMG:[125,250],PEN:[0,60],RES_PEN:[0,60],
    HEAL_POWER:[50,200],HEAL_TAKEN:[50,200],SHIELD_POWER:[50,200],STATUS_POWER:[50,200],STATUS_RESIST:[0,100],
    LIFESTEAL:[0,50],REFLECT:[0,40],RESOURCE_GAIN:[50,200],RESOURCE_COST_MULT:[50,200],COOLDOWN_RATE:[50,200],
  };
  const SECONDARY_ORDER=Object.keys(SECONDARY_BASELINE);
  // Secondary: greedy seeded purchases of +1% increments within bounds until budget spent.
  function allocateSecondary({budget,seed}){
    const prng=new NCB.Gen5PRNG(deterministicSeed('secondary:'+seed));
    const out={};for(const k of SECONDARY_ORDER)out[k]=SECONDARY_BASELINE[k];
    let remaining=Math.max(0,Number(budget));
    let guard=0;
    while(remaining>0&&guard++<8000){
      const affordable=SECONDARY_ORDER.filter(k=>{
        const cost=SECONDARY_COST[k];if(!cost)return false;
        const next=out[k]+1;
        return next<=SECONDARY_BOUNDS[k][1]&&cost<=remaining;
      });
      if(!affordable.length)break;
      const pick=affordable[prng.random(affordable.length)];
      out[pick]+=1;remaining-=SECONDARY_COST[pick];
    }
    for(const k of SECONDARY_ORDER)out[k]=Math.round(out[k]*10)/10;
    return{seconds:out,spent:Math.round((Number(budget)-remaining)*10)/10};
  }
  NCB.PRIMARY_STAT_LIST=PRIMARY_STAT_LIST.slice();
  NCB.ARCHETYPES=ARCHETYPES;
  NCB.PRIMARY_CONVERSION=PRIMARY_CONVERSION;
  NCB.registerArchetype=registerArchetype;
  NCB.allocatePrimary=allocatePrimary;
  NCB.SECONDARY_BASELINE=SECONDARY_BASELINE;
  NCB.SECONDARY_COST=SECONDARY_COST;
  NCB.SECONDARY_BOUNDS=SECONDARY_BOUNDS;
  NCB.SECONDARY_ORDER=SECONDARY_ORDER.slice();
  NCB.allocateSecondary=allocateSecondary;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);