import { useEffect, useState, type ReactNode } from 'react';
import { Dialog } from './Dialog';
import { useLang, useT } from '../i18n';
import { inkFor, isHexColor, normalizeHex, SUGGESTED_COLORS } from '../model/color';

interface Props {
  open: boolean;
  title: string;
  letter?: string;
  hex: string;
  name?: string;
  showName?: boolean;
  onApply: (hex: string, name: string) => void;
  onClose: () => void;
  children?: ReactNode;
  extraFooter?: ReactNode;
}

/** Farbwahl mit Garnfarben-Vorschlägen, eigenem Farbwähler und optionalem Namen. */
export function ColorDialog({ open, title, letter, hex, name = '', showName = true, onApply, onClose, children, extraFooter }: Props) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [value, setValue] = useState(hex);
  const [hexText, setHexText] = useState(hex);
  const [label, setLabel] = useState(name);

  useEffect(() => {
    if (open) {
      setValue(hex);
      setHexText(hex);
      setLabel(name);
    }
  }, [open, hex, name]);

  const choose = (h: string) => {
    const n = normalizeHex(h);
    setValue(n);
    setHexText(n);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          {extraFooter}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onApply(value, label.trim());
              onClose();
            }}
          >
            {t('common.apply')}
          </button>
        </>
      }
    >
      <div className="color-preview">
        <div className="big-swatch" style={{ background: value, color: inkFor(value) }}>
          {letter}
        </div>
        <div className="color-custom">
          <label className="field">
            <span className="field-label">{t('color.custom')}</span>
            <input type="color" value={value} onChange={(e) => choose(e.target.value)} aria-label={t('color.custom')} />
          </label>
          <label className="field">
            <span className="field-label">{t('color.hex')}</span>
            <input
              className="input"
              style={{ width: 120 }}
              value={hexText}
              onChange={(e) => {
                const v = e.target.value.trim();
                setHexText(v);
                const withHash = v.startsWith('#') ? v : `#${v}`;
                if (isHexColor(withHash)) setValue(normalizeHex(withHash));
              }}
              spellCheck={false}
              autoCapitalize="off"
            />
          </label>
        </div>
      </div>
      <div className="field">
        <span className="field-label">{t('color.suggestions')}</span>
        <div className="color-grid">
          {SUGGESTED_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              className="color-chip"
              style={{ background: c.hex }}
              title={c[lang]}
              aria-label={c[lang]}
              aria-pressed={normalizeHex(value) === c.hex}
              onClick={() => {
                choose(c.hex);
                if (showName && !label) setLabel(c[lang]);
              }}
            />
          ))}
        </div>
      </div>
      {showName && (
        <label className="field">
          <span className="field-label">{t('color.name')}</span>
          <input className="input" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} />
        </label>
      )}
      {children}
    </Dialog>
  );
}
