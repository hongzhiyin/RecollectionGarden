import type { NoteEditorState } from './useNoteEditor';

export function NoteEditor({ state }: { state: NoteEditorState }) {
  const draft = state.draft;
  if (!draft) return <p>选择一条笔记，或从选段、AI 回答和当前页创建。</p>;
  return <div className="note-editor" data-testid="note-editor">
    <label>笔记标题<input aria-label="笔记标题" maxLength={120} value={draft.title} disabled={state.saving}
      onChange={event => state.setTitle(event.target.value)} /></label>
    {!!draft.preview.sources?.length && <details open><summary>原文摘录 · 来源单独保留</summary>
      {draft.preview.sources.map((source, index) => <blockquote key={index} aria-label="笔记原文">
        <small>PDF 第 {source.page} 页</small><p>{source.rawText}</p></blockquote>)}</details>}
    {draft.preview.aiText && <details open><summary>AI 回答快照 · {draft.preview.aiLabel}</summary>
      {draft.note?.aiSnapshot?.questionText && <p>{draft.note.aiSnapshot.questionText}</p>}
      <p className="note-snapshot" aria-label="笔记 AI 回答">{draft.preview.aiText}</p></details>}
    <label>个人理解与疑问<textarea aria-label="个人理解与疑问" rows={4} maxLength={20000}
      value={draft.userContent} disabled={state.saving} onChange={event => state.setContent(event.target.value)} /></label>
    <div className="note-actions"><span>{state.dirty ? '尚未保存' : `已保存 · 版本 ${draft.note?.revision ?? 1}`}</span>
      <button className="button primary" disabled={state.saving || !draft.title.trim()} onClick={() => void state.save()}>
        {state.saving ? '正在保存笔记' : '保存笔记'}</button>
      {draft.note && <><button className="button secondary" disabled={state.saving} onClick={() => state.open(draft.note!.id)}>重新读取笔记</button>
        <button className="button text" disabled={state.saving} onClick={state.askDelete}>删除笔记</button></>}
    </div>
  </div>;
}
