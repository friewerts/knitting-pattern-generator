import type { ChartDoc } from '../model/types';
import { cellAspect } from '../model/doc';
import { renderThumbnail } from '../render/chartRender';
import { getStore, requestPersistence } from './db';
import { useApp } from '../state/app';

let persistenceRequested = false;

/** Speichert ein Muster inklusive Vorschaubild. */
export async function saveDoc(doc: ChartDoc): Promise<void> {
  const store = await getStore();
  const thumb = renderThumbnail(doc.grid, cellAspect(doc.settings));
  await store.save(doc, thumb);
  if (!persistenceRequested) {
    persistenceRequested = true;
    requestPersistence().then((p) => useApp.setState({ persistent: p && store.persistent }));
  }
}
