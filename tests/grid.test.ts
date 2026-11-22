import { describe, expect, it } from 'vitest';
import {
  clearSymbolAt,
  colorCounts,
  createGrid,
  extractClip,
  fillRect,
  flipClipHorizontal,
  flipHorizontal,
  flipVertical,
  floodFill,
  lineCells,
  longFloats,
  mapClipColors,
  movePaletteColor,
  normRect,
  removePaletteColor,
  removeUnusedColors,
  repeatRegion,
  resizeGrid,
  setSymbol,
  stampClip,
  symbolCounts,
} from '../src/model/grid';
import { symbolByKey } from '../src/model/stitches';
import { colorLetter } from '../src/model/color';

const code = (key: string) => symbolByKey(key)!.code;

describe('grid basics', () => {
  it('creates an empty grid', () => {
    const g = createGrid(4, 3);
    expect(g.colors.length).toBe(12);
    expect(g.symbols.every((s) => s === 0)).toBe(true);
    expect(g.palette.length).toBeGreaterThan(1);
  });

  it('resizes with anchors', () => {
    const g = createGrid(2, 2);
    g.colors.set([1, 2, 3, 0]);
    const right = resizeGrid(g, 4, 2, 1, -1);
    expect(Array.from(right.colors)).toEqual([0, 0, 1, 2, 0, 0, 3, 0]);
    const center = resizeGrid(g, 4, 4, 0, 0);
    expect(center.colors[1 * 4 + 1]).toBe(1);
    expect(center.colors[2 * 4 + 2]).toBe(0);
    expect(center.colors[2 * 4 + 1]).toBe(3);
    const shrink = resizeGrid(g, 1, 1, 1, 1);
    expect(Array.from(shrink.colors)).toEqual([0]);
  });

  it('flips and mirrors symbols', () => {
    const g = createGrid(3, 1);
    setSymbol(g, 0, 0, code('k2tog'));
    g.colors[0] = 2;
    const f = flipHorizontal(g);
    expect(f.symbols[2]).toBe(code('ssk'));
    expect(f.colors[2]).toBe(2);
    const v = flipVertical(createGrid(1, 2));
    expect(v.height).toBe(2);
  });

  it('mirrors multi-cell cables correctly', () => {
    const g = createGrid(5, 1);
    expect(setSymbol(g, 0, 0, code('c22rc'))).toBe(true);
    const f = flipHorizontal(g);
    const lc = code('c22lc');
    expect(Array.from(f.symbols)).toEqual([0, lc, lc + 1, lc + 2, lc + 3]);
  });

  it('places and clears multi-cell symbols as a unit', () => {
    const g = createGrid(6, 1);
    const rc = code('c22rc');
    expect(setSymbol(g, 3, 0, rc)).toBe(false); // passt nicht
    expect(setSymbol(g, 1, 0, rc)).toBe(true);
    expect(Array.from(g.symbols)).toEqual([0, rc, rc + 1, rc + 2, rc + 3, 0]);
    clearSymbolAt(g, 3, 0);
    expect(Array.from(g.symbols)).toEqual([0, 0, 0, 0, 0, 0]);
    setSymbol(g, 0, 0, rc);
    setSymbol(g, 2, 0, code('purl')); // überschreibt Teil → ganzer Zopf weg
    expect(Array.from(g.symbols)).toEqual([0, 0, code('purl'), 0, 0, 0]);
  });

  it('flood fills a 4-connected region', () => {
    const g = createGrid(3, 3);
    g.colors.set([0, 1, 0, 0, 1, 0, 0, 1, 0]);
    const n = floodFill(g, 0, 0, (i) => g.colors[i] === 0, (_x, _y, i) => (g.colors[i] = 2));
    expect(n).toBe(3);
    expect(Array.from(g.colors)).toEqual([2, 1, 0, 2, 1, 0, 2, 1, 0]);
  });

  it('draws lines with Bresenham', () => {
    const pts: string[] = [];
    lineCells(0, 0, 3, 1, (x, y) => pts.push(`${x},${y}`));
    expect(pts[0]).toBe('0,0');
    expect(pts[pts.length - 1]).toBe('3,1');
    expect(pts.length).toBe(4);
  });

  it('copies, flips and pastes clips with palette mapping', () => {
    const a = createGrid(3, 2, [{ hex: '#ffffff', name: '' }, { hex: '#ff0000', name: 'Rot' }]);
    a.colors.set([1, 0, 0, 0, 0, 1]);
    const clip = extractClip(a, normRect(0, 0, 1, 1));
    expect(clip.width).toBe(2);
    const flipped = flipClipHorizontal(clip);
    expect(Array.from(flipped.colors)).toEqual([0, 1, 0, 0]);
    const b = createGrid(2, 2, [{ hex: '#000000', name: '' }, { hex: '#ffffff', name: '' }]);
    const map = mapClipColors(b, clip);
    expect(b.palette.length).toBe(3);
    expect(map[0]).toBe(1);
    expect(map[1]).toBe(2);
    stampClip(b, clip, 0, 0, map);
    expect(Array.from(b.colors)).toEqual([2, 1, 1, 1]);
  });

  it('repeats a motif across the chart', () => {
    const g = createGrid(6, 1);
    g.colors.set([0, 0, 1, 2, 0, 0]);
    const r = repeatRegion(g, { x: 2, y: 0, width: 2, height: 1 }, true, false);
    expect(Array.from(r.colors)).toEqual([1, 2, 1, 2, 1, 2]);
  });

  it('counts colors and symbols', () => {
    const g = createGrid(4, 1);
    g.colors.set([0, 1, 1, 1]);
    setSymbol(g, 0, 0, code('nostitch'));
    setSymbol(g, 1, 0, code('c11rc'));
    expect(colorCounts(g).slice(0, 2)).toEqual([0, 3]);
    expect(symbolCounts(g).get(code('c11rc'))).toBe(1);
  });

  it('removes and moves palette colors', () => {
    const g = createGrid(3, 1);
    g.colors.set([0, 1, 2]);
    const r = removePaletteColor(g, 1, 2);
    expect(r.palette.length).toBe(g.palette.length - 1);
    expect(Array.from(r.colors)).toEqual([0, 1, 1]);
    const m = movePaletteColor(g, 2, 0);
    expect(Array.from(m.colors)).toEqual([1, 2, 0]);
    expect(m.palette[0].hex).toBe(g.palette[2].hex);
    const u = removeUnusedColors(g);
    expect(u.palette.length).toBe(3);
  });

  it('fills a rectangle', () => {
    const g = createGrid(3, 3);
    fillRect(g, { x: 1, y: 1, width: 2, height: 2 }, 3, null);
    expect(Array.from(g.colors)).toEqual([0, 0, 0, 0, 3, 3, 0, 3, 3]);
  });

  it('detects long floats', () => {
    const g = createGrid(10, 1);
    g.colors.set([1, 0, 0, 0, 0, 0, 0, 0, 1, 1]);
    const mask = longFloats(g, 5);
    expect(Array.from(mask)).toEqual([0, 1, 1, 1, 1, 1, 1, 1, 0, 0]);
    expect(Array.from(longFloats(g, 7))).toEqual(new Array(10).fill(0));
  });

  it('labels colors with letters', () => {
    expect(colorLetter(0)).toBe('A');
    expect(colorLetter(25)).toBe('Z');
    expect(colorLetter(26)).toBe('AA');
  });
});
