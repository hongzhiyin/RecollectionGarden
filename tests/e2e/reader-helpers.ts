import { expect, type Page } from '@playwright/test';
import { ready, upload } from './helpers';
import type { Progress } from '../../src/library/model';

export async function openReader(page: Page, fixture = 'outline-targets.pdf') {
  await ready(page); await upload(page, fixture);
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  await page.getByRole('button', { name: '阅读 ' + fixture.replace('.pdf', ''), exact: true }).click();
  await saved(page);
}

export async function saved(page: Page) {
  await expect(page.getByText('阅读位置已保存', { exact: true })).toBeVisible();
  await expect(page.locator('.reader-surface canvas')).toHaveCSS('opacity', '1');
}

export async function previewReady(page: Page) {
  await expect(page.getByText('临时查看原文', { exact: true })).toBeVisible();
  await expect(page.locator('.reader-surface canvas')).toHaveCSS('opacity', '1');
}

export async function jump(page: Page, target: string) {
  await page.getByLabel('跳转到 PDF 页').fill(target);
  await page.getByRole('button', { name: '跳转', exact: true }).click();
}

export async function storedProgress(page: Page): Promise<Progress> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('RecollectionGarden');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('progress', 'readonly');
      const request = tx.objectStore('progress').getAll();
      request.onsuccess = () => resolve(request.result[0]);
      tx.oncomplete = () => db.close();
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
}

export async function offsets(page: Page) {
  return page.locator('.reader-viewport').evaluate(element => ({
    x: element.scrollLeft / Math.max(1, element.scrollWidth - element.clientWidth),
    y: element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight),
  }));
}
