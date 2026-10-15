import type { ImportChoice, ImportCandidate, ImportStage } from '../library/model';
import { Modal } from './Modal';
import { Icon } from './Icon';

const stages: Record<ImportStage, string> = { checking: '正在检查文件', hashing: '正在识别文件',
  inspecting: '正在检查 PDF 页面', saving: '正在保存到书架' };

export function ImportFeedback({ state, onCancel, onChoose, onRetry, onDismiss }: {
  state: { file?: File; stage?: ImportStage; candidate?: ImportCandidate; error?: string; message?: string };
  onCancel: () => void; onChoose: (choice: ImportChoice) => void; onRetry: () => void; onDismiss: () => void;
}) {
  return <>
    {state.candidate && <Modal title="这本 PDF 已在书架中" onClose={onCancel}>
      <div className="modal-body"><p className="muted">打开已有记录，或创建一份笔记和进度独立的副本。</p>
        <div className="duplicate-list">{state.candidate.duplicates.map(book =>
          <button key={book.id} className="duplicate-choice" onClick={() => onChoose({ type: 'open', bookId: book.id })}>
            <Icon name="book" /><span>{book.title}</span><span className="muted">打开已有</span><Icon name="arrow" />
          </button>)}</div>
        <div className="dialog-actions"><button className="button secondary" onClick={onCancel}>取消</button>
          <button className="button primary" onClick={() => onChoose({ type: 'create' })}>另存一份</button></div>
      </div>
    </Modal>}
    {(state.stage || state.error || state.message) && <aside className={`feedback ${state.error ? 'feedback-error' : ''}`}
      role={state.error ? 'alert' : 'status'} aria-live="polite">
      <Icon name={state.error ? 'file' : state.stage ? 'file' : 'check'} />
      <div><strong>{state.stage ? stages[state.stage] : state.error ? '导入未完成' : state.message}</strong>
        {state.error && <p>{state.error}</p>}
        {state.stage && <p>{state.file?.name}{state.stage === 'saving' ? ' · 保存完成后加入书架' : ''}</p>}
      </div>
      {state.stage ? <button className="button text" onClick={onCancel} disabled={state.stage === 'saving'}>取消</button>
        : <>{state.error && state.file && <button className="button text" onClick={onRetry}>重试</button>}
          <button className="icon-button" aria-label="关闭提示" onClick={onDismiss}><Icon name="close" size={16} /></button></>}
    </aside>}
  </>;
}
