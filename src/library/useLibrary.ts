import { useCallback, useEffect, useRef, useState } from 'react';
import { library } from './repository';
import { describeError } from './errors';
import type { BookView } from './model';

export function useLibrary() {
  const [books, setBooks] = useState<BookView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const channel = useRef<BroadcastChannel | null>(null);
  const serial = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++serial.current;
    try {
      const result = await library.list();
      if (request === serial.current) { setBooks(result); setError(''); }
    } catch (error) { if (request === serial.current) setError(describeError(error)); }
    finally { if (request === serial.current) setLoading(false); }
  }, []);
  const changed = useCallback(async () => {
    await refresh();
    channel.current?.postMessage('updated');
  }, [refresh]);
  useEffect(() => {
    void refresh();
    const listener = new BroadcastChannel('RecollectionGarden.library');
    channel.current = listener;
    listener.onmessage = () => { void refresh(); };
    return () => { listener.close(); channel.current = null; serial.current++; };
  }, [refresh]);
  return { books, loading, error, refresh, changed };
}
