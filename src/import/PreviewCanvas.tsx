import { useEffect, useRef, useState } from 'react';
import type { ChartGrid, Rect } from '../model/types';
import { buildCellBitmap } from '../render/chartRender';
import { buildKnitBitmap } from '../render/knitPreview';
import type { SourceImage } from '../image/converter';

interface Props {
  grid: ChartGrid | null;
  /** Kästchenhöhe / -breite */
  aspect: number;
  mode: 'chart' | 'knitted' | 'original';
  source: SourceImage;
  crop: Rect;
}

/** Vorschau im Import-Dialog: Raster, gestrickte Ansicht oder Originalausschnitt – passend eingepasst. */
export function PreviewCanvas({ grid, aspect, mode, source, crop }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !box.w || !box.h) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    if (mode === 'original' || !grid) {
      const scale = Math.min(box.w / crop.width, box.h / crop.height);
      const w = Math.max(1, Math.floor(crop.width * scale));
      const h = Math.max(1, Math.floor(crop.height * scale));
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(source.canvas, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h);
      return;
    }
    const cell = Math.min(box.w / grid.width, box.h / (grid.height * aspect));
    const w = Math.max(1, Math.floor(grid.width * cell));
    const h = Math.max(1, Math.floor(grid.height * cell * aspect));
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (mode === 'knitted') {
      const kb = buildKnitBitmap(grid, aspect, 4_000_000);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(kb as CanvasImageSource, 0, 0, w, h);
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buildCellBitmap(grid) as CanvasImageSource, 0, 0, w, h);
    const cw = w / grid.width;
    const ch = h / grid.height;
    if (cw >= 4) {
      ctx.strokeStyle = 'rgba(48,40,36,0.22)';
      ctx.lineWidth = 1 / dpr;
      ctx.beginPath();
      for (let x = 1; x < grid.width; x++) {
        const px = Math.round(x * cw * dpr) / dpr;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
      }
      for (let y = 1; y < grid.height; y++) {
        const py = Math.round(y * ch * dpr) / dpr;
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
      }
      ctx.stroke();
      // dicke Linie alle 10 Maschen (von rechts unten gezählt)
      ctx.strokeStyle = 'rgba(30,24,22,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = grid.width - 10; x > 0; x -= 10) {
        const px = Math.round(x * cw);
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
      }
      for (let y = grid.height - 10; y > 0; y -= 10) {
        const py = Math.round(y * ch);
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
      }
      ctx.stroke();
    }
  }, [grid, aspect, mode, source, crop, box]);

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: '8px 16px 16px', display: 'grid', placeItems: 'center' }}>
      <canvas ref={canvasRef} className="preview-canvas" />
    </div>
  );
}
