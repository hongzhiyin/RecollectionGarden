import { expect, it } from 'vitest';
import { noteFixture } from './notes-fixture';
import { NoteDiscovery } from '../../src/notes/discoveryRepository';
import type { Note } from '../../src/notes/model';

it('笔记快照独立定位、多来源和页笔记；跨书、错误摘要、缺文件及越界拒绝',async()=>{
  const f=await noteFixture();
  try{
    const quote=await f.repository.execute(f.command('notes.create',{kind:'quote',citationId:f.citation.id})) as {note:Note};
    const page=await f.repository.execute(f.command('notes.create',{kind:'page',page:2,userContent:'页笔记'})) as {note:Note};
    const discovery=new NoteDiscovery(f.database);
    await f.database.citations.clear();
    expect((await discovery.target(f.book.id,quote.note.id)).source?.rawText).toBe('source');
    expect((await discovery.target(f.book.id,page.note.id)).page).toBe(2);
    await expect(discovery.target(f.book.id,page.note.id,1)).rejects.toMatchObject({code:'INVALID_PARAMS'});
    await f.database.notes.update(quote.note.id,{sources:[...quote.note.sources,{...quote.note.sources[0],page:3}]});
    expect((await discovery.target(f.book.id,quote.note.id,1)).page).toBe(3);
    await f.database.notes.update(page.note.id,{page:4});
    await expect(discovery.target(f.book.id,page.note.id)).rejects.toMatchObject({code:'INVALID_PAGE'});
    await f.database.notes.update(quote.note.id,{assetHash:'wrong'});
    await expect(discovery.target(f.book.id,quote.note.id)).rejects.toMatchObject({code:'INVALID_SOURCE'});
    await expect(discovery.target(f.book.id,'other')).rejects.toMatchObject({code:'MISSING_NOTE'});
    await f.database.notes.update(quote.note.id,{bookId:'other'});
    await expect(discovery.target(f.book.id,quote.note.id)).rejects.toMatchObject({code:'MISSING_NOTE'});
    await f.database.assets.clear();
    await expect(discovery.target(f.book.id,page.note.id)).rejects.toMatchObject({code:'MISSING_ASSET'});
  }finally{await f.database.delete();}
});
