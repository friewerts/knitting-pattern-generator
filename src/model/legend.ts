import type { ChartGrid } from './types';
import { colorCounts, symbolCounts } from './grid';
import { ACTIONS, symbolName, symbolPart, type Lang } from './stitches';

export interface LegendData {
  colors: { index: number; hex: string; name: string; count: number }[];
  symbols: { code: number; name: string; rs: string; ws: string; count: number; width: number }[];
}

/** Verwendete Farben und Symbole mit Anzahl und Erklärung. */
export function legendData(grid: ChartGrid, lang: Lang): LegendData {
  const counts = colorCounts(grid);
  const colors = grid.palette
    .map((p, index) => ({ index, hex: p.hex, name: p.name, count: counts[index] ?? 0 }))
    .filter((c) => c.count > 0);
  const sc = symbolCounts(grid);
  const symbols = [...sc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([code, count]) => {
      const s = symbolPart(code).symbol;
      return {
        code,
        count,
        width: s.width,
        name: symbolName(s, lang),
        rs: ACTIONS[s.rs][lang].long,
        ws: ACTIONS[s.ws][lang].long,
      };
    });
  return { colors, symbols };
}
