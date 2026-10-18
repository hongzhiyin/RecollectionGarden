import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PageViewport } from 'pdfjs-dist';
import type { ReaderLocation } from '../library/model';
import { renderGeometry, scrollOffsets } from './navigation';
export interface PagePaint { page: number; viewport: PageViewport }

export function usePageRenderer(document: PDFDocumentProxy | undefined, view: ReaderLocation,
  onLocation: (position: ReaderLocation) => void) {
  const viewport = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const displayed = useRef<ReaderLocation | null>(null);
  const busy = useRef(true);
  const handler = useRef(onLocation); handler.current = onLocation;
  const measured = useRef({ width: 1, height: 1 });
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [scalePercent, setScalePercent] = useState(100);
  const [paint, setPaint] = useState<PagePaint>();
  useEffect(() => {
    const element = viewport.current!;
    const measure = () => {
      const next = { width: element.clientWidth, height: element.clientHeight };
      if (measured.current.width === next.width && measured.current.height === next.height) return;
      measured.current = next;
      busy.current = true; setLoading(true); setSize(next);
    };
    let frame = 0;
    const observer = new ResizeObserver(() => { clearTimeout(frame); frame = window.setTimeout(measure, 0); });
    observer.observe(element); measure();
    return () => { observer.disconnect(); clearTimeout(frame); };
  }, []);
  useEffect(() => {
    if (!document || size.width <= 1 || size.height <= 1) return;
    const controller = new AbortController();
    let cancel: (() => void) | undefined;
    const previous = displayed.current;
    const sameSettings = previous?.page === view.page && JSON.stringify(previous.zoom) === JSON.stringify(view.zoom);
    const anchor = sameSettings && previous ? { ...previous } : { ...view };
    busy.current = true; setLoading(true); setError('');
    void (async () => {
      try {
        const page = await document.getPage(view.page);
        if (controller.signal.aborted) return;
        const element = viewport.current!, sheet = surface.current!, target = canvas.current!;
        const padding = getComputedStyle(sheet);
        const available = size.width - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
        const natural = page.getViewport({ scale: 1 });
        const geometry = renderGeometry(natural.width, natural.height, available, view.zoom, window.devicePixelRatio);
        const pageViewport = page.getViewport({ scale: geometry.scale });
        target.width = Math.max(1, Math.floor(geometry.cssWidth * geometry.ratio));
        target.height = Math.max(1, Math.floor(geometry.cssHeight * geometry.ratio));
        target.style.width = geometry.cssWidth + 'px'; target.style.height = geometry.cssHeight + 'px';
        const task = page.render({ canvas: target, viewport: pageViewport,
          transform: [geometry.ratio, 0, 0, geometry.ratio, 0, 0] });
        cancel = () => task.cancel();
        await task.promise;
        if (controller.signal.aborted) return;
        element.scrollLeft = anchor.offsetX * Math.max(0, element.scrollWidth - element.clientWidth);
        element.scrollTop = anchor.offsetY * Math.max(0, element.scrollHeight - element.clientHeight);
        displayed.current = { ...view, ...scrollOffsets(element) };
        setPaint({ page: view.page, viewport: pageViewport });
        setScalePercent(Math.round(geometry.scale * 100));
        busy.current = false; setLoading(false); handler.current(displayed.current);
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error && /尺寸/.test(error.message) ? error.message : '页面显示失败，请重试或切换页面。');
          setLoading(false); busy.current = true;
        }
      }
    })();
    return () => { controller.abort(); cancel?.(); };
  }, [document, view.page, view.zoom.mode, view.zoom.mode === 'percent' ? view.zoom.percent : 0, size, attempt]);
  function onScroll() {
    if (busy.current || !displayed.current || !viewport.current) return;
    const element = viewport.current;
    if (element.clientWidth !== measured.current.width || element.clientHeight !== measured.current.height) return;
    displayed.current = { ...displayed.current, ...scrollOffsets(viewport.current) };
    handler.current(displayed.current);
  }
  return { viewport, surface, canvas, displayed, loading, error, scalePercent, onScroll, paint,
    restore: () => { displayed.current = null; busy.current = true; setLoading(true); setAttempt(value => value + 1); },
    retry: () => setAttempt(value => value + 1) };
}

