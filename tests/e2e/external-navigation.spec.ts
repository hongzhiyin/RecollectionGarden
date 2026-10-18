import { test, expect } from '@playwright/test';
import { openReader, saved, storedProgress } from './reader-helpers';
import { selectText } from './text-helpers';
import { cli, connect, inputFor } from './external-helpers';

test('外部跳页和缩放原子更新，临时定位返回和明确继续分别处理主进度', async ({ page }) => {
  await openReader(page, 'text-navigation.pdf'); const sessionId = await connect(page);
  if (await page.locator('.reader-more').count() && !await page.locator('.reader-more[open]').count()) await page.locator('.reader-more > summary').click();
  await page.getByRole('button', { name: '外部对话', exact: true }).click();
  await selectText(page, 'Across lines we keep the original source.');
  const input = await inputFor(sessionId);
  const quote = await cli('citation.create', { ...input, params: {} }); expect(quote.ok).toBe(true);
  const nav = await cli('reader.navigate', { ...await inputFor(sessionId), params: { page: 2, zoom: { mode: 'percent', percent: 150 } } });
  expect(nav.ok).toBe(true); expect(nav.data.location.offsetY).toBe(0); await saved(page);
  const initial = await storedProgress(page); expect(initial.page).toBe(2);
  const located = await cli('citation.locate', { ...await inputFor(sessionId), params: { citationId: quote.data.id } });
  expect(located.ok).toBe(true); expect(located.data.precision).toBe('text'); expect((await storedProgress(page)).page).toBe(2);
  const returned = await cli('reader.return', await inputFor(sessionId)); expect(returned.ok).toBe(true);
  expect(returned.data.location.page).toBe(2); expect(returned.data.preview).toBe(false);
  await cli('citation.locate', { ...await inputFor(sessionId), params: { citationId: quote.data.id } });
  const continued = await cli('reader.continue', await inputFor(sessionId)); expect(continued.ok).toBe(true);
  await saved(page); expect((await storedProgress(page)).page).toBe(1);
});
