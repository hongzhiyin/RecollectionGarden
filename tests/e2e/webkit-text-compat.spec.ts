import { test, expect } from '@playwright/test';
import { openReader } from './reader-helpers';
import { selectText } from './text-helpers';
import { connect, cli, inputFor } from './external-helpers';

test('缺少流异步迭代器时仍可选择 PDF 原文并通过外部接口读取', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, { configurable: true, value: undefined });
  });
  await openReader(page, 'text-navigation.pdf');
  await selectText(page, 'Across lines we keep the original source.');
  await expect(page.getByLabel('选中原文', { exact: true })).toHaveText('Across lines we keep the original source.');
  const sessionId = await connect(page);
  const text = await cli('page.read', { ...await inputFor(sessionId), params: { page: 1 } });
  expect(text.ok).toBe(true);
  expect(text.data.rawText).toContain('Across lines we keep the original source.');
});
