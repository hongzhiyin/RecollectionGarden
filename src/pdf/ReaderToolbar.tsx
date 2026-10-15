import { useEffect, useState } from 'react';
import type { ReaderZoom } from '../library/model';
import { MAX_ZOOM, MIN_ZOOM, parsePage } from './navigation';
import { Icon } from '../ui/Icon';

export function ReaderToolbar({ page, total, label, zoom, scalePercent, ready, outlineVisible,
  navigate, setZoom, toggleOutline, citations, toggleCitations, toggleExternal, toggleNotes }: {
  page: number; total: number; label?: string; zoom: ReaderZoom; scalePercent: number; ready: boolean;
  outlineVisible: boolean; navigate: (page: number) => void; setZoom: (zoom: ReaderZoom) => void; toggleOutline: () => void;
  citations: number; toggleCitations: () => void;
  toggleExternal: () => void;
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
    <div className="page-controls">
      <button className="icon-button" aria-label="上一页" disabled={!ready || page <= 1} onClick={() => navigate(page - 1)}><Icon name="back" /></button>
      <span data-testid="page-indicator">PDF 第 {page} / {total} 页</span>
      <button className="icon-button" aria-label="下一页" disabled={!ready || page >= total} onClick={() => navigate(page + 1)}><Icon name="next" /></button>
      <form className="page-jump" onSubmit={event => {
        event.preventDefault(); const target = parsePage(input, total);
        if (target === null) setError('请输入 1～' + total + ' 的整数页码。');
        else { navigate(target); setError(''); }
      }}>
        <input aria-label="跳转到 PDF 页" inputMode="numeric" value={input} onChange={event => setInput(event.target.value)} disabled={!ready} />
        <button className="button secondary" type="submit" disabled={!ready}>跳转</button>
      </form>
      {label && <span className="page-label">书内页码：{label}</span>}
    </div>
    <button className="button secondary" onClick={toggleCitations}>引用 {citations}</button>
    <button className="button secondary" onClick={toggleExternal}>外部对话</button>
    <button className="button secondary" onClick={toggleNotes}>笔记</button>
    <div className="zoom-controls">
      <button className="icon-button" aria-label="缩小" disabled={!ready || percent <= MIN_ZOOM} onClick={() => setZoom({ mode: 'percent', percent: Math.max(MIN_ZOOM, percent - 25) })}>−</button>
      <select aria-label="缩放" disabled={!ready} value={zoom.mode === 'fit-width' ? 'fit-width' : String(zoom.percent)}
        onChange={event => setZoom(event.target.value === 'fit-width' ? { mode: 'fit-width' } : { mode: 'percent', percent: Number(event.target.value) })}>
        <option value="fit-width">适应宽度</option>{presets.map(value => <option key={value} value={value}>{value}%</option>)}
      </select>
      <button className="icon-button" aria-label="放大" disabled={!ready || percent >= MAX_ZOOM} onClick={() => setZoom({ mode: 'percent', percent: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, percent + 25)) })}>+</button>
    </div>
    {error && <p className="navigation-error" role="alert">{error}</p>}
  </div>;
}

