import { useEffect, useRef, useState } from 'react';

const key = 'rg-reader-split';
export function splitRatio(value: number, width: number) {
  if (width <= 800) return Number.isFinite(value) ? value : 65;
  const available = width - 8;
  return Math.min((available - 300) / available * 100, Math.max(420 / available * 100, Number.isFinite(value) ? value : 65));
}
export function useReaderSplit() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1024);
  const [preferred, setPreferred] = useState(() => {
    try { const value = Number(localStorage.getItem(key) ?? 65); return value > 0 && value < 100 ? value : 65; }
    catch { return 65; }
  });
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const element = ref.current!; let frame = 0;
    const observer = new ResizeObserver(() => {
      clearTimeout(frame); frame = window.setTimeout(() => setWidth(element.clientWidth), 0);
    });
    observer.observe(element); setWidth(element.clientWidth);
    return () => { observer.disconnect(); clearTimeout(frame); };
  }, []);
  const ratio = splitRatio(preferred, width);
  const setRatio = (next: number) => {
    const value = splitRatio(next, width); setPreferred(value);
    try { localStorage.setItem(key, String(value)); } catch { /* Keep the preference for this window. */ }
  };
  return { ref, ratio, dragging, stacked: width <= 800, compact: (width <= 800 ? width : (width - 8) * ratio / 100) < 560,
    separator: {
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
      },
      onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) setRatio((event.clientX - ref.current!.getBoundingClientRect().left) / (width - 8) * 100);
      },
      onPointerUp: () => setDragging(false), onPointerCancel: () => setDragging(false), onLostPointerCapture: () => setDragging(false),
      onDoubleClick: () => setRatio(65),
      onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
        const next = { ArrowLeft: ratio - 2, ArrowRight: ratio + 2, Home: 0, End: 100, Enter: 65 }[event.key];
        if (next !== undefined) { event.preventDefault(); setRatio(next); }
      },
    },
  };
}
