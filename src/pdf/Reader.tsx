import { useCallback, useState } from 'react';
import type { BookView, ReaderLocation, ReaderZoom } from '../library/model';
import { Modal } from '../ui/Modal';
import { useReadingPosition } from './useReadingPosition';
import { usePdfDocument } from './usePdfDocument';
import { usePageRenderer } from './usePageRenderer';
import { usePositionWriter } from './usePositionWriter';
import { OutlinePanel } from './OutlinePanel';
import { ReaderToolbar } from './ReaderToolbar';
import { TextPage } from './TextPage';
import { useCitations } from '../citations/useCitations';
import { CitationTray } from '../citations/CitationTray';
import { citations } from '../citations/repository';
import { ConversationPanel } from '../external/ConversationPanel';
import { useReaderEndpoint } from '../external/useReaderEndpoint';
import { BridgeError } from '../external/protocol';
import { useNoteEditor } from '../notes/useNoteEditor';
import { NotesPanel } from '../notes/NotesPanel';
import { NoteDialogs } from '../notes/NoteDialogs';
import { pageText } from './pageText';
import { locateQuote } from '../citations/anchors';
import type { NoteTarget } from '../notes/discoveryRepository';
import { useBridge } from '../external/BridgeProvider';
import '../styles/reader.css';

export function Reader({ book, onClose, onProgress }: {
  book: BookView; onClose: () => void; onProgress: () => Promise<void>;
}) {
  const position = useReadingPosition(book);
  const bridge = useBridge();
  const { view, setView } = position;
  const [externalVisible, setExternalVisible] = useState(false);
  const [notesVisible, setNotesVisible] = useState(false);
  const [outlineVisible, setOutlineVisible] = useState(true);
  const [closeError, setCloseError] = useState(false);
  const [closing, setClosing] = useState(false);
  const session = usePdfDocument(book.id);
  const noteEditor = useNoteEditor(book.id, async source => {
    if (!session.document) throw new BridgeError('NOT_READY', '来源 PDF 尚未打开。');
    if (source.bookId !== book.id || source.assetHash !== book.assetHash
      || !locateQuote(await pageText(session.document, source.page), source.rawText, source.anchor))
      throw new BridgeError('INVALID_SOURCE', '原文无法核验。');
  });
  const persistence = usePositionWriter(book.id, onProgress);
  const capture = useCallback((location: ReaderLocation) => {
    if (!position.original.current) persistence.writer.capture(location);
  }, [persistence.writer, position.original]);
  const rendering = usePageRenderer(session.document, view, capture);
  const references = useCitations(book.id);
  function navigate(page: number, zoom?: ReaderZoom) {
    const total = session.document?.numPages ?? book.pages;
    if (!Number.isInteger(page) || page < 1 || page > total) return;
    references.clear(); references.setTarget(undefined); references.setMessage('');
    setView(previous => ({ ...previous, page, zoom: zoom ?? previous.zoom, offsetX: 0, offsetY: 0 }));
  }
  function setZoom(zoom: ReaderZoom) {
    const position = rendering.displayed.current;
    setView(previous => ({ ...previous, offsetX: position?.offsetX ?? previous.offsetX,
      offsetY: position?.offsetY ?? previous.offsetY, zoom }));
  }
  async function locate(citationId: string) {
    const source = (await citations.list(book.id)).find(item => item.id === citationId);
    if (!source) throw new BridgeError('INVALID_SOURCE', '当前书籍中不存在此引用。');
    await locateSource({ page: source.page, assetHash: source.assetHash, source });
  }
  async function locateSource(target: NoteTarget) {
    if (target.assetHash !== book.assetHash || target.page < 1 || target.page > book.pages)
      throw new BridgeError('INVALID_SOURCE', '来源文件或页码无效。');
    await persistence.writer.flush();
    const location = rendering.displayed.current;
    if (!location) throw new BridgeError('NOT_READY', '请等待页面完成显示。');
    position.begin(location); navigate(target.page); references.setTarget(target.source);
    if (!target.source) references.setMessage('已定位来源页');
  }
  function returnToReading() {
    const location = position.finish();
    if (location) { references.setTarget(undefined); references.setMessage(''); rendering.restore(); setView(location); }
  }
  function continueHere() {
    if (rendering.loading || !rendering.displayed.current) throw new BridgeError('NOT_READY', '页面尚未完成显示。');
    position.finish(); persistence.writer.capture(rendering.displayed.current);
  }
  const locateFromWindow = (id: string) => { void locate(id).catch(error => references.setMessage(error instanceof Error ? error.message : '定位失败，请重试。')); };
  useReaderEndpoint({ book, view, pdf: session.document, references,
    current: () => rendering.displayed.current,
    ready: () => !!rendering.displayed.current && rendering.displayed.current.page === view.page
      && JSON.stringify(rendering.displayed.current.zoom) === JSON.stringify(view.zoom) && !rendering.loading && !rendering.error,
    original: () => position.original.current, navigate, locate, locateSource,
    flush: () => persistence.writer.flush(), error: () => session.error || rendering.error || undefined, returnToReading, continueHere });
  async function close() {
    if (closing) return;
    setClosing(true);
    try { await persistence.writer.flush(); onClose(); }
    catch { setCloseError(true); }
    finally { setClosing(false); }
  }
  const error = session.error || rendering.error;
  const paintMatches = rendering.displayed.current?.page === view.page
    && JSON.stringify(rendering.displayed.current?.zoom) === JSON.stringify(view.zoom);
  const status = session.error ? 'PDF 无法打开' : !session.document ? '正在打开 PDF'
    : rendering.error ? '页面显示失败' : rendering.loading || !paintMatches ? '正在显示页面' : position.preview ? '临时查看原文' : persistence.status;
  return <><Modal title={book.title} onClose={() => noteEditor.request(() => void close())} wide>
    <ReaderToolbar page={view.page} total={session.document?.numPages ?? book.pages}
      label={session.labels[view.page - 1]} zoom={view.zoom} scalePercent={rendering.scalePercent}
      ready={!!session.document && !closing} outlineVisible={outlineVisible} navigate={navigate} setZoom={setZoom}
      toggleOutline={() => setOutlineVisible(value => !value)} citations={references.items.length}
      toggleCitations={() => { setNotesVisible(false); setExternalVisible(false); references.setVisible(value => !value); }}
      toggleExternal={() => { setNotesVisible(false); setExternalVisible(value => !value); }}
      toggleNotes={() => { setExternalVisible(false); setNotesVisible(value => !value); }} />
    <div className="reader-layout">
      {outlineVisible && <OutlinePanel document={session.document} items={session.outline} loading={session.metadataLoading}
        error={session.outlineError} navigate={navigate} />}
      <div ref={rendering.viewport} className="reader-viewport" aria-label="阅读页面" onScroll={rendering.onScroll}>
        <div ref={rendering.surface} className="reader-surface">
          <div className="pdf-page"><canvas ref={rendering.canvas} aria-label={book.title + ' 第 ' + view.page + ' 页'}
            style={{ opacity: rendering.loading || !paintMatches || error ? 0 : 1 }} />
            <TextPage document={session.document} paint={rendering.paint} active={!rendering.loading && paintMatches && !error}
              bookId={book.id} assetHash={book.assetHash} target={references.target}
              onSelect={source => { if (source) { setExternalVisible(false); setNotesVisible(false); } references.pick(source); }} onLocated={references.setMessage} />
          </div>
        </div>
        {(rendering.loading || !paintMatches) && !error && <p className="reader-overlay" role="status">正在显示页面</p>}
        {error && <div className="reader-overlay"><p className="field-error" role="alert">{error}</p>
          <button className="button secondary" onClick={session.error ? session.retry : rendering.retry}>重试页面</button></div>}
      </div>
    </div>
    {notesVisible ? <NotesPanel state={noteEditor} page={view.page} canCreate={!!session.document}
      locate={(id, index) => noteEditor.request(() => { void bridge.locateNote(book.id, id, index).catch(error => noteEditor.notice(error.message)); })} />
      : externalVisible ? <ConversationPanel bookId={book.id} locate={locateFromWindow} createNote={message => {
        void citations.list(book.id).then(items => {
          const sources = message.citationIds.map(id => items.find(item => item.id === id)).filter(item => !!item);
          noteEditor.start({ kind: 'answer', conversationId: message.conversationId, messageId: message.messageId,
            expectedSequence: message.sequence, page: sources[0]?.page ?? view.page }, { sources, aiText: message.text, aiLabel: message.sourceLabel });
          setExternalVisible(false); setNotesVisible(true);
        }).catch(() => { setExternalVisible(false); setNotesVisible(true); noteEditor.notice('笔记来源读取失败，请重试。'); });
      }} /> : <CitationTray state={references} locate={source => locateFromWindow(source.id)} createNote={(draft, citation) => {
        const source = draft?.source ?? citation!;
        noteEditor.start(citation ? { kind: 'quote', citationId: citation.id } : { kind: 'quote', source }, { sources: [source] });
        setNotesVisible(true);
      }} />}
    {position.preview && <div className="reading-preview"><span>临时查看，不改变主阅读进度。{references.message.includes('定位') ? references.message : ''}</span>
      <button className="button secondary" onClick={returnToReading}>返回阅读处</button>
      <button className="button secondary" onClick={continueHere}>从这里继续</button></div>}
    <footer className="reader-status"><span role="status">{status}</span>
      {persistence.status.includes('保存失败') && <button className="button text" onClick={() => void persistence.writer.flush().catch(() => {})}>重试保存</button>}
      {closeError && <><span>位置未保存，关闭后会恢复最后成功保存的位置。</span>
        <button className="button text" onClick={onClose}>仍然关闭</button></>}
      {closing && <span>正在完成保存</span>}
    </footer>
  </Modal><NoteDialogs state={noteEditor} /></>;
}
