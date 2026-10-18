import { useEffect, useRef } from 'react';
import { sendDesktop } from './desktopTransport';

/** The web shell owns geometry; the native surface only renders the external site. */
export function useNativeSurface(visible: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current!; let frame = 0, previous = '';
    const update = () => {
      clearTimeout(frame); frame = window.setTimeout(() => {
        const rect = element.getBoundingClientRect();
        const dialogs = document.querySelectorAll('dialog[open]');
        const top = dialogs.item(dialogs.length - 1);
        const fields = { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          visible: visible && !!top?.classList.contains('reader-screen') && rect.width > 0 && rect.height > 0 };
        const value = JSON.stringify(fields);
        if (value !== previous) { previous = value; sendDesktop('external.layout', fields); }
      });
    };
    const resize = new ResizeObserver(update); resize.observe(element);
    const mutations = new MutationObserver(update);
    mutations.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    window.addEventListener('resize', update); window.addEventListener('scroll', update, true); update();
    return () => { resize.disconnect(); mutations.disconnect(); clearTimeout(frame);
      window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true);
      sendDesktop('external.layout', { visible: false }); };
  }, [visible]);
  return ref;
}
