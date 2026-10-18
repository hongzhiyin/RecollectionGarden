import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, type Page } from '@playwright/test';

const run = promisify(execFile);
export async function cli(operation: string, input: Record<string, unknown> = {}) {
  try {
    const { stdout } = await run(process.execPath, ['bin/recollection-garden.mjs', 'call', operation, '--input', JSON.stringify(input)]);
    return JSON.parse(stdout);
  } catch (error) {
    const output = (error as { stdout?: string }).stdout; if (output) return JSON.parse(output); throw error;
  }
}
export async function connect(page: Page) {
  if (await page.locator('.reader-more').count() && !await page.locator('.reader-more[open]').count()) await page.locator('.reader-more > summary').click();
  await page.getByRole('button', { name: '外部对话', exact: true }).click();
  const panel = page.getByRole('region', { name: '外部对话展示窗口' });
  await panel.getByRole('button', { name: '连接本地服务', exact: true }).click();
  await expect(panel.getByText('外部工具已连接', { exact: true })).toBeVisible();
  const sessionId = await panel.getByTestId('bridge-session').getAttribute('data-session-id');
  return sessionId!;
}
export async function inputFor(sessionId: string) {
  const result = await cli('sessions.list'); expect(result.ok).toBe(true);
  const session = result.data.find((item: { sessionId: string }) => item.sessionId === sessionId);
  return { sessionId, bookId: session.bookId as string, contextVersion: session.contextVersion as string };
}
