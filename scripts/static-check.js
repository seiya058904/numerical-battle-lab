const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const required=['index.html','styles.css','src/kernel.js','src/components.js','src/rules.js','src/content.js','src/status-runtime.js','src/formula.js','src/validator.js','src/effects.js','src/engine.js','src/app.js','README.md','THIRD_PARTY_NOTICES.md','docs/NUMERIC-COMPONENT-CATALOG.md','docs/numeric-component-catalog.json','docs/PLUGIN-API.md','docs/ARCHITECTURE.md','docs/CONTENT-AUTHORING.md','vendor/acorn-8.15.0.js','third_party/acorn/LICENSE','third_party/acorn/UPSTREAM.md'];
for(const file of required)if(!fs.existsSync(path.join(root,file)))throw new Error(`missing ${file}`);

const sourceFiles=fs.readdirSync(path.join(root,'src')).filter(x=>x.endsWith('.js')).map(x=>path.join(root,'src',x));
const sourceText=sourceFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n');
if(/Math\.random\s*\(/.test(sourceText))throw new Error('runtime contains Math.random()');
if(/\beval\s*\(/.test(sourceText)||/new\s+Function\s*\(/.test(sourceText))throw new Error('runtime contains eval/new Function');
if(/fallbackFormula/.test(sourceText))throw new Error('legacy hardcoded formula fallback still exists');

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
if(/<script[^>]+src=["']https?:\/\//i.test(html))throw new Error('external runtime script dependency found');
if(!html.includes('vendor/acorn-8.15.0.js'))throw new Error('vendored Acorn parser missing from index');
if(html.indexOf('<script src="vendor/acorn-8.15.0.js"')>html.indexOf('<script src="src/formula.js"'))throw new Error('Acorn parser must load before formula adapter');
for(const runtime of ['src/kernel.js','src/components.js','src/rules.js','src/content.js','src/status-runtime.js','src/formula.js','src/validator.js','src/effects.js','src/engine.js','src/app.js'])if(!html.includes(runtime))throw new Error(`runtime script missing from index: ${runtime}`);

// Architecture guard: canonical engine/effect runtime must not know concrete content IDs.
global.NCB={};
for(const f of ['kernel.js','components.js','rules.js','content.js','status-runtime.js','formula.js','validator.js','effects.js','engine.js'])require(path.join(root,'src',f));
const NCB=global.NCB;
const engineText=[fs.readFileSync(path.join(root,'src/engine.js'),'utf8'),fs.readFileSync(path.join(root,'src/effects.js'),'utf8')].join('\n');
for(const id of Object.keys(NCB.UNIT_DEFS||{}))if(engineText.includes(`'${id}'`)||engineText.includes(`"${id}"`))throw new Error(`runtime contains concrete unit id: ${id}`);
for(const id of Object.keys(NCB.STATUS_DEFS||{}))if(engineText.includes(`'${id}'`)||engineText.includes(`"${id}"`))throw new Error(`runtime contains concrete status id: ${id}`);

const validation=NCB.validateContentPack({units:NCB.UNIT_DEFS,skills:NCB.SKILL_DEFS,statuses:NCB.STATUS_DEFS});
if(!validation.ok)throw new Error(`built-in content invalid:\n${validation.errors.join('\n')}`);
for(const [id,spec] of Object.entries(NCB.EFFECT_COMPONENTS||{}))if(typeof spec.resolve!=='function')throw new Error(`effect component is not executable: ${id}`);
if(Object.keys(NCB.PARAMETER_CATALOG||{}).length<90)throw new Error('numeric parameter catalog unexpectedly small');
const formulaInfo=NCB.formulaEngineInfo?.()||{};
if(!formulaInfo.offline)throw new Error('formula engine is not offline');
if(formulaInfo.name!=='Acorn'||formulaInfo.version!=='8.15.0')throw new Error(`unexpected formula parser: ${formulaInfo.name||'unknown'} ${formulaInfo.version||''}`);
const acornHash=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'vendor/acorn-8.15.0.js'))).digest('hex');
if(acornHash!=='fdb08546776ec6228b03e8d02b40d4ab3255bae5f401adba7ff5dad927ac5c9c')throw new Error('vendored Acorn hash mismatch');

const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
for(const marker of ['data-tab="battle"','data-tab="editor"','data-tab="simulation"','qaSelfTest'])if(!app.includes(marker)&&!html.includes(marker))throw new Error(`UI marker missing: ${marker}`);
console.log(`static checks: PASS · ${Object.keys(NCB.PARAMETER_CATALOG).length} parameters · ${Object.keys(NCB.EFFECT_COMPONENTS).length} effects`);
