import { convertPrepared, prepareSource, supersample, type ConvertParams, type ConvertResult, type PreparedSource } from './quantize';
import type { ConvertRequest, ConvertResponse } from './protocol';
import type { Rect } from '../model/types';

export interface SourceImage {
  /** Bildquelle (bereits auf max. 2048 px verkleinert) */
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  name: string;
  /** Objekt-URL für die Anzeige */
  url: string;
}

const MAX_SOURCE = 2048;

/** Lädt eine Bilddatei und verkleinert sie bei Bedarf. */
export async function loadImageFile(file: Blob, name = 'Bild'): Promise<SourceImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = url;
    });
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    if (!w0 || !h0) throw new Error('decode');
    const scale = Math.min(1, MAX_SOURCE / Math.max(w0, h0));
    const width = Math.max(1, Math.round(w0 * scale));
    const height = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    return { canvas, width, height, name, url };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/** Rendert den Bildausschnitt in der für das Raster benötigten Auflösung. */
export function renderCrop(src: SourceImage, crop: Rect, gridW: number, gridH: number): ImageData {
  const s = supersample(gridW, gridH, crop.width);
  const w = gridW * s;
  const h = gridH * s;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src.canvas, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

interface Pending {
  resolve: (r: ConvertResult | null) => void;
  reject: (e: Error) => void;
  req: ConvertRequest;
  getPixels: () => ImageData;
}

/** Führt die Umwandlung im Web Worker aus (mit Fallback im Hauptthread). */
export class ImageConverter {
  private worker: Worker | null = null;
  private nextId = 1;
  private latestId = 0;
  private pending = new Map<number, Pending>();
  private sentKey = '';
  // Fallback-Cache
  private localKey = '';
  private localSource: PreparedSource | null = null;

  constructor() {
    try {
      this.worker = new Worker(new URL('./convert.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<ConvertResponse>) => this.onMessage(e.data);
      this.worker.onerror = () => {
        this.worker?.terminate();
        this.worker = null;
        // offene Anfragen lokal neu ausführen
        for (const [id, p] of this.pending) {
          this.pending.delete(id);
          this.runLocal(p.req, p.getPixels).then(p.resolve, p.reject);
        }
      };
    } catch {
      this.worker = null;
    }
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }

  /** Liefert null, wenn die Anfrage durch eine neuere überholt wurde. */
  convert(sourceKey: string, getPixels: () => ImageData, params: ConvertParams): Promise<ConvertResult | null> {
    const id = this.nextId++;
    this.latestId = id;
    const req: ConvertRequest = { id, sourceKey, params };
    if (!this.worker) {
      return this.runLocal(req, getPixels).then((r) => (id === this.latestId ? r : null));
    }
    return new Promise((resolve, reject) => {
      // Ältere, noch offene Anfragen verwerfen
      for (const [oldId, p] of this.pending) {
        if (oldId < id) {
          p.resolve(null);
          this.pending.delete(oldId);
        }
      }
      this.pending.set(id, { resolve, reject, req, getPixels });
      this.send(req, getPixels, sourceKey !== this.sentKey);
    });
  }

  private send(req: ConvertRequest, getPixels: () => ImageData, withPixels: boolean) {
    if (!this.worker) return;
    if (withPixels) {
      const img = getPixels();
      const buffer = img.data.buffer as ArrayBuffer;
      this.worker.postMessage({ ...req, pixels: { buffer, width: img.width, height: img.height } }, [buffer]);
      this.sentKey = req.sourceKey;
    } else {
      this.worker.postMessage(req);
    }
  }

  private onMessage(msg: ConvertResponse) {
    const p = this.pending.get(msg.id);
    if (!p) return;
    if (msg.type === 'need-pixels') {
      this.send(p.req, p.getPixels, true);
      return;
    }
    this.pending.delete(msg.id);
    if (msg.type === 'error') p.reject(new Error(msg.message));
    else p.resolve(msg.id === this.latestId ? msg.result : null);
  }

  private async runLocal(req: ConvertRequest, getPixels: () => ImageData): Promise<ConvertResult> {
    if (!this.localSource || this.localKey !== req.sourceKey) {
      const img = getPixels();
      this.localSource = prepareSource(img.data, img.width, img.height, req.params.gridW, req.params.gridH);
      this.localKey = req.sourceKey;
    }
    return convertPrepared(this.localSource, req.params);
  }
}
