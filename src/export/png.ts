import type { ChartDoc } from '../model/types';
import { cellAspect, finishedSize } from '../model/doc';
import { colorLetter, inkFor } from '../model/color';
import { drawSymbolPart, type Lang } from '../model/stitches';
import { renderChartImage, type AnyCanvas } from '../render/chartRender';
import { buildKnitBitmap } from '../render/knitPreview';
import { legendData } from '../model/legend';
import { translate } from '../i18n';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export interface PngOptions {
  knitView: boolean;
  legend: boolean;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Komplettes Musterbild mit Titel, Raster (mit Nummern) und Legende. */
export function renderExportImage(doc: ChartDoc, lang: Lang, opts: PngOptions): HTMLCanvasElement {
  const t = (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(lang, k, p);
  const g = doc.grid;
  const aspect = cellAspect(doc.settings);
  const cell = Math.max(8, Math.min(30, Math.floor(2600 / Math.max(g.width, g.height * aspect))));
  const knit: AnyCanvas | null = opts.knitView ? buildKnitBitmap(g, aspect) : null;
  const chart = renderChartImage(g, doc.settings, {
    cell,
    aspect,
    showSymbols: true,
    showNumbers: true,
    highlightEvery: doc.settings.highlightEvery,
    knitBitmap: knit,
  });

  const pad = 40;
  const legend = legendData(g, lang);
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `15px ${FONT}`;

  const contentW = Math.max(chart.width, 760);
  const width = contentW + pad * 2;
  const colW = 360;
  const cols = Math.max(1, Math.floor(contentW / colW));
  const flat = doc.settings.workedIn === 'rows';

  interface Item {
    kind: 'color' | 'symbol' | 'blank';
    label: string;
    sub: string[];
    hex?: string;
    letter?: string;
    code?: number;
    width?: number;
    count: string;
  }
  const items: Item[] = [];
  if (opts.legend) {
    for (const c of legend.colors) {
      items.push({ kind: 'color', label: c.name || c.hex.toUpperCase(), sub: [], hex: c.hex, letter: colorLetter(c.index), count: t('legend.stitches', { n: c.count }) });
    }
    items.push({ kind: 'blank', label: t('legend.blank'), sub: [flat ? t('legend.blankRows') : t('legend.blankRounds')], count: '' });
    for (const s of legend.symbols) {
      const sub = flat && s.rs !== s.ws ? [`${t('legend.rs')}: ${s.rs}`, `${t('legend.ws')}: ${s.ws}`] : [s.rs];
      const wrapped = sub.flatMap((line) => wrapText(measure, line, colW - 80));
      items.push({ kind: 'symbol', label: s.name, sub: wrapped, code: s.code, width: s.width, count: `×${s.count}` });
    }
  }
  const itemH = (it: Item) => 30 + it.sub.length * 17;
  const rowsPerCol = Math.ceil(items.length / cols);
  const colHeights: number[] = [];
  for (let c = 0; c < cols; c++) {
    let h = 0;
    for (let i = c * rowsPerCol; i < Math.min(items.length, (c + 1) * rowsPerCol); i++) h += itemH(items[i]) + 10;
    colHeights.push(h);
  }
  const legendH = items.length ? Math.max(...colHeights) + 40 : 0;
  const headerH = 86;
  const footerH = 40;
  const height = pad + headerH + chart.height + (legendH ? 24 + legendH : 0) + footerH + pad / 2;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Kopf
  ctx.fillStyle = '#1f1a17';
  ctx.font = `bold 28px ${FONT}`;
  ctx.textBaseline = 'top';
  ctx.fillText(doc.name, pad, pad);
  const size = finishedSize(g, doc.settings);
  ctx.font = `15px ${FONT}`;
  ctx.fillStyle = '#5b524b';
  const fmt = (n: number) => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: 0 }).format(n);
  const facts = [
    t('common.sizeSts', { w: g.width, h: g.height }),
    t('legend.gaugeValue', { s: doc.settings.gaugeStitches, r: doc.settings.gaugeRows }),
    `${t('legend.finished')}: ${fmt(size.width)} × ${fmt(size.height)} cm`,
    flat ? t('settings.rows') : t('settings.rounds'),
  ].join('  ·  ');
  ctx.fillText(facts, pad, pad + 40);

  // Raster
  const chartX = pad + Math.max(0, (contentW - chart.width) / 2);
  const chartY = pad + headerH;
  ctx.drawImage(chart as CanvasImageSource, chartX, chartY);

  // Legende
  if (items.length) {
    let y0 = chartY + chart.height + 24;
    ctx.strokeStyle = '#e3d9cd';
    ctx.beginPath();
    ctx.moveTo(pad, y0);
    ctx.lineTo(width - pad, y0);
    ctx.stroke();
    y0 += 20;
    for (let c = 0; c < cols; c++) {
      let y = y0;
      const x = pad + c * (contentW / cols);
      for (let i = c * rowsPerCol; i < Math.min(items.length, (c + 1) * rowsPerCol); i++) {
        const it = items[i];
        const box = 28;
        if (it.kind === 'color') {
          ctx.fillStyle = it.hex!;
          ctx.fillRect(x, y, box, box);
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.strokeRect(x + 0.5, y + 0.5, box - 1, box - 1);
          ctx.fillStyle = inkFor(it.hex!);
          ctx.font = `bold 13px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(it.letter!, x + box / 2, y + box / 2 + 1);
          ctx.textAlign = 'left';
        } else {
          const w = it.kind === 'symbol' ? it.width! : 1;
          const cs = w > 1 ? Math.min(box, Math.floor(84 / w)) : box;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y, cs * w, box);
          if (it.kind === 'symbol') {
            for (let k = 0; k < w; k++) drawSymbolPart(ctx, it.code! + k, x + k * cs, y, cs, box, '#1c1917', '#ffffff');
          }
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.strokeRect(x + 0.5, y + 0.5, cs * w - 1, box - 1);
        }
        const textX = x + (it.kind === 'symbol' && it.width! > 1 ? Math.min(box, Math.floor(84 / it.width!)) * it.width! : box) + 12;
        ctx.fillStyle = '#1f1a17';
        ctx.font = `600 15px ${FONT}`;
        ctx.textBaseline = 'top';
        ctx.fillText(it.label, textX, y + 5);
        if (it.count) {
          const lw = ctx.measureText(it.label).width;
          ctx.fillStyle = '#8f857b';
          ctx.font = `14px ${FONT}`;
          ctx.fillText(`·  ${it.count}`, textX + lw + 10, y + 6);
        }
        ctx.fillStyle = '#5b524b';
        ctx.font = `13px ${FONT}`;
        it.sub.forEach((line, li) => ctx.fillText(line, textX, y + 26 + li * 17));
        y += itemH(it) + 10;
      }
    }
  }

  // Fuß
  ctx.fillStyle = '#a39a91';
  ctx.font = `12px ${FONT}`;
  ctx.textBaseline = 'bottom';
  ctx.fillText(t('export.madeWith'), pad, height - pad / 2);
  return canvas;
}
