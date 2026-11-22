import { lazy, Suspense, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useRoute } from './router';
import { HomePage } from './pages/HomePage';
import { Toasts } from './ui/Toasts';
import { toast } from './state/app';
import { useLang, useT } from './i18n';

const EditorPage = lazy(() => import('./editor/EditorPage'));

function PwaUpdater() {
  const t = useT();
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) {
      console.warn('Service Worker konnte nicht registriert werden', err);
    },
  });
  useEffect(() => {
    if (offlineReady) {
      toast(t('pwa.offlineReady'));
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady, t]);
  useEffect(() => {
    if (needRefresh) {
      toast(t('pwa.update'), { action: { label: t('pwa.reload'), run: () => void updateServiceWorker(true) }, duration: 0 });
    }
  }, [needRefresh, updateServiceWorker, t]);
  return null;
}

export function App() {
  const route = useRoute();
  const lang = useLang((s) => s.lang);
  const t = useT();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <>
      {route.name === 'edit' ? (
        <Suspense fallback={<div className="loading-screen">{t('editor.loading')}</div>}>
          <EditorPage key={route.id} id={route.id} />
        </Suspense>
      ) : (
        <HomePage />
      )}
      <Toasts />
      <PwaUpdater />
    </>
  );
}
