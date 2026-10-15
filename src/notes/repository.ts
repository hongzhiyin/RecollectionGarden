import { library, type LibraryDatabase } from '../library/repository';
import { BridgeError, parseRequest, type BridgeCommand } from '../external/protocol';
import { durable, storedRequest } from '../external/storage';
import { noteOperations } from './protocol';
import { noteSources } from './sources';
import { noteKindLabels, type Note } from './model';
import type { QuoteSource } from '../citations/model';
import { NoteDiscovery } from './discoveryRepository';

export type SourceVerifier = (source: QuoteSource) => Promise<void>;
export class NoteRepository {
  constructor(public database: LibraryDatabase = library.database) {}
  async get(bookId: string, noteId: string) {
    const note = await this.database.notes.get(noteId);
    if (!note || note.bookId !== bookId) throw new BridgeError('MISSING_NOTE', '此书中不存在该笔记。');
    return note;
  }
  async list(bookId: string) {
    if (!await this.database.books.get(bookId)) throw new BridgeError('MISSING_BOOK', '书籍已不存在。');
    return (await this.database.notes.where('bookId').equals(bookId).sortBy('updatedAt')).reverse()
      .map(({ id, title, kind, page, revision, createdAt, updatedAt }) => ({ id, title, kind, page, revision, createdAt, updatedAt }));
  }
  async execute(command: BridgeCommand, verify?: SourceVerifier) {
    const { clientId, expiresAt, ...request } = command;
    const parsed = parseRequest(request);
    command = { ...parsed, clientId, expiresAt };
    const bookId = command.bookId;
    if (!bookId) throw new BridgeError('MISSING_BOOK', '请指定书籍。');
    if (command.operation === 'notes.search') return new NoteDiscovery(this.database).search(bookId, command.params);
    if (command.operation === 'notes.export') return new NoteDiscovery(this.database).exportChunk(bookId, command.params);
    if (command.operation === 'notes.list') return this.list(bookId);
    if (command.operation === 'notes.get') return this.get(bookId, noteOperations['notes.get'].parse(command.params).noteId);
    const previous = await storedRequest(command, this.database);
    if (previous?.ok) return previous.data;
    if (command.operation === 'notes.create') {
      const input = noteOperations['notes.create'].parse(command.params);
      if (input.kind === 'quote' && input.source) {
        if (!verify) throw new BridgeError('NOT_READY', '请打开来源 PDF 完成原文核验。');
        await verify(input.source);
      }
    }
    const result = await durable(command, async () => {
      if (!await this.database.books.get(bookId)) throw new BridgeError('MISSING_BOOK', '书籍已不存在。');
      if (command.operation === 'notes.create') {
        const input = noteOperations['notes.create'].parse(command.params);
        if (input.kind === 'answer') {
          const key = JSON.stringify([bookId, input.conversationId, input.messageId]);
          const existing = await this.database.notes.where('originMessageKey').equals(key).first();
          if (existing) return { created: false, note: existing };
        }
        const source = await noteSources(this.database, bookId, input);
        if (!source.sources.length && !source.aiSnapshot && !input.userContent.trim())
          throw new BridgeError('EMPTY_NOTE', '请填写个人内容。');
        const now = Date.now();
        const note: Note = { id: crypto.randomUUID(), bookId, kind: input.kind, ...source,
          title: input.title ?? `${noteKindLabels[input.kind]} · PDF 第 ${source.page} 页`, userContent: input.userContent,
          revision: 1, createdAt: now, updatedAt: now };
        await this.database.notes.add(note); return { created: true, note };
      }
      if (command.operation !== 'notes.update' && command.operation !== 'notes.delete')
        throw new BridgeError('UNSUPPORTED_OPERATION', '未实现此笔记操作。');
      const input = noteOperations[command.operation].parse(command.params);
      const note = await this.get(bookId, input.noteId);
      if (note.revision !== input.expectedRevision) throw new BridgeError('VERSION_CONFLICT', '笔记已在其他窗口更新；输入已保留，请重新读取后合并。');
      if ('confirmed' in input) {
        if (!input.confirmed) throw new BridgeError('CONFIRMATION_REQUIRED', '删除笔记需要明确确认。');
        await this.database.notes.delete(note.id); return { deleted: true, noteId: note.id };
      }
      if (!input.userContent.trim() && !note.sources.length && !note.aiSnapshot) throw new BridgeError('EMPTY_NOTE', '请填写个人内容。');
      const updated = { ...note, title: input.title, userContent: input.userContent, revision: note.revision + 1, updatedAt: Date.now() };
      await this.database.notes.put(updated); return updated;
    }, this.database);
    if (!result.ok) throw new BridgeError(result.error.code, result.error.message);
    return result.data;
  }
}
export const notes = new NoteRepository();

const uiClient = () => {
  const key = 'rg-notes-client'; const id = sessionStorage.getItem(key) ?? crypto.randomUUID();
  sessionStorage.setItem(key, id); return 'ui:' + id;
};
export function noteCommand(operation: 'notes.create' | 'notes.update' | 'notes.delete', bookId: string,
  params: Record<string, unknown>, requestId: string = crypto.randomUUID()): BridgeCommand {
  return { ...parseRequest({ operation, bookId, params, requestId }), clientId: uiClient(), expiresAt: Date.now() + 15000 };
}
