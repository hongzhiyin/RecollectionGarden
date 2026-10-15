import type { BookView } from '../library/model';
import { Icon } from './Icon';

export function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MiB` : `${Math.ceil(bytes / 1024)} KiB`;
}

export function BookCard({ book, onOpen, onRename, onNotes }: {
  book: BookView; onOpen: (book: BookView) => void; onRename: (book: BookView) => void;
  onNotes: (book: BookView) => void;
}) {
  const progress = book.progress;
  return <article className="book-card" aria-label={book.title} data-testid="book-card">
    <button className="cover" onClick={() => onOpen(book)} disabled={!book.available} aria-label={`阅读 ${book.title}`}>
      {book.thumbnail ? <img src={book.thumbnail} alt={`${book.title} 第一页预览`} /> : <Icon name="book" size={64} />}
      <span className="cover-tag">PDF</span>
      <span className="cover-open"><Icon name="arrow" />打开阅读</span>
    </button>
    <div className="book-detail">
      <div className="book-title-row"><h3 title={book.title}>{book.title}</h3>
        <button className="icon-button" aria-label={`重命名 ${book.title}`} onClick={() => onRename(book)}><Icon name="edit" size={17} /></button>
      </div>
      <p className="book-meta">{book.available ? `${book.pages} 页 · ${formatSize(book.size)}` : '文件暂不可用'}</p>
      <div className="book-status"><span className={progress ? 'status-dot active' : 'status-dot'} />
        {!book.available ? '重新导入原 PDF 可恢复文件' : progress ? `阅读中 · 第 ${progress.page} / ${book.pages} 页` : '未开始阅读'}
      </div>
      {progress && <time className="last-read">最近阅读 {new Date(progress.lastReadAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>}
      <button className="button secondary" onClick={() => onNotes(book)}>笔记</button>
    </div>
  </article>;
}
