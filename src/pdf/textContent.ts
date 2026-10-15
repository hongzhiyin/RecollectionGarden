import type { PDFPageProxy } from 'pdfjs-dist';

type TextContent = Awaited<ReturnType<PDFPageProxy['getTextContent']>>;

export async function readTextContent(page: PDFPageProxy): Promise<TextContent> {
  if (typeof Reflect.get(ReadableStream.prototype, Symbol.asyncIterator) === 'function') return page.getTextContent();
  // Released WebKit can lack stream async iteration even when text streaming itself works.
  const reader = page.streamTextContent().getReader();
  const content: TextContent = { items: [], styles: Object.create(null), lang: null };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return content;
      content.lang ??= value.lang;
      Object.assign(content.styles, value.styles);
      content.items.push(...value.items);
    }
  } catch (error) {
    await reader.cancel(error).catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
}
