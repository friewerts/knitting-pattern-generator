import type { ConvertParams, ConvertResult } from './quantize';

export interface ConvertRequest {
  id: number;
  /** Kennung für Bildausschnitt + Rastergröße; bei gleicher Kennung nutzt der Worker seinen Cache */
  sourceKey: string;
  pixels?: { buffer: ArrayBuffer; width: number; height: number };
  params: ConvertParams;
}

export type ConvertResponse =
  | { type: 'result'; id: number; result: ConvertResult }
  | { type: 'need-pixels'; id: number }
  | { type: 'error'; id: number; message: string };
