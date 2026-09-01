(function (root) {
  'use strict';
  const NCB = root.NCB = root.NCB || {};

  // Formula parsing is delegated to Acorn 8.15.0, a mature MIT-licensed
  // JavaScript parser vendored with the project. We deliberately execute only
  // a tiny expression AST whitelist with our own pure evaluator: no assignment,
  // member access, arrays/objects, constructors, dynamic code, IO or randomness.
  // A small normalizer keeps the authoring syntax familiar to math.js users
  // (`and`, `or`, `not`, `^`) while the canonical parser remains Acorn.
  let acorn = root.acorn;
  if (!acorn && typeof require === 'function') {
    try { acorn = require('../vendor/acorn-8.15.0.js'); } catch (_) { /* handled below */ }
  }
  if (!acorn || typeof acorn.parseExpressionAt !== 'function') {
    throw new Error('Vendored Acorn 8.15.0 formula parser is not loaded');
  }

  const ACORN_VERSION = String(acorn.version || '8.15.0');
  const DEFAULT_SYMBOLS = [
    'ATK','DEF','RES','SPD','ACC','EVA','CRIT','CRIT_DMG','PEN','RAGE','ENERGY','SOUL','CHRONO',
    'MAX_HP','HP','HP_PCT','MISSING_HP','TARGET_HP','TARGET_MAX_HP','TARGET_HP_PCT','TARGET_DEF','TARGET_RES',
    'STACKS','CONSUMED_STACKS','EVENT_DAMAGE','EVENT_HP_DAMAGE','EVENT_SHIELD_DAMAGE','EVENT_WARD_DAMAGE',
    'LAST_DAMAGE','LAST_HP_DAMAGE','LAST_SHIELD_DAMAGE','LAST_WARD_DAMAGE','LAST_HIT','LAST_CRIT','LAST_KILL',
    'REPEAT_INDEX','MODIFIER_VALUE','pi','e','PI','E'
  ];

  const PURE_FUNCTIONS = Object.freeze({
    min: (...xs) => Math.min(...xs.map(Number)),
    max: (...xs) => Math.max(...xs.map(Number)),
    abs: x => Math.abs(Number(x)),
    floor: x => Math.floor(Number(x)),
    ceil: x => Math.ceil(Number(x)),
    round: (x, digits=0) => {
      const p = 10 ** Math.max(0, Math.min(12, Math.floor(Number(digits)||0)));
      return Math.round(Number(x) * p) / p;
    },
    sqrt: x => Math.sqrt(Number(x)),
    log: x => Math.log(Number(x)),
    log2: x => Math.log2(Number(x)),
    log10: x => Math.log10(Number(x)),
    exp: x => Math.exp(Number(x)),
    pow: (x,y) => Math.pow(Number(x), Number(y)),
    sign: x => Math.sign(Number(x)),
    clamp: (value,min,max) => Math.max(Number(min), Math.min(Number(max), Number(value))),
  });

  const CONSTANTS = Object.freeze({pi:Math.PI,e:Math.E,PI:Math.PI,E:Math.E});
  const ALLOWED_UNARY = new Set(['+','-','!']);
  const ALLOWED_BINARY = new Set(['+','-','*','/','%','**','<','<=','>','>=','==','!=','===','!==']);
  const ALLOWED_LOGICAL = new Set(['&&','||']);
  const MAX_SOURCE_LENGTH = 500;
  const MAX_AST_NODES = 160;
  const MAX_AST_DEPTH = 28;
  const MAX_CALLS = 48;
  const parseCache = new Map();
  const pluginFunctions = Object.create(null);

  function normalizeExpression(source) {
    // Content strings are intentionally restricted to identifiers/numbers/operators,
    // so token-level replacements cannot alter quoted strings (strings are rejected).
    return source
      .replace(/\band\b/g, '&&')
      .replace(/\bor\b/g, '||')
      .replace(/\bnot\b/g, '!')
      .replace(/\^/g, '**');
  }

  function parseExpression(expression) {
    if (typeof expression !== 'string' || !expression.trim()) throw new Error('公式不能为空');
    if (expression.length > MAX_SOURCE_LENGTH) throw new Error(`公式过长（最大 ${MAX_SOURCE_LENGTH} 字符）`);
    const source = expression.trim();
    const cached = parseCache.get(source);
    if (cached) return cached;
    const normalized = normalizeExpression(source);
    let node;
    try {
      node = acorn.parseExpressionAt(normalized, 0, {ecmaVersion: 2020});
    } catch (error) {
      throw new Error(`公式语法错误：${error && error.message ? error.message : error}`);
    }
    if (normalized.slice(node.end).trim()) throw new Error(`公式尾部存在无法解析内容: ${normalized.slice(node.end).trim()}`);
    Object.defineProperty(node, '__ncbSource', {value:source, enumerable:false});
    parseCache.set(source, node);
    return node;
  }

  function analyzeAst(node, allowedSymbols, depth=1, info={nodes:0,calls:0}) {
    if (!node || typeof node.type !== 'string') throw new Error('无效 AST 节点');
    info.nodes++;
    if (info.nodes > MAX_AST_NODES) throw new Error(`公式节点过多（最大 ${MAX_AST_NODES}）`);
    if (depth > MAX_AST_DEPTH) throw new Error(`公式嵌套过深（最大 ${MAX_AST_DEPTH}）`);
    switch (node.type) {
      case 'Literal':
        if (typeof node.value !== 'number' && typeof node.value !== 'boolean') throw new Error('只允许数字和布尔常量');
        if (typeof node.value === 'number' && !Number.isFinite(node.value)) throw new Error('数字必须是有限值');
        return;
      case 'Identifier':
        if (Object.prototype.hasOwnProperty.call(CONSTANTS,node.name)) return;
        if (!allowedSymbols.has(node.name)) throw new Error(`未知变量: ${node.name}`);
        return;
      case 'UnaryExpression':
        if (!ALLOWED_UNARY.has(node.operator)) throw new Error(`不允许的一元运算符: ${node.operator}`);
        analyzeAst(node.argument,allowedSymbols,depth+1,info); return;
      case 'BinaryExpression':
        if (!ALLOWED_BINARY.has(node.operator)) throw new Error(`不允许的二元运算符: ${node.operator}`);
        analyzeAst(node.left,allowedSymbols,depth+1,info);
        analyzeAst(node.right,allowedSymbols,depth+1,info); return;
      case 'LogicalExpression':
        if (!ALLOWED_LOGICAL.has(node.operator)) throw new Error(`不允许的逻辑运算符: ${node.operator}`);
        analyzeAst(node.left,allowedSymbols,depth+1,info);
        analyzeAst(node.right,allowedSymbols,depth+1,info); return;
      case 'ConditionalExpression':
        analyzeAst(node.test,allowedSymbols,depth+1,info);
        analyzeAst(node.consequent,allowedSymbols,depth+1,info);
        analyzeAst(node.alternate,allowedSymbols,depth+1,info); return;
      case 'CallExpression': {
        info.calls++;
        if (info.calls > MAX_CALLS) throw new Error(`公式函数调用过多（最大 ${MAX_CALLS}）`);
        if (node.optional || !node.callee || node.callee.type !== 'Identifier') throw new Error('函数调用必须使用白名单函数名');
        const name=node.callee.name;
        if (!Object.prototype.hasOwnProperty.call(PURE_FUNCTIONS,name) && !Object.prototype.hasOwnProperty.call(pluginFunctions,name)) throw new Error(`不允许的函数: ${name}`);
        for (const arg of node.arguments) {
          if (!arg || arg.type === 'SpreadElement') throw new Error('不允许展开参数');
          analyzeAst(arg,allowedSymbols,depth+1,info);
        }
        return;
      }
      default:
        throw new Error(`不允许的 AST 节点: ${node.type}`);
    }
  }

  function evaluateAst(node,scope) {
    switch(node.type){
      case 'Literal': return node.value;
      case 'Identifier':
        if(Object.prototype.hasOwnProperty.call(CONSTANTS,node.name))return CONSTANTS[node.name];
        return scope[node.name];
      case 'UnaryExpression': {
        const v=evaluateAst(node.argument,scope);
        if(node.operator==='+')return +v;
        if(node.operator==='-')return -v;
        if(node.operator==='!')return !v;
        break;
      }
      case 'LogicalExpression':
        if(node.operator==='&&'){const left=evaluateAst(node.left,scope);return left?evaluateAst(node.right,scope):left;}
        if(node.operator==='||'){const left=evaluateAst(node.left,scope);return left?left:evaluateAst(node.right,scope);}
        break;
      case 'BinaryExpression': {
        const a=evaluateAst(node.left,scope), b=evaluateAst(node.right,scope);
        switch(node.operator){
          case '+': return Number(a)+Number(b); case '-': return Number(a)-Number(b);
          case '*': return Number(a)*Number(b); case '/': return Number(a)/Number(b);
          case '%': return Number(a)%Number(b); case '**': return Math.pow(Number(a),Number(b));
          case '<': return a<b; case '<=': return a<=b; case '>': return a>b; case '>=': return a>=b;
          case '==': return a==b; // intentional DSL equality
          case '!=': return a!=b; // intentional DSL inequality
          case '===': return a===b; case '!==': return a!==b;
        }
        break;
      }
      case 'ConditionalExpression': return evaluateAst(node.test,scope)?evaluateAst(node.consequent,scope):evaluateAst(node.alternate,scope);
      case 'CallExpression': {
        const name=node.callee.name;
        const fn=pluginFunctions[name]||PURE_FUNCTIONS[name];
        return fn(...node.arguments.map(arg=>evaluateAst(arg,scope)));
      }
    }
    throw new Error(`无法执行 AST 节点 ${node.type}`);
  }

  function validateExpression(expression,allowedSymbols=DEFAULT_SYMBOLS){
    try{const node=parseExpression(expression);analyzeAst(node,new Set(allowedSymbols));return{ok:true,node};}
    catch(error){return{ok:false,error:error instanceof Error?error.message:String(error)};}
  }

  function evaluateExpression(expression,scope={}){
    const safeScope=Object.create(null);
    for(const [key,value] of Object.entries(scope)){
      if(typeof value==='number'||typeof value==='boolean')safeScope[key]=value;
    }
    const result=validateExpression(expression,Object.keys(safeScope));
    if(!result.ok)throw new Error(result.error);
    const value=evaluateAst(result.node,safeScope);
    const numeric=Number(value);
    if(!Number.isFinite(numeric))throw new Error('公式结果不是有限数字');
    return numeric;
  }

  function registerFormulaFunction(name,fn,meta={}){
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))throw new Error(`非法公式函数名: ${name}`);
    if(Object.prototype.hasOwnProperty.call(PURE_FUNCTIONS,name)||Object.prototype.hasOwnProperty.call(CONSTANTS,name))throw new Error(`公式函数名冲突: ${name}`);
    if(typeof fn!=='function')throw new TypeError('formula function must be a function');
    pluginFunctions[name]=fn;
    return{name,...meta};
  }

  NCB.FORMULA_SYMBOLS=DEFAULT_SYMBOLS.slice();
  NCB.FORMULA_FUNCTIONS=[...Object.keys(PURE_FUNCTIONS)];
  NCB.parseExpression=parseExpression;
  NCB.validateExpression=validateExpression;
  NCB.evaluateExpression=evaluateExpression;
  NCB.evaluateAst=evaluateAst;
  NCB.registerFormulaFunction=registerFormulaFunction;
  NCB.formulaEngineAvailable=()=>true;
  NCB.formulaEngineInfo=()=>({
    id:'acorn-restricted-expression',name:'Acorn',version:ACORN_VERSION,offline:true,restricted:true,
    syntax:'math-style normalized expression subset',maxLength:MAX_SOURCE_LENGTH,maxNodes:MAX_AST_NODES,maxDepth:MAX_AST_DEPTH
  });
  if(typeof module!=='undefined')module.exports=NCB;
})(typeof globalThis!=='undefined'?globalThis:window);
