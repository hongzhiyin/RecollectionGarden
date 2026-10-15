import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

export async function upload(page: Page, fixture: string, name?: string) {
  const buffer = await readFile(`tests/fixtures/${fixture}`);
  await page.getByTestId('pdf-input').setInputFiles({ name: name ?? fixture, mimeType: 'application/pdf', buffer });
}

export async function counts(page: Page) {
  return page.evaluate(() => new Promise<{ assets: number; books: number; progress: number }>((resolve, reject) => {
    const open = indexedDB.open('RecollectionGarden');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['assets', 'books', 'progress'], 'readonly');
      const result = { assets: 0, books: 0, progress: 0 };
      for (const key of ['assets', 'books', 'progress'] as const) {
        const request = tx.objectStore(key).count(); request.onsuccess = () => { result[key] = request.result; };
      }
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
}

export async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '第一本书，从这里开始' })).toBeVisible();
}
