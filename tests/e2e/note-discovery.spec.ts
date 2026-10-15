import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openReader, saved, storedProgress } from './reader-helpers';
import { selectText } from './text-helpers';
import { cli, connect, inputFor } from './external-helpers';

async function quoteNote(page: Parameters<typeof openReader>[0]) {
  await openReader(page,'text-navigation.pdf');const sessionId=await connect(page);
  await page.getByRole('button',{name:'外部对话',exact:true}).click();
  await selectText(page,'Across lines we keep the original source.');
  await page.getByRole('button',{name:'保存为摘录笔记',exact:true}).click();
  await page.getByLabel('笔记标题',{exact:true}).fill('来源与导出');
  await page.getByLabel('个人理解与疑问',{exact:true}).fill('中文理解与疑问');
  await page.getByRole('button',{name:'保存笔记',exact:true}).click();
  await expect(page.getByText('笔记已保存',{exact:true})).toBeVisible();
  const input=await inputFor(sessionId);
  const notes=await cli('notes.list',input);
  return {sessionId,input,note:notes.data[0]};
}

test('界面检索与 CLI 一致，书架来源定位、返回及 Markdown 下载',async({page})=>{
  const {sessionId,note,input}=await quoteNote(page);
  await cli('reader.navigate',{...await inputFor(sessionId),params:{page:2,zoom:{mode:'percent',percent:150}}});
  await saved(page);const before=await storedProgress(page);
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.getByRole('button',{name:'笔记',exact:true}).click();
  await page.getByLabel('搜索笔记',{exact:true}).fill('ACROSS 中文');
  await expect(page.getByRole('button',{name:'来源与导出',exact:false})).toBeVisible();
  const search=await cli('notes.search',{sessionId,bookId:input.bookId,params:{query:'ACROSS 中文'}});
  expect(search.ok).toBe(true);expect(search.data.total).toBe(1);
  await page.getByRole('button',{name:'来源与导出',exact:false}).click();
  await page.getByLabel('个人理解与疑问',{exact:true}).fill('尚未保存的输入');
  await page.getByLabel('搜索笔记',{exact:true}).fill('source');
  await expect(page.getByLabel('个人理解与疑问',{exact:true})).toHaveValue('尚未保存的输入');
  await page.getByRole('button',{name:'查看笔记原文 1',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'笔记尚未保存',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'取消切换',exact:true}).click();
  await page.getByLabel('个人理解与疑问',{exact:true}).fill('中文理解与疑问');
  const bookId=input.bookId;
  const exported=await cli('notes.export',{sessionId,bookId,params:{}});
  const downloading=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出全部笔记',exact:true}).click();
  const download=await downloading;const content=await readFile((await download.path())!,'utf8');
  expect(content).toBe(exported.data.content);expect(content).toContain('原文摘录');
  expect(createHash('sha256').update(content).digest('hex')).toBe(exported.data.contentHash);
  await page.getByRole('button',{name:'查看笔记原文 1',exact:true}).click();
  await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 1 / 3 页');
  await expect(page.locator('.citation-highlights span').first()).toBeVisible();
  expect((await storedProgress(page)).page).toBe(2);
  await page.getByRole('button',{name:'返回阅读处',exact:true}).click();await saved(page);
  const after=await storedProgress(page);
  expect(after.page).toBe(before.page);expect(after.zoom).toEqual(before.zoom);
  expect(after.offsetX).toBe(before.offsetX);expect(after.offsetY).toBe(before.offsetY);
});

test('笔记快照不依赖引用记录；后台定位、页笔记和无效锚点退回页级',async({page})=>{
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};});
  const {sessionId,input,note}=await quoteNote(page);
  await cli('reader.navigate',{...await inputFor(sessionId),params:{page:2}});
  await saved(page);
  await page.evaluate((noteId)=>new Promise<void>((resolve,reject)=>{
    const request=indexedDB.open('RecollectionGarden');request.onsuccess=()=>{
      const db=request.result,tx=db.transaction(['notes','citations'],'readwrite');
      tx.objectStore('citations').clear();const read=tx.objectStore('notes').get(noteId);
      read.onsuccess=()=>{const n=read.result;n.sources.push({...n.sources[0],page:3,rawText:'missing anchor'});tx.objectStore('notes').put(n);};
      tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
    };
  }),note.id);
  const located=await cli('notes.locate',{...await inputFor(sessionId),params:{noteId:note.id}});
  expect(located.data.precision).toBe('text');
  await cli('reader.return',await inputFor(sessionId));
  const fallback=await cli('notes.locate',{...await inputFor(sessionId),params:{noteId:note.id,sourceIndex:1}});
  expect(fallback.data.precision).toBe('page');expect(fallback.data.reason).toBe('ANCHOR_UNAVAILABLE');
  expect((await storedProgress(page)).page).toBe(2);
  await cli('reader.return',await inputFor(sessionId));
  const pageNote=await cli('notes.create',{...input,params:{kind:'page',page:3,userContent:'第3页'}});
  const pageTarget=await cli('notes.locate',{...await inputFor(sessionId),params:{noteId:pageNote.data.note.id}});
  expect(pageTarget.data.page).toBe(3);
  expect(pageTarget.data.precision).toBe('page');expect(pageTarget.data.reason).toBe('PAGE_NOTE');
  await cli('reader.return',await inputFor(sessionId));
  expect((await cli('notes.locate',{...await inputFor(sessionId),params:{noteId:note.id,sourceIndex:9}})).error.code).toBe('INVALID_PARAMS');
  expect((await cli('notes.locate',{...await inputFor(sessionId),bookId:'other',params:{noteId:note.id}})).ok).toBe(false);
});

test('缺 PDF 和断线时本地检索导出，定位失败不改变位置',async({page})=>{
  const {sessionId,input,note}=await quoteNote(page);
  await saved(page);await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
    const r=indexedDB.open('RecollectionGarden');r.onsuccess=()=>{const db=r.result,tx=db.transaction('assets','readwrite');
      tx.objectStore('assets').clear();tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};
  }));
  const before=await storedProgress(page);
  expect((await cli('notes.locate',{...input,params:{noteId:note.id}})).error.code).toBe('MISSING_ASSET');
  await page.getByRole('button',{name:'笔记',exact:true}).click();
  await page.getByLabel('搜索笔记',{exact:true}).fill('中文');
  await expect(page.getByRole('button',{name:'来源与导出',exact:false})).toBeVisible();
  await page.context().setOffline(true);
  const downloading=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出检索结果',exact:true}).click();
  const content=await readFile((await (await downloading).path())!,'utf8');
  expect(content).toContain('中文理解与疑问');
  expect(await storedProgress(page)).toEqual(before);
  expect(sessionId).toBeTruthy();
});

test('来源页文本提取失败时明确退回页级，返回主位置',async({page})=>{
  const {sessionId,note}=await quoteNote(page);
  await cli('reader.navigate',{...await inputFor(sessionId),params:{page:2}});
  await saved(page);
  await page.evaluate(()=>{
    const original=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(message:{action?:string},options?:StructuredSerializeOptions|Transferable[]){
      if(message.action==='GetTextContent'){Worker.prototype.postMessage=original;throw new Error('injected source text failure');}
      return original.call(this,message,Array.isArray(options)?{transfer:options}:options);
    };
  });
  const result=await cli('notes.locate',{...await inputFor(sessionId),params:{noteId:note.id}});
  expect(result.ok).toBe(true);expect(result.data.page).toBe(1);
  expect(result.data.precision).toBe('page');expect(result.data.reason).toBe('ANCHOR_UNAVAILABLE');
  expect((await storedProgress(page)).page).toBe(2);
  await cli('reader.return',await inputFor(sessionId));
  await expect(page.getByTestId('page-indicator')).toHaveText('PDF 第 2 / 3 页');
});
