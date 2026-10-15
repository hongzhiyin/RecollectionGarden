import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

test('桌面父进程断开后关闭服务，随后可以使用原端口重启', { timeout: 15000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), 'rg-lifecycle-'));
  const children = [];
  const launch = async (port = 0) => {
    const child = spawn(process.execPath, ['desktop/runtime/entry.mjs', 'serve'], {
      env: { ...process.env, RG_BRIDGE_CONFIG: join(folder, 'bridge.json'), RG_DESKTOP_MANAGED: '1',
        RG_DESKTOP_UI_PORT: String(port), RG_DESKTOP_BRIDGE_PORT: '0' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    children.push(child);
    child.exited = once(child, 'exit');
    let output = ''; child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => { output += chunk; });
    for (let attempt = 0; attempt < 100; attempt++) {
      const match = output.match(/ready at (http:\/\/127\.0\.0\.1:(\d+))/);
      if (match) return { child, url: match[1], port: Number(match[2]) };
      assert.equal(child.exitCode, null, 'Runtime exited before ready');
      await setTimeout(30);
    }
    throw new Error('Runtime did not become ready');
  };
  try {
    const first = await launch();
    assert.equal((await (await fetch(first.url + '/__rg_experience')).json()).ready, true);
    first.child.stdin.end(); // A crash closes the same parent-owned pipe automatically.
    assert.equal((await first.child.exited)[0], 0);
    await assert.rejects(fetch(first.url));
    const second = await launch(first.port);
    assert.equal((await (await fetch(second.url + '/__rg_experience')).json()).ready, true);
    second.child.kill('SIGTERM');
    assert.equal((await second.child.exited)[0], 0);
  } finally {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await child.exited;
    }
    await rm(folder, { recursive: true, force: true });
  }
});
