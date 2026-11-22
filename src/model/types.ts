/** Ein Eintrag der Farbpalette eines Musters (z. B. ein Garn). */
export interface PaletteEntry {
  /** Farbe als '#rrggbb' */
  hex: string;
  /** Optionaler Name, z. B. Garnbezeichnung */
  name: string;
}

/**
 * Das eigentliche Maschenraster.
 * Zeilen werden von oben nach unten gespeichert (y = 0 ist die oberste Reihe,
 * also die Reihe mit der höchsten Nummer). x = 0 ist die linke Spalte.
 */
export interface ChartGrid {
  width: number;
  height: number;
  /** Palettenindex je Masche (width * height) */
  colors: Uint8Array;
  /** Symbolcode je Masche (0 = rechte Masche / kein Symbol) */
  symbols: Uint8Array;
  palette: PaletteEntry[];
}

export type WorkedIn = 'rows' | 'rounds';
export type CellShape = 'square' | 'gauge';

export interface ChartSettings {
  /** Maschen auf 10 cm */
  gaugeStitches: number;
  /** Reihen auf 10 cm */
  gaugeRows: number;
  /** Darstellung der Kästchen: quadratisch oder proportional zur Maschenprobe */
  cellShape: CellShape;
  /** In Reihen (hin und zurück) oder in Runden gestrickt */
  workedIn: WorkedIn;
  /** true: Reihe 1 ist eine Hinreihe */
  firstRowRS: boolean;
  /** Abstand der dicken Hilfslinien (0 = aus) */
  highlightEvery: number;
}

export interface ChartDoc {
  format: 'maschenwerk-chart';
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  grid: ChartGrid;
  settings: ChartSettings;
  /** Strickmodus: aktuelle Reihe (1-basiert), 0 = noch nicht begonnen */
  progressRow: number;
  notes: string;
}

/** Metadaten für die Musterübersicht (ohne Rasterdaten). */
export interface ChartMeta {
  id: string;
  name: string;
  width: number;
  height: number;
  colorCount: number;
  createdAt: number;
  updatedAt: number;
  /** Vorschaubild als PNG-Data-URL */
  thumbnail: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Ausschnitt aus einem Raster (Zwischenablage). */
export interface Clip {
  width: number;
  height: number;
  colors: Uint8Array;
  symbols: Uint8Array;
  /** Farben des Quellmusters, damit beim Einfügen in andere Muster zugeordnet werden kann */
  palette: PaletteEntry[];
}

export const DEFAULT_SETTINGS: ChartSettings = {
  gaugeStitches: 22,
  gaugeRows: 30,
  cellShape: 'square',
  workedIn: 'rows',
  firstRowRS: true,
  highlightEvery: 10,
};

export const MAX_PALETTE = 32;
export const MAX_SIZE = 500;
export const MIN_SIZE = 1;
