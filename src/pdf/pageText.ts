import type { PDFDocumentProxy } from 'pdfjs-dist';
import { BridgeError } from '../external/protocol';
import { readTextContent } from './textContent';

export async function pageText(pdf: PDFDocumentProxy, pageNumber: number) {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pdf.numPages) throw new BridgeError('INVALID_PAGE', '页码超出范围。');
  const content = await readTextContent(await pdf.getPage(pageNumber));
  const rawText = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : '') : '').join('');
  if (!rawText.trim()) throw new BridgeError('NO_TEXT', '此页没有可提取文字。');
  if (rawText.length > 40000) throw new BridgeError('CONTEXT_LIMIT', '此页文本超出 40,000 字符上限，未返回截断文本。');
  return rawText;
}
