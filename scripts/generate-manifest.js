// RELEASE-MANIFEST generator.
//
// Duty: RELEASE-MANIFEST.json is the COMPLETE auditable file set of the current
// official main release. The file list is derived from `git ls-files`, so a file
// added to the repo without regenerating the manifest fails the static gate
// (no more "looks complete but misses two files" ambiguity).
//
//   scope: "full-main-release"  -> every git-tracked file ships in the release,
//                                  including deployment files (.nojekyll,
//                                  .github/workflows/verify.yml, docs/superpowers
//                                  plans, qa artifacts).
//
// The single exception: RELEASE-MANIFEST.json cannot list itself (its hash would
// depend on its own content); it is audited by scripts/static-check.js instead.
//
// verifiedTests is NOT faked: it comes from running the real suite and parsing
// the test runner's summary.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, execSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const OUT = path.join(root, 'RELEASE-MANIFEST.json');
const SELF = 'RELEASE-MANIFEST.json';

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;

// 1. Complete tracked file set (authoritative).
let tracked;
try {
  tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean).sort();
} catch (e) {
  throw new Error(`manifest generator requires a git working tree: ${e.message}`);
}
if (!tracked.length) throw new Error('git ls-files returned no files');

// 2. size + sha256 for every file.
//
// Hash the CANONICAL git blob content (`git show :<path>`), not the raw working-tree
// file. The repo is authored with LF blobs but local clients commonly set
// `core.autocrlf=true`, so the working-tree bytes can be CRLF while CI (Linux)
// checks out LF. Hashing the staged blob makes the manifest platform-independent
// and always match what a fresh `git ls-files` checkout in CI provides.
const files = tracked
  .filter((p) => p !== SELF)
  .map((p) => {
    let buf;
    try {
      buf = execFileSync('git', ['show', `:${p}`], { cwd: root });
    } catch (e) {
      // Not staged/committed (added after last commit yet uncommitted): fall back to disk.
      const abs = path.join(root, p);
      if (!fs.existsSync(abs)) throw new Error(`tracked file missing on disk / index: ${p}`);
      buf = fs.readFileSync(abs);
    }
    return {
      path: p,
      size: buf.length,
      sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    };
  });

// 3. Real test count from the actual suite run.
const suiteOut = execFileSync(
  process.execPath,
  ['--test', '--test-reporter=tap', 'tests/*.test.js'],
  { cwd: root, encoding: 'utf8' },
);
const testsMatch = suiteOut.match(/^# tests (\d+)$/m);
if (!testsMatch) throw new Error('could not parse test count from suite output');
const verifiedTests = parseInt(testsMatch[1], 10);
const failMatch = suiteOut.match(/^# fail (\d+)$/m);
const failed = failMatch ? parseInt(failMatch[1], 10) : -1;
if (failed !== 0) throw new Error(`cannot publish manifest: suite has ${failed} failing tests`);

// 4. Assemble manifest.
const manifest = {
  name: pkg.name || 'NUMERICAL // 数值对战实验室',
  version,
  entry: 'index.html',
  runtime: 'fully-offline-static-web',
  formulaParser: 'Acorn 8.15.0 + restricted AST evaluator',
  scope: 'full-main-release',
  scopeNote:
    'Complete auditable file set of the current official main release, generated from `git ls-files` ' +
    '(runtime + docs + qa artifacts + deployment files: .nojekyll, .github/workflows/verify.yml, ' +
    'docs/superpowers plans). RELEASE-MANIFEST.json itself is excluded from its own listing (self-reference); ' +
    'scripts/static-check.js audits it against the working tree instead.',
  verifiedTests,
  files,
  combinedDefaultCompositionWinRate: 0.595,
  notes:
    `v${version}: generated card identity hardening (rarity/level/archetype in cardId), strict level ` +
    '1..100 validation, self-target 0.85 integrated into skill cost, pierce penetrationBonus + ' +
    'penetration cost factor, fake-green assertion removed, version gate package.json === manifest.',
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  `manifest regenerated: version ${version}, ${files.length} tracked files, ${verifiedTests} tests (${failed} fail)`,
);
