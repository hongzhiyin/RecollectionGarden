import type { Note } from './model';
import { noteKindLabels } from './model';

const escapeText = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replace(/[\\`*_{}\[\]()#+.!|~\-]/gu, '\\$&');
const quote = (text: string) => text.replace(/\r\n?/gu, '\n').split('\n').map(line => '> ' + escapeText(line) + '  ').join('\n');
export function markdownNotes(book: { id: string; title: string }, notes: Note[]) {
  const lines = ['# ' + escapeText(book.title), '', '书籍 ID：' + escapeText(book.id), '', '笔记数量：' + notes.length, ''];
  if (!notes.length) lines.push('暂无笔记。', '');
  for (const note of notes) {
    lines.push('## ' + escapeText(note.title), '', noteKindLabels[note.kind] + ' · PDF 第 ' + note.page + ' 页',
      '', '笔记 ID：' + escapeText(note.id) + ' · 版本 ' + note.revision,
      '', '创建时间：' + new Date(note.createdAt).toISOString(), '');
    for (const source of note.sources) lines.push('### 原文摘录 · PDF 第 ' + source.page + ' 页', '',
      '来源文件摘要：' + source.assetHash, '', quote(source.rawText), '');
    if (note.aiSnapshot) {
      if (note.aiSnapshot.questionText !== undefined) lines.push('### 已保存问题', '', quote(note.aiSnapshot.questionText), '');
      lines.push('### AI 回答快照', '', '来源：' + escapeText(note.aiSnapshot.sourceLabel),
        '', '消息：' + escapeText(note.aiSnapshot.conversationId) + ' / ' + escapeText(note.aiSnapshot.messageId),
        '', quote(note.aiSnapshot.text), '');
    }
    lines.push('### 个人理解与疑问', '', note.userContent ? quote(note.userContent) : '（未填写）', '');
  }
  return lines.join('\n');
}
export function exportFileName(title: string) {
  const safe = Array.from(title.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/gu, '_').replace(/^\.+|\.+$/gu, '').trim()).slice(0, 80).join('');
  return (safe || '笔记') + ' · 笔记.md';
}
export function utf8Chunks(text: string, maxBytes = 64 * 1024) {
  if (!Number.isInteger(maxBytes) || maxBytes < 4) throw new RangeError('UTF-8 chunk size must be at least 4 bytes.');
  const bytes = new TextEncoder().encode(text), decoder = new TextDecoder(), result: string[] = [];
  for (let start = 0; start < bytes.length;) {
    let end = Math.min(start + maxBytes, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    result.push(decoder.decode(bytes.subarray(start, end))); start = end;
  }
  return result.length ? result : [''];
}
