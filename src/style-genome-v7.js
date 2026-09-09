// Generator v7 seed-only soft style preferences. Values are not budget shares.
(function(root){
  'use strict';
  const N=root.NCB=root.NCB||{};
  const AXES=['pressure','endurance','sustain','control','tempo','economy','reliability','triggers'];
  function styleGenomeV7(seed){
    const hash=N.seedHash(String(seed??'')+'|v7-style');
    const random=new N.Gen5PRNG(N.deriveSeed(hash));
    const genome={};
    for(const axis of AXES)genome[axis]=Math.round((0.12+0.88*Math.pow(random.random(),0.72))*1000000)/1000000;
    return genome;
  }
  N.STYLE_AXES_V7=AXES.slice();
  N.styleGenomeV7=styleGenomeV7;
  if(typeof module!=='undefined')module.exports=N;
})(typeof globalThis!=='undefined'?globalThis:window);
