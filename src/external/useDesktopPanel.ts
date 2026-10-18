import { useBridge } from './BridgeProvider';
import { useEffect, useState, useRef } from 'react';
import { desktopAvailable, disconnected, sendDesktop, type DesktopState } from './desktopTransport';

export function useDesktopPanel(resource: string) {
  const bridge = useBridge();
  const generation = useRef(0);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DesktopState>(disconnected);
  const available = desktopAvailable();
  useEffect(() => {
    const changed = (event: Event) => setOpen((event as CustomEvent).detail === true);
    const status = (event: Event) => {
      const detail = (event as CustomEvent<DesktopState>).detail;
      if (detail && ['disconnected', 'connecting', 'loaded', 'error'].includes(detail.status)) setState(detail);
    };
    window.addEventListener('garden-external-panel', changed);
    window.addEventListener('garden-external-state', status); sendDesktop('external.state');
    return () => { generation.current++; window.removeEventListener('garden-external-panel', changed);
      window.removeEventListener('garden-external-state', status); sendDesktop('external.close'); };
  }, []);
  function cancel() { generation.current++; setPending(false); sendDesktop('external.cancel'); }
  async function connect() {
    if (!available || pending) return;
    const current = ++generation.current; setPending(true);
    try {
      const context = await bridge.prepareExternal(resource);
      if (generation.current === current) sendDesktop('external.toggle', { context, open: true });
    } catch (error) {
      if (generation.current === current) setState(value => ({ ...value, status: 'error', message: error instanceof Error ? error.message : '内容服务未就绪' }));
    } finally { if (generation.current === current) setPending(false); }
  }
  return { available, open, state: pending ? { ...state, status: 'connecting' as const, message: '正在准备阅读上下文…' } : state,
    connect, cancel, disconnect: () => { cancel(); sendDesktop('external.close'); },
    toggle: () => { if (!available) return false; if (open) { cancel(); sendDesktop('external.close'); } else void connect(); return true; } };
}
export type DesktopPanel = ReturnType<typeof useDesktopPanel>;
