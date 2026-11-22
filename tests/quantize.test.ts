import { describe, expect, it } from 'vitest';
import { assignDithered, autoHeight, averageCells, convertFromLab, despeckle, kmeansColors, supersample } from '../src/image/quantize';
import { hexToRgb } from '../src/model/color';

function solidImage(w: number, h: number, fn: (x: number, y: number) => [number, number, number, number?]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = fn(x, y);
      data.set([r, g, b, a], (y * w + x) * 4);
    }
  return data;
}

const params = { colors: 2, dither: false, smoothing: 0, brightness: 0, contrast: 0, saturation: 0 };

describe('image conversion', () => {
  it('averages cells and composites transparency on white', () => {
    const img = solidImage(4, 4, () => [0, 0, 0, 0]);
    const lab = averageCells(img, 4, 4, 2, 2);
    expect(lab[0]).toBeGreaterThan(0.99); // weiß
  });

  it('splits a two-colour image into two clusters', () => {
    const img = solidImage(20, 10, (x) => (x < 10 ? [220, 30, 40] : [20, 40, 200]));
    const lab = averageCells(img, 20, 10, 10, 5);
    const res = convertFromLab(lab, { ...params, gridW: 10, gridH: 5 });
    expect(res.palette.length).toBe(2);
    expect(res.indices[0]).not.toBe(res.indices[9]);
    const red = hexToRgb(res.palette[res.indices[0]]);
    expect(red[0]).toBeGreaterThan(180);
    expect(res.counts.reduce((a, b) => a + b, 0)).toBe(50);
  });

  it('is deterministic', () => {
    const img = solidImage(30, 30, (x, y) => [(x * 8) % 256, (y * 8) % 256, ((x + y) * 4) % 256]);
    const lab = averageCells(img, 30, 30, 15, 15);
    const a = kmeansColors(lab, 5);
    const b = kmeansColors(lab, 5);
    expect(a).toEqual(b);
    expect(a.length).toBe(5);
  });

  it('never returns more colours than distinct inputs', () => {
    const img = solidImage(8, 8, () => [100, 100, 100]);
    const lab = averageCells(img, 8, 8, 4, 4);
    const res = convertFromLab(lab, { ...params, colors: 6, gridW: 4, gridH: 4 });
    expect(res.palette.length).toBe(1);
  });

  it('removes isolated stitches', () => {
    const w = 5, h = 5;
    const idx = new Uint8Array(w * h);
    idx[12] = 1;
    const out = despeckle(idx, w, h, 1);
    expect(out[12]).toBe(0);
    const line = new Uint8Array(w * h);
    for (let x = 0; x < w; x++) line[2 * w + x] = 1;
    expect(Array.from(despeckle(line, w, h, 1))).toEqual(Array.from(line));
  });

  it('dithers a mid grey into a mix of black and white', () => {
    const img = solidImage(16, 16, () => [128, 128, 128]);
    const lab = averageCells(img, 16, 16, 16, 16);
    const out = assignDithered(lab, 16, 16, [[0, 0, 0], [1, 0, 0]], 1);
    const ones = out.reduce((a, b) => a + b, 0);
    expect(ones).toBeGreaterThan(40);
    expect(ones).toBeLessThan(216);
  });

  it('computes heights and supersampling', () => {
    expect(autoHeight(22, 100, 100, 22, 30)).toBe(30);
    expect(autoHeight(50, 200, 100, 20, 20)).toBe(25);
    expect(supersample(100, 100, 2000)).toBe(8);
    expect(supersample(100, 100, 150)).toBe(2);
    expect(supersample(400, 400, 4000)).toBe(5);
  });
});

describe('pixel-level conversion (majority vote)', () => {
  it('keeps crisp edges without blended colours', async () => {
    const { prepareSource, convertPrepared } = await import('../src/image/quantize');
    // 2 Maschen breit, Kante mitten durch die zweite Masche mit Kantenglättung
    const w = 16, h = 8;
    const img = solidImage(w, h, (x) => (x < 10 ? [200, 20, 30] : x === 10 ? [120, 110, 140] : [20, 30, 210]));
    const src = prepareSource(img, w, h, 2, 1);
    const res = convertPrepared(src, { ...params, colors: 2, gridW: 2, gridH: 1 });
    expect(res.palette.length).toBe(2);
    expect(res.indices[0]).not.toBe(res.indices[1]);
    // Mehrheit der zweiten Masche ist blau
    const blue = hexToRgb(res.palette[res.indices[1]]);
    expect(blue[2]).toBeGreaterThan(150);
  });

  it('supports dithering and adjustments on prepared sources', async () => {
    const { prepareSource, convertPrepared } = await import('../src/image/quantize');
    const img = solidImage(20, 20, (x, y) => [x * 12, y * 12, 128]);
    const src = prepareSource(img, 20, 20, 10, 10);
    const a = convertPrepared(src, { ...params, colors: 3, gridW: 10, gridH: 10, dither: true });
    expect(a.indices.length).toBe(100);
    const b = convertPrepared(src, { ...params, colors: 3, gridW: 10, gridH: 10, brightness: 0.5, contrast: 0.3, saturation: -1 });
    // Sättigung -1 → Graustufen
    for (const hex of b.palette) {
      const [r, g, bl] = hexToRgb(hex);
      expect(Math.max(r, g, bl) - Math.min(r, g, bl)).toBeLessThan(6);
    }
  });
});
