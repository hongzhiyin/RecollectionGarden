import { describe, expect, it } from 'vitest';
import { noteFixture } from './notes-fixture';
import { NoteDiscovery } from '../../src/notes/discoveryRepository';
import { matchingNotes } from '../../src/notes/search';
import type { Note } from '../../src/notes/model';
import { parseRequest } from '../../src/external/protocol';

describe('书内笔记检索', () => {
  it('所有已保存字段、NFKC、大小写、多词全匹配、中文与不跨书', async () => {
    const f=await noteFixture();
    try {
      const result=await f.repository.execute(f.command('notes.create',{kind:'quote',citationId:f.citation.id,
        title:'ＦＵＬＬ binding',userContent:'个人\n维护理解'})) as { note: Note };
      await f.database.notes.update(result.note.id,{aiSnapshot:{conversationId:'c',messageId:'m',sequence:1,status:'complete',
        sourceLabel:'Test AI',text:'Interactive Interface',questionText:'为什么动态？'}});
      await f.database.notes.put({...result.note,id:'another',bookId:'other',title:'ＦＵＬＬ binding'});
      const discovery=new NoteDiscovery(f.database);
      for(const query of ['full BINDING','个人 维护','source','INTERACTIVE interface','为什么']) {
        const search=await discovery.search(f.book.id,{query}); expect(search.total).toBe(1);
        expect(search.items[0].id).toBe(result.note.id);
        expect(Array.from(search.items[0].snippet!).length).toBeLessThanOrEqual(160);
        expect(search.items[0]).not.toHaveProperty('userContent');
      }
      expect((await discovery.search(f.book.id,{query:'source absent'})).total).toBe(0);
      expect((await discovery.search(f.book.id)).items[0]).not.toHaveProperty('snippet');
      expect((await discovery.search(f.book.id,{kind:'answer'})).total).toBe(0);
      await expect(discovery.search('missing')).rejects.toMatchObject({code:'MISSING_BOOK'});
    } finally {await f.database.delete();}
  });
  it('稳定排序、分页和并发结果版本检查，读取不写数据库', async () => {
    const f=await noteFixture();
    try {
      const created=await f.repository.execute(f.command('notes.create',{kind:'page',page:2,userContent:'保留'})) as {note:Note};
      await f.database.notes.put({...created.note,id:'b',createdAt:10,page:1});
      await f.database.notes.put({...created.note,id:'a',createdAt:10,page:1});
      const discovery=new NoteDiscovery(f.database), before=await f.database.notes.toArray();
      const first=await discovery.search(f.book.id,{sort:'page_asc',limit:1});
      expect(first.items[0].id).toBe('a');expect(first.hasMore).toBe(true);expect(first.total).toBe(3);
      const next=await discovery.search(f.book.id,{sort:'page_asc',limit:1,offset:1,expectedResultVersion:first.resultVersion});
      expect(next.items[0].id).toBe('b');
      expect(await f.database.notes.toArray()).toEqual(before);
      await f.database.notes.update('b',{revision:2,userContent:'改变'});
      await expect(discovery.search(f.book.id,{sort:'page_asc',offset:1,expectedResultVersion:first.resultVersion}))
        .rejects.toMatchObject({code:'RESULT_CHANGED'});
      expect((await discovery.search(f.book.id,{sort:'created_desc'})).items[0].id).toBe(created.note.id);
      expect((await discovery.search(f.book.id,{sort:'created_asc'})).items[0].id).toBe('a');
    } finally {await f.database.delete();}
  });
  it('参数限制与 1,000 条查询性能', async () => {
    const f=await noteFixture();
    try {
      const result=await f.repository.execute(f.command('notes.create',{kind:'page',page:1,userContent:'keyword 中文理解'})) as {note:Note};
      await f.database.notes.bulkPut(Array.from({length:1000},(_,i)=>({...result.note,id:'n'+String(i).padStart(4,'0'),createdAt:i})));
      const discovery=new NoteDiscovery(f.database);
      await discovery.search(f.book.id,{query:'中文 keyword'});
      const start=performance.now();const r=await discovery.search(f.book.id,{query:'中文 keyword',sort:'page_asc'});
      const elapsed=performance.now()-start;expect(elapsed).toBeLessThan(1000);
      console.info('1000 note query and sort milliseconds:',Math.round(elapsed));
      expect(r.total).toBe(1001);
      expect(()=>parseRequest({requestId:'x',operation:'notes.search',params:{limit:101}})).toThrow();
      expect(()=>parseRequest({requestId:'x',operation:'notes.search',params:{query:'a'.repeat(201)}})).toThrow();
      expect(matchingNotes([], {query:'[.*]',sort:'page_asc'})).toEqual([]);
    } finally {await f.database.delete();}
  });
});
