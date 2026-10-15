import { test, expect } from '@playwright/test';
import { counts, ready, upload } from './helpers';

test('真实英文、中文及图像 PDF 导入并显示首页面', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await page.screenshot({ path: 'test-results/empty-library.png' });
  await upload(page, 'english.pdf', 'Reading Notes.pdf');
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  await upload(page, 'chinese.pdf', '流光忆庭.pdf');
  await expect(page.getByTestId('book-card')).toHaveCount(2);
  await upload(page, 'scan.pdf', '图像书页.pdf');
  await expect(page.getByTestId('book-card')).toHaveCount(3);
  const images = page.getByTestId('book-card').locator('img');
  await expect(images).toHaveCount(3);
  expect(await images.evaluateAll(nodes => nodes.every(node => (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await images.evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().bottom <= node.parentElement!.getBoundingClientRect().bottom - 10))).toBe(true);
  await page.getByRole('button', { name: '关闭提示' }).click();
  await page.screenshot({ path: 'test-results/bookshelf.png' });
  await page.getByRole('button', { name: '阅读 流光忆庭', exact: true }).click();
  await expect(page.getByText('阅读位置已保存', { exact: true })).toBeVisible();
  await expect(page.getByTestId('page-indicator')).toContainText('第 1 / 2 页');
  const ink = await page.locator('.reader-surface canvas').evaluate(canvas => {
    const element = canvas as HTMLCanvasElement;
    const pixels = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data;
    let count = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 200 && pixels[i + 3]) count++;
    return count;
  });
  expect(ink).toBeGreaterThan(100);
  await page.screenshot({ path: 'test-results/reader.png' });
  expect(errors).toEqual([]);
});

test('改名、阅读位置和文件在刷新与新页面中恢复', async ({ page, context }) => {
  await ready(page); await upload(page, 'english.pdf');
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  await page.getByRole('button', { name: '重命名 english', exact: true }).click();
  await page.getByLabel('书名').fill('我的阅读记录');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('heading', { name: '我的阅读记录', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '阅读 我的阅读记录', exact: true }).click();
  await expect(page.getByText('阅读位置已保存', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.getByTestId('page-indicator')).toContainText('第 2 / 3 页');
  await expect(page.getByText('阅读位置已保存', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.reload();
  await expect(page.getByTestId('book-card')).toContainText('第 2 / 3 页');
  const reopened = await context.newPage(); await reopened.goto('/');
  await reopened.getByRole('button', { name: '阅读 我的阅读记录', exact: true }).click();
  await expect(reopened.getByText('阅读位置已保存', { exact: true })).toBeVisible();
  await expect(reopened.getByTestId('page-indicator')).toContainText('第 2 / 3 页');
  expect(await counts(reopened)).toEqual({ books: 1, assets: 1, progress: 1 });
});

test('改名后的同字节文件提示重复，副本独立但资产复用', async ({ page }) => {
  await ready(page); await upload(page, 'english.pdf');
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  await upload(page, 'english.pdf', 'renamed.pdf');
  await expect(page.getByRole('dialog', { name: '这本 PDF 已在书架中' })).toBeVisible();
  await page.getByRole('button', { name: '另存一份', exact: true }).click();
  await expect(page.getByTestId('book-card')).toHaveCount(2);
  expect(await counts(page)).toEqual({ books: 2, assets: 1, progress: 0 });
  await upload(page, 'english.pdf');
  await page.getByRole('button', { name: /english.*打开已有/ }).click();
  await expect(page.getByText('阅读位置已保存', { exact: true })).toBeVisible();
  expect(await counts(page)).toEqual({ books: 2, assets: 1, progress: 1 });
});

test('同名不同内容的 PDF 各自保存', async ({ page }) => {
  await ready(page); await upload(page, 'english.pdf', 'book.pdf');
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  await upload(page, 'chinese.pdf', 'book.pdf');
  await expect(page.getByTestId('book-card')).toHaveCount(2);
  expect(await counts(page)).toEqual({ books: 2, assets: 2, progress: 0 });
});

test('损坏、密码、空文件和超限文件均不产生就绪记录', async ({ page }) => {
  await ready(page);
  await upload(page, 'corrupt.pdf'); await expect(page.getByRole('alert')).toContainText('损坏');
  await upload(page, 'password.pdf'); await expect(page.getByRole('alert')).toContainText('密码');
  await page.getByTestId('pdf-input').setInputFiles({ name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) });
  await expect(page.getByRole('alert')).toContainText('文件为空');
  await page.getByTestId('pdf-input').setInputFiles({ name: 'large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(33 * 1024 * 1024) });
  await expect(page.getByRole('alert')).toContainText('32 MiB');
  await expect(page.getByTestId('book-card')).toHaveCount(0);
  expect(await counts(page)).toEqual({ books: 0, assets: 0, progress: 0 });
});

test('窄屏无横向溢出，搜索和键盘取消改名可使用', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page); await upload(page, 'english.pdf');
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  await page.getByLabel('搜索书籍').fill('absent');
  await expect(page.getByRole('heading', { name: '没有找到这本书' })).toBeVisible();
  await page.getByLabel('搜索书籍').fill('');
  await page.getByRole('button', { name: '重命名 english', exact: true }).click();
  await expect(page.getByLabel('书名')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重命名 english', exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-library.png' });
});
