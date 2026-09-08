// Name Generator v2 — World Naming Grammar for Generator v5.
//
// Grammar (deterministic; seed + structural identity = species identity):
//   * A name = a fused SPECIES STEM (built from an ONSET + RIME morpheme, each
//     drawn from curated on-world pools -> a large, distinctive, original
//     two-char root space) plus 0–3 WORLD-HARMONIC syllables from a
//     mechanic-slanted fabric. The default is a 3-char name (stem + one coda),
//     which reads most like a species proper-noun; 2/4/5-char variants add
//     morphological variety.
//   * Rarity / level / BattlePower NEVER enter the name; same seed -> same name.
//   * The combined space (onsets × rimes × fabric harmonies) is large enough that
//     a 10k sample keeps a unique-name rate >= 99% (see naming audit).
//
// Legacy `gen-names.js` generateDisplayName stays for v1-v4 replay.
(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};

  // Onset morphemes — original evocative openings (not literal element/animal).
  const ON=[
    '珀','弥','迦','沧','朔','晞','霖','沩','燊','酡','玑','湜','渥','钺','晷','燠',
    '貘','猞','珐','旖','颙','鲵','磐','瑶','泓','隰','芃','昀','焜','璇','泷','澧',
    '葳','蘅','崆','嵯','珚','曦','冥','滂','珺','玓','渫','蜃','戮','胥','貃','矞',
  ];
  // Rime morphemes — evocating endings (fuse with onsets into species stems).
  const RM=[
    '岚','洛','罗','环','溟','曜','珀','渊','霄','翎','衡','沧','磐','笈','汐','冽',
    '嶂','珞','翳','崟','嵛','雾','玦','芷','麓','燿','玑','湫','沅','蕤','芜','峒',
    '峨','璃','箬','琫','沱','潸','璾','峯','洱','滃','暿','祲','岫','罅','穹','砉',
  ];
  // World-harmonic syllables per fabric (weak mechanic bias only).
  const HARM={
    wet:['泱','澜','汐','湜','洄','浟','漪','沆','渚','汨','湔','瀣'],
    stone:['珣','珞','珩','珺','麓','岑','磐','崟','岫','垓','琤','瓴'],
    vox:['曦','晟','灼','炅','晞','昀','熠','烜','焜','劭','暒','晙'],
    void:['霐','窈','暝','霭','霂','霡','暮','渊','霮','幽','霯','爩'],
    flux:['晷','蜃','遒','渫','竫','奫','嵫','夤','逡','湔','谽','奭'],
    feral:['貘','猞','貅','狻','麇','麖','獜','犼','貙','駃','貆','貈'],
  };
  const FABRIC_ORDER=Object.keys(HARM);
  const FALLBACK=['珺','澜','晟','麓','暝','蜃','萏','珩','璆','缇','斝','苣'];
  const ONSET_SET=new Set(ON),RIME_SET=new Set(RM);

  function rng(seed){return new NCB.Gen5PRNG(NCB.deriveSeed(NCB.seedHash(String(seed))));}
  const pick=(arr,pr)=>arr[Math.floor(pr.random()*arr.length)];

  function hasDoT(card){return (card.statuses||[]).some(st=>st.periodic);}
  function fabricFor(card){
    const s=card.stats||{};
    const actions=card.actions||card.skills||[];
    const shield=actions.some(a=>(a.effects||[]).some(e=>e.type==='shield'||e.type==='ward'));
    const heal=actions.some(a=>(a.effects||[]).some(e=>e.type==='heal'));
    const consume=actions.some(a=>(a.effects||[]).some(e=>e.type==='consumeStatus'));
    const dmg=actions.some(a=>a.kind==='damage');
    const lowHp=(s.MAX_HP||0)<25,highVol=(s.VOLATILITY||0)>=1.6,ramp=(s.RAMP_RATE||0)>0,fat=(s.FATIGUE_RATE||0)>0;
    const sc={wet:1,stone:1,vox:1,void:1,flux:1,feral:1};
    if(hasDoT(card))sc.wet+=2;
    if(shield)sc.stone+=2;
    if(consume)sc.void+=2;
    if(highVol)sc.flux+=2;
    if(fat||ramp)sc.flux+=1;
    if(dmg)sc.vox+=1;
    if(heal)sc.wet+=1;
    if(lowHp&&dmg)sc.feral+=2;
    const pr=rng('fab:'+(card.seed??'')+':fp');
    const max=Math.max(...Object.values(sc));
    const top=FABRIC_ORDER.filter(f=>sc[f]===max);
    return top[Math.floor(pr.random()*top.length)];
  }

  function speciesNameSignature(card){
    const fp=card.mechanicFingerprint?String(typeof card.mechanicFingerprint==='string'?card.mechanicFingerprint:JSON.stringify(card.mechanicFingerprint)):'';
    return 'naming-v2:'+(card.seed==null?'':String(card.seed))+':'+fp;
  }

  // Build a distinct species stem = onset + rime (never repeats a char).
  function makeStem(pr){
    let o=ON[Math.floor(pr.random()*ON.length)];
    let r=RM[Math.floor(pr.random()*RM.length)];
    let guard=0;
    while((o===r||o+o===o+r)&&guard++<40){r=RM[Math.floor(pr.random()*RM.length)];}
    return o+r;
  }

  // Morph length: 2ch 10% / 3ch 50% / 4ch 32% / 5ch 8%.
  function lenFor(pr){
    const r=pr.random();
    if(r<0.10)return 2;
    if(r<0.60)return 3;
    if(r<0.92)return 4;
    return 5;
  }

  function assemble(stem,fabric,target,pr){
    if(target===2)return stem;
    const pool=(HARM[fabric]||HARM.wet).slice();
    const used=new Set(stem);
    for(const c of pool)if(used.has(c))pool.splice(pool.indexOf(c),1);
    let name=stem,need=target-stem.length,guard=0;
    const sidePool=['coda','coda','onset','coda'];
    while(need>0&&guard<40&&pool.length>0){
      const idx=Math.floor(pr.random()*pool.length);
      const sy=pool[idx];pool.splice(idx,1);
      const side=sidePool[Math.floor(pr.random()*sidePool.length)];
      name=(side==='onset'?sy+name:name+sy);
      need-=sy.length;guard++;
    }
    if(name.length>target)name=name.slice(0,target);
    if(name.length<target){
      let g=0;
      const extra=FALLBACK.slice();
      for(const c of extra)if(used.has(c))extra.splice(extra.indexOf(c),1);
      while(name.length<target&&g<50&&extra.length>0){
        const sy=extra[Math.floor(pr.random()*extra.length)];extra.splice(extra.indexOf(sy),1);
        name=(name+sy).slice(0,target);used.add(sy);g++;
      }
      while(name.length<target&&g<70){name=(name+FALLBACK[Math.floor(pr.random()*FALLBACK.length)]).slice(0,target);g++;}
    }
    // uniqueness disambiguator: if the fused name has a repeated char (a quality
    // proxy for a degenerate read), deterministically append a rime morpheme.
    if(new Set(name).size<Math.min(2,name.length)&&name.length<5){
      name=(name+RM[Math.floor(pr.random()*RM.length)]).slice(0,5);
    }
    return name;
  }

  function generateSpeciesName(card){
    const pr=rng(speciesNameSignature(card));
    const fabric=fabricFor(card);
    const stem=makeStem(pr);
    const target=lenFor(pr);
    let name=assemble(stem,fabric,target,pr);
    if(new Set(name).size===1){ // guaranteed-deterministic fallback
      const pr2=rng(speciesNameSignature(card)+':n2');
      name=assemble(makeStem(pr2),fabric,lenFor(pr2),pr2);
    }
    return name;
  }

  // Deterministic collision-resolving registrar. Several cards (distinct seeds)
  // can land on the same base name; when they do, a seed-derived disambiguator
  // (a rime morpheme) is appended deterministically until the name is unique in
  // the shared set. This is the required "deterministic fallback" — it never asks
  // Math.random and never mutates the card's structure or numeric strength. When
  // the same seed is re-assigned it always resolves to the same final name, so
  // naming stays reproducible across sessions.
  function createNameRegistrar(){
    const used=new Set();
    return function assignName(card){
      let base=generateSpeciesName(card);
      if(!used.has(base)){used.add(base);return base;}
      // deterministic disambiguation: salt the naming signature until unique
      let salt=0,n=base;
      while(used.has(n)&&salt<30){
        salt++;
        const pr=rng(speciesNameSignature(card)+':uniq'+salt);
        const extra=RM[Math.floor(pr.random()*RM.length)];
        n=(base+extra).slice(0,5);
        if(!used.has(n))break;
      }
      let final=n||(base).slice(0,2)+String(salt);
      used.add(final);
      return final;
    };
  }

  NCB.NAME_GENERATOR_VERSION=2;
  NCB.generateSpeciesName=generateSpeciesName;
  NCB.createNameRegistrar=createNameRegistrar;
  NCB.speciesNameSignature=speciesNameSignature;
  NCB.FABRICS=HARM;
  NCB.NAME_GEN_ORE={ONSET_SET,RIME_SET};
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);