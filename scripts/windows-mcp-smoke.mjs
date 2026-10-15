import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const folder = resolve(process.argv[2]);
const cli = resolve(folder, 'recollection-garden.exe');
const help = JSON.parse(execFileSync(cli, ['help'], { encoding:'utf8', cwd:process.env.TEMP }));
assert.equal(help.ok, true); assert.equal(help.data.operations.length, 23);
const client = new Client({ name:'windows-native-smoke', version:'1.0.0' }, {capabilities:{}});
const transport = new StdioClientTransport({ command:cli, args:['mcp'], cwd:process.env.TEMP, stderr:'pipe' });
const call = async (name, input={}) => {
  const response = await client.callTool({ name, arguments:input });
  const result = JSON.parse(response.content.find(item=>item.type==='text').text);
  assert.equal(result.ok, true, JSON.stringify(result.error)); return result.data;
};
try {
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 23);
  const sessions = await call('rg_sessions_list');
  assert.equal(sessions.length, 1);
  const sessionId = sessions[0].sessionId;
  const books = await call('rg_books_list', {sessionId,params:{}});
  const book = books.find(item=>item.title==='windows-smoke'); assert.ok(book);
  await call('rg_reader_open', {sessionId,bookId:book.id,params:{}});
  let session;
  for (let attempt=0; attempt<100; attempt++) {
    session = (await call('rg_sessions_list')).find(item=>item.sessionId===sessionId);
    if (session?.bookId===book.id && session.ready) break;
    await new Promise(done=>setTimeout(done,100));
  }
  assert.equal(session.bookId,book.id); assert.equal(session.ready,true);
  const input={sessionId,bookId:book.id,contextVersion:session.contextVersion};
  const page=await call('rg_page_read',{...input,params:{page:1}});
  assert.ok(JSON.stringify(page).includes('Selecting original text'));
  const report={ok:true,tools:23,cliHelp:true,stdioMcp:true,bookListed:true,readerOpen:true,pageRead:true};
  await writeFile(process.argv[3],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally {await client.close();}
