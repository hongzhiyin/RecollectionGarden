import { PDFDocument, PDFName, PDFHexString, PDFNumber } from 'pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';
const pdf = await PDFDocument.load(await readFile('tests/fixtures/text-navigation.pdf'));
const ctx = pdf.context, pages = pdf.getPages(), root = ctx.obj({ Type: 'Outlines' }), rootRef = ctx.register(root);
const nodes = [
  { title: 'Table of Contents', page: 0 },
  { title: 'Part I', children: [{ title: 'Chapter 4: Introduction', page: 1 }, { title: 'Chapter 5: Services', page: 2 }] },
];
function writeSiblings(items, parent) {
  const dictionaries = items.map(item => ctx.obj({ Title: PDFHexString.fromText(item.title), Parent: parent,
    ...(item.page === undefined ? {} : { Dest: [pages[item.page].ref, PDFName.of('Fit')] }) }));
  const refs = dictionaries.map(d => ctx.register(d)); let count = items.length;
  dictionaries.forEach((dict, i) => {
    if (i) dict.set(PDFName.of('Prev'), refs[i - 1]);
    if (i + 1 < refs.length) dict.set(PDFName.of('Next'), refs[i + 1]);
    if (items[i].children) {
      const child = writeSiblings(items[i].children, refs[i]);
      dict.set(PDFName.of('First'), child.first); dict.set(PDFName.of('Last'), child.last); dict.set(PDFName.of('Count'), PDFNumber.of(child.count)); count += child.count;
    }
  });
  return { first: refs[0], last: refs.at(-1), count };
}
const tree = writeSiblings(nodes, rootRef);
root.set(PDFName.of('First'), tree.first); root.set(PDFName.of('Last'), tree.last); root.set(PDFName.of('Count'), PDFNumber.of(tree.count));
pdf.catalog.set(PDFName.of('Outlines'), rootRef);
await writeFile('tests/fixtures/outline-navigation.pdf', await pdf.save());
