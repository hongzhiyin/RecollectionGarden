import { useEffect, useState } from 'react';

type NativeWindow = Window & {
  webkit?: { messageHandlers?: { gardenDesktop?: { postMessage: (message: unknown) => void } } };
  chrome?: { webview?: { postMessage: (message: unknown) => void } };
};
function send(type: 'external.toggle' | 'external.close') {
  const host = window as NativeWindow;
  const bridge = host.webkit?.messageHandlers?.gardenDesktop ?? host.chrome?.webview;
  bridge?.postMessage({ type });
  return !!bridge;
}
export function useDesktopPanel() {
  const [open, setOpen] = useState(false);
  const host = window as NativeWindow;
  const available = !!(host.webkit?.messageHandlers?.gardenDesktop || host.chrome?.webview);
  useEffect(() => {
    const changed = (event: Event) => setOpen((event as CustomEvent).detail === true);
    window.addEventListener('garden-external-panel', changed);
    return () => { window.removeEventListener('garden-external-panel', changed); send('external.close'); };
  }, []);
  return { available, open, toggle: () => send('external.toggle') };
}
