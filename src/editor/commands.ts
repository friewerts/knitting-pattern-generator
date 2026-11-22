import type { ChartGrid } from '../model/types';
import {
  createGrid,
  extractClip,
  fillRect,
  flipClipHorizontal,
  flipClipVertical,
  mapClipColors,
  repeatRegion,
  stampClip,
} from '../model/grid';
import { symbolPart } from '../model/stitches';
import { getClipboard, setClipboard, type EditorActions } from './store';
import type { ChartCanvasController } from './canvasController';

export function copySelection(actions: EditorActions): boolean {
  const s = actions.state;
  if (s.floating) {
    setClipboard({ ...s.floating.clip });
    return true;
  }
  if (!s.selection) return false;
  setClipboard(extractClip(s.committed, s.selection));
  return true;
}

/** Schwebenden Ausschnitt verwerfen: angehobene Inhalte bleiben gelöscht, eingefügte verschwinden. */
function discardFloating(actions: EditorActions): void {
  const f = actions.state.floating;
  if (!f) return;
  if (f.lifted) {
    actions.setFloating(null);
    actions.commitStroke();
  } else {
    actions.cancelFloating();
  }
}

export function clearSelection(actions: EditorActions): void {
  const s = actions.state;
  if (s.floating) {
    discardFloating(actions);
    return;
  }
  const sel = s.selection;
  if (!sel) return;
  actions.apply((g) => fillRect(g, sel, 0, 0));
}

export function cutSelection(actions: EditorActions): void {
  if (!copySelection(actions)) return;
  if (actions.state.floating) {
    discardFloating(actions);
    return;
  }
  clearSelection(actions);
}

export function pasteClipboard(actions: EditorActions, controller: ChartCanvasController | null): boolean {
  const clip = getClipboard();
  if (!clip) return false;
  if (actions.state.floating) actions.commitFloating();
  actions.setTool('select');
  const s = actions.state;
  const draft = actions.beginStroke();
  const map = mapClipColors(draft, clip);
  const pos = s.selection ? { x: s.selection.x, y: s.selection.y } : controller?.topLeftVisibleCell() ?? { x: 0, y: 0 };
  actions.setSelection(null);
  actions.setFloating({ clip, x: pos.x, y: pos.y, colorMap: map, lifted: false });
  return true;
}

export function flipSelection(actions: EditorActions, horizontal: boolean): void {
  const s = actions.state;
  if (s.floating) {
    const clip = horizontal ? flipClipHorizontal(s.floating.clip) : flipClipVertical(s.floating.clip);
    actions.setFloating({ ...s.floating, clip });
    return;
  }
  const sel = s.selection;
  if (!sel) return;
  actions.apply((g) => {
    const clip = extractClip(g, sel);
    stampClip(g, horizontal ? flipClipHorizontal(clip) : flipClipVertical(clip), sel.x, sel.y);
  });
}

export function fillSelection(actions: EditorActions): void {
  const s = actions.state;
  const sel = s.selection;
  if (!sel) return;
  if (s.paintTarget === 'color') {
    actions.apply((g) => fillRect(g, sel, s.activeColor, null));
  } else {
    const sym = symbolPart(s.activeSymbol).symbol;
    if (sym.width > 1) return;
    actions.apply((g) => fillRect(g, sel, null, sym.code));
  }
}

export function repeatSelection(actions: EditorActions, horizontal: boolean, vertical: boolean): void {
  const sel = actions.state.selection;
  if (!sel) return;
  actions.apply((g) => repeatRegion(g, sel, horizontal, vertical));
}

export function cropToSelection(actions: EditorActions, controller: ChartCanvasController | null): void {
  const sel = actions.state.selection;
  if (!sel) return;
  actions.apply((g) => {
    const clip = extractClip(g, sel);
    const out: ChartGrid = createGrid(sel.width, sel.height, g.palette);
    stampClip(out, clip, 0, 0);
    return out;
  });
  actions.setSelection(null);
  requestAnimationFrame(() => controller?.fit());
}
