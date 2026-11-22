import { useEffect, useState, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';

interface NumberFieldProps {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
  id?: string;
  ariaLabel?: string;
}

/** Zahlenfeld mit −/+ Tasten; übernimmt Eingaben beim Verlassen oder Enter. */
export function NumberField({ value, onChange, min, max, step = 1, id, ariaLabel }: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (raw: string) => {
    const n = Math.round(Number(raw.replace(',', '.')));
    if (!Number.isFinite(n)) {
      setText(String(value));
      return;
    }
    const v = Math.max(min, Math.min(max, n));
    setText(String(v));
    if (v !== value) onChange(v);
  };
  return (
    <div className="number-input">
      <button type="button" tabIndex={-1} aria-hidden onClick={() => commit(String(value - step))} disabled={value <= min}>
        <Minus size={16} />
      </button>
      <input
        id={id}
        aria-label={ariaLabel}
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            commit(String(value + step));
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            commit(String(value - step));
          }
        }}
      />
      <button type="button" tabIndex={-1} aria-hidden onClick={() => commit(String(value + step))} disabled={value >= max}>
        <Plus size={16} />
      </button>
    </div>
  );
}

interface SegProps<T extends string | number> {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  block?: boolean;
  ariaLabel?: string;
}

export function Segmented<T extends string | number>({ value, options, onChange, block, ariaLabel }: SegProps<T>) {
  return (
    <div className={`seg ${block ? 'seg-block' : ''}`} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)} title={o.title}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="switch">
      <span>{children}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

interface SliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => ReactNode;
}

export function Slider({ label, value, min, max, step = 1, onChange, format }: SliderProps) {
  return (
    <label className="slider-field">
      <span className="field-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="slider-value">{format ? format(value) : value}</span>
    </label>
  );
}
