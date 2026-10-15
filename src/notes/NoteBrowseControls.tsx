import type { NoteBrowse } from './useNoteBrowse';
import type { NoteCriteria } from './discoveryProtocol';

export function NoteBrowseControls({ browse }: { browse: NoteBrowse }) {
  return <div className="note-browse-controls">
    <input aria-label="搜索笔记" placeholder="搜索已保存笔记" maxLength={200} value={browse.query} onChange={e => browse.setQuery(e.target.value)} />
    <select aria-label="笔记类型" value={browse.kind ?? ''} onChange={e => browse.setKind((e.target.value || undefined) as NoteCriteria['kind'])}>
      <option value="">全部类型</option><option value="quote">摘录</option><option value="answer">AI 回答</option><option value="page">页笔记</option>
    </select>
    <select aria-label="笔记排序" value={browse.sort} onChange={e => browse.setSort(e.target.value as NoteCriteria['sort'])}>
      <option value="created_desc">创建时间 · 最新优先</option><option value="created_asc">创建时间 · 最早优先</option><option value="page_asc">PDF 页码</option>
    </select>
    <button className="button secondary" disabled={browse.exporting} onClick={() => void browse.exportNotes(false)}>导出全部笔记</button>
    <button className="button secondary" disabled={browse.exporting} onClick={() => void browse.exportNotes(true)}>导出检索结果</button>
  </div>;
}
