#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { call } from '../bridge/client.mjs';

async function readStdin() {
  let content = '';
  for await (const chunk of process.stdin) { content += chunk; if (content.length > 1024 * 1024) throw new Error('input too large'); }
  return content;
}

const [command, operation, flag, value] = process.argv.slice(2);
if (command === 'serve') {
  const { startServer } = await import('../bridge/server.mjs');
  const service = await startServer();
  process.stderr.write(`RecollectionGarden bridge ready on 127.0.0.1:${service.port}\n`);
  const stop = () => { void service.close().then(() => process.exit(0)); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
} else {
  let result;
  try {
    if (command === 'sessions') result = await call('sessions.list');
    else if (command === 'call' && operation) {
      let input = {};
      if (flag === '--input') {
        const content = value === '-' ? await readStdin() : value?.startsWith('@')
          ? await readFile(value.slice(1), 'utf8') : value;
        input = JSON.parse(content);
      } else if (flag) throw new Error('arguments');
      result = await call(operation, input);
    } else if (command === 'help' || !command) {
      result = { ok: true, data: { usage: ['serve', 'sessions', 'call <operation> --input @file.json'],
        operations: Object.keys((await import('../src/external/protocol.ts')).operations) } };
    } else throw new Error('arguments');
  } catch { result = { ok: false, error: { code: 'INVALID_INPUT', message: '命令或 JSON 输入无效。运行 help 查看用法。' } }; }
  process.stdout.write(JSON.stringify(result) + '\n'); process.exitCode = result.ok ? 0 : 1;
}
