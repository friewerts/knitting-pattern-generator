import { convertPrepared, prepareSource, type PreparedSource } from './quantize';
import type { ConvertRequest, ConvertResponse } from './protocol';

let cacheKey = '';
let cache: PreparedSource | null = null;

self.onmessage = (e: MessageEvent<ConvertRequest>) => {
  const req = e.data;
  try {
    if (req.pixels) {
      cache = prepareSource(new Uint8ClampedArray(req.pixels.buffer), req.pixels.width, req.pixels.height, req.params.gridW, req.params.gridH);
      cacheKey = req.sourceKey;
    }
    if (!cache || cacheKey !== req.sourceKey) {
      post({ type: 'need-pixels', id: req.id });
      return;
    }
    const result = convertPrepared(cache, req.params);
    post({ type: 'result', id: req.id, result }, [result.indices.buffer as ArrayBuffer]);
  } catch (err) {
    post({ type: 'error', id: req.id, message: err instanceof Error ? err.message : String(err) });
  }
};

function post(msg: ConvertResponse, transfer: Transferable[] = []) {
  (self as unknown as { postMessage(m: unknown, t: Transferable[]): void }).postMessage(msg, transfer);
}
