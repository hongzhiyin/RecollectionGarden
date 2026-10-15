import { lazy, Suspense, useDeferredValue, useRef, useState, useEffect } from 'react';
import type { Book, BookView } from './library/model';
import { useLibrary } from './library/useLibrary';
import { useImport } from './import/useImport';
import { BookCard } from './ui/BookCard';
import { ImportFeedback } from './ui/ImportFeedback';
import { RenameDialog } from './ui/RenameDialog';
import { Icon } from './ui/Icon';
import { library } from './library/repository';
import packageInfo from '../package.json';
import { useBridge } from './external/BridgeProvider';
import { BridgeConnection } from './external/ConversationPanel';
import { DatabaseNotice } from './ui/DatabaseNotice';
import { BridgeError } from './external/protocol';

const Reader = lazy(() => import('./pdf/Reader').then(module => ({ default: module.Reader })));
const NotesDialog = lazy(() => import('./notes/NotesDialog').then(module => ({ default: module.NotesDialog })));

export default function App() {
  const { books, loading, error, refresh, changed } = useLibrary();
  const bridge = useBridge();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [reader, setReader] = useState<BookView>();
  const [rename, setRename] = useState<BookView>();
  const [notesBook, setNotesBook] = useState<BookView>();
  const [dragging, setDragging] = useState(false);
  useEffect(() => bridge.attachApp(async bookId => {
    const book = (await library.list()).find(item => item.id === bookId);
    if (!book) throw new BridgeError('MISSING_BOOK', '书籍已不存在。');
    if (!book.available) throw new BridgeError('MISSING_ASSET', '来源 PDF 不可用，笔记仍可检索和导出。');
    setNotesBook(undefined); setReader(book);
  }), [bridge.attachApp]);
  const fileInput = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  async function saved(book: Book, open: boolean) {
    await changed();
    if (open) {
      const result = await library.list();
      const view = result.find(item => item.id === book.id);
      if (view) setReader(view);
    }
  }
  const importer = useImport(saved);
  const busy = !!importer.state.stage || !!importer.state.candidate;
  const visible = books.filter(book => book.title.toLocaleLowerCase().includes(deferredQuery)
    && (filter === 'all' || (filter === 'unread' ? !book.progress : !!book.progress)));
  const selectFile = () => { if (!busy) fileInput.current?.click(); };
  return <div className="app-shell" onDragOver={event => {
    event.preventDefault(); if (!busy) setDragging(true);
  }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
    onDrop={event => {
      event.preventDefault(); setDragging(false);
      const file = event.dataTransfer.files[0]; if (file && !busy) void importer.start(file);
    }}>
    <header className="site-header">
      <div className="brand"><span className="brand-mark"><Icon name="book" size={25} /></span>
        <div><strong>流光忆庭</strong><span>Garden of Recollection</span></div></div>
      <div className="header-right"><span className="local-label">个人阅读空间</span>
        <button className="button primary" onClick={selectFile} disabled={busy}><Icon name="plus" />导入 PDF</button></div>
    </header>
    <DatabaseNotice /><main>
      <section className="library-heading"><div><p className="eyebrow">YOUR PERSONAL LIBRARY</p>
        <h1>书架<span className="book-count">{books.length}</span></h1>
        <p className="subtitle">读过的世界，从这里继续。</p></div>
        <div className="storage-note"><span className="status-dot active" />保存在此设备</div>
      </section>
      <BridgeConnection />
      <section className="library-controls" aria-label="筛选书籍">
        <div className="tabs">{[['all', '全部书籍'], ['unread', '未开始'], ['reading', '阅读中']].map(([key, label]) =>
          <button key={key} className={filter === key ? 'tab selected' : 'tab'} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
        <label className="search"><Icon name="search" size={18} /><input aria-label="搜索书籍" placeholder="搜索书名" value={query} onChange={event => setQuery(event.target.value)} /></label>
      </section>
      {error && <div className="load-error" role="alert"><p>书架读取失败：{error}</p><button className="button secondary" onClick={() => void refresh()}>重新加载</button></div>}
      {loading ? <div className="empty-state" role="status"><p>正在读取书架</p></div>
        : visible.length ? <section className="book-grid" aria-label="书籍列表">{visible.map(book =>
          <BookCard key={book.id} book={book} onOpen={setReader} onRename={setRename} onNotes={setNotesBook} />)}</section>
          : <section className="empty-state"><div className="empty-art"><Icon name="book" size={54} /><span className="empty-spark"><Icon name="plus" size={16} /></span></div>
            <h2>{books.length ? '没有找到这本书' : '第一本书，从这里开始'}</h2>
            <p>{books.length ? '试试其他书名，或切换筛选。' : '导入一本 PDF，留住阅读的位置与片刻。'}</p>
            {!books.length && <button className="button primary" onClick={selectFile} disabled={busy}><Icon name="plus" />选择 PDF 文件</button>}
            <span className="file-limit">PDF · 最大 32 MiB · 最多 2,000 页</span>
          </section>}
      <footer className="library-footer"><span>书籍与阅读记录保存在本地，清理存储数据会删除这些内容。</span><span>流光忆庭 · V{packageInfo.version}</span></footer>
    </main>
    <input ref={fileInput} data-testid="pdf-input" type="file" accept=".pdf,application/pdf" className="file-input"
      onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importer.start(file); }} />
    <ImportFeedback state={importer.state} onCancel={importer.cancel} onChoose={importer.choose}
      onRetry={() => { if (importer.state.file) void importer.start(importer.state.file); }} onDismiss={importer.dismiss} />
    {rename && <RenameDialog book={rename} onClose={() => setRename(undefined)} onSaved={changed} />}
    {notesBook && <Suspense fallback={<p role="status">正在读取笔记</p>}><NotesDialog book={notesBook} onClose={() => setNotesBook(undefined)} /></Suspense>}
    {reader && <Suspense fallback={<p className="feedback" role="status">正在加载阅读器</p>}>
      <Reader key={reader.id} book={reader} onClose={() => setReader(undefined)} onProgress={changed} />
    </Suspense>}
    {dragging && <div className="drop-overlay" aria-hidden="true"><Icon name="file" size={48} /><strong>放开文件，加入书架</strong><span>仅导入一个 PDF</span></div>}
  </div>;
}
