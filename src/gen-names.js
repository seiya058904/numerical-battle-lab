(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};
  // Deterministic, data-driven, registry-based Chinese display-name generator.
  // A name = a seeded pick of {tone prefix + core name} (or a core name + suffix),
  // with archetype/damage-type/status/combat-style biasing the pool weights.
  // Names are purely presentational: they never feed card.id or generation identity.

  // CATEGORY style = "气质前缀" pool (felt like mood/aura prefixes).
  const PREFIX_POOL=[
    '霜','烬','苍','夜','星','玄','岚','影','焰','冰','雷','岩','风','霆','幽','皓','寂','绯','墨','青','赤','银','金','雾','岚','渊','曜','蚀','凝','啸',
  ];
  const CORE_POOL=[
    '痕','锋','脊','隼','铸','盾','宵','澜','羽','牙','棘','翼','魂','陨','锤','刃','吟','曦','煌','舞','啸','霆','芯','枢','吟','戒','冠','幡','瞳','魄',
  ];
  const SUFFIX_POOL=[
    '之刃','之盾','之歌','之影','之息','之王','之眼','之冠','之魂','之心','之翼','之痕','之约','之誓','之面','之环',
  ];

  // Archetype -> blend bias. Higher numbers make tags pick prefixes/names more often.
  const STYLE_BIAS={
    Balanced:{prefix:0.5,suffix:0.2},
    Tank:{prefix:0.3,suffix:0.4},
    Bruiser:{prefix:0.6,suffix:0.1},
    Assassin:{prefix:0.7,suffix:0.05},
    Mage:{prefix:0.55,suffix:0.2},
    Support:{prefix:0.35,suffix:0.3},
    Controller:{prefix:0.45,suffix:0.25},
  };

  function deterministicSeed(seed){
    let h=2166136261>>>0;const s=String(seed==null?'':seed);
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    return 'gen5,'+((h>>>0)&0xffff)+','+((h>>>16)&0xffff)+',1,2';
  }
  const pick=(arr,prng)=>arr[prng.random(arr.length)];

  // generateDisplayName({seed,archetype,rarity,level,tags}) -> Chinese name.
  // Deterministic for the same inputs. Names never mutate card identity.
  function generateDisplayName(opts={}){
    const seed=opts.seed==null?'':String(opts.seed);
    const archetype=opts.archetype||'Balanced';
    const prng=new NCB.Gen5PRNG(deterministicSeed('name:'+seed));
    const bias=STYLE_BIAS[archetype]||STYLE_BIAS.Balanced;
    const roll=prng.random(100)/100;
    // 60% prefix+core, 25% core+suffix, 15% bare core (short punchy names)
    let name;
    if(roll<bias.suffix*0.7+0.15){
      name=pick(CORE_POOL,prng)+pick(SUFFIX_POOL,prng);
    }else if(roll<(1-bias.prefix)*0.5+0.2){
      name=pick(CORE_POOL,prng);
    }else{
      name=pick(PREFIX_POOL,prng)+pick(CORE_POOL,prng);
    }
    return name;
  }

  // A richer name for display: append a role tag e.g. "霜痕 · 刺客" if desired.
  function displayCardName(card){
    const base=card.displayName||card.name||generateDisplayName({seed:card.seed,archetype:card.archetype});
    return base;
  }

  NCB.NAME_PREFIX_POOL=PREFIX_POOL.slice();
  NCB.NAME_CORE_POOL=CORE_POOL.slice();
  NCB.NAME_SUFFIX_POOL=SUFFIX_POOL.slice();
  NCB.STYLE_BIAS=STYLE_BIAS;
  NCB.generateDisplayName=generateDisplayName;
  NCB.displayCardName=displayCardName;
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);