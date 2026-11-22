import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Brush,
  Check,
  Download,
  Eraser,
  Eye,
  Hand,
  Maximize,
  Minus,
  MoreHorizontal,
  MousePointerSquareDashed,
  PaintBucket,
  PanelRight,
  Pipette,
  Plus,
  Redo2,
  RectangleHorizontal,
  Settings,
  Shapes,
  Slash,
  Undo2,
  AlertCircle,
  Loader2,
  Footprints,
  CircleHelp,
} from 'lucide-react';
import { getStore } from '../storage/db';
import { navigate } from '../router';
import { useLang, useT, type TFunction } from '../i18n';
import { toast } from '../state/app';
import { createEditorStore, EditorActions, type SidePanel as Panel, type ToolId } from './store';
import { EditorContext, useEd, useEditor, type EditorContextValue } from './context';
import { startAutosave } from './autosave';
import { ChartCanvasController, isTyping } from './canvasController';
import { ToolOptions } from './ToolOptions';
import { PalettePanel, PaletteSwatches, ColorEditDialog, useAddColor } from './panels/PalettePanel';
import { LegendPanel } from './panels/LegendPanel';
import { InstructionsPanel } from './panels/InstructionsPanel';
import { KnitPanel } from './KnitPanel';
import { ExportDialog } from './ExportDialog';
import { SettingsDialog } from './SettingsDialog';
import { HelpDialog } from './HelpDialog';
import { Menu, MenuItem } from '../ui/Menu';
import { SymbolIcon } from '../ui/SymbolIcon';
import { inkFor, colorLetter } from '../model/color';
import { clearSelection, copySelection, cutSelection, pasteClipboard } from './commands';

type LoadState = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; ctx: EditorContextValue };

export default function EditorPage({ id }: { id: string }) {
  const t = useT();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    void (async () => {
      const store = await getStore();
      const doc = await store.get(id);
      if (cancelled) return;
      if (!doc) {
        setState({ status: 'missing' });
        return;
      }
      const es = createEditorStore(doc);
      const actions = new EditorActions(es);
      stop = startAutosave(actions);
      setState({ status: 'ready', ctx: { store: es, actions, controller: { current: null } } });
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [id]);

  if (state.status === 'loading') return <div className="loading-screen">{t('editor.loading')}</div>;
  if (state.status === 'missing') {
    return (
      <div className="loading-screen">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <p>{t('editor.notFound')}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
            {t('editor.back')}
          </button>
        </div>
      </div>
    );
  }
  return (
    <EditorContext.Provider value={state.ctx}>
      <EditorView />
    </EditorContext.Provider>
  );
}

const TOOLS: { id: ToolId; icon: typeof Brush; key: string; label: Parameters<TFunction>[0] }[] = [
  { id: 'pencil', icon: Brush, key: 'B', label: 'tool.pencil' },
  { id: 'eraser', icon: Eraser, key: 'E', label: 'tool.eraser' },
  { id: 'fill', icon: PaintBucket, key: 'G', label: 'tool.fill' },
  { id: 'line', icon: Slash, key: 'L', label: 'tool.line' },
  { id: 'rect', icon: RectangleHorizontal, key: 'R', label: 'tool.rect' },
  { id: 'select', icon: MousePointerSquareDashed, key: 'S', label: 'tool.select' },
  { id: 'picker', icon: Pipette, key: 'I', label: 'tool.picker' },
  { id: 'hand', icon: Hand, key: 'H', label: 'tool.hand' },
];

function EditorView() {
  const t = useT();
  const { actions, controller } = useEditor();
  const knitMode = useEd((s) => s.knitMode);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editColor, setEditColor] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const dialogOpen = exportOpen || settingsOpen || helpOpen || editColor !== null;

  // Tastenkürzel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || dialogOpen || document.querySelector('dialog[open]')) return;
      const mod = e.ctrlKey || e.metaKey;
      const s = actions.state;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) actions.redo();
        else actions.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        actions.redo();
        return;
      }
      if (s.knitMode) {
        const g = s.committed;
        const row = Math.max(1, s.doc.progressRow || 1);
        if (key === 'arrowup' || key === ' ' || key === 'arrowright' || key === 'enter') {
          e.preventDefault();
          actions.updateDoc({ progressRow: Math.min(g.height + 1, row + 1) });
        } else if (key === 'arrowdown' || key === 'arrowleft' || key === 'backspace') {
          e.preventDefault();
          actions.updateDoc({ progressRow: Math.max(1, Math.min(g.height, row - 1)) });
        } else if (key === 'escape') {
          actions.store.setState({ knitMode: false });
        }
        return;
      }
      if (mod && key === 'c') {
        if (copySelection(actions)) {
          e.preventDefault();
          toast(t('sel.copied'));
        }
        return;
      }
      if (mod && key === 'x') {
        e.preventDefault();
        cutSelection(actions);
        return;
      }
      if (mod && key === 'v') {
        e.preventDefault();
        if (!pasteClipboard(actions, controller.current)) toast(t('sel.nothingToPaste'));
        return;
      }
      if (mod && key === 'a') {
        e.preventDefault();
        actions.setTool('select');
        actions.setSelection({ x: 0, y: 0, width: s.committed.width, height: s.committed.height });
        return;
      }
      if (mod) return;
      if (key === 'escape') {
        if (s.floating) actions.cancelFloating();
        else if (s.selection) actions.setSelection(null);
        return;
      }
      if (key === 'enter' && s.floating) {
        actions.commitFloating();
        return;
      }
      if ((key === 'delete' || key === 'backspace') && (s.selection || s.floating)) {
        e.preventDefault();
        clearSelection(actions);
        return;
      }
      if (key === '?') {
        setHelpOpen(true);
        return;
      }
      if (key === '+' || key === '=') return controller.current?.zoomBy(1.25);
      if (key === '-') return controller.current?.zoomBy(0.8);
      if (key === '0') return controller.current?.fit();
      if (/^[1-9]$/.test(key)) {
        const idx = Number(key) - 1;
        if (idx < s.committed.palette.length) actions.selectColor(idx);
        return;
      }
      const map: Record<string, ToolId> = { b: 'pencil', p: 'pencil', e: 'eraser', g: 'fill', f: 'fill', l: 'line', r: 'rect', s: 'select', m: 'select', i: 'picker', h: 'hand' };
      if (map[key]) actions.setTool(map[key]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions, controller, dialogOpen, t]);

  return (
    <div className="editor">
      <TopBar onExport={() => setExportOpen(true)} onSettings={() => setSettingsOpen(true)} onHelp={() => setHelpOpen(true)} />
      {!knitMode && <ToolRail />}
      <div className="canvas-wrap">
        <ChartCanvas />
        <ToolOptions />
        <StatusChip />
      </div>
      <SidePanelView />
      {knitMode ? <KnitPanel /> : <BottomBar onEditColor={setEditColor} />}
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ColorEditDialog index={editColor} onClose={() => setEditColor(null)} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function ChartCanvas() {
  const t = useT();
  const { actions, controller } = useEditor();
  const ref = useRef<HTMLCanvasElement>(null);
  const tool = useEd((s) => s.tool);
  const knitMode = useEd((s) => s.knitMode);
  const tRef = useRef(t);
  tRef.current = t;
  useEffect(() => {
    const c = new ChartCanvasController(ref.current!, actions, {
      onMessage: (k) => k === 'fillCable' && toast(tRef.current('editor.fillCable')),
    });
    controller.current = c;
    return () => {
      c.destroy();
      controller.current = null;
    };
  }, [actions, controller]);
  return <canvas ref={ref} className={knitMode ? 'knitting' : `tool-${tool}`} aria-label={t('app.tagline')} role="img" />;
}

function StatusChip() {
  const t = useT();
  const hover = useEd((s) => s.hover);
  const grid = useEd((s) => s.grid);
  if (!hover) return null;
  return <div className="status-chip">{t('editor.cell', { row: grid.height - hover.y, stitch: grid.width - hover.x })}</div>;
}

function SaveIndicator() {
  const t = useT();
  const save = useEd((s) => s.saveState);
  if (save === 'error')
    return (
      <span className="save-state error">
        <AlertCircle size={14} />
        {t('editor.saveError')}
      </span>
    );
  if (save === 'saving' || save === 'dirty')
    return (
      <span className="save-state">
        <Loader2 size={14} />
        {t('editor.saving')}
      </span>
    );
  return (
    <span className="save-state">
      <Check size={14} />
      {t('editor.saved')}
    </span>
  );
}

function NameInput() {
  const t = useT();
  const { actions } = useEditor();
  const name = useEd((s) => s.doc.name);
  const [value, setValue] = useState(name);
  useEffect(() => setValue(name), [name]);
  const commit = () => {
    const v = value.trim();
    if (v && v !== name) actions.updateDoc({ name: v });
    else setValue(name);
  };
  return (
    <input
      className="name-input"
      value={value}
      aria-label={t('editor.nameLabel')}
      maxLength={120}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setValue(name);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function ViewMenuItems({ close }: { close: () => void }) {
  const t = useT();
  const { actions } = useEditor();
  const knitPreview = useEd((s) => s.knitPreview);
  const showSymbols = useEd((s) => s.showSymbols);
  const repeat = useEd((s) => s.repeatPreview);
  const floats = useEd((s) => s.showFloats);
  const maxFloat = useEd((s) => s.maxFloat);
  const toggle = (p: Partial<{ knitPreview: boolean; showSymbols: boolean; repeatPreview: boolean; showFloats: boolean }>) => {
    actions.store.setState(p);
    close();
  };
  return (
    <>
      <MenuItem checked={knitPreview} onClick={() => toggle({ knitPreview: !knitPreview })}>
        {t('view.knitPreview')}
      </MenuItem>
      <MenuItem checked={showSymbols} onClick={() => toggle({ showSymbols: !showSymbols })}>
        {t('view.symbols')}
      </MenuItem>
      <MenuItem checked={repeat} onClick={() => toggle({ repeatPreview: !repeat })}>
        {t('view.repeat')}
      </MenuItem>
      <MenuItem checked={floats} onClick={() => toggle({ showFloats: !floats })}>
        {t('view.floats')}
      </MenuItem>
      {floats && (
        <div className="menu-item" style={{ cursor: 'default', justifyContent: 'space-between' }}>
          <span className="hint">{t('view.maxFloat', { n: maxFloat })}</span>
          <span style={{ display: 'inline-flex', gap: 2 }}>
            <button type="button" className="icon-btn icon-btn-sm" aria-label="−" onClick={() => actions.store.setState({ maxFloat: Math.max(2, maxFloat - 1) })}>
              <Minus size={16} />
            </button>
            <button type="button" className="icon-btn icon-btn-sm" aria-label="+" onClick={() => actions.store.setState({ maxFloat: Math.min(20, maxFloat + 1) })}>
              <Plus size={16} />
            </button>
          </span>
        </div>
      )}
    </>
  );
}

function TopBar({ onExport, onSettings, onHelp }: { onExport: () => void; onSettings: () => void; onHelp: () => void }) {
  const t = useT();
  const { actions, controller } = useEditor();
  const canUndo = useEd((s) => s.past.length > 0 || !!s.floating);
  const canRedo = useEd((s) => s.future.length > 0);
  const zoom = useEd((s) => s.zoom);
  const knitMode = useEd((s) => s.knitMode);
  const lang = useLang((s) => s.lang);
  const modKey = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : lang === 'de' ? 'Strg' : 'Ctrl';

  const setKnit = (on: boolean) => {
    const s = actions.state;
    if (s.floating) actions.commitFloating();
    actions.store.setState({ knitMode: on, selection: null, panel: on ? 'instructions' : s.panel === 'instructions' ? 'palette' : s.panel });
  };
  const openSheet = (panel: Panel) => actions.store.setState({ panel, sheetOpen: true });

  return (
    <header className="topbar">
      <button type="button" className="icon-btn" onClick={() => navigate('/')} title={t('editor.back')} aria-label={t('editor.back')}>
        <ArrowLeft size={21} />
      </button>
      <NameInput />
      <span className="desktop-only">
        <SaveIndicator />
      </span>
      <span className="topbar-spacer" />
      <button type="button" className="icon-btn" onClick={() => actions.undo()} disabled={!canUndo} title={`${t('editor.undo')} (${modKey}+Z)`} aria-label={t('editor.undo')}>
        <Undo2 size={20} />
      </button>
      <button type="button" className="icon-btn" onClick={() => actions.redo()} disabled={!canRedo} title={`${t('editor.redo')} (${modKey}+Y)`} aria-label={t('editor.redo')}>
        <Redo2 size={20} />
      </button>
      <span className="topbar-sep desktop-only" />
      <span className="desktop-only" style={{ alignItems: 'center', gap: 2 }}>
        <button type="button" className="icon-btn" onClick={() => controller.current?.zoomBy(0.8)} title={`${t('editor.zoomOut')} (−)`} aria-label={t('editor.zoomOut')}>
          <Minus size={19} />
        </button>
        <button type="button" className="zoom-label" onClick={() => controller.current?.fit()} title={`${t('editor.fit')} (0)`}>
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className="icon-btn" onClick={() => controller.current?.zoomBy(1.25)} title={`${t('editor.zoomIn')} (+)`} aria-label={t('editor.zoomIn')}>
          <Plus size={19} />
        </button>
        <button type="button" className="icon-btn" onClick={() => controller.current?.fit()} title={`${t('editor.fit')} (0)`} aria-label={t('editor.fit')}>
          <Maximize size={18} />
        </button>
      </span>
      <span className="topbar-sep desktop-only" />
      <span className="desktop-only" style={{ alignItems: 'center', gap: 2 }}>
        <Menu
          trigger={(p) => (
            <button type="button" className="icon-btn" title={t('editor.view')} aria-label={t('editor.view')} {...p}>
              <Eye size={20} />
            </button>
          )}
        >
          {(close) => <ViewMenuItems close={close} />}
        </Menu>
        <button type="button" className={`btn btn-sm ${knitMode ? 'btn-primary' : ''}`} onClick={() => setKnit(!knitMode)} aria-pressed={knitMode} style={{ margin: '0 4px' }}>
          <Footprints size={16} />
          {t('editor.knitMode')}
        </button>
        <button type="button" className="icon-btn" onClick={onExport} title={t('editor.export')} aria-label={t('editor.export')}>
          <Download size={20} />
        </button>
        <button type="button" className="icon-btn" onClick={onSettings} title={t('editor.settings')} aria-label={t('editor.settings')}>
          <Settings size={20} />
        </button>
        <button type="button" className="icon-btn" onClick={onHelp} title={`${t('help.title')} (?)`} aria-label={t('help.title')}>
          <CircleHelp size={20} />
        </button>
      </span>
      <button type="button" className="icon-btn sheet-toggle" onClick={() => openSheet(knitMode ? 'instructions' : 'palette')} title={t('editor.panels')} aria-label={t('editor.panels')}>
        <PanelRight size={20} />
      </button>
      <Menu
        className="mobile-only"
        trigger={(p) => (
          <button type="button" className="icon-btn" title={t('editor.menu')} aria-label={t('editor.menu')} {...p}>
            <MoreHorizontal size={21} />
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuItem icon={<Footprints size={17} />} checked={knitMode} onClick={() => (close(), setKnit(!knitMode))}>
              {t('editor.knitMode')}
            </MenuItem>
            <MenuItem icon={<Download size={17} />} onClick={() => (close(), onExport())}>
              {t('editor.export')}
            </MenuItem>
            <MenuItem icon={<Settings size={17} />} onClick={() => (close(), onSettings())}>
              {t('editor.settings')}
            </MenuItem>
            <MenuItem icon={<PanelRight size={17} />} onClick={() => (close(), openSheet('legend'))}>
              {t('editor.panels')}
            </MenuItem>
            <MenuItem icon={<Maximize size={17} />} onClick={() => (close(), controller.current?.fit())}>
              {t('editor.fit')}
            </MenuItem>
            <MenuItem icon={<CircleHelp size={17} />} onClick={() => (close(), onHelp())}>
              {t('help.title')}
            </MenuItem>
            <div className="menu-sep" />
            <div className="menu-label">{t('editor.view')}</div>
            <ViewMenuItems close={close} />
          </>
        )}
      </Menu>
    </header>
  );
}

function CurrentBrush() {
  const color = useEd((s) => s.grid.palette[s.activeColor]?.hex ?? '#000');
  const activeColor = useEd((s) => s.activeColor);
  const target = useEd((s) => s.paintTarget);
  const symbol = useEd((s) => s.activeSymbol);
  if (target === 'symbol') {
    return (
      <span className="current-brush" style={{ background: '#fff' }}>
        <SymbolIcon code={symbol} size={symbol >= 32 ? 14 : 30} border={false} />
      </span>
    );
  }
  return (
    <span className="current-brush" style={{ background: color, color: inkFor(color) }}>
      {colorLetter(activeColor)}
    </span>
  );
}

function ToolRail() {
  const t = useT();
  const { actions } = useEditor();
  const tool = useEd((s) => s.tool);
  return (
    <nav className="toolrail" aria-label={t('editor.tools')}>
      {TOOLS.map(({ id, icon: Icon, key, label }) => (
        <button
          key={id}
          type="button"
          className="icon-btn"
          aria-pressed={tool === id}
          title={`${t(label)} (${key})`}
          aria-label={t(label)}
          onClick={() => actions.setTool(id)}
        >
          <Icon size={21} />
        </button>
      ))}
      <span className="toolrail-sep" />
      <CurrentBrush />
    </nav>
  );
}

function SidePanelView() {
  const t = useT();
  const { actions } = useEditor();
  const panel = useEd((s) => s.panel);
  const sheetOpen = useEd((s) => s.sheetOpen);
  const tabs: { id: Panel; label: string }[] = [
    { id: 'palette', label: t('panel.palette') },
    { id: 'legend', label: t('panel.legend') },
    { id: 'instructions', label: t('panel.instructions') },
  ];
  return (
    <>
      {sheetOpen && <div className="sheet-backdrop" onClick={() => actions.store.setState({ sheetOpen: false })} />}
      <aside className={`sidepanel ${sheetOpen ? 'open' : ''}`} aria-label={t('editor.panels')}>
        <div className="sheet-grip mobile-sheet-only" />
        <div className="panel-tabs" role="tablist">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={panel === tab.id} onClick={() => actions.store.setState({ panel: tab.id })}>
              {tab.label}
            </button>
          ))}
        </div>
        {panel === 'palette' && <PalettePanel />}
        {panel === 'legend' && <LegendPanel />}
        {panel === 'instructions' && <InstructionsPanel />}
      </aside>
    </>
  );
}

function BottomBar({ onEditColor }: { onEditColor: (i: number) => void }) {
  const t = useT();
  const { actions } = useEditor();
  const tool = useEd((s) => s.tool);
  const target = useEd((s) => s.paintTarget);
  const symbol = useEd((s) => s.activeSymbol);
  const mirrorX = useEd((s) => s.mirrorX);
  const mirrorY = useEd((s) => s.mirrorY);
  const addColor = useAddColor();
  const main: ToolId[] = ['pencil', 'eraser', 'fill', 'select'];
  const extra = TOOLS.filter((x) => !main.includes(x.id));
  const extraActive = extra.some((x) => x.id === tool);
  return (
    <div className="bottombar">
      <div className="palette-strip" aria-label={t('editor.palette')}>
        <PaletteSwatches compact onEdit={onEditColor} />
        <button
          type="button"
          className="strip-btn"
          aria-label={t('palette.add')}
          onClick={() => {
            const i = addColor();
            if (i >= 0) onEditColor(i);
          }}
        >
          <Plus size={18} />
        </button>
        <span className="strip-sep" />
        <button type="button" className="strip-btn" aria-pressed={target === 'symbol'} onClick={() => actions.store.setState({ panel: 'palette', sheetOpen: true })}>
          {target === 'symbol' ? <SymbolIcon code={symbol} size={symbol >= 32 ? 12 : 22} /> : <Shapes size={18} />}
          {t('palette.symbols')}
        </button>
      </div>
      <nav className="tool-row" aria-label={t('editor.tools')}>
        {main.map((id) => {
          const def = TOOLS.find((x) => x.id === id)!;
          const Icon = def.icon;
          return (
            <button key={id} type="button" className="icon-btn" aria-pressed={tool === id} onClick={() => actions.setTool(id)} aria-label={t(def.label)}>
              <Icon size={20} />
              <span>{t(def.label)}</span>
            </button>
          );
        })}
        <Menu
          up
          trigger={(p) => (
            <button type="button" className="icon-btn" aria-pressed={extraActive} aria-label={t('common.more')} {...p}>
              <MoreHorizontal size={20} />
              <span>{t('common.more')}</span>
            </button>
          )}
        >
          {(close) => (
            <>
              {extra.map(({ id, icon: Icon, label }) => (
                <MenuItem key={id} icon={<Icon size={17} />} checked={tool === id} onClick={() => (close(), actions.setTool(id))}>
                  {t(label)}
                </MenuItem>
              ))}
              <div className="menu-sep" />
              <MenuItem checked={mirrorX} onClick={() => (close(), actions.store.setState({ mirrorX: !mirrorX }))}>
                {t('tool.mirrorX')}
              </MenuItem>
              <MenuItem checked={mirrorY} onClick={() => (close(), actions.store.setState({ mirrorY: !mirrorY }))}>
                {t('tool.mirrorY')}
              </MenuItem>
            </>
          )}
        </Menu>
      </nav>
    </div>
  );
}
