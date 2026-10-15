import { beforeEach, afterEach, expect, it } from 'vitest';
import { LibraryDatabase, LibraryRepository } from '../../src/library/repository';
import { durable, publishMessage, storedRequest } from '../../src/external/storage';
import { parseRequest, type BridgeCommand } from '../../src/external/protocol';
import { CitationRepository } from '../../src/citations/repository';
import { createAnchor } from '../../src/citations/anchors';

let database: LibraryDatabase;
let bookId: string;
const params = { conversationId: 'conversation', messageId: 'message', sequence: 1, text: 'External answer',
  role: 'assistant' as const, status: 'complete' as const, citationIds: [], sourceLabel: 'Test AI' };
beforeEach(async () => {
  database = new LibraryDatabase('bridge-' + crypto.randomUUID());
  const book = await new LibraryRepository(database).commit({ hash: 'asset', file: new Blob(['pdf']), pages: 3,
    size: 3, thumbnail: '', createdAt: 0 }, 'book.pdf', { type: 'create' }, false); bookId = book.id;
});
afterEach(async () => { await database.delete(); });
const command = (): BridgeCommand => ({ ...parseRequest({ requestId: 'request', operation: 'conversation.publish', bookId,
  params }), clientId: 'window', expiresAt: Date.now() + 10000 });

it('相同消息和请求仅写一次，原请求结果可恢复', async () => {
  const request = command();
  const first = await durable(request, () => publishMessage(bookId, params, database), database);
  const second = await durable(request, () => { throw new Error('must not execute'); }, database);
  expect(second).toEqual(first); expect(await database.messages.count()).toBe(1);
  expect(await storedRequest(request, database)).toEqual(first);
});
it('重复序号冲突拒绝，乱序和完成后的流式更新不覆盖消息', async () => {
  await publishMessage(bookId, params, database);
  await expect(publishMessage(bookId, { ...params, text: 'conflict' }, database)).rejects.toMatchObject({ code: 'SEQUENCE_CONFLICT' });
  expect((await publishMessage(bookId, { ...params, sequence: 0 }, database)).applied).toBe(false);
  expect((await publishMessage(bookId, { ...params, sequence: 2, status: 'streaming' }, database)).applied).toBe(false);
  expect((await database.messages.toArray())[0].text).toBe('External answer');
});
it('其他书籍引用与无效来源不能写入消息', async () => {
  await expect(publishMessage(bookId, { ...params, citationIds: ['missing'] }, database)).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  await expect(publishMessage('other', params, database)).rejects.toMatchObject({ code: 'MISSING_BOOK' });
  expect(await database.messages.count()).toBe(0);
});
it('请求记录失败会回滚引用，重试不产生孤立记录', async () => {
  const source = { bookId, assetHash: 'asset', page: 1, rawText: 'source', anchor: createAnchor('source', 0, 6) };
  const request: BridgeCommand = { ...parseRequest({ requestId: 'citation', operation: 'citation.create', bookId,
    contextVersion: 'context', params: { source } }), clientId: 'window', expiresAt: Date.now() + 10000 };
  const citations = new CitationRepository(database);
  const fail = () => { throw new DOMException('quota', 'QuotaExceededError'); }; database.requests.hook('creating', fail);
  await expect(durable(request, () => citations.save(source, 'quote', 'source'), database)).rejects.toThrow();
  expect(await database.citations.count()).toBe(0); database.requests.hook('creating').unsubscribe(fail);
  await durable(request, () => citations.save(source, 'quote', 'source'), database);
  expect(await database.citations.count()).toBe(1);
});
it('过期和改变内容的重复请求不能再次写入', async () => {
  const request = command();
  await expect(durable({ ...request, expiresAt: 0 }, () => publishMessage(bookId, params, database), database)).rejects.toMatchObject({ code: 'TIMEOUT' });
  await durable(request, () => publishMessage(bookId, params, database), database);
  await expect(storedRequest({ ...request, params: { ...request.params, text: 'changed' } }, database)).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
});
