import type { ChartGrid, Clip, PaletteEntry, Rect } from './types';
import { MAX_PALETTE } from './types';
import { hexToOklab, labDistSq, normalizeHex } from './color';
import { isKnownCode, mirrorCode, symbolPart } from './stitches';

export const DEFAULT_PALETTE: PaletteEntry[] = [
  { hex: '#f4ede1', name: '' },
  { hex: '#2d2a32', name: '' },
  { hex: '#b23a5e', name: '' },
  { hex: '#1f6f78', name: '' },
];

export function createGrid(width: number, height: number, palette: PaletteEntry[] = DEFAULT_PALETTE): ChartGrid {
  return {
    width,
    height,
    colors: new Uint8Array(width * height),
    symbols: new Uint8Array(width * height),
    palette: palette.map((p) => ({ ...p })),
  };
}

export function cloneGrid(g: ChartGrid): ChartGrid {
  return {
    width: g.width,
    height: g.height,
    colors: g.colors.slice(),
    symbols: g.symbols.slice(),
    palette: g.palette.map((p) => ({ ...p })),
  };
}

export function inBounds(g: { width: number; height: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < g.width && y < g.height;
}

/** Reihennummer (1 = unterste Reihe) für eine Rasterzeile y. */
export function rowNumber(g: { height: number }, y: number): number {
  return g.height - y;
}

/** Rasterzeile y für eine Reihennummer. */
export function rowToY(g: { height: number }, row: number): number {
  return g.height - row;
}

/** Maschennummer (1 = rechte Spalte) für eine Rasterspalte x. */
export function stitchNumber(g: { width: number }, x: number): number {
  return g.width - x;
}

/**
 * Größe ändern. anchorX/anchorY: -1 = links/oben bleibt erhalten, 0 = mittig, 1 = rechts/unten.
 */
export function resizeGrid(g: ChartGrid, width: number, height: number, anchorX: -1 | 0 | 1, anchorY: -1 | 0 | 1): ChartGrid {
  const out = createGrid(width, height, g.palette);
  const dx = anchorX === -1 ? 0 : anchorX === 1 ? width - g.width : Math.floor((width - g.width) / 2);
  const dy = anchorY === -1 ? 0 : anchorY === 1 ? height - g.height : Math.floor((height - g.height) / 2);
  for (let y = 0; y < g.height; y++) {
    const ny = y + dy;
    if (ny < 0 || ny >= height) continue;
    for (let x = 0; x < g.width; x++) {
      const nx = x + dx;
      if (nx < 0 || nx >= width) continue;
      out.colors[ny * width + nx] = g.colors[y * g.width + x];
      out.symbols[ny * width + nx] = g.symbols[y * g.width + x];
    }
  }
  repairSymbols(out);
  return out;
}

export function flipHorizontal(g: ChartGrid): ChartGrid {
  const out = cloneGrid(g);
  const w = g.width;
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < w; x++) {
      const src = y * w + x;
      const dst = y * w + (w - 1 - x);
      out.colors[dst] = g.colors[src];
      out.symbols[dst] = mirrorCode(g.symbols[src]);
    }
  }
  return out;
}

export function flipVertical(g: ChartGrid): ChartGrid {
  const out = cloneGrid(g);
  const w = g.width;
  for (let y = 0; y < g.height; y++) {
    const ny = g.height - 1 - y;
    out.colors.set(g.colors.subarray(y * w, y * w + w), ny * w);
    out.symbols.set(g.symbols.subarray(y * w, y * w + w), ny * w);
  }
  return out;
}

/** Entfernt alle Teile eines (ggf. mehrteiligen) Symbols an Position (x, y). */
export function clearSymbolAt(g: ChartGrid, x: number, y: number): void {
  const i = y * g.width + x;
  const code = g.symbols[i];
  if (code === 0) return;
  const { symbol, part } = symbolPart(code);
  if (symbol.width === 1) {
    g.symbols[i] = 0;
    return;
  }
  const start = x - part;
  for (let k = 0; k < symbol.width; k++) {
    const xx = start + k;
    if (xx < 0 || xx >= g.width) continue;
    const j = y * g.width + xx;
    if (g.symbols[j] === symbol.code + k) g.symbols[j] = 0;
  }
}

/**
 * Setzt ein Symbol an (x, y). Mehrteilige Symbole beginnen an x und reichen nach rechts.
 * Gibt false zurück, wenn das Symbol nicht passt.
 */
export function setSymbol(g: ChartGrid, x: number, y: number, code: number): boolean {
  if (!inBounds(g, x, y)) return false;
  const { symbol } = symbolPart(code);
  const base = symbol.code;
  if (symbol.width === 1) {
    clearSymbolAt(g, x, y);
    g.symbols[y * g.width + x] = base;
    return true;
  }
  if (x + symbol.width > g.width) return false;
  for (let k = 0; k < symbol.width; k++) clearSymbolAt(g, x + k, y);
  for (let k = 0; k < symbol.width; k++) g.symbols[y * g.width + x + k] = base + k;
  return true;
}

export function setColor(g: ChartGrid, x: number, y: number, color: number): void {
  if (!inBounds(g, x, y)) return;
  g.colors[y * g.width + x] = color;
}

/** Setzt unbekannte Symbolcodes zurück. Unvollständige mehrteilige Symbole bleiben sichtbar erhalten. */
export function repairSymbols(g: ChartGrid): void {
  for (let i = 0; i < g.symbols.length; i++) {
    if (!isKnownCode(g.symbols[i])) g.symbols[i] = 0;
  }
  const max = g.palette.length - 1;
  for (let i = 0; i < g.colors.length; i++) {
    if (g.colors[i] > max) g.colors[i] = 0;
  }
}

/** Flächenfüllung (4er-Nachbarschaft). match entscheidet, welche Zellen zur Fläche gehören. */
export function floodFill(
  g: ChartGrid,
  sx: number,
  sy: number,
  match: (index: number) => boolean,
  apply: (x: number, y: number, index: number) => void,
): number {
  if (!inBounds(g, sx, sy)) return 0;
  const w = g.width;
  const h = g.height;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [sy * w + sx];
  let count = 0;
  if (!match(stack[0])) return 0;
  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i]) continue;
    seen[i] = 1;
    if (!match(i)) continue;
    const x = i % w;
    const y = (i - x) / w;
    apply(x, y, i);
    count++;
    if (x > 0 && !seen[i - 1]) stack.push(i - 1);
    if (x < w - 1 && !seen[i + 1]) stack.push(i + 1);
    if (y > 0 && !seen[i - w]) stack.push(i - w);
    if (y < h - 1 && !seen[i + w]) stack.push(i + w);
  }
  return count;
}

/** Bresenham-Linie zwischen zwei Zellen. */
export function lineCells(x0: number, y0: number, x1: number, y1: number, cb: (x: number, y: number) => void): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    cb(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

export function normRect(x0: number, y0: number, x1: number, y1: number): Rect {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return { x, y, width: Math.abs(x1 - x0) + 1, height: Math.abs(y1 - y0) + 1 };
}

export function clipRect(r: Rect, g: { width: number; height: number }): Rect | null {
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  const x1 = Math.min(g.width, r.x + r.width);
  const y1 = Math.min(g.height, r.y + r.height);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function rectCells(r: Rect, filled: boolean, cb: (x: number, y: number) => void): void {
  const x1 = r.x + r.width - 1;
  const y1 = r.y + r.height - 1;
  for (let y = r.y; y <= y1; y++) {
    for (let x = r.x; x <= x1; x++) {
      if (filled || y === r.y || y === y1 || x === r.x || x === x1) cb(x, y);
    }
  }
}

export function extractClip(g: ChartGrid, r: Rect): Clip {
  const colors = new Uint8Array(r.width * r.height);
  const symbols = new Uint8Array(r.width * r.height);
  for (let y = 0; y < r.height; y++) {
    for (let x = 0; x < r.width; x++) {
      const sx = r.x + x;
      const sy = r.y + y;
      if (!inBounds(g, sx, sy)) continue;
      colors[y * r.width + x] = g.colors[sy * g.width + sx];
      symbols[y * r.width + x] = g.symbols[sy * g.width + sx];
    }
  }
  return { width: r.width, height: r.height, colors, symbols, palette: g.palette.map((p) => ({ ...p })) };
}

export function flipClipHorizontal(c: Clip): Clip {
  const out: Clip = { ...c, colors: new Uint8Array(c.colors.length), symbols: new Uint8Array(c.symbols.length) };
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const s = y * c.width + x;
      const d = y * c.width + (c.width - 1 - x);
      out.colors[d] = c.colors[s];
      out.symbols[d] = mirrorCode(c.symbols[s]);
    }
  }
  return out;
}

export function flipClipVertical(c: Clip): Clip {
  const out: Clip = { ...c, colors: new Uint8Array(c.colors.length), symbols: new Uint8Array(c.symbols.length) };
  for (let y = 0; y < c.height; y++) {
    const d = (c.height - 1 - y) * c.width;
    out.colors.set(c.colors.subarray(y * c.width, y * c.width + c.width), d);
    out.symbols.set(c.symbols.subarray(y * c.width, y * c.width + c.width), d);
  }
  return out;
}

/**
 * Ordnet die Farben eines Ausschnitts der Palette des Zielrasters zu.
 * Gleiche Farben werden wiederverwendet, fehlende ergänzt (solange Platz ist), sonst die ähnlichste genommen.
 * Verändert g.palette.
 */
export function mapClipColors(g: ChartGrid, clip: Clip): Uint8Array {
  const map = new Uint8Array(Math.max(1, clip.palette.length));
  clip.palette.forEach((entry, i) => {
    const hex = normalizeHex(entry.hex);
    let idx = g.palette.findIndex((p) => normalizeHex(p.hex) === hex);
    if (idx < 0) {
      if (g.palette.length < MAX_PALETTE) {
        g.palette.push({ hex, name: entry.name });
        idx = g.palette.length - 1;
      } else {
        idx = nearestPaletteIndex(g.palette, hex);
      }
    }
    map[i] = idx;
  });
  return map;
}

export function nearestPaletteIndex(palette: PaletteEntry[], hex: string): number {
  const lab = hexToOklab(hex);
  let best = 0;
  let bestD = Infinity;
  palette.forEach((p, i) => {
    const d = labDistSq(lab, hexToOklab(p.hex));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Setzt einen Ausschnitt an Position (x, y) ein. colorMap ordnet Ausschnitt- auf Rasterfarben zu. */
export function stampClip(g: ChartGrid, clip: Clip, x: number, y: number, colorMap?: Uint8Array): void {
  for (let cy = 0; cy < clip.height; cy++) {
    const gy = y + cy;
    if (gy < 0 || gy >= g.height) continue;
    for (let cx = 0; cx < clip.width; cx++) {
      const gx = x + cx;
      if (gx < 0 || gx >= g.width) continue;
      const s = cy * clip.width + cx;
      const c = clip.colors[s];
      g.colors[gy * g.width + gx] = colorMap ? colorMap[c] ?? 0 : c;
      g.symbols[gy * g.width + gx] = clip.symbols[s];
    }
  }
}

export function fillRect(g: ChartGrid, r: Rect, color: number | null, symbol: number | null): void {
  rectCells(r, true, (x, y) => {
    if (!inBounds(g, x, y)) return;
    const i = y * g.width + x;
    if (color !== null) g.colors[i] = color;
    if (symbol !== null) {
      clearSymbolAt(g, x, y);
      g.symbols[i] = symbol;
    }
  });
}

/** Wiederholt einen Bereich über die gesamte Breite und/oder Höhe (Rapport). */
export function repeatRegion(g: ChartGrid, r: Rect, horizontal: boolean, vertical: boolean): ChartGrid {
  const out = cloneGrid(g);
  const clip = extractClip(g, r);
  const startX = horizontal ? r.x - Math.ceil(r.x / r.width) * r.width : r.x;
  const startY = vertical ? r.y - Math.ceil(r.y / r.height) * r.height : r.y;
  const endX = horizontal ? g.width : r.x + 1;
  const endY = vertical ? g.height : r.y + 1;
  for (let y = startY; y < endY; y += r.height) {
    for (let x = startX; x < endX; x += r.width) {
      stampClip(out, clip, x, y);
    }
  }
  repairSymbols(out);
  return out;
}

/** Anzahl Maschen je Farbe (Kästchen ohne Masche werden nicht gezählt). */
export function colorCounts(g: ChartGrid): number[] {
  const counts = new Array(g.palette.length).fill(0);
  for (let i = 0; i < g.colors.length; i++) {
    const s = g.symbols[i];
    if (s !== 0 && symbolPart(s).symbol.noStitch) continue;
    counts[g.colors[i]]++;
  }
  return counts;
}

/** Verwendete Symbole (Basis-Codes) mit Anzahl. */
export function symbolCounts(g: ChartGrid): Map<number, number> {
  const m = new Map<number, number>();
  for (let i = 0; i < g.symbols.length; i++) {
    const code = g.symbols[i];
    if (code === 0) continue;
    const { symbol, part } = symbolPart(code);
    if (part !== 0) continue;
    m.set(symbol.code, (m.get(symbol.code) ?? 0) + 1);
  }
  return m;
}

/** Entfernt eine Palettenfarbe; betroffene Maschen erhalten die Ersatzfarbe. */
export function removePaletteColor(g: ChartGrid, index: number, replacement: number): ChartGrid {
  if (g.palette.length <= 1) return g;
  const out = cloneGrid(g);
  const rep = replacement > index ? replacement - 1 : replacement;
  out.palette.splice(index, 1);
  for (let i = 0; i < out.colors.length; i++) {
    const c = out.colors[i];
    if (c === index) out.colors[i] = rep;
    else if (c > index) out.colors[i] = c - 1;
  }
  return out;
}

/** Verschiebt eine Palettenfarbe an eine neue Position (ändert die Buchstaben A, B, C …). */
export function movePaletteColor(g: ChartGrid, from: number, to: number): ChartGrid {
  if (from === to) return g;
  const out = cloneGrid(g);
  const order = g.palette.map((_, i) => i);
  order.splice(to, 0, order.splice(from, 1)[0]);
  const remap = new Uint8Array(g.palette.length);
  order.forEach((oldIdx, newIdx) => (remap[oldIdx] = newIdx));
  out.palette = order.map((i) => ({ ...g.palette[i] }));
  for (let i = 0; i < out.colors.length; i++) out.colors[i] = remap[out.colors[i]];
  return out;
}

/** Entfernt Farben, die nicht verwendet werden (mindestens eine bleibt). */
export function removeUnusedColors(g: ChartGrid): ChartGrid {
  const used = new Uint8Array(g.palette.length);
  for (let i = 0; i < g.colors.length; i++) used[g.colors[i]] = 1;
  if (used.every((u) => u === 1)) return g;
  const remap = new Uint8Array(g.palette.length);
  const palette: PaletteEntry[] = [];
  g.palette.forEach((p, i) => {
    if (used[i] || (palette.length === 0 && i === g.palette.length - 1)) {
      remap[i] = palette.length;
      palette.push({ ...p });
    }
  });
  if (palette.length === 0) palette.push({ ...g.palette[0] });
  const out = cloneGrid(g);
  out.palette = palette;
  for (let i = 0; i < out.colors.length; i++) out.colors[i] = remap[out.colors[i]];
  return out;
}

/**
 * Findet zu lange Spannfäden (Fair-Isle): Für jede in einer Reihe verwendete Farbe werden die
 * Abstände zwischen zwei Einsätzen geprüft. Liefert eine Maske der betroffenen Maschen.
 */
export function longFloats(g: ChartGrid, maxFloat: number): Uint8Array {
  const mask = new Uint8Array(g.width * g.height);
  const w = g.width;
  const last = new Int32Array(g.palette.length);
  for (let y = 0; y < g.height; y++) {
    last.fill(-1);
    const usedInRow = new Set<number>();
    for (let x = 0; x < w; x++) usedInRow.add(g.colors[y * w + x]);
    if (usedInRow.size < 2) continue;
    for (let x = 0; x < w; x++) {
      const c = g.colors[y * w + x];
      const prev = last[c];
      if (prev >= 0 && x - prev - 1 > maxFloat) {
        for (let k = prev + 1; k < x; k++) mask[y * w + k] = 1;
      }
      last[c] = x;
    }
  }
  return mask;
}
