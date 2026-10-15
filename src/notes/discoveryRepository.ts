import { library, type LibraryDatabase } from '../library/repository';
import { BridgeError } from '../external/protocol';
import { criteriaSchema, searchSchema, exportSchema, type SearchInput, type ExportInput } from './discoveryProtocol';
import { matchingNotes, matchMetadata, textDigest, normalizeSearch } from './search';
import { markdownNotes, exportFileName, utf8Chunks } from './markdown';
import type { QuoteSource } from '../citations/model';

export interface NoteTarget { page: number; assetHash: string; source?: QuoteSource }
export class NoteDiscovery {
  constructor(public database: LibraryDatabase = library.database) {}
  snapshot(bookId: string) {
    return this.database.transaction('r', this.database.books, this.database.notes, async () => {
      const book = await this.database.books.get(bookId);
      if (!book) throw new BridgeError('MISSING_BOOK', '书籍已不存在。');
      return { book, notes: await this.database.notes.where('bookId').equals(bookId).toArray() };
    });
  }
  async search(bookId: string, input: SearchInput = {}) {
    const params = searchSchema.parse(input), snapshot = await this.snapshot(bookId);
    const selected = matchingNotes(snapshot.notes, params);
    const resultVersion = await textDigest(JSON.stringify([bookId, normalizeSearch(params.query), params.kind, params.sort,
      selected.map(note => [note.id, note.revision])]));
    if (params.expectedResultVersion && params.expectedResultVersion !== resultVersion)
      throw new BridgeError('RESULT_CHANGED', '检索结果已变化，请从首页重新查询。');
    return { items: selected.slice(params.offset, params.offset + params.limit).map(note => matchMetadata(note, params.query)),
      total: selected.length, hasMore: params.offset + params.limit < selected.length, resultVersion,
      offset: params.offset, limit: params.limit };
  }
  async exportDocument(bookId: string, input: ExportInput = {}) {
    const params = exportSchema.parse(input), { book, notes } = await this.snapshot(bookId);
    const selected = matchingNotes(notes, criteriaSchema.parse(params));
    const content = markdownNotes(book, selected);
    return { content, contentHash: await textDigest(content), noteCount: selected.length,
      fileName: exportFileName(book.title), mimeType: 'text/markdown;charset=utf-8' };
  }
  async exportChunk(bookId: string, input: ExportInput = {}) {
    const params = exportSchema.parse(input), document = await this.exportDocument(bookId, params);
    if (params.expectedContentHash && params.expectedContentHash !== document.contentHash)
      throw new BridgeError('EXPORT_CHANGED', '导出内容已变化，请从首块重新读取。');
    // Leave room for MCP's text + structuredContent envelopes, including escaped control characters.
    const chunks = utf8Chunks(document.content, 32 * 1024);
    if (params.chunkIndex >= chunks.length) throw new BridgeError('INVALID_PARAMS', '导出块编号超出范围。');
    const result = { ...document, content: chunks[params.chunkIndex], chunkIndex: params.chunkIndex, chunkCount: chunks.length };
    if (new TextEncoder().encode(JSON.stringify(result)).length > 500 * 1024)
      throw new BridgeError('EXPORT_TOO_LARGE', '导出结果超过传输限制。');
    return result;
  }
  target(bookId: string, noteId: string, sourceIndex = 0): Promise<NoteTarget> {
    return this.database.transaction('r', this.database.books, this.database.notes, this.database.assets, async () => {
      const book = await this.database.books.get(bookId), note = await this.database.notes.get(noteId);
      if (!book) throw new BridgeError('MISSING_BOOK', '书籍已不存在。');
      if (!note || note.bookId !== bookId) throw new BridgeError('MISSING_NOTE', '此书中不存在该笔记。');
      const asset = await this.database.assets.get(book.assetHash);
      if (!asset) throw new BridgeError('MISSING_ASSET', '来源 PDF 不可用，笔记仍可检索和导出。');
      const source = note.sources[sourceIndex];
      if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || (note.sources.length ? !source : sourceIndex !== 0))
        throw new BridgeError('INVALID_PARAMS', '来源编号无效。');
      if (note.assetHash !== book.assetHash || (source && (source.bookId !== bookId || source.assetHash !== book.assetHash)))
        throw new BridgeError('INVALID_SOURCE', '笔记来源与当前 PDF 摘要不符。');
      const page = source?.page ?? note.page;
      if (!Number.isInteger(page) || page < 1 || page > asset.pages) throw new BridgeError('INVALID_PAGE', '来源页码超出范围。');
      return { page, assetHash: book.assetHash, ...(source ? { source: structuredClone(source) } : {}) };
    });
  }
}
export const noteDiscovery = new NoteDiscovery();
