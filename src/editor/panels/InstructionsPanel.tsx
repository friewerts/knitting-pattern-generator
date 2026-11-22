import { useEffect, useMemo, useRef } from 'react';
import { Copy, Download } from 'lucide-react';
import { useEd, useEditor } from '../context';
import { useLang, useT } from '../../i18n';
import { chartInstructions, chartUsesMultipleColors, formatRowBody, instructionsText, rowLabel } from '../../model/instructions';
import { safeFileName } from '../../model/doc';
import { downloadText } from '../../export/download';
import { toast } from '../../state/app';

export function InstructionsPanel() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const { actions } = useEditor();
  const grid = useEd((s) => s.committed);
  const settings = useEd((s) => s.doc.settings);
  const name = useEd((s) => s.doc.name);
  const progress = useEd((s) => s.doc.progressRow);
  const listRef = useRef<HTMLOListElement>(null);

  const rows = useMemo(() => {
    const multi = chartUsesMultipleColors(grid);
    return chartInstructions(grid, settings).map((r) => ({
      row: r.row,
      label: rowLabel(r.row, r.side, lang),
      body: formatRowBody(r, lang, multi),
      before: r.stitchesBefore,
    }));
  }, [grid, settings, lang]);

  useEffect(() => {
    if (!progress) return;
    const el = listRef.current?.querySelector(`[data-row="${progress}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [progress]);

  const text = () => instructionsText(grid, settings, lang, name);

  return (
    <div className="panel-body">
      <section className="panel-section">
        <p style={{ fontWeight: 600 }}>{t('instr.castOn', { n: rows[0]?.before ?? grid.width })}</p>
        <p className="hint">{settings.workedIn === 'rounds' ? t('instr.readRounds') : t('instr.readRows')}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text());
                toast(t('instr.copied'));
              } catch {
                downloadText(text(), `${safeFileName(name)}-anleitung.txt`);
              }
            }}
          >
            <Copy size={15} />
            {t('instr.copy')}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => downloadText(text(), `${safeFileName(name)}-anleitung.txt`)}>
            <Download size={15} />
            {t('instr.download')}
          </button>
        </div>
      </section>
      <ol className="instr-list" ref={listRef}>
        {rows.map((r) => (
          <li
            key={r.row}
            data-row={r.row}
            className={progress === r.row ? 'current' : ''}
            title={t('instr.current')}
            onClick={() => actions.updateDoc({ progressRow: r.row })}
          >
            <span className="instr-label">{r.label}</span>
            <span>{r.body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
