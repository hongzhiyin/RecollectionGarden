import { library, type LibraryDatabase } from '../library/repository';
import { MAX_QUOTE_LENGTH, intentLabels, type Citation, type CitationIntent, type QuoteSource } from './model';

export class CitationRepository {
  constructor(private database: LibraryDatabase = library.database) {}

  list(bookId: string) {
    return this.database.citations.where('bookId').equals(bookId).reverse().sortBy('createdAt');
  }

  async save(source: QuoteSource, intent: CitationIntent, editedText: string): Promise<Citation> {
    if (!source.rawText.trim() || source.rawText.length > MAX_QUOTE_LENGTH || !editedText.trim()
      || editedText.length > MAX_QUOTE_LENGTH || !(intent in intentLabels)) throw new Error('引用文本需为 1～10,000 个字符。');
    const { start, end, prefix, suffix, version } = source.anchor;
    if (version !== 1 || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0
      || end - start !== source.rawText.length || typeof prefix !== 'string' || typeof suffix !== 'string') throw new Error('原文定位信息无效。');
    return this.database.transaction('rw', this.database.books, this.database.assets, this.database.citations, async () => {
      const book = await this.database.books.get(source.bookId);
      const asset = book && await this.database.assets.get(book.assetHash);
      if (!asset || source.assetHash !== asset.hash || !Number.isInteger(source.page) || source.page < 1 || source.page > asset.pages) {
        throw new Error('引用来源无效，请重新选择原文。');
      }
      const citation: Citation = { ...structuredClone(source), intent, editedText,
        id: crypto.randomUUID(), createdAt: Date.now() };
      await this.database.citations.add(citation);
      return citation;
    });
  }
}

export const citations = new CitationRepository();
