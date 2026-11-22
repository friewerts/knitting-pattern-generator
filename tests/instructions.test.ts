import { describe, expect, it } from 'vitest';
import { createGrid, setSymbol } from '../src/model/grid';
import { DEFAULT_SETTINGS, type ChartSettings } from '../src/model/types';
import { findPeriod, formatRow, instructionsText, rowInstruction, rowSide } from '../src/model/instructions';
import { symbolByKey } from '../src/model/stitches';

const code = (key: string) => symbolByKey(key)!.code;
const flat: ChartSettings = { ...DEFAULT_SETTINGS, workedIn: 'rows', firstRowRS: true };
const round: ChartSettings = { ...DEFAULT_SETTINGS, workedIn: 'rounds' };

describe('written instructions', () => {
  it('determines row sides', () => {
    expect(rowSide(1, flat)).toBe('rs');
    expect(rowSide(2, flat)).toBe('ws');
    expect(rowSide(1, { ...flat, firstRowRS: false })).toBe('ws');
    expect(rowSide(7, round)).toBe('round');
  });

  it('reads RS rows right to left and WS rows left to right', () => {
    const g = createGrid(4, 2);
    // unterste Reihe (Reihe 1) ist y = 1
    setSymbol(g, 0, 1, code('k2tog'));
    setSymbol(g, 3, 1, code('yo'));
    const r1 = rowInstruction(g, flat, 1);
    expect(formatRow(r1, 'en', false)).toBe('Row 1 (RS): yo, k2, k2tog (4 sts)');
    expect(r1.stitchesBefore).toBe(4);
    expect(r1.stitchesAfter).toBe(4);
    setSymbol(g, 0, 0, code('purl'));
    const r2 = rowInstruction(g, flat, 2);
    expect(formatRow(r2, 'en', false)).toBe('Row 2 (WS): k1, p3 (4 sts)');
    expect(formatRow(r2, 'de', false)).toBe('R 2 (Rückr.): 1 re, 3 li (4 M)');
  });

  it('groups colorwork by colour changes', () => {
    const g = createGrid(5, 1);
    g.colors.set([1, 1, 0, 0, 0]);
    const r = rowInstruction(g, round, 1);
    expect(formatRow(r, 'en', true)).toBe('Rnd 1: A: k3 · B: k2 (5 sts)');
    expect(formatRow(r, 'de', true)).toBe('Rd. 1: A: 3 re · B: 2 re (5 M)');
  });

  it('compresses repeats', () => {
    const g = createGrid(9, 1);
    g.colors.set([0, 1, 1, 0, 1, 1, 0, 1, 1]);
    const r = rowInstruction(g, round, 1);
    expect(formatRow(r, 'en', true)).toBe('Rnd 1: [B: k2 · A: k1] 3 times (9 sts)');
    expect(findPeriod(['a', 'b', 'a', 'b', 'a'])).toBe(2);
    expect(findPeriod(['a', 'a', 'a'])).toBe(0);
    expect(findPeriod(['a', 'b', 'c'])).toBe(0);
  });

  it('handles cables, no-stitch cells and stitch counts', () => {
    const g = createGrid(6, 1);
    setSymbol(g, 1, 0, code('c22lc'));
    setSymbol(g, 0, 0, code('nostitch'));
    setSymbol(g, 5, 0, code('m1r'));
    const r = rowInstruction(g, flat, 1);
    expect(formatRow(r, 'en', false)).toBe('Row 1 (RS): M1R, 2/2 LC (5 sts)');
    expect(r.stitchesBefore).toBe(4);
  });

  it('flags broken multi-cell symbols', () => {
    const g = createGrid(3, 1);
    g.symbols[1] = code('c11rc'); // nur erster Teil
    const r = rowInstruction(g, flat, 1);
    expect(r.hasBroken).toBe(true);
    expect(formatRow(r, 'en', false)).toContain('incomplete');
  });

  it('builds a full text', () => {
    const g = createGrid(2, 2);
    g.colors[0] = 1;
    const text = instructionsText(g, flat, 'de', 'Test');
    expect(text).toContain('Anschlag: 2 M');
    expect(text).toContain('R 1 (Hinr.)');
    expect(text).toContain('R 2 (Rückr.)');
    expect(text).toContain('A =');
  });
});
