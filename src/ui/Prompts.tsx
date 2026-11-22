import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { useT } from '../i18n';

export function PromptDialog({ open, title, label, initial, onSubmit, onClose }: { open: boolean; title: string; label: string; initial: string; onSubmit: (v: string) => void; onClose: () => void }) {
  const t = useT();
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);
  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={!value.trim()}>
            {t('common.apply')}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">{label}</span>
        <input
          className="input"
          value={value}
          maxLength={120}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
      </label>
    </Dialog>
  );
}

export function ConfirmDialog({ open, title, text, confirmLabel, danger, onConfirm, onClose }: { open: boolean; title: string; text: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p>{text}</p>
    </Dialog>
  );
}
