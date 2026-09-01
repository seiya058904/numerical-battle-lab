const test=require('node:test');
const assert=require('node:assert/strict');
function load(){global.NCB={};delete require.cache[require.resolve('../src/formula.js')];require('../src/formula.js');return global.NCB;}

test('vendored mature parser evaluates arithmetic and math-style functions',()=>{const N=load();assert.equal(N.evaluateExpression('ATK * 2 + sqrt(DEF)',{ATK:10,DEF:9}),23);});
test('conditional expressions work',()=>{const N=load();assert.equal(N.evaluateExpression('TARGET_HP_PCT < 0.35 ? ATK * 2 : ATK',{TARGET_HP_PCT:.2,ATK:12}),24);});
test('power/log/clamp/min/max work',()=>{const N=load();const v=N.evaluateExpression('clamp(pow(ATK, 2) / 10 + log2(8), min(2, 3), max(12, 8))',{ATK:10});assert.equal(v,12);});
test('boolean operators work',()=>{const N=load();assert.equal(N.evaluateExpression('(ATK > 5 and HP_PCT < 0.5) ? 7 : 2',{ATK:10,HP_PCT:.4}),7);});
test('unknown symbols and functions are rejected',()=>{const N=load();assert.equal(N.validateExpression('SECRET + 1',['ATK']).ok,false);assert.equal(N.validateExpression('mystery(ATK)',['ATK']).ok,false);});
test('unsafe JavaScript AST forms are rejected',()=>{const N=load();for(const expr of ['ATK = 3','foo.bar','[1,2,3]','({x:1})','new Date()','ATK++','(x)=>x'])assert.equal(N.validateExpression(expr,['ATK']).ok,false,expr);});
test('non finite results are rejected',()=>{const N=load();assert.throws(()=>N.evaluateExpression('1 / 0',{}),/有限数字/);});
test('plugin pure functions can be registered',()=>{const N=load();N.registerFormulaFunction('softcap',(x,k)=>x/(1+x/k));assert.ok(Math.abs(N.evaluateExpression('softcap(ATK,100)',{ATK:100})-50)<1e-9);});
test('formula layer does not expose random/eval/function constructors',()=>{const N=load();for(const expr of ['random()','eval(ATK)','Function(ATK)','constructor(ATK)'])assert.equal(N.validateExpression(expr,['ATK']).ok,false,expr);});

test('formula parser identity is pinned and offline',()=>{const N=load();const info=N.formulaEngineInfo();assert.equal(info.name,'Acorn');assert.equal(info.version,'8.15.0');assert.equal(info.offline,true);assert.equal(info.restricted,true);});
