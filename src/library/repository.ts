import Dexie, { type Table } from 'dexie';
import { assertActive, type Asset, type Book, type BookView, type ImportChoice, type Progress, type ReaderLocation } from './model';
import { LibraryError } from './errors';
import type { Citation } from '../citations/model';
import type { CompletedRequest, ExternalMessage } from '../external/models';
import type { Note } from '../notes/model';

export class DuplicateConflict extends Error {
  constructor(public books: Book[]) { super('duplicate'); }
}

export class LibraryDatabase extends Dexie {
  assets!: Table<Asset, string>;
  books!: Table<Book, string>;
  progress!: Table<Progress, string>;
  citations!: Table<Citation, string>;
  messages!: Table<ExternalMessage, string>;
  requests!: Table<CompletedRequest, string>;
  notes!: Table<Note, string>;

  constructor(name = 'RecollectionGarden') {
    super(name);
    this.version(1).stores({ assets: '&hash', books: '&id,assetHash,updatedAt', progress: '&bookId' });
    this.version(2).stores({ citations: '&id,bookId,createdAt' });
    this.version(3).stores({ messages: '&id,bookId,[bookId+conversationId]', requests: '&id,createdAt' });
    this.version(4).stores({ notes: '&id,bookId,[bookId+updatedAt],&originMessageKey' });
  }
}

export class LibraryRepository {
  constructor(public database = new LibraryDatabase()) {}

  async list(): Promise<BookView[]> {
    return this.database.transaction('r', this.database.books, this.database.assets, this.database.progress, async () => {
      const books = await this.database.books.toArray();
      return Promise.all(books.map(async book => {
        const asset = await this.database.assets.get(book.assetHash);
        const progress = await this.database.progress.get(book.id);
        return { ...book, available: !!asset, pages: asset?.pages ?? 0, size: asset?.size ?? 0,
          thumbnail: asset?.thumbnail ?? '', progress };
      })).then(items => items.sort((a, b) => (b.progress?.lastReadAt ?? b.createdAt) - (a.progress?.lastReadAt ?? a.createdAt)));
    });
  }

  async lookup(hash: string) {
    return this.database.transaction('r', this.database.assets, this.database.books, async () => ({
      asset: await this.database.assets.get(hash),
      books: await this.database.books.where('assetHash').equals(hash).toArray(),
    }));
  }

  async commit(asset: Asset, fileName: string, choice: ImportChoice, duplicateConfirmed: boolean,
    signal?: AbortSignal): Promise<Book> {
    assertActive(signal);
    return this.database.transaction('rw', this.database.assets, this.database.books, async () => {
      assertActive(signal);
      const existing = await this.database.books.where('assetHash').equals(asset.hash).toArray();
      if (choice.type === 'open') {
        const book = existing.find(item => item.id === choice.bookId);
        if (!book) throw new LibraryError('MISSING_BOOK', '所选书籍已不存在，请重新选择。');
        if (!await this.database.assets.get(asset.hash)) await this.database.assets.add(asset);
        assertActive(signal);
        return book;
      }
      if (existing.length && !duplicateConfirmed) throw new DuplicateConflict(existing);
      if (!await this.database.assets.get(asset.hash)) await this.database.assets.add(asset);
      assertActive(signal);
      const now = Date.now();
      const base = fileName.replace(/\.pdf$/i, '') || '未命名书籍';
      let title = base;
      if (existing.length) {
        title = `${base}（副本）`;
        let number = 2;
        while (existing.some(book => book.title === title)) title = `${base}（副本 ${number++}）`;
      }
      const book: Book = { id: crypto.randomUUID(), assetHash: asset.hash, title, fileName,
        createdAt: now, updatedAt: now };
      await this.database.books.add(book);
      assertActive(signal);
      return book;
    });
  }

  async rename(id: string, title: string) {
    const value = title.trim();
    if (!value || value.length > 120) throw new LibraryError('INVALID_TITLE', '书名需为 1～120 个字符。');
    const updated = await this.database.books.update(id, { title: value, updatedAt: Date.now() });
    if (!updated) throw new LibraryError('MISSING_BOOK', '书籍已不存在。');
  }

  async readAsset(bookId: string) {
    const book = await this.database.books.get(bookId);
    const asset = book && await this.database.assets.get(book.assetHash);
    if (!asset) throw new LibraryError('MISSING_FILE', '文件暂不可用，请重新导入原 PDF。');
    return asset;
  }

  async savePosition(bookId: string, page: number, view?: Omit<ReaderLocation, 'page'>) {
    await this.database.transaction('rw', this.database.books, this.database.assets, this.database.progress, async () => {
      const book = await this.database.books.get(bookId);
      const asset = book && await this.database.assets.get(book.assetHash);
      if (!asset || !Number.isInteger(page) || page < 1 || page > asset.pages) throw new LibraryError('INVALID_PAGE', '阅读位置无效。');
      const previous = await this.database.progress.get(bookId);
      if (view && (!Number.isFinite(view.offsetX) || view.offsetX < 0 || view.offsetX > 1
        || !Number.isFinite(view.offsetY) || view.offsetY < 0 || view.offsetY > 1
        || !(view.zoom?.mode === 'fit-width' || (view.zoom?.mode === 'percent'
          && Number.isFinite(view.zoom.percent) && view.zoom.percent >= 25 && view.zoom.percent <= 300)))) {
        throw new LibraryError('INVALID_POSITION', '阅读设置无效。');
      }
      const preferences = view ?? { zoom: previous?.zoom ?? { mode: 'fit-width' as const },
        offsetX: previous?.page === page ? previous.offsetX ?? 0 : 0,
        offsetY: previous?.page === page ? previous.offsetY ?? 0 : 0 };
      await this.database.progress.put({ bookId, page, ...preferences,
        status: previous?.status ?? 'reading', lastReadAt: Date.now() });
    });
  }
}

export const library = new LibraryRepository();
