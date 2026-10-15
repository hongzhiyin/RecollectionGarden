import { test, expect } from '@playwright/test';
import { counts, ready, upload } from './helpers';

test('真实 IndexedDB 写入失败回滚，并可重试同一文件', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args: Parameters<typeof original>) {
      if (this.name === 'books') {
        IDBObjectStore.prototype.add = original;
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      }
      return original.apply(this, args);
    };
  });
  await upload(page, 'english.pdf');
  await expect(page.getByRole('alert')).toContainText('存储空间不足');
  expect(await counts(page)).toEqual({ books: 0, assets: 0, progress: 0 });
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  expect(await counts(page)).toEqual({ books: 1, assets: 1, progress: 0 });
});

test('两个页面同时导入不会静默产生重复书籍', async ({ page, context }) => {
  await ready(page);
  const second = await context.newPage(); await ready(second);
  await Promise.all([upload(page, 'english.pdf'), upload(second, 'english.pdf')]);
  await expect.poll(async () => (await counts(page)).books).toBe(1);
  await expect.poll(async () => (await page.getByRole('dialog').count()) + (await second.getByRole('dialog').count())).toBe(1);
  const duplicatePage = await page.getByRole('dialog').count() ? page : second;
  await duplicatePage.getByRole('button', { name: '另存一份', exact: true }).click();
  await expect(page.getByTestId('book-card')).toHaveCount(2);
  await expect(second.getByTestId('book-card')).toHaveCount(2);
  expect(await counts(page)).toEqual({ books: 2, assets: 1, progress: 0 });
});

test('取消和提交前刷新不产生半成品', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = Worker;
    window.Worker = class extends NativeWorker {
      delayed: boolean;
      constructor(url: string | URL, options?: WorkerOptions) { super(url, options); this.delayed = String(url).includes('hash.worker'); }
      postMessage(value: unknown, transfer: Transferable[] | StructuredSerializeOptions = []) {
        const send = () => Array.isArray(transfer) ? super.postMessage(value, transfer) : super.postMessage(value, transfer);
        if (this.delayed) setTimeout(send, 1500);
        else send();
      }
    };
  });
  await ready(page); await upload(page, 'english.pdf');
  await expect(page.getByText('正在识别文件', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('导入已取消');
  await page.waitForTimeout(1700);
  expect(await counts(page)).toEqual({ books: 0, assets: 0, progress: 0 });
  await upload(page, 'english.pdf');
  await expect(page.getByText('正在识别文件', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: '第一本书，从这里开始' })).toBeVisible();
  await page.waitForTimeout(1700);
  expect(await counts(page)).toEqual({ books: 0, assets: 0, progress: 0 });
});

test('进度保存失败显示真实状态，并可单独重试', async ({ page }) => {
  await ready(page); await upload(page, 'english.pdf');
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (this.name === 'progress') {
        IDBObjectStore.prototype.put = original;
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: '阅读 english', exact: true }).click();
  await expect(page.getByText('阅读位置保存失败，请重试', { exact: true })).toBeVisible();
  expect((await counts(page)).progress).toBe(0);
  await page.getByRole('button', { name: '重试保存', exact: true }).click();
  await expect(page.getByText('阅读位置已保存', { exact: true })).toBeVisible();
  expect((await counts(page)).progress).toBe(1);
});
