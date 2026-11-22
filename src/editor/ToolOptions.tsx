import {
  Check,
  ClipboardPaste,
  Copy,
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  PaintBucket,
  Repeat,
  Scissors,
  SquareDashed,
  Trash2,
  X,
} from 'lucide-react';
import { useEd, useEditor } from './context';
import { useT } from '../i18n';
import {
  clearSelection,
  copySelection,
  cropToSelection,
  cutSelection,
  fillSelection,
  flipSelection,
  pasteClipboard,
  repeatSelection,
} from './commands';
import { toast } from '../state/app';
import { getClipboard } from './store';

function MirrorIcon({ vertical }: { vertical?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={vertical ? { transform: 'rotate(90deg)' } : undefined} aria-hidden>
      <path d="M12 3v18" strokeDasharray="2 3" />
      <path d="M8 7 3 12l5 5V7Z" />
      <path d="m16 7 5 5-5 5V7Z" />
    </svg>
  );
}

export function ToolOptions() {
  const t = useT();
  const { actions, controller } = useEditor();
  const tool = useEd((s) => s.tool);
  const mirrorX = useEd((s) => s.mirrorX);
  const mirrorY = useEd((s) => s.mirrorY);
  const rectFilled = useEd((s) => s.rectFilled);
  const selection = useEd((s) => s.selection);
  const floating = useEd((s) => s.floating);
  const knitMode = useEd((s) => s.knitMode);
  if (knitMode) return null;

  const set = (p: Partial<{ mirrorX: boolean; mirrorY: boolean; rectFilled: boolean }>) => actions.store.setState(p);

  if (floating) {
    return (
      <div className="tool-options" role="toolbar" aria-label={t('tool.select')}>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => actions.commitFloating()}>
          <Check size={16} />
          {t('sel.place')}
        </button>
        <span className="opt-sep" />
        <button type="button" className="icon-btn icon-btn-sm" title={t('sel.flipH')} aria-label={t('sel.flipH')} onClick={() => flipSelection(actions, true)}>
          <FlipHorizontal2 size={18} />
        </button>
        <button type="button" className="icon-btn icon-btn-sm" title={t('sel.flipV')} aria-label={t('sel.flipV')} onClick={() => flipSelection(actions, false)}>
          <FlipVertical2 size={18} />
        </button>
        <button type="button" className="icon-btn icon-btn-sm" title={t('common.cancel')} aria-label={t('common.cancel')} onClick={() => actions.cancelFloating()}>
          <X size={18} />
        </button>
      </div>
    );
  }

  if (tool === 'select') {
    if (!selection) {
      return (
        <div className="tool-options" role="toolbar" aria-label={t('tool.select')}>
          <span className="opt-label">{t('tool.selectHint')}</span>
          {getClipboard() && (
            <button type="button" className="btn btn-sm" onClick={() => pasteClipboard(actions, controller.current)}>
              <ClipboardPaste size={16} />
              {t('sel.paste')}
            </button>
          )}
        </div>
      );
    }
    const btn = (title: string, icon: React.ReactNode, run: () => void) => (
      <button type="button" className="icon-btn icon-btn-sm" title={title} aria-label={title} onClick={run}>
        {icon}
      </button>
    );
    return (
      <div className="tool-options" role="toolbar" aria-label={t('tool.select')}>
        <span className="opt-label">{t('sel.size', { w: selection.width, h: selection.height })}</span>
        <span className="opt-sep" />
        {btn(t('sel.copy'), <Copy size={18} />, () => copySelection(actions) && toast(t('sel.copied')))}
        {btn(t('sel.cut'), <Scissors size={18} />, () => cutSelection(actions))}
        {btn(t('sel.paste'), <ClipboardPaste size={18} />, () => {
          if (!pasteClipboard(actions, controller.current)) toast(t('sel.nothingToPaste'));
        })}
        {btn(t('sel.clear'), <Trash2 size={18} />, () => clearSelection(actions))}
        <span className="opt-sep" />
        {btn(t('sel.flipH'), <FlipHorizontal2 size={18} />, () => flipSelection(actions, true))}
        {btn(t('sel.flipV'), <FlipVertical2 size={18} />, () => flipSelection(actions, false))}
        {btn(t('sel.fill'), <PaintBucket size={18} />, () => fillSelection(actions))}
        <span className="opt-sep" />
        {btn(t('sel.repeatH'), <Repeat size={18} />, () => repeatSelection(actions, true, false))}
        {btn(t('sel.repeatV'), <Repeat size={18} style={{ transform: 'rotate(90deg)' }} />, () => repeatSelection(actions, false, true))}
        {btn(t('sel.crop'), <Crop size={18} />, () => cropToSelection(actions, controller.current))}
        <span className="opt-sep" />
        {btn(t('sel.deselect'), <SquareDashed size={18} />, () => actions.setSelection(null))}
      </div>
    );
  }

  if (tool === 'hand' || tool === 'picker') return null;

  return (
    <div className="tool-options" role="toolbar" aria-label={t('editor.tools')}>
      <button type="button" className="icon-btn icon-btn-sm" aria-pressed={mirrorX} title={t('tool.mirrorX')} aria-label={t('tool.mirrorX')} onClick={() => set({ mirrorX: !mirrorX })}>
        <MirrorIcon />
      </button>
      <button type="button" className="icon-btn icon-btn-sm" aria-pressed={mirrorY} title={t('tool.mirrorY')} aria-label={t('tool.mirrorY')} onClick={() => set({ mirrorY: !mirrorY })}>
        <MirrorIcon vertical />
      </button>
      {tool === 'rect' && (
        <>
          <span className="opt-sep" />
          <div className="seg">
            <button type="button" aria-pressed={!rectFilled} onClick={() => set({ rectFilled: false })}>
              {t('tool.outline')}
            </button>
            <button type="button" aria-pressed={rectFilled} onClick={() => set({ rectFilled: true })}>
              {t('tool.filled')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
