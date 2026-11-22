import { useEffect, useState } from 'react';
import { FlipHorizontal2, FlipVertical2 } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { NumberField, Segmented } from '../ui/Controls';
import { formatNumber, useLang, useT } from '../i18n';
import { useEd, useEditor } from './context';
import { flipHorizontal, flipVertical, resizeGrid } from '../model/grid';
import { finishedSize } from '../model/doc';
import { MAX_SIZE } from '../model/types';

type Anchor = -1 | 0 | 1;

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const { actions, controller } = useEditor();
  const grid = useEd((s) => s.committed);
  const settings = useEd((s) => s.doc.settings);
  const notes = useEd((s) => s.doc.notes);
  const [w, setW] = useState(grid.width);
  const [h, setH] = useState(grid.height);
  const [ax, setAx] = useState<Anchor>(0);
  const [ay, setAy] = useState<Anchor>(1);
  const [noteText, setNoteText] = useState(notes);

  useEffect(() => {
    if (open) {
      setW(grid.width);
      setH(grid.height);
      setNoteText(notes);
    }
  }, [open]); // nur beim Öffnen mit den aktuellen Werten füllen

  const size = finishedSize(grid, settings);
  const changed = w !== grid.width || h !== grid.height;
  const shrinking = w < grid.width || h < grid.height;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (noteText !== notes) actions.updateDoc({ notes: noteText });
        onClose();
      }}
      title={t('settings.title')}
    >
      <section className="panel-section">
        <div className="panel-section-head">
          <h3>{t('settings.size')}</h3>
        </div>
        <div className="field-row">
          <div className="field">
            <span className="field-label">{t('new.widthSts')}</span>
            <NumberField value={w} onChange={setW} min={1} max={MAX_SIZE} ariaLabel={t('new.widthSts')} />
          </div>
          <div className="field">
            <span className="field-label">{t('new.heightRows')}</span>
            <NumberField value={h} onChange={setH} min={1} max={MAX_SIZE} ariaLabel={t('new.heightRows')} />
          </div>
        </div>
        <div className="field">
          <span className="field-label">{t('settings.anchor')}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 34px)', gap: 4 }} role="group" aria-label={t('settings.anchor')}>
            {([-1, 0, 1] as Anchor[]).flatMap((yy) =>
              ([-1, 0, 1] as Anchor[]).map((xx) => (
                <button
                  key={`${xx},${yy}`}
                  type="button"
                  className="icon-btn icon-btn-sm"
                  style={{ border: '1px solid var(--border)', width: 34, height: 34 }}
                  aria-pressed={ax === xx && ay === yy}
                  aria-label={`${xx},${yy}`}
                  onClick={() => {
                    setAx(xx);
                    setAy(yy);
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: ax === xx && ay === yy ? 'var(--primary)' : 'var(--border-strong)' }} />
                </button>
              )),
            )}
          </div>
        </div>
        {shrinking && <p className="hint">{t('settings.resizeShrink')}</p>}
        <div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!changed}
            onClick={() => {
              actions.apply((g) => resizeGrid(g, w, h, ax, ay));
              requestAnimationFrame(() => controller.current?.fit());
            }}
          >
            {t('settings.resize')}
          </button>
        </div>
      </section>

      <section className="panel-section" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div className="field">
          <span className="field-label">{t('settings.worked')}</span>
          <Segmented
            block
            value={settings.workedIn}
            onChange={(v) => actions.updateSettings({ workedIn: v })}
            options={[
              { value: 'rows', label: t('settings.rows') },
              { value: 'rounds', label: t('settings.rounds') },
            ]}
          />
        </div>
        {settings.workedIn === 'rows' && (
          <div className="field">
            <span className="field-label">{t('settings.firstRow')}</span>
            <Segmented
              block
              value={settings.firstRowRS ? 'rs' : 'ws'}
              onChange={(v) => actions.updateSettings({ firstRowRS: v === 'rs' })}
              options={[
                { value: 'rs', label: t('settings.rs') },
                { value: 'ws', label: t('settings.ws') },
              ]}
            />
          </div>
        )}
        <div className="field">
          <span className="field-label">{t('settings.gauge')}</span>
          <div className="field-row">
            <div className="field">
              <span className="field-label">{t('import.gaugeSts')}</span>
              <NumberField value={settings.gaugeStitches} onChange={(v) => actions.updateSettings({ gaugeStitches: v })} min={1} max={100} />
            </div>
            <div className="field">
              <span className="field-label">{t('import.gaugeRows')}</span>
              <NumberField value={settings.gaugeRows} onChange={(v) => actions.updateSettings({ gaugeRows: v })} min={1} max={100} />
            </div>
          </div>
          <span className="hint">{t('settings.finished', { w: formatNumber(size.width, lang), h: formatNumber(size.height, lang) })}</span>
        </div>
        <div className="field">
          <span className="field-label">{t('settings.cellShape')}</span>
          <Segmented
            block
            value={settings.cellShape}
            onChange={(v) => {
              actions.updateSettings({ cellShape: v });
              requestAnimationFrame(() => controller.current?.fit());
            }}
            options={[
              { value: 'square', label: t('settings.square') },
              { value: 'gauge', label: t('settings.gaugeShape') },
            ]}
          />
        </div>
        <div className="field">
          <span className="field-label">{t('settings.highlight')}</span>
          <Segmented
            block
            value={settings.highlightEvery}
            onChange={(v) => actions.updateSettings({ highlightEvery: v })}
            options={[
              { value: 0, label: t('settings.none') },
              { value: 5, label: '5' },
              { value: 10, label: '10' },
            ]}
          />
        </div>
      </section>

      <section className="panel-section" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div className="panel-section-head">
          <h3>{t('settings.transform')}</h3>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => actions.apply((g) => flipHorizontal(g))}>
            <FlipHorizontal2 size={17} />
            {t('settings.flipH')}
          </button>
          <button type="button" className="btn" onClick={() => actions.apply((g) => flipVertical(g))}>
            <FlipVertical2 size={17} />
            {t('settings.flipV')}
          </button>
        </div>
      </section>

      <label className="field" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <span className="field-label">{t('settings.notes')}</span>
        <textarea
          className="input"
          value={noteText}
          placeholder={t('settings.notesPlaceholder')}
          onChange={(e) => setNoteText(e.target.value)}
          onBlur={() => noteText !== notes && actions.updateDoc({ notes: noteText })}
        />
      </label>
    </Dialog>
  );
}
