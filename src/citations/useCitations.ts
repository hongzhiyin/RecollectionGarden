import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { citations } from './repository';
import { cleanQuote } from './anchors';
import type { Citation, CitationIntent, QuoteSource } from './model';

export interface CitationDraft { source: QuoteSource; intent: CitationIntent; editedText: string }

export function useCitations(bookId: string) {
  const [items, setItems] = useState<Citation[]>([]);
  const [draft, setDraft] = useState<CitationDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<QuoteSource>();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const query = liveQuery(() => citations.list(bookId)).subscribe({ next: setItems,
      error: () => setMessage('引用加载失败，请重开阅读器后重试。') });
    return () => query.unsubscribe();
  }, [bookId]);
  function pick(source: QuoteSource | null) {
    if (!source) { setDraft(null); return; }
    setDraft(previous => previous?.source.page === source.page && previous.source.rawText === source.rawText
      && previous.source.anchor.start === source.anchor.start ? previous : { source, intent: 'quote', editedText: cleanQuote(source.rawText) });
    setTarget(undefined); setMessage('');
  }
  function clear() { setDraft(null); window.getSelection()?.removeAllRanges(); }
  async function save() {
    if (!draft || saving) return;
    const captured = draft; setSaving(true); setMessage('');
    try {
      const item = await citations.save(captured.source, captured.intent, captured.editedText);
      setItems(previous => [item, ...previous.filter(existing => existing.id !== item.id)]); setVisible(true);
      setDraft(previous => previous === captured ? null : previous); window.getSelection()?.removeAllRanges();
      setMessage('引用草稿已保存');
    } catch { setMessage('引用保存失败，请重试；当前草稿已保留。'); }
    finally { setSaving(false); }
  }
  async function copy() {
    if (!draft) return;
    try { await navigator.clipboard.writeText(draft.source.rawText); setMessage('原文已复制'); }
    catch { setMessage('复制失败，可选中下方原文手动复制。'); }
  }
  return { items, draft, saving, message, target, visible, pick, clear, save, copy, setDraft, setTarget, setMessage, setVisible, setItems };
}

export type CitationState = ReturnType<typeof useCitations>;
