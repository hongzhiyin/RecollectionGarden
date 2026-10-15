import { Modal } from '../ui/Modal';
import type { NoteEditorState } from './useNoteEditor';

export function NoteDialogs({ state }: { state: NoteEditorState }) {
  return <>
    {state.pending && <Modal title="笔记尚未保存" onClose={state.cancelLeave}>
      <div className="modal-body"><p>保存后继续，或明确放弃当前输入。</p><div className="note-actions">
        <button className="button primary" disabled={state.saving} onClick={() => void state.saveAndLeave()}>保存并继续</button>
        <button className="button secondary" disabled={state.saving} onClick={state.discard}>放弃输入</button>
        <button className="button secondary" onClick={state.cancelLeave}>取消切换</button>
      </div></div></Modal>}
    {state.deletePending && <Modal title="删除笔记" onClose={state.cancelDelete}>
      <div className="modal-body"><p>删除“{state.draft?.note?.title}”？原 PDF、引用和会话会保留。</p><div className="note-actions">
        <button className="button primary" disabled={state.saving} onClick={() => void state.remove()}>确认删除笔记</button>
        <button className="button secondary" onClick={state.cancelDelete}>取消删除</button>
      </div></div></Modal>}
  </>;
}
