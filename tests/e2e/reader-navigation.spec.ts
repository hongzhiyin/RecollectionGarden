import { test, expect } from '@playwright/test';
import { jump, openReader, saved, storedProgress } from './reader-helpers';

test('内置目录支持层级、具名目标和物理页，书内标签单独显示', async ({ page }) => {
  await openReader(page);
  await expect(page.getByText('书内页码：i', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '展开 Chapter One', exact: true }).click();
  await page.getByRole('button', { name: 'First section', exact: true }).click();
  await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 2 / 3 页'); await saved(page);
  await expect(page.getByText('书内页码：ii', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chapter Two', exact: true }).click();
  await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 3 / 3 页'); await saved(page);
  await expect(page.getByText('书内页码：1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Named Section', exact: true }).click();
  await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 2 / 3 页'); await saved(page);
  await page.screenshot({ path: 'test-results/reader-navigation.png' });
});

test('错误目录和外部链接不改变阅读位置或离开应用', async ({ page, context }) => {
  await openReader(page); await jump(page, '2'); await saved(page);
  await page.getByRole('button', { name: 'Broken target', exact: true }).click();
  await expect(page.getByText('目录目标无法定位，阅读位置未改变。')).toBeVisible();
  await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 2 / 3 页');
  await expect(page.getByText('External link（外部链接）', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'External link', exact: true })).toHaveCount(0);
  expect(context.pages()).toHaveLength(1); expect((await storedProgress(page)).page).toBe(2);
});

test('页码跳转校验整数和边界，非法输入不覆盖已保存位置', async ({ page }) => {
  await openReader(page); await jump(page, '3'); await saved(page);
  await expect(page.getByRole('button', { name: '下一页', exact: true })).toBeDisabled();
  for (const invalid of ['', '0', '4', '-1', '1.5', 'abc', '1e0']) {
    await jump(page, invalid);
    await expect(page.getByRole('alert')).toHaveText('请输入 1～3 的整数页码。');
    await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 3 / 3 页');
  }
  expect((await storedProgress(page)).page).toBe(3);
  await jump(page, '1'); await saved(page);
  await expect(page.getByRole('button', { name: '上一页', exact: true })).toBeDisabled();
});

test('没有内置目录的 PDF 保留完整页码导航', async ({ page }) => {
  await openReader(page, 'english.pdf');
  await expect(page.getByText('此 PDF 没有内置目录，可使用页码导航。')).toBeVisible();
  await page.getByRole('button', { name: '收起目录', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'PDF 目录' })).toHaveCount(0);
  await jump(page, '2'); await saved(page);
  await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 2 / 3 页');
});

test('比例缩放改变页面尺寸，适应宽度随视口变化且限制 Canvas 分配', async ({ page }) => {
  await openReader(page);
  await page.getByLabel('缩放', { exact: true }).selectOption('100'); await saved(page);
  const canvas = page.locator('.reader-surface canvas');
  const width = await canvas.evaluate(element => element.getBoundingClientRect().width);
  await page.getByLabel('缩放', { exact: true }).selectOption('300'); await saved(page);
  expect(await canvas.evaluate(element => element.getBoundingClientRect().width)).toBeCloseTo(width * 3, 0);
  expect(await canvas.evaluate(element => (element as HTMLCanvasElement).width * (element as HTMLCanvasElement).height)).toBeLessThanOrEqual(8_000_000);
  await expect(page.getByRole('button', { name: '放大', exact: true })).toBeDisabled();
  await page.getByLabel('缩放', { exact: true }).selectOption('25'); await saved(page);
  await expect(page.getByRole('button', { name: '缩小', exact: true })).toBeDisabled();
  await page.getByLabel('缩放', { exact: true }).selectOption('fit-width'); await saved(page);
  await page.setViewportSize({ width: 1000, height: 760 });
  await expect.poll(() => page.locator('.reader-viewport').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await saved(page);
  await page.getByRole('button', { name: '放大', exact: true }).click(); await saved(page);
  expect((await storedProgress(page)).zoom?.mode).toBe('percent');
});

test('窄屏阅读工具栏可操作，目录覆盖区域随工具栏高度定位', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await openReader(page);
  const panel = await page.locator('.outline-panel').boundingBox();
  const toolbar = await page.locator('.reader-controls').boundingBox();
  expect(panel!.y).toBeCloseTo(toolbar!.y + toolbar!.height, 0);
  await page.getByRole('button', { name: '收起目录', exact: true }).click(); await saved(page);
  await jump(page, '2'); await saved(page);
  await page.getByLabel('缩放', { exact: true }).selectOption('150'); await saved(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-reader.png' });
});
