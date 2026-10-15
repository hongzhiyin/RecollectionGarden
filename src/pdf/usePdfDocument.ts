import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { library } from '../library/repository';
import { describeError } from '../library/errors';
import { openPdf } from './adapter';

export type OutlineItem = Awaited<ReturnType<PDFDocumentProxy['getOutline']>>[number];

export function usePdfDocument(bookId: string) {
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [outlineError, setOutlineError] = useState('');
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let loaded: PDFDocumentProxy | undefined;
    setDocument(undefined); setError(''); setOutline([]); setLabels([]); setOutlineError(''); setMetadataLoading(true);
    void (async () => {
      try {
        const asset = await library.readAsset(bookId);
        loaded = await openPdf(asset.file, controller.signal);
        if (controller.signal.aborted) { await loaded.loadingTask.destroy(); return; }
        setDocument(loaded);
        const [outlineResult, labelResult] = await Promise.allSettled([loaded.getOutline(), loaded.getPageLabels()]);
        if (controller.signal.aborted) return;
        if (outlineResult.status === 'fulfilled') setOutline(outlineResult.value ?? []);
        else setOutlineError('目录加载失败，仍可使用页码阅读。');
        if (labelResult.status === 'fulfilled') setLabels(labelResult.value ?? []);
      } catch (error) { if (!controller.signal.aborted) setError(describeError(error)); }
      finally { if (!controller.signal.aborted) setMetadataLoading(false); }
    })();
    return () => { controller.abort(); if (loaded) void loaded.loadingTask.destroy().catch(() => {}); };
  }, [bookId, attempt]);
  return { document, outline, labels, error, outlineError, metadataLoading, retry: () => setAttempt(value => value + 1) };
}
