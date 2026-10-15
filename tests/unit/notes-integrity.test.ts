import { afterEach, beforeEach, expect, it } from 'vitest';
import Dexie from 'dexie';
import { noteFixture } from './notes-fixture';
import { LibraryDatabase } from '../../src/library/repository';
import { publishMessage } from '../../src/external/storage';
import type { Note } from '../../src/notes/model';

let f: Awaited<ReturnType<typeof noteFixture>>;
beforeEach(async () => { f = await noteFixture(); });
afterEach(async () => { await f.database.delete(); });

it('拒绝错误书籍、文件身份、伪造快照与空个人笔记', async () => {
  await expect(f.repository.execute(f.command('notes.create', { kind: 'quote', citationId: 'other' }))).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  await expect(f.repository.execute(f.command('notes.create', { kind: 'quote', source: { ...f.source, assetHash: 'other' } }), async () => {}))
    .rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  await expect(f.repository.execute(f.command('notes.create', { kind: 'page', page: 1, userContent: ' ' }))).rejects.toMatchObject({ code: 'EMPTY_NOTE' });
  expect(() => f.command('notes.create', { kind: 'answer', conversationId: 'c', messageId: 'm', expectedSequence: 1,
    aiSnapshot: { text: 'fake' } })).toThrow();
  expect(await f.database.notes.count()).toBe(0);
});

it('未完成回答和变化的消息版本被拒绝，新原文必须核验', async () => {
  const input = { kind: 'answer', conversationId: 'c', messageId: 'm', expectedSequence: 1 };
  await publishMessage(f.book.id, { conversationId: 'c', messageId: 'm', sequence: 1, text: 'partial', status: 'streaming' }, f.database);
  await expect(f.repository.execute(f.command('notes.create', input))).rejects.toMatchObject({ code: 'MESSAGE_NOT_COMPLETE' });
  await publishMessage(f.book.id, { conversationId: 'c', messageId: 'm', sequence: 2, text: 'done', status: 'complete' }, f.database);
  await expect(f.repository.execute(f.command('notes.create', input))).rejects.toMatchObject({ code: 'MESSAGE_CHANGED' });
  await expect(f.repository.execute(f.command('notes.create', { kind: 'quote', source: f.source }))).rejects.toMatchObject({ code: 'NOT_READY' });
});

it('原请求内容改变被拒绝，明确删除只影响指定笔记', async () => {
  const request = f.command('notes.create', { kind: 'quote', citationId: f.citation.id });
  const { note } = await f.repository.execute(request) as { note: Note };
  await expect(f.repository.execute({ ...request, params: { kind: 'page', page: 2, userContent: 'changed' } })).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
  await expect(f.repository.get('other', note.id)).rejects.toMatchObject({ code: 'MISSING_NOTE' });
  await expect(f.repository.execute(f.command('notes.delete', { noteId: note.id, expectedRevision: 1, confirmed: false })))
    .rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
  expect(await f.database.notes.count()).toBe(1);
  await f.repository.execute(f.command('notes.delete', { noteId: note.id, expectedRevision: 1, confirmed: true }));
  expect(await f.database.notes.count()).toBe(0); expect(await f.database.books.count()).toBe(1);
  expect(await f.database.citations.count()).toBe(1); expect(await f.database.assets.count()).toBe(1);
});

it('v3 升级 v4 保留所有既有数据，非回答笔记不受唯一消息索引影响', async () => {
  const name = 'legacy-notes-' + crypto.randomUUID();
  const legacy = new Dexie(name);
  legacy.version(3).stores({ assets: '&hash', books: '&id,assetHash,updatedAt', progress: '&bookId',
    citations: '&id,bookId,createdAt', messages: '&id,bookId,[bookId+conversationId]', requests: '&id,createdAt' });
  await legacy.table('books').add({ id: 'old-book', assetHash: 'old-asset', title: 'old' });
  await legacy.table('assets').add({ hash: 'old-asset', file: new Blob(['old pdf']) });
  await legacy.table('progress').add({ bookId: 'old-book', page: 193, zoom: { mode: 'percent', percent: 150 } });
  await legacy.table('citations').add({ id: 'old-citation', bookId: 'old-book', rawText: 'old source' });
  await legacy.table('messages').add({ id: 'old-message', bookId: 'old-book', text: 'old answer' });
  await legacy.table('requests').add({ id: 'old-request', result: { ok: true, data: 'old' } }); legacy.close();
  const current = new LibraryDatabase(name);
  try {
    await current.open();
    expect(await current.notes.count()).toBe(0); expect(await current.books.count()).toBe(1);
    expect(await current.citations.count()).toBe(1); expect(await current.messages.count()).toBe(1);
    expect(await current.requests.count()).toBe(1); expect((await current.progress.get('old-book'))?.page).toBe(193);
    await f.repository.execute(f.command('notes.create', { kind: 'page', page: 1, userContent: 'first' }));
    await f.repository.execute(f.command('notes.create', { kind: 'page', page: 1, userContent: 'second' }));
    expect(await f.database.notes.count()).toBe(2);
  } finally { await current.delete(); }
});
