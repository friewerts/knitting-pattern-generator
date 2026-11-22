import { useEffect, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { NumberField, Segmented } from '../ui/Controls';
import { useT } from '../i18n';
import { createDoc } from '../model/doc';
import type { CellShape, ChartDoc, WorkedIn } from '../model/types';
import { DEFAULT_SETTINGS, MAX_SIZE } from '../model/types';

const PRESETS: [number, number][] = [
  [10, 10],
  [20, 20],
  [30, 30],
  [40, 40],
  [60, 60],
  [100, 100],
];

export function NewChartDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (doc: ChartDoc) => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [width, setWidth] = useState(30);
  const [height, setHeight] = useState(30);
  const [workedIn, setWorkedIn] = useState<WorkedIn>('rows');
  const [cellShape, setCellShape] = useState<CellShape>('square');
  const [gaugeStitches, setGaugeStitches] = useState(DEFAULT_SETTINGS.gaugeStitches);
  const [gaugeRows, setGaugeRows] = useState(DEFAULT_SETTINGS.gaugeRows);

  useEffect(() => {
    if (open) setName(t('new.defaultName'));
  }, [open, t]);

  const create = () => {
    onCreate(
      createDoc({
        name: name.trim() || t('new.defaultName'),
        width,
        height,
        settings: { workedIn, cellShape, gaugeStitches, gaugeRows },
      }),
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('new.title')}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={create}>
            {t('new.create')}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">{t('common.name')}</span>
        <input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
      </label>
      <div className="field">
        <span className="field-label">{t('new.presets')}</span>
        <div className="seg" role="group" aria-label={t('new.presets')}>
          {PRESETS.map(([w, h]) => (
            <button
              key={`${w}x${h}`}
              type="button"
              aria-pressed={w === width && h === height}
              onClick={() => {
                setWidth(w);
                setHeight(h);
              }}
            >
              {w}×{h}
            </button>
          ))}
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <span className="field-label">{t('new.widthSts')}</span>
          <NumberField value={width} onChange={setWidth} min={1} max={MAX_SIZE} ariaLabel={t('new.widthSts')} />
        </div>
        <div className="field">
          <span className="field-label">{t('new.heightRows')}</span>
          <NumberField value={height} onChange={setHeight} min={1} max={MAX_SIZE} ariaLabel={t('new.heightRows')} />
        </div>
      </div>
      <div className="field">
        <span className="field-label">{t('settings.worked')}</span>
        <Segmented
          block
          value={workedIn}
          onChange={setWorkedIn}
          options={[
            { value: 'rows', label: t('settings.rows') },
            { value: 'rounds', label: t('settings.rounds') },
          ]}
        />
      </div>
      <div className="field">
        <span className="field-label">{t('settings.cellShape')}</span>
        <Segmented
          block
          value={cellShape}
          onChange={setCellShape}
          options={[
            { value: 'square', label: t('settings.square') },
            { value: 'gauge', label: t('settings.gaugeShape') },
          ]}
        />
      </div>
      {cellShape === 'gauge' && (
        <div className="field-row">
          <div className="field">
            <span className="field-label">{t('import.gaugeSts')}</span>
            <NumberField value={gaugeStitches} onChange={setGaugeStitches} min={1} max={100} />
          </div>
          <div className="field">
            <span className="field-label">{t('import.gaugeRows')}</span>
            <NumberField value={gaugeRows} onChange={setGaugeRows} min={1} max={100} />
          </div>
        </div>
      )}
    </Dialog>
  );
}
