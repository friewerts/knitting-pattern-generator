import type { ChartGrid, ChartSettings, Rect } from '../model/types';
import { hexToRgb, inkFor } from '../model/color';
import { drawSymbolPart, symbolPart } from '../model/stitches';
import { rowSide } from '../model/instructions';

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function createCanvas(w: number, h: number): AnyCanvas {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  return new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
}

export function ctx2d(c: AnyCanvas): Ctx2D {
  return c.getContext('2d') as Ctx2D;
}

/** Bitmap mit einem Pixel je Masche (Farben), wird skaliert gezeichnet. */
export function buildCellBitmap(grid: ChartGrid, target?: AnyCanvas): AnyCanvas {
  const c = target && target.width === grid.width && target.height === grid.height ? target : createCanvas(grid.width, grid.height);
  const ctx = ctx2d(c);
  const img = ctx.createImageData(grid.width, grid.height);
  const rgb = grid.palette.map((p) => hexToRgb(p.hex));
  const d = img.data;
  for (let i = 0; i < grid.colors.length; i++) {
    const col = rgb[grid.colors[i]] ?? [0, 0, 0];
    const o = i * 4;
    d[o] = col[0];
    d[o + 1] = col[1];
    d[o + 2] = col[2];
    d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export interface Viewport {
  /** Position der linken oberen Rasterecke (CSS-Pixel) */
  ox: number;
  oy: number;
  /** Kästchengröße (CSS-Pixel) */
  cw: number;
  ch: number;
  /** Größe der Zeichenfläche (CSS-Pixel) */
  width: number;
  height: number;
  /** Geräte-Pixelverhältnis */
  dpr: number;
}

export interface CellRange {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function visibleRange(grid: { width: number; height: number }, vp: Viewport): CellRange | null {
  const x0 = Math.max(0, Math.floor(-vp.ox / vp.cw));
  const y0 = Math.max(0, Math.floor(-vp.oy / vp.ch));
  const x1 = Math.min(grid.width, Math.ceil((vp.width - vp.ox) / vp.cw));
  const y1 = Math.min(grid.height, Math.ceil((vp.height - vp.oy) / vp.ch));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x0, y0, x1, y1 };
}

export function drawCells(ctx: Ctx2D, bitmap: AnyCanvas, r: CellRange, vp: Viewport): void {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    bitmap as CanvasImageSource,
    r.x0,
    r.y0,
    r.x1 - r.x0,
    r.y1 - r.y0,
    vp.ox + r.x0 * vp.cw,
    vp.oy + r.y0 * vp.ch,
    (r.x1 - r.x0) * vp.cw,
    (r.y1 - r.y0) * vp.ch,
  );
}

/** Zwischenspeicher für Symbol-Grafiken in einer bestimmten Kästchengröße. */
export class SymbolSprites {
  private cache = new Map<string, AnyCanvas>();
  private sizeKey = '';

  get(code: number, bg: string, cw: number, ch: number, dpr: number): AnyCanvas {
    const pw = Math.max(1, Math.round(cw * dpr));
    const ph = Math.max(1, Math.round(ch * dpr));
    const sk = `${pw}x${ph}`;
    if (sk !== this.sizeKey) {
      this.cache.clear();
      this.sizeKey = sk;
    }
    const key = `${code}|${bg}`;
    let sprite = this.cache.get(key);
    if (!sprite) {
      sprite = createCanvas(pw, ph);
      const ctx = ctx2d(sprite);
      drawSymbolPart(ctx, code, 0, 0, pw, ph, inkFor(bg), bg);
      this.cache.set(key, sprite);
    }
    return sprite;
  }
}

export function drawSymbols(ctx: Ctx2D, grid: ChartGrid, r: CellRange, vp: Viewport, sprites: SymbolSprites): void {
  if (vp.cw < 5 || vp.ch < 4) {
    // Bei sehr kleiner Darstellung nur „keine Masche“ andeuten
    ctx.fillStyle = '#b9b3ac';
    for (let y = r.y0; y < r.y1; y++) {
      for (let x = r.x0; x < r.x1; x++) {
        const code = grid.symbols[y * grid.width + x];
        if (code !== 0 && symbolPart(code).symbol.noStitch) ctx.fillRect(vp.ox + x * vp.cw, vp.oy + y * vp.ch, vp.cw, vp.ch);
      }
    }
    return;
  }
  ctx.imageSmoothingEnabled = true;
  for (let y = r.y0; y < r.y1; y++) {
    for (let x = r.x0; x < r.x1; x++) {
      const i = y * grid.width + x;
      const code = grid.symbols[i];
      if (code === 0) continue;
      const bg = grid.palette[grid.colors[i]]?.hex ?? '#ffffff';
      const sprite = sprites.get(code, bg, vp.cw, vp.ch, vp.dpr);
      ctx.drawImage(sprite as CanvasImageSource, vp.ox + x * vp.cw, vp.oy + y * vp.ch, vp.cw, vp.ch);
    }
  }
}

export interface GridStyle {
  thin: string;
  bold: string;
  border: string;
}

export const DEFAULT_GRID_STYLE: GridStyle = {
  thin: 'rgba(48, 40, 36, 0.28)',
  bold: 'rgba(30, 24, 22, 0.72)',
  border: 'rgba(30, 24, 22, 0.9)',
};

function snap(v: number, dpr: number, lw: number): number {
  // Linien auf Gerätepixel ausrichten
  const px = Math.round(v * dpr);
  return (lw * dpr) % 2 === 1 ? (px + 0.5) / dpr : px / dpr;
}

export function drawGridLines(
  ctx: Ctx2D,
  grid: { width: number; height: number },
  r: CellRange,
  vp: Viewport,
  every: number,
  style: GridStyle = DEFAULT_GRID_STYLE,
): void {
  const { ox, oy, cw, ch, dpr } = vp;
  const left = ox + r.x0 * cw;
  const right = ox + r.x1 * cw;
  const top = oy + r.y0 * ch;
  const bottom = oy + r.y1 * ch;
  const thinLw = 1 / dpr;
  const showThin = cw >= 4 && ch >= 3;
  const boldLw = Math.min(cw, ch) >= 14 ? 2 : 1.5;
  const showBold = every > 0 && every * Math.min(cw, ch) >= 6;

  if (showThin) {
    ctx.strokeStyle = style.thin;
    ctx.lineWidth = thinLw;
    ctx.beginPath();
    for (let x = r.x0; x <= r.x1; x++) {
      const sx = snap(ox + x * cw, dpr, thinLw);
      ctx.moveTo(sx, top);
      ctx.lineTo(sx, bottom);
    }
    for (let y = r.y0; y <= r.y1; y++) {
      const sy = snap(oy + y * ch, dpr, thinLw);
      ctx.moveTo(left, sy);
      ctx.lineTo(right, sy);
    }
    ctx.stroke();
  }
  if (showBold) {
    ctx.strokeStyle = style.bold;
    ctx.lineWidth = boldLw;
    ctx.beginPath();
    for (let x = r.x0; x <= r.x1; x++) {
      const fromRight = grid.width - x;
      if (fromRight % every !== 0 || x === 0 || x === grid.width) continue;
      const sx = snap(ox + x * cw, dpr, boldLw);
      ctx.moveTo(sx, top);
      ctx.lineTo(sx, bottom);
    }
    for (let y = r.y0; y <= r.y1; y++) {
      const fromBottom = grid.height - y;
      if (fromBottom % every !== 0 || y === 0 || y === grid.height) continue;
      const sy = snap(oy + y * ch, dpr, boldLw);
      ctx.moveTo(left, sy);
      ctx.lineTo(right, sy);
    }
    ctx.stroke();
  }
  // Außenrahmen
  ctx.strokeStyle = style.border;
  ctx.lineWidth = Math.max(1, boldLw);
  const bx0 = snap(ox, dpr, ctx.lineWidth);
  const by0 = snap(oy, dpr, ctx.lineWidth);
  const bx1 = snap(ox + grid.width * cw, dpr, ctx.lineWidth);
  const by1 = snap(oy + grid.height * ch, dpr, ctx.lineWidth);
  ctx.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
}

export function labelStep(cellSize: number, minSpacing: number): number {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100];
  for (const s of steps) if (s * cellSize >= minSpacing) return s;
  return 100;
}

export interface RulerStyle {
  font: string;
  text: string;
  /** Hintergrund, wenn die Nummern am Rand „kleben“ */
  band: string;
  accent: string;
  accentText: string;
}

export interface RulerOptions {
  /** Nummern am Bildschirmrand halten, wenn das Raster größer als der Ausschnitt ist */
  sticky: boolean;
  /** hervorgehobene Reihe (Strickmodus) */
  activeRow?: number;
  /** Abstand zwischen Raster und Nummern */
  gap: number;
}

export function rulerFontSize(cw: number, ch: number): number {
  return Math.max(9, Math.min(13, Math.min(cw, ch * 1.2) * 0.6));
}

/** Platzbedarf der Nummern (für Ränder beim Export und beim Einpassen). */
export function rulerSize(grid: { width: number; height: number }, cw: number, ch: number, fontPx?: number): { side: number; bottom: number } {
  const fs = fontPx ?? rulerFontSize(cw, ch);
  const digits = String(Math.max(grid.width, grid.height)).length;
  return { side: Math.ceil(digits * fs * 0.62 + 10), bottom: Math.ceil(fs + 10) };
}

/**
 * Reihennummern (Hinreihen rechts, Rückreihen links; in Runden immer rechts)
 * und Maschennummern (unten, von rechts nach links) wie in Strickschriften üblich.
 */
export function drawRulers(
  ctx: Ctx2D,
  grid: { width: number; height: number },
  settings: Pick<ChartSettings, 'workedIn' | 'firstRowRS'>,
  vp: Viewport,
  style: RulerStyle,
  opts: RulerOptions,
): void {
  const { ox, oy, cw, ch } = vp;
  const fs = rulerFontSize(cw, ch);
  const size = rulerSize(grid, cw, ch);
  const gridRight = ox + grid.width * cw;
  const gridBottom = oy + grid.height * ch;
  const gap = opts.gap;
  ctx.font = `${fs}px ${style.font}`;
  ctx.textBaseline = 'middle';

  // Positionen der Nummernspalten (ggf. am Rand gehalten)
  let rightX = gridRight + gap;
  let leftX = ox - gap;
  let bottomY = gridBottom + gap;
  const stickRight = opts.sticky && rightX + size.side > vp.width;
  const stickLeft = opts.sticky && leftX - size.side < 0;
  const stickBottom = opts.sticky && bottomY + size.bottom > vp.height;
  if (stickRight) rightX = vp.width - size.side;
  if (stickLeft) leftX = size.side;
  if (stickBottom) bottomY = vp.height - size.bottom;

  const rowStep = labelStep(ch, fs + 3);
  const colStep = labelStep(cw, size.side - 4);
  const visTop = Math.max(0, Math.floor(-oy / ch));
  const visBottom = Math.min(grid.height, Math.ceil((vp.height - oy) / ch));
  const visLeft = Math.max(0, Math.floor(-ox / cw));
  const visRight = Math.min(grid.width, Math.ceil((vp.width - ox) / cw));

  const sideBottom = stickBottom ? bottomY - 2 : Math.min(vp.height, gridBottom);
  ctx.fillStyle = style.band;
  if (stickRight) ctx.fillRect(rightX - 2, Math.max(0, oy), size.side + 2, sideBottom - Math.max(0, oy));
  if (stickLeft) ctx.fillRect(0, Math.max(0, oy), leftX + 2, sideBottom - Math.max(0, oy));
  if (stickBottom) ctx.fillRect(Math.max(0, ox), bottomY - 2, Math.min(vp.width, gridRight) - Math.max(0, ox), size.bottom + 2);
  // Beschriftungen, die mit den „klebenden“ Rändern kollidieren würden, auslassen
  const rowLimit = stickBottom ? bottomY - 2 : Infinity;

  // Reihennummern
  for (let y = visTop; y < visBottom; y++) {
    const row = grid.height - y;
    const cy = oy + y * ch + ch / 2;
    if (cy + fs / 2 > rowLimit) continue;
    const active = opts.activeRow === row;
    if (!active && row % rowStep !== 0 && row !== 1) continue;
    if (!active && rowStep > 1 && row === 1 && (rowStep - 1) * ch < fs + 3) continue;
    const side = rowSide(row, settings);
    const both = rowStep > 1;
    const onRight = side !== 'ws' || both;
    const onLeft = side === 'ws' || both;
    const label = String(row);
    if (active) {
      const tw = ctx.measureText(label).width;
      const padX = 5;
      const h = Math.max(fs + 6, Math.min(ch, fs + 10));
      ctx.fillStyle = style.accent;
      const draw = (x: number) => {
        roundRect(ctx, x, cy - h / 2, tw + padX * 2, h, h / 2);
        ctx.fill();
      };
      if (onRight) draw(rightX - 2);
      if (onLeft) draw(leftX - tw - padX * 2 + 2);
      ctx.fillStyle = style.accentText;
      ctx.textAlign = 'left';
      if (onRight) ctx.fillText(label, rightX - 2 + padX, cy);
      ctx.textAlign = 'right';
      if (onLeft) ctx.fillText(label, leftX + 2 - padX, cy);
      continue;
    }
    ctx.fillStyle = style.text;
    if (onRight) {
      ctx.textAlign = 'left';
      ctx.fillText(label, rightX, cy);
    }
    if (onLeft) {
      ctx.textAlign = 'right';
      ctx.fillText(label, leftX, cy);
    }
  }

  // Maschennummern
  ctx.fillStyle = style.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = visLeft; x < visRight; x++) {
    const n = grid.width - x;
    if (n % colStep !== 0 && n !== 1) continue;
    if (colStep > 1 && n === 1 && (colStep - 1) * cw < size.side - 4) continue;
    const label = String(n);
    const cx = ox + x * cw + cw / 2;
    const half = ctx.measureText(label).width / 2;
    if (stickLeft && cx - half < leftX + 2) continue;
    if (stickRight && cx + half > rightX - 2) continue;
    ctx.fillText(label, cx, bottomY + 1);
  }
}

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  if ('roundRect' in ctx && typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.rect(x, y, w, h);
}

/** Auswahlrahmen (zweifarbig gestrichelt). */
export function drawSelection(ctx: Ctx2D, sel: Rect, vp: Viewport, color = '#1c1917'): void {
  const x = vp.ox + sel.x * vp.cw;
  const y = vp.oy + sel.y * vp.ch;
  const w = sel.width * vp.cw;
  const h = sel.height * vp.ch;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = color;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

/** Schraffur für Bereiche (z. B. zu lange Spannfäden). */
export function drawMask(ctx: Ctx2D, grid: { width: number }, mask: Uint8Array, r: CellRange, vp: Viewport, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  for (let y = r.y0; y < r.y1; y++) {
    for (let x = r.x0; x < r.x1; x++) {
      if (!mask[y * grid.width + x]) continue;
      const px = vp.ox + x * vp.cw;
      const py = vp.oy + y * vp.ch;
      ctx.fillRect(px, py + vp.ch * 0.38, vp.cw, vp.ch * 0.24);
    }
  }
  ctx.restore();
}

export interface StaticRenderOptions {
  cell: number;
  aspect: number;
  showSymbols: boolean;
  showNumbers: boolean;
  /** Bereich des Rasters (Standard: alles) */
  region?: Rect;
  background?: string;
  textColor?: string;
  font?: string;
  highlightEvery: number;
  knitBitmap?: AnyCanvas | null;
  /** Schriftgröße der Nummern (Standard: abhängig von der Kästchengröße) */
  fontPx?: number;
}

/** Rendert (einen Bereich) des Rasters als eigenständiges Bild mit Nummern – für Export und Druck. */
export function renderChartImage(grid: ChartGrid, settings: ChartSettings, opts: StaticRenderOptions): AnyCanvas {
  const region = opts.region ?? { x: 0, y: 0, width: grid.width, height: grid.height };
  const cw = opts.cell;
  const ch = opts.cell * opts.aspect;
  const font = opts.font ?? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const fontPx = opts.fontPx ?? rulerFontSize(cw, ch);
  const rs = opts.showNumbers ? rulerSize(grid, cw, ch, fontPx) : { side: 0, bottom: 0 };
  const gap = opts.showNumbers ? Math.max(4, Math.round(fontPx * 0.3)) : 0;
  const pad = 2;
  const width = Math.ceil(region.width * cw + (rs.side + gap) * 2 + pad * 2);
  const height = Math.ceil(region.height * ch + rs.bottom + gap + pad * 2);
  const canvas = createCanvas(width, height);
  const ctx = ctx2d(canvas);
  ctx.fillStyle = opts.background ?? '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const vp: Viewport = {
    ox: pad + rs.side + gap - region.x * cw,
    oy: pad - region.y * ch,
    cw,
    ch,
    width,
    height,
    dpr: 1,
  };
  const r: CellRange = { x0: region.x, y0: region.y, x1: region.x + region.width, y1: region.y + region.height };
  if (opts.knitBitmap) {
    ctx.imageSmoothingEnabled = true;
    const kb = opts.knitBitmap;
    const sx = kb.width / grid.width;
    const sy = kb.height / grid.height;
    ctx.drawImage(kb as CanvasImageSource, r.x0 * sx, r.y0 * sy, region.width * sx, region.height * sy, vp.ox + r.x0 * cw, vp.oy + r.y0 * ch, region.width * cw, region.height * ch);
  } else {
    drawCells(ctx, buildCellBitmap(grid), r, vp);
    if (opts.showSymbols) drawSymbols(ctx, grid, r, vp, new SymbolSprites());
    // Rasterlinien nur im Bereich, Rahmen um den Bereich
    drawGridLines(ctx, { width: grid.width, height: grid.height }, r, vp, opts.highlightEvery);
    ctx.strokeStyle = DEFAULT_GRID_STYLE.border;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vp.ox + r.x0 * cw, vp.oy + r.y0 * ch, region.width * cw, region.height * ch);
  }
  if (opts.showNumbers) {
    // Nummern relativ zum Bereich zeichnen: Viewport auf den Bereich beschränken
    const sub = { width: grid.width, height: grid.height };
    const clipVp: Viewport = { ...vp };
    ctx.save();
    drawRulersForRegion(ctx, sub, settings, clipVp, region, {
      font,
      text: opts.textColor ?? '#3b332e',
      band: 'transparent',
      accent: '#b23a5e',
      accentText: '#ffffff',
    }, gap, fontPx);
    ctx.restore();
  }
  return canvas;
}

/** Wie drawRulers, aber nur für die Reihen/Maschen eines Bereichs (z. B. eine Druckseite). */
function drawRulersForRegion(
  ctx: Ctx2D,
  grid: { width: number; height: number },
  settings: Pick<ChartSettings, 'workedIn' | 'firstRowRS'>,
  vp: Viewport,
  region: Rect,
  style: RulerStyle,
  gap: number,
  fs: number,
): void {
  const { ox, oy, cw, ch } = vp;
  ctx.font = `${fs}px ${style.font}`;
  const rowStep = labelStep(ch, fs + 3);
  const colStep = labelStep(cw, String(grid.width).length * fs * 0.62 + 6);
  const rightX = ox + (region.x + region.width) * cw + gap;
  const leftX = ox + region.x * cw - gap;
  const bottomY = oy + (region.y + region.height) * ch + gap;
  ctx.fillStyle = style.text;
  ctx.textBaseline = 'middle';
  for (let y = region.y; y < region.y + region.height; y++) {
    const row = grid.height - y;
    if (row % rowStep !== 0 && row !== 1 && y !== region.y + region.height - 1) continue;
    const side = rowSide(row, settings);
    const both = rowStep > 1;
    const cy = oy + y * ch + ch / 2;
    if (side !== 'ws' || both) {
      ctx.textAlign = 'left';
      ctx.fillText(String(row), rightX, cy);
    }
    if (side === 'ws' || both) {
      ctx.textAlign = 'right';
      ctx.fillText(String(row), leftX, cy);
    }
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = region.x; x < region.x + region.width; x++) {
    const n = grid.width - x;
    if (n % colStep !== 0 && n !== 1 && x !== region.x) continue;
    ctx.fillText(String(n), ox + x * cw + cw / 2, bottomY + 1);
  }
}

/** Kleines Vorschaubild (PNG-Data-URL) für die Musterübersicht. */
export function renderThumbnail(grid: ChartGrid, aspect: number, max = 240): string {
  if (typeof document === 'undefined') return '';
  const cell = Math.max(1, Math.min(12, Math.floor(max / Math.max(grid.width, grid.height * aspect))));
  const w = Math.max(1, Math.round(grid.width * cell));
  const h = Math.max(1, Math.round(grid.height * cell * aspect));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const vp: Viewport = { ox: 0, oy: 0, cw: cell, ch: cell * aspect, width: w, height: h, dpr: 1 };
  const r: CellRange = { x0: 0, y0: 0, x1: grid.width, y1: grid.height };
  drawCells(ctx, buildCellBitmap(grid), r, vp);
  if (cell >= 5) drawSymbols(ctx, grid, r, vp, new SymbolSprites());
  if (cell >= 6) {
    ctx.strokeStyle = 'rgba(48,40,36,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < grid.width; x++) {
      ctx.moveTo(Math.round(x * cell) + 0.5, 0);
      ctx.lineTo(Math.round(x * cell) + 0.5, h);
    }
    for (let y = 1; y < grid.height; y++) {
      ctx.moveTo(0, Math.round(y * cell * aspect) + 0.5);
      ctx.lineTo(w, Math.round(y * cell * aspect) + 0.5);
    }
    ctx.stroke();
  }
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}
