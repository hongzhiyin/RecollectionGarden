import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const directory = await mkdtemp(join(tmpdir(), 'external-launch-'));
try {
  const fixture = join(directory, 'provider.mjs'), capture = join(directory, 'request.json');
  await writeFile(fixture, `import fs from 'node:fs';let input='';for await(const part of process.stdin)input+=part;fs.writeFileSync(process.argv[2],input);process.stdout.write(JSON.stringify({ok:true,data:{url:process.argv[3]}}));`);
  await writeFile(join(directory, 'recollection-garden'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const source = join(directory, 'main.m');
  await writeFile(source, `#import <AppKit/AppKit.h>
#import "ExternalConversation.h"
int main(int argc,const char **argv){@autoreleasepool{
NSDictionary *entry=@{@"protocol":@"ai-session-launch/v1",@"name":@"Example AI",@"transport":@{@"type":@"stdio",@"command":@(argv[1]),@"args":@[@(argv[2]),@(argv[3]),@(argv[4])]}};
[NSUserDefaults.standardUserDefaults setVolatileDomain:@{@"ExternalAIEntryV1":entry} forName:NSArgumentDomain];
ExternalConversation *launcher=[ExternalConversation new];if(![launcher configured])return 2;
__block BOOL done=NO;__block BOOL success=NO;
[launcher openContext:@{@"window":@"window-a",@"resource":@"book-b"} completion:^(NSURL *url,NSString *error){success=url!=nil;done=YES;}];
NSDate *deadline=[NSDate dateWithTimeIntervalSinceNow:5];while(!done&&deadline.timeIntervalSinceNow>0)[NSRunLoop.currentRunLoop runMode:NSDefaultRunLoopMode beforeDate:[NSDate dateWithTimeIntervalSinceNow:.01]];
return done && success==[(@(argv[5])) boolValue]?0:3;
}}`);
  const executable = join(directory, 'smoke');
  execFileSync('xcrun', ['clang','-fobjc-arc','-mmacosx-version-min=26.0','-framework','AppKit','-framework','UniformTypeIdentifiers',
    '-I',resolve('desktop/macos'),source,'desktop/macos/ExternalConversation.m','-o',executable]);
  for (const [url, accept] of [['http://127.0.0.1:9999/embedded#test', '1'],['https://example.test/chat','1'],['file:///tmp/private','0'],['http://remote.test/chat','0']]) {
    execFileSync(executable, [process.execPath,fixture,capture,url,accept]);
    const request=JSON.parse(await readFile(capture,'utf8'));
    assert.equal(request.protocol,'ai-session-launch/v1');assert.equal(request.operation,'open-session');
    assert.deepEqual(request.context,{window:'window-a',resource:'book-b'});
    assert.deepEqual(request.mcp.readTools,['rg_context_get','rg_page_read','rg_outline_get']);
    assert.deepEqual(request.mcp.interactionTools,['rg_reader_navigate','rg_outline_navigate']);
    assert.deepEqual(request.mcp.transport.args,['mcp','--window','window-a','--book','book-b']);
  }
  console.log(JSON.stringify({passed:4,scope:'native generic CLI invocation and returned URL validation; no manual UI acceptance'}));
} finally { await rm(directory,{recursive:true,force:true}); }
