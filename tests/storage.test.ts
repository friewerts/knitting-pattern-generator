import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { duplicateDoc, MemoryStore, openChartStore } from '../src/storage/db';
import { createDoc } from '../src/model/doc';

describe('chart storage', () => {
  it('saves, lists, loads and deletes charts in IndexedDB', async () => {
    const store = await openChartStore('test-db-1');
    expect(store.persistent).toBe(true);
    const a = createDoc({ name: 'A', width: 3, height: 2 });
    a.updatedAt = 1000;
    const b = createDoc({ name: 'B', width: 5, height: 5 });
    b.updatedAt = 2000;
    b.grid.colors[3] = 2;
    await store.save(a, 'thumbA');
    await store.save(b, 'thumbB');
    const list = await store.list();
    expect(list.map((m) => m.name)).toEqual(['B', 'A']);
    expect(list[0].thumbnail).toBe('thumbB');
    const loaded = await store.get(b.id);
    expect(loaded?.grid.colors).toBeInstanceOf(Uint8Array);
    expect(loaded?.grid.colors[3]).toBe(2);
    await store.remove(a.id);
    expect((await store.list()).length).toBe(1);
    expect(await store.get(a.id)).toBeUndefined();
  });

  it('duplicates documents with a new id', () => {
    const a = createDoc({ name: 'A', width: 2, height: 2 });
    const d = duplicateDoc(a, 'A (Kopie)');
    expect(d.id).not.toBe(a.id);
    d.grid.colors[0] = 3;
    expect(a.grid.colors[0]).toBe(0);
  });

  it('has an in-memory fallback', async () => {
    const m = new MemoryStore();
    const a = createDoc({ name: 'A', width: 2, height: 2 });
    await m.save(a, '');
    expect((await m.list())[0].name).toBe('A');
    expect(m.persistent).toBe(false);
  });
});
