import { describe, expect, it } from 'vitest';
import { ACTIONS, SYMBOLS, mirrorCode, symbolByKey, symbolPart, SYMBOL_NAMES } from '../src/model/stitches';

describe('stitch symbols', () => {
  it('have unique, stable codes and complete metadata', () => {
    const codes = new Set<number>();
    for (const s of SYMBOLS) {
      for (let p = 0; p < s.width; p++) {
        expect(codes.has(s.code + p)).toBe(false);
        codes.add(s.code + p);
      }
      expect(symbolByKey(s.mirror)?.width).toBe(s.width);
      expect(ACTIONS[s.rs]).toBeDefined();
      expect(ACTIONS[s.ws]).toBeDefined();
      expect(SYMBOL_NAMES[s.key]).toBeDefined();
    }
    // Stabile Codes, die in gespeicherten Mustern verwendet werden
    expect(symbolByKey('purl')!.code).toBe(1);
    expect(symbolByKey('c22rc')!.code).toBe(36);
  });

  it('mirrors codes symmetrically', () => {
    for (const s of SYMBOLS) {
      for (let p = 0; p < s.width; p++) {
        expect(mirrorCode(mirrorCode(s.code + p))).toBe(s.code + p);
      }
    }
    expect(symbolPart(39)).toMatchObject({ part: 3 });
    expect(symbolPart(200).symbol.key).toBe('knit');
  });
});
