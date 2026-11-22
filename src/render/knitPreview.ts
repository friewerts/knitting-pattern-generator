import type { ChartGrid } from '../model/types';
import { hexToRgb, rgbToHex, type RGB } from '../model/color';
import { symbolPart } from '../model/stitches';
import { createCanvas, ctx2d, type AnyCanvas } from './chartRender';

function shade([r, g, b]: RGB, f: number): string {
  // f < 1 dunkler, f > 1 heller (Richtung Weiß)
  if (f <= 1) return rgbToHex([r * f, g * f, b * f]);
  const t = f - 1;
  return rgbToHex([r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t]);
}

function stitchSprite(hex: string, sw: number, sh: number, purl: boolean): AnyCanvas {
  const ext = Math.round(sh * 0.45);
  const c = createCanvas(sw, sh + ext);
  const ctx = ctx2d(c);
  const rgb = hexToRgb(hex);
  const base = hex;
  const dark = shade(rgb, 0.62);
  const light = shade(rgb, 1.22);
  if (purl) {
    // Linke Masche: quer liegende Bögen
    const cy = ext + sh * 0.5;
    const g = ctx.createLinearGradient(0, cy - sh * 0.45, 0, cy + sh * 0.45);
    g.addColorStop(0, light);
    g.addColorStop(0.55, base);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(sw * 0.5, cy, sw * 0.56, sh * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(0.5, sw * 0.04);
    ctx.stroke();
    return c;
  }
  const petal = (cx: number, angle: number) => {
    const cy = ext + sh * 0.44;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const rx = sw * 0.25;
    const ry = (sh + ext) * 0.5;
    const g = ctx.createLinearGradient(-rx, -ry, rx, ry);
    g.addColorStop(0, light);
    g.addColorStop(0.5, base);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(0.5, sw * 0.035);
    ctx.stroke();
    ctx.restore();
  };
  petal(sw * 0.29, -0.42);
  petal(sw * 0.71, 0.42);
  return c;
}

/**
 * Rendert eine Vorschau, wie das Strickstück aussehen könnte (jede rechte Masche als „V“).
 * Gibt eine Bitmap mit stitchPx Pixeln je Masche zurück.
 */
export function buildKnitBitmap(grid: ChartGrid, aspect: number, maxPixels = 8_000_000): AnyCanvas {
  const area = grid.width * grid.height * aspect;
  const sw = Math.max(4, Math.min(18, Math.floor(Math.sqrt(maxPixels / Math.max(1, area)))));
  const sh = Math.max(3, Math.round(sw * aspect));
  const canvas = createCanvas(grid.width * sw, grid.height * sh);
  const ctx = ctx2d(canvas);
  // Schattenfarbe zwischen den Maschen
  ctx.fillStyle = '#2a2420';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const sprites = new Map<string, AnyCanvas>();
  const ext = Math.round(sh * 0.45);
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const i = y * grid.width + x;
      const code = grid.symbols[i];
      const sym = symbolPart(code).symbol;
      if (sym.noStitch) {
        ctx.fillStyle = '#d9d4ce';
        ctx.fillRect(x * sw, y * sh, sw, sh);
        continue;
      }
      const hex = grid.palette[grid.colors[i]]?.hex ?? '#ffffff';
      const purl = sym.key === 'purl' || sym.key === 'bobble';
      const key = `${hex}|${purl ? 1 : 0}`;
      let sprite = sprites.get(key);
      if (!sprite) {
        sprite = stitchSprite(hex, sw, sh, purl);
        sprites.set(key, sprite);
      }
      ctx.drawImage(sprite as CanvasImageSource, x * sw, y * sh - ext);
    }
  }
  return canvas;
}
