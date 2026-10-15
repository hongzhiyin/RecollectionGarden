import { describe, expect, it, vi } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { MAX_CANVAS_PIXELS, normalizeLocation, parsePage, renderGeometry, resolveDestination } from '../../src/pdf/navigation';

describe('物理页导航与恢复契约', () => {
  it('页码输入只接受范围内整数，不接受小数和科学计数', () => {
    expect(parsePage(' 03 ', 10)).toBe(3);
    for (const text of ['', '0', '11', '-1', '1.5', '1e1', 'abc']) expect(parsePage(text, 10)).toBeNull();
  });
  it('旧进度恢复页码，缺失设置采用适应宽度与页首', () => {
    expect(normalizeLocation({ bookId: 'book', page: 2, status: 'reading', lastReadAt: 1 }, 5))
      .toEqual({ page: 2, zoom: { mode: 'fit-width' }, offsetX: 0, offsetY: 0 });
  });
  it('损坏偏好使用合法默认值，不产生越界页码', () => {
    const location = normalizeLocation({ bookId: 'book', page: 50, status: 'reading', lastReadAt: 1,
      offsetX: -1, offsetY: 3, zoom: { mode: 'percent', percent: Number.NaN } }, 5);
    expect(location).toEqual({ page: 1, zoom: { mode: 'fit-width' }, offsetX: 0, offsetY: 1 });
  });
  it('命名和引用目标转换为正确的一基物理页', async () => {
    const document = { numPages: 5, getDestination: vi.fn().mockResolvedValue([{ num: 8, gen: 0 }, { name: 'Fit' }]),
      getPageIndex: vi.fn().mockResolvedValue(2) } as unknown as PDFDocumentProxy;
    expect(await resolveDestination(document, 'chapter')).toBe(3);
    expect(await resolveDestination(document, [0, { name: 'Fit' }])).toBe(1);
  });
  it('不存在、无效或越界的目录目标不生成跳转页码', async () => {
    const document = { numPages: 3, getDestination: vi.fn().mockResolvedValue(null) } as unknown as PDFDocumentProxy;
    for (const target of ['missing', null, [], [-1], [3], [1.5], [{}]]) {
      await expect(resolveDestination(document, target)).rejects.toThrow();
    }
  });
  it('适应宽度保持比例，高缩放限制 Canvas 内存与边长', () => {
    const fit = renderGeometry(600, 900, 720, { mode: 'fit-width' }, 2);
    expect(fit.cssWidth).toBe(720); expect(fit.cssHeight).toBe(1080);
    const large = renderGeometry(2000, 3000, 720, { mode: 'percent', percent: 300 }, 2);
    expect(large.cssWidth * large.cssHeight * large.ratio ** 2).toBeLessThanOrEqual(MAX_CANVAS_PIXELS + 1);
    expect(Math.max(large.cssWidth, large.cssHeight) * large.ratio).toBeLessThanOrEqual(8192);
  });
});
