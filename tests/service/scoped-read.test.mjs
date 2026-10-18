import test from 'node:test';
import assert from 'node:assert/strict';
import { BridgeHub } from '../../bridge/hub.mjs';
import { scopedRead } from '../../bridge/scoped-read.mjs';
function fixture() {
  const hub = new BridgeHub(1000); let calls = 0, session;
  const socket = { readyState: 1, close() {}, send(raw) {
    const value = JSON.parse(raw); if (value.type !== 'command') return;
    calls++; queueMicrotask(() => hub.receive(session, { type: 'result', requestId: value.request.requestId,
      result: { ok: true, data: { rawText: 'Only book A', contextVersion: value.request.contextVersion } } }));
  } };
  session = hub.register(socket, 'window-a');
  hub.receive(session, { type: 'state', snapshot: { bookId: 'book-a', title: 'A', page: 1, contextVersion: 'v1' } });
  return { hub, session, socket, calls: () => calls };
}
test('scoped reads pin window/book and reject writes and extra target fields', async () => {
  const f = fixture(), base = { window: 'window-a', resource: 'book-a', operation: 'context.get' };
  assert.equal((await scopedRead(f.hub, base)).ok, true);
  for (const patch of [{ window: 'other' }, { resource: 'book-b' }, { operation: 'notes.delete' }, { sessionId: f.session.id }])
    assert.equal((await scopedRead(f.hub, { ...base, ...patch })).ok, false);
  assert.equal(f.calls(), 1);
});
test('page version is mandatory; changing book or closing window never selects another window', async () => {
  const f = fixture(), base = { window: 'window-a', resource: 'book-a', operation: 'page.read', params: { page: 1 } };
  assert.equal((await scopedRead(f.hub, base)).error.code, 'STALE_CONTEXT');
  assert.equal((await scopedRead(f.hub, { ...base, contextVersion: 'v1' })).ok, true);
  f.session.snapshot.bookId = 'book-b';
  assert.equal((await scopedRead(f.hub, { ...base, contextVersion: 'v1' })).error.code, 'CONTEXT_CHANGED');
  f.hub.remove(f.session);
  assert.equal((await scopedRead(f.hub, { ...base, contextVersion: 'v1' })).error.code, 'READER_OFFLINE');
  assert.equal(f.calls(), 1);
});
test('context changes while read is pending discard the result', async () => {
  const f = fixture();
  const pending = scopedRead(f.hub, { window: 'window-a', resource: 'book-a', operation: 'context.get' });
  f.session.snapshot.contextVersion = 'v2';
  assert.equal((await pending).error.code, 'STALE_CONTEXT');
});

test('navigation accepts its own page-version change, rejects stale retries and other books', async () => {
  const f = fixture(), base = { window: 'window-a', resource: 'book-a', operation: 'reader.navigate', contextVersion: 'v1', params: { page: 2 } };
  const pending = scopedRead(f.hub, base);
  f.session.snapshot = { ...f.session.snapshot, page: 2, contextVersion: 'v2' };
  assert.equal((await pending).ok, true);
  assert.equal((await scopedRead(f.hub, base)).error.code, 'STALE_CONTEXT');
  assert.equal((await scopedRead(f.hub, { ...base, resource: 'book-b', contextVersion: 'v2' })).error.code, 'CONTEXT_CHANGED');
  assert.equal((await scopedRead(f.hub, { ...base, operation: 'notes.delete', contextVersion: 'v2' })).error.code, 'SCOPE_DENIED');
  assert.equal(f.calls(), 1);
});
