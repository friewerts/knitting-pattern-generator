/**
 * Bild → Maschenraster: Mittelung je Masche, Bildanpassungen, Farbreduktion (k-means++ im OKLab-Farbraum),
 * optionales Dithering und Glättung. Reine Funktionen ohne DOM – laufen im Web Worker und in Tests.
 */
import { linearRgbToOklab, oklabToHex, srgbToLinear8, type Lab } from '../model/color';

export interface ConvertParams {
  gridW: number;
  gridH: number;
  /** gewünschte Anzahl Farben */
  colors: number;
  dither: boolean;
  /** 0 = aus … 3 = stark */
  smoothing: number;
  /** -1 … 1 */
  brightness: number;
  /** -1 … 1 */
  contrast: number;
  /** -1 … 1 */
  saturation: number;
}

export interface ConvertResult {
  gridW: number;
  gridH: number;
  indices: Uint8Array;
  /** Farben, nach Häufigkeit sortiert */
  palette: string[];
  /** OKLab-Werte der Palette (vor manuellen Anpassungen) */
  centroids: Lab[];
  counts: number[];
}

/** Mittelt die Pixel je Masche (linear, auf Weiß komponiert) und liefert OKLab-Werte (3 Floats je Masche). */
export function averageCells(
  rgba: Uint8ClampedArray | Uint8Array,
  srcW: number,
  srcH: number,
  gridW: number,
  gridH: number,
): Float32Array {
  const out = new Float32Array(gridW * gridH * 3);
  for (let cy = 0; cy < gridH; cy++) {
    const y0 = Math.floor((cy * srcH) / gridH);
    const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * srcH) / gridH));
    for (let cx = 0; cx < gridW; cx++) {
      const x0 = Math.floor((cx * srcW) / gridW);
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * srcW) / gridW));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = y0; y < y1 && y < srcH; y++) {
        let p = (y * srcW + x0) * 4;
        for (let x = x0; x < x1 && x < srcW; x++, p += 4) {
          const a = rgba[p + 3] / 255;
          r += srgbToLinear8(rgba[p]) * a + (1 - a);
          g += srgbToLinear8(rgba[p + 1]) * a + (1 - a);
          b += srgbToLinear8(rgba[p + 2]) * a + (1 - a);
          n++;
        }
      }
      if (n === 0) n = 1;
      const lab = linearRgbToOklab(r / n, g / n, b / n);
      const o = (cy * gridW + cx) * 3;
      out[o] = lab[0];
      out[o + 1] = lab[1];
      out[o + 2] = lab[2];
    }
  }
  return out;
}

/** Helligkeit, Kontrast und Sättigung im OKLab-Raum anpassen (gibt eine Kopie zurück). */
export function adjustLab(lab: Float32Array, brightness: number, contrast: number, saturation: number): Float32Array {
  const out = new Float32Array(lab.length);
  const n = lab.length / 3;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += lab[i * 3];
  mean = n ? mean / n : 0.5;
  const cf = 1 + contrast;
  const sf = Math.max(0, 1 + saturation);
  const bOff = brightness * 0.25;
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    let L = (lab[o] - mean) * cf + mean + bOff;
    L = L < 0 ? 0 : L > 1 ? 1 : L;
    out[o] = L;
    out[o + 1] = lab[o + 1] * sf;
    out[o + 2] = lab[o + 2] * sf;
  }
  return out;
}

/** Dämpfung großer Flächen bei der Farbreduktion (1 = lineare Gewichtung nach Pixelanzahl). */
export const WEIGHT_POWER = 0.6;

/** Deterministischer Zufallsgenerator (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Bins {
  points: Float64Array; // L, a, b je Bin (Mittelwert)
  weights: Float64Array;
  count: number;
}

/** Fasst ähnliche Farben in Bins zusammen, damit k-means schnell bleibt. */
function binColors(lab: Float32Array): Bins {
  const RES = 32;
  const map = new Map<number, number>();
  const sums: number[] = [];
  const n = lab.length / 3;
  for (let i = 0; i < n; i++) {
    const L = lab[i * 3];
    const a = lab[i * 3 + 1];
    const b = lab[i * 3 + 2];
    const li = Math.min(RES - 1, Math.max(0, Math.floor(L * RES)));
    const ai = Math.min(RES - 1, Math.max(0, Math.floor((a + 0.4) * (RES / 0.8))));
    const bi = Math.min(RES - 1, Math.max(0, Math.floor((b + 0.4) * (RES / 0.8))));
    const key = (li * RES + ai) * RES + bi;
    let idx = map.get(key);
    if (idx === undefined) {
      idx = sums.length / 4;
      map.set(key, idx);
      sums.push(0, 0, 0, 0);
    }
    sums[idx * 4] += L;
    sums[idx * 4 + 1] += a;
    sums[idx * 4 + 2] += b;
    sums[idx * 4 + 3] += 1;
  }
  const count = sums.length / 4;
  const points = new Float64Array(count * 3);
  const weights = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const w = sums[i * 4 + 3];
    points[i * 3] = sums[i * 4] / w;
    points[i * 3 + 1] = sums[i * 4 + 1] / w;
    points[i * 3 + 2] = sums[i * 4 + 2] / w;
    weights[i] = w;
  }
  return { points, weights, count };
}

function dist2(p: Float64Array | Float32Array, i: number, c: Float64Array, j: number): number {
  const dL = p[i * 3] - c[j * 3];
  const da = p[i * 3 + 1] - c[j * 3 + 1];
  const db = p[i * 3 + 2] - c[j * 3 + 2];
  return dL * dL + da * da + db * db;
}

function kmeansOnce(bins: Bins, k: number, rand: () => number, maxIter: number): { centers: Float64Array; inertia: number } {
  const { points, weights, count } = bins;
  const centers = new Float64Array(k * 3);
  // k-means++: erstes Zentrum = häufigster Bin
  let first = 0;
  for (let i = 1; i < count; i++) if (weights[i] > weights[first]) first = i;
  centers.set(points.subarray(first * 3, first * 3 + 3), 0);
  const d = new Float64Array(count);
  for (let i = 0; i < count; i++) d[i] = dist2(points, i, centers, 0);
  for (let c = 1; c < k; c++) {
    let total = 0;
    for (let i = 0; i < count; i++) total += d[i] * weights[i];
    let chosen = 0;
    if (total <= 0) {
      chosen = Math.floor(rand() * count);
    } else {
      let r = rand() * total;
      for (let i = 0; i < count; i++) {
        r -= d[i] * weights[i];
        if (r <= 0) {
          chosen = i;
          break;
        }
        chosen = i;
      }
    }
    centers.set(points.subarray(chosen * 3, chosen * 3 + 3), c * 3);
    for (let i = 0; i < count; i++) {
      const nd = dist2(points, i, centers, c);
      if (nd < d[i]) d[i] = nd;
    }
  }

  const assign = new Int32Array(count);
  const sums = new Float64Array(k * 4);
  let inertia = 0;
  for (let iter = 0; iter < maxIter; iter++) {
    inertia = 0;
    sums.fill(0);
    for (let i = 0; i < count; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const dd = dist2(points, i, centers, c);
        if (dd < bestD) {
          bestD = dd;
          best = c;
        }
      }
      assign[i] = best;
      const w = weights[i];
      inertia += bestD * w;
      sums[best * 4] += points[i * 3] * w;
      sums[best * 4 + 1] += points[i * 3 + 1] * w;
      sums[best * 4 + 2] += points[i * 3 + 2] * w;
      sums[best * 4 + 3] += w;
    }
    let moved = 0;
    for (let c = 0; c < k; c++) {
      const w = sums[c * 4 + 3];
      if (w === 0) {
        // leeres Cluster: auf den am schlechtesten erklärten Punkt setzen
        let worst = 0;
        let worstD = -1;
        for (let i = 0; i < count; i++) {
          const dd = dist2(points, i, centers, assign[i]) * weights[i];
          if (dd > worstD) {
            worstD = dd;
            worst = i;
          }
        }
        centers.set(points.subarray(worst * 3, worst * 3 + 3), c * 3);
        moved += 1;
        continue;
      }
      const L = sums[c * 4] / w;
      const a = sums[c * 4 + 1] / w;
      const b = sums[c * 4 + 2] / w;
      moved += Math.abs(L - centers[c * 3]) + Math.abs(a - centers[c * 3 + 1]) + Math.abs(b - centers[c * 3 + 2]);
      centers[c * 3] = L;
      centers[c * 3 + 1] = a;
      centers[c * 3 + 2] = b;
    }
    if (moved < 1e-5) break;
  }
  return { centers, inertia };
}

/** k-means++ auf gewichteten Farb-Bins (mehrere Starts, das beste Ergebnis gewinnt). */
function kmeansBins(bins: Bins, k: number, seed: number): Lab[] {
  const kk = Math.max(1, Math.min(k, bins.count));
  let best: { centers: Float64Array; inertia: number } | null = null;
  const restarts = bins.count > kk ? 3 : 1;
  for (let r = 0; r < restarts; r++) {
    const res = kmeansOnce(bins, kk, mulberry32(seed + r * 7919), 40);
    if (!best || res.inertia < best.inertia) best = res;
  }
  const out: Lab[] = [];
  for (let c = 0; c < kk; c++) out.push([best!.centers[c * 3], best!.centers[c * 3 + 1], best!.centers[c * 3 + 2]]);
  return dedupeCenters(out);
}

/**
 * Farbreduktion: liefert k Zentren im OKLab-Raum.
 * weightPower < 1 dämpft den Einfluss großer Flächen, damit kleine, markante Details
 * (z. B. Augen) eher eine eigene Farbe bekommen.
 */
export function kmeansColors(lab: Float32Array, k: number, seed = 1234, weightPower = WEIGHT_POWER): Lab[] {
  const bins = binColors(lab);
  if (weightPower !== 1) for (let i = 0; i < bins.count; i++) bins.weights[i] = Math.pow(bins.weights[i], weightPower);
  return kmeansBins(bins, k, seed);
}

function dedupeCenters(centers: Lab[]): Lab[] {
  const out: Lab[] = [];
  for (const c of centers) {
    if (!out.some((o) => Math.abs(o[0] - c[0]) + Math.abs(o[1] - c[1]) + Math.abs(o[2] - c[2]) < 1e-6)) out.push(c);
  }
  return out;
}

function nearest(L: number, a: number, b: number, centers: Lab[]): number {
  let best = 0;
  let bestD = Infinity;
  for (let c = 0; c < centers.length; c++) {
    const cc = centers[c];
    const dL = L - cc[0];
    const da = a - cc[1];
    const db = b - cc[2];
    const d = dL * dL + da * da + db * db;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function assignNearest(lab: Float32Array, centers: Lab[]): Uint8Array {
  const n = lab.length / 3;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = nearest(lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2], centers);
  return out;
}

/** Floyd–Steinberg-Dithering (serpentinenförmig) im OKLab-Raum. */
export function assignDithered(lab: Float32Array, w: number, h: number, centers: Lab[], strength = 0.85): Uint8Array {
  const buf = Float32Array.from(lab);
  const out = new Uint8Array(w * h);
  const push = (x: number, y: number, eL: number, ea: number, eb: number, f: number) => {
    if (x < 0 || x >= w || y >= h) return;
    const o = (y * w + x) * 3;
    buf[o] += eL * f;
    buf[o + 1] += ea * f;
    buf[o + 2] += eb * f;
  };
  for (let y = 0; y < h; y++) {
    const ltr = y % 2 === 0;
    for (let i = 0; i < w; i++) {
      const x = ltr ? i : w - 1 - i;
      const o = (y * w + x) * 3;
      const L = buf[o];
      const a = buf[o + 1];
      const b = buf[o + 2];
      const c = nearest(L, a, b, centers);
      out[y * w + x] = c;
      const eL = (L - centers[c][0]) * strength;
      const ea = (a - centers[c][1]) * strength;
      const eb = (b - centers[c][2]) * strength;
      const dir = ltr ? 1 : -1;
      push(x + dir, y, eL, ea, eb, 7 / 16);
      push(x - dir, y + 1, eL, ea, eb, 3 / 16);
      push(x, y + 1, eL, ea, eb, 5 / 16);
      push(x + dir, y + 1, eL, ea, eb, 1 / 16);
    }
  }
  return out;
}

/**
 * Entfernt vereinzelte Maschen: Eine Masche, die weniger als `minSame` gleichfarbige
 * Nachbarn (8er-Nachbarschaft) hat, übernimmt die häufigste Nachbarfarbe.
 */
export function despeckle(indices: Uint8Array, w: number, h: number, level: number): Uint8Array {
  if (level <= 0) return indices;
  let cur = indices;
  const minSame = level; // 1: isolierte; 2: max. 1 Nachbar; 3: max. 2 Nachbarn
  const passes = level;
  const counts = new Int32Array(256);
  for (let pass = 0; pass < passes; pass++) {
    const next = cur.slice();
    let changed = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = cur[y * w + x];
        let same = 0;
        let neighbors = 0;
        const touched: number[] = [];
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const nc = cur[yy * w + xx];
            neighbors++;
            if (nc === c) same++;
            if (counts[nc] === 0) touched.push(nc);
            counts[nc]++;
          }
        }
        if (neighbors > 0 && same < Math.min(minSame, neighbors)) {
          let best = c;
          let bestN = 0;
          for (const t of touched) {
            if (counts[t] > bestN) {
              bestN = counts[t];
              best = t;
            }
          }
          if (best !== c) {
            next[y * w + x] = best;
            changed++;
          }
        }
        for (const t of touched) counts[t] = 0;
      }
    }
    cur = next;
    if (changed === 0) break;
  }
  return cur;
}

/** Sortiert die Palette nach Häufigkeit und entfernt ungenutzte Farben. */
export function sortByFrequency(indices: Uint8Array, centers: Lab[]): { indices: Uint8Array; centers: Lab[]; counts: number[] } {
  const counts = new Array(centers.length).fill(0);
  for (let i = 0; i < indices.length; i++) counts[indices[i]]++;
  const order = centers
    .map((_, i) => i)
    .filter((i) => counts[i] > 0)
    .sort((a, b) => counts[b] - counts[a] || centers[b][0] - centers[a][0]);
  const remap = new Uint8Array(centers.length);
  order.forEach((old, nu) => (remap[old] = nu));
  const out = new Uint8Array(indices.length);
  for (let i = 0; i < indices.length; i++) out[i] = remap[indices[i]];
  return { indices: out, centers: order.map((i) => centers[i]), counts: order.map((i) => counts[i]) };
}

/** Komplette Umwandlung aus bereits gemittelten OKLab-Werten je Masche. */
export function convertFromLab(cellLab: Float32Array, p: ConvertParams): ConvertResult {
  const lab = adjustLab(cellLab, p.brightness, p.contrast, p.saturation);
  const k = Math.max(2, Math.min(32, Math.round(p.colors)));
  const centers = kmeansColors(lab, k);
  let indices = p.dither ? assignDithered(lab, p.gridW, p.gridH, centers) : assignNearest(lab, centers);
  indices = despeckle(indices, p.gridW, p.gridH, Math.round(p.smoothing));
  const sorted = sortByFrequency(indices, centers);
  return {
    gridW: p.gridW,
    gridH: p.gridH,
    indices: sorted.indices,
    palette: sorted.centers.map((c) => oklabToHex(c)),
    centroids: sorted.centers,
    counts: sorted.counts,
  };
}

// ---------- Umwandlung auf Pixel-Ebene (Mehrheitsentscheid je Masche) ----------

const BIN_RES = 32;

/** Vorbereitete Bilddaten: Farb-Bins aller Pixel und Mittelwerte je Masche. */
export interface PreparedSource {
  gridW: number;
  gridH: number;
  w: number;
  h: number;
  /** Bin-Index je Pixel */
  binOf: Uint16Array;
  /** Mittelwert (L, a, b) je Bin */
  binMean: Float64Array;
  /** Pixelanzahl je Bin */
  binCount: Float64Array;
  nBins: number;
  /** Mittelwert je Masche (OKLab) – für Dithering und Gleichstände */
  cellLab: Float32Array;
  meanL: number;
}

function binKey(L: number, a: number, b: number): number {
  const li = Math.min(BIN_RES - 1, Math.max(0, Math.floor(L * BIN_RES)));
  const ai = Math.min(BIN_RES - 1, Math.max(0, Math.floor((a + 0.4) * (BIN_RES / 0.8))));
  const bi = Math.min(BIN_RES - 1, Math.max(0, Math.floor((b + 0.4) * (BIN_RES / 0.8))));
  return (li * BIN_RES + ai) * BIN_RES + bi;
}

export function prepareSource(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, gridW: number, gridH: number): PreparedSource {
  const n = w * h;
  const binOf = new Uint16Array(n);
  const keyToBin = new Int32Array(BIN_RES * BIN_RES * BIN_RES).fill(-1);
  const sums: number[] = [];
  const cells = gridW * gridH;
  const cellLin = new Float64Array(cells * 4);
  const colCell = new Int32Array(w);
  const rowCell = new Int32Array(h);
  for (let x = 0; x < w; x++) colCell[x] = Math.min(gridW - 1, Math.floor((x * gridW) / w));
  for (let y = 0; y < h; y++) rowCell[y] = Math.min(gridH - 1, Math.floor((y * gridH) / h));
  let sumL = 0;
  for (let y = 0; y < h; y++) {
    const rowBase = rowCell[y] * gridW;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = i * 4;
      const al = rgba[p + 3] / 255;
      const r = srgbToLinear8(rgba[p]) * al + (1 - al);
      const g = srgbToLinear8(rgba[p + 1]) * al + (1 - al);
      const b = srgbToLinear8(rgba[p + 2]) * al + (1 - al);
      const c = (rowBase + colCell[x]) * 4;
      cellLin[c] += r;
      cellLin[c + 1] += g;
      cellLin[c + 2] += b;
      cellLin[c + 3] += 1;
      const [L, A, B] = linearRgbToOklab(r, g, b);
      sumL += L;
      const key = binKey(L, A, B);
      let bin = keyToBin[key];
      if (bin < 0) {
        bin = sums.length / 4;
        keyToBin[key] = bin;
        sums.push(0, 0, 0, 0);
      }
      binOf[i] = bin;
      sums[bin * 4] += L;
      sums[bin * 4 + 1] += A;
      sums[bin * 4 + 2] += B;
      sums[bin * 4 + 3] += 1;
    }
  }
  const nBins = sums.length / 4;
  const binMean = new Float64Array(nBins * 3);
  const binCount = new Float64Array(nBins);
  for (let i = 0; i < nBins; i++) {
    const cnt = sums[i * 4 + 3];
    binMean[i * 3] = sums[i * 4] / cnt;
    binMean[i * 3 + 1] = sums[i * 4 + 1] / cnt;
    binMean[i * 3 + 2] = sums[i * 4 + 2] / cnt;
    binCount[i] = cnt;
  }
  const cellLab = new Float32Array(cells * 3);
  for (let c = 0; c < cells; c++) {
    const cnt = cellLin[c * 4 + 3] || 1;
    const lab = linearRgbToOklab(cellLin[c * 4] / cnt, cellLin[c * 4 + 1] / cnt, cellLin[c * 4 + 2] / cnt);
    cellLab[c * 3] = lab[0];
    cellLab[c * 3 + 1] = lab[1];
    cellLab[c * 3 + 2] = lab[2];
  }
  return { gridW, gridH, w, h, binOf, binMean, binCount, nBins, cellLab, meanL: n ? sumL / n : 0.5 };
}

function adjustPoint(L: number, a: number, b: number, meanL: number, p: ConvertParams): [number, number, number] {
  let l = (L - meanL) * (1 + p.contrast) + meanL + p.brightness * 0.25;
  l = l < 0 ? 0 : l > 1 ? 1 : l;
  const sf = Math.max(0, 1 + p.saturation);
  return [l, a * sf, b * sf];
}

/** Umwandlung: Farbreduktion über alle Pixel, dann Mehrheitsentscheid je Masche (oder Dithering). */
export function convertPrepared(src: PreparedSource, p: ConvertParams, weightPower = WEIGHT_POWER): ConvertResult {
  const { gridW, gridH, w, h, nBins } = src;
  // Angepasste Bin-Farben
  const points = new Float64Array(nBins * 3);
  const weights = new Float64Array(nBins);
  for (let i = 0; i < nBins; i++) {
    const [L, a, b] = adjustPoint(src.binMean[i * 3], src.binMean[i * 3 + 1], src.binMean[i * 3 + 2], src.meanL, p);
    points[i * 3] = L;
    points[i * 3 + 1] = a;
    points[i * 3 + 2] = b;
    weights[i] = weightPower === 1 ? src.binCount[i] : Math.pow(src.binCount[i], weightPower);
  }
  const k = Math.max(2, Math.min(32, Math.round(p.colors)));
  // Angepasste Mittelwerte je Masche
  const cells = gridW * gridH;
  const cellAdj = new Float32Array(cells * 3);
  for (let c = 0; c < cells; c++) {
    const [L, a, b] = adjustPoint(src.cellLab[c * 3], src.cellLab[c * 3 + 1], src.cellLab[c * 3 + 2], src.meanL, p);
    cellAdj[c * 3] = L;
    cellAdj[c * 3 + 1] = a;
    cellAdj[c * 3 + 2] = b;
  }
  let indices: Uint8Array;
  let centers: Lab[];
  if (p.dither) {
    centers = kmeansBins({ points, weights, count: nBins }, k, 1234);
    indices = assignDithered(cellAdj, gridW, gridH, centers);
  } else {
    // Stufe 1: feine Farbreduktion über alle Pixel, dominante Feinfarbe je Masche (Mehrheitsentscheid)
    const fine = kmeansBins({ points, weights, count: nBins }, Math.min(nBins, Math.max(24, k * 3)), 1234);
    const kf = fine.length;
    const binToFine = new Uint8Array(nBins);
    for (let i = 0; i < nBins; i++) binToFine[i] = nearest(points[i * 3], points[i * 3 + 1], points[i * 3 + 2], fine);
    const cellFine = new Uint8Array(cells);
    const votes = new Uint32Array(gridW * kf);
    let y = 0;
    for (let cy = 0; cy < gridH; cy++) {
      votes.fill(0);
      // alle Pixelzeilen dieser Maschenreihe
      for (; y < h && Math.min(gridH - 1, Math.floor((y * gridH) / h)) === cy; y++) {
        for (let x = 0; x < w; x++) {
          const cx = Math.min(gridW - 1, Math.floor((x * gridW) / w));
          votes[cx * kf + binToFine[src.binOf[y * w + x]]]++;
        }
      }
      for (let cx = 0; cx < gridW; cx++) {
        const c = cy * gridW + cx;
        let best = 0;
        let bestVotes = -1;
        let bestD = Infinity;
        for (let j = 0; j < kf; j++) {
          const v = votes[cx * kf + j];
          if (v < bestVotes || v === 0) continue;
          const f = fine[j];
          const dL = cellAdj[c * 3] - f[0];
          const da = cellAdj[c * 3 + 1] - f[1];
          const db = cellAdj[c * 3 + 2] - f[2];
          const d = dL * dL + da * da + db * db;
          // Gleichstand: die zum Mittelwert der Masche nächstgelegene Farbe
          if (v > bestVotes || d < bestD) {
            best = j;
            bestVotes = v;
            bestD = d;
          }
        }
        cellFine[c] = best;
      }
    }
    // Stufe 2: finale Farben aus den dominanten Feinfarben der Maschen (jede Farbe bekommt Maschen)
    const fineCells = new Float64Array(kf);
    for (let c = 0; c < cells; c++) fineCells[cellFine[c]]++;
    const used: number[] = [];
    for (let j = 0; j < kf; j++) if (fineCells[j] > 0) used.push(j);
    const fp = new Float64Array(used.length * 3);
    const fw = new Float64Array(used.length);
    used.forEach((j, i) => {
      fp[i * 3] = fine[j][0];
      fp[i * 3 + 1] = fine[j][1];
      fp[i * 3 + 2] = fine[j][2];
      fw[i] = weightPower === 1 ? fineCells[j] : Math.pow(fineCells[j], weightPower);
    });
    const finals = kmeansBins({ points: fp, weights: fw, count: used.length }, k, 4321);
    const fineToFinal = new Uint8Array(kf);
    used.forEach((j) => (fineToFinal[j] = nearest(fine[j][0], fine[j][1], fine[j][2], finals)));
    // Farbe je finalem Cluster = häufigste echte Farbe darin (keine Mischfarben wie Oliv aus Grün + Rot)
    const bestFine = new Int32Array(finals.length).fill(-1);
    used.forEach((j) => {
      const t = fineToFinal[j];
      if (bestFine[t] < 0 || fineCells[j] > fineCells[bestFine[t]]) bestFine[t] = j;
    });
    centers = finals.map((f, t) => (bestFine[t] >= 0 ? ([...fine[bestFine[t]]] as Lab) : f));
    indices = new Uint8Array(cells);
    for (let c = 0; c < cells; c++) indices[c] = fineToFinal[cellFine[c]];
  }
  indices = despeckle(indices, gridW, gridH, Math.round(p.smoothing));
  const sorted = sortByFrequency(indices, centers);
  return {
    gridW,
    gridH,
    indices: sorted.indices,
    palette: sorted.centers.map((c) => oklabToHex(c)),
    centroids: sorted.centers,
    counts: sorted.counts,
  };
}

/** Rasterhöhe, damit das Motiv bei der gegebenen Maschenprobe unverzerrt bleibt. */
export function autoHeight(gridW: number, cropW: number, cropH: number, gaugeSts: number, gaugeRows: number): number {
  if (cropW <= 0) return gridW;
  return Math.max(1, Math.round(gridW * (cropH / cropW) * (gaugeRows / gaugeSts)));
}

/** Supersampling-Faktor für das Quellbild (begrenzt den Speicherbedarf). */
export function supersample(gridW: number, gridH: number, cropW: number): number {
  const byMemory = Math.floor(Math.sqrt(4_000_000 / Math.max(1, gridW * gridH)));
  const byResolution = Math.ceil(cropW / Math.max(1, gridW));
  return Math.max(1, Math.min(8, byMemory, byResolution));
}
