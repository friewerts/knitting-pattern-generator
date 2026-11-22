import { useEffect, useRef, useState, type ReactNode } from 'react';

interface MenuProps {
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  up?: boolean;
  className?: string;
}

/** Einfaches Aufklappmenü, schließt bei Klick außerhalb oder Esc. */
export function Menu({ trigger, children, align = 'right', up = false, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`menu-wrap ${className ?? ''}`} ref={ref}>
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      {open && (
        <div className={`menu ${align === 'left' ? 'menu-left' : ''} ${up ? 'menu-up' : ''}`} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
}

export function MenuItem({ icon, children, onClick, danger, checked, disabled }: MenuItemProps) {
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={checked}
      className={`menu-item ${danger ? 'danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span>{children}</span>
      {checked && <span className="menu-check">✓</span>}
    </button>
  );
}
