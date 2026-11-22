import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ChartDoc, ChartMeta } from '../model/types';
import { newId } from '../model/doc';
import { cloneGrid } from '../model/grid';

interface KnitDB extends DBSchema {
  charts: { key: string; value: ChartDoc };
  meta: { key: string; value: ChartMeta; indexes: { 'by-updated': number } };
}

export interface ChartStore {
  list(): Promise<ChartMeta[]>;
  get(id: string): Promise<ChartDoc | undefined>;
  getAll(): Promise<ChartDoc[]>;
  save(doc: ChartDoc, thumbnail: string): Promise<void>;
  remove(id: string): Promise<void>;
  /** true, wenn dauerhaft gespeichert wird (IndexedDB verfügbar) */
  readonly persistent: boolean;
}

export function metaFor(doc: ChartDoc, thumbnail: string): ChartMeta {
  return {
    id: doc.id,
    name: doc.name,
    width: doc.grid.width,
    height: doc.grid.height,
    colorCount: doc.grid.palette.length,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    thumbnail,
  };
}

class IdbStore implements ChartStore {
  readonly persistent = true;
  constructor(private db: IDBPDatabase<KnitDB>) {}

  async list(): Promise<ChartMeta[]> {
    const all = await this.db.getAllFromIndex('meta', 'by-updated');
    return all.reverse();
  }

  get(id: string): Promise<ChartDoc | undefined> {
    return this.db.get('charts', id);
  }

  getAll(): Promise<ChartDoc[]> {
    return this.db.getAll('charts');
  }

  async save(doc: ChartDoc, thumbnail: string): Promise<void> {
    const tx = this.db.transaction(['charts', 'meta'], 'readwrite');
    await Promise.all([tx.objectStore('charts').put(doc), tx.objectStore('meta').put(metaFor(doc, thumbnail)), tx.done]);
  }

  async remove(id: string): Promise<void> {
    const tx = this.db.transaction(['charts', 'meta'], 'readwrite');
    await Promise.all([tx.objectStore('charts').delete(id), tx.objectStore('meta').delete(id), tx.done]);
  }
}

/** Fallback, falls IndexedDB nicht verfügbar ist (z. B. in manchen privaten Fenstern). */
export class MemoryStore implements ChartStore {
  readonly persistent = false;
  private charts = new Map<string, ChartDoc>();
  private metas = new Map<string, ChartMeta>();

  async list(): Promise<ChartMeta[]> {
    return [...this.metas.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async get(id: string): Promise<ChartDoc | undefined> {
    const d = this.charts.get(id);
    return d ? { ...d, grid: cloneGrid(d.grid) } : undefined;
  }
  async getAll(): Promise<ChartDoc[]> {
    return [...this.charts.values()];
  }
  async save(doc: ChartDoc, thumbnail: string): Promise<void> {
    this.charts.set(doc.id, { ...doc, grid: cloneGrid(doc.grid), settings: { ...doc.settings } });
    this.metas.set(doc.id, metaFor(doc, thumbnail));
  }
  async remove(id: string): Promise<void> {
    this.charts.delete(id);
    this.metas.delete(id);
  }
}

export async function openChartStore(name = 'maschenwerk'): Promise<ChartStore> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no indexedDB');
    const db = await openDB<KnitDB>(name, 1, {
      upgrade(db) {
        db.createObjectStore('charts', { keyPath: 'id' });
        const meta = db.createObjectStore('meta', { keyPath: 'id' });
        meta.createIndex('by-updated', 'updatedAt');
      },
    });
    return new IdbStore(db);
  } catch (err) {
    console.warn('IndexedDB nicht verfügbar, Muster werden nur temporär gespeichert.', err);
    return new MemoryStore();
  }
}

let storePromise: Promise<ChartStore> | null = null;

export function getStore(): Promise<ChartStore> {
  if (!storePromise) storePromise = openChartStore();
  return storePromise;
}

/** Bittet den Browser, die Daten nicht automatisch zu löschen. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    // ignorieren
  }
  return false;
}

/** Kopie eines Musters mit neuer ID. */
export function duplicateDoc(doc: ChartDoc, name: string): ChartDoc {
  const now = Date.now();
  return {
    ...doc,
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    grid: cloneGrid(doc.grid),
    settings: { ...doc.settings },
  };
}
