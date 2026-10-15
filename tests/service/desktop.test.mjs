import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import WebSocket from 'ws';
import { startDesktop } from '../../desktop/runtime/server.mjs';
import { readConfig } from '../../bridge/config.mjs';
import { call } from '../../bridge/client.mjs';

test('桌面服务器：独立端口、静态资源边界、HTTP/WS 代理与端口冲突不覆盖配置', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'rg-desktop-'));
  const oldConfig = process.env.RG_BRIDGE_CONFIG; process.env.RG_BRIDGE_CONFIG = join(folder, 'bridge.json');
  const publicDir = join(folder, 'public'); await mkdir(publicDir);
  await writeFile(join(publicDir, 'index.html'), '<h1>流光忆庭</h1>');
  await writeFile(join(publicDir, 'worker.js'), 'self.onmessage=()=>{}');
  await writeFile(join(folder, 'private.txt'), 'not-public');
  await symlink(join(folder, 'private.txt'), join(publicDir, 'leak.txt'));
  let service, socket;
  try {
    service = await startDesktop({ uiPort: 0, bridgePort: 0, staticDir: publicDir });
    const address = 'http://127.0.0.1:' + service.uiPort, origin = address;
    assert.match(await (await fetch(address)).text(), /流光忆庭/);
    assert.equal((await fetch(address + '/worker.js')).headers.get('content-type'), 'text/javascript;charset=utf-8');
    assert.equal((await fetch(address + '/leak.txt')).status, 404);
    assert.equal((await fetch(address + '/%2e%2e/private.txt')).status, 404);
    assert.equal((await fetch(address + '/__rg_experience')).status, 200);
    assert.equal((await (await fetch(address + '/__rg_experience')).json()).ready, true);
    assert.equal((await fetch(address + '/rg-api/pair', { method: 'POST', headers: { Origin: 'https://untrusted.example' } })).status, 403);
    const pair = await (await fetch(address + '/rg-api/pair', { method: 'POST', headers: { Origin: origin } })).json();
    assert.equal(pair.ok, true);
    assert.equal((await fetch(address + '/rg-api/rpc', { method: 'POST', body: '{}' })).status, 401);
    socket = new WebSocket(address.replace('http', 'ws') + '/rg-api/ws', { origin }); await once(socket, 'open');
    const ready = once(socket, 'message');
    socket.send(JSON.stringify({ type: 'hello', clientId: randomUUID(), token: pair.data.token }));
    const session = JSON.parse((await ready)[0].toString());
    socket.send(JSON.stringify({ type: 'state', snapshot: { bookId: null, title: '书架', page: 0, contextVersion: 'bookshelf' } }));
    socket.on('message', bytes => {
      const value = JSON.parse(bytes.toString());
      if (value.type === 'command') socket.send(JSON.stringify({ type: 'result', requestId: value.request.requestId, result: { ok: true, data: [] } }));
    });
    const result = await call('books.list', { sessionId: session.sessionId });
    assert.equal(result.ok, true); assert.deepEqual(result.data, []);
    const config = await readConfig();
    await assert.rejects(startDesktop({ uiPort: service.uiPort, bridgePort: 0, staticDir: publicDir }), { code: 'EADDRINUSE' });
    assert.deepEqual(await readConfig(), config);
  } finally {
    socket?.close(); await service?.close(); await rm(folder, { recursive: true, force: true });
    if (oldConfig === undefined) delete process.env.RG_BRIDGE_CONFIG; else process.env.RG_BRIDGE_CONFIG = oldConfig;
  }
});
