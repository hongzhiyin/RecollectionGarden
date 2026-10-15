import type { BookView } from '../library/model';
import { Modal } from '../ui/Modal';
import { NotesPanel } from './NotesPanel';
import { NoteDialogs } from './NoteDialogs';
import { useNoteEditor } from './useNoteEditor';
import { useBridge } from '../external/BridgeProvider';

export function NotesDialog({ book, onClose }: { book: BookView; onClose: () => void }) {
  const state = useNoteEditor(book.id);
  const bridge = useBridge();
  return <><Modal title={book.title + ' · 笔记'} onClose={() => state.request(onClose)}>
    <div className="modal-body"><NotesPanel state={state} page={book.progress?.page ?? 1} canCreate={book.available}
      locate={(id, index) => state.request(() => { void bridge.locateNote(book.id, id, index).catch(error => state.notice(error.message)); })} /></div>
  </Modal><NoteDialogs state={state} /></>;
}
