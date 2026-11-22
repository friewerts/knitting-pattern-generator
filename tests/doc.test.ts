import { describe, expect, it } from 'vitest';
import { createDoc, decodeRLE, deserializeDoc, encodeRLE, parseChartFile, backupFile, safeFileName, serializeDoc, ImportError, finishedSize } from '../src/model/doc';
import { setSymbol } from '../src/model/grid';

describe('serialization', () => {
  it('round-trips RLE', () => {
    const data = new Uint8Array(1000);
    data.fill(3, 10, 700);
    data[999] = 9;
    expect(Array.from(decodeRLE(encodeRLE(data), data.length))).toEqual(Array.from(data));
  });

  it('round-trips a document', () => {
    const doc = createDoc({ name: 'Mütze', width: 20, height: 10 });
    doc.grid.colors[5] = 2;
    setSymbol(doc.grid, 3, 3, 36);
    doc.settings.workedIn = 'rounds';
    doc.progressRow = 4;
    const json = JSON.stringify(serializeDoc(doc));
    const back = parseChartFile(json)[0];
    expect(back.name).toBe('Mütze');
    expect(back.grid.width).toBe(20);
    expect(Array.from(back.grid.colors)).toEqual(Array.from(doc.grid.colors));
    expect(Array.from(back.grid.symbols)).toEqual(Array.from(doc.grid.symbols));
    expect(back.settings.workedIn).toBe('rounds');
    expect(back.progressRow).toBe(4);
  });

  it('reads backups with several charts', () => {
    const a = createDoc({ name: 'A', width: 2, height: 2 });
    const b = createDoc({ name: 'B', width: 3, height: 1 });
    const docs = parseChartFile(JSON.stringify(backupFile([a, b])));
    expect(docs.map((d) => d.name)).toEqual(['A', 'B']);
  });

  it('rejects invalid files', () => {
    expect(() => parseChartFile('nope')).toThrow(ImportError);
    expect(() => parseChartFile('{"format":"other"}')).toThrow(ImportError);
    expect(() => deserializeDoc({ format: 'maschenwerk-chart', width: 0, height: 2 })).toThrow(ImportError);
  });

  it('sanitizes values', () => {
    const doc = createDoc({ name: 'X', width: 2, height: 2 });
    const s = serializeDoc(doc) as unknown as Record<string, unknown>;
    s.palette = [{ hex: 'red', name: 5 }];
    s.symbols = encodeRLE(Uint8Array.from([250, 1, 0, 0]));
    s.colors = encodeRLE(Uint8Array.from([0, 7, 0, 0]));
    const back = deserializeDoc(s);
    expect(back.grid.palette[0].hex).toBe('#000000');
    expect(back.grid.symbols[0]).toBe(0);
    expect(back.grid.symbols[1]).toBe(1);
    expect(back.grid.colors[1]).toBe(0);
  });

  it('computes file names and sizes', () => {
    expect(safeFileName('Mütze für Oma / Winter!')).toBe('Mütze-für-Oma-Winter');
    expect(safeFileName('???')).toBe('muster');
    const size = finishedSize({ width: 22, height: 30 }, { gaugeStitches: 22, gaugeRows: 30, cellShape: 'square', workedIn: 'rows', firstRowRS: true, highlightEvery: 10 });
    expect(size.width).toBeCloseTo(10);
    expect(size.height).toBeCloseTo(10);
  });
});

describe('review regressions (doc)', () => {
  it('keeps the finished knitting state on import', () => {
    const doc = createDoc({ name: 'Fertig', width: 3, height: 4 });
    doc.progressRow = 5;
    const back = parseChartFile(JSON.stringify(serializeDoc(doc)))[0];
    expect(back.progressRow).toBe(5);
  });
});
