import { test, expect } from '@playwright/test';
import { jump, openReader, saved, previewReady } from './reader-helpers';
import { selectText, storedCitations, textReady } from './text-helpers';

const first = 'Across lines we keep the original source.';
const second = 'Edited questions never replace the original text.';

test('同页反向跨行选取、复制和编辑草稿保留独立原文', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openReader(page, 'text-navigation.pdf'); await selectText(page, first, second, true);
  await expect(page.getByLabel('选中原文', { exact: true })).toHaveText(first + '\n' + second);
  await expect(page.getByLabel('编辑文本', { exact: true })).toHaveValue(first + ' ' + second);
  await page.getByRole('button', { name: '复制原文', exact: true }).click();
  await expect(page.getByText('原文已复制', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(first + '\n' + second);
  await page.getByRole('button', { name: '提问', exact: true }).click();
  await page.getByLabel('编辑文本', { exact: true }).fill('What does this passage mean?');
  await page.getByRole('button', { name: '保存引用草稿', exact: true }).click();
  await expect(page.getByTestId('citation-card')).toHaveCount(1);
  expect((await storedCitations(page))[0]).toMatchObject({ rawText: first + '\n' + second,
    editedText: 'What does this passage mean?', intent: 'question', page: 1 });
});

test('鼠标选取与取消不跳页，四种动作生成草稿', async ({ page }) => {
  await openReader(page, 'text-navigation.pdf'); await textReady(page);
  const bounds = await page.locator('.textLayer span').filter({ hasText: first }).boundingBox();
  await page.mouse.move(bounds!.x + 1, bounds!.y + bounds!.height / 2);
  await page.mouse.down(); await page.mouse.move(bounds!.x + bounds!.width - 1, bounds!.y + bounds!.height / 2, { steps: 10 }); await page.mouse.up();
  await expect(page.getByLabel('选中原文', { exact: true })).toContainText('Across lines');
  for (const name of ['解释这段', '举个例子', '提问', '记笔记']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await page.getByRole('button', { name: '取消选择', exact: true }).click();
  await expect(page.getByLabel('选中原文', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 1 / 3 页');
});

test('引用跨页回跳和重开恢复，高亮随缩放重新计算', async ({ page }) => {
  await openReader(page, 'text-navigation.pdf'); await selectText(page, first, second);
  await page.getByRole('button', { name: '保存引用草稿', exact: true }).click();
  await expect(page.getByTestId('citation-card')).toHaveCount(1);
  await jump(page, '2'); await saved(page);
  await page.getByRole('button', { name: '定位原文', exact: true }).click();
  await expect(page.getByText('已定位原文', { exact: true })).toBeVisible();
  await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 1 / 3 页');
  const width = await page.locator('.citation-highlights span').first().evaluate(node => node.getBoundingClientRect().width);
  await page.getByLabel('缩放', { exact: true }).selectOption('150'); await previewReady(page); await textReady(page);
  await expect.poll(() => page.locator('.citation-highlights span').count()).toBeGreaterThan(0);
  const widthAfter = await page.locator('.citation-highlights span').first().evaluate(node => node.getBoundingClientRect().width);
  expect(widthAfter).not.toBeCloseTo(width, 0);
  await page.getByRole('button', { name: '关闭', exact: true }).click(); await page.reload();
  await page.getByRole('button', { name: '阅读 text-navigation', exact: true }).click(); await saved(page);
  if (await page.locator('.reader-more').count() && !await page.locator('.reader-more[open]').count()) await page.locator('.reader-more > summary').click();
  await page.getByRole('button', { name: '引用 1', exact: true }).click();
  await page.getByRole('button', { name: '定位原文', exact: true }).click();
  await expect(page.getByText('已定位原文', { exact: true })).toBeVisible();
  await previewReady(page); await textReady(page);
  await expect.poll(() => page.locator('.citation-highlights span').count()).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/text-location.png' });
});

test('扫描页不生成原文，旋转页文字可以选取并定位', async ({ page }) => {
  await openReader(page, 'scan.pdf');
  await expect(page.getByText('此页没有可提取文字，暂不支持扫描区域选取。')).toBeVisible();
  await expect(page.locator('.reader-surface canvas')).toHaveCSS('opacity', '1');
  expect(await storedCitations(page)).toHaveLength(0);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByTestId('pdf-input').setInputFiles('tests/fixtures/text-navigation.pdf');
  await page.getByRole('button', { name: '阅读 text-navigation', exact: true }).click(); await saved(page);
  await jump(page, '3'); await saved(page); await selectText(page, 'Rotated source remains selectable.');
  await page.getByRole('button', { name: '保存引用草稿', exact: true }).click();
  await page.getByRole('button', { name: '定位原文', exact: true }).click();
  await expect(page.getByText('已定位原文', { exact: true })).toBeVisible();
  await previewReady(page); await textReady(page);
  const inside = await page.locator('.textLayer span').evaluateAll(nodes => nodes.every(node => {
    const r = node.getBoundingClientRect(), p = node.closest('.pdf-page')!.getBoundingClientRect();
    return r.left >= p.left - 2 && r.right <= p.right + 2 && r.top >= p.top - 2 && r.bottom <= p.bottom + 2;
  }));
  expect(inside).toBe(true);
});

test('快速切页和缩放不保留过期文本，中文可选取', async ({ page }) => {
  await openReader(page, 'text-navigation.pdf'); await jump(page, '2'); await jump(page, '3');
  await page.getByLabel('缩放', { exact: true }).selectOption('300');
  await page.getByLabel('缩放', { exact: true }).selectOption('100'); await saved(page); await textReady(page);
  await expect(page.locator('.textLayer')).toContainText('Rotated source remains selectable.');
  await expect(page.locator('.textLayer')).not.toContainText(first);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByTestId('pdf-input').setInputFiles('tests/fixtures/chinese.pdf');
  await page.getByRole('button', { name: '阅读 chinese', exact: true }).click(); await saved(page);
  await selectText(page, '流光忆庭'); await expect(page.getByLabel('编辑文本', { exact: true })).toHaveValue('流光忆庭');
});
