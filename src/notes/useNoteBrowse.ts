import { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { noteDiscovery } from './discoveryRepository';
import type { NoteCriteria } from './discoveryProtocol';

export function useNoteBrowse(bookId: string) {
  const [query, setQuery] = useState(''), [debounced, setDebounced] = useState('');
  const [kind, setKind] = useState<NoteCriteria['kind']>();
  const [sort, setSort] = useState<NoteCriteria['sort']>('created_desc');
  const [offset, setOffset] = useState(0), [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof noteDiscovery.search>>>();
  const [message, setMessage] = useState(''), [exporting, setExporting] = useState(false);
  const version = useRef<string | undefined>(undefined), latestQuery = useRef(query); latestQuery.current = query;
  const limit = 20;
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => { version.current = undefined; setOffset(0); }, [query, kind, sort, bookId]);
  useEffect(() => {
    let active = true; setLoading(true); setMessage('');
    const subscription = liveQuery(() => noteDiscovery.search(bookId, { query: debounced, kind, sort, offset, limit,
      ...(offset ? { expectedResultVersion: version.current } : {}) })).subscribe({
      next: data => {
        if (!active || debounced !== latestQuery.current) return;
        version.current = data.resultVersion; setResult(data); setLoading(false);
      },
      error: error => {
        if (!active) return;
        if (error?.code === 'RESULT_CHANGED') { version.current = undefined; setOffset(0); }
        setLoading(false); setMessage(error?.message ?? '笔记检索失败，请重开后重试。');
      },
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [bookId, debounced, kind, sort, offset]);
  async function exportNotes(filtered: boolean) {
    if (exporting) return;
    setExporting(true); setMessage('');
    try {
      const document = await noteDiscovery.exportDocument(bookId, filtered ? { query, kind, sort } : {});
      const url = URL.createObjectURL(new Blob([document.content], { type: document.mimeType }));
      try {
        const link = window.document.createElement('a');
        link.href = url; link.download = document.fileName; window.document.body.append(link);
        link.click(); link.remove();
        setMessage('已发起下载 · ' + document.noteCount + ' 条已保存笔记');
      } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (error) { setMessage(error instanceof Error ? error.message : '笔记导出失败，请重试。'); }
    finally { setExporting(false); }
  }
  return { query, kind, sort, setQuery, setKind, setSort, offset, limit, loading, exporting, result, message,
    exportNotes, previous: () => setOffset(value => Math.max(0, value - limit)), next: () => setOffset(value => value + limit) };
}
export type NoteBrowse = ReturnType<typeof useNoteBrowse>;
