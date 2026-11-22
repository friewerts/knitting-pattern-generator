import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileUp, Grid3x3, ImagePlus, Info, MoreVertical, Pencil, Copy, Trash2, Smartphone, WifiOff } from 'lucide-react';
import type { ChartMeta } from '../model/types';
import { backupFile, parseChartFile, safeFileName, serializeDoc } from '../model/doc';
import { duplicateDoc, getStore } from '../storage/db';
import { flushPendingSaves, saveDoc } from '../storage/charts';
import { downloadJson, pickFile } from '../export/download';
import { navigate } from '../router';
import { formatDate, useLang, useT } from '../i18n';
import { promptInstall, toast, useApp } from '../state/app';
import { Menu, MenuItem } from '../ui/Menu';
import { ConfirmDialog, PromptDialog } from '../ui/Prompts';
import { Segmented } from '../ui/Controls';
import { NewChartDialog } from './NewChartDialog';
import { ImportDialog } from '../import/ImportDialog';

function imageFromDataTransfer(dt: DataTransfer | null): File | null {
  if (!dt) return null;
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile();
  }
  for (const f of Array.from(dt.files ?? [])) if (f.type.startsWith('image/')) return f;
  return null;
}

export function HomePage() {
  const t = useT();
  const { lang, setLang } = useLang();
  const installEvent = useApp((s) => s.installEvent);
  const persistent = useApp((s) => s.persistent);
  const [charts, setCharts] = useState<ChartMeta[] | null>(null);
  const [storeTemp, setStoreTemp] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ChartMeta | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChartMeta | null>(null);

  const refresh = useCallback(async () => {
    // Vom Editor ggf. noch laufende Speichervorgänge abwarten (aktuelle Namen und Vorschaubilder)
    await flushPendingSaves();
    const store = await getStore();
    setStoreTemp(!store.persistent);
    setCharts(await store.list());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openImport = useCallback((file: File | null) => {
    setImportFile(file);
    setImportOpen(true);
  }, []);

  // Bild per Drag & Drop oder Einfügen öffnen
  useEffect(() => {
    let depth = 0;
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      depth++;
      setDragging(true);
    };
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      depth = 0;
      setDragging(false);
      if (importOpen) return;
      const f = imageFromDataTransfer(e.dataTransfer);
      if (f) {
        e.preventDefault();
        openImport(f);
        return;
      }
      const json = Array.from(e.dataTransfer?.files ?? []).find((x) => x.name.endsWith('.json'));
      if (json) {
        e.preventDefault();
        void importRef.current(json);
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (importOpen || newOpen) return;
      const f = imageFromDataTransfer(e.clipboardData);
      if (f) {
        e.preventDefault();
        openImport(f);
      }
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
    };
  }, [importOpen, newOpen, openImport]);

  async function importChartFile(file: File) {
    try {
      const docs = parseChartFile(await file.text());
      const store = await getStore();
      const existing = new Set((await store.list()).map((m) => m.id));
      const savedIds: string[] = [];
      for (const d of docs) {
        // Vorhandenes Muster nicht überschreiben, sondern als Kopie mit neuer ID anlegen
        const doc = existing.has(d.id) ? duplicateDoc(d, d.name) : d;
        await saveDoc(doc);
        savedIds.push(doc.id);
      }
      toast(t('home.imported', { n: docs.length }));
      await refresh();
      if (savedIds.length === 1) navigate(`/edit/${savedIds[0]}`);
    } catch {
      toast(t('home.importFailed'));
    }
  }

  const importRef = useRef(importChartFile);
  importRef.current = importChartFile;

  async function onOpenFile() {
    const f = await pickFile('.json,application/json');
    if (f) await importChartFile(f);
  }

  async function onBackupAll() {
    const store = await getStore();
    const docs = await store.getAll();
    if (!docs.length) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(backupFile(docs), `maschenwerk-sicherung-${date}.json`);
  }

  async function onDuplicate(m: ChartMeta) {
    const store = await getStore();
    const doc = await store.get(m.id);
    if (!doc) return;
    await saveDoc(duplicateDoc(doc, t('common.copySuffix', { name: doc.name })));
    await refresh();
  }

  async function onRename(m: ChartMeta, name: string) {
    const store = await getStore();
    const doc = await store.get(m.id);
    if (!doc) return;
    await saveDoc({ ...doc, name, updatedAt: Date.now() });
    await refresh();
  }

  async function onExport(m: ChartMeta) {
    const store = await getStore();
    const doc = await store.get(m.id);
    if (!doc) return;
    downloadJson(serializeDoc(doc), `${safeFileName(doc.name)}.maschenwerk.json`);
  }

  async function onDelete(m: ChartMeta) {
    const store = await getStore();
    const doc = await store.get(m.id);
    await store.remove(m.id);
    await refresh();
    toast(t('home.deleted', { name: m.name }), {
      action: doc
        ? {
            label: t('editor.undo'),
            run: () => {
              void saveDoc(doc).then(refresh);
            },
          }
        : undefined,
    });
  }

  return (
    <main className="home">
      <header className="home-header">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={44} height={44} />
          <div>
            <div className="brand-name">{t('app.name')}</div>
            <div className="brand-tag">{t('app.tagline')}</div>
          </div>
        </div>
        {installEvent && (
          <button type="button" className="btn" onClick={() => void promptInstall()}>
            <Smartphone size={18} />
            <span className="desktop-only">{t('home.install')}</span>
          </button>
        )}
      </header>

      <section className="home-hero" aria-label={t('app.tagline')}>
        <button type="button" className="action-card primary" onClick={() => openImport(null)}>
          <span className="action-icon">
            <ImagePlus size={28} />
          </span>
          <span>
            <h2>{t('home.fromImage')}</h2>
            <p>{t('home.fromImageText')}</p>
          </span>
        </button>
        <button type="button" className="action-card" onClick={() => setNewOpen(true)}>
          <span className="action-icon">
            <Grid3x3 size={28} />
          </span>
          <span>
            <h2>{t('home.blank')}</h2>
            <p>{t('home.blankText')}</p>
          </span>
        </button>
      </section>

      <ol className="home-steps" aria-label={t('home.howTitle')}>
        <li>{t('home.how1')}</li>
        <li>{t('home.how2')}</li>
        <li>{t('home.how3')}</li>
        <li>{t('home.how4')}</li>
      </ol>

      <section className="panel-section" aria-labelledby="my-charts">
        <div className="section-head">
          <h2 id="my-charts">{t('home.myCharts')}</h2>
          <button type="button" className="btn btn-sm" onClick={() => void onOpenFile()}>
            <FileUp size={16} />
            {t('home.openFile')}
          </button>
          {charts && charts.length > 0 && (
            <button type="button" className="btn btn-sm" onClick={() => void onBackupAll()}>
              <Download size={16} />
              {t('home.backupAll')}
            </button>
          )}
        </div>

        {charts && charts.length === 0 && <div className="empty-state">{t('home.empty')}</div>}

        {charts && charts.length > 0 && (
          <div className="chart-grid">
            {charts.map((m) => (
              <article key={m.id} className="chart-card">
                <button type="button" className="chart-card-open" onClick={() => navigate(`/edit/${m.id}`)}>
                  <div className="chart-thumb">{m.thumbnail ? <img src={m.thumbnail} alt="" /> : null}</div>
                  <div className="chart-info">
                    <span className="chart-name">{m.name}</span>
                    <span className="chart-meta">
                      {t('common.sizeSts', { w: m.width, h: m.height })} · {m.colorCount === 1 ? t('common.colors1') : t('common.colorsN', { n: m.colorCount })}
                    </span>
                    <span className="chart-meta">{t('home.edited', { date: formatDate(m.updatedAt, lang) })}</span>
                  </div>
                </button>
                <Menu
                  up
                  trigger={(p) => (
                    <button type="button" className="icon-btn icon-btn-sm" aria-label={t('home.chartMenu', { name: m.name })} title={t('home.chartMenu', { name: m.name })} {...p}>
                      <MoreVertical size={18} />
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuItem icon={<Pencil size={17} />} onClick={() => (close(), setRenameTarget(m))}>
                        {t('common.rename')}
                      </MenuItem>
                      <MenuItem icon={<Copy size={17} />} onClick={() => (close(), void onDuplicate(m))}>
                        {t('common.duplicate')}
                      </MenuItem>
                      <MenuItem icon={<Download size={17} />} onClick={() => (close(), void onExport(m))}>
                        {t('home.exportFile')}
                      </MenuItem>
                      <div className="menu-sep" />
                      <MenuItem icon={<Trash2 size={17} />} danger onClick={() => (close(), setDeleteTarget(m))}>
                        {t('common.delete')}
                      </MenuItem>
                    </>
                  )}
                </Menu>
              </article>
            ))}
          </div>
        )}

        {storeTemp || persistent === false ? (
          <p className={`notice ${storeTemp ? 'warning' : ''}`}>
            <Info size={17} />
            <span>{storeTemp ? t('home.storageTemp') : t('home.storageNote')}</span>
          </p>
        ) : (
          charts &&
          charts.length > 0 && (
            <p className="notice">
              <Info size={17} />
              <span>{t('home.storageNote')}</span>
            </p>
          )
        )}
      </section>

      <footer className="home-footer">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <WifiOff size={15} /> {t('home.offline')}
        </span>
        <Segmented
          ariaLabel={t('common.language')}
          value={lang}
          onChange={setLang}
          options={[
            { value: 'de', label: 'Deutsch' },
            { value: 'en', label: 'English' },
          ]}
        />
      </footer>

      {dragging && !importOpen && (
        <div className="drop-overlay">
          <div>{t('home.dropHint')}</div>
        </div>
      )}

      <NewChartDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={async (doc) => {
          await saveDoc(doc);
          setNewOpen(false);
          navigate(`/edit/${doc.id}`);
        }}
      />
      <ImportDialog
        open={importOpen}
        initialFile={importFile}
        onClose={() => {
          setImportOpen(false);
          setImportFile(null);
        }}
        onCreate={async (doc) => {
          await saveDoc(doc);
          setImportOpen(false);
          setImportFile(null);
          navigate(`/edit/${doc.id}`);
        }}
      />
      <PromptDialog
        open={!!renameTarget}
        title={t('common.rename')}
        label={t('home.renamePrompt')}
        initial={renameTarget?.name ?? ''}
        onClose={() => setRenameTarget(null)}
        onSubmit={(name) => renameTarget && void onRename(renameTarget, name)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title={t('common.delete')}
        text={t('home.deleteConfirm', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('common.delete')}
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && void onDelete(deleteTarget)}
      />
    </main>
  );
}
