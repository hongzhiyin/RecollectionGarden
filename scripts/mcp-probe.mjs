import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';

const [operation = 'sessions.list', flag, value] = process.argv.slice(2);
const input = flag === '--input' ? JSON.parse(value?.startsWith('@') ? await readFile(value.slice(1), 'utf8') : value) : {};
const client = new Client({ name: 'RecollectionGarden-acceptance-client', version: '0.4.0' }, { capabilities: {} });
const transport = new StdioClientTransport({ command: process.execPath, args: ['bridge/mcp.mjs'], cwd: process.cwd(), stderr: 'pipe' });
try {
  await client.connect(transport);
  const response = await client.callTool({ name: 'rg_' + operation.replaceAll('.', '_'), arguments: input });
  const result = JSON.parse(response.content.find(item => item.type === 'text').text);
  process.stdout.write(JSON.stringify({ client: 'official-sdk-stdio', sdkProtocolVersion: LATEST_PROTOCOL_VERSION,
    server: client.getServerVersion(), result }) + '\n');
  process.exitCode = result.ok ? 0 : 1;
} finally { await client.close(); }
