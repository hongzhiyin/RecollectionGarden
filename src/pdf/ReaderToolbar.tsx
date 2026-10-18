import { useEffect, useState } from 'react';
import type { ReaderZoom } from '../library/model';
import { MAX_ZOOM, MIN_ZOOM, parsePage } from './navigation';
import { Icon } from '../ui/Icon';

export function ReaderToolbar({ page, total, label, zoom, scalePercent, ready, outlineVisible,
  navigate, setZoom, toggleOutline, citations, toggleCitations, toggleExternal, toggleNotes, toggleMessages, externalOpen }: {
  page: number; total: number; label?: string; zoom: ReaderZoom; scalePercent: number; ready: boolean;
  outlineVisible: boolean; navigate: (page: number) => void; setZoom: (zoom: ReaderZoom) => void; toggleOutline: () => void;
  citations: number; toggleCitations: () => void;
  toggleExternal: () => void; externalOpen?: boolean; toggleMessages?: () => void;
  toggleNotes: () => void;
}) {
  const [input, setInput] = useState(String(page));
  const [error, setError] = useState('');
  useEffect(() => { setInput(String(page)); setError(''); }, [page]);
  const percent = zoom.mode === 'percent' ? zoom.percent : scalePercent;
  const presets = Array.from(new Set([25, 50, 75, 100, 125, 150, 200, 300,
    ...(zoom.mode === 'percent' ? [zoom.percent] : [])])).sort((a, b) => a - b);
  return <div className="reader-controls">
    <button className="button secondary" aria-label={outlineVisible ? '收起目录' : '显示目录'} aria-pressed={outlineVisible} onClick={toggleOutline}><Icon name="book" />目录</button>
    <span className="reader-language"><span>原文</span><button disabled title="翻译能力后续支持">译文 · 预留</button></span>
    <div className="page-controls">
      <button className="icon-button" aria-label="上一页" disabled={!ready || page <= 1} onClick={() => navigate(page - 1)}><Icon name="back" /></button>
      <details className="page-picker" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; } }}><summary aria-label="跳转页码"><span data-testid="page-indicator"><span className="reader-sr">PDF 第 </span>{page} / {total}<span className="reader-sr"> 页</span></span></summary>
      <form className="page-jump" onSubmit={event => {
        event.preventDefault(); const target = parsePage(input, total);
        if (target === null) setError('请输入 1～' + total + ' 的整数页码。');
        else { navigate(target); setError(''); event.currentTarget.closest('details')?.removeAttribute('open'); }
      }}>
        <input aria-label="跳转到 PDF 页" inputMode="numeric" value={input} onChange={event => setInput(event.target.value)} disabled={!ready} />
        <button className="button secondary" type="submit" disabled={!ready}>跳转</button>
      </form></details>
      <button className="icon-button" aria-label="下一页" disabled={!ready || page >= total} onClick={() => navigate(page + 1)}><Icon name="next" /></button>
      {label && <span className="page-label">书内页码：{label}</span>}
    </div>
    <div className="zoom-controls">
      <button className="icon-button" aria-label="缩小" disabled={!ready || percent <= MIN_ZOOM} onClick={() => setZoom({ mode: 'percent', percent: Math.max(MIN_ZOOM, percent - 25) })}>−</button>
      <select aria-label="缩放" disabled={!ready} value={zoom.mode === 'fit-width' ? 'fit-width' : String(zoom.percent)}
        onChange={event => setZoom(event.target.value === 'fit-width' ? { mode: 'fit-width' } : { mode: 'percent', percent: Number(event.target.value) })}>
        <option value="fit-width">适应宽度</option>{presets.map(value => <option key={value} value={value}>{value}%</option>)}
      </select>
      <button className="icon-button" aria-label="放大" disabled={!ready || percent >= MAX_ZOOM} onClick={() => setZoom({ mode: 'percent', percent: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, percent + 25)) })}>+</button>
    </div>
    <details className="reader-more" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; } }}><summary>更多</summary><div className="reader-more-menu">
    <button className="button secondary" onClick={toggleCitations}>引用 {citations}</button>
    <button className="button secondary" aria-pressed={externalOpen} onClick={toggleExternal}>外部对话</button>
    {toggleMessages && <button className="button secondary" onClick={toggleMessages}>回传记录</button>}
    <button className="button secondary" onClick={toggleNotes}>笔记</button>
    </div></details>
    {error && <p className="navigation-error" role="alert">{error}</p>}
  </div>;
}

