import type { ChartDoc } from '../model/types';
import { cellAspect } from '../model/doc';
import { renderThumbnail } from '../render/chartRender';
import { getStore, requestPersistence } from './db';
import { useApp } from '../state/app';

let persistenceRequested = false;
const inflight = new Set<Promise<void>>();

/** Wartet, bis alle laufenden Speichervorgänge abgeschlossen sind (z. B. vor dem erneuten Laden). */
export async function flushPendingSaves(): Promise<void> {
  while (inflight.size) await Promise.allSettled([...inflight]);
}

/** Speichert ein Muster inklusive Vorschaubild. */
export function saveDoc(doc: ChartDoc): Promise<void> {
  const p = saveDocNow(doc);
  inflight.add(p);
  const done = () => inflight.delete(p);
  p.then(done, done);
  return p;
}

async function saveDocNow(doc: ChartDoc): Promise<void> {
  const store = await getStore();
  const thumb = renderThumbnail(doc.grid, cellAspect(doc.settings));
  await store.save(doc, thumb);
  if (!persistenceRequested) {
    persistenceRequested = true;
    requestPersistence().then((p) => useApp.setState({ persistent: p && store.persistent }));
  }
}
