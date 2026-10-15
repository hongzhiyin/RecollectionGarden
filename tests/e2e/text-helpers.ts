import { expect, type Page } from '@playwright/test';

export async function textReady(page: Page) {
  await expect(page.locator('.textLayer')).toBeVisible();
  await expect.poll(() => page.locator('.textLayer span').count()).toBeGreaterThan(0);
}

export async function selectText(page: Page, first: string, last = first, reverse = false) {
  await textReady(page);
  await expect.poll(async () => {
    const selected = await page.locator('.textLayer').evaluate((root, args) => {
    const spans = Array.from(root.querySelectorAll('span'));
    const start = spans.find(node => node.textContent === args.first)?.firstChild;
    const end = spans.find(node => node.textContent === args.last)?.firstChild;
    if (!start || !end) return false;
    const selection = window.getSelection()!;
    if (args.reverse) selection.setBaseAndExtent(end, end.textContent!.length, start, 0);
    else selection.setBaseAndExtent(start, 0, end, end.textContent!.length);
    return true;
    }, { first, last, reverse });
    if (!selected) return false;
    try { await expect(page.getByLabel('选中原文', { exact: true })).toContainText(first, { timeout: 500 }); return true; }
    catch { return false; }
  }).toBe(true);
  await expect(page.getByLabel('选中原文', { exact: true })).toContainText(first);
}

export async function storedCitations(page: Page) {
  return page.evaluate(() => new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const open = indexedDB.open('RecollectionGarden'); open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result; const tx = db.transaction('citations', 'readonly');
      const read = tx.objectStore('citations').getAll(); read.onsuccess = () => resolve(read.result);
      tx.oncomplete = () => db.close(); tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
}
