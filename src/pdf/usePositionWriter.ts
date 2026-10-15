import { useEffect, useRef, useState } from 'react';
import { library } from '../library/repository';
import { PositionWriter } from './PositionWriter';

export function usePositionWriter(bookId: string, onProgress: () => Promise<void>) {
  const [status, setStatus] = useState('正在打开 PDF');
  const live = useRef(true);
  const changed = useRef(onProgress); changed.current = onProgress;
  const [writer] = useState(() => new PositionWriter(async location => {
    const { page, ...view } = location;
    await library.savePosition(bookId, page, view);
    await changed.current().catch(() => {});
  }, text => { if (live.current) setStatus(text); }));
  useEffect(() => {
    live.current = true;
    const flush = () => { void writer.flush().catch(() => {}); };
    window.addEventListener('pagehide', flush);
    return () => { live.current = false; writer.cancelTimer(); window.removeEventListener('pagehide', flush); };
  }, [writer]);
  return { writer, status };
}
