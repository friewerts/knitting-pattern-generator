import { useMemo } from 'react';
import { useEd } from '../context';
import { formatNumber, useLang, useT, type TFunction } from '../../i18n';
import { colorLetter, inkFor } from '../../model/color';
import type { Lang } from '../../model/stitches';
import { legendData } from '../../model/legend';
import { finishedSize } from '../../model/doc';
import type { ChartGrid, ChartSettings } from '../../model/types';
import { SymbolIcon } from '../../ui/SymbolIcon';

export function LegendContent({ grid, settings, t, lang }: { grid: ChartGrid; settings: ChartSettings; t: TFunction; lang: Lang }) {
  const data = useMemo(() => legendData(grid, lang), [grid, lang]);
  const flat = settings.workedIn === 'rows';
  const size = finishedSize(grid, settings);
  return (
    <>
      <section className="panel-section">
        <div className="panel-section-head">
          <h3>{t('legend.facts')}</h3>
        </div>
        <dl className="facts">
          <dt>{t('legend.size')}</dt>
          <dd>{t('common.sizeSts', { w: grid.width, h: grid.height })}</dd>
          <dt>{t('legend.finished')}</dt>
          <dd>
            {formatNumber(size.width, lang)} × {formatNumber(size.height, lang)} cm
          </dd>
          <dt>{t('legend.gauge')}</dt>
          <dd>{t('legend.gaugeValue', { s: settings.gaugeStitches, r: settings.gaugeRows })}</dd>
          <dt>{t('legend.worked')}</dt>
          <dd>{flat ? t('settings.rows') : t('settings.rounds')}</dd>
        </dl>
      </section>
      <section className="panel-section">
        <div className="panel-section-head">
          <h3>{t('legend.colors')}</h3>
        </div>
        <ul className="legend-list">
          {data.colors.map((c) => (
            <li key={c.index} className="legend-item">
              <span className="legend-swatch" style={{ background: c.hex, color: inkFor(c.hex) }}>
                {colorLetter(c.index)}
              </span>
              <span className="legend-text">
                <span>{c.name || c.hex.toUpperCase()}</span>
              </span>
              <span className="legend-count">{t('legend.stitches', { n: c.count })}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel-section">
        <div className="panel-section-head">
          <h3>{t('legend.symbols')}</h3>
        </div>
        <ul className="legend-list">
          <li className="legend-item">
            <span className="legend-swatch" style={{ background: '#fff' }} />
            <span className="legend-text">
              <span>{t('legend.blank')}</span>
              <small>{flat ? t('legend.blankRows') : t('legend.blankRounds')}</small>
            </span>
          </li>
          {data.symbols.map((s) => (
            <li key={s.code} className="legend-item">
              <SymbolIcon code={s.code} size={s.width > 1 ? 15 : 30} />
              <span className="legend-text">
                <span>{s.name}</span>
                <small>
                  {flat && s.rs !== s.ws ? (
                    <>
                      {t('legend.rs')}: {s.rs}
                      <br />
                      {t('legend.ws')}: {s.ws}
                    </>
                  ) : (
                    s.rs
                  )}
                </small>
              </span>
              <span className="legend-count">×{s.count}</span>
            </li>
          ))}
        </ul>
        {data.symbols.length === 0 && <p className="hint">{t('legend.noSymbols')}</p>}
      </section>
    </>
  );
}

export function LegendPanel() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const grid = useEd((s) => s.committed);
  const settings = useEd((s) => s.doc.settings);
  return (
    <div className="panel-body">
      <LegendContent grid={grid} settings={settings} t={t} lang={lang} />
    </div>
  );
}
