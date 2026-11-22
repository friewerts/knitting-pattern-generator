import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChartDoc, Rect } from '../model/types';
import { cellAspect, finishedSize } from '../model/doc';
import { renderChartImage, type AnyCanvas } from '../render/chartRender';
import { buildKnitBitmap } from '../render/knitPreview';
import { chartInstructions, chartUsesMultipleColors, formatRow } from '../model/instructions';
import { translate } from '../i18n';
import type { Lang } from '../model/stitches';
import { LegendContent } from '../editor/panels/LegendPanel';

export interface PrintOptions {
  cellMm: number;
  orientation: 'portrait' | 'landscape';
  legend: boolean;
  instructions: boolean;
  knitView: boolean;
}

const PX_PER_MM = 8;

/** Teilt das Raster in Seiten auf – beginnend unten rechts (Reihe 1, Masche 1). */
export function computeTiles(grid: { width: number; height: number }, aspect: number, opts: Pick<PrintOptions, 'cellMm' | 'orientation'>): Rect[] {
  const pageW = opts.orientation === 'portrait' ? 186 : 273;
  const pageH = (opts.orientation === 'portrait' ? 273 : 186) - 28;
  const digits = String(Math.max(grid.width, grid.height)).length;
  const side = digits * 1.7 + 3;
  const cols = Math.max(1, Math.floor((pageW - side * 2) / opts.cellMm));
  const rows = Math.max(1, Math.floor((pageH - 6) / (opts.cellMm * aspect)));
  const tiles: Rect[] = [];
  for (let yEnd = grid.height; yEnd > 0; yEnd -= rows) {
    const y0 = Math.max(0, yEnd - rows);
    for (let xEnd = grid.width; xEnd > 0; xEnd -= cols) {
      const x0 = Math.max(0, xEnd - cols);
      tiles.push({ x: x0, y: y0, width: xEnd - x0, height: yEnd - y0 });
    }
  }
  return tiles;
}

interface Props {
  doc: ChartDoc;
  lang: Lang;
  options: PrintOptions;
  onDone: () => void;
}

/** Druckansicht: wird in ein eigenes Element gerendert und nur beim Drucken angezeigt. */
export function PrintView({ doc, lang, options, onDone }: Props) {
  const t = (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(lang, k, p);
  const rootRef = useRef<HTMLDivElement>(null);
  const [container] = useState(() => {
    const el = document.createElement('div');
    el.className = 'print-root';
    return el;
  });
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const g = doc.grid;
  const aspect = cellAspect(doc.settings);
  const tiles = useMemo(() => {
    const rects = computeTiles(g, aspect, options);
    const knit: AnyCanvas | null = options.knitView ? buildKnitBitmap(g, aspect) : null;
    return rects.map((r) => {
      const canvas = renderChartImage(g, doc.settings, {
        cell: options.cellMm * PX_PER_MM,
        aspect,
        showSymbols: true,
        showNumbers: true,
        region: r,
        highlightEvery: doc.settings.highlightEvery,
        knitBitmap: knit,
        fontPx: PX_PER_MM * 2.6,
      });
      const url = (canvas as HTMLCanvasElement).toDataURL('image/png');
      return { rect: r, url, widthMm: canvas.width / PX_PER_MM };
    });
  }, [g, aspect, options, doc.settings]);

  const { rows, castOn } = useMemo(() => {
    const all = chartInstructions(g, doc.settings);
    const multi = chartUsesMultipleColors(g);
    return { rows: options.instructions ? all.map((r) => formatRow(r, lang, multi)) : [], castOn: all[0]?.stitchesBefore ?? g.width };
  }, [g, doc.settings, lang, options.instructions]);

  useEffect(() => {
    let cancelled = false;
    document.body.appendChild(container);
    const style = document.createElement('style');
    style.textContent = `@media print { @page { size: A4 ${options.orientation}; margin: 12mm; } }`;
    document.head.appendChild(style);
    const after = () => doneRef.current();
    window.addEventListener('afterprint', after);
    const imgs = Array.from(rootRef.current?.querySelectorAll('img') ?? []);
    Promise.all(imgs.map((img) => img.decode().catch(() => undefined))).then(() => {
      if (!cancelled) window.print();
    });
    return () => {
      cancelled = true;
      window.removeEventListener('afterprint', after);
      style.remove();
      container.remove();
    };
  }, [container, options.orientation]);

  const size = finishedSize(g, doc.settings);
  const fmt = (n: number) => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: 0 }).format(n);
  const flat = doc.settings.workedIn === 'rows';

  return createPortal(
    <div ref={rootRef}>
      <header className="print-head">
        <h1>{doc.name}</h1>
        <span>{t('export.madeWith')}</span>
      </header>
      <p className="print-facts">
        {t('common.sizeSts', { w: g.width, h: g.height })} · {t('legend.gaugeValue', { s: doc.settings.gaugeStitches, r: doc.settings.gaugeRows })} · {t('legend.finished')}: {fmt(size.width)} × {fmt(size.height)} cm · {flat ? t('settings.rows') : t('settings.rounds')}
      </p>
      {tiles.map((tile, i) => (
        <figure key={i} style={{ breakInside: 'avoid', pageBreakInside: 'avoid', margin: '0 0 6mm' }}>
          {tiles.length > 1 && (
            <figcaption className="print-facts" style={{ marginBottom: 2 }}>
              {t('export.pageOf', { n: i + 1, total: tiles.length })} ·{' '}
              {t('export.pageRange', {
                r1: g.height - (tile.rect.y + tile.rect.height) + 1,
                r2: g.height - tile.rect.y,
                s1: g.width - (tile.rect.x + tile.rect.width) + 1,
                s2: g.width - tile.rect.x,
              })}
            </figcaption>
          )}
          <img className="print-tile" src={tile.url} alt="" style={{ width: `${tile.widthMm}mm` }} />
        </figure>
      ))}
      {options.legend && (
        <section className="print-legend-wrap" style={{ breakInside: 'avoid' }}>
          <div className="print-legend">
            <LegendContent grid={g} settings={doc.settings} t={t} lang={lang} />
          </div>
        </section>
      )}
      {options.instructions && rows.length > 0 && (
        <section style={{ breakBefore: 'page' }}>
          <h2 style={{ fontSize: '13pt', marginBottom: '4mm' }}>{t('panel.instructions')}</h2>
          <p className="print-facts">
            {t('instr.castOn', { n: castOn })} · {flat ? t('instr.readRows') : t('instr.readRounds')}
          </p>
          <ol className="print-instr">
            {rows.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        </section>
      )}
    </div>,
    container,
  );
}
