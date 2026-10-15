import { assertActive } from '../library/model';
import { LibraryError } from '../library/errors';

export function hashFile(file: File, signal: AbortSignal): Promise<string> {
  assertActive(signal);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./hash.worker.ts', import.meta.url), { type: 'module' });
    const finish = (error?: Error, hash?: string) => {
      worker.terminate();
      signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(hash!);
    };
    const abort = () => finish(new DOMException('取消', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<{ hash?: string; error?: string }>) => {
      if (data.error) finish(new LibraryError('HASH_FAILED', data.error));
      else finish(undefined, data.hash);
    };
    worker.onerror = () => finish(new LibraryError('WORKER_FAILED', '摘要运行资源加载失败，请刷新后重试。'));
    worker.postMessage(file);
  });
}
