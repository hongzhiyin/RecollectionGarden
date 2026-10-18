import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { writeFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export async function verifyPackagedMcp(cli, title, reportPath) {
  const help = JSON.parse(execFileSync(cli, ['help'], { encoding:'utf8', cwd:tmpdir() }));
  assert.equal(help.ok, true); assert.equal(help.data.operations.length, 25);
  const client = new Client({ name:'desktop-packaged-smoke', version:'1.0.0' }, {capabilities:{}});
  assert.ok(process.env.RG_DESKTOP_DATA_DIR, 'Native smoke test requires its isolated data directory.');
  const transport = new StdioClientTransport({ command:cli, args:['mcp'], cwd:tmpdir(), stderr:'pipe',
    env:{ RG_DESKTOP_DATA_DIR:process.env.RG_DESKTOP_DATA_DIR } });
  const invoke = async (name, input={}) => {
    const response = await client.callTool({ name, arguments:input });
    const result = JSON.parse(response.content.find(item=>item.type==='text').text);
    return result;
  };
  const call = async (name, input={}) => {
    const result = await invoke(name, input);
    assert.equal(result.ok, true, JSON.stringify(result.error)); return result.data;
  };
  try {
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 25);
    const sessions = await call('rg_sessions_list');
    assert.equal(sessions.length, 1);
    const sessionId = sessions[0].sessionId;
    const books = await call('rg_books_list', {sessionId,params:{}});
    const book = books.find(item=>item.title===title); assert.ok(book);
    await call('rg_reader_open', {sessionId,bookId:book.id,params:{}});
    let session, context;
    for (let attempt=0; attempt<150; attempt++) {
      session = (await call('rg_sessions_list')).find(item=>item.sessionId===sessionId);
      if (session?.bookId===book.id && session.ready) {
        const result = await invoke('rg_context_get', {sessionId,bookId:book.id,contextVersion:session.contextVersion,params:{}});
        if (result.ok) { context=result.data; break; }
        assert.ok(['NOT_READY','STALE_CONTEXT'].includes(result.error?.code), JSON.stringify(result.error));
      }
      await new Promise(done=>setTimeout(done,100));
    }
    assert.equal(session.bookId,book.id); assert.ok(context, 'PDF context did not become ready.');
    const input={sessionId,bookId:book.id,contextVersion:context.contextVersion};
    const page=await call('rg_page_read',{...input,params:{page:1}});
    assert.ok(JSON.stringify(page).includes('Selecting original text'));
    const report={ok:true,tools:25,cliHelp:true,stdioMcp:true,bookListed:true,readerOpen:true,pageRead:true};
    await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report));
  } finally {await client.close();}

}
