import { test, expect } from '@playwright/test';
import { openReader, saved, storedProgress } from './reader-helpers';

test('极光布局：目录层级保留、分栏下限、比例复位及窄屏适配', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1024, height: 850 }); await openReader(page);
  await page.getByRole('button', { name: '展开 Chapter One', exact: true }).click();
  await page.getByRole('button', { name: '收起目录', exact: true }).click();
  await page.getByRole('button', { name: '显示目录', exact: true }).click();
  await expect(page.getByRole('button', { name: 'First section', exact: true })).toBeVisible();
  const divider = page.getByRole('separator');
  await divider.focus(); await page.keyboard.press('Home'); await saved(page);
  expect((await page.locator('.aurora-reader').boundingBox())!.width).toBeCloseTo(420, 0);
  await expect(page.getByRole('button', { name: '收起浮层目录' })).toBeVisible();
  await page.getByRole('button', { name: 'First section', exact: true }).click(); await saved(page);
  await expect(page.getByRole('complementary', { name: 'PDF 目录' })).toHaveCount(0);
  await divider.focus(); await page.keyboard.press('End'); await saved(page);
  expect((await page.getByRole('region', { name: 'AI 软件窗口' }).boundingBox())!.width).toBeCloseTo(300, 0);
  await divider.dblclick(); await expect(divider).toHaveAttribute('aria-valuenow', '65');
  const bounds = (await divider.boundingBox())!;
  await page.mouse.move(bounds.x + 4, bounds.y + 80); await page.mouse.down();
  await page.mouse.move(bounds.x - 80, bounds.y + 80, { steps: 8 }); await page.mouse.up(); await saved(page);
  expect(Number(await divider.getAttribute('aria-valuenow'))).toBeLessThan(65);
  await divider.dblclick();
  await page.keyboard.press('ArrowRight'); await expect(divider).toHaveAttribute('aria-valuenow', '67');
  await page.setViewportSize({ width: 390, height: 844 }); await saved(page);
  await expect(divider).toBeHidden(); expect((await storedProgress(page)).page).toBe(2);
  await page.setViewportSize({ width: 1024, height: 850 }); await saved(page);
  await expect(divider).toHaveAttribute('aria-valuenow', '67');
  expect(errors).toEqual([]);
});

test('原生 AI 表面与设置：真实事件驱动、编辑保护、隐藏覆盖及退出清理', async ({ page }) => {
  await page.addInitScript(() => {
    const messages: Record<string, unknown>[] = [];
    Object.assign(window, { nativeMessages: messages, webkit: { messageHandlers: { gardenDesktop: {
      postMessage(message: Record<string, unknown>) {
        messages.push(message);
        if (message.type === 'external.navigate') {
          window.dispatchEvent(new CustomEvent('garden-external-panel', { detail: true }));
          window.dispatchEvent(new CustomEvent('garden-external-state', { detail: { status: 'loaded', address: message.address,
            message: 'AI 网页已打开', canBack: false, canForward: false } }));
        }
        if (message.type === 'external.close') window.dispatchEvent(new CustomEvent('garden-external-panel', { detail: false }));
      },
    } } } });
  });
  await openReader(page); const settings = page.getByRole('region', { name: '连接设置' });
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByLabel('AI 入口地址').fill('javascript:alert(1)');
  await page.getByRole('button', { name: '保存并连接', exact: true }).click();
  await expect(settings.getByRole('alert')).toContainText('http');
  await page.getByLabel('AI 入口地址').fill('https://example.com/');
  await page.getByRole('button', { name: '保存并连接', exact: true }).click();
  await expect(settings.getByRole('status').first()).toHaveText('网页已打开');
  await page.getByLabel('AI 入口地址').fill('https://example.org/');
  await page.getByRole('button', { name: '关闭连接设置' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(page.getByLabel('AI 入口地址')).toHaveValue('https://example.org/');
  await page.getByRole('button', { name: '取消修改' }).click();
  await expect(page.getByLabel('AI 入口地址')).toHaveValue('https://example.com/');
  await page.getByLabel('AI 入口地址').press('Escape'); await expect(settings).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as unknown as { nativeMessages: Record<string, unknown>[] }).nativeMessages
    .filter(item => item.type === 'external.layout').at(-1)?.visible)).toBe(true);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  const messages = await page.evaluate(() => (window as unknown as { nativeMessages: Record<string, unknown>[] }).nativeMessages);
  expect(messages).toContainEqual({ type: 'external.navigate', address: 'https://example.com/' });
  expect(messages.filter(item => item.type === 'external.layout').at(-1)?.visible).toBe(false);
  expect(messages).toContainEqual({ type: 'external.close' });
});
