import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { library } from '../library/repository';
import { failure, parseRequest, contextualOperations, durableOperations, BridgeError, type BridgeCommand,
  type BridgeResult, type ReaderSnapshot } from './protocol';
import { durable, listMessages, publishMessage, storedRequest } from './storage';
import { notes } from '../notes/repository';
import type { QuoteSource } from '../citations/model';
import type { NoteTarget } from '../notes/discoveryRepository';
import { locateNote } from '../notes/locate';

export interface ReaderEndpoint {
  snapshot: () => ReaderSnapshot;
  execute: (request: BridgeCommand) => Promise<unknown>;
  verifySource: (source: QuoteSource, contextVersion?: string) => Promise<void>;
  ready: () => boolean;
  error: () => string | undefined;
  flush: () => Promise<void>;
  locateSource: (target: NoteTarget, expiresAt: number) => Promise<unknown>;
}
interface BridgeContextValue {
  status: string; sessionId: string; connected: boolean; enabled: boolean;
  connect: () => void; disconnect: () => void;
  attachReader: (endpoint: ReaderEndpoint) => () => void;
  attachApp: (open: (bookId: string) => Promise<void>) => () => void;
  attachLeaveGuard: (guard: () => boolean) => () => void;
  changed: () => void;
  locateNote: (bookId: string, noteId: string, sourceIndex?: number) => Promise<unknown>;
}
const Context = createContext<BridgeContextValue | null>(null);
export function useBridge() { const value = useContext(Context); if (!value) throw new Error('bridge provider missing'); return value; }

export function BridgeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(() => sessionStorage.getItem('rg-bridge-enabled') === 'yes');
  const [status, setStatus] = useState('未连接外部工具');
  const [sessionId, setSessionId] = useState('');
  const socket = useRef<WebSocket | null>(null);
  const endpoint = useRef<ReaderEndpoint | null>(null);
  const openBook = useRef<((bookId: string) => Promise<void>) | null>(null);
  const leaveGuard = useRef<(() => boolean) | null>(null);
  const clientId = useRef(sessionStorage.getItem('rg-bridge-client') ?? crypto.randomUUID());
  sessionStorage.setItem('rg-bridge-client', clientId.current);
  const changed = () => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type: 'state', snapshot:
      endpoint.current?.snapshot() ?? { bookId: null, title: '书架', page: 0, contextVersion: 'bookshelf' } }));
  };
  const handler = useRef<(request: BridgeCommand) => Promise<BridgeResult>>(null);
  handler.current = async command => {
    try {
      parseRequest(commandWithoutTransport(command));
      if (Date.now() > command.expiresAt) throw new BridgeError('TIMEOUT', '操作已过期。');
      if (durableOperations.has(command.operation)) { const saved = await storedRequest(command); if (saved) return saved; }
      if (command.operation === 'books.list') return { ok: true, data: (await library.list()).map(({ id, title, pages, available, progress }) => ({ id, title, pages, available, progress })) };
      if (command.operation === 'reader.open') {
        if (leaveGuard.current?.()) throw new BridgeError('UNSAVED_NOTE', '笔记尚未保存，请先保存或明确放弃输入。');
        if (!command.bookId || !openBook.current) throw new BridgeError('MISSING_BOOK', '请指定书籍。');
        await openBook.current(command.bookId); return { ok: true, data: { requestedBookId: command.bookId } };
      }
      if (!command.bookId) throw new BridgeError('MISSING_BOOK', '请指定书籍。');
      if (command.operation === 'conversation.publish') return await durable(command, () => publishMessage(command.bookId!, command.params));
      if (command.operation === 'conversation.list') return { ok: true, data: await listMessages(command.bookId) };
      if (command.operation === 'notes.locate') return { ok: true, data: await locateNote(command, {
        reader: () => endpoint.current, guarded: () => !!leaveGuard.current?.(),
        open: async id => {
          if (!openBook.current) throw new BridgeError('NOT_READY', '阅读窗口尚未准备好。');
          await openBook.current(id);
        },
      }) };
      if (command.operation.startsWith('notes.')) {
        return { ok: true, data: await notes.execute(command, async source => {
          if (!command.contextVersion) throw new BridgeError('STALE_CONTEXT', '选段创建需要当前上下文版本。');
          const reader = endpoint.current;
          if (!reader || reader.snapshot().bookId !== command.bookId) throw new BridgeError('BOOK_NOT_OPEN', '请打开来源书籍。');
          await reader.verifySource(source, command.contextVersion);
        }) };
      }
      const reader = endpoint.current, snapshot = reader?.snapshot();
      if (!reader || snapshot?.bookId !== command.bookId) throw new BridgeError('BOOK_NOT_OPEN', '请在指定阅读器打开此书。');
      if (contextualOperations.has(command.operation) && command.contextVersion !== snapshot.contextVersion) throw new BridgeError('STALE_CONTEXT', '阅读上下文已改变，请重新读取当前上下文。');
      return { ok: true, data: await reader.execute(command) };
    } catch (error) { return failure(error); }
  };
  useEffect(() => {
    if (!enabled) return;
    let stopped = false, timer: ReturnType<typeof setTimeout>, current: WebSocket | undefined;
    const start = async () => {
      setStatus('正在连接本地服务');
      try {
        const response = await fetch('/rg-api/pair', { method: 'POST', signal: AbortSignal.timeout(4000) });
        const result = await response.json();
        if (stopped) return;
        if (!result.ok) throw new Error('pair');
        current = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/rg-api/ws`);
        socket.current = current;
        current.onopen = () => current?.send(JSON.stringify({ type: 'hello', token: result.data.token, clientId: clientId.current }));
        current.onmessage = event => {
          const value = JSON.parse(event.data);
          if (value.type === 'ready') { setSessionId(value.sessionId); setStatus('外部工具已连接'); changed(); }
          if (value.type === 'command') void handler.current!(value.request).then(result => {
            if (current?.readyState === WebSocket.OPEN && socket.current === current) current.send(JSON.stringify({ type: 'result', requestId: value.request.requestId, result }));
          });
        };
        current.onclose = () => { setSessionId(''); setStatus('连接已断开，正在重连'); if (!stopped) timer = setTimeout(start, 2000); };
        current.onerror = () => {};
      } catch { if (!stopped) { setStatus('本地服务不可用，请先启动服务'); timer = setTimeout(start, 3000); } }
    };
    void start();
    return () => { stopped = true; clearTimeout(timer); current?.close(); if (socket.current === current) socket.current = null; setSessionId(''); };
  }, [enabled]);
  return <Context.Provider value={{ status, sessionId, connected: !!sessionId, enabled,
    locateNote: async (bookId, noteId, sourceIndex = 0) => {
      const result = await handler.current!({ ...parseRequest({ operation: 'notes.locate', bookId,
        params: { noteId, sourceIndex }, requestId: crypto.randomUUID() }), clientId: 'ui', expiresAt: Date.now() + 15000 });
      if (!result.ok) throw new BridgeError(result.error.code, result.error.message);
      return result.data;
    },
    connect: () => { sessionStorage.setItem('rg-bridge-enabled', 'yes'); setEnabled(true); },
    disconnect: () => { sessionStorage.removeItem('rg-bridge-enabled'); setEnabled(false); setStatus('未连接外部工具'); },
    attachReader: reader => { endpoint.current = reader; changed(); return () => { if (endpoint.current === reader) { endpoint.current = null; changed(); } }; },
    attachApp: open => { openBook.current = open; return () => { if (openBook.current === open) openBook.current = null; }; },
    attachLeaveGuard: guard => { leaveGuard.current = guard; return () => { if (leaveGuard.current === guard) leaveGuard.current = null; }; }, changed }}>{children}</Context.Provider>;
}
function commandWithoutTransport({ clientId: _clientId, expiresAt: _expiresAt, ...request }: BridgeCommand) { return request; }
