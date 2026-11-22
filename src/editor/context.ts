import { createContext, useContext, type MutableRefObject } from 'react';
import { useStore } from 'zustand';
import type { EditorActions, EditorState, EditorStore } from './store';
import type { ChartCanvasController } from './canvasController';

export interface EditorContextValue {
  store: EditorStore;
  actions: EditorActions;
  controller: MutableRefObject<ChartCanvasController | null>;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('EditorContext fehlt');
  return ctx;
}

export function useEd<T>(selector: (s: EditorState) => T): T {
  const { store } = useEditor();
  return useStore(store, selector);
}
