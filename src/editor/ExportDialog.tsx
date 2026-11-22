import { useState } from 'react';
import { FileJson, FileText, Image as ImageIcon, Printer, Share2 } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Segmented, Switch } from '../ui/Controls';
import { useLang, useT } from '../i18n';
import { useEditor } from './context';
import { renderExportImage } from '../export/png';
import { canShareFiles, canvasToBlob, downloadBlob, downloadJson, downloadText, shareFile } from '../export/download';
import { safeFileName, serializeDoc, cellAspect } from '../model/doc';
import { instructionsText } from '../model/instructions';
import { PrintView, computeTiles, type PrintOptions } from '../export/PrintView';
import { toast } from '../state/app';

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const { actions } = useEditor();
  const [knitView, setKnitView] = useState(false);
  const [legend, setLegend] = useState(true);
  const [instructions, setInstructions] = useState(true);
  const [cellMm, setCellMm] = useState(5);
  const [orientation, setOrientation] = useState<PrintOptions['orientation']>('portrait');
  const [printing, setPrinting] = useState<(PrintOptions & { nonce: number }) | null>(null);
  const [busy, setBusy] = useState(false);

  const doc = () => actions.snapshot();
  const base = () => safeFileName(actions.state.doc.name);
  const shareSupported = canShareFiles();

  const pngBlob = async () => {
    const canvas = renderExportImage(doc(), lang, { knitView, legend });
    return canvasToBlob(canvas);
  };

  const onPng = async (share: boolean) => {
    setBusy(true);
    try {
      const blob = await pngBlob();
      const name = `${base()}.png`;
      if (share) {
        const ok = await shareFile(blob, name, actions.state.doc.name);
        if (!ok) downloadBlob(blob, name);
      } else {
        downloadBlob(blob, name);
        toast(t('export.done'));
      }
    } finally {
      setBusy(false);
    }
  };

  const grid = actions.state.committed;
  const pages = computeTiles(grid, cellAspect(actions.state.doc.settings), { cellMm, orientation }).length;

  return (
    <>
      <Dialog open={open} onClose={onClose} title={t('export.title')}>
        <section className="panel-section">
          <div className="panel-section-head">
            <h3>
              <ImageIcon size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              {t('export.png')}
            </h3>
          </div>
          <p className="hint">{t('export.pngText')}</p>
          <Switch checked={legend} onChange={setLegend}>
            {t('export.withLegend')}
          </Switch>
          <Switch checked={knitView} onChange={setKnitView}>
            {t('export.knitView')}
          </Switch>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void onPng(false)}>
              <ImageIcon size={17} />
              {t('export.png')}
            </button>
            {shareSupported && (
              <button type="button" className="btn" disabled={busy} onClick={() => void onPng(true)}>
                <Share2 size={17} />
                {t('export.share')}
              </button>
            )}
          </div>
        </section>

        <section className="panel-section" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div className="panel-section-head">
            <h3>
              <Printer size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              {t('export.print')}
            </h3>
          </div>
          <p className="hint">{t('export.printText')}</p>
          <div className="field">
            <span className="field-label">{t('export.cellSize')}</span>
            <Segmented
              block
              value={cellMm}
              onChange={setCellMm}
              options={[3, 4, 5, 6, 8].map((v) => ({ value: v, label: `${v} mm` }))}
            />
          </div>
          <div className="field">
            <span className="field-label">{t('export.orientation')}</span>
            <Segmented
              block
              value={orientation}
              onChange={setOrientation}
              options={[
                { value: 'portrait', label: t('export.portrait') },
                { value: 'landscape', label: t('export.landscape') },
              ]}
            />
          </div>
          <Switch checked={legend} onChange={setLegend}>
            {t('export.withLegend')}
          </Switch>
          <Switch checked={instructions} onChange={setInstructions}>
            {t('export.withInstructions')}
          </Switch>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={() => setPrinting({ cellMm, orientation, legend, instructions, knitView, nonce: Date.now() })}>
              <Printer size={17} />
              {t('export.printButton')}
            </button>
            <span className="hint">{t('export.pages', { n: pages })}</span>
          </div>
        </section>

        <section className="panel-section" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => downloadJson(serializeDoc(doc()), `${base()}.maschenwerk.json`)}>
              <FileJson size={17} />
              {t('export.file')}
            </button>
            <button type="button" className="btn" onClick={() => downloadText(instructionsText(grid, actions.state.doc.settings, lang, actions.state.doc.name), `${base()}-anleitung.txt`)}>
              <FileText size={17} />
              {t('export.text')}
            </button>
          </div>
          <p className="hint">{t('export.fileText')}</p>
        </section>
      </Dialog>
      {printing && <PrintView key={printing.nonce} doc={doc()} lang={lang} options={printing} onDone={() => setPrinting(null)} />}
    </>
  );
}
