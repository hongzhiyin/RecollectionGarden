import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LibraryDatabase, LibraryRepository } from '../../src/library/repository';
import type { Asset, Book } from '../../src/library/model';

const asset: Asset = { hash: 'asset', file: new Blob(['test']), size: 4, pages: 3, thumbnail: '', createdAt: 1 };
let repo: LibraryRepository;
let book: Book;
beforeEach(async () => {
  repo = new LibraryRepository(new LibraryDatabase(`reading-${crypto.randomUUID()}`));
  book = await repo.commit(asset, 'original.pdf', { type: 'create' }, false);
});
afterEach(async () => { await repo.database.delete(); });

describe('书架恢复与进度隔离', () => {
  it('改名保留身份、源文件和阅读记录', async () => {
    await repo.savePosition(book.id, 2);
    const position = await repo.database.progress.get(book.id);
    await repo.rename(book.id, '  新书名  ');
    expect((await repo.list())[0]).toMatchObject({ id: book.id, assetHash: book.assetHash, fileName: 'original.pdf', title: '新书名', progress: position });
  });

  it('空名称或超长名称被拒绝，原记录不变', async () => {
    await expect(repo.rename(book.id, '   ')).rejects.toThrow();
    await expect(repo.rename(book.id, 'x'.repeat(121))).rejects.toThrow();
    expect((await repo.list())[0].title).toBe('original');
  });

  it('数据库关闭重开保留文件、书籍和进度', async () => {
    await repo.savePosition(book.id, 3);
    repo.database.close();
    await repo.database.open();
    expect((await repo.list())[0]).toMatchObject({ id: book.id, progress: { page: 3 } });
    expect(await (await repo.readAsset(book.id)).file.text()).toBe('test');
  });

  it('越界进度被拒绝，已保存位置不被覆盖', async () => {
    await repo.savePosition(book.id, 2);
    await expect(repo.savePosition(book.id, 0)).rejects.toThrow();
    await expect(repo.savePosition(book.id, 4)).rejects.toThrow();
    await expect(repo.savePosition(book.id, 1.5)).rejects.toThrow();
    await expect(repo.savePosition(book.id, Number.NaN)).rejects.toThrow();
    expect((await repo.database.progress.get(book.id))?.page).toBe(2);
  });

  it('重新导入缺失的原文件恢复同一书籍，不改进度', async () => {
    await repo.savePosition(book.id, 2);
    const position = await repo.database.progress.get(book.id);
    await repo.database.assets.delete(asset.hash);
    expect((await repo.list())[0].available).toBe(false);
    await expect(repo.readAsset(book.id)).rejects.toThrow();
    const recovered = await repo.commit(asset, 'renamed.pdf', { type: 'open', bookId: book.id }, true);
    expect(recovered.id).toBe(book.id);
    expect((await repo.list())[0].available).toBe(true);
    expect(await repo.database.books.count()).toBe(1);
    expect(await repo.database.progress.get(book.id)).toEqual(position);
  });

  it('缩放与相对位置持久化，旧调用保持兼容', async () => {
    await repo.savePosition(book.id, 2, { zoom: { mode: 'percent', percent: 150 }, offsetX: 0.2, offsetY: 0.6 });
    repo.database.close(); await repo.database.open();
    expect(await repo.database.progress.get(book.id)).toMatchObject({ page: 2, offsetX: 0.2, offsetY: 0.6, zoom: { percent: 150 } });
    await repo.savePosition(book.id, 3);
    expect(await repo.database.progress.get(book.id)).toMatchObject({ page: 3, offsetX: 0, offsetY: 0, zoom: { percent: 150 } });
  });

  it('无效缩放或相对位置不会覆盖已保存记录', async () => {
    await repo.savePosition(book.id, 2);
    const original = await repo.database.progress.get(book.id);
    await expect(repo.savePosition(book.id, 3, { zoom: { mode: 'percent', percent: 0 }, offsetX: 0, offsetY: 0 })).rejects.toThrow();
    await expect(repo.savePosition(book.id, 3, { zoom: { mode: 'fit-width' }, offsetX: 0, offsetY: Number.NaN })).rejects.toThrow();
    expect(await repo.database.progress.get(book.id)).toEqual(original);
  });
});
