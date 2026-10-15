import { library, type LibraryDatabase } from '../library/repository';
import { BridgeError, fingerprint, messageSchema, type BridgeCommand, type BridgeResult } from './protocol';
import type { ExternalMessage } from './models';

export async function storedRequest(command: BridgeCommand, database = library.database) {
  const existing = await database.requests.get(command.clientId + ':' + command.requestId);
  if (existing && existing.signature !== fingerprint(command)) throw new BridgeError('REQUEST_CONFLICT', '相同请求 ID 的内容已改变。');
  return existing?.result;
}

export async function durable(command: BridgeCommand, execute: () => Promise<unknown>, database = library.database): Promise<BridgeResult> {
  return database.transaction('rw', [database.books, database.assets, database.citations, database.messages, database.requests, database.notes], async () => {
    const previous = await storedRequest(command, database); if (previous) return previous;
    if (Date.now() > command.expiresAt) throw new BridgeError('TIMEOUT', '请求已过期，未执行写入。');
    const result: BridgeResult = { ok: true, data: await execute() };
    await database.requests.add({ id: command.clientId + ':' + command.requestId, signature: fingerprint(command), result, createdAt: Date.now() });
    return result;
  });
}

export async function publishMessage(bookId: string, params: unknown, database: LibraryDatabase = library.database) {
  const input = messageSchema.parse(params);
  if (!await database.books.get(bookId)) throw new BridgeError('MISSING_BOOK', '消息来源书籍不存在。');
  for (const id of input.citationIds) {
    if ((await database.citations.get(id))?.bookId !== bookId) throw new BridgeError('INVALID_SOURCE', '消息包含无效或其他书籍的引用。');
  }
  const id = JSON.stringify([bookId, input.conversationId, input.messageId]);
  const previous = await database.messages.get(id);
  if (previous) {
    const oldContent = JSON.stringify({ ...previous, id: undefined, bookId: undefined, createdAt: undefined });
    if (input.sequence === previous.sequence && oldContent !== JSON.stringify(input)) throw new BridgeError('SEQUENCE_CONFLICT', '相同消息序号不能对应不同内容。');
    if (input.sequence <= previous.sequence || (previous.status !== 'streaming' && input.status === 'streaming')) return { applied: false, message: previous };
  }
  const message: ExternalMessage = { id, bookId, ...input, createdAt: previous?.createdAt ?? Date.now() };
  await database.messages.put(message); return { applied: true, message };
}

export function listMessages(bookId: string, database = library.database) {
  return database.messages.where('bookId').equals(bookId).sortBy('createdAt');
}
