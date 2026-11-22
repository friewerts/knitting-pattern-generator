import { X } from 'lucide-react';
import { dismissToast, useApp } from '../state/app';
import { useT } from '../i18n';

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const t = useT();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((to) => (
        <div key={to.id} className="toast">
          <span className="toast-text">{to.text}</span>
          {to.action && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                to.action!.run();
                dismissToast(to.id);
              }}
            >
              {to.action.label}
            </button>
          )}
          <button type="button" className="icon-btn icon-btn-sm" style={{ color: 'inherit' }} onClick={() => dismissToast(to.id)} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
