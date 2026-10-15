import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { startServer } from '../../bridge/server.mjs';
import { call } from '../../bridge/client.mjs';
import { readConfig } from '../../bridge/config.mjs';

test('真实 HTTP/WebSocket：认证、幂等、会话替换与离线', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'rg-bridge-'));
  process.env.RG_BRIDGE_CONFIG = join(folder, 'bridge.json');
  const service = await startServer({ port: 0, origins: ['http://127.0.0.1:4318'] });
  const config = await readConfig(); const address = `http://127.0.0.1:${service.port}`;
  let socket, replacement;
  try {
    assert.equal((await fetch(address + '/rpc', { method: 'POST', body: '{}' })).status, 401);
    assert.equal((await fetch(address + '/pair', { method: 'POST', headers: { Origin: 'https://untrusted.example' } })).status, 403);
    const hostStatus = await new Promise((resolve, reject) => {
      const request = httpRequest(address + '/health', { headers: { Host: 'untrusted.example' } }, response => { response.resume(); resolve(response.statusCode); });
      request.on('error', reject); request.end();
    });
    assert.equal(hostStatus, 403);
    const clientId = randomUUID(); let executions = 0;
    async function connect() {
      const ws = new WebSocket(address.replace('http', 'ws') + '/ws', { origin: 'http://127.0.0.1:4318' });
      await once(ws, 'open');
      const ready = new Promise(resolve => ws.once('message', bytes => resolve(JSON.parse(bytes.toString()))));
      ws.send(JSON.stringify({ type: 'hello', token: config.token, clientId }));
      const { sessionId } = await ready;
      ws.send(JSON.stringify({ type: 'state', snapshot: { bookId: 'book', title: 'Book', page: 1, contextVersion: 'version' } }));
      ws.on('message', bytes => {
        const value = JSON.parse(bytes.toString()); if (value.type !== 'command') return;
        executions++; ws.send(JSON.stringify({ type: 'result', requestId: value.request.requestId, result: { ok: true, data: 'from reader' } }));
      });
      await new Promise(resolve => setTimeout(resolve, 20)); return { ws, sessionId };
    }
    const first = await connect(); socket = first.ws;
    const cli = spawn(process.execPath, ['bin/recollection-garden.mjs', 'call', 'sessions.list', '--input', '-']);
    let output = ''; cli.stdout.on('data', chunk => { output += chunk; }); cli.stdin.end('{}');
    const [exitCode] = await once(cli, 'exit'); assert.equal(exitCode, 0); assert.equal(JSON.parse(output).ok, true);
    const input = { sessionId: first.sessionId, requestId: 'same', bookId: 'book', contextVersion: 'version', params: {} };
    const result = await call('context.get', input); assert.equal(result.ok, true);
    assert.deepEqual(await call('context.get', input), result); assert.equal(executions, 1);
    assert.equal((await call('page.read', { ...input, params: { page: 1 } })).error.code, 'REQUEST_CONFLICT');
    const second = await connect(); replacement = second.ws;
    assert.equal((await call('context.get', { ...input, requestId: 'old-session' })).error.code, 'READER_OFFLINE');
    assert.equal((await call('sessions.list')).data.length, 1);
    assert.equal((await call('context.get', { ...input, sessionId: second.sessionId })).ok, true);
  } finally {
    socket?.close(); replacement?.close(); await service.close(); await rm(folder, { recursive: true, force: true });
    delete process.env.RG_BRIDGE_CONFIG;
  }
});
