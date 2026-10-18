import { scopedRead } from './scoped-read.mjs';
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { createConfig } from './config.mjs';
import { BridgeHub } from './hub.mjs';
import { readFile } from 'node:fs/promises';

const appVersion = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;

function matches(value, token) {
  if (typeof value !== 'string') return false;
  const left = Buffer.from(value), right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
}
async function body(request) {
  let size = 0; const chunks = [];
  for await (const chunk of request) { size += chunk.length; if (size > 1024 * 1024) throw new Error('size'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function startServer(options = {}) {
  const port = options.port ?? Number(process.env.RG_BRIDGE_PORT ?? 4320);
  const origins = new Set(options.origins ?? (process.env.RG_BRIDGE_ORIGINS ?? 'http://127.0.0.1:4317,http://127.0.0.1:4318,http://localhost:4317,http://localhost:4318').split(','));
  const hub = new BridgeHub(options.timeout);
  let config;
  const send = (response, status, value) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  const trustedHost = request => ['127.0.0.1:' + config.port, 'localhost:' + config.port].includes(request.headers.host);
  const server = createServer(async (request, response) => {
    if (!config || !trustedHost(request)) return send(response, 403, { ok: false, error: { code: 'ACCESS_DENIED', message: '不接受此来源。' } });
    if (request.method === 'GET' && request.url === '/health') return send(response, 200, { ok: true, data: { version: appVersion } });
    if (request.method === 'POST' && request.url === '/pair') {
      if (!origins.has(request.headers.origin)) return send(response, 403, { ok: false, error: { code: 'ACCESS_DENIED', message: '不接受此页面连接。' } });
      return send(response, 200, { ok: true, data: { token: config.token } });
    }
    if (request.method !== 'POST' || !['/rpc', '/scoped-read'].includes(request.url)) return send(response, 404, { ok: false, error: { code: 'NOT_FOUND', message: '接口不存在。' } });
    if (!matches(request.headers.authorization, 'Bearer ' + config.token)) return send(response, 401, { ok: false, error: { code: 'ACCESS_DENIED', message: '本地连接令牌无效。' } });
    try { send(response, 200, await (request.url === '/scoped-read' ? scopedRead(hub, await body(request)) : hub.call(await body(request)))); }
    catch { send(response, 400, { ok: false, error: { code: 'INVALID_REQUEST', message: '请求格式或大小无效。' } }); }
  });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  server.on('upgrade', (request, socket, head) => {
    if (!config || !trustedHost(request) || request.url !== '/ws' || !origins.has(request.headers.origin)) { socket.destroy(); return; }
    sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection', ws));
  });
  sockets.on('connection', socket => {
    let session;
    const timer = setTimeout(() => socket.close(4003, 'authentication required'), 3000);
    socket.on('message', bytes => {
      try {
        const value = JSON.parse(bytes.toString());
        if (!session) {
          if (value.type !== 'hello' || !matches(value.token, config.token) || typeof value.clientId !== 'string'
            || !/^[a-f0-9-]{36}$/.test(value.clientId)) { socket.close(4003, 'invalid authentication'); return; }
          clearTimeout(timer); session = hub.register(socket, value.clientId);
        } else hub.receive(session, value);
      } catch { socket.close(4002, 'invalid message'); }
    });
    socket.on('close', () => { clearTimeout(timer); if (session) hub.remove(session); });
    socket.on('error', () => {});
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  config = await createConfig(server.address().port);
  return { port: config.port, hub, close: async () => {
    for (const socket of sockets.clients) socket.close(1001, 'service stopped');
    await new Promise(resolve => server.close(resolve));
  } };
}
