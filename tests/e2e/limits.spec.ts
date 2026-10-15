import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { counts, ready, upload } from './helpers';

test('32 MiB 有效 PDF 可以保存并重新打开', async ({ page }) => {
  test.setTimeout(60_000);
  await ready(page);
  const pdf = await readFile('tests/fixtures/english.pdf');
  const padded = Buffer.alloc(32 * 1024 * 1024, 32); pdf.copy(padded);
  await page.getByTestId('pdf-input').setInputFiles({ name: 'boundary.pdf', mimeType: 'application/pdf', buffer: padded });
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: '阅读 boundary', exact: true }).click();
  await expect(page.getByText('阅读位置已保存', { exact: true })).toBeVisible();
  expect(await counts(page)).toEqual({ assets: 1, books: 1, progress: 1 });
});

test('2000 页允许，2001 页拒绝且不留下半成品', async ({ page }) => {
  await ready(page); await upload(page, '2000-pages.pdf');
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  await expect(page.getByTestId('book-card')).toContainText('2000 页');
  await upload(page, '2001-pages.pdf');
  await expect(page.getByRole('alert')).toContainText('2000 页');
  expect(await counts(page)).toEqual({ assets: 1, books: 1, progress: 0 });
});

test('生产运行资源与 PDF worker 故障明确分类', async ({ page }) => {
  await ready(page);
  for (const path of ['/pdf/cmaps/UniGB-UCS2-H.bcmap', '/pdf/standard_fonts/LiberationSans-Regular.ttf', '/pdf/wasm/openjpeg.wasm']) {
    const response = await page.request.get(path);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).not.toContain('text/html');
    expect((await response.body()).length).toBeGreaterThan(1000);
  }
  await page.route('**/*pdf.worker*', route => route.abort('failed'));
  await upload(page, 'english.pdf');
  await expect(page.getByRole('alert')).toContainText('运行资源加载失败');
  expect(await counts(page)).toEqual({ assets: 0, books: 0, progress: 0 });
});
