'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createServer, isWithin } = require('../scripts/serve.js');
test('path boundaries use POSIX and Windows semantics', () => {
  for (const [p, root] of [[path.posix, '/tmp/site'], [path.win32, 'C:\\tmp\\site']]) {
    assert.equal(isWithin(root, p.join(root, 'index.html'), p), true);
    assert.equal(isWithin(root, root + '-outside' + p.sep + 'sentinel', p), false);
    assert.equal(isWithin(root, p.join(root, '..', 'sentinel'), p), false);
  }
  assert.equal(isWithin('C:\\site', 'D:\\site\\index.html', path.win32), false);
});
test('HTTP rejects traversal, malformed encoding and NUL without exiting', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'nbl-server-'));
  const root = path.join(temp, 'site'), outside = path.join(temp, 'site-outside');
  await fs.mkdir(root); await fs.mkdir(outside);
  await fs.writeFile(path.join(root, 'index.html'), 'HOME');
  await fs.writeFile(path.join(outside, 'sentinel'), 'OWN TEST SENTINEL');
  const link = path.join(root, 'link');
  await fs.symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  const server = createServer({ root });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const request = requestPath => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path: requestPath }, res => {
      let body = ''; res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
  try {
    assert.deepEqual(await request('/'), { status: 200, body: 'HOME' });
    for (const bad of ['/%ZZ', '/%00']) assert.equal((await request(bad)).status, 400);
    assert.equal((await request('/missing')).status, 404);
    for (const bad of ['/%2e%2e/site-outside/sentinel', '/link/sentinel']) assert.equal((await request(bad)).status, 403);
    if (process.platform === 'win32') assert.equal((await request('/%2e%2e%5csite-outside%5csentinel')).status, 403);
    assert.deepEqual(await request('/'), { status: 200, body: 'HOME' });
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (process.platform === 'win32') await fs.rmdir(link); else await fs.unlink(link);
    await fs.unlink(path.join(root, 'index.html')); await fs.unlink(path.join(outside, 'sentinel'));
    await fs.rmdir(root); await fs.rmdir(outside); await fs.rmdir(temp);
  }
});
