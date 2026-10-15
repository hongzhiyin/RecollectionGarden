import { test, expect } from '@playwright/test';
import { jump, openReader, saved, previewReady } from './reader-helpers';
import { selectText, storedCitations, textReady } from './text-helpers';

test('文本提取失败不阻止原版阅读，重试可恢复选择', async ({ page }) => {
  await openReader(page, 'text-navigation.pdf'); await textReady(page);
  await page.evaluate(() => {
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message: { action?: string }, options?: StructuredSerializeOptions | Transferable[]) {
      if (message.action === 'GetTextContent') {
        Worker.prototype.postMessage = original; throw new Error('injected text extraction failure');
      }
      return original.call(this, message, Array.isArray(options) ? { transfer: options } : options);
    };
  });
  await jump(page, '2'); await saved(page);
  await expect(page.getByText('文本提取失败，页面仍可阅读。')).toBeVisible();
  await expect(page.locator('.reader-surface canvas')).toHaveCSS('opacity', '1');
  const geometry = () => page.locator('.reader-viewport').evaluate(element => ({
    height: element.scrollHeight, width: element.scrollWidth, top: element.scrollTop, left: element.scrollLeft,
  }));
  const before = await geometry();
  await page.getByText('查看文本错误详情', { exact: true }).click();
  expect(await geometry()).toEqual(before);
  await page.getByRole('button', { name: '重试文本', exact: true }).click(); await textReady(page);
  expect(await geometry()).toEqual(before);
  await selectText(page, 'Same phrase');
  await expect(page.getByLabel('选中原文', { exact: true })).toHaveText('Same phrase');
});

test('引用写入失败保留草稿和原文，重试成功后只存一份', async ({ page }) => {
  await openReader(page, 'text-navigation.pdf'); await selectText(page, 'Across lines we keep the original source.');
  await page.getByLabel('编辑文本', { exact: true }).fill('Keep this edited question');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args: Parameters<typeof original>) {
      if (this.name === 'citations') {
        IDBObjectStore.prototype.add = original; throw new DOMException('quota', 'QuotaExceededError');
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: '保存引用草稿', exact: true }).click();
  await expect(page.getByText('引用保存失败，请重试；当前草稿已保留。')).toBeVisible();
  await expect(page.getByLabel('编辑文本', { exact: true })).toHaveValue('Keep this edited question');
  expect(await storedCitations(page)).toHaveLength(0);
  await page.getByRole('button', { name: '保存引用草稿', exact: true }).click();
  await expect(page.getByTestId('citation-card')).toHaveCount(1);
  expect(await storedCitations(page)).toHaveLength(1);
});

test('重复原文的字符位置失效时只回来源页，不猜测高亮', async ({ page }) => {
  await openReader(page, 'text-navigation.pdf'); await jump(page, '2'); await saved(page);
  await selectText(page, 'Same phrase');
  await page.getByRole('button', { name: '保存引用草稿', exact: true }).click();
  await expect(page.getByTestId('citation-card')).toHaveCount(1);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('RecollectionGarden'); open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result; const tx = db.transaction('citations', 'readwrite');
      const store = tx.objectStore('citations'); const read = store.getAll();
      read.onsuccess = () => {
        const record = read.result[0]; record.anchor.start = 9999; record.anchor.end = 9999 + record.rawText.length;
        store.put(record);
      };
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
  await page.reload(); await page.getByRole('button', { name: '阅读 text-navigation', exact: true }).click(); await saved(page);
  await jump(page, '1'); await saved(page);
  await page.getByRole('button', { name: '引用 1', exact: true }).click();
  await page.getByRole('button', { name: '定位原文', exact: true }).click();
  await expect(page.getByText('已回到来源页，精确定位不可用，未显示高亮。', { exact: true })).toBeVisible();
  await previewReady(page); await textReady(page);
  await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 2 / 3 页');
  await expect(page.locator('.citation-highlights span')).toHaveCount(0);
});

test('窄屏选段草稿可编辑保存，引用列表和定位可使用', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await openReader(page, 'text-navigation.pdf');
  await page.getByRole('button', { name: '收起目录', exact: true }).click();
  await selectText(page, 'Across lines we keep the original source.');
  await page.getByLabel('编辑文本', { exact: true }).fill('Mobile quote');
  await page.getByRole('button', { name: '保存引用草稿', exact: true }).click();
  await expect(page.getByTestId('citation-card')).toHaveCount(1);
  await page.getByRole('button', { name: '定位原文', exact: true }).click();
  await expect(page.getByText('已定位原文', { exact: true })).toBeVisible(); await previewReady(page); await textReady(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-text-location.png' });
});
