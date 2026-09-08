// Name Generator v3 — final canonical implementation.
//
// DESIGN (final, per product spec):
//   * Names are PRESENTATION IDENTITY only: they never read rarity, level,
//     BattlePower, stats, damage type, action family, status, resource, role,
//     win rate, or mechanic fingerprint. Identity input is exactly
//       card.originSeed ?? card.seed ?? card.id
//     so the same seed yields the same species name at ANY level / rarity / stats.
//   * Six phonetic families (ROUND / AGILE / HEAVY / SLEEK / WILD / ANCIENT) are
//     naming internals only — picked deterministically from the seed PRNG, never
//     bound to mechanics, never shown in the UI, never stored on the card.
//   * Morphology: 2 chars 10% / 3 chars 70% / 4 chars 20% / 5 chars 0%.
//     Names are assembled positionally A+B / A+B+C / A+B+C+D from the active
//     family's canonical pools. Adjacent and all characters must be distinct.
//   * Validation: length 2-4, only canonical pool characters, no repeated char,
//     no banned generic monster suffix, no banned substring, no known-name
//     collision. Invalid candidates re-roll the WHOLE name (never patch by
//     appending), signature + "|retry:<attempt>", up to 64 attempts.
//   * generateSpeciesNameV3 is a pure deterministic base name (same seed -> same
//     name regardless of call order). createNameRegistrarV3 resolves batch
//     collisions by regenerating the whole phonetic name with
//     "|collision:<n>" until it is unused and grammar-valid.
//   * v1 (gen-names.js) and v2 (name-generator-v2.js) remain for legacy replay.
(function(root){
  'use strict';
  const NCB=root.NCB=root.NCB||{};

  // ---- Canonical phonetic families (final spec §5). DO NOT EDIT. ----
  const FAMILIES={
    ROUND:{
      A:[...'咕啵嘟咪布波米诺阿莫贝比帕普露莉'],
      B:[...'米拉洛鲁比莫诺奇里布贝露莉娜亚尼'],
      C:[...'姆米洛诺奇拉巴可安里亚尼布贝露莉'],
      D:[...'安亚恩尔米诺洛姆里拉尼可露莉巴'],
    },
    AGILE:{
      A:[...'奇皮比卡迪提希维凯齐泰特科赛帕佩'],
      B:[...'洛鲁拉米诺奇迪维卡里泰特科赛提佩'],
      C:[...'奇克特亚安诺洛米达里泰迪维科赛佩'],
      D:[...'安亚恩尔奇克诺特迪维泰科赛洛米'],
    },
    HEAVY:{
      A:[...'塔格古达克巴摩博德戈科托坦鲁罗多'],
      B:[...'鲁洛罗坦多格巴克德古塔托博科戈达'],
      C:[...'克姆德尔恩洛坦格安鲁博托古达戈科'],
      D:[...'安恩德尔克姆洛坦鲁格古达托博科'],
    },
    SLEEK:{
      A:[...'洛诺维希赛伊艾泽菲莱瑞亚欧优莉露'],
      B:[...'米拉维诺洛菲赛兰瑞希亚伊欧莱莉露'],
      C:[...'亚安恩尔雅诺维洛米兰瑞伊菲莱莉露'],
      D:[...'亚安恩尔诺维洛雅瑞伊菲莱米莉露'],
    },
    WILD:{
      A:[...'巴布卡咕鲁莫拉托波多普帕科哈扎图'],
      B:[...'奇洛鲁米塔诺巴迪卡莫多普帕科哈扎'],
      C:[...'克奇姆拉诺安鲁塔米洛巴迪多普帕科'],
      D:[...'安亚恩尔克诺拉姆鲁塔米洛巴迪多'],
    },
    ANCIENT:{
      A:[...'奥阿欧伊赛塔洛维安艾兰罗瑞泽优莱'],
      B:[...'兰洛诺维鲁赛米塔罗安瑞泽欧伊莱优'],
      C:[...'恩亚尔安德诺兰维洛姆瑞泽欧伊莱优'],
      D:[...'安亚恩尔德诺兰维瑞泽欧伊莱优洛'],
    },
  };
  const FAMILY_ORDER=['ROUND','AGILE','HEAVY','SLEEK','WILD','ANCIENT'];
  // Canonical character universe (for validation + QA common-character rate).
  const CANONICAL_CHARS=(()=>{const s=new Set();for(const fam of Object.values(FAMILIES))for(const pos of Object.values(fam))for(const ch of pos)s.add(ch);return s;})();

  // ---- Banned generic monster suffixes (final spec §8) ----
  const BANNED_SUFFIX=['兽','龙','灵','王','鬼','魔','妖','神','仙','狼','虎','鹰','蛇','虫','鱼','犬','猫'];
  // ---- Known-name collision blacklist (final spec §9) ----
  const KNOWN_NAMES=['皮卡丘','杰尼龟','卡比兽','妙蛙','喷火龙','路卡利欧','超梦','安娜','玛丽','米兰','巴黎','罗马','安迪','艾伦','凯文','亚当','露西','莉莉','贝拉'];

  function rng(seed){return new NCB.Gen5PRNG(NCB.deriveSeed(NCB.seedHash(String(seed))));}
  const pick=(arr,pr)=>arr[Math.floor(pr.random()*arr.length)];

  // Identity input: seed ONLY (final spec §6).
  function speciesNameSignatureV3(card){
    return 'naming-v3:'+String(card.originSeed??card.seed??card.id??'');
  }

  // Deterministic family pick: signature -> PRNG -> 0..5.
  function familyForV3(card){
    const pr=rng(speciesNameSignatureV3(card)+':fam');
    return FAMILY_ORDER[Math.floor(pr.random()*FAMILY_ORDER.length)];
  }

  // Deterministic length: 2=10% / 3=70% / 4=20%.
  function lengthForV3(pr){
    const r=pr.random();
    if(r<0.10)return 2;
    if(r<0.80)return 3;
    return 4;
  }

  // Validation (final spec §7).
  function isValidSpeciesNameV3(name){
    if(typeof name!=='string')return false;
    if(name.length<2||name.length>4)return false;
    for(const ch of name)if(!CANONICAL_CHARS.has(ch))return false;
    if(new Set(name).size!==name.length)return false;      // all chars distinct
    if(BANNED_SUFFIX.includes(name[name.length-1]))return false;
    for(const known of KNOWN_NAMES)if(name.includes(known))return false;
    return true;
  }

  // Assemble one candidate of the target length from a family (no char repeats).
  function assembleV3(family,target,pr){
    const F=FAMILIES[family];
    const used=new Set();
    const take=(pool)=>{let ch=pick(pool,pr);let g=0;while(used.has(ch)&&g++<64)ch=pick(pool,pr);if(used.has(ch))return null;used.add(ch);return ch;};
    const a=take(F.A);if(a==null)return null;
    const b=take(F.B);if(b==null)return null;
    if(target===2)return a+b;
    const c=take(F.C);if(c==null)return null;
    if(target===3)return a+b+c;
    const d=take(F.D);if(d==null)return null;
    return a+b+c+d;
  }

  // Pure deterministic base name. Same seed -> same name, independent of call
  // order, level, rarity, stats, fingerprint (final spec §10).
  function generateSpeciesNameV3(card){
    const sig=speciesNameSignatureV3(card);
    const family=familyForV3(card);
    let attempt=0;
    for(;attempt<64;attempt++){
      const pr=rng(sig+(attempt?'|retry:'+attempt:''));
      const target=lengthForV3(pr);
      const name=assembleV3(family,target,pr);
      if(name&&isValidSpeciesNameV3(name))return name;
    }
    // Extremely defensive fallback (should never fire): a fixed valid 2-char name.
    return '米洛';
  }

  // Deterministic collision-resolving registrar for batches (presets / library /
  // audits): on collision, regenerate the WHOLE phonetic name with a collision
  // salt until it is unused AND grammar-valid (final spec §10).
  function createNameRegistrarV3(){
    const used=new Set();
    return function assignName(card){
      let name=generateSpeciesNameV3(card);
      if(!used.has(name)){used.add(name);return name;}
      const sig=speciesNameSignatureV3(card);
      for(let n=1;n<128;n++){
        const pr=rng(sig+'|collision:'+n);
        const candidate=assembleV3(familyForV3(card),lengthForV3(pr),pr);
        if(candidate&&isValidSpeciesNameV3(candidate)&&!used.has(candidate)){used.add(candidate);return candidate;}
      }
      return name; // degenerate last resort (all salts exhausted)
    };
  }

  // v1/v2 retained for legacy reproduction.
  NCB.generateSpeciesNameV2=typeof NCB.generateSpeciesName==='function'?NCB.generateSpeciesName:null;
  NCB.NAME_GENERATOR_VERSION=3;
  NCB.generateSpeciesNameV3=generateSpeciesNameV3;
  NCB.generateSpeciesName=generateSpeciesNameV3;   // product default
  NCB.speciesNameSignatureV3=speciesNameSignatureV3;
  NCB.isValidSpeciesNameV3=isValidSpeciesNameV3;
  NCB.createNameRegistrarV3=createNameRegistrarV3;
  NCB.createNameRegistrar=createNameRegistrarV3;   // batch default
  NCB.NAME_V3_FAMILIES=FAMILIES;
  NCB.NAME_V3_FAMILY_ORDER=FAMILY_ORDER.slice();
  NCB.NAME_V3_CANONICAL_CHARS=CANONICAL_CHARS;
  NCB.NAME_V3_BANNED_SUFFIX=BANNED_SUFFIX.slice();
  NCB.NAME_V3_KNOWN_NAMES=KNOWN_NAMES.slice();
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);