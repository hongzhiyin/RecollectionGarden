import { test, expect } from '@playwright/test';
import { openReader, saved, storedProgress } from './reader-helpers';
import { selectText } from './text-helpers';
import { cli, connect, inputFor } from './external-helpers';

test.use({ viewport: { width: 820, height: 800 } });

test('原生动画帧暂停时仍完成 PDF 渲染、精确定位和完整主位置恢复', async ({ page }) => {
  await page.addInitScript(() => {
    let next = 0;
    window.requestAnimationFrame = () => next++;
    window.cancelAnimationFrame = () => {};
  });
  await openReader(page, 'text-navigation.pdf');
  const sessionId = await connect(page);
  if (await page.locator('.reader-more').count() && !await page.locator('.reader-more[open]').count()) await page.locator('.reader-more > summary').click();
  await page.getByRole('button', { name: '外部对话', exact: true }).click();
  await selectText(page, 'Across lines we keep the original source.');
  const quote = await cli('citation.create', { ...await inputFor(sessionId), params: {} });
  expect(quote.ok).toBe(true);
  const navigation = await cli('reader.navigate', { ...await inputFor(sessionId),
    params: { page: 2, zoom: { mode: 'percent', percent: 150 } } });
  expect(navigation.ok).toBe(true); await saved(page);
  await page.locator('.reader-viewport').evaluate(element => {
    element.scrollLeft = (element.scrollWidth - element.clientWidth) * 0.45;
    element.scrollTop = (element.scrollHeight - element.clientHeight) * 0.3;
  });
  await expect.poll(async () => (await storedProgress(page)).offsetY).toBeGreaterThan(0.2);
  const initial = await storedProgress(page);
  expect(initial.offsetX).toBeGreaterThan(0.4);
  const located = await cli('citation.locate', { ...await inputFor(sessionId), params: { citationId: quote.data.id } });
  expect(located.ok).toBe(true); expect(located.data.precision).toBe('text');
  await expect(page.locator('.citation-highlights span').first()).toBeVisible();
  await expect(page.locator('.reader-surface canvas')).toHaveCSS('opacity', '1');
  expect(await storedProgress(page)).toEqual(initial);
  const returned = await cli('reader.return', await inputFor(sessionId));
  expect(returned.ok).toBe(true); expect(returned.data.preview).toBe(false);
  expect(returned.data.location.page).toBe(initial.page);
  expect(returned.data.location.zoom).toEqual(initial.zoom);
  expect(returned.data.location.offsetX).toBeCloseTo(initial.offsetX!, 3);
  expect(returned.data.location.offsetY).toBeCloseTo(initial.offsetY!, 3);
  await saved(page);
});
