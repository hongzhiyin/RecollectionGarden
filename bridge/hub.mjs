import { randomUUID } from 'node:crypto';
import { BridgeError, parseRequest, fingerprint, failure, snapshotSchema } from '../src/external/protocol.ts';

export class BridgeHub {
  sessions = new Map();
  requests = new Map();
  constructor(timeout = 15000) { this.timeout = timeout; }
  register(socket, clientId) {
    for (const session of this.sessions.values()) if (session.clientId === clientId) session.socket.close(4001, 'replaced');
    const session = { id: randomUUID(), clientId, socket, snapshot: null };
    this.sessions.set(session.id, session);
    socket.send(JSON.stringify({ type: 'ready', sessionId: session.id }));
    return session;
  }
  remove(session) {
    this.sessions.delete(session.id);
    for (const record of this.requests.values()) {
      if (record.sessionId === session.id && record.status === 'pending') record.finish(failure(new BridgeError('READER_OFFLINE', '阅读器已离线，写入结果可在重连后查询或使用原请求 ID 重试。')));
    }
  }
  receive(session, value) {
    if (!this.sessions.has(session.id)) return;
    if (value.type === 'state') session.snapshot = snapshotSchema.parse(value.snapshot);
    if (value.type === 'result') {
      const record = this.requests.get(session.clientId + ':' + value.requestId);
      if (record?.sessionId === session.id && record.status === 'pending'
        && typeof value.result?.ok === 'boolean') record.finish(value.result);
      else if (record?.sessionId === session.id && record.status === 'uncertain' && typeof value.result?.ok === 'boolean') {
        record.result = value.result; record.status = 'complete'; record.promise = Promise.resolve(value.result);
      }
    }
  }
  async call(value) {
    try {
      const request = parseRequest(value);
      if (request.operation === 'sessions.list') return { ok: true, data: Array.from(this.sessions.values(), s => ({
        sessionId: s.id, ...s.snapshot, ready: !!s.snapshot,
      })) };
      const session = this.sessions.get(request.sessionId);
      if (!session) throw new BridgeError('READER_OFFLINE', '指定阅读器未连接，请连接后重新列出会话。');
      if (!session.snapshot) throw new BridgeError('NOT_READY', '阅读器尚未准备好。');
      if (request.operation === 'requests.get') {
        const record = this.requests.get(session.clientId + ':' + request.params.targetRequestId);
        return { ok: true, data: record ? { status: record.status, result: record.result } : { status: 'unknown' } };
      }
      const key = session.clientId + ':' + request.requestId, signature = fingerprint(request);
      const existing = this.requests.get(key);
      if (existing && existing.signature !== signature) throw new BridgeError('REQUEST_CONFLICT', '相同请求 ID 不能用于不同操作。');
      if (existing && existing.status !== 'uncertain') return existing.promise;
      if (this.requests.size >= 500) {
        for (const [id, record] of this.requests) if (record.status !== 'pending') this.requests.delete(id);
        if (this.requests.size >= 500) throw new BridgeError('BUSY', '请求过多，请稍后重试。');
      }
      let resolve;
      const promise = new Promise(done => { resolve = done; });
      const record = { signature, sessionId: session.id, status: 'pending', promise, result: undefined };
      let timer;
      record.finish = result => {
        if (record.status !== 'pending') return;
        clearTimeout(timer); record.result = result;
        record.status = !result.ok && ['TIMEOUT', 'READER_OFFLINE'].includes(result.error.code) ? 'uncertain' : 'complete';
        resolve(result);
      };
      this.requests.set(key, record);
      timer = setTimeout(() => record.finish(failure(new BridgeError('TIMEOUT', '操作超时，结果可能尚未确认；使用原请求 ID 查询或重试。'))), this.timeout);
      session.socket.send(JSON.stringify({ type: 'command', request: { ...request, clientId: session.clientId, expiresAt: Date.now() + this.timeout } }));
      return await promise;
    } catch (error) { return failure(error); }
  }
}
