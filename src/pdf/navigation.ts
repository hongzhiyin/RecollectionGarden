import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Progress, ReaderLocation, ReaderZoom } from '../library/model';

export const MIN_ZOOM = 25;
export const MAX_ZOOM = 300;
export const MAX_CANVAS_PIXELS = 8_000_000;

export function parsePage(input: string, total: number): number | null {
  if (!/^\d+$/.test(input.trim())) return null;
  const page = Number(input.trim());
  return Number.isSafeInteger(page) && page >= 1 && page <= total ? page : null;
}

export function validZoom(zoom: ReaderZoom) {
  return zoom?.mode === 'fit-width' || (zoom?.mode === 'percent' && Number.isFinite(zoom.percent)
    && zoom.percent >= MIN_ZOOM && zoom.percent <= MAX_ZOOM);
}

export function normalizeLocation(progress: Progress | undefined, total: number): ReaderLocation {
  const bounded = (value: number | undefined) => Number.isFinite(value) ? Math.min(1, Math.max(0, value!)) : 0;
  return {
    page: progress && Number.isInteger(progress.page) && progress.page > 0 && progress.page <= total ? progress.page : 1,
    zoom: progress?.zoom && validZoom(progress.zoom) ? progress.zoom : { mode: 'fit-width' },
    offsetX: bounded(progress?.offsetX), offsetY: bounded(progress?.offsetY),
  };
}

export async function resolveDestination(document: PDFDocumentProxy, destination: unknown): Promise<number> {
  const target = typeof destination === 'string' ? await document.getDestination(destination) : destination;
  if (!Array.isArray(target) || !target.length) throw new Error('目录目标不存在');
  const reference: unknown = target[0];
  let index: number;
  if (typeof reference === 'number' && Number.isInteger(reference)) index = reference;
  else if (reference && typeof reference === 'object' && 'num' in reference && 'gen' in reference
    && Number.isInteger(reference.num) && Number.isInteger(reference.gen)) {
    index = await document.getPageIndex(reference as { num: number; gen: number });
  } else throw new Error('目录目标无效');
  if (index < 0 || index >= document.numPages) throw new Error('目录目标超出页数');
  return index + 1;
}

export function renderGeometry(width: number, height: number, availableWidth: number, zoom: ReaderZoom, dpr: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('页面尺寸无效');
  const scale = zoom.mode === 'fit-width' ? Math.max(1, availableWidth) / width : zoom.percent / 100;
  const cssWidth = width * scale, cssHeight = height * scale;
  if (cssWidth > 100_000 || cssHeight > 100_000) throw new Error('页面尺寸超出支持范围');
  const ratio = Math.min(dpr || 1, 2, Math.sqrt(MAX_CANVAS_PIXELS / (cssWidth * cssHeight)), 8192 / cssWidth, 8192 / cssHeight);
  return { scale, ratio, cssWidth, cssHeight };
}

export function scrollOffsets(element: HTMLElement) {
  return { offsetX: element.scrollLeft / Math.max(1, element.scrollWidth - element.clientWidth),
    offsetY: element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight) };
}
