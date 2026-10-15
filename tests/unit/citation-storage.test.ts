import Dexie from 'dexie';
import { beforeEach, afterEach, expect, it } from 'vitest';
import { LibraryDatabase, LibraryRepository } from '../../src/library/repository';
import { CitationRepository } from '../../src/citations/repository';
import { createAnchor } from '../../src/citations/anchors';
import type { QuoteSource } from '../../src/citations/model';

let database: LibraryDatabase;
let library: LibraryRepository;
let citations: CitationRepository;
let source: QuoteSource;
beforeEach(async () => {
  database = new LibraryDatabase('citations-' + crypto.randomUUID());
  library = new LibraryRepository(database); citations = new CitationRepository(database);
  const book = await library.commit({ hash: 'asset', file: new Blob(['pdf']), pages: 3, size: 3, thumbnail: '', createdAt: 0 }, 'book.pdf', { type: 'create' }, false);
  source = { bookId: book.id, assetHash: 'asset', page: 2, rawText: 'raw\nsource', anchor: createAnchor('raw\nsource', 0, 10) };
});
afterEach(async () => { await database.delete(); });

it('编辑和意图独立保存，原文及锚点完整保留', async () => {
  const item = await citations.save(source, 'question', 'An edited question');
  source.rawText = 'changed later';
  expect((await citations.list(item.bookId))[0]).toMatchObject({ rawText: 'raw\nsource', editedText: 'An edited question', intent: 'question', page: 2 });
});
it('错误书籍、文件、页码、锚点及超限内容不保存', async () => {
  for (const invalid of [{ ...source, bookId: 'missing' }, { ...source, assetHash: 'other' }, { ...source, page: 4 },
    { ...source, anchor: { ...source.anchor, end: 0 } }, { ...source, rawText: 'x'.repeat(10001) }]) {
    await expect(citations.save(invalid, 'quote', 'text')).rejects.toThrow();
  }
  expect(await database.citations.count()).toBe(0);
});
it('同一资产的副本引用独立', async () => {
  await citations.save(source, 'note', 'note');
  const asset = await library.readAsset(source.bookId);
  const copy = await library.commit(asset, 'book.pdf', { type: 'create' }, true);
  expect(await citations.list(copy.id)).toHaveLength(0);
});
it('引用写入失败不产生部分记录，重试可保存', async () => {
  const fail = () => { throw new DOMException('quota', 'QuotaExceededError'); };
  database.citations.hook('creating', fail);
  await expect(citations.save(source, 'quote', 'text')).rejects.toThrow();
  expect(await database.citations.count()).toBe(0);
  database.citations.hook('creating').unsubscribe(fail);
  await citations.save(source, 'quote', 'text'); expect(await database.citations.count()).toBe(1);
});
it('数据库从版本 1 升级时保留原文件、书籍和阅读进度', async () => {
  const name = 'legacy-' + crypto.randomUUID(); const old = new Dexie(name);
  old.version(1).stores({ assets: '&hash', books: '&id,assetHash,updatedAt', progress: '&bookId' });
  const asset = await library.readAsset(source.bookId); const book = await database.books.get(source.bookId);
  await old.table('assets').add(asset); await old.table('books').add(book);
  await old.table('progress').add({ bookId: source.bookId, page: 2, status: 'reading', lastReadAt: 1 }); old.close();
  const upgraded = new LibraryDatabase(name);
  try {
    expect((await upgraded.assets.get('asset'))?.file.size).toBe(3);
    expect(await upgraded.books.count()).toBe(1);
    expect((await upgraded.progress.get(source.bookId))?.page).toBe(2);
    expect(await upgraded.citations.count()).toBe(0);
  } finally { await upgraded.delete(); }
});
