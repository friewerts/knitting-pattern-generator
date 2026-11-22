import { describe, expect, it } from 'vitest';
import { createEditorStore, EditorActions, getClipboard, setClipboard } from '../src/editor/store';
import { createDoc } from '../src/model/doc';
import { extractClip, mapClipColors } from '../src/model/grid';

function setup(w = 4, h = 3) {
  const doc = createDoc({ name: 'T', width: w, height: h });
  const store = createEditorStore(doc);
  return new EditorActions(store);
}

describe('editor store', () => {
  it('commits strokes and supports undo/redo', () => {
    const a = setup();
    const g = a.beginStroke();
    g.colors[0] = 2;
    expect(a.commitStroke()).toBe(true);
    expect(a.state.committed.colors[0]).toBe(2);
    expect(a.state.past.length).toBe(1);
    a.undo();
    expect(a.state.committed.colors[0]).toBe(0);
    a.redo();
    expect(a.state.committed.colors[0]).toBe(2);
  });

  it('ignores strokes without changes', () => {
    const a = setup();
    a.beginStroke();
    expect(a.commitStroke()).toBe(false);
    expect(a.state.past.length).toBe(0);
  });

  it('applies one-shot changes and clamps the active colour', () => {
    const a = setup();
    a.selectColor(3);
    a.apply((g) => {
      g.palette = g.palette.slice(0, 2);
    });
    expect(a.state.activeColor).toBe(1);
    expect(a.state.saveState).toBe('dirty');
  });

  it('pastes a floating clip with new colours as one undo step', () => {
    const a = setup();
    const src = createDoc({ name: 'S', width: 2, height: 1, palette: [{ hex: '#000000', name: '' }, { hex: '#00ff00', name: 'Grün' }] }).grid;
    src.colors.set([1, 1]);
    setClipboard(extractClip(src, { x: 0, y: 0, width: 2, height: 1 }));
    const clip = getClipboard()!;
    const draft = a.beginStroke();
    const map = mapClipColors(draft, clip);
    a.setFloating({ clip, x: 1, y: 1, colorMap: map, lifted: false });
    a.commitFloating();
    const g = a.state.committed;
    const green = g.palette.findIndex((p) => p.hex === '#00ff00');
    expect(green).toBeGreaterThan(0);
    expect(g.colors[1 * 4 + 1]).toBe(green);
    expect(g.colors[1 * 4 + 2]).toBe(green);
    expect(a.state.past.length).toBe(1);
    a.undo();
    expect(a.state.committed.palette.some((p) => p.hex === '#00ff00')).toBe(false);
  });

  it('commits a floating clip before palette changes', () => {
    const a = setup();
    const src = createDoc({ name: 'S', width: 1, height: 1, palette: [{ hex: '#123456', name: '' }] }).grid;
    const clip = extractClip(src, { x: 0, y: 0, width: 1, height: 1 });
    const draft = a.beginStroke();
    const map = mapClipColors(draft, clip);
    a.setFloating({ clip, x: 0, y: 0, colorMap: map, lifted: false });
    a.apply((g) => {
      g.palette[0] = { hex: '#ffffff', name: '' };
    });
    expect(a.state.floating).toBeNull();
    const g = a.state.committed;
    expect(g.colors[0]).toBeLessThan(g.palette.length);
    expect(g.palette.some((p) => p.hex === '#123456')).toBe(true);
  });

  it('cancels a floating clip on undo', () => {
    const a = setup();
    const src = createDoc({ name: 'S', width: 1, height: 1 }).grid;
    const clip = extractClip(src, { x: 0, y: 0, width: 1, height: 1 });
    a.beginStroke();
    a.setFloating({ clip, x: 0, y: 0, colorMap: Uint8Array.from([0, 1, 2, 3]), lifted: false });
    a.undo();
    expect(a.state.floating).toBeNull();
    expect(a.state.stroking).toBe(false);
    expect(a.state.past.length).toBe(0);
  });

  it('updates document fields outside the undo history', () => {
    const a = setup();
    a.updateDoc({ name: 'Neu', progressRow: 3 });
    a.updateSettings({ workedIn: 'rounds' });
    expect(a.state.doc.name).toBe('Neu');
    expect(a.state.doc.settings.workedIn).toBe('rounds');
    expect(a.state.past.length).toBe(0);
    expect(a.snapshot().grid).toBe(a.state.committed);
  });
});

describe('review regressions', () => {
  it('commits a floating clip when a colour is picked (no corrupted indices)', () => {
    const a = setup();
    const src = createDoc({ name: 'S', width: 2, height: 1, palette: [{ hex: '#000000', name: '' }, { hex: '#00ff00', name: '' }] }).grid;
    src.colors.set([1, 1]);
    const clip = extractClip(src, { x: 0, y: 0, width: 2, height: 1 });
    a.setTool('select');
    const draft = a.beginStroke();
    const map = mapClipColors(draft, clip);
    a.setFloating({ clip, x: 0, y: 0, colorMap: map, lifted: false });
    a.selectColor(1);
    expect(a.state.floating).toBeNull();
    expect(a.state.tool).toBe('pencil');
    const g = a.state.committed;
    for (const c of g.colors) expect(c).toBeLessThan(g.palette.length);
    expect(g.palette.some((p) => p.hex === '#00ff00')).toBe(true);
  });

  it('clamps the active colour when a draft with new colours is discarded', () => {
    const a = setup();
    const draft = a.beginStroke();
    draft.palette.push({ hex: '#123123', name: '' });
    a.store.setState({ activeColor: draft.palette.length - 1 });
    a.cancelStroke();
    expect(a.state.activeColor).toBeLessThan(a.state.committed.palette.length);
  });

  it('deleting a lifted selection keeps the source cleared', async () => {
    const { clearSelection } = await import('../src/editor/commands');
    const a = setup(4, 1);
    a.apply((g) => {
      g.colors.set([2, 1, 0, 0]);
    });
    const sel = { x: 0, y: 0, width: 2, height: 1 };
    const clip = extractClip(a.state.committed, sel);
    const draft = a.beginStroke();
    draft.colors[0] = 0;
    draft.colors[1] = 0;
    a.setFloating({ clip, x: 1, y: 0, colorMap: Uint8Array.from([0, 1, 2, 3]), lifted: true });
    clearSelection(a);
    expect(a.state.floating).toBeNull();
    expect(Array.from(a.state.committed.colors)).toEqual([0, 0, 0, 0]);
  });

  it('cancels a pasted clip on cut without adding an undo step', async () => {
    const { cutSelection } = await import('../src/editor/commands');
    const a = setup();
    const src = createDoc({ name: 'S', width: 1, height: 1, palette: [{ hex: '#abcdef', name: '' }] }).grid;
    const clip = extractClip(src, { x: 0, y: 0, width: 1, height: 1 });
    const draft = a.beginStroke();
    const map = mapClipColors(draft, clip);
    a.setFloating({ clip, x: 0, y: 0, colorMap: map, lifted: false });
    const before = a.state.past.length;
    cutSelection(a);
    expect(a.state.past.length).toBe(before);
    expect(a.state.committed.palette.some((p) => p.hex === '#abcdef')).toBe(false);
  });
});
