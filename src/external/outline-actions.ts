import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { OutlineItem } from '../pdf/usePdfDocument';
import { findOutline, indexOutline, normalizeTitle, outlineSummary } from '../pdf/outline-index';
import { resolveDestination } from '../pdf/navigation';
import { BridgeError, type BridgeCommand, type ReaderSnapshot } from './protocol';
import { outlineOperations } from './outline-protocol';

export interface OutlineControls {
  book: { id: string; assetHash: string }; pdf?: PDFDocumentProxy;
  outline: OutlineItem[]; outlineLoading: boolean; outlineError: string;
  showOutline: () => void; navigate: (page: number) => void;
}
export async function outlineAction(command: BridgeCommand, controls: OutlineControls, context: {
  fresh(): void; snapshot(): ReaderSnapshot; waitForPage(page: number): Promise<void>;
}) {
  context.fresh();
  if (command.operation === 'outline.navigate' && command.params.target === 'panel') {
    controls.showOutline(); return { status: 'panel-opened', ...context.snapshot() };
  }
  if (controls.outlineLoading || !controls.pdf) throw new BridgeError('NOT_READY', '书籍目录正在读取，请稍后重试。');
  if (controls.outlineError) throw new BridgeError('OUTLINE_UNAVAILABLE', controls.outlineError);
  let entries;
  try { entries = indexOutline(controls.outline); }
  catch (error) { throw new BridgeError('OUTLINE_LIMIT', (error as Error).message); }
  const outlineVersion = `${controls.book.assetHash}:outline-v1`;
  if (command.operation === 'outline.get') {
    const input = outlineOperations['outline.get'].parse(command.params), offset = input.offset ?? 0, limit = input.limit ?? 60;
    const filtered = input.query ? entries.filter(e => normalizeTitle(e.title).includes(normalizeTitle(input.query!))) : entries;
    return { status: entries.length ? 'available' : 'empty', ...context.snapshot(), outlineVersion,
      total: filtered.length, offset, entries: filtered.slice(offset, offset + limit).map(outlineSummary),
      nextOffset: offset + limit < filtered.length ? offset + limit : null };
  }
  const input = outlineOperations['outline.navigate'].parse(command.params);
  const keys: Record<string, string[]> = { entry: ['entryId', 'outlineVersion'], title: ['title'], chapter: ['chapter'], contents: [], panel: [] };
  if (Object.keys(input).some(key => !['target', 'outlineVersion', ...keys[input.target]!].includes(key))
    || (input.target === 'entry' && (!input.entryId || !input.outlineVersion))
    || (input.target === 'title' && !normalizeTitle(input.title ?? '')) || (input.target === 'chapter' && !input.chapter))
    throw new BridgeError('INVALID_PARAMS', '目录定位参数不完整或互相冲突。');
  if (input.outlineVersion && input.outlineVersion !== outlineVersion) throw new BridgeError('STALE_OUTLINE', '目录不属于当前书籍版本，请重新读取目录。');
  const matches = findOutline(entries, input);
  if (!matches.length && input.target === 'contents') {
    controls.showOutline(); return { status: 'panel-opened', reason: entries.length ? 'NO_CONTENTS_DESTINATION' : 'NO_OUTLINE', ...context.snapshot(), outlineVersion };
  }
  if (!entries.length) throw new BridgeError('OUTLINE_EMPTY', '此 PDF 没有内置目录，不能可靠地按章节定位。');
  if (!matches.length) return { status: 'not-found', outlineVersion, candidates: [] };
  if (matches.length > 1) return { status: 'ambiguous', outlineVersion, total: matches.length, candidates: matches.slice(0, 30).map(outlineSummary) };
  const selected = matches[0]!;
  if (!selected.item.dest || selected.item.url) throw new BridgeError('OUTLINE_TARGET_UNAVAILABLE', '目录项没有书内目标，或指向外部链接；未改变阅读位置。');
  let page: number;
  try { page = await resolveDestination(controls.pdf, selected.item.dest); }
  catch { throw new BridgeError('OUTLINE_TARGET_UNAVAILABLE', 'PDF 目录目标无法解析，未改变阅读位置。'); }
  context.fresh(); controls.navigate(page); await context.waitForPage(page);
  return { status: 'navigated', ...context.snapshot(), outlineVersion, entry: outlineSummary(selected), page };
}
