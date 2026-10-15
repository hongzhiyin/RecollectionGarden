import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

await mkdir('tests/fixtures', { recursive: true });
const english = await PDFDocument.create();
const font = await english.embedFont(StandardFonts.Helvetica);
for (const [index, title] of ['A garden of ideas', 'Return to the page', 'Make room for questions'].entries()) {
  const page = english.addPage([420, 595]);
  page.drawRectangle({ x: 0, y: 0, width: 420, height: 595, color: rgb(.97, .95, .89) });
  page.drawText(title, { x: 40, y: 470, size: 25, font, color: rgb(.31, .24, .37) });
  page.drawText(`Recollection Garden / ${index + 1}`, { x: 40, y: 435, size: 12, font });
}
await writeFile('tests/fixtures/english.pdf', await english.save());
const chinese = await PDFDocument.create();
chinese.registerFontkit(fontkit);
const cjk = await chinese.embedFont(await readFile('/System/Library/Fonts/Supplemental/Arial Unicode.ttf'), { subset: true });
for (const title of ['流光忆庭', '把理解留在书页之间']) {
  const page = chinese.addPage([420, 595]);
  page.drawText(title, { x: 35, y: 460, size: 26, font: cjk, color: rgb(.3, .24, .4) });
  page.drawText('中文文字与阅读位置验证', { x: 35, y: 410, size: 14, font: cjk });
}
await writeFile('tests/fixtures/chinese.pdf', await chinese.save());
const scan = await PDFDocument.create();
const png = await scan.embedPng('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==');
scan.addPage([420, 595]).drawImage(png, { x: 35, y: 35, width: 350, height: 525 });
await writeFile('tests/fixtures/scan.pdf', await scan.save());
await writeFile('tests/fixtures/corrupt.pdf', 'this is not a PDF');
const longPdf = await PDFDocument.create();
for (let i = 0; i < 2000; i++) longPdf.addPage([100, 100]);
await writeFile('tests/fixtures/2000-pages.pdf', await longPdf.save());
longPdf.addPage([100, 100]);
await writeFile('tests/fixtures/2001-pages.pdf', await longPdf.save());
