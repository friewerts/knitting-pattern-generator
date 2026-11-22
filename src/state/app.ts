import { create } from 'zustand';

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
  duration: number;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface AppState {
  toasts: Toast[];
  installEvent: BeforeInstallPromptEvent | null;
  /** Bild, das auf der Startseite abgelegt wurde und im Import-Dialog geöffnet werden soll */
  pendingImage: File | null;
  persistent: boolean | null;
}

export const useApp = create<AppState>(() => ({
  toasts: [],
  installEvent: null,
  pendingImage: null,
  persistent: null,
}));

let toastId = 1;

export function toast(text: string, opts: { action?: Toast['action']; duration?: number } = {}): void {
  const t: Toast = { id: toastId++, text, action: opts.action, duration: opts.duration ?? (opts.action ? 6000 : 3200) };
  useApp.setState((s) => ({ toasts: [...s.toasts.slice(-2), t] }));
  if (t.duration > 0) setTimeout(() => dismissToast(t.id), t.duration);
}

export function dismissToast(id: number): void {
  useApp.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

export function initInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useApp.setState({ installEvent: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useApp.setState({ installEvent: null }));
}

export async function promptInstall(): Promise<void> {
  const ev = useApp.getState().installEvent;
  if (!ev) return;
  await ev.prompt();
  await ev.userChoice.catch(() => undefined);
  useApp.setState({ installEvent: null });
}
