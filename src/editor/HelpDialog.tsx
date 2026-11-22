import { Dialog } from '../ui/Dialog';
import { useLang, useT } from '../i18n';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function Keys({ k }: { k: string[] }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {k.map((x) => (
        <kbd key={x} className="kbd">
          {x}
        </kbd>
      ))}
    </span>
  );
}

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const MOD = isMac ? '⌘' : lang === 'de' ? 'Strg' : 'Ctrl';
  const rows: [string[], string][] = [
    [['B'], t('tool.pencil')],
    [['E'], t('tool.eraser')],
    [['G'], t('tool.fill')],
    [['L'], t('tool.line')],
    [['R'], t('tool.rect')],
    [['S'], t('tool.select')],
    [['I'], t('tool.picker')],
    [['H'], t('tool.hand')],
    [['1', '…', '9'], t('help.colors')],
    [['+', '−', '0'], t('help.zoom')],
    [[`${MOD}+Z`, `${MOD}+Y`], t('help.undo')],
    [[`${MOD}+C`, `${MOD}+X`, `${MOD}+V`], t('help.clipboard')],
    [[lang === 'de' ? 'Entf' : 'Del'], t('help.delete')],
    [['↑', '↓'], t('help.knitKeys')],
  ];
  return (
    <Dialog open={open} onClose={onClose} title={t('help.title')}>
      <section className="panel-section">
        <div className="panel-section-head">
          <h3>{t('help.gestures')}</h3>
        </div>
        <ul className="help-list">
          <li>{t('help.touchZoom')}</li>
          <li>{t('help.wheel')}</li>
          <li>{t('help.space')}</li>
          <li>{t('help.pick')}</li>
          <li>{t('help.shift')}</li>
        </ul>
      </section>
      <section className="panel-section">
        <div className="panel-section-head">
          <h3>{t('help.keys')}</h3>
        </div>
        <dl className="facts help-keys">
          {rows.map(([k, label]) => (
            <div key={label} style={{ display: 'contents' }}>
              <dt>
                <Keys k={k} />
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="panel-section">
        <div className="panel-section-head">
          <h3>{t('help.tips')}</h3>
        </div>
        <ul className="help-list">
          <li>{t('help.tip1')}</li>
          <li>{t('help.tip2')}</li>
          <li>{t('help.tip3')}</li>
          <li>{t('help.tip4')}</li>
        </ul>
      </section>
    </Dialog>
  );
}
