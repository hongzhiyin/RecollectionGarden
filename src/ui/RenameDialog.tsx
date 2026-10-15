import { useState } from 'react';
import type { BookView } from '../library/model';
import { library } from '../library/repository';
import { describeError } from '../library/errors';
import { Modal } from './Modal';

export function RenameDialog({ book, onClose, onSaved }: {
  book: BookView; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(book.title);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true); setError('');
    try { await library.rename(book.id, title); await onSaved(); onClose(); }
    catch (error) { setError(describeError(error)); }
    finally { setPending(false); }
  }
  return <Modal title="重命名书籍" onClose={() => { if (!pending) onClose(); }}>
    <form className="modal-body" onSubmit={save}>
      <label className="field-label" htmlFor="book-title">书名</label>
      <input id="book-title" className="text-input" data-autofocus value={title} maxLength={120} required
        onChange={event => setTitle(event.target.value)} disabled={pending} />
      <p className="field-help">修改名称不会改变原 PDF、笔记或阅读位置。</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose} disabled={pending}>取消</button>
        <button type="submit" className="button primary" disabled={pending || !title.trim()}>{pending ? '保存中' : '保存'}</button></div>
    </form>
  </Modal>;
}
