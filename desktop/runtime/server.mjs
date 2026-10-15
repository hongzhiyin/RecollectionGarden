import { createServer, request as upstreamRequest } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../bridge/server.mjs';

const appRoot = fileURLToPath(new URL('../../', import.meta.url));
const version = JSON.parse(await readFile(resolve(appRoot, 'package.json'), 'utf8')).version;
const types = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8',
  '.mjs': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8', '.json': 'application/json',
  '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

export async function startDesktop(options = {}) {
  const root = await realpath(options.staticDir ?? resolve(appRoot, 'dist'));
  let bridge;
  const sockets = new Set();
  const server = createServer(async (req, res) => {
    const host = req.headers.host;
    if (!['127.0.0.1:' + server.address().port, 'localhost:' + server.address().port].includes(host)) {
      res.writeHead(403); res.end('Invalid host'); return;
    }
    if (req.url === '/__rg_experience') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ app: 'RecollectionGarden', version, ready: !!bridge, pid: process.pid })); return;
    }
    if (req.url?.startsWith('/rg-api/')) {
      if (!bridge) { res.writeHead(503); res.end('Local service not ready'); return; }
      const upstream = upstreamRequest({ host: '127.0.0.1', port: bridge.port, method: req.method,
        path: req.url.slice('/rg-api'.length), headers: { ...req.headers, host: '127.0.0.1:' + bridge.port } },
      response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
      upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Local service unavailable'); });
      req.on('aborted', () => upstream.destroy()); req.pipe(upstream); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      if (path.includes('\0') || path.includes('\\')) throw new Error('path');
      const file = await realpath(resolve(root, '.' + (path === '/' ? '/index.html' : path)));
      if (!file.startsWith(root + sep)) throw new Error('path');
      const info = await stat(file);
      if (!info.isFile()) throw new Error('file');
      res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        'Content-Length': info.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      if (req.method === 'HEAD') res.end();
      else createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  server.on('upgrade', (req, socket, head) => {
    if (!bridge || req.url !== '/rg-api/ws' || req.headers.host !== '127.0.0.1:' + server.address().port) { socket.destroy(); return; }
    const upstream = upstreamRequest({ host: '127.0.0.1', port: bridge.port, path: '/ws',
      headers: { ...req.headers, host: '127.0.0.1:' + bridge.port } });
    upstream.on('upgrade', (response, remote, remoteHead) => {
      sockets.add(socket); sockets.add(remote);
      const headers = response.rawHeaders.reduce((lines, value, index, raw) =>
        index % 2 ? lines : lines + value + ': ' + raw[index + 1] + '\r\n', '');
      socket.write('HTTP/1.1 101 Switching Protocols\r\n' + headers + '\r\n');
      if (remoteHead.length) socket.write(remoteHead);
      if (head.length) remote.write(head);
      remote.on('error', () => socket.destroy()); socket.on('error', () => remote.destroy());
      remote.on('close', () => { sockets.delete(remote); socket.destroy(); });
      socket.on('close', () => { sockets.delete(socket); remote.destroy(); });
      socket.pipe(remote).pipe(socket);
    });
    upstream.on('response', response => { response.resume(); socket.destroy(); });
    upstream.on('error', () => socket.destroy()); upstream.end();
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(options.uiPort ?? 4321, '127.0.0.1', done); });
  const uiPort = server.address().port;
  try {
    bridge = await startServer({ port: options.bridgePort ?? 4322, origins: ['http://127.0.0.1:' + uiPort] });
  } catch (error) { server.closeAllConnections(); await new Promise(done => server.close(done)); throw error; }
  return { uiPort, bridgePort: bridge.port, close: async () => {
    for (const socket of sockets) socket.destroy();
    server.closeAllConnections(); await new Promise(done => server.close(done)); await bridge.close();
  } };
}
