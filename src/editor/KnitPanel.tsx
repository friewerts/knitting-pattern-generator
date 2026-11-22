import { useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, X } from 'lucide-react';
import { useEd, useEditor } from './context';
import { useLang, useT } from '../i18n';
import { chartUsesMultipleColors, formatRowBody, rowInstruction } from '../model/instructions';

/** Bedienleiste im Strickmodus: Reihe für Reihe vor und zurück. */
export function KnitPanel() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const { actions } = useEditor();
  const grid = useEd((s) => s.committed);
  const settings = useEd((s) => s.doc.settings);
  const progress = useEd((s) => s.doc.progressRow);
  const row = Math.max(1, Math.min(grid.height, progress || 1));
  const done = progress > grid.height;

  useEffect(() => {
    if (!progress) actions.updateDoc({ progressRow: 1 });
  }, [progress, actions]);

  // Bildschirm anlassen, solange gestrickt wird
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen');
      } catch {
        // nicht unterstützt oder abgelehnt
      }
    };
    void request();
    const onVis = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  const info = useMemo(() => {
    const instr = rowInstruction(grid, settings, row);
    return { instr, text: formatRowBody(instr, lang, chartUsesMultipleColors(grid)) };
  }, [grid, settings, row, lang]);

  const go = (delta: number) => {
    if (done) {
      if (delta < 0) actions.updateDoc({ progressRow: grid.height });
      return;
    }
    actions.updateDoc({ progressRow: Math.max(1, Math.min(grid.height + 1, row + delta)) });
  };

  const side = info.instr.side;
  const pct = Math.round(((done ? grid.height : row - 1) / grid.height) * 100);

  return (
    <div className="knit-panel" role="region" aria-label={t('editor.knitMode')}>
      <button type="button" className="btn knit-exit" onClick={() => actions.store.setState({ knitMode: false })}>
        <X size={18} />
        {t('knit.exit')}
      </button>
      <div className="knit-row" aria-live="polite">
        {done ? (
          <span className="knit-row-title">{t('knit.done')}</span>
        ) : (
          <>
            <span className="knit-row-title">{side === 'round' ? t('knit.round', { n: row, total: grid.height }) : t('knit.row', { n: row, total: grid.height })}</span>
            <span className="knit-row-sub">{side === 'rs' ? t('knit.rs') : side === 'ws' ? t('knit.ws') : t('knit.roundDir')}</span>
            <span className="knit-row-text">{info.text}</span>
          </>
        )}
        <div className="knit-progress" aria-label={t('knit.progress', { p: pct })}>
          <div style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="knit-nav">
        <button type="button" className="btn" onClick={() => go(-1)} disabled={row <= 1 && !done} aria-label={t('knit.prev')} title={t('knit.prev')}>
          <ChevronDown size={26} />
        </button>
        {done ? (
          <button type="button" className="btn btn-primary" onClick={() => actions.updateDoc({ progressRow: 1 })} title={t('knit.restart')}>
            <RotateCcw size={22} />
            <span className="desktop-only">{t('knit.restart')}</span>
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => go(1)} aria-label={t('knit.next')} title={t('knit.next')}>
            <ChevronUp size={26} />
            <span className="desktop-only">{t('knit.next')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
