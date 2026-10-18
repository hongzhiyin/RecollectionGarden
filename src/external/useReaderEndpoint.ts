import { outlineAction, type OutlineControls } from './outline-actions';
import { useEffect, useMemo, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { BookView, ReaderLocation, ReaderZoom } from '../library/model';
import type { CitationState } from '../citations/useCitations';
import { citations } from '../citations/repository';
import { cleanQuote, locateQuote } from '../citations/anchors';
import { pageText } from '../pdf/pageText';
import { useBridge, type ReaderEndpoint } from './BridgeProvider';
import { BridgeError, operations, type BridgeCommand } from './protocol';
import { durable } from './storage';
import type { NoteTarget } from '../notes/discoveryRepository';

interface ReaderControls extends OutlineControls {
  book: BookView; view: ReaderLocation; pdf?: PDFDocumentProxy; references: CitationState;
  current: () => ReaderLocation | null; ready: () => boolean; original: () => ReaderLocation | undefined;
  navigate: (page: number, zoom?: ReaderZoom) => void;
  locate: (citationId: string) => Promise<void>; returnToReading: () => void; continueHere: () => void;
  locateSource: (target: NoteTarget) => Promise<void>; flush: () => Promise<void>;
  error: () => string | undefined;
}
export function useReaderEndpoint(controls: ReaderControls) {
  const bridge = useBridge();
  const active = useRef(true);
  const state = useRef(controls); state.current = controls;
  const version = useMemo(() => crypto.randomUUID(), [controls.book.id, controls.view.page, controls.view.zoom.mode,
    controls.view.zoom.mode === 'percent' ? controls.view.zoom.percent : 0,
    controls.references.draft?.source.rawText, controls.references.draft?.source.anchor.start,
    controls.references.draft?.intent, controls.references.draft?.editedText, controls.original()]);
  const versionRef = useRef(version); versionRef.current = version;
  const endpoint = useRef<ReaderEndpoint>(null);
  if (!endpoint.current) endpoint.current = {
    ready: () => active.current && state.current.ready(),
    error: () => state.current.error(),
    flush: () => state.current.flush(),
    locateSource: async (target, expiresAt) => {
      const book = state.current.book;
      if (target.assetHash !== book.assetHash) throw new BridgeError('INVALID_SOURCE', '笔记来源与 PDF 不符。');
      await state.current.locateSource(target);
      while (state.current.view.page !== target.page || !state.current.ready()
        || (target.source && (state.current.references.target !== target.source
          || !/已定位|精确定位不可用/.test(state.current.references.message)))) {
        if (state.current.error()) throw new BridgeError('PDF_OPEN_FAILED', state.current.error()!);
        if (!active.current || state.current.book.id !== book.id) throw new BridgeError('READER_OFFLINE', '阅读器已关闭。');
        if (Date.now() > expiresAt) throw new BridgeError('TIMEOUT', '定位尚未完成，请查询请求状态。');
        await new Promise(resolve => setTimeout(resolve, 40));
      }
      const precision = target.source && state.current.references.message === '已定位原文' ? 'text' : 'page';
      return { ...endpoint.current!.snapshot(), precision, preview: true,
        reason: precision === 'text' ? null : target.source ? 'ANCHOR_UNAVAILABLE' : 'PAGE_NOTE' };
    },
    verifySource: async (source, contextVersion) => {
      const current = state.current;
      if (!active.current || !current.pdf) throw new BridgeError('NOT_READY', '来源 PDF 尚未打开。');
      if (source.bookId !== current.book.id || source.assetHash !== current.book.assetHash)
        throw new BridgeError('INVALID_SOURCE', '选段来源与当前书籍不符。');
      if (contextVersion && contextVersion !== versionRef.current) throw new BridgeError('STALE_CONTEXT', '阅读上下文已改变，请重新读取。');
      const raw = await pageText(current.pdf, source.page);
      if (!active.current || (contextVersion && contextVersion !== versionRef.current))
        throw new BridgeError('STALE_CONTEXT', '阅读上下文已改变，请重新读取。');
      if (!locateQuote(raw, source.rawText, source.anchor)) throw new BridgeError('INVALID_SOURCE', '原文无法核验。');
    },
    snapshot: () => ({ bookId: state.current.book.id, title: state.current.book.title,
      page: state.current.view.page, contextVersion: versionRef.current }),
    execute: async command => {
      const current = state.current;
      const fresh = () => {
        if (!active.current) throw new BridgeError('READER_OFFLINE', '此阅读器已关闭。');
        if (Date.now() > command.expiresAt) throw new BridgeError('TIMEOUT', '请求已过期。');
        if (command.contextVersion !== versionRef.current) throw new BridgeError('STALE_CONTEXT', '原文上下文已改变，请重新读取。');
      };
      const wait = async (test: () => boolean) => {
        while (!test()) {
          if (!active.current) throw new BridgeError('READER_OFFLINE', '此阅读器已关闭。');
          if (Date.now() > command.expiresAt) throw new BridgeError('TIMEOUT', '页面操作尚未完成，请查询请求状态。');
          await new Promise(resolve => setTimeout(resolve, 40));
        }
      };
      if (command.operation === 'outline.get' || command.operation === 'outline.navigate') {
        return outlineAction(command, current, { fresh, snapshot: () => endpoint.current!.snapshot(),
          waitForPage: async page => {
            await wait(() => state.current.view.page === page && state.current.ready());
            if (state.current.book.id !== current.book.id) throw new BridgeError('CONTEXT_CHANGED', '书籍已切换。');
          } });
      }
      if (command.operation === 'context.get') {
        if (!current.ready()) throw new BridgeError('NOT_READY', '当前页尚未完成显示。');
        return { ...endpoint.current!.snapshot(), assetHash: current.book.assetHash,
          location: current.current(), mainLocation: current.original() ?? current.current(), preview: !!current.original(),
          selection: current.references.draft?.source ?? null, draft: current.references.draft ?? null };
      }
      if (command.operation === 'draft.get') return current.references.draft ?? null;
      if (command.operation === 'citations.list') return await citations.list(current.book.id);
      if (command.operation === 'page.read') {
        if (!current.pdf) throw new BridgeError('NOT_READY', 'PDF 尚未打开。');
        const { page } = operations['page.read'].parse(command.params);
        const rawText = await pageText(current.pdf, page); fresh();
        return { bookId: current.book.id, assetHash: current.book.assetHash, page, rawText, contextVersion: versionRef.current };
      }
      if (command.operation === 'citation.create') {
        const input = operations['citation.create'].parse(command.params);
        const source = input.source ?? current.references.draft?.source;
        if (!source || !current.pdf) throw new BridgeError('NO_SELECTION', '当前没有选段，请选取文字或提供已读取的原文锚点。');
        if (source.bookId !== current.book.id || source.assetHash !== current.book.assetHash) throw new BridgeError('INVALID_SOURCE', '引用来源与当前书籍不符。');
        const raw = await pageText(current.pdf, source.page); fresh();
        if (!locateQuote(raw, source.rawText, source.anchor)) throw new BridgeError('INVALID_SOURCE', '原文无法核验，未创建引用。');
        const result = await durable(command, () => citations.save(source, input.intent, input.editedText ?? cleanQuote(source.rawText)));
        current.references.setDraft(null); current.references.setVisible(true);
        current.references.setMessage('外部引用已保存');
        current.references.setItems(await citations.list(current.book.id));
        return result.ok ? result.data : Promise.reject(new BridgeError(result.error.code, result.error.message));
      }
      if (command.operation === 'citation.locate') {
        await current.locate(operations['citation.locate'].parse(command.params).citationId);
        await wait(() => state.current.ready() && /已定位|精确定位不可用/.test(state.current.references.message));
        return { ...endpoint.current!.snapshot(), preview: true, precision: state.current.references.message === '已定位原文' ? 'text' : 'page' };
      }
      if (command.operation === 'reader.navigate') {
        const input = operations['reader.navigate'].parse(command.params);
        if (input.page > current.book.pages) throw new BridgeError('INVALID_PAGE', '页码超出范围。');
        current.navigate(input.page, input.zoom);
        await wait(() => state.current.view.page === input.page && state.current.ready());
        return { ...endpoint.current!.snapshot(), location: state.current.current() };
      }
      if (command.operation === 'reader.return') current.returnToReading();
      else if (command.operation === 'reader.continue') current.continueHere();
      else throw new BridgeError('UNSUPPORTED_OPERATION', '此能力尚未实现。');
      await wait(() => state.current.ready()); return { ...endpoint.current!.snapshot(), location: state.current.current(), preview: !!state.current.original() };
    },
  };
  useEffect(() => { active.current = true; const detach = bridge.attachReader(endpoint.current!);
    return () => { active.current = false; detach(); }; }, [bridge.attachReader]);
  useEffect(() => { bridge.changed(); }, [version]);
  return version;
}
