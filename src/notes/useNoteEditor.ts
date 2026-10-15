import { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { useBridge } from '../external/BridgeProvider';
import { notes, noteCommand, type SourceVerifier } from './repository';
import type { Note, NoteMetadata } from './model';
import type { NoteCreateInput } from './protocol';
import type { QuoteSource } from '../citations/model';

export interface NotePreview { sources?: QuoteSource[]; aiText?: string; aiLabel?: string }
interface Draft { note?: Note; input?: NoteCreateInput; title: string; userContent: string; preview: NotePreview }
export function useNoteEditor(bookId: string, verify?: SourceVerifier) {
  const [items, setItems] = useState<NoteMetadata[]>([]);
  const [draft, setDraft] = useState<Draft>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const retry = useRef<{ signature: string; id: string } | undefined>(undefined);
  const current = useRef({ draft, saving }); current.current = { draft, saving };
  const bridge = useBridge();
  const dirty = !!draft && (!draft.note || draft.title !== draft.note.title || draft.userContent !== draft.note.userContent);
  const dirtyRef = useRef(false); dirtyRef.current = dirty || saving;
  useEffect(() => bridge.attachLeaveGuard(() => dirtyRef.current), [bridge.attachLeaveGuard]);
  useEffect(() => {
    const query = liveQuery(() => notes.list(bookId)).subscribe({ next: setItems,
      error: () => setMessage('笔记读取失败，请重开后重试。') });
    return () => query.unsubscribe();
  }, [bookId]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, []);
  function request(action: () => void) {
    if (current.current.saving) { setMessage('正在保存，请稍候。'); return; }
    if (dirtyRef.current) setPending(() => action); else action();
  }
  function display(note: Note) {
    setDraft({ note, title: note.title, userContent: note.userContent,
      preview: { sources: note.sources, aiText: note.aiSnapshot?.text, aiLabel: note.aiSnapshot?.sourceLabel } });
  }
  async function open(noteId: string) {
    try { display(await notes.get(bookId, noteId)); setMessage(''); }
    catch { setMessage('笔记已不存在或无法读取。'); }
  }
  function start(input: NoteCreateInput, preview: NotePreview = {}) {
    const page = preview.sources?.[0]?.page ?? ('page' in input ? input.page : undefined);
    request(() => { setDraft({ input, title: input.title ?? `${input.kind === 'answer' ? 'AI 回答' : input.kind === 'quote' ? '摘录' : '页笔记'} · PDF 第 ${page ?? '?'} 页`,
      userContent: input.userContent ?? '', preview }); setMessage(''); });
  }
  async function save() {
    const captured = current.current.draft;
    if (!captured || current.current.saving) return false;
    const params = captured.note ? { noteId: captured.note.id, expectedRevision: captured.note.revision,
      title: captured.title, userContent: captured.userContent } : { ...captured.input!, title: captured.title, userContent: captured.userContent };
    const operation = captured.note ? 'notes.update' : 'notes.create';
    const signature = JSON.stringify({ operation, params });
    if (retry.current?.signature !== signature) retry.current = { signature, id: crypto.randomUUID() };
    current.current.saving = true; setSaving(true); setMessage('');
    try {
      const result = await notes.execute(noteCommand(operation, bookId, params, retry.current.id), verify) as Note | { created: boolean; note: Note };
      const note = 'created' in result ? result.note : result;
      if ('created' in result && !result.created && captured.userContent.trim()) {
        setDraft({ ...captured, note, input: undefined });
        setMessage('该回答已有笔记，当前输入已保留；确认合并后再次保存。'); return false;
      }
      display(note); setMessage('created' in result && !result.created ? '该回答已保存，已打开原笔记。' : '笔记已保存');
      retry.current = undefined; return true;
    } catch (error) {
      setMessage(error instanceof Error && 'code' in error ? error.message : '笔记保存失败，输入已保留，请重试。'); return false;
    } finally { current.current.saving = false; setSaving(false); }
  }
  async function remove() {
    const note = current.current.draft?.note;
    if (!note || current.current.saving) return;
    current.current.saving = true; setSaving(true);
    try {
      await notes.execute(noteCommand('notes.delete', bookId, { noteId: note.id, expectedRevision: note.revision, confirmed: true }));
      setDraft(undefined); setDeletePending(false); setMessage('笔记已删除');
    } catch (error) { setMessage(error instanceof Error ? error.message : '删除失败，请重试。'); }
    finally { current.current.saving = false; setSaving(false); }
  }
  return { bookId, items, draft, saving, dirty, message, pending, deletePending, request, start,
    notice: setMessage,
    open: (id: string) => request(() => void open(id)), save, remove,
    setTitle: (title: string) => setDraft(previous => previous && { ...previous, title }),
    setContent: (userContent: string) => setDraft(previous => previous && { ...previous, userContent }),
    askDelete: () => request(() => setDeletePending(true)), cancelDelete: () => setDeletePending(false),
    cancelLeave: () => setPending(null), discard: () => { setDraft(undefined); setPending(null); pending?.(); },
    saveAndLeave: async () => { if (await save()) { setPending(null); pending?.(); } },
  };
}
export type NoteEditorState = ReturnType<typeof useNoteEditor>;
