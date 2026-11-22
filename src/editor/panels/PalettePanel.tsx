import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Eraser as EraserIcon, Star } from 'lucide-react';
import { useEd, useEditor } from '../context';
import { useLang, useT } from '../../i18n';
import { colorLetter, inkFor, SUGGESTED_COLORS } from '../../model/color';
import { MAX_PALETTE } from '../../model/types';
import { colorCounts, movePaletteColor, removePaletteColor, removeUnusedColors } from '../../model/grid';
import { SYMBOLS, SYMBOL_CATEGORIES, symbolName } from '../../model/stitches';
import { SymbolIcon } from '../../ui/SymbolIcon';
import { ColorDialog } from '../../ui/ColorDialog';
import { toast } from '../../state/app';

export function ColorEditDialog({ index, onClose }: { index: number | null; onClose: () => void }) {
  const t = useT();
  const { actions } = useEditor();
  const grid = useEd((s) => s.committed);
  const [replaceWith, setReplaceWith] = useState(0);
  const entry = index !== null ? grid.palette[index] : null;
  const counts = useMemo(() => (index !== null ? colorCounts(grid) : []), [grid, index]);
  if (index === null || !entry) return <ColorDialog open={false} title="" hex="#000000" onApply={() => {}} onClose={onClose} />;
  const others = grid.palette.map((p, i) => ({ p, i })).filter(({ i }) => i !== index);
  const target = replaceWith === index || replaceWith >= grid.palette.length ? others[0]?.i ?? 0 : replaceWith;
  return (
    <ColorDialog
      open
      title={t('color.title', { letter: colorLetter(index) })}
      letter={colorLetter(index)}
      hex={entry.hex}
      name={entry.name}
      onClose={onClose}
      onApply={(hex, name) => {
        actions.apply((g) => {
          g.palette[index] = { hex, name };
        });
      }}
      extraFooter={
        index > 0 ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              actions.apply((g) => movePaletteColor(g, index, 0));
              actions.store.setState({ activeColor: 0 });
              onClose();
            }}
          >
            <Star size={16} />
            {t('color.moveFirst')}
          </button>
        ) : undefined
      }
    >
      <p className="hint">{t('color.used', { n: counts[index] ?? 0 })}</p>
      {others.length > 0 && (
        <details className="disclosure">
          <summary>{t('color.remove')}</summary>
          <div className="disclosure-body">
            <span className="field-label">{t('color.replaceWith')}</span>
            <div className="swatches">
              {others.map(({ p, i }) => (
                <button
                  key={i}
                  type="button"
                  className="swatch-btn"
                  style={{ background: p.hex, color: inkFor(p.hex), outline: target === i ? '3px solid var(--primary)' : undefined, outlineOffset: 2 }}
                  onClick={() => setReplaceWith(i)}
                  aria-pressed={target === i}
                  aria-label={colorLetter(i)}
                >
                  {colorLetter(i)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                actions.apply((g) => removePaletteColor(g, index, target));
                const s = actions.state;
                actions.store.setState({ activeColor: Math.min(s.activeColor, s.committed.palette.length - 1) });
                onClose();
              }}
            >
              <Trash2 size={17} />
              {t('color.remove')}
            </button>
          </div>
        </details>
      )}
    </ColorDialog>
  );
}

export function PaletteSwatches({ compact = false, onEdit }: { compact?: boolean; onEdit: (i: number) => void }) {
  const t = useT();
  const { actions } = useEditor();
  const palette = useEd((s) => s.grid.palette);
  const active = useEd((s) => s.activeColor);
  const target = useEd((s) => s.paintTarget);
  return (
    <>
      {palette.map((p, i) => {
        const selected = target === 'color' && active === i;
        return (
          <button
            key={i}
            type="button"
            className="pal-swatch"
            style={{ background: p.hex, color: inkFor(p.hex) }}
            aria-pressed={selected}
            title={`${colorLetter(i)}${p.name ? ` – ${p.name}` : ''}`}
            aria-label={`${t('palette.colors')} ${colorLetter(i)}${p.name ? ` – ${p.name}` : ''}`}
            onClick={() => {
              if (selected && compact) onEdit(i);
              else actions.selectColor(i);
            }}
            onDoubleClick={() => onEdit(i)}
          >
            {colorLetter(i)}
            {!compact && (
              <span
                className="pal-edit"
                role="button"
                aria-label={t('palette.edit')}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(i);
                }}
              >
                <Pencil size={12} />
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

export function useAddColor() {
  const { actions } = useEditor();
  const t = useT();
  return () => {
    const g = actions.state.committed;
    if (g.palette.length >= MAX_PALETTE) {
      toast(t('palette.full', { n: MAX_PALETTE }));
      return -1;
    }
    const used = new Set(g.palette.map((p) => p.hex));
    const next = SUGGESTED_COLORS.find((c) => !used.has(c.hex))?.hex ?? '#888888';
    actions.apply((gr) => {
      gr.palette.push({ hex: next, name: '' });
    });
    const idx = actions.state.committed.palette.length - 1;
    actions.selectColor(idx);
    return idx;
  };
}

export function SymbolPicker() {
  const lang = useLang((s) => s.lang);
  const { actions } = useEditor();
  const active = useEd((s) => s.activeSymbol);
  const target = useEd((s) => s.paintTarget);
  return (
    <>
      {SYMBOL_CATEGORIES.map((cat) => (
        <div key={cat.key} className="panel-section" style={{ gap: 6 }}>
          <span className="symbol-cat">{cat[lang]}</span>
          <div className="symbol-grid">
            {SYMBOLS.filter((s) => s.category === cat.key).map((s) => (
              <button
                key={s.key}
                type="button"
                className={`symbol-btn ${s.width >= 4 ? 'wide' : ''}`}
                aria-pressed={target === 'symbol' && active === s.code}
                title={symbolName(s, lang)}
                aria-label={symbolName(s, lang)}
                onClick={() => actions.selectSymbol(s.code)}
              >
                <SymbolIcon code={s.code} size={s.width > 1 ? 13 : 26} aspect={s.width > 1 ? 2 : 1} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function PalettePanel() {
  const t = useT();
  const { actions } = useEditor();
  const [editing, setEditing] = useState<number | null>(null);
  const addColor = useAddColor();
  return (
    <div className="panel-body">
      <section className="panel-section">
        <div className="panel-section-head">
          <h3>{t('palette.colors')}</h3>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            title={t('palette.removeUnused')}
            onClick={() => actions.apply((g) => removeUnusedColors(g))}
          >
            <EraserIcon size={15} />
            <span className="sr-only">{t('palette.removeUnused')}</span>
          </button>
        </div>
        <div className="palette-grid">
          <PaletteSwatches onEdit={setEditing} />
          <button
            type="button"
            className="pal-add"
            title={t('palette.add')}
            aria-label={t('palette.add')}
            onClick={() => {
              const i = addColor();
              if (i >= 0) setEditing(i);
            }}
          >
            <Plus size={20} />
          </button>
        </div>
      </section>
      <section className="panel-section">
        <div className="panel-section-head">
          <h3>{t('palette.symbols')}</h3>
        </div>
        <SymbolPicker />
        <p className="hint">{t('palette.symbolHint')}</p>
      </section>
      <ColorEditDialog index={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
