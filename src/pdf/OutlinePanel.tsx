import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { OutlineItem } from './usePdfDocument';
import { resolveDestination } from './navigation';

function Entry({ item, jump }: { item: OutlineItem; jump: (item: OutlineItem) => void }) {
  const [expanded, setExpanded] = useState(false);
  const nested = item.items?.length > 0;
  const title = item.title?.trim() || '未命名目录项';
  const navigable = !!item.dest && !item.url;
  return <li><div className="outline-row">
    {nested ? <button className="outline-toggle" aria-label={(expanded ? '收起 ' : '展开 ') + title}
      aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? '−' : '+'}</button> : <span className="outline-indent" />}
    {navigable ? <button className="outline-link" title={title} onClick={() => jump(item)}>{title}</button>
      : <span className="outline-group">{title}{item.url ? '（外部链接）' : ''}</span>}
  </div>
  {nested && expanded && <ul>{item.items.map((child, index) => <Entry key={index} item={child} jump={jump} />)}</ul>}</li>;
}

export function OutlinePanel({ document, items, loading, error, navigate }: {
  document?: PDFDocumentProxy; items: OutlineItem[]; loading: boolean; error: string; navigate: (page: number) => void;
}) {
  const [message, setMessage] = useState('');
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, [document]);
  async function jump(item: OutlineItem) {
    if (!document) return;
    const serial = ++request.current;
    setMessage('正在定位目录目标');
    try {
      const page = await resolveDestination(document, item.dest);
      if (serial !== request.current) return;
      navigate(page); setMessage('');
    } catch { if (serial === request.current) setMessage('目录目标无法定位，阅读位置未改变。'); }
  }
  return <aside className="outline-panel" aria-label="PDF 目录">
    <h3>目录</h3>
    {loading ? <p className="outline-note" role="status">正在读取目录</p>
      : error ? <p className="outline-note" role="status">{error}</p>
        : !items.length ? <p className="outline-note">此 PDF 没有内置目录，可使用页码导航。</p>
          : <ul className="outline-tree">{items.map((item, index) => <Entry key={index} item={item} jump={item => void jump(item)} />)}</ul>}
    {message && <p className="outline-note" role="status">{message}</p>}
  </aside>;
}

