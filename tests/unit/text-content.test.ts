import { expect, it } from 'vitest';
import type { PDFPageProxy } from 'pdfjs-dist';
import { readTextContent } from '../../src/pdf/textContent';

it('无 ReadableStream 异步迭代器时聚合原文、样式和语言，且释放读取锁', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(ReadableStream.prototype, Symbol.asyncIterator);
  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, { configurable: true, value: undefined });
  try {
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue({ items: [{ str: '原文\n' }], styles: { first: { fontFamily: 'serif' } }, lang: 'zh' });
      controller.enqueue({ items: [{ str: 'Second' }], styles: { second: { fontFamily: 'sans-serif' } }, lang: 'en' });
      controller.close();
    } });
    const page = { streamTextContent: () => stream } as unknown as PDFPageProxy;
    const result = await readTextContent(page);
    expect(result.items).toEqual([{ str: '原文\n' }, { str: 'Second' }]);
    expect(result.lang).toBe('zh'); expect(Object.keys(result.styles)).toEqual(['first', 'second']);
    expect(stream.locked).toBe(false);
    const failing = new ReadableStream({ start(controller) { controller.error(new Error('text failed')); } });
    await expect(readTextContent({ streamTextContent: () => failing } as unknown as PDFPageProxy)).rejects.toThrow('text failed');
    expect(failing.locked).toBe(false);
  } finally {
    if (descriptor) Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, descriptor);
    else Reflect.deleteProperty(ReadableStream.prototype, Symbol.asyncIterator);
  }
});
