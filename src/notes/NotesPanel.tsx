import { noteKindLabels } from './model';
import { NoteEditor } from './NoteEditor';
import type { NoteEditorState } from './useNoteEditor';
import '../styles/notes.css';
import { useNoteBrowse } from './useNoteBrowse';
import { NoteBrowseControls } from './NoteBrowseControls';

export function NotesPanel({ state, page, canCreate = true, locate }: {
  state: NoteEditorState; page: number; canCreate?: boolean; locate?: (id: string, sourceIndex?: number) => void;
}) {
  const browse = useNoteBrowse(state.bookId);
  const items = browse.result?.items ?? [];
  return <section className="notes-panel" aria-label="笔记面板">
    <div className="note-actions"><strong>笔记 · {browse.result?.total ?? state.items.length}</strong>
      <button className="button secondary" disabled={!canCreate} onClick={() => state.start({ kind: 'page', page })}>新建页笔记</button></div>
    <NoteBrowseControls browse={browse} />
    {state.dirty && <p className="note-export-hint">检索和导出只包含已保存内容，当前编辑输入保留。</p>}
    <div className="notes-layout"><nav className="notes-list" aria-label="书内笔记列表">
      {browse.loading && <p role="status">正在检索笔记</p>}
      {!items.length && !browse.loading && <p>{browse.query || browse.kind ? '没有找到笔记' : '暂无笔记'}</p>}
      {items.map(note => <button key={note.id} className="note-item" aria-pressed={state.draft?.note?.id === note.id}
        onClick={() => state.open(note.id)}><strong>{note.title}</strong><small>{noteKindLabels[note.kind]} · PDF 第 {note.page} 页</small>
        {note.snippet && <span className="note-snippet">{note.snippet}</span>}</button>)}
      {(!!browse.offset || browse.result?.hasMore) && <div className="note-actions">
        <button className="button secondary" disabled={!browse.offset || browse.loading} onClick={browse.previous}>上一批笔记</button>
        <button className="button secondary" disabled={!browse.result?.hasMore || browse.loading} onClick={browse.next}>下一批笔记</button>
      </div>}
    </nav><div className="note-detail"><NoteEditor state={state} />
      {locate && state.draft?.note && <div className="note-actions">
        {state.draft.note.sources.map((source, index) => <button key={source.citationId} className="button secondary"
          onClick={() => locate(state.draft!.note!.id, index)}>查看笔记原文 {index + 1}</button>)}
        {!state.draft.note.sources.length && <button className="button secondary" onClick={() => locate(state.draft!.note!.id)}>查看笔记来源页</button>}</div>}
      {browse.message && <p role="status">{browse.message}</p>}
      {state.message && <p role={state.message.includes('失败') || state.message.includes('更新') ? 'alert' : 'status'}>{state.message}</p>}
    </div></div>
  </section>;
}
