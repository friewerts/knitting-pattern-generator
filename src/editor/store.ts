import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ChartDoc, ChartGrid, ChartSettings, Clip, Rect } from '../model/types';
import { cloneGrid } from '../model/grid';

export type ToolId = 'pencil' | 'eraser' | 'fill' | 'line' | 'rect' | 'select' | 'picker' | 'hand';
export type PaintTarget = 'color' | 'symbol';
export type SidePanel = 'palette' | 'legend' | 'instructions';
export type SaveState = 'saved' | 'saving' | 'dirty' | 'error';

export interface Floating {
  clip: Clip;
  x: number;
  y: number;
  /** Farbzuordnung Ausschnitt → aktuelles Raster */
  colorMap: Uint8Array;
  /** true: aus der Auswahl angehoben (Quelle bereits geleert), false: eingefügt */
  lifted: boolean;
}

export interface EditorState {
  doc: ChartDoc;
  /** Aktuell angezeigtes Raster (während eines Strichs ein Entwurf) */
  grid: ChartGrid;
  /** Zuletzt übernommenes Raster */
  committed: ChartGrid;
  past: ChartGrid[];
  future: ChartGrid[];
  /** Zähler, der sich bei jeder Rasteränderung erhöht */
  version: number;
  stroking: boolean;

  tool: ToolId;
  prevTool: ToolId;
  activeColor: number;
  activeSymbol: number;
  paintTarget: PaintTarget;
  mirrorX: boolean;
  mirrorY: boolean;
  rectFilled: boolean;

  selection: Rect | null;
  floating: Floating | null;

  knitMode: boolean;
  knitPreview: boolean;
  showSymbols: boolean;
  showFloats: boolean;
  maxFloat: number;
  repeatPreview: boolean;

  panel: SidePanel;
  /** mobile: Seitenleiste als Blatt eingeblendet */
  sheetOpen: boolean;
  saveState: SaveState;
  hover: { x: number; y: number } | null;
  zoom: number;
}

const MAX_HISTORY = 150;
const MAX_HISTORY_BYTES = 80 * 1024 * 1024;

export type EditorStore = StoreApi<EditorState>;

export function createEditorStore(doc: ChartDoc): EditorStore {
  const grid = cloneGrid(doc.grid);
  return createStore<EditorState>(() => ({
    doc,
    grid,
    committed: grid,
    past: [],
    future: [],
    version: 0,
    stroking: false,
    tool: 'pencil',
    prevTool: 'pencil',
    activeColor: Math.min(1, grid.palette.length - 1),
    activeSymbol: 1,
    paintTarget: 'color',
    mirrorX: false,
    mirrorY: false,
    rectFilled: false,
    selection: null,
    floating: null,
    knitMode: false,
    knitPreview: false,
    showSymbols: true,
    showFloats: false,
    maxFloat: 5,
    repeatPreview: false,
    panel: 'palette',
    sheetOpen: false,
    saveState: 'saved',
    hover: null,
    zoom: 1,
  }));
}

function gridBytes(g: ChartGrid): number {
  return g.colors.byteLength + g.symbols.byteLength + g.palette.length * 32;
}

function trimHistory(past: ChartGrid[]): ChartGrid[] {
  let out = past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past;
  let bytes = out.reduce((s, g) => s + gridBytes(g), 0);
  while (out.length > 1 && bytes > MAX_HISTORY_BYTES) {
    bytes -= gridBytes(out[0]);
    out = out.slice(1);
  }
  return out;
}

function sameGrid(a: ChartGrid, b: ChartGrid): boolean {
  if (a === b) return true;
  if (a.width !== b.width || a.height !== b.height || a.palette.length !== b.palette.length) return false;
  for (let i = 0; i < a.palette.length; i++) {
    if (a.palette[i].hex !== b.palette[i].hex || a.palette[i].name !== b.palette[i].name) return false;
  }
  const ac = a.colors;
  const bc = b.colors;
  for (let i = 0; i < ac.length; i++) if (ac[i] !== bc[i]) return false;
  const as = a.symbols;
  const bs = b.symbols;
  for (let i = 0; i < as.length; i++) if (as[i] !== bs[i]) return false;
  return true;
}

/** Aktionen auf dem Editor-Zustand. */
export class EditorActions {
  constructor(public store: EditorStore) {}

  get state(): EditorState {
    return this.store.getState();
  }

  private set(partial: Partial<EditorState>) {
    this.store.setState(partial);
  }

  // ----- Striche (Entwurf → Übernehmen) -----

  beginStroke(): ChartGrid {
    const s = this.state;
    const draft = cloneGrid(s.committed);
    this.set({ grid: draft, stroking: true, version: s.version + 1 });
    return draft;
  }

  /** Setzt den Entwurf auf den letzten Stand zurück (z. B. für Linien-Vorschau). */
  resetDraft(): ChartGrid {
    const s = this.state;
    const g = s.grid;
    const c = s.committed;
    if (g === c || g.width !== c.width || g.height !== c.height) return this.beginStroke();
    g.colors.set(c.colors);
    g.symbols.set(c.symbols);
    g.palette = c.palette.map((p) => ({ ...p }));
    return g;
  }

  /** Nach Änderungen am Entwurf aufrufen, damit neu gezeichnet wird. */
  touch() {
    this.set({ version: this.state.version + 1 });
  }

  commitStroke(): boolean {
    const s = this.state;
    if (!s.stroking) return false;
    if (sameGrid(s.grid, s.committed)) {
      this.set({ grid: s.committed, stroking: false, version: s.version + 1 });
      return false;
    }
    this.set({
      committed: s.grid,
      past: trimHistory([...s.past, s.committed]),
      future: [],
      stroking: false,
      version: s.version + 1,
      saveState: 'dirty',
    });
    return true;
  }

  cancelStroke() {
    const s = this.state;
    if (!s.stroking) return;
    this.set({
      grid: s.committed,
      stroking: false,
      version: s.version + 1,
      // Farben, die nur im verworfenen Entwurf existierten, nicht weiter verwenden
      activeColor: Math.min(s.activeColor, s.committed.palette.length - 1),
    });
  }

  /** Einmalige Änderung (z. B. Größe ändern, Spiegeln, Palette). */
  apply(fn: (g: ChartGrid) => ChartGrid | void): boolean {
    // Schwebenden Ausschnitt zuerst übernehmen, sonst passen dessen Farbzuordnungen nicht mehr
    if (this.state.floating) this.commitFloating();
    if (this.state.stroking) this.cancelStroke();
    const base = this.state.committed;
    const draft = cloneGrid(base);
    const result = fn(draft) ?? draft;
    if (sameGrid(result, base)) return false;
    this.set({
      grid: result,
      committed: result,
      past: trimHistory([...this.state.past, base]),
      future: [],
      version: this.state.version + 1,
      saveState: 'dirty',
      activeColor: Math.min(this.state.activeColor, result.palette.length - 1),
      selection: this.state.selection ? clampRect(this.state.selection, result) : null,
    });
    return true;
  }

  undo() {
    if (this.state.floating) {
      this.cancelFloating();
      return;
    }
    if (this.state.stroking) this.cancelStroke();
    const past = this.state.past;
    if (!past.length) return;
    const prev = past[past.length - 1];
    this.set({
      past: past.slice(0, -1),
      future: [this.state.committed, ...this.state.future],
      committed: prev,
      grid: prev,
      version: this.state.version + 1,
      saveState: 'dirty',
      activeColor: Math.min(this.state.activeColor, prev.palette.length - 1),
      selection: this.state.selection ? clampRect(this.state.selection, prev) : null,
    });
  }

  redo() {
    if (this.state.floating) this.cancelFloating();
    if (this.state.stroking) this.cancelStroke();
    const s = this.state;
    if (!s.future.length) return;
    const next = s.future[0];
    this.set({
      future: s.future.slice(1),
      past: trimHistory([...s.past, s.committed]),
      committed: next,
      grid: next,
      version: s.version + 1,
      saveState: 'dirty',
      activeColor: Math.min(s.activeColor, next.palette.length - 1),
      selection: s.selection ? clampRect(s.selection, next) : null,
    });
  }

  // ----- Dokument-Eigenschaften (nicht in der Rückgängig-Historie) -----

  updateDoc(partial: Partial<Pick<ChartDoc, 'name' | 'notes' | 'progressRow'>>) {
    const s = this.state;
    this.set({ doc: { ...s.doc, ...partial }, saveState: 'dirty' });
  }

  updateSettings(partial: Partial<ChartSettings>) {
    const s = this.state;
    this.set({ doc: { ...s.doc, settings: { ...s.doc.settings, ...partial } }, saveState: 'dirty', version: s.version + 1 });
  }

  /** Aktuelles Dokument inkl. Raster zum Speichern. */
  snapshot(): ChartDoc {
    const s = this.state;
    return { ...s.doc, grid: s.committed, updatedAt: Date.now() };
  }

  // ----- Werkzeuge & Auswahl -----

  setTool(tool: ToolId) {
    const s = this.state;
    if (s.floating && tool !== 'select') this.commitFloating();
    this.set({
      tool,
      prevTool: s.tool === 'picker' ? s.prevTool : s.tool,
      selection: tool === 'select' ? s.selection : null,
    });
  }

  selectColor(index: number) {
    // Werkzeugwechsel über setTool, damit ein schwebender Ausschnitt vorher übernommen wird
    if (!this.toolIsPaint()) this.setTool('pencil');
    const max = this.state.committed.palette.length - 1;
    this.set({ activeColor: Math.max(0, Math.min(max, index)), paintTarget: 'color' });
  }

  selectSymbol(code: number) {
    if (!this.toolIsPaint()) this.setTool('pencil');
    this.set({ activeSymbol: code, paintTarget: 'symbol' });
  }

  private toolIsPaint(): boolean {
    const t = this.state.tool;
    return t === 'pencil' || t === 'fill' || t === 'line' || t === 'rect';
  }

  setSelection(sel: Rect | null) {
    this.set({ selection: sel });
  }

  setFloating(f: Floating | null) {
    this.set({ floating: f, version: this.state.version + 1 });
  }

  /** Schwebenden Ausschnitt ins Raster übernehmen. */
  commitFloating(): void {
    const s = this.state;
    const f = s.floating;
    if (!f) return;
    const draft = s.stroking ? s.grid : this.beginStroke();
    for (let cy = 0; cy < f.clip.height; cy++) {
      const gy = f.y + cy;
      if (gy < 0 || gy >= draft.height) continue;
      for (let cx = 0; cx < f.clip.width; cx++) {
        const gx = f.x + cx;
        if (gx < 0 || gx >= draft.width) continue;
        const si = cy * f.clip.width + cx;
        const di = gy * draft.width + gx;
        const c = f.colorMap[f.clip.colors[si]] ?? 0;
        draft.colors[di] = c < draft.palette.length ? c : 0;
        draft.symbols[di] = f.clip.symbols[si];
      }
    }
    this.set({ floating: null, selection: clampRect({ x: f.x, y: f.y, width: f.clip.width, height: f.clip.height }, draft) });
    this.commitStroke();
  }

  cancelFloating(): void {
    const s = this.state;
    if (!s.floating) return;
    this.set({ floating: null });
    this.cancelStroke();
  }
}

export function clampRect(r: Rect, g: { width: number; height: number }): Rect | null {
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  const x1 = Math.min(g.width, r.x + r.width);
  const y1 = Math.min(g.height, r.y + r.height);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Programmweite Zwischenablage für Ausschnitte (auch zwischen Mustern). */
let clipboard: Clip | null = null;
export function setClipboard(c: Clip | null) {
  clipboard = c;
}
export function getClipboard(): Clip | null {
  return clipboard;
}
