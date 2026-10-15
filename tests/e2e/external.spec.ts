import { test, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { openReader, saved, storedProgress } from './reader-helpers';
import { selectText } from './text-helpers';
import { cli, connect, inputFor } from './external-helpers';

test('CLI/MCP 读取同一上下文，外部消息和原文引用恢复，临时查看不改主进度', async ({ page }) => {
  await openReader(page, 'text-navigation.pdf'); const sessionId = await connect(page);
  await page.getByRole('button', { name: '外部对话', exact: true }).click();
  await selectText(page, 'Across lines we keep the original source.');
  const input = await inputFor(sessionId);
  const context = await cli('context.get', input); expect(context.ok).toBe(true);
  expect(context.data.selection.rawText).toBe('Across lines we keep the original source.');
  const client = new Client({ name: 'RecollectionGarden-test-client', version: '1' }, { capabilities: {} });
  const transport = new StdioClientTransport({ command: process.execPath, args: ['bridge/mcp.mjs'], cwd: process.cwd(), stderr: 'pipe' });
  await client.connect(transport);
  try {
    const tools = await client.listTools(); expect(tools.tools).toHaveLength(23);
    const response = await client.callTool({ name: 'rg_context_get', arguments: { ...input, params: {} } });
    const result = JSON.parse((response.content as { type: string; text: string }[])[0].text);
    expect(result.data.selection).toEqual(context.data.selection);
    const createInput = { ...input, requestId: 'citation-' + input.bookId, params: { source: context.data.selection, intent: 'question', editedText: 'An external question' } };
    const created = await cli('citation.create', createInput); expect(created.ok).toBe(true);
    const duplicate = await cli('citation.create', createInput); expect(duplicate.data.id).toBe(created.data.id);
    const published = await client.callTool({ name: 'rg_conversation_publish', arguments: { sessionId, bookId: input.bookId,
      requestId: 'message-' + input.bookId, params: { conversationId: 'external-test', messageId: 'answer', sequence: 1,
        text: 'An external explanation with a verified source.', status: 'complete', citationIds: [created.data.id], sourceLabel: 'SDK Test Client' } } });
    expect(published.isError).not.toBe(true);
    await page.getByRole('button', { name: '外部对话', exact: true }).click();
    await expect(page.getByTestId('external-message')).toContainText('An external explanation');
    const nav = await cli('reader.navigate', { ...await inputFor(sessionId), params: { page: 2 } }); expect(nav.ok).toBe(true);
    await saved(page); const before = await storedProgress(page); expect(before.page).toBe(2);
    await page.getByRole('button', { name: '查看引用 1', exact: true }).click();
    await expect(page.getByText('临时查看原文', { exact: true })).toBeVisible();
    await expect(page.locator('.citation-highlights span').first()).toBeVisible();
    expect((await storedProgress(page)).page).toBe(2);
    await page.getByRole('button', { name: '返回阅读处', exact: true }).click(); await saved(page);
    await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 2 / 3 页');
    await page.getByRole('button', { name: '关闭', exact: true }).click(); await page.reload();
    await page.getByRole('button', { name: '阅读 text-navigation', exact: true }).click(); await saved(page);
    await page.getByRole('button', { name: '外部对话', exact: true }).click();
    await expect(page.getByTestId('external-message')).toContainText('An external explanation');
  } finally { await client.close(); }
});

test('旧上下文和错误书籍拒绝，消息乱序不覆盖，关闭窗口后会话失效', async ({ page }) => {
  await openReader(page, 'text-navigation.pdf'); const sessionId = await connect(page);
  const old = await inputFor(sessionId);
  expect((await cli('page.read', { ...old, params: { page: 1 } })).data.rawText).toContain('Across lines');
  expect((await cli('page.read', { ...old, bookId: 'other', params: { page: 1 } })).error.code).toBe('BOOK_NOT_OPEN');
  await page.getByRole('button', { name: '下一页', exact: true }).click(); await saved(page);
  expect((await cli('page.read', { ...old, params: { page: 1 } })).error.code).toBe('STALE_CONTEXT');
  const fresh = await inputFor(sessionId);
  const message = { conversationId: 'ordering', messageId: 'm', sequence: 2, text: '<script>plain text only</script>', status: 'complete', citationIds: [] };
  expect((await cli('conversation.publish', { ...fresh, params: message })).ok).toBe(true);
  expect((await cli('conversation.publish', { ...fresh, params: { ...message, sequence: 1, text: 'old' } })).data.applied).toBe(false);
  await expect(page.getByTestId('external-message')).toContainText('<script>plain text only</script>');
  expect(await page.locator('.conversation-panel script').count()).toBe(0);
  await page.close();
  expect((await cli('context.get', fresh)).error.code).toBe('READER_OFFLINE');
});
