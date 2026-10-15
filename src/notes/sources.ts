import type { LibraryDatabase } from '../library/repository';
import type { NoteCreate } from './protocol';
import type { AnswerSnapshot, NoteSource } from './model';
import { BridgeError } from '../external/protocol';
import { CitationRepository } from '../citations/repository';

export async function noteSources(database: LibraryDatabase, bookId: string, input: NoteCreate) {
  const book = await database.books.get(bookId);
  if (!book) throw new BridgeError('MISSING_BOOK', '书籍已不存在。');
  const asset = await database.assets.get(book.assetHash);
  const sources: NoteSource[] = [];
  async function copy(id: string) {
    const citation = await database.citations.get(id);
    if (!citation || citation.bookId !== bookId || citation.assetHash !== book!.assetHash)
      throw new BridgeError('INVALID_SOURCE', '引用来源与当前书籍不符。');
    const { page, assetHash, rawText, anchor } = citation;
    sources.push(structuredClone({ bookId, citationId: id, page, assetHash, rawText, anchor }));
  }
  let aiSnapshot: AnswerSnapshot | undefined, originMessageKey: string | undefined;
  if (input.kind === 'quote') {
    if (input.citationId) await copy(input.citationId);
    else {
      const source = input.source!;
      if (source.bookId !== bookId || source.assetHash !== book.assetHash)
        throw new BridgeError('INVALID_SOURCE', '选段来源与当前书籍不符。');
      const citation = await new CitationRepository(database).save(source, 'note', source.rawText);
      await copy(citation.id);
    }
  }
  if (input.kind === 'answer') {
    originMessageKey = JSON.stringify([bookId, input.conversationId, input.messageId]);
    const message = await database.messages.get(originMessageKey);
    if (!message) throw new BridgeError('INVALID_SOURCE', '已回传回答不存在。');
    if (message.role !== 'assistant' || message.status !== 'complete' || !message.text.trim())
      throw new BridgeError('MESSAGE_NOT_COMPLETE', '只能保存已完成的 AI 回答。');
    if (message.sequence !== input.expectedSequence) throw new BridgeError('MESSAGE_CHANGED', '回答已更新，请重新查看后保存。');
    for (const id of message.citationIds) await copy(id);
    aiSnapshot = { conversationId: message.conversationId, messageId: message.messageId, sequence: message.sequence,
      text: message.text, sourceLabel: message.sourceLabel, status: 'complete' };
    if (input.questionMessageId) {
      const question = await database.messages.get(JSON.stringify([bookId, input.conversationId, input.questionMessageId]));
      if (!question || question.role !== 'user') throw new BridgeError('INVALID_SOURCE', '指定问题记录不存在。');
      aiSnapshot.questionText = question.text;
    }
  }
  const page = sources[0]?.page ?? (input.kind !== 'quote' ? input.page : undefined);
  if (!page || !asset || page < 1 || page > asset.pages) throw new BridgeError('INVALID_PAGE', '请选择这本书的有效物理页。');
  return { sources, aiSnapshot, originMessageKey, assetHash: book.assetHash, page };
}
