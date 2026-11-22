import type { ChartGrid, Rect } from '../model/types';
import {
  clearSymbolAt,
  extractClip,
  floodFill,
  inBounds,
  lineCells,
  longFloats,
  normRect,
  rectCells,
  setSymbol,
} from '../model/grid';
import { mirrorCode, symbolByKey, symbolPart } from '../model/stitches';
import { cellAspect } from '../model/doc';
import {
  buildCellBitmap,
  drawCells,
  drawGridLines,
  drawMask,
  drawRulers,
  drawSelection,
  drawSymbols,
  SymbolSprites,
  visibleRange,
  type AnyCanvas,
  type CellRange,
  type Viewport,
} from '../render/chartRender';
import { buildKnitBitmap } from '../render/knitPreview';
import type { EditorActions, EditorState, Floating } from './store';
import { clampRect } from './store';

interface CanvasTheme {
  desk: string;
  text: string;
  band: string;
  accent: string;
  accentText: string;
  font: string;
  shadeAbove: string;
  shadeBelow: string;
  floats: string;
}

type Cell = { x: number; y: number };

type StrokeState =
  | { kind: 'paint'; last: Cell | null; erase: boolean; lastPlaced: Cell | null }
  | { kind: 'shape'; tool: 'line' | 'rect'; start: Cell; end: Cell }
  | { kind: 'select'; start: Cell }
  | { kind: 'move-floating'; startCell: Cell; origin: Cell };

export interface ControllerCallbacks {
  onMessage?: (key: 'fillCable') => void;
}

const MIN_CELL = 2;
const MAX_CELL = 72;
export const BASE_CELL = 20;

export class ChartCanvasController {
  private ctx: CanvasRenderingContext2D;
  private ox = 0;
  private oy = 0;
  private cw = BASE_CELL;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  private bitmap: AnyCanvas | null = null;
  private bitmapVersion = -1;
  private knitBitmap: AnyCanvas | null = null;
  private knitVersion = -1;
  private knitTimer: ReturnType<typeof setTimeout> | null = null;
  private floatsMask: Uint8Array | null = null;
  private floatsKey = '';
  private sprites = new SymbolSprites();
  private raf = 0;
  private fitted = false;
  private theme: CanvasTheme;
  private unsub: () => void;
  private ro: ResizeObserver;
  private media: MediaQueryList | null = null;

  private pointers = new Map<number, { x: number; y: number }>();
  private gesture: { d0: number; mx: number; my: number; cw0: number; ox0: number; oy0: number } | null = null;
  private panState: { x: number; y: number; ox: number; oy: number } | null = null;
  private stroke: StrokeState | null = null;
  private spaceDown = false;
  private suppress = false;
  private tap: { x: number; y: number; t: number } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private actions: EditorActions,
    private callbacks: ControllerCallbacks = {},
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.theme = this.readTheme();
    this.unsub = actions.store.subscribe((s, prev) => this.onState(s, prev));
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement ?? canvas);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    if (typeof matchMedia !== 'undefined') {
      this.media = matchMedia('(prefers-color-scheme: dark)');
      this.media.addEventListener('change', this.onThemeChange);
    }
    this.resize();
  }

  destroy(): void {
    this.unsub();
    this.ro.disconnect();
    cancelAnimationFrame(this.raf);
    if (this.knitTimer) clearTimeout(this.knitTimer);
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onPointerDown);
    c.removeEventListener('pointermove', this.onPointerMove);
    c.removeEventListener('pointerup', this.onPointerUp);
    c.removeEventListener('pointercancel', this.onPointerCancel);
    c.removeEventListener('pointerleave', this.onPointerLeave);
    c.removeEventListener('wheel', this.onWheel);
    c.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.media?.removeEventListener('change', this.onThemeChange);
  }

  // ---------- Ansicht ----------

  private get state(): EditorState {
    return this.actions.state;
  }

  private get aspect(): number {
    return cellAspect(this.state.doc.settings);
  }

  private get ch(): number {
    return this.cw * this.aspect;
  }

  private readTheme(): CanvasTheme {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
    return {
      desk: v('--canvas-desk', '#e9e3da'),
      text: v('--canvas-text', '#5b524b'),
      band: v('--canvas-band', 'rgba(233,227,218,0.92)'),
      accent: v('--primary', '#b23a5e'),
      accentText: v('--on-primary', '#ffffff'),
      font: v('--font-ui', 'system-ui, sans-serif'),
      shadeAbove: v('--canvas-shade-above', 'rgba(233,227,218,0.78)'),
      shadeBelow: v('--canvas-shade-below', 'rgba(233,227,218,0.35)'),
      floats: v('--canvas-floats', 'rgba(220, 38, 38, 0.55)'),
    };
  }

  private onThemeChange = () => {
    this.theme = this.readTheme();
    this.invalidate();
  };

  private resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (w === this.cssW && h === this.cssH && dpr === this.dpr) return;
    const prevW = this.cssW;
    const prevH = this.cssH;
    this.cssW = w;
    this.cssH = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    if (!this.fitted && w > 50 && h > 50) {
      this.fit();
      this.fitted = true;
    } else if (prevW && prevH) {
      // Mittelpunkt beibehalten
      this.ox += (w - prevW) / 2;
      this.oy += (h - prevH) / 2;
    }
    this.renderNow();
  }

  fit(): void {
    const g = this.state.grid;
    const pad = this.cssW < 600 ? 12 : 28;
    // Platzbedarf der Nummern grob schätzen (Schriftgröße hängt von der Kästchengröße ab)
    const digits = String(Math.max(g.width, g.height)).length;
    const side = digits * 8 + 18;
    const bottom = 24;
    const availW = this.cssW - pad * 2 - side * 2;
    const availH = this.cssH - pad * 2 - bottom;
    const cw = Math.min(availW / g.width, availH / (g.height * this.aspect));
    this.cw = Math.max(MIN_CELL, Math.min(40, cw));
    const gw = g.width * this.cw;
    const gh = g.height * this.ch;
    this.ox = Math.round((this.cssW - gw) / 2);
    this.oy = Math.round((this.cssH - bottom - gh) / 2);
    this.emitZoom();
    this.invalidate();
  }

  zoomBy(factor: number, px = this.cssW / 2, py = this.cssH / 2): void {
    const ncw = Math.max(MIN_CELL, Math.min(MAX_CELL, this.cw * factor));
    const k = ncw / this.cw;
    this.ox = px - (px - this.ox) * k;
    this.oy = py - (py - this.oy) * k;
    this.cw = ncw;
    this.clampPan();
    this.emitZoom();
    this.invalidate();
  }

  /** Scrollt so, dass die Reihe sichtbar ist. */
  revealRow(row: number): void {
    const g = this.state.grid;
    const y = g.height - row;
    const top = this.oy + y * this.ch;
    const margin = Math.max(this.ch * 3, 60);
    if (top < margin || top + this.ch > this.cssH - margin - 60) {
      const gh = g.height * this.ch;
      const bottomSpace = 34;
      let oy = this.cssH * 0.45 - y * this.ch;
      if (gh + bottomSpace + 16 > this.cssH) {
        // Raster größer als der Ausschnitt: keine leere Fläche unter/über dem Raster lassen
        oy = Math.max(this.cssH - bottomSpace - gh, Math.min(16, oy));
      } else {
        oy = (this.cssH - bottomSpace - gh) / 2;
      }
      this.oy = oy;
      this.clampPan();
      this.invalidate();
    }
  }

  /** Zelle in der linken oberen Ecke des sichtbaren Bereichs (für Einfügen). */
  topLeftVisibleCell(): Cell {
    const g = this.state.grid;
    const x = Math.max(0, Math.min(g.width - 1, Math.ceil(-this.ox / this.cw) + 1));
    const y = Math.max(0, Math.min(g.height - 1, Math.ceil(-this.oy / this.ch) + 1));
    return { x, y };
  }

  private emitZoom() {
    const zoom = this.cw / BASE_CELL;
    if (Math.abs(zoom - this.state.zoom) > 0.001) this.actions.store.setState({ zoom });
  }

  private clampPan() {
    const g = this.state.grid;
    const gw = g.width * this.cw;
    const gh = g.height * this.ch;
    const keep = 48;
    this.ox = Math.min(this.cssW - keep, Math.max(keep - gw, this.ox));
    this.oy = Math.min(this.cssH - keep, Math.max(keep - gh, this.oy));
  }

  private viewport(): Viewport {
    return { ox: this.ox, oy: this.oy, cw: this.cw, ch: this.ch, width: this.cssW, height: this.cssH, dpr: this.dpr };
  }

  private onState(s: EditorState, prev: EditorState) {
    if (s.grid.width !== prev.grid.width || s.grid.height !== prev.grid.height) {
      // Nach Größenänderung sichtbar halten
      this.clampPan();
    }
    if (s.doc.settings.cellShape !== prev.doc.settings.cellShape || s.doc.settings.gaugeRows !== prev.doc.settings.gaugeRows || s.doc.settings.gaugeStitches !== prev.doc.settings.gaugeStitches) {
      this.knitVersion = -1;
    }
    if (s.knitMode && s.doc.progressRow !== prev.doc.progressRow && s.doc.progressRow > 0) {
      this.revealRow(s.doc.progressRow);
    }
    this.invalidate();
  }

  invalidate(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.renderNow();
    });
  }

  // ---------- Zeichnen ----------

  private ensureKnitBitmap(g: ChartGrid, version: number) {
    if (this.knitVersion === version && this.knitBitmap) return;
    if (!this.knitBitmap || this.knitVersion === -1) {
      this.knitBitmap = buildKnitBitmap(g, this.aspect);
      this.knitVersion = version;
      return;
    }
    if (this.knitTimer) return;
    this.knitTimer = setTimeout(() => {
      this.knitTimer = null;
      const s = this.state;
      this.knitBitmap = buildKnitBitmap(s.grid, this.aspect);
      this.knitVersion = s.version;
      this.invalidate();
    }, 180);
  }

  private renderNow(): void {
    const s = this.state;
    const g = s.grid;
    const ctx = this.ctx;
    const th = this.theme;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = th.desk;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    if (!this.cssW || !this.cssH) return;
    const vp = this.viewport();
    if (s.version !== this.bitmapVersion || !this.bitmap) {
      this.bitmap = buildCellBitmap(g, this.bitmap ?? undefined);
      this.bitmapVersion = s.version;
    }

    if (s.repeatPreview) this.drawRepeatGhosts(g, vp);

    const r = visibleRange(g, vp);
    if (r) {
      if (s.knitPreview) {
        this.ensureKnitBitmap(g, s.version);
        const kb = this.knitBitmap!;
        const sx = kb.width / g.width;
        const sy = kb.height / g.height;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(kb as CanvasImageSource, r.x0 * sx, r.y0 * sy, (r.x1 - r.x0) * sx, (r.y1 - r.y0) * sy, vp.ox + r.x0 * vp.cw, vp.oy + r.y0 * vp.ch, (r.x1 - r.x0) * vp.cw, (r.y1 - r.y0) * vp.ch);
      } else {
        drawCells(ctx, this.bitmap, r, vp);
        if (s.showSymbols) drawSymbols(ctx, g, r, vp, this.sprites);
      }
      if (s.showFloats) {
        const key = `${s.version}|${s.maxFloat}`;
        if (key !== this.floatsKey || !this.floatsMask) {
          this.floatsMask = longFloats(g, s.maxFloat);
          this.floatsKey = key;
        }
        drawMask(ctx, g, this.floatsMask, r, vp, th.floats);
      }
      if (!s.knitPreview) {
        drawGridLines(ctx, g, r, vp, s.doc.settings.highlightEvery);
      }
      if (s.floating) this.drawFloating(s.floating, g, vp);
      if (s.selection && !s.floating && !s.knitMode) drawSelection(ctx, s.selection, vp);
      if (s.knitMode) this.drawKnitOverlay(g, vp, r);
      else this.drawHover(g, vp);
    }
    drawRulers(
      ctx,
      g,
      s.doc.settings,
      vp,
      { font: th.font, text: th.text, band: th.band, accent: th.accent, accentText: th.accentText },
      { sticky: true, gap: 5, activeRow: s.knitMode ? Math.max(1, s.doc.progressRow) : s.hover ? g.height - s.hover.y : undefined },
    );
  }

  private drawRepeatGhosts(g: ChartGrid, vp: Viewport) {
    const ctx = this.ctx;
    const gw = g.width * vp.cw;
    const gh = g.height * vp.ch;
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.imageSmoothingEnabled = false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ox = vp.ox + dx * gw;
        const oy = vp.oy + dy * gh;
        if (ox > vp.width || oy > vp.height || ox + gw < 0 || oy + gh < 0) continue;
        ctx.drawImage(this.bitmap as CanvasImageSource, ox, oy, gw, gh);
      }
    }
    ctx.restore();
  }

  private drawFloating(f: Floating, g: ChartGrid, vp: Viewport) {
    const ctx = this.ctx;
    const clip = f.clip;
    const temp: ChartGrid = {
      width: clip.width,
      height: clip.height,
      colors: new Uint8Array(clip.colors.length),
      symbols: clip.symbols,
      palette: g.palette,
    };
    for (let i = 0; i < clip.colors.length; i++) temp.colors[i] = f.colorMap[clip.colors[i]] ?? 0;
    const bmp = buildCellBitmap(temp);
    const fvp: Viewport = { ...vp, ox: vp.ox + f.x * vp.cw, oy: vp.oy + f.y * vp.ch };
    const r: CellRange = { x0: 0, y0: 0, x1: clip.width, y1: clip.height };
    ctx.save();
    ctx.globalAlpha = 0.92;
    drawCells(ctx, bmp, r, fvp);
    drawSymbols(ctx, temp, r, fvp, this.sprites);
    ctx.restore();
    drawSelection(ctx, { x: f.x, y: f.y, width: clip.width, height: clip.height }, vp, this.theme.accent);
  }

  private drawKnitOverlay(g: ChartGrid, vp: Viewport, r: CellRange) {
    const ctx = this.ctx;
    const row = Math.max(1, Math.min(g.height, this.state.doc.progressRow || 1));
    const y = g.height - row;
    const left = vp.ox + r.x0 * vp.cw;
    const width = (r.x1 - r.x0) * vp.cw;
    // Noch nicht gestrickte Reihen (oberhalb) stark abdecken, gestrickte leicht
    if (y > 0) {
      ctx.fillStyle = this.theme.shadeAbove;
      ctx.fillRect(left, vp.oy, width, y * vp.ch);
    }
    if (y < g.height - 1) {
      ctx.fillStyle = this.theme.shadeBelow;
      ctx.fillRect(left, vp.oy + (y + 1) * vp.ch, width, (g.height - y - 1) * vp.ch);
    }
    ctx.save();
    ctx.strokeStyle = this.theme.accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(vp.ox - 1.5, vp.oy + y * vp.ch - 1.5, g.width * vp.cw + 3, vp.ch + 3);
    ctx.restore();
  }

  private drawHover(g: ChartGrid, vp: Viewport) {
    const s = this.state;
    const h = s.hover;
    if (!h || !inBounds(g, h.x, h.y) || this.stroke || s.tool === 'hand') return;
    let w = 1;
    if ((s.tool === 'pencil' || s.tool === 'line') && s.paintTarget === 'symbol') {
      w = symbolPart(s.activeSymbol).symbol.width;
    }
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeRect(vp.ox + h.x * vp.cw + 1, vp.oy + h.y * vp.ch + 1, w * vp.cw - 2, vp.ch - 2);
    ctx.strokeStyle = this.theme.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vp.ox + h.x * vp.cw, vp.oy + h.y * vp.ch, w * vp.cw, vp.ch);
    ctx.restore();
  }

  // ---------- Eingabe ----------

  private pos(e: PointerEvent | WheelEvent | MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private cellAt(px: number, py: number): Cell {
    return { x: Math.floor((px - this.ox) / this.cw), y: Math.floor((py - this.oy) / this.ch) };
  }

  private clampCell(c: Cell): Cell {
    const g = this.state.grid;
    return { x: Math.max(0, Math.min(g.width - 1, c.x)), y: Math.max(0, Math.min(g.height - 1, c.y)) };
  }

  private onContextMenu = (e: Event) => e.preventDefault();

  private onPointerDown = (e: PointerEvent) => {
    const p = this.pos(e);
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) {
      // Zwei Finger: Zoom/Verschieben, laufenden Strich verwerfen
      this.abortStroke();
      this.panState = null;
      const [a, b] = [...this.pointers.values()];
      this.gesture = {
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        cw0: this.cw,
        ox0: this.ox,
        oy0: this.oy,
      };
      this.tap = null;
      return;
    }
    if (this.pointers.size > 2 || this.suppress) return;
    const s = this.state;
    const panButton = e.button === 1 || (e.button === 0 && (this.spaceDown || s.tool === 'hand'));
    if (s.knitMode) {
      this.tap = { x: p.x, y: p.y, t: performance.now() };
      this.panState = { x: p.x, y: p.y, ox: this.ox, oy: this.oy };
      return;
    }
    if (panButton) {
      this.panState = { x: p.x, y: p.y, ox: this.ox, oy: this.oy };
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    if (e.button === 2 || (e.button === 0 && e.altKey) || s.tool === 'picker') {
      this.pick(this.cellAt(p.x, p.y), e.button === 2 || e.altKey);
      return;
    }
    if (e.button !== 0) return;
    this.startTool(this.cellAt(p.x, p.y), e);
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.pos(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
    if (this.gesture && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const g = this.gesture;
      const ncw = Math.max(MIN_CELL, Math.min(MAX_CELL, g.cw0 * (d / g.d0)));
      const k = ncw / g.cw0;
      this.cw = ncw;
      this.ox = mx - (g.mx - g.ox0) * k;
      this.oy = my - (g.my - g.oy0) * k;
      this.clampPan();
      this.emitZoom();
      this.invalidate();
      return;
    }
    if (this.panState) {
      if (this.tap && Math.hypot(p.x - this.tap.x, p.y - this.tap.y) > 8) this.tap = null;
      this.ox = this.panState.ox + (p.x - this.panState.x);
      this.oy = this.panState.oy + (p.y - this.panState.y);
      this.clampPan();
      this.invalidate();
      return;
    }
    const cell = this.cellAt(p.x, p.y);
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') this.setHover(cell);
    if (this.stroke) this.moveTool(cell, e);
  };

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.gesture) {
      if (this.pointers.size < 2) {
        this.gesture = null;
        this.suppress = this.pointers.size > 0;
      }
      return;
    }
    if (this.pointers.size === 0) this.suppress = false;
    if (this.panState) {
      this.panState = null;
      this.canvas.style.cursor = '';
      if (this.tap && this.state.knitMode && performance.now() - this.tap.t < 600) {
        const cell = this.cellAt(this.tap.x, this.tap.y);
        const g = this.state.grid;
        if (cell.y >= 0 && cell.y < g.height) this.actions.updateDoc({ progressRow: g.height - cell.y });
      }
      this.tap = null;
      return;
    }
    if (this.stroke) this.endTool(this.cellAt(this.pos(e).x, this.pos(e).y));
  };

  private onPointerCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.gesture = null;
    this.panState = null;
    this.tap = null;
    this.abortStroke();
  };

  private onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && !this.stroke) this.setHover(null);
  };

  private setHover(cell: Cell | null) {
    const g = this.state.grid;
    const h = cell && inBounds(g, cell.x, cell.y) ? cell : null;
    const cur = this.state.hover;
    if ((h === null && cur === null) || (h && cur && h.x === cur.x && h.y === cur.y)) return;
    this.actions.store.setState({ hover: h });
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = this.pos(e);
    if (e.ctrlKey || e.metaKey) {
      // Pinch auf dem Trackpad bzw. Strg + Mausrad
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025));
      this.zoomBy(factor, p.x, p.y);
      return;
    }
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.cssH : 1;
    let dx = e.deltaX * scale;
    let dy = e.deltaY * scale;
    if (e.shiftKey && Math.abs(dx) < 0.5) {
      dx = dy;
      dy = 0;
    }
    this.ox -= dx;
    this.oy -= dy;
    this.clampPan();
    this.invalidate();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !isTyping(e)) {
      if (!this.spaceDown) {
        this.spaceDown = true;
        this.canvas.style.cursor = 'grab';
      }
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      this.spaceDown = false;
      this.canvas.style.cursor = '';
    }
  };

  // ---------- Werkzeuge ----------

  private pick(cell: Cell, temporary: boolean) {
    const g = this.state.grid;
    if (!inBounds(g, cell.x, cell.y)) return;
    const i = cell.y * g.width + cell.x;
    const s = this.state;
    const code = g.symbols[i];
    if (s.paintTarget === 'symbol' && code !== 0) {
      this.actions.store.setState({ activeSymbol: symbolPart(code).symbol.code, paintTarget: 'symbol' });
    } else {
      this.actions.store.setState({ activeColor: g.colors[i], paintTarget: 'color' });
    }
    if (s.tool === 'picker' && !temporary) this.actions.setTool(s.prevTool === 'picker' ? 'pencil' : s.prevTool);
  }

  private abortStroke() {
    if (!this.stroke) return;
    const st = this.stroke;
    this.stroke = null;
    if (st.kind === 'select') {
      this.actions.setSelection(null);
      return;
    }
    if (st.kind === 'move-floating') return;
    this.actions.cancelStroke();
  }

  private mirrorTargets(x: number, y: number, width: number): { x: number; y: number; flip: boolean }[] {
    const s = this.state;
    const g = s.grid;
    const out = [{ x, y, flip: false }];
    const mx = g.width - x - width;
    const my = g.height - 1 - y;
    if (s.mirrorX) out.push({ x: mx, y, flip: true });
    if (s.mirrorY) out.push({ x, y: my, flip: false });
    if (s.mirrorX && s.mirrorY) out.push({ x: mx, y: my, flip: true });
    const seen = new Set<string>();
    return out.filter((t) => {
      const k = `${t.x},${t.y}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  private paintCell(g: ChartGrid, x: number, y: number, erase: boolean) {
    const s = this.state;
    if (erase || s.paintTarget === 'color') {
      for (const t of this.mirrorTargets(x, y, 1)) {
        if (!inBounds(g, t.x, t.y)) continue;
        if (erase) {
          clearSymbolAt(g, t.x, t.y);
          g.colors[t.y * g.width + t.x] = 0;
        } else {
          g.colors[t.y * g.width + t.x] = s.activeColor;
        }
      }
      return;
    }
    const sym = symbolPart(s.activeSymbol).symbol;
    for (const t of this.mirrorTargets(x, y, sym.width)) {
      if (!inBounds(g, t.x, t.y)) continue;
      let code = sym.code;
      if (t.flip) code = sym.width > 1 ? (symbolByKey(sym.mirror) ?? sym).code : mirrorCode(sym.code);
      if (sym.key === 'knit') clearSymbolAt(g, t.x, t.y);
      else setSymbol(g, t.x, t.y, code);
    }
  }

  private startTool(cell: Cell, e: PointerEvent) {
    const s = this.state;
    const g = s.grid;
    switch (s.tool) {
      case 'pencil':
      case 'eraser': {
        const erase = s.tool === 'eraser';
        const draft = this.actions.beginStroke();
        const inside = inBounds(g, cell.x, cell.y);
        if (inside) this.paintCell(draft, cell.x, cell.y, erase);
        this.stroke = { kind: 'paint', last: cell, erase, lastPlaced: inside ? cell : null };
        this.actions.touch();
        break;
      }
      case 'fill': {
        if (!inBounds(g, cell.x, cell.y)) return;
        const draft = this.actions.beginStroke();
        this.fill(draft, cell);
        this.actions.commitStroke();
        break;
      }
      case 'line':
      case 'rect': {
        const c = this.clampCell(cell);
        this.actions.beginStroke();
        this.stroke = { kind: 'shape', tool: s.tool, start: c, end: c };
        this.drawShape(e.shiftKey);
        break;
      }
      case 'select': {
        const c = this.clampCell(cell);
        if (s.floating) {
          const f = s.floating;
          if (inRect(cell, { x: f.x, y: f.y, width: f.clip.width, height: f.clip.height })) {
            this.stroke = { kind: 'move-floating', startCell: cell, origin: { x: f.x, y: f.y } };
            return;
          }
          this.actions.commitFloating();
        }
        const sel = this.state.selection;
        if (sel && inRect(cell, sel)) {
          // Auswahl anheben und verschieben
          const clip = extractClip(this.state.committed, sel);
          const draft = this.actions.beginStroke();
          for (let y = sel.y; y < sel.y + sel.height; y++) {
            for (let x = sel.x; x < sel.x + sel.width; x++) {
              const i = y * draft.width + x;
              draft.colors[i] = 0;
              draft.symbols[i] = 0;
            }
          }
          const map = new Uint8Array(clip.palette.length);
          map.forEach((_, i) => (map[i] = i));
          this.actions.setFloating({ clip, x: sel.x, y: sel.y, colorMap: map });
          this.actions.setSelection(null);
          this.stroke = { kind: 'move-floating', startCell: cell, origin: { x: sel.x, y: sel.y } };
          return;
        }
        this.actions.setSelection({ x: c.x, y: c.y, width: 1, height: 1 });
        this.stroke = { kind: 'select', start: c };
        break;
      }
      default:
        break;
    }
  }

  private moveTool(cell: Cell, e: PointerEvent) {
    const st = this.stroke;
    if (!st) return;
    const s = this.state;
    const g = s.grid;
    if (st.kind === 'paint') {
      const symWidth = !st.erase && s.paintTarget === 'symbol' ? symbolPart(s.activeSymbol).symbol.width : 1;
      const last = st.last ?? cell;
      lineCells(last.x, last.y, cell.x, cell.y, (x, y) => {
        if (!inBounds(g, x, y)) return;
        if (symWidth > 1 && st.lastPlaced && st.lastPlaced.y === y && Math.abs(x - st.lastPlaced.x) < symWidth) return;
        this.paintCell(g, x, y, st.erase);
        st.lastPlaced = { x, y };
      });
      st.last = cell;
      this.actions.touch();
      return;
    }
    if (st.kind === 'shape') {
      const c = this.clampCell(cell);
      if (c.x === st.end.x && c.y === st.end.y) return;
      st.end = c;
      this.drawShape(e.shiftKey);
      return;
    }
    if (st.kind === 'select') {
      const c = this.clampCell(cell);
      this.actions.setSelection(normRect(st.start.x, st.start.y, c.x, c.y));
      return;
    }
    if (st.kind === 'move-floating') {
      const f = s.floating;
      if (!f) return;
      const nx = st.origin.x + (cell.x - st.startCell.x);
      const ny = st.origin.y + (cell.y - st.startCell.y);
      if (nx !== f.x || ny !== f.y) this.actions.setFloating({ ...f, x: nx, y: ny });
    }
  }

  private endTool(cell: Cell) {
    const st = this.stroke;
    this.stroke = null;
    if (!st) return;
    if (st.kind === 'paint' || st.kind === 'shape') {
      this.actions.commitStroke();
      return;
    }
    if (st.kind === 'select') {
      const c = this.clampCell(cell);
      const sel = normRect(st.start.x, st.start.y, c.x, c.y);
      if (sel.width === 1 && sel.height === 1 && c.x === st.start.x && c.y === st.start.y) {
        this.actions.setSelection(null);
      } else {
        this.actions.setSelection(clampRect(sel, this.state.grid));
      }
    }
  }

  private drawShape(constrain: boolean) {
    const st = this.stroke;
    if (!st || st.kind !== 'shape') return;
    const g = this.actions.resetDraft();
    let { end } = st;
    const { start } = st;
    if (constrain) end = constrainEnd(start, end, st.tool);
    const cells: Cell[] = [];
    if (st.tool === 'line') {
      lineCells(start.x, start.y, end.x, end.y, (x, y) => cells.push({ x, y }));
    } else {
      rectCells(normRect(start.x, start.y, end.x, end.y), this.state.rectFilled, (x, y) => cells.push({ x, y }));
    }
    const s = this.state;
    const symWidth = s.paintTarget === 'symbol' ? symbolPart(s.activeSymbol).symbol.width : 1;
    let lastPlaced: Cell | null = null;
    for (const c of cells) {
      if (!inBounds(g, c.x, c.y)) continue;
      if (symWidth > 1 && lastPlaced && lastPlaced.y === c.y && Math.abs(c.x - lastPlaced.x) < symWidth) continue;
      this.paintCell(g, c.x, c.y, false);
      lastPlaced = c;
    }
    this.actions.touch();
  }

  private fill(g: ChartGrid, cell: Cell) {
    const s = this.state;
    const start = cell.y * g.width + cell.x;
    if (s.paintTarget === 'color') {
      const from = g.colors[start];
      if (from === s.activeColor) return;
      floodFill(g, cell.x, cell.y, (i) => g.colors[i] === from, (_x, _y, i) => (g.colors[i] = s.activeColor));
      return;
    }
    const sym = symbolPart(s.activeSymbol).symbol;
    if (sym.width > 1) {
      this.callbacks.onMessage?.('fillCable');
      return;
    }
    const from = g.symbols[start];
    if (from === sym.code) return;
    const fromSym = symbolPart(from).symbol;
    if (fromSym.width > 1) clearSymbolAt(g, cell.x, cell.y);
    const target = g.symbols[start];
    const cells: number[] = [];
    floodFill(g, cell.x, cell.y, (i) => g.symbols[i] === target, (_x, _y, i) => cells.push(i));
    for (const i of cells) g.symbols[i] = sym.code;
  }

  /** Bild des sichtbaren Rasters als Zelle → Bildschirmkoordinaten (für Tests/Debug). */
  cellRect(x: number, y: number): Rect {
    return { x: this.ox + x * this.cw, y: this.oy + y * this.ch, width: this.cw, height: this.ch };
  }
}

function inRect(c: Cell, r: Rect): boolean {
  return c.x >= r.x && c.y >= r.y && c.x < r.x + r.width && c.y < r.y + r.height;
}

function constrainEnd(start: Cell, end: Cell, tool: 'line' | 'rect'): Cell {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (tool === 'rect') {
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    return { x: start.x + Math.sign(dx || 1) * d, y: start.y + Math.sign(dy || 1) * d };
  }
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx > ady * 2) return { x: end.x, y: start.y };
  if (ady > adx * 2) return { x: start.x, y: end.y };
  const d = Math.max(adx, ady);
  return { x: start.x + Math.sign(dx) * d, y: start.y + Math.sign(dy) * d };
}

export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}
