import { describe, it, expect, vi } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { OutlineItem } from '../../src/pdf/usePdfDocument';
import { indexOutline, findOutline, chapterNumber } from '../../src/pdf/outline-index';
import { outlineAction, type OutlineControls } from '../../src/external/outline-actions';
import type { BridgeCommand } from '../../src/external/protocol';
const node = (title: string, dest: unknown = [0], items: OutlineItem[] = []) => ({ title, dest, items }) as OutlineItem;
function fixture(items = [node('Table of Contents'), node('Part I', null, [node('Chapter 5: Services', 'five')])]) {
  const navigate = vi.fn(), show = vi.fn();
  const pdf = { numPages: 10, getDestination: vi.fn().mockResolvedValue([{ num: 10, gen: 0 }]), getPageIndex: vi.fn().mockResolvedValue(6) } as unknown as PDFDocumentProxy;
  const controls: OutlineControls = { book: { id: 'book-a', assetHash: 'hash-a' }, pdf, outline: items, outlineLoading: false, outlineError: '', showOutline: show, navigate };
  const fresh = vi.fn(); const context = { fresh, snapshot: () => ({ bookId: 'book-a', title: 'Book', page: 1, contextVersion: 'v1' }), waitForPage: vi.fn().mockResolvedValue(undefined) };
  const call = (operation: 'outline.get' | 'outline.navigate', params: Record<string, unknown> = {}) => outlineAction({ operation, params } as BridgeCommand, controls, context);
  return { controls, context, navigate, show, call, pdf };
}
describe('目录读取与确定性定位', () => {
  it('保留层级和稳定 id，中文与英文数字章节号一致', () => {
    const entries = indexOutline([node('Part I', null, [node('Chapter 5: Services')]), node('第五章 配置')]);
    expect(entries[1]?.id).toBe('0.0'); expect(entries[1]?.parents).toEqual(['Part I']);
    expect(findOutline(entries, { target: 'chapter', chapter: 5 })).toHaveLength(2);
    expect(chapterNumber('Chapter 51: Next')).toBe(51); expect(chapterNumber('Chapter 5.1 detail')).toBeUndefined();
    expect(chapterNumber('第十五章')).toBe(15); expect(chapterNumber('第两百零五章')).toBe(205);
  });
  it('读取目录支持过滤和分页，不执行导航', async () => {
    const f = fixture(); const result = await f.call('outline.get', { limit: 1 });
    expect(result).toMatchObject({ status: 'available', total: 3, nextOffset: 1, outlineVersion: 'hash-a:outline-v1' });
    expect(await f.call('outline.get', { query: 'services' })).toMatchObject({ total: 1, nextOffset: null });
    expect(f.navigate).not.toHaveBeenCalled();
  });
  it('第5章复用命名目标和间接引用解析，不按章节号猜页码', async () => {
    const f = fixture(); expect(await f.call('outline.navigate', { target: 'chapter', chapter: 5 })).toMatchObject({ status: 'navigated', page: 7 });
    expect(f.pdf.getDestination).toHaveBeenCalledWith('five'); expect(f.navigate).toHaveBeenCalledWith(7);
  });
  it('完整标题优先；重复标题返回候选且不跳转', async () => {
    const f = fixture([node('Introduction', [2]), node('Introduction', [4]), node('Introduction to Services', [6])]);
    expect(await f.call('outline.navigate', { target: 'title', title: ' introduction ' })).toMatchObject({ status: 'ambiguous', total: 2 });
    expect(f.navigate).not.toHaveBeenCalled();
    expect(await f.call('outline.navigate', { target: 'entry', entryId: '1', outlineVersion: 'hash-a:outline-v1' })).toMatchObject({ page: 5 });
  });
  it('目录页目标跳实际书签，无目录页书签时仅打开目录侧栏', async () => {
    const f = fixture(); expect(await f.call('outline.navigate', { target: 'contents' })).toMatchObject({ status: 'navigated', page: 1 });
    const g = fixture([node('Chapter 5', [4])]);
    expect(await g.call('outline.navigate', { target: 'contents' })).toMatchObject({ status: 'panel-opened', reason: 'NO_CONTENTS_DESTINATION' });
    expect(g.show).toHaveBeenCalledOnce(); expect(g.navigate).not.toHaveBeenCalled();
  });
  it('无目录、错误条目版本、外链、无效目标均不猜位置', async () => {
    const empty = fixture([]); expect(await empty.call('outline.get')).toMatchObject({ status: 'empty', total: 0 });
    await expect(empty.call('outline.navigate', { target: 'chapter', chapter: 5 })).rejects.toMatchObject({ code: 'OUTLINE_EMPTY' });
    const f = fixture([Object.assign(node('External', [2]), { url: 'https://example.test' }), node('Broken', [20])]);
    await expect(f.call('outline.navigate', { target: 'entry', entryId: '0', outlineVersion: 'other' })).rejects.toMatchObject({ code: 'STALE_OUTLINE' });
    await expect(f.call('outline.navigate', { target: 'title', title: 'External' })).rejects.toMatchObject({ code: 'OUTLINE_TARGET_UNAVAILABLE' });
    await expect(f.call('outline.navigate', { target: 'title', title: 'Broken' })).rejects.toMatchObject({ code: 'OUTLINE_TARGET_UNAVAILABLE' });
    expect(f.navigate).not.toHaveBeenCalled();
  });
  it('异步目标解析期间上下文变化，导航前再次检查', async () => {
    const f = fixture(); f.context.fresh.mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw new Error('stale'); });
    await expect(f.call('outline.navigate', { target: 'chapter', chapter: 5 })).rejects.toThrow('stale'); expect(f.navigate).not.toHaveBeenCalled();
  });
});
