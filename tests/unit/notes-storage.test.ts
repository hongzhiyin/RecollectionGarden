import { afterEach, beforeEach, expect, it } from 'vitest';
import { noteFixture } from './notes-fixture';
import type { Note } from '../../src/notes/model';
import { publishMessage } from '../../src/external/storage';

let f: Awaited<ReturnType<typeof noteFixture>>;
beforeEach(async () => { f = await noteFixture(); });
afterEach(async () => { await f.database.delete(); });

it('摘录来源和个人内容独立保存，列表不返回正文，修改后原文不变', async () => {
  const created = await f.repository.execute(f.command('notes.create', { kind: 'quote', citationId: f.citation.id })) as { note: Note };
  const note = created.note;
  expect(note.sources[0].rawText).toBe('source'); expect(note.userContent).toBe('');
  const updated = await f.repository.execute(f.command('notes.update', { noteId: note.id, expectedRevision: 1,
    title: 'Personal note', userContent: 'My understanding' })) as Note;
  expect(updated.revision).toBe(2); expect(updated.sources).toEqual(note.sources);
  const list = await f.repository.list(f.book.id); expect(list).toHaveLength(1);
  expect(list[0]).not.toHaveProperty('sources'); expect(list[0]).not.toHaveProperty('userContent');
  await expect(f.repository.execute(f.command('notes.update', { noteId: note.id, expectedRevision: 1,
    title: 'old', userContent: 'old' }))).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  expect((await f.repository.get(f.book.id, note.id)).userContent).toBe('My understanding');
});

it('真实消息快照来自数据库，重试及重复保存不创建第二份，也不覆盖个人内容', async () => {
  const message = { conversationId: 'c', messageId: 'm', sequence: 1, text: 'Original AI answer',
    status: 'complete', role: 'assistant', citationIds: [f.citation.id], sourceLabel: 'AI' };
  await publishMessage(f.book.id, message, f.database);
  const request = f.command('notes.create', { kind: 'answer', conversationId: 'c', messageId: 'm', expectedSequence: 1 });
  const created = await f.repository.execute(request) as { created: boolean; note: Note };
  expect(await f.repository.execute(request)).toEqual(created);
  await f.repository.execute(f.command('notes.update', { noteId: created.note.id, expectedRevision: 1,
    title: 'Saved answer', userContent: 'Personal' }));
  await publishMessage(f.book.id, { ...message, sequence: 2, text: 'Later answer' }, f.database);
  const duplicate = await f.repository.execute(f.command('notes.create', { kind: 'answer', conversationId: 'c',
    messageId: 'm', expectedSequence: 2, userContent: 'Do not overwrite' })) as { created: boolean; note: Note };
  expect(duplicate.created).toBe(false); expect(duplicate.note.id).toBe(created.note.id);
  expect(duplicate.note.userContent).toBe('Personal'); expect(duplicate.note.aiSnapshot?.text).toBe('Original AI answer');
  expect(await f.database.notes.count()).toBe(1);
});

it('笔记或请求表失败回滚必要引用与笔记，原请求可重试', async () => {
  const request = f.command('notes.create', { kind: 'quote', source: f.source });
  const originalCount = await f.database.citations.count();
  const fail = () => { throw new DOMException('quota', 'QuotaExceededError'); };
  f.database.notes.hook('creating', fail);
  await expect(f.repository.execute(request, async () => {})).rejects.toThrow();
  expect(await f.database.notes.count()).toBe(0); expect(await f.database.citations.count()).toBe(originalCount);
  f.database.notes.hook('creating').unsubscribe(fail); f.database.requests.hook('creating', fail);
  await expect(f.repository.execute(request, async () => {})).rejects.toThrow();
  expect(await f.database.notes.count()).toBe(0); expect(await f.database.citations.count()).toBe(originalCount);
  f.database.requests.hook('creating').unsubscribe(fail);
  await f.repository.execute(request, async () => {}); await f.repository.execute(request, async () => {});
  expect(await f.database.notes.count()).toBe(1); expect(await f.database.citations.count()).toBe(originalCount + 1);
});

it('同版本并发修改只有一次成功，缺 PDF 字节仍可编辑已保存笔记', async () => {
  const { note } = await f.repository.execute(f.command('notes.create', { kind: 'page', page: 2, userContent: 'Initial' })) as { note: Note };
  await f.database.assets.delete('asset');
  const edits = await Promise.allSettled(['one', 'two'].map(text => f.repository.execute(f.command('notes.update', {
    noteId: note.id, expectedRevision: 1, title: text, userContent: text }))));
  expect(edits.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(edits.filter(r => r.status === 'rejected')).toHaveLength(1);
  expect((await f.repository.get(f.book.id, note.id)).revision).toBe(2);
});
