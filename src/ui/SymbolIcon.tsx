import { useEffect, useRef } from 'react';
import { drawSymbolPart, symbolPart } from '../model/stitches';
import { inkFor } from '../model/color';

interface Props {
  code: number;
  /** Kästchengröße in CSS-Pixeln */
  size?: number;
  bg?: string;
  aspect?: number;
  border?: boolean;
}

/** Zeichnet ein Strickschrift-Symbol (auch mehrteilige Zöpfe) als kleines Kästchen. */
export function SymbolIcon({ code, size = 26, bg = '#ffffff', aspect = 1, border = true }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { symbol } = symbolPart(code);
  const w = size * symbol.width;
  const h = Math.round(size * aspect);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < symbol.width; k++) {
      drawSymbolPart(ctx, symbol.code + k, k * size, 0, size, h, inkFor(bg), bg);
    }
    if (border) {
      ctx.strokeStyle = 'rgba(48,40,36,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      if (symbol.width > 1) {
        ctx.strokeStyle = 'rgba(48,40,36,0.15)';
        ctx.beginPath();
        for (let k = 1; k < symbol.width; k++) {
          ctx.moveTo(k * size + 0.5, 0);
          ctx.lineTo(k * size + 0.5, h);
        }
        ctx.stroke();
      }
    }
  }, [code, size, bg, w, h, symbol, border]);
  return <canvas ref={ref} style={{ width: w, height: h }} aria-hidden />;
}
