import { useEffect, useRef, useState } from 'react';
import type { Rect } from '../model/types';

type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

interface Props {
  url: string;
  imgW: number;
  imgH: number;
  crop: Rect;
  /** Seitenverhältnis Höhe/Breite in Bildpixeln, oder null für frei */
  aspect: number | null;
  onChange: (r: Rect) => void;
  label: string;
}

const MIN = 8;

/** Bild mit verschiebbarem und skalierbarem Zuschneide-Rahmen (Maus und Touch). */
export function CropBox({ url, imgW, imgH, crop, aspect, onChange, label }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [disp, setDisp] = useState({ w: 0, h: 0 });
  const drag = useRef<{ handle: Handle; x: number; y: number; start: Rect; id: number } | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const update = () => setDisp({ w: img.clientWidth, h: img.clientHeight });
    const ro = new ResizeObserver(update);
    ro.observe(img);
    update();
    return () => ro.disconnect();
  }, [url]);

  const scale = disp.w ? disp.w / imgW : 1;

  const onPointerDown = (handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { handle, x: e.clientX, y: e.clientY, start: { ...crop }, id: e.pointerId };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = (e.clientX - d.x) / scale;
    const dy = (e.clientY - d.y) / scale;
    const s = d.start;
    let r: Rect;
    if (d.handle === 'move') {
      r = {
        ...s,
        x: Math.max(0, Math.min(imgW - s.width, s.x + dx)),
        y: Math.max(0, Math.min(imgH - s.height, s.y + dy)),
      };
    } else {
      // Fester Gegenpunkt
      const right = s.x + s.width;
      const bottom = s.y + s.height;
      const ax = d.handle === 'nw' || d.handle === 'sw' ? right : s.x;
      const ay = d.handle === 'nw' || d.handle === 'ne' ? bottom : s.y;
      let px = (d.handle === 'nw' || d.handle === 'sw' ? s.x : right) + dx;
      let py = (d.handle === 'nw' || d.handle === 'ne' ? s.y : bottom) + dy;
      px = Math.max(0, Math.min(imgW, px));
      py = Math.max(0, Math.min(imgH, py));
      let w = Math.max(MIN, Math.abs(px - ax));
      let h = Math.max(MIN, Math.abs(py - ay));
      const signX = d.handle === 'nw' || d.handle === 'sw' ? -1 : 1;
      const signY = d.handle === 'nw' || d.handle === 'ne' ? -1 : 1;
      if (aspect) {
        // Breite führt, Höhe folgt – begrenzt auf das Bild
        h = w * aspect;
        const maxH = signY < 0 ? ay : imgH - ay;
        const maxW = signX < 0 ? ax : imgW - ax;
        if (h > maxH) {
          h = maxH;
          w = h / aspect;
        }
        if (w > maxW) {
          w = maxW;
          h = w * aspect;
        }
      } else {
        w = Math.min(w, signX < 0 ? ax : imgW - ax);
        h = Math.min(h, signY < 0 ? ay : imgH - ay);
      }
      r = {
        x: signX < 0 ? ax - w : ax,
        y: signY < 0 ? ay - h : ay,
        width: w,
        height: h,
      };
    }
    onChange(roundRect(r, imgW, imgH));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  const fx = crop.x * scale;
  const fy = crop.y * scale;
  const fw = crop.width * scale;
  const fh = crop.height * scale;

  return (
    <div className="crop-box" ref={wrapRef} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-label={label}>
      <img ref={imgRef} src={url} alt="" draggable={false} onLoad={() => imgRef.current && setDisp({ w: imgRef.current.clientWidth, h: imgRef.current.clientHeight })} />
      {disp.w > 0 && (
        <>
          <div className="crop-shade" style={{ left: 0, top: 0, width: disp.w, height: fy }} />
          <div className="crop-shade" style={{ left: 0, top: fy + fh, width: disp.w, height: Math.max(0, disp.h - fy - fh) }} />
          <div className="crop-shade" style={{ left: 0, top: fy, width: fx, height: fh }} />
          <div className="crop-shade" style={{ left: fx + fw, top: fy, width: Math.max(0, disp.w - fx - fw), height: fh }} />
          <div className="crop-frame" style={{ left: fx, top: fy, width: fw, height: fh }} onPointerDown={onPointerDown('move')} />
          {(['nw', 'ne', 'sw', 'se'] as Handle[]).map((h) => (
            <div
              key={h}
              className={`crop-handle ${h}`}
              style={{ left: h === 'nw' || h === 'sw' ? fx : fx + fw, top: h === 'nw' || h === 'ne' ? fy : fy + fh }}
              onPointerDown={onPointerDown(h)}
            />
          ))}
        </>
      )}
    </div>
  );
}

function roundRect(r: Rect, imgW: number, imgH: number): Rect {
  const x = Math.max(0, Math.round(r.x));
  const y = Math.max(0, Math.round(r.y));
  return {
    x,
    y,
    width: Math.max(1, Math.min(imgW - x, Math.round(r.width))),
    height: Math.max(1, Math.min(imgH - y, Math.round(r.height))),
  };
}

/** Größter Ausschnitt mit Seitenverhältnis (Höhe/Breite) um den Mittelpunkt des bisherigen Ausschnitts. */
export function fitCropToAspect(crop: Rect, imgW: number, imgH: number, aspect: number): Rect {
  const area = Math.max(crop.width * crop.height, imgW * imgH * 0.15);
  let w = Math.sqrt(area / aspect);
  let h = w * aspect;
  if (w > imgW) {
    w = imgW;
    h = w * aspect;
  }
  if (h > imgH) {
    h = imgH;
    w = h / aspect;
  }
  const cx = crop.x + crop.width / 2;
  const cy = crop.y + crop.height / 2;
  const x = Math.max(0, Math.min(imgW - w, cx - w / 2));
  const y = Math.max(0, Math.min(imgH - h, cy - h / 2));
  return roundRect({ x, y, width: w, height: h }, imgW, imgH);
}
