import { BridgeError, type BridgeCommand } from '../external/protocol';
import type { ReaderEndpoint } from '../external/BridgeProvider';
import { locateSchema } from './discoveryProtocol';
import { noteDiscovery } from './discoveryRepository';

interface Host {
  reader: () => ReaderEndpoint | null;
  guarded: () => boolean;
  open: (bookId: string) => Promise<void>;
}
export async function locateNote(command: BridgeCommand, host: Host) {
  const bookId = command.bookId;
  if (!bookId) throw new BridgeError('MISSING_BOOK', '请指定书籍。');
  const params = locateSchema.parse(command.params);
  const active = host.reader();
  const check = () => {
    if (Date.now() > command.expiresAt) throw new BridgeError('TIMEOUT', '来源定位超时，请查询原请求结果。');
    if (host.guarded()) throw new BridgeError('UNSAVED_NOTE', '笔记尚未保存，请先保存或明确放弃输入。');
  };
  check();
  if (active?.snapshot().bookId === bookId && command.contextVersion
    && command.contextVersion !== active.snapshot().contextVersion)
    throw new BridgeError('STALE_CONTEXT', '阅读上下文已改变，请重新读取。');
  const target = await noteDiscovery.target(bookId, params.noteId, params.sourceIndex);
  check();
  if (active?.snapshot().bookId !== bookId) {
    if (active) await active.flush();
    check(); await host.open(bookId);
  }
  while (!host.reader()?.ready() || host.reader()?.snapshot().bookId !== bookId) {
    if (host.reader()?.snapshot().bookId === bookId && host.reader()?.error())
      throw new BridgeError('PDF_OPEN_FAILED', host.reader()!.error()!);
    check(); await new Promise(resolve => setTimeout(resolve, 40));
  }
  check();
  return host.reader()!.locateSource(target, command.expiresAt);
}
