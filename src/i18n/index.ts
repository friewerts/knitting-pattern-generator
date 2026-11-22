import { useCallback } from 'react';
import { create } from 'zustand';
import { messages, type MessageKey } from './messages';
import type { Lang } from '../model/stitches';

const STORAGE_KEY = 'maschenwerk.lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'de' || saved === 'en') return saved;
  } catch {
    // ignorieren
  }
  if (typeof navigator !== 'undefined' && navigator.language && !navigator.language.toLowerCase().startsWith('de')) {
    return 'en';
  }
  return 'de';
}

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useLang = create<LangState>((set) => ({
  lang: typeof window === 'undefined' ? 'de' : initialLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignorieren
    }
    document.documentElement.lang = lang;
    set({ lang });
  },
}));

export type Params = Record<string, string | number>;

export function translate(lang: Lang, key: MessageKey, params?: Params): string {
  const entry = messages[key];
  let text: string = entry ? entry[lang] : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) text = text.split(`{${k}}`).join(String(v));
  }
  return text;
}

export type TFunction = (key: MessageKey, params?: Params) => string;

export function useT(): TFunction {
  const lang = useLang((s) => s.lang);
  return useCallback((key: MessageKey, params?: Params) => translate(lang, key, params), [lang]);
}

export function formatNumber(n: number, lang: Lang, digits = 0): string {
  return new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
}

export function formatDate(ts: number, lang: Lang): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const loc = lang === 'de' ? 'de-DE' : 'en-GB';
  if (sameDay) return new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit' }).format(d);
  return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }).format(d);
}

export type { MessageKey };
