import { test, expect } from '@playwright/test';
import { openReader, saved } from './reader-helpers';
import { selectText } from './text-helpers';
import { cli, connect, inputFor } from './external-helpers';
import { createAnchor } from '../../src/citations/anchors';

test('摘录和页笔记编辑、面板保留、关闭确认及重开恢复', async ({ page }) => {
  await openReader(page, 'text-navigation.pdf');
  const sessionId = await connect(page);
  await page.getByRole('button', { name: '外部对话', exact: true }).click();
  await selectText(page, 'Across lines we keep the original source.');
  await page.getByRole('button', { name: '保存为摘录笔记', exact: true }).click();
  await expect(page.getByLabel('笔记原文')).toContainText('Across lines');
  await page.getByLabel('笔记标题', { exact: true }).fill('摘录笔记');
  await page.getByLabel('个人理解与疑问', { exact: true }).fill('个人理解');
  await page.getByRole('button', { name: '保存笔记', exact: true }).click();
  await expect(page.getByText('笔记已保存', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '引用 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看笔记原文 1', exact: true }).click();
  await expect(page.locator('.citation-highlights span').first()).toBeVisible();
  await page.getByRole('button', { name: '返回阅读处', exact: true }).click();
  await saved(page);
  await page.getByLabel('个人理解与疑问', { exact: true }).fill('尚未提交的修改');
  expect((await cli('reader.open', await inputFor(sessionId))).error.code).toBe('UNSAVED_NOTE');
  await page.getByRole('button', { name: '外部对话', exact: true }).click();
  await page.getByRole('dialog', { name: 'text-navigation', exact: true }).getByRole('button', { name: '笔记', exact: true }).click();
  await expect(page.getByLabel('个人理解与疑问', { exact: true })).toHaveValue('尚未提交的修改');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '笔记尚未保存', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '取消切换', exact: true }).click();
  await page.getByRole('button', { name: '保存笔记', exact: true }).click();
  await expect(page.getByText('已保存 · 版本 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click(); await page.reload();
  await page.getByRole('button', { name: '笔记', exact: true }).click();
  await page.getByRole('button', { name: '摘录笔记', exact: false }).click();
  await expect(page.getByLabel('个人理解与疑问', { exact: true })).toHaveValue('尚未提交的修改');
  await expect(page.getByLabel('笔记原文')).toContainText('Across lines');
  await page.getByRole('button', { name: '新建页笔记', exact: true }).click();
  await page.getByLabel('笔记标题', { exact: true }).fill('页笔记');
  await page.getByLabel('个人理解与疑问', { exact: true }).fill('当前页的疑问');
  await page.getByRole('button', { name: '保存笔记', exact: true }).click();
  await expect(page.getByText('笔记已保存', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '删除笔记', exact: true }).click();
  await page.getByRole('button', { name: '取消删除', exact: true }).click();
  await expect(page.getByLabel('笔记标题', { exact: true })).toHaveValue('页笔记');
  await page.getByRole('button', { name: '删除笔记', exact: true }).click();
  await page.getByRole('button', { name: '确认删除笔记', exact: true }).click();
  await expect(page.getByText('笔记已删除', { exact: true })).toBeVisible();
});

test('已完成 AI 回答保存快照，重复保存复用，外部并发编辑不覆盖输入', async ({ page }) => {
  await openReader(page, 'text-navigation.pdf'); const sessionId = await connect(page);
  const sourceInput = await inputFor(sessionId);
  const raw = (await cli('page.read', { ...sourceInput, params: { page: 1 } })).data;
  const phrase = 'Across lines we keep the original source.'; const start = raw.rawText.indexOf(phrase);
  expect(start).toBeGreaterThanOrEqual(0);
  const quote = await cli('citation.create', { ...sourceInput, params: { source: { bookId: sourceInput.bookId,
    assetHash: raw.assetHash, page: 1, rawText: phrase, anchor: createAnchor(raw.rawText, start, start + phrase.length) } } });
  expect(quote.ok).toBe(true);
  expect((await cli('reader.navigate', { ...await inputFor(sessionId), params: { page: 2 } })).ok).toBe(true);
  const input = await inputFor(sessionId);
  await cli('conversation.publish', { ...input, params: { conversationId: 'note-answer', messageId: 'm', sequence: 1,
    text: 'Verified answer', status: 'complete', citationIds: [quote.data.id], sourceLabel: 'Test AI' } });
  await page.getByRole('button', { name: '保存回答为笔记', exact: true }).click();
  await expect(page.getByLabel('笔记标题', { exact: true })).toHaveValue('AI 回答 · PDF 第 1 页');
  await page.getByRole('button', { name: '保存笔记', exact: true }).click();
  await expect(page.getByLabel('笔记 AI 回答')).toHaveText('Verified answer');
  const list = await cli('notes.list', input); expect(list.ok).toBe(true); expect(list.data).toHaveLength(1);
  const id = list.data[0].id;
  await page.getByLabel('个人理解与疑问', { exact: true }).fill('My unsaved thoughts');
  const updated = await cli('notes.update', { ...input, params: { noteId: id, expectedRevision: 1, title: 'Other edit', userContent: 'External thoughts' } });
  expect(updated.ok).toBe(true);
  await page.getByRole('button', { name: '保存笔记', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('其他窗口更新');
  await expect(page.getByLabel('个人理解与疑问', { exact: true })).toHaveValue('My unsaved thoughts');
  await page.getByRole('button', { name: '重新读取笔记', exact: true }).click();
  await page.getByRole('button', { name: '放弃输入', exact: true }).click();
  await expect(page.getByLabel('个人理解与疑问', { exact: true })).toHaveValue('External thoughts');
  const duplicate = await cli('notes.create', { ...input, params: { kind: 'answer', conversationId: 'note-answer', messageId: 'm', expectedSequence: 1, page: 1 } });
  expect(duplicate.data.created).toBe(false); expect(duplicate.data.note.id).toBe(id);
  await cli('conversation.publish', { ...input, params: { conversationId: 'note-answer', messageId: 'm', sequence: 2,
    text: 'Changed answer', status: 'complete', sourceLabel: 'Test AI' } });
  const existing = await cli('notes.get', { ...input, params: { noteId: id } });
  expect(existing.data.aiSnapshot.text).toBe('Verified answer');
});

test('笔记写入失败保留草稿并回滚，PDF 缺失和断网仍可编辑旧笔记', async ({ page }) => {
  await openReader(page, 'text-navigation.pdf'); const sessionId = await connect(page);
  await page.getByRole('dialog', { name: 'text-navigation', exact: true }).getByRole('button', { name: '笔记', exact: true }).click();
  await page.getByRole('button', { name: '新建页笔记', exact: true }).click();
  await page.getByLabel('笔记标题', { exact: true }).fill('可恢复笔记');
  await page.getByLabel('个人理解与疑问', { exact: true }).fill('保留输入');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args: Parameters<typeof original>) {
      if (this.name === 'requests') { IDBObjectStore.prototype.add = original; throw new DOMException('quota', 'QuotaExceededError'); }
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: '保存笔记', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('输入已保留');
  expect((await cli('notes.list', await inputFor(sessionId))).data).toHaveLength(0);
  await expect(page.getByLabel('个人理解与疑问', { exact: true })).toHaveValue('保留输入');
  await page.getByRole('button', { name: '保存笔记', exact: true }).click();
  await expect(page.getByText('笔记已保存', { exact: true })).toBeVisible(); await saved(page);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('RecollectionGarden'); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result; const tx = db.transaction('assets', 'readwrite');
      tx.objectStore('assets').clear(); tx.oncomplete = () => { db.close(); resolve(); }; };
  }));
  await page.reload();
  await page.getByRole('button', { name: '笔记', exact: true }).click();
  await page.getByRole('button', { name: '可恢复笔记', exact: false }).click();
  await page.context().setOffline(true);
  await page.getByLabel('个人理解与疑问', { exact: true }).fill('离线修改');
  await page.getByRole('button', { name: '保存笔记', exact: true }).click();
  await expect(page.getByText('笔记已保存', { exact: true })).toBeVisible();
  await expect(page.getByText('已保存 · 版本 2', { exact: true })).toBeVisible();
});
