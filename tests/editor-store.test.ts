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
    a.setFloating({ clip, x: 1, y: 1, colorMap: map });
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
    a.setFloating({ clip, x: 0, y: 0, colorMap: map });
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
    a.setFloating({ clip, x: 0, y: 0, colorMap: Uint8Array.from([0, 1, 2, 3]) });
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
