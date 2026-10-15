import { randomUUID } from 'node:crypto';
import { readConfig } from './config.mjs';

export async function call(operation, input = {}) {
  try {
    const config = await readConfig();
    const response = await fetch(`http://127.0.0.1:${config.port}/rpc`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.token },
      body: JSON.stringify({ ...input, operation, requestId: input.requestId ?? randomUUID() }), signal: AbortSignal.timeout(20000) });
    return await response.json();
  } catch { return { ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: '本地能力服务不可用，请启动服务并连接阅读器。' } }; }
}
