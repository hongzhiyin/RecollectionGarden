import { test, expect } from '@playwright/test';
import { PDFDocument, concatTransformationMatrix, drawObject, popGraphicsState, pushGraphicsState } from 'pdf-lib';
import { ready } from './helpers';
import { jump, saved } from './reader-helpers';

async function scannedPdf() {
  const pdf = await PDFDocument.create();
  const width = 5100, height = 6608, stride = Math.ceil(width / 8);
  const pixels = new Uint8Array(stride * height).fill(255);
  for (let row = 400; row < height - 400; row++) {
    if (row % 250 < 50) pixels.fill(0, row * stride + 60, (row + 1) * stride - 60);
  }
  const image = pdf.context.register(pdf.context.flateStream(pixels, {
    Type: 'XObject', Subtype: 'Image', Width: width, Height: height,
    ColorSpace: 'DeviceGray', BitsPerComponent: 1,
  }));
  for (let index = 0; index < 2; index++) {
    const sheet = pdf.addPage([484, 679]);
    const name = sheet.node.newXObject('Scan', image);
    sheet.pushOperators(pushGraphicsState(), concatTransformationMatrix(484, 0, 0, 679, 0, 0),
      drawObject(name), popGraphicsState());
  }
  return Buffer.from(await pdf.save());
}

test('超过 1600 万像素的扫描页可显示、翻页和重开，画布仍受限', async ({ page }) => {
  await ready(page);
  await page.getByTestId('pdf-input').setInputFiles({ name: 'high-resolution-scan.pdf',
    mimeType: 'application/pdf', buffer: await scannedPdf() });
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  await page.getByRole('button', { name: '阅读 high-resolution-scan', exact: true }).click();
  const assertImage = async () => {
    await saved(page);
    const image = await page.locator('.reader-surface canvas').evaluate(element => {
      const canvas = element as HTMLCanvasElement;
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 100 && pixels[i + 3] > 0) ink++;
      return { ink, area: canvas.width * canvas.height };
    });
    expect(image.ink).toBeGreaterThan(10000);
    expect(image.area).toBeLessThanOrEqual(8_000_000);
    await expect(page.getByText('此页没有可提取文字，暂不支持扫描区域选取。')).toBeVisible();
  };
  await assertImage();
  await jump(page, '2'); await assertImage();
  await page.reload();
  await page.getByRole('button', { name: '阅读 high-resolution-scan', exact: true }).click();
  await expect(page.getByTestId('page-indicator')).toContainText('第 2 / 2 页');
  await assertImage();
});
