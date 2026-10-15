import type { CitationState } from './useCitations';
import { intentLabels, MAX_QUOTE_LENGTH, type CitationIntent } from './model';
import '../styles/citations.css';

export function CitationTray({ state, locate, createNote }: {
  state: CitationState; locate: (source: CitationState['items'][number]) => void;
  createNote: (source: CitationState['draft'], citation?: CitationState['items'][number]) => void;
}) {
  const { draft, items } = state;
  if (!draft && !state.visible && !state.message) return null;
  return <section className="citation-tray" aria-label="选段与引用">
    {draft && <div className="citation-draft">
      <div className="citation-heading"><strong>选段 · PDF 第 {draft.source.page} 页</strong>
        <button className="button text" onClick={state.clear}>取消选择</button></div>
      <blockquote aria-label="选中原文">{draft.source.rawText}</blockquote>
      <div className="citation-actions">
        {(['explain', 'example', 'question', 'note'] as CitationIntent[]).map(intent =>
          <button key={intent} className="button secondary" aria-pressed={draft.intent === intent}
            onClick={() => state.setDraft(previous => previous && { ...previous, intent })}>{intentLabels[intent]}</button>)}
        <button className="button secondary" onClick={() => void state.copy()}>复制原文</button>
      </div>
      <label className="citation-editor">{draft.intent === 'note' ? '笔记草稿' : '编辑文本'}
        <textarea aria-label="编辑文本" rows={2} maxLength={MAX_QUOTE_LENGTH} value={draft.editedText}
          onChange={event => state.setDraft(previous => previous && { ...previous, editedText: event.target.value })} /></label>
      <div className="citation-heading"><span>原文单独保留。问答与笔记内容在此保存为本地草稿。</span>
        <button className="button secondary" onClick={() => createNote(draft)}>保存为摘录笔记</button>
        <button className="button secondary" disabled={state.saving || !draft.editedText.trim()} onClick={() => void state.save()}>
          {state.saving ? '正在保存' : '保存引用草稿'}</button></div>
    </div>}
    {state.visible && <div className="citation-list">
      <div className="citation-heading"><strong>引用草稿 · {items.length}</strong>
        <button className="button text" onClick={() => state.setVisible(false)}>收起引用</button></div>
      {!items.length && <p>选取页内文字后，可保存带原文位置的引用草稿。</p>}
      {items.map(item => <article key={item.id} data-testid="citation-card">
        <div><span>{intentLabels[item.intent]} · PDF 第 {item.page} 页</span><p>{item.editedText}</p>
          <details><summary>查看原文</summary><blockquote>{item.rawText}</blockquote></details></div>
        <button className="button secondary" onClick={() => locate(item)}>定位原文</button>
        <button className="button secondary" onClick={() => createNote(null, item)}>保存为摘录笔记</button>
      </article>)}
    </div>}
    {state.message && <p className="citation-message" role="status">{state.message}</p>}
  </section>;
}
