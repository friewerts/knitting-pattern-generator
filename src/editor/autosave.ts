import type { EditorActions } from './store';
import { saveDoc } from '../storage/charts';

/** Speichert Änderungen automatisch (entprellt) in IndexedDB. */
export function startAutosave(actions: EditorActions): () => void {
  const store = actions.store;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let saving = false;
  let pending = false;

  const run = async () => {
    timer = null;
    if (saving) {
      pending = true;
      return;
    }
    const s = store.getState();
    const savedCommitted = s.committed;
    const savedDoc = s.doc;
    saving = true;
    store.setState({ saveState: 'saving' });
    try {
      await saveDoc({ ...savedDoc, grid: savedCommitted, updatedAt: Date.now() });
      const now = store.getState();
      if (now.committed === savedCommitted && now.doc === savedDoc) store.setState({ saveState: 'saved' });
      else {
        store.setState({ saveState: 'dirty' });
        schedule();
      }
    } catch (err) {
      console.error('Speichern fehlgeschlagen', err);
      store.setState({ saveState: 'error' });
    } finally {
      saving = false;
      if (pending) {
        pending = false;
        schedule();
      }
    }
  };

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void run(), 600);
  }

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      void run();
    }
  };

  const unsub = store.subscribe((s, p) => {
    if (s.committed !== p.committed || s.doc !== p.doc) schedule();
  });
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    unsub();
    window.removeEventListener('pagehide', flush);
    document.removeEventListener('visibilitychange', onVisibility);
    flush();
  };
}
