import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Modal({ title, onClose, children, wide = false, screen = false }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean; screen?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef(document.activeElement as HTMLElement | null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = returnFocus.current;
    const dialog = ref.current!;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={(wide ? 'modal modal-wide' : 'modal') + (screen ? ' reader-screen' : '')} aria-label={title}
    onCancel={event => { event.preventDefault(); closeRef.current(); }}
    onClick={event => { if (!screen && event.target === event.currentTarget) closeRef.current(); }}>
    <header className="modal-header">{screen && <strong className="reader-brand"><Icon name="book" size={18} />流光忆庭</strong>}<h2>{title}</h2>
      <button className="icon-button" aria-label="关闭" onClick={onClose}><Icon name="close" /></button>
    </header>
    {children}
  </dialog>;
}
