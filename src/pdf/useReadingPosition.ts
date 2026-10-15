import { useRef, useState } from 'react';
import type { BookView, ReaderLocation } from '../library/model';
import { normalizeLocation } from './navigation';

export function useReadingPosition(book: BookView) {
  const [view, setView] = useState<ReaderLocation>(() => normalizeLocation(book.progress, book.pages));
  const original = useRef<ReaderLocation | undefined>(undefined);
  const [preview, setPreview] = useState(false);
  function begin(location: ReaderLocation) {
    original.current ??= structuredClone(location); setPreview(true);
  }
  function finish() {
    const location = original.current; original.current = undefined; setPreview(false); return location;
  }
  return { view, setView, original, preview, begin, finish };
}
