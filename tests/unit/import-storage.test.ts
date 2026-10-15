import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LibraryDatabase, LibraryRepository, DuplicateConflict } from '../../src/library/repository';
import type { Asset } from '../../src/library/model';

const asset: Asset = { hash: 'asset-a', file: new Blob(['test']), size: 4, pages: 2, thumbnail: '', createdAt: 1 };
let repo: LibraryRepository;
beforeEach(() => { repo = new LibraryRepository(new LibraryDatabase(`test-${crypto.randomUUID()}`)); });
afterEach(async () => { await repo.database.delete(); });

describe('文件与书籍的提交契约', () => {
  it('只在完整提交后出现书籍，新书没有阅读记录', async () => {
    const book = await repo.commit(asset, 'a.pdf', { type: 'create' }, false);
    const items = await repo.list();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: book.id, title: 'a', available: true, pages: 2 });
    expect(items[0].progress).toBeUndefined();
    expect(await repo.database.assets.count()).toBe(1);
  });

  it('未经选择的重复导入不创建额外记录', async () => {
    await repo.commit(asset, 'a.pdf', { type: 'create' }, false);
    await expect(repo.commit(asset, 'renamed.pdf', { type: 'create' }, false)).rejects.toBeInstanceOf(DuplicateConflict);
    expect(await repo.database.books.count()).toBe(1);
    expect(await repo.database.assets.count()).toBe(1);
  });

  it('副本共享资产，书籍 ID 与进度独立，副本名称不冲突', async () => {
    const first = await repo.commit(asset, 'a.pdf', { type: 'create' }, false);
    await repo.savePosition(first.id, 2);
    const copy = await repo.commit(asset, 'a.pdf', { type: 'create' }, true);
    const secondCopy = await repo.commit(asset, 'a.pdf', { type: 'create' }, true);
    expect(copy.id).not.toBe(first.id);
    expect(copy.assetHash).toBe(first.assetHash);
    expect(copy.title).not.toBe(secondCopy.title);
    expect(await repo.database.progress.get(copy.id)).toBeUndefined();
    expect((await repo.database.progress.get(first.id))?.page).toBe(2);
    expect(await repo.database.assets.count()).toBe(1);
  });

  it('同名不同字节的资产不合并', async () => {
    await repo.commit(asset, 'a.pdf', { type: 'create' }, false);
    await repo.commit({ ...asset, hash: 'different' }, 'a.pdf', { type: 'create' }, false);
    expect(await repo.database.books.count()).toBe(2);
    expect(await repo.database.assets.count()).toBe(2);
  });

  it('书籍写入失败会回滚新资产，不破坏已有数据', async () => {
    const original = await repo.commit(asset, 'a.pdf', { type: 'create' }, false);
    const fail = () => { throw new DOMException('storage quota exceeded', 'QuotaExceededError'); };
    repo.database.books.hook('creating', fail);
    await expect(repo.commit({ ...asset, hash: 'new' }, 'b.pdf', { type: 'create' }, false)).rejects.toThrow();
    repo.database.books.hook('creating').unsubscribe(fail);
    expect(await repo.database.assets.get('new')).toBeUndefined();
    expect(await repo.database.books.count()).toBe(1);
    expect((await repo.list())[0].id).toBe(original.id);
  });

  it('提交前取消不会写入数据', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(repo.commit(asset, 'a.pdf', { type: 'create' }, false, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(await repo.database.assets.count()).toBe(0);
    expect(await repo.database.books.count()).toBe(0);
  });

  it('事务中的取消回滚资产和书籍', async () => {
    const controller = new AbortController();
    repo.database.books.hook('creating', () => { controller.abort(); });
    await expect(repo.commit(asset, 'a.pdf', { type: 'create' }, false, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(await repo.database.assets.count()).toBe(0);
    expect(await repo.database.books.count()).toBe(0);
  });

  it('两个连接并发导入时只有一次未经确认的创建', async () => {
    const other = new LibraryRepository(new LibraryDatabase(repo.database.name));
    try {
      const results = await Promise.allSettled([
        repo.commit(asset, 'a.pdf', { type: 'create' }, false),
        other.commit(asset, 'a.pdf', { type: 'create' }, false),
      ]);
      expect(results.filter(item => item.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter(item => item.status === 'rejected')).toHaveLength(1);
      expect(await repo.database.books.count()).toBe(1);
      expect(await repo.database.assets.count()).toBe(1);
    } finally { other.database.close(); }
  });
});
