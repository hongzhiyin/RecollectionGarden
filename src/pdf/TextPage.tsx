import { useEffect, useRef, useState } from 'react';
import { TextLayer, type PDFDocumentProxy } from 'pdfjs-dist';
import type { PagePaint } from './usePageRenderer';
import { createAnchor, locateQuote } from '../citations/anchors';
import { MAX_QUOTE_LENGTH, type QuoteSource } from '../citations/model';
import { indexText, rangeRects, selectedOffsets, type TextIndex } from './textIndex';
import '../styles/text-layer.css';
import { readTextContent } from './textContent';

export function TextPage({ document: pdf, paint, active, bookId, assetHash, target, onSelect, onLocated }: {
  document?: PDFDocumentProxy; paint?: PagePaint; active: boolean; bookId: string; assetHash: string;
  target?: QuoteSource; onSelect: (source: QuoteSource | null) => void;
  onLocated: (message: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [layerState, setLayerState] = useState<{ index: TextIndex; paint: PagePaint }>();
  const index = layerState?.paint === paint ? layerState?.index : undefined;
  const [status, setStatus] = useState('');
  const [failureDetail, setFailureDetail] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [rects, setRects] = useState<ReturnType<typeof rangeRects>>([]);
  const handlers = useRef({ onSelect, onLocated }); handlers.current = { onSelect, onLocated };
  useEffect(() => {
    const element = root.current!;
    element.replaceChildren(); setLayerState(undefined); setRects([]);
    if (!pdf || !paint || !active) { setStatus(''); return; }
    let disposed = false;
    let layer: TextLayer | undefined;
    setStatus('正在准备文本选取'); setFailureDetail('');
    element.style.setProperty('--total-scale-factor', String(paint.viewport.scale));
    element.style.setProperty('--scale-round-x', '1px'); element.style.setProperty('--scale-round-y', '1px');
    void (async () => {
      try {
        const page = await pdf.getPage(paint.page);
        const content = await readTextContent(page);
        if (disposed) return;
        layer = new TextLayer({ textContentSource: content, container: element, viewport: paint.viewport });
        await layer.render();
        if (disposed) return;
        const result = indexText(element); setLayerState({ index: result, paint });
        setStatus(result.text.trim() ? '' : '此页没有可提取文字，暂不支持扫描区域选取。');
      } catch (error) {
        if (!disposed) { element.replaceChildren(); setStatus('文本提取失败，页面仍可阅读。');
          setFailureDetail(error instanceof Error ? error.name + ': ' + error.message + '\n' + (error.stack ?? '').split('\n').slice(0, 4).join('\n') : '未知文本错误'); }
      }
    })();
    return () => { disposed = true; layer?.cancel(); };
  }, [pdf, paint, active, attempt]);
  useEffect(() => {
    setRects([]);
    if (!target || !paint || target.page !== paint.page || !active) return;
    if (!index) {
      if (status.includes('提取失败')) handlers.current.onLocated('已回到来源页，文本提取失败，精确定位不可用，未显示高亮。');
      return;
    }
    const found = target.bookId === bookId && target.assetHash === assetHash
      ? locateQuote(index.text, target.rawText, target.anchor) : null;
    const highlights = found ? rangeRects(index, found.start, found.end) : [];
    if (!highlights.length) { handlers.current.onLocated('已回到来源页，精确定位不可用，未显示高亮。'); return; }
    setRects(highlights); handlers.current.onLocated('已定位原文');
    const first = highlights[0];
    const viewport = root.current!.closest('.reader-viewport')!;
    const page = root.current!.parentElement!;
    viewport.scrollTop = Math.max(0, page.offsetTop + first.top - 60);
    viewport.scrollLeft = Math.max(0, page.offsetLeft + first.left - 40);
  }, [target, index, paint, active, bookId, assetHash, status]);
  const readSelection = () => {
      if (!index || !active || !paint) return;
      const selection = window.getSelection();
      const selected = selectedOffsets(index, selection);
      if (!selected) return;
      const rawText = index.text.slice(selected.start, selected.end);
      if (rawText.length > MAX_QUOTE_LENGTH) { setStatus('单次选段最多 10,000 个字符，请缩小范围。'); return; }
      handlers.current.onSelect({ bookId, assetHash, page: paint.page, rawText,
        anchor: createAnchor(index.text, selected.start, selected.end) });
  };
  useEffect(() => {
    if (!index || !active || !paint) return;
    let timer: ReturnType<typeof setTimeout>;
    const changed = () => { clearTimeout(timer); timer = setTimeout(readSelection, 60); };
    window.document.addEventListener('selectionchange', changed);
    return () => { clearTimeout(timer); window.document.removeEventListener('selectionchange', changed); };
  }, [index, active, paint, bookId, assetHash]);
  return <>
    <div className="textLayer" ref={root} role="document" aria-label="PDF 可选文本"
      style={{ visibility: active && index ? 'visible' : 'hidden' }}
      onPointerUp={() => { if (window.getSelection()?.isCollapsed) handlers.current.onSelect(null); else readSelection(); }} />
    <div className="citation-highlights" aria-label="原文高亮" aria-hidden={!rects.length}>
      {active && rects.map((rect, i) => <span key={i} style={rect} />)}
    </div>
    {status && active && <div className="text-layer-status" role="status">{status}
      {status.includes('提取失败') && <button className="button text" onClick={() => setAttempt(value => value + 1)}>重试文本</button>}
      {failureDetail && <details><summary>查看文本错误详情</summary><p>{failureDetail}</p></details>}
    </div>}
  </>;
}
