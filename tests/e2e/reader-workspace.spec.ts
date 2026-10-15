import { test, expect } from '@playwright/test';
import { openReader, saved } from './reader-helpers';

test('阅读器铺满内容区，桌面外部对话委托原生面板，关闭阅读时收起面板', async ({ page }) => {
  await page.addInitScript(() => {
    const messages: unknown[] = [];
    Object.assign(window, { nativeMessages: messages, webkit: { messageHandlers: { gardenDesktop: {
      postMessage(message: { type: string }) {
        messages.push(message);
        window.dispatchEvent(new CustomEvent('garden-external-panel', { detail: message.type === 'external.toggle' }));
      },
    } } } });
  });
  await openReader(page);
  await page.evaluate(() => { document.body.style.minHeight = '300vh'; });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
  const assertFullSize = async () => {
    const bounds = await page.getByRole('dialog').boundingBox();
    expect(bounds).toEqual({ x: 0, y: 0, ...page.viewportSize()! });
  };
  await assertFullSize();
  await page.getByRole('button', { name: '外部对话', exact: true }).click();
  await expect(page.getByRole('button', { name: '外部对话', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: '外部对话展示窗口' })).toHaveCount(0);
  await page.setViewportSize({ width: 690, height: 860 }); await saved(page); await assertFullSize();
  await page.getByRole('button', { name: '回传记录', exact: true }).click();
  await expect(page.getByRole('region', { name: '外部对话展示窗口' })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  const messages = await page.evaluate(() => (window as unknown as { nativeMessages: unknown[] }).nativeMessages);
  expect(messages).toContainEqual({ type: 'external.toggle' });
  expect(messages.at(-1)).toEqual({ type: 'external.close' });
});
