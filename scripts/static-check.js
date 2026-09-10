/* =========================================================
   scripts/static-check.js — 新产品静态架构门禁
   1. 运行时文件集合与期望清单完全一致（无死代码/旧系统残留）
   2. index.html 只加载 4 个 src 模块
   3. 战斗引擎不含 Math.random（确定性）
   4. 卡库 24 张 / 12 档
   ========================================================= */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
let failed = false;
function check(name, ok, detail) {
  if (!ok) {
    failed = true;
    console.error(`✗ ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    console.log(`✓ ${name}`);
  }
}

// ---- 1. 运行时文件集合 ----
const EXPECTED_FILES = [
  '.github/workflows/verify.yml',
  '.gitignore',
  '.nojekyll',
  'AGENTS.md',
  'README.md',
  'index.html',
  'package.json',
  'styles.css',
  'src/cards.js',
  'src/power.js',
  'src/battle.js',
  'src/app.js',
  'tests/cards.test.js',
  'tests/power.test.js',
  'tests/battle.test.js',
  'tests/product-acceptance.test.js',
  'scripts/static-check.js',
  'scripts/acceptance.js',
  'scripts/battlepower-audit.js',
  'scripts/serve.js'
].sort();

let tracked;
try {
  tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map(s => s.trim()).filter(Boolean).sort();
} catch (e) {
  tracked = null;
}
if (tracked) {
  const unexpected = tracked.filter(f => !EXPECTED_FILES.includes(f));
  const missing = EXPECTED_FILES.filter(f => !tracked.includes(f));
  check('运行时文件集合 = 期望清单（无旧系统残留/无死文件）',
    unexpected.length === 0 && missing.length === 0,
    `多余: ${unexpected.join(', ') || '无'}；缺失: ${missing.join(', ') || '无'}`);
} else {
  check('git 可用', false, '无法执行 git ls-files');
}

// ---- 2. index.html 只加载 4 个 src 模块 ----
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
check('index.html 只加载 4 个 src 模块', JSON.stringify(scripts) === JSON.stringify([
  'src/cards.js', 'src/power.js', 'src/battle.js', 'src/app.js'
]), `实际: ${scripts.join(', ')}`);

// ---- 3. 战斗引擎确定性 ----
const battleSrc = fs.readFileSync(path.join(ROOT, 'src/battle.js'), 'utf8');
check('src/battle.js 不含 Math.random（确定性 PRNG）', !/Math\.random/.test(battleSrc));

// ---- 4. 卡库结构 ----
const { CARDS, RARITY_LIST } = require(path.join(ROOT, 'src/cards.js'));
check('卡库 = 24 张', CARDS.length === 24, `实际 ${CARDS.length}`);
check('稀有度 = 12 档', RARITY_LIST.length === 12, `实际 ${RARITY_LIST.length}`);

// ---- 5. 不允许残留的旧系统路径 ----
const BANNED = [
  'vendor', 'third_party', 'content', 'calibration', 'docs', 'qa',
  'src/engine.js', 'src/formula.js', 'src/ai.js', 'src/kernel.js',
  'src/effects.js', 'src/status-runtime.js', 'src/solver-v7.js',
  'src/strength-model-v7.js', 'src/battlepower.js', 'src/battlepower-v2.js',
  'src/battlepower-v3.js', 'src/battlepower-v4.js', 'src/power-v5.js',
  'src/presets.js', 'src/card-browser.js', 'src/card-ui.js',
  'src/behavior.js', 'src/numerical-knowledge.js', 'src/validator.js',
  'src/generator.js', 'src/gen-v1.js', 'src/gen-v2.js', 'src/gen-v3.js',
  'src/gen-v4.js', 'src/gen-v5.js', 'src/gen-v6.js', 'src/gen-v7.js',
  'RELEASE-MANIFEST.json', 'QA-REPORT.md', 'FINAL-REPORT.md',
  'THIRD_PARTY_NOTICES.md', 'RELEASE-NOTES.md', 'dev-bp-check.js', 'dev-eff-check.js'
];
const bannedFound = BANNED.filter(p => fs.existsSync(path.join(ROOT, p)));
check('旧系统路径全部删除', bannedFound.length === 0, `残留: ${bannedFound.join(', ') || '无'}`);

// ---- 6. 根目录无旧 QA 日志 ----
const rootLogs = fs.readdirSync(ROOT).filter(f => f.endsWith('.log'));
check('根目录无 .log QA 产物', rootLogs.length === 0, `残留: ${rootLogs.join(', ')}`);

if (failed) {
  console.error('\n静态检查失败');
  process.exit(1);
}
console.log('\n静态检查通过');
