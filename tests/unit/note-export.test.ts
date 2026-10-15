import { describe, expect, it } from 'vitest';
import { noteFixture } from './notes-fixture';
import { NoteDiscovery } from '../../src/notes/discoveryRepository';
import { textDigest } from '../../src/notes/search';
import { exportFileName, markdownNotes } from '../../src/notes/markdown';
import { parseRequest } from '../../src/external/protocol';
import type { Note } from '../../src/notes/model';

describe('完整 Markdown 导出',()=>{
  it('区分原文、AI 问题及个人内容，HTML 与 Markdown 保持文本；无 PDF 也可导出',async()=>{
    const f=await noteFixture();
    try {
      const result=await f.repository.execute(f.command('notes.create',{kind:'quote',citationId:f.citation.id,
        title:'中文 # 标题',userContent:'<script>alert(1)</script>\n``` *个人*'})) as {note:Note};
      await f.database.notes.update(result.note.id,{aiSnapshot:{conversationId:'c',messageId:'m',sequence:1,status:'complete',
        sourceLabel:'External AI',text:'AI answer',questionText:'Stored question'}});
      const before=await f.database.notes.toArray(), discovery=new NoteDiscovery(f.database);
      const document=await discovery.exportDocument(f.book.id);
      expect(document.noteCount).toBe(1); expect(document.content).toContain('原文摘录 · PDF 第 1 页');
      expect(document.content).toContain('AI 回答快照');expect(document.content).toContain('Stored question');
      expect(document.content).toContain('个人理解与疑问');expect(document.content).toContain('&lt;script&gt;');
      expect(document.content).not.toContain('<script>');expect(document.content).toContain('\\`\\`\\`');
      expect(exportFileName('../bad/name:')).not.toMatch(/[/:]/);
      await f.database.assets.clear();expect(await discovery.exportDocument(f.book.id)).toEqual(document);
      expect(await f.database.notes.toArray()).toEqual(before);
      expect((await discovery.exportDocument(f.book.id,{query:'absent'})).content).toContain('暂无笔记');
      expect(markdownNotes({id:'book',title:'中文'},[{...result.note,aiSnapshot:undefined}])).not.toContain('已保存问题');
    } finally{await f.database.delete();}
  });
  it('超过分页和 1MiB 的内容分块完整，无跨块损坏，修改版本拒绝混合导出',async()=>{
    const f=await noteFixture();
    try{
      const created=await f.repository.execute(f.command('notes.create',{kind:'page',page:1,userContent:'保留'})) as {note:Note};
      await f.database.notes.bulkPut(Array.from({length:80},(_,i)=>({...created.note,id:'bulk'+i,
        userContent:i%2 ? '\u0000'.repeat(20000) : '中文🙂\n'.repeat(2000)})));
      const discovery=new NoteDiscovery(f.database), complete=await discovery.exportDocument(f.book.id);
      expect(new TextEncoder().encode(complete.content).length).toBeGreaterThan(1024*1024);
      expect(complete.noteCount).toBe(81); const first=await discovery.exportChunk(f.book.id);let assembled=first.content;
      for(let i=1;i<first.chunkCount;i++){
        const chunk=await discovery.exportChunk(f.book.id,{chunkIndex:i,expectedContentHash:first.contentHash});
        expect(new TextEncoder().encode(chunk.content).length).toBeLessThanOrEqual(64*1024);
        expect(new TextEncoder().encode(JSON.stringify(chunk)).length).toBeLessThan(512*1024);
        const result={ok:true,data:chunk};
        expect(new TextEncoder().encode(JSON.stringify({content:[{type:'text',text:JSON.stringify(result)}],
          structuredContent:result,isError:false})).length).toBeLessThan(512*1024);
        assembled+=chunk.content;
      }
      expect(assembled).toBe(complete.content);expect(await textDigest(assembled)).toBe(complete.contentHash);
      await f.database.notes.update(created.note.id,{revision:2,userContent:'改变'});
      await expect(discovery.exportChunk(f.book.id,{chunkIndex:1,expectedContentHash:first.contentHash})).rejects.toMatchObject({code:'EXPORT_CHANGED'});
      expect(()=>parseRequest({requestId:'x',operation:'notes.export',params:{chunkIndex:1}})).toThrow();
      await expect(discovery.exportChunk(f.book.id,{chunkIndex:9999,expectedContentHash:(await discovery.exportDocument(f.book.id)).contentHash}))
        .rejects.toMatchObject({code:'INVALID_PARAMS'});
    }finally{await f.database.delete();}
  },20000);
});
