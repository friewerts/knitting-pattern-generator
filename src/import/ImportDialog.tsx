import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ImagePlus, RefreshCw, Sparkles } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { NumberField, Segmented, Slider, Switch } from '../ui/Controls';
import { ColorDialog } from '../ui/ColorDialog';
import { formatNumber, useLang, useT } from '../i18n';
import { toast } from '../state/app';
import type { ChartDoc, ChartGrid, Rect } from '../model/types';
import { createDoc } from '../model/doc';
import { colorLetter, inkFor, labDistSq, type Lab } from '../model/color';
import { autoHeight, type ConvertResult } from '../image/quantize';
import { ImageConverter, loadImageFile, renderCrop, type SourceImage } from '../image/converter';
import { CropBox, fitCropToAspect } from './CropBox';
import { PreviewCanvas } from './PreviewCanvas';
import { pickFile } from '../export/download';

type GaugePreset = 'square' | 'stockinette' | 'custom';
type StageView = 'chart' | 'knitted' | 'original';

interface Override {
  lab: Lab;
  hex: string;
}

interface Remembered {
  gridW: number;
  colors: number;
  preset: GaugePreset;
  gSts: number;
  gRows: number;
  smoothing: number;
}

const SETTINGS_KEY = 'maschenwerk.import';
const DEFAULTS: Remembered = { gridW: 60, colors: 4, preset: 'stockinette', gSts: 22, gRows: 30, smoothing: 1 };

function loadRemembered(): Remembered {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // ignorieren
  }
  return DEFAULTS;
}

const OVERRIDE_THRESHOLD = 0.06 * 0.06;

/** Wendet manuell gewählte Garnfarben auf die (ggf. neu berechneten) Farben an. */
function applyOverrides(result: ConvertResult | null, overrides: Override[]): { hex: string; overridden: boolean }[] {
  if (!result) return [];
  const out = result.palette.map((hex) => ({ hex, overridden: false }));
  const pairs: { i: number; o: number; d: number }[] = [];
  result.centroids.forEach((c, i) => {
    overrides.forEach((ov, o) => {
      const d = labDistSq(c, ov.lab);
      if (d < OVERRIDE_THRESHOLD) pairs.push({ i, o, d });
    });
  });
  pairs.sort((a, b) => a.d - b.d);
  const usedI = new Set<number>();
  const usedO = new Set<number>();
  for (const p of pairs) {
    if (usedI.has(p.i) || usedO.has(p.o)) continue;
    usedI.add(p.i);
    usedO.add(p.o);
    out[p.i] = { hex: overrides[p.o].hex, overridden: true };
  }
  return out;
}

function baseName(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
}

interface Props {
  open: boolean;
  initialFile: File | null;
  onClose: () => void;
  onCreate: (doc: ChartDoc) => void;
}

export function ImportDialog({ open, initialFile, onClose, onCreate }: Props) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const remembered = useMemo(loadRemembered, []);
  const [src, setSrc] = useState<SourceImage | null>(null);
  const [srcId, setSrcId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, width: 1, height: 1 });
  const [gridW, setGridW] = useState(remembered.gridW);
  const [autoH, setAutoH] = useState(true);
  const [manualH, setManualH] = useState(remembered.gridW);
  const [colors, setColors] = useState(remembered.colors);
  const [preset, setPreset] = useState<GaugePreset>(remembered.preset);
  const [gSts, setGSts] = useState(remembered.gSts);
  const [gRows, setGRows] = useState(remembered.gRows);
  const [smoothing, setSmoothing] = useState(remembered.smoothing);
  const [dither, setDither] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [view, setView] = useState<StageView>('chart');
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [editColor, setEditColor] = useState<number | null>(null);
  const [name, setName] = useState('');
  const converterRef = useRef<ImageConverter | null>(null);
  const srcRef = useRef<SourceImage | null>(null);

  const gauge = preset === 'square' ? { sts: 20, rows: 20 } : preset === 'stockinette' ? { sts: 22, rows: 30 } : { sts: gSts, rows: gRows };
  const gridH = Math.max(1, Math.min(500, autoH ? autoHeight(gridW, crop.width, crop.height, gauge.sts, gauge.rows) : manualH));
  const cropAspect = autoH ? null : (gridH / gridW) * (gauge.sts / gauge.rows);

  // Einstellungen merken
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ gridW, colors, preset, gSts, gRows, smoothing } satisfies Remembered));
    } catch {
      // ignorieren
    }
  }, [gridW, colors, preset, gSts, gRows, smoothing]);

  const loadFile = useCallback(
    async (file: Blob, fileName = '') => {
      setLoading(true);
      try {
        const img = await loadImageFile(file, fileName);
        if (srcRef.current) URL.revokeObjectURL(srcRef.current.url);
        srcRef.current = img;
        setSrc(img);
        setSrcId((n) => n + 1);
        setCrop({ x: 0, y: 0, width: img.width, height: img.height });
        setAutoH(true);
        setOverrides([]);
        setResult(null);
        setName(baseName(fileName) || t('new.defaultName'));
        setView('chart');
      } catch {
        toast(t('import.loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  // Beim Öffnen ggf. übergebenes Bild laden, beim Schließen aufräumen
  useEffect(() => {
    if (open && initialFile) void loadFile(initialFile, initialFile.name);
    if (!open) {
      converterRef.current?.dispose();
      converterRef.current = null;
      if (srcRef.current) URL.revokeObjectURL(srcRef.current.url);
      srcRef.current = null;
      setSrc(null);
      setResult(null);
      setBrightness(0);
      setContrast(0);
      setSaturation(0);
      setDither(false);
    }
  }, [open, initialFile, loadFile]);

  // Einfügen aus der Zwischenablage
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === 'file' && i.type.startsWith('image/'));
      const f = item?.getAsFile();
      if (f) {
        e.preventDefault();
        void loadFile(f, f.name);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, loadFile]);

  // Umwandlung (entprellt, im Worker)
  useEffect(() => {
    if (!open || !src) return;
    const conv = (converterRef.current ??= new ImageConverter());
    const key = `${srcId}|${crop.x},${crop.y},${crop.width},${crop.height}|${gridW}x${gridH}`;
    setBusy(true);
    const timer = setTimeout(() => {
      conv
        .convert(key, () => renderCrop(src, crop, gridW, gridH), {
          gridW,
          gridH,
          colors,
          dither,
          smoothing,
          brightness,
          contrast,
          saturation,
        })
        .then((r) => {
          if (r) {
            setResult(r);
            setBusy(false);
          }
        })
        .catch((err) => {
          console.error(err);
          setBusy(false);
        });
    }, 80);
    return () => clearTimeout(timer);
  }, [open, src, srcId, crop, gridW, gridH, colors, dither, smoothing, brightness, contrast, saturation]);

  const palette = useMemo(() => applyOverrides(result, overrides), [result, overrides]);

  const previewGrid: ChartGrid | null = useMemo(() => {
    if (!result) return null;
    return {
      width: result.gridW,
      height: result.gridH,
      colors: result.indices,
      symbols: new Uint8Array(result.indices.length),
      palette: palette.map((p) => ({ hex: p.hex, name: '' })),
    };
  }, [result, palette]);

  const setHeightManual = (h: number) => {
    setAutoH(false);
    setManualH(h);
    if (src) setCrop((c) => fitCropToAspect(c, src.width, src.height, (h / gridW) * (gauge.sts / gauge.rows)));
  };

  const setWidth = (w: number) => {
    setGridW(w);
    if (!autoH && src) setCrop((c) => fitCropToAspect(c, src.width, src.height, (manualH / w) * (gauge.sts / gauge.rows)));
  };

  const changePreset = (p: GaugePreset) => {
    setPreset(p);
    if (!autoH && src) {
      const g = p === 'square' ? { sts: 20, rows: 20 } : p === 'stockinette' ? { sts: 22, rows: 30 } : { sts: gSts, rows: gRows };
      setCrop((c) => fitCropToAspect(c, src.width, src.height, (manualH / gridW) * (g.sts / g.rows)));
    }
  };

  const create = () => {
    if (!result || !src) return;
    const grid: ChartGrid = {
      width: result.gridW,
      height: result.gridH,
      colors: result.indices.slice(),
      symbols: new Uint8Array(result.indices.length),
      palette: palette.map((p) => ({ hex: p.hex, name: '' })),
    };
    onCreate(
      createDoc({
        name: name.trim() || t('new.defaultName'),
        grid,
        settings: {
          gaugeStitches: gauge.sts,
          gaugeRows: gauge.rows,
          cellShape: gauge.sts === gauge.rows ? 'square' : 'gauge',
        },
      }),
    );
  };

  const total = result ? result.counts.reduce((a, b) => a + b, 0) : 0;
  const finishedW = (gridW / gauge.sts) * 10;
  const finishedH = (gridH / gauge.rows) * 10;
  const editing = editColor !== null && result ? editColor : null;

  const choose = async () => {
    const f = await pickFile('image/*');
    if (f) await loadFile(f, f.name);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      dismissable={false}
      title={t('import.title')}
      bodyClassName="import-body"
      footer={
        src ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => void choose()} title={t('import.another')}>
              <RefreshCw size={17} />
              <span className="hide-mobile">{t('import.another')}</span>
            </button>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn hide-mobile" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary" onClick={create} disabled={!result}>
              <Sparkles size={17} />
              {t('import.create')}
            </button>
          </>
        ) : undefined
      }
    >
      {!src ? (
        <div className="import-stage" style={{ flex: 1, padding: 20 }}>
          <div
            className={`import-drop ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging(false);
              const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith('image/'));
              if (f) void loadFile(f, f.name);
            }}
          >
            <div className="big-icon">
              <ImagePlus size={32} />
            </div>
            <p>{t('import.dropOrPaste')}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void choose()} disabled={loading}>
              {loading ? t('import.working') : t('import.choose')}
            </button>
            <small>{t('import.formats')}</small>
          </div>
        </div>
      ) : (
        <div className="import-layout">
          <div className="import-stage">
            <div className="import-stage-tabs">
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  { value: 'chart', label: t('import.chart') },
                  { value: 'knitted', label: t('import.knitted') },
                  { value: 'original', label: t('import.original') },
                ]}
              />
            </div>
            <div className="import-stage-view">
              <PreviewCanvas grid={previewGrid} aspect={gauge.sts / gauge.rows} mode={view} source={src} crop={crop} />
              {busy && <span className="preview-busy">{t('import.working')}</span>}
            </div>
          </div>

          <div className="import-controls">
            <div className="control-section">
              <h3>{t('import.size')}</h3>
              <div style={{ display: 'grid', placeItems: 'center', background: 'var(--surface-2)', borderRadius: 12, padding: 8, maxHeight: 240 }}>
                <CropBox url={src.url} imgW={src.width} imgH={src.height} crop={crop} aspect={cropAspect} onChange={setCrop} label={t('import.cropHint')} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span className="hint">{t('import.cropHint')}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    setAutoH(true);
                    setCrop({ x: 0, y: 0, width: src.width, height: src.height });
                  }}
                >
                  {t('import.wholeImage')}
                </button>
              </div>
              <div className="field-row">
                <div className="field">
                  <span className="field-label">{t('import.widthSts')}</span>
                  <NumberField value={gridW} onChange={setWidth} min={4} max={300} ariaLabel={t('import.widthSts')} />
                </div>
                <div className="field">
                  <span className="field-label">{t('import.heightRows')}</span>
                  <NumberField value={gridH} onChange={setHeightManual} min={4} max={500} ariaLabel={t('import.heightRows')} />
                </div>
              </div>
              <input type="range" min={10} max={200} value={Math.min(200, gridW)} onChange={(e) => setWidth(Number(e.target.value))} aria-label={t('import.widthSts')} />
              <Switch checked={autoH} onChange={(v) => (v ? setAutoH(true) : setHeightManual(gridH))}>
                {t('import.autoHeight')}
              </Switch>
              <div className="import-summary">
                <strong>{t('common.sizeSts', { w: gridW, h: gridH })}</strong>
                <span className="hint">{t('import.finished', { w: formatNumber(finishedW, lang), h: formatNumber(finishedH, lang) })}</span>
                {gridW * gridH > 160 * 160 && <span className="hint">{t('import.large')}</span>}
              </div>
            </div>

            <div className="control-section">
              <h3>{t('import.colors')}</h3>
              <Slider label={t('import.colorCount')} value={colors} min={2} max={12} onChange={setColors} />
              {result && (
                <>
                  <div className="swatches" style={{ marginBottom: 14 }}>
                    {palette.map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`swatch-btn ${p.overridden ? 'overridden' : ''}`}
                        style={{ background: p.hex, color: inkFor(p.hex) }}
                        onClick={() => setEditColor(i)}
                        title={t('import.editColor', { letter: colorLetter(i) })}
                        aria-label={t('import.editColor', { letter: colorLetter(i) })}
                      >
                        {colorLetter(i)}
                        <span className="swatch-pct">{total ? Math.round((result.counts[i] / total) * 100) : 0}%</span>
                      </button>
                    ))}
                  </div>
                  <span className="hint">{t('import.colorsHint')}</span>
                </>
              )}
            </div>

            <div className="control-section">
              <h3>{t('import.gauge')}</h3>
              <Segmented
                block
                value={preset}
                onChange={changePreset}
                options={[
                  { value: 'square', label: t('import.gaugeSquare') },
                  { value: 'stockinette', label: t('import.gaugeStockinette') },
                  { value: 'custom', label: t('import.gaugeCustom') },
                ]}
              />
              {preset === 'custom' && (
                <div className="field-row">
                  <div className="field">
                    <span className="field-label">{t('import.gaugeSts')}</span>
                    <NumberField value={gSts} onChange={setGSts} min={1} max={100} />
                  </div>
                  <div className="field">
                    <span className="field-label">{t('import.gaugeRows')}</span>
                    <NumberField value={gRows} onChange={setGRows} min={1} max={100} />
                  </div>
                </div>
              )}
              <span className="hint">{t('import.gaugeHint')}</span>
            </div>

            <details className="disclosure">
              <summary>
                {t('import.details')}
                <ChevronDown size={18} className="chev" />
              </summary>
              <div className="disclosure-body">
                <div className="field">
                  <span className="field-label">{t('import.smoothing')}</span>
                  <Segmented
                    block
                    value={smoothing}
                    onChange={setSmoothing}
                    options={[0, 1, 2, 3].map((v) => ({ value: v, label: t(`import.smooth${v}` as 'import.smooth0') }))}
                  />
                </div>
                <Switch checked={dither} onChange={setDither}>
                  {t('import.dither')}
                </Switch>
              </div>
            </details>

            <details className="disclosure">
              <summary>
                {t('import.adjust')}
                <ChevronDown size={18} className="chev" />
              </summary>
              <div className="disclosure-body">
                <Slider label={t('import.brightness')} value={brightness} min={-1} max={1} step={0.05} onChange={setBrightness} format={(v) => Math.round(v * 100)} />
                <Slider label={t('import.contrast')} value={contrast} min={-1} max={1} step={0.05} onChange={setContrast} format={(v) => Math.round(v * 100)} />
                <Slider label={t('import.saturation')} value={saturation} min={-1} max={1} step={0.05} onChange={setSaturation} format={(v) => Math.round(v * 100)} />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setBrightness(0);
                    setContrast(0);
                    setSaturation(0);
                  }}
                >
                  {t('common.reset')}
                </button>
              </div>
            </details>

            <label className="field">
              <span className="field-label">{t('import.name')}</span>
              <input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </label>
          </div>
        </div>
      )}

      <ColorDialog
        open={editing !== null}
        title={t('import.editColor', { letter: editing !== null ? colorLetter(editing) : '' })}
        letter={editing !== null ? colorLetter(editing) : ''}
        hex={editing !== null ? palette[editing]?.hex ?? '#000000' : '#000000'}
        showName={false}
        onClose={() => setEditColor(null)}
        onApply={(hex) => {
          if (editing === null || !result) return;
          const lab = result.centroids[editing];
          setOverrides((list) => [...list.filter((o) => labDistSq(o.lab, lab) >= OVERRIDE_THRESHOLD), { lab, hex }]);
        }}
        extraFooter={
          editing !== null && palette[editing]?.overridden ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const lab = result!.centroids[editing];
                setOverrides((list) => list.filter((o) => labDistSq(o.lab, lab) >= OVERRIDE_THRESHOLD));
                setEditColor(null);
              }}
            >
              {t('import.resetColor')}
            </button>
          ) : undefined
        }
      />
    </Dialog>
  );
}
