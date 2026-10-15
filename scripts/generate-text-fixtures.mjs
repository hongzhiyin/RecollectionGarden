import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { writeFile } from 'node:fs/promises';

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const first = pdf.addPage([500, 700]);
first.drawText('Selecting original text', { x: 40, y: 620, size: 22, font });
for (const [i, text] of [
  'Across lines we keep the original source.',
  'Edited questions never replace the original text.',
  'Return to the passage after changing the zoom.',
].entries()) first.drawText(text, { x: 40, y: 550 - i * 28, size: 14, font });
const second = pdf.addPage([500, 700]);
for (const [i, text] of ['First occurrence', 'Same phrase', 'Second occurrence', 'Same phrase'].entries()) {
  second.drawText(text, { x: 40, y: 600 - i * 40, size: 18, font });
}
const rotated = pdf.addPage([500, 700]); rotated.setRotation(degrees(90));
rotated.drawText('Rotated source remains selectable.', { x: 40, y: 600, size: 18, font });
await writeFile('tests/fixtures/text-navigation.pdf', await pdf.save());
