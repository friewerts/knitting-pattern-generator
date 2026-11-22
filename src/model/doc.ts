import type { ChartDoc, ChartGrid, ChartSettings, PaletteEntry } from './types';
import { DEFAULT_SETTINGS, MAX_PALETTE, MAX_SIZE } from './types';
import { createGrid, repairSymbols } from './grid';
import { isHexColor, normalizeHex } from './color';

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // nicht sicherer Kontext (z. B. http im LAN) → Fallback
    }
  }
  const rnd = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return `${rnd()}-${rnd().slice(0, 4)}-${rnd().slice(0, 4)}-${rnd().slice(0, 4)}-${rnd()}${rnd().slice(0, 4)}`;
}

export function createDoc(opts: {
  name: string;
  width?: number;
  height?: number;
  grid?: ChartGrid;
  palette?: PaletteEntry[];
  settings?: Partial<ChartSettings>;
}): ChartDoc {
  const now = Date.now();
  const grid = opts.grid ?? createGrid(opts.width ?? 30, opts.height ?? 30, opts.palette);
  return {
    format: 'maschenwerk-chart',
    version: 1,
    id: newId(),
    name: opts.name,
    createdAt: now,
    updatedAt: now,
    grid,
    settings: { ...DEFAULT_SETTINGS, ...opts.settings },
    progressRow: 0,
    notes: '',
  };
}

// ---------- Serialisierung (JSON-Datei) ----------

/** Run-Length-Encoding: [wert, anzahl, wert, anzahl, …] als Base64. */
export function encodeRLE(data: Uint8Array): string {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const v = data[i];
    let n = 1;
    while (i + n < data.length && data[i + n] === v && n < 255) n++;
    out.push(v, n);
    i += n;
  }
  return bytesToBase64(Uint8Array.from(out));
}

export function decodeRLE(s: string, length: number): Uint8Array {
  const bytes = base64ToBytes(s);
  const out = new Uint8Array(length);
  let o = 0;
  for (let i = 0; i + 1 < bytes.length && o < length; i += 2) {
    const v = bytes[i];
    const n = bytes[i + 1];
    out.fill(v, o, Math.min(length, o + n));
    o += n;
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface SerializedChart {
  format: 'maschenwerk-chart';
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  width: number;
  height: number;
  palette: PaletteEntry[];
  colors: string;
  symbols: string;
  settings: ChartSettings;
  progressRow: number;
  notes: string;
}

export interface SerializedBackup {
  format: 'maschenwerk-backup';
  version: 1;
  exportedAt: number;
  charts: SerializedChart[];
}

export function serializeDoc(doc: ChartDoc): SerializedChart {
  return {
    format: 'maschenwerk-chart',
    version: 1,
    id: doc.id,
    name: doc.name,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    width: doc.grid.width,
    height: doc.grid.height,
    palette: doc.grid.palette,
    colors: encodeRLE(doc.grid.colors),
    symbols: encodeRLE(doc.grid.symbols),
    settings: doc.settings,
    progressRow: doc.progressRow,
    notes: doc.notes,
  };
}

export class ImportError extends Error {}

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeSettings(s: unknown): ChartSettings {
  const o = (s && typeof s === 'object' ? s : {}) as Partial<ChartSettings>;
  return {
    gaugeStitches: num(o.gaugeStitches, DEFAULT_SETTINGS.gaugeStitches, 1, 100),
    gaugeRows: num(o.gaugeRows, DEFAULT_SETTINGS.gaugeRows, 1, 100),
    cellShape: o.cellShape === 'gauge' ? 'gauge' : 'square',
    workedIn: o.workedIn === 'rounds' ? 'rounds' : 'rows',
    firstRowRS: o.firstRowRS !== false,
    highlightEvery: Math.round(num(o.highlightEvery, DEFAULT_SETTINGS.highlightEvery, 0, 50)),
  };
}

function sanitizePalette(p: unknown): PaletteEntry[] {
  if (!Array.isArray(p) || p.length === 0) throw new ImportError('palette');
  return p.slice(0, MAX_PALETTE).map((e) => {
    const hex = e && typeof e.hex === 'string' && isHexColor(e.hex) ? normalizeHex(e.hex) : '#000000';
    const name = e && typeof e.name === 'string' ? e.name.slice(0, 80) : '';
    return { hex, name };
  });
}

export function deserializeDoc(raw: unknown): ChartDoc {
  if (!raw || typeof raw !== 'object') throw new ImportError('format');
  const o = raw as Partial<SerializedChart>;
  if (o.format !== 'maschenwerk-chart') throw new ImportError('format');
  const width = Math.round(num(o.width, 0, 0, MAX_SIZE));
  const height = Math.round(num(o.height, 0, 0, MAX_SIZE));
  if (width < 1 || height < 1) throw new ImportError('size');
  if (typeof o.colors !== 'string' || typeof o.symbols !== 'string') throw new ImportError('data');
  const grid: ChartGrid = {
    width,
    height,
    palette: sanitizePalette(o.palette),
    colors: decodeRLE(o.colors, width * height),
    symbols: decodeRLE(o.symbols, width * height),
  };
  repairSymbols(grid);
  const now = Date.now();
  return {
    format: 'maschenwerk-chart',
    version: 1,
    id: typeof o.id === 'string' && o.id ? o.id : newId(),
    name: typeof o.name === 'string' && o.name.trim() ? o.name.slice(0, 120) : 'Muster',
    createdAt: num(o.createdAt, now, 0, Number.MAX_SAFE_INTEGER),
    updatedAt: num(o.updatedAt, now, 0, Number.MAX_SAFE_INTEGER),
    grid,
    settings: sanitizeSettings(o.settings),
    progressRow: Math.round(num(o.progressRow, 0, 0, height)),
    notes: typeof o.notes === 'string' ? o.notes.slice(0, 20000) : '',
  };
}

/** Liest eine Muster- oder Sicherungsdatei. */
export function parseChartFile(text: string): ChartDoc[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('json');
  }
  if (raw && typeof raw === 'object' && (raw as SerializedBackup).format === 'maschenwerk-backup') {
    const charts = (raw as SerializedBackup).charts;
    if (!Array.isArray(charts)) throw new ImportError('format');
    return charts.map((c) => deserializeDoc(c));
  }
  return [deserializeDoc(raw)];
}

export function backupFile(docs: ChartDoc[]): SerializedBackup {
  return { format: 'maschenwerk-backup', version: 1, exportedAt: Date.now(), charts: docs.map(serializeDoc) };
}

/** Physische Größe in cm anhand der Maschenprobe. */
export function finishedSize(grid: { width: number; height: number }, s: ChartSettings): { width: number; height: number } {
  return {
    width: (grid.width / s.gaugeStitches) * 10,
    height: (grid.height / s.gaugeRows) * 10,
  };
}

/** Verhältnis Kästchenhöhe / Kästchenbreite für die Darstellung. */
export function cellAspect(s: ChartSettings): number {
  return s.cellShape === 'gauge' ? s.gaugeStitches / s.gaugeRows : 1;
}

export function safeFileName(name: string): string {
  const base = name
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} _-]+/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return base || 'muster';
}
