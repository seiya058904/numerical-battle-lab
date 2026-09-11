'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function isWithin(root, file, paths = path) {
  const relative = paths.relative(paths.resolve(root), paths.resolve(file));
  return !paths.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + paths.sep);
}
function createServer({ root = path.resolve(__dirname, '..') } = {}) {
  root = path.resolve(root);
  return http.createServer(async (req, res) => {
    const reply = (status, body) => { res.writeHead(status); res.end(body); };
    let urlPath;
    try {
      urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath.includes('\0')) return reply(400, 'bad request');
    } catch { return reply(400, 'bad request'); }
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const file = path.resolve(root, '.' + (urlPath.startsWith('/') ? urlPath : '/' + urlPath));
    if (!isWithin(root, file)) return reply(403, 'forbidden');
    try {
      const [realRoot, realFile] = await Promise.all([fs.realpath(root), fs.realpath(file)]);
      if (!isWithin(realRoot, realFile)) return reply(403, 'forbidden');
      const data = await fs.readFile(realFile);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(realFile)] || 'application/octet-stream' });
      res.end(data);
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) return reply(404, 'not found');
      if (['EACCES', 'EPERM'].includes(error.code)) return reply(403, 'forbidden');
      reply(500, 'server error');
    }
  });
}
if (require.main === module) {
  const port = process.env.PORT || 8774;
  createServer().listen(port, '127.0.0.1', () => console.log(`数值卡牌服务器已启动: http://127.0.0.1:${port}`));
}
module.exports = { createServer, isWithin };
