export type RGB = [number, number, number];
export type Lab = [number, number, number];

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  const to = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function isHexColor(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

export function normalizeHex(s: string): string {
  return rgbToHex(hexToRgb(s));
}

const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function srgbToLinear8(v: number): number {
  return SRGB_TO_LINEAR[clamp(Math.round(v), 0, 255)];
}

export function srgbToLinear(c: number): number {
  // c in 0..1
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return clamp(v, 0, 1);
}

/** Lineares RGB (0..1) → OKLab */
export function linearRgbToOklab(r: number, g: number, b: number): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab → lineares RGB (0..1, nicht geklemmt) */
export function oklabToLinearRgb(L: number, a: number, b: number): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function rgbToOklab([r, g, b]: RGB): Lab {
  return linearRgbToOklab(srgbToLinear8(r), srgbToLinear8(g), srgbToLinear8(b));
}

export function oklabToRgb([L, a, b]: Lab): RGB {
  const [r, g, bl] = oklabToLinearRgb(L, a, b);
  return [linearToSrgb(r) * 255, linearToSrgb(g) * 255, linearToSrgb(bl) * 255];
}

export function hexToOklab(hex: string): Lab {
  return rgbToOklab(hexToRgb(hex));
}

export function oklabToHex(lab: Lab): string {
  return rgbToHex(oklabToRgb(lab));
}

export function labDistSq(a: Lab, b: Lab): number {
  const dL = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return dL * dL + da * da + db * db;
}

/** Relative Leuchtdichte nach WCAG (0..1) */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * srgbToLinear8(r) + 0.7152 * srgbToLinear8(g) + 0.0722 * srgbToLinear8(b);
}

/** Gut lesbare Zeichenfarbe (dunkel oder hell) für Symbole auf der gegebenen Hintergrundfarbe. */
export function inkFor(hex: string): string {
  return relativeLuminance(hex) > 0.36 ? '#1c1917' : '#ffffff';
}

/** Buchstabe für Palettenindex: 0 → A, 25 → Z, 26 → AA … */
export function colorLetter(index: number): string {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** Vorschlagsfarben (typische Garnfarben) für den Farbwähler. */
export const SUGGESTED_COLORS: { hex: string; de: string; en: string }[] = [
  { hex: '#ffffff', de: 'Weiß', en: 'White' },
  { hex: '#f4ede1', de: 'Natur', en: 'Natural' },
  { hex: '#d9c7a7', de: 'Sand', en: 'Sand' },
  { hex: '#9a8f86', de: 'Grau', en: 'Grey' },
  { hex: '#4a4a4f', de: 'Anthrazit', en: 'Charcoal' },
  { hex: '#1f1d22', de: 'Schwarz', en: 'Black' },
  { hex: '#f2b8c6', de: 'Rosa', en: 'Pink' },
  { hex: '#b23a5e', de: 'Beere', en: 'Berry' },
  { hex: '#c0392b', de: 'Rot', en: 'Red' },
  { hex: '#7b2d26', de: 'Weinrot', en: 'Burgundy' },
  { hex: '#e67e22', de: 'Orange', en: 'Orange' },
  { hex: '#d9a521', de: 'Senf', en: 'Mustard' },
  { hex: '#f3e37c', de: 'Zitrone', en: 'Lemon' },
  { hex: '#8db86b', de: 'Hellgrün', en: 'Light green' },
  { hex: '#2f6b3f', de: 'Tannengrün', en: 'Forest green' },
  { hex: '#1f6f78', de: 'Petrol', en: 'Teal' },
  { hex: '#8ec5e8', de: 'Hellblau', en: 'Light blue' },
  { hex: '#2b5ca8', de: 'Blau', en: 'Blue' },
  { hex: '#1d2b4f', de: 'Marine', en: 'Navy' },
  { hex: '#7d5ba6', de: 'Lila', en: 'Purple' },
  { hex: '#8b5a3c', de: 'Braun', en: 'Brown' },
];
