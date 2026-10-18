import { createServer } from 'node:http';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const [readerPackage, aiPackage, profileRoot] = process.argv.slice(2).map(x => resolve(x));
const readerProfile = join(profileRoot, 'reader'), aiProfile = join(profileRoot, 'ai');
await mkdir(readerProfile, { recursive: true }); await mkdir(aiProfile, { recursive: true });
const toolsUsed = [];
function contextIn(value) {
  if (typeof value === 'string') { try { return contextIn(JSON.parse(value)); } catch { return; } }
  if (!value || typeof value !== 'object') return;
  if (value.contextVersion && value.bookId && Number.isInteger(value.page)) return value;
  for (const item of Object.values(value)) { const result = contextIn(item); if (result) return result; }
}
const server = createServer(async (request, response) => {
  try {
    let raw = ''; for await (const part of request) raw += part;
    const body = JSON.parse(raw), messages = body.messages;
    const lastUser = messages.findLastIndex(m => m.role === 'user');
    const current = messages.slice(lastUser + 1), results = current.filter(m => m.role === 'tool');
    const navigate = JSON.stringify(messages[lastUser]).includes('WINDOWS_PAIR_NAVIGATE');
    const findTool = description => body.tools.find(t => t.function.description.includes(description))?.function.name;
    let call, text;
    if (results.length === 0) call = { name: findTool('读取此连接已绑定窗口'), arguments: '{}' };
    else if (results.length === 1) {
      const context = contextIn(results[0].content); if (!context) throw new Error('Missing real reader context');
      call = { name: findTool(navigate ? '在绑定的当前书籍内翻页' : '读取绑定书籍的一个明确物理页'),
        arguments: JSON.stringify({ page: navigate ? 2 : context.page, contextVersion: context.contextVersion }) };
    } else {
      const result = JSON.stringify(results.at(-1).content);
      if (navigate ? !result.includes('2') : !result.includes('Selecting original text')) throw new Error('Reader tool did not return expected fixture data');
      text = navigate ? 'PAIR_NAVIGATE_OK' : 'PAIR_READ_OK Selecting original text';
    }
    if (call && !call.name) throw new Error('Expected scoped MCP tool missing');
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const chunk = (delta, finish = null) => response.write('data: ' + JSON.stringify({ id: 'pair', object: 'chat.completion.chunk', model: 'fixture-model', choices: [{ index: 0, delta, finish_reason: finish }] }) + '\n\n');
    chunk({ role: 'assistant' });
    if (call) { toolsUsed.push(call); chunk({ tool_calls: [{ index: 0, id: 'call-' + toolsUsed.length, type: 'function', function: call }] }); chunk({}, 'tool_calls'); }
    else { chunk({ content: text }); chunk({}, 'stop'); }
    response.end('data: [DONE]\n\n');
    await writeFile(join(profileRoot, 'model-fixture.json'), JSON.stringify({ toolsUsed, realModel: false }, null, 2));
  } catch (error) { response.writeHead(500); response.end(JSON.stringify({ error: String(error) })); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const config = { id: 'windows-pair', protocol: 'openai-completions', baseUrl, model: 'fixture-model',
  contextWindow: 100000, maxOutputTokens: 8192, credentialRef: 'file:fixture', timeoutMs: 20000,
  reasoning: { supportedLevels: ['off', 'high'], format: 'deepseek' }, toolCalling: { supported: true, supportedThinkingLevels: ['off', 'high'] } };
await writeFile(join(aiProfile, 'connection.local.json'), JSON.stringify(config));
await writeFile(join(aiProfile, 'credentials.local.json'), JSON.stringify({ fixture: 'test-only' }));
const cli = join(readerPackage, 'recollection-garden.exe');
await writeFile(join(aiProfile, 'application-policies.json'), JSON.stringify({ format: 'ai-application-policies/v1', applications: [{
  applicationId: 'com.chihoyo.RecollectionGarden', profile: 'desktop-default', command: cli,
  args: ['mcp', '--window', { context: 'window' }, '--book', { context: 'resource' }],
  readTools: ['rg_context_get', 'rg_page_read', 'rg_outline_get'], interactionTools: ['rg_reader_navigate', 'rg_outline_navigate'],
  destination: { connectionId: config.id, protocol: config.protocol, baseUrl: new URL(baseUrl).href, model: config.model }
}] }));
const entry = JSON.parse(execFileSync(join(aiPackage, 'dreamedge-cli.exe'), ['describe'], { encoding: 'utf8' }));
await writeFile(join(readerProfile, 'external-ai-entry.json'), JSON.stringify(entry));
await writeFile(join(profileRoot, 'ready.json'), JSON.stringify({ readerProfile, aiProfile }));
process.on('SIGTERM', () => { server.closeAllConnections(); server.close(); });
