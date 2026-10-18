import { randomUUID } from 'node:crypto';
import { BridgeError, failure } from '../src/external/protocol.ts';

const allowed = new Set(['context.get', 'page.read', 'reader.navigate', 'outline.get', 'outline.navigate']);
/** Both the fixed window and book are enforced at the service boundary, not by model arguments. */
export async function scopedRead(hub, value) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some(k => !['window', 'resource', 'operation', 'contextVersion', 'params'].includes(k))
      || typeof value.window !== 'string' || typeof value.resource !== 'string' || !allowed.has(value.operation))
      throw new BridgeError('SCOPE_DENIED', '此连接只允许绑定窗口中的内容读取和普通阅读操作。');
    const current = () => {
      const matches = [...hub.sessions.values()].filter(s => s.clientId === value.window && s.socket.readyState === 1);
      if (matches.length !== 1 || !matches[0].snapshot) throw new BridgeError('READER_OFFLINE', '绑定窗口未就绪或已离线。');
      const session = matches[0];
      if (session.snapshot.bookId !== value.resource) throw new BridgeError('CONTEXT_CHANGED', '窗口中的书籍已改变，请从当前书籍重新打开外部对话。');
      return session;
    };
    const session = current(), snapshot = { ...session.snapshot };
    if (value.operation !== 'context.get' && value.contextVersion !== snapshot.contextVersion)
      throw new BridgeError('STALE_CONTEXT', '页面版本已变化，请先重新读取当前上下文。');
    const result = await hub.call({ operation: value.operation, requestId: randomUUID(), sessionId: session.id,
      bookId: value.resource, contextVersion: snapshot.contextVersion, params: value.params ?? {} });
    if (current().snapshot.contextVersion !== snapshot.contextVersion && !['reader.navigate', 'outline.navigate'].includes(value.operation))
      throw new BridgeError('STALE_CONTEXT', '读取期间页面已变化，本次结果未返回。');
    return result;
  } catch (error) { return failure(error); }
}
