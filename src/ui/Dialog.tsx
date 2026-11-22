import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useT } from '../i18n';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  className?: string;
  /** Schließen per Klick auf den Hintergrund erlauben */
  dismissable?: boolean;
  headerExtra?: ReactNode;
  bodyClassName?: string;
  labelledBy?: string;
}

/** Modaler Dialog auf Basis des nativen <dialog>-Elements (Fokus, Esc und Hintergrund inklusive). */
export function Dialog({ open, onClose, title, children, footer, wide, className, dismissable = true, headerExtra, bodyClassName }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    d.addEventListener('cancel', onCancel);
    return () => d.removeEventListener('cancel', onCancel);
  }, []);

  if (!open) return <dialog ref={ref} className="dialog" />;

  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog-wide' : ''} ${className ?? ''}`}
      onMouseDown={(e) => {
        if (dismissable && e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          if (!inside) onClose();
        }
      }}
    >
      <div className="dialog-header">
        <h2>{title}</h2>
        {headerExtra}
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')} title={t('common.close')}>
          <X size={20} />
        </button>
      </div>
      <div className={`dialog-body ${bodyClassName ?? ''}`}>{children}</div>
      {footer && <div className="dialog-footer">{footer}</div>}
    </dialog>
  );
}
