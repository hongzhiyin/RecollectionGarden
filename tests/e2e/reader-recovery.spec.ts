import { test, expect } from '@playwright/test';
import { jump, offsets, openReader, saved, storedProgress } from './reader-helpers';

test('关闭和刷新后恢复物理页、缩放以及双轴页内位置，调整视口仍保留相对位置', async ({ page }) => {
  await openReader(page); await jump(page, '2'); await saved(page);
  await page.getByLabel('缩放', { exact: true }).selectOption('300'); await saved(page);
  await page.locator('.reader-viewport').evaluate(element => {
    element.scrollLeft = (element.scrollWidth - element.clientWidth) * .6;
    element.scrollTop = (element.scrollHeight - element.clientHeight) * .7;
  });
  await expect.poll(async () => (await storedProgress(page)).offsetY).toBeGreaterThan(.69);
  await saved(page); const before = await offsets(page);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await page.reload();
  await page.getByRole('button', { name: '阅读 outline-targets', exact: true }).click(); await saved(page);
  await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 2 / 3 页');
  await expect(page.getByLabel('缩放', { exact: true })).toHaveValue('300');
  const restored = await offsets(page);
  expect(restored.x).toBeCloseTo(before.x, 2); expect(restored.y).toBeCloseTo(before.y, 2);
  await page.setViewportSize({ width: 980, height: 740 });
  await expect.poll(async () => Math.abs((await offsets(page)).x - before.x)).toBeLessThan(.005);
  await saved(page);
  const resized = await offsets(page);
  expect(resized.x).toBeCloseTo(before.x, 2); expect(resized.y).toBeCloseTo(before.y, 2);
});

test('连续切页和缩放只持久化最终完成显示的位置', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await openReader(page);
  await jump(page, '2'); await jump(page, '3');
  await page.getByLabel('缩放', { exact: true }).selectOption('300');
  await page.getByLabel('缩放', { exact: true }).selectOption('150');
  await saved(page);
  expect((await storedProgress(page)).page).toBe(3);
  expect((await storedProgress(page)).zoom).toEqual({ mode: 'percent', percent: 150 });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '阅读 outline-targets', exact: true }).click(); await saved(page);
  await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 3 / 3 页');
  await expect(page.getByLabel('缩放', { exact: true })).toHaveValue('150'); expect(errors).toEqual([]);
});

test('后续页面渲染失败保留最后成功位置，重试成功后才更新', async ({ page }) => {
  await openReader(page);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (this.closest('.reader-surface')) {
        HTMLCanvasElement.prototype.getContext = original;
        throw new Error('injected render failure');
      }
      return original.apply(this, args);
    } as typeof original;
  });
  await jump(page, '2');
  await expect(page.getByRole('alert')).toContainText('页面显示失败');
  expect((await storedProgress(page)).page).toBe(1);
  await page.getByRole('button', { name: '重试页面', exact: true }).click(); await saved(page);
  expect((await storedProgress(page)).page).toBe(2);
});

test('旧版只有页码的记录恢复为适应宽度，不删除文件或书籍', async ({ page }) => {
  await openReader(page); await jump(page, '2'); await saved(page);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('RecollectionGarden'); open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result; const tx = db.transaction('progress', 'readwrite');
      const store = tx.objectStore('progress'); const read = store.getAll();
      read.onsuccess = () => {
        const record = read.result[0]; delete record.zoom; delete record.offsetX; delete record.offsetY;
        store.put(record);
      };
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
  await page.reload(); await page.getByRole('button', { name: '阅读 outline-targets', exact: true }).click(); await saved(page);
  await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 2 / 3 页');
  await expect(page.getByLabel('缩放', { exact: true })).toHaveValue('fit-width');
  expect(await offsets(page)).toEqual({ x: 0, y: 0 });
});

test('持续保存失败时关闭保留阅读器，明确关闭后恢复上次成功位置', async ({ page }) => {
  await openReader(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (this.name === 'progress') throw new DOMException('quota exceeded', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await jump(page, '2');
  await expect(page.getByText('阅读位置保存失败，请重试', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('位置未保存，关闭后会恢复最后成功保存的位置。')).toBeVisible();
  expect((await storedProgress(page)).page).toBe(1);
  await page.getByRole('button', { name: '仍然关闭', exact: true }).click();
  await page.reload(); await page.getByRole('button', { name: '阅读 outline-targets', exact: true }).click(); await saved(page);
  await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 1 / 3 页');
});
