// Minimal external stores for UI state (theme, sidebar, presence, toasts).
import { useSyncExternalStore } from 'react';

export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  const get = () => state;
  const set = (patch: Partial<T> | ((prev: T) => T)) => {
    state = typeof patch === 'function' ? (patch as (p: T) => T)(state) : { ...state, ...patch };
    for (const l of listeners) l();
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const use = <S = T>(selector: (s: T) => S = (s) => s as unknown as S): S => useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
  return { get, set, subscribe, use };
}

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export type ThemePref = 'system' | 'light' | 'dark';

export const uiStore = createStore({
  theme: readLS<ThemePref>('tt.theme', 'system'),
  density: readLS<'comfortable' | 'compact'>('tt.density', 'comfortable'),
  sidebarCollapsed: readLS<boolean>('tt.sidebar', false),
  mobileSidebarOpen: false,
  commandOpen: false,
  createTaskOpen: false as boolean | { projectId?: string; parentId?: string; statusId?: string; dueDate?: string },
  lastWorkspace: readLS<string | null>('tt.lastWorkspace', null),
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  realtimeConnected: false,
});

export function applyTheme(pref: ThemePref) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = pref === 'dark' || (pref === 'system' && prefersDark);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0f1116' : '#f7f7f9');
}

export function setTheme(pref: ThemePref) {
  uiStore.set({ theme: pref });
  writeLS('tt.theme', pref);
  applyTheme(pref);
}

export function setDensity(d: 'comfortable' | 'compact') {
  uiStore.set({ density: d });
  writeLS('tt.density', d);
  document.documentElement.setAttribute('data-density', d);
}

export function toggleSidebar() {
  const next = !uiStore.get().sidebarCollapsed;
  uiStore.set({ sidebarCollapsed: next });
  writeLS('tt.sidebar', next);
}

if (typeof window !== 'undefined') {
  applyTheme(uiStore.get().theme);
  document.documentElement.setAttribute('data-density', uiStore.get().density);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(uiStore.get().theme));
  window.addEventListener('online', () => uiStore.set({ online: true }));
  window.addEventListener('offline', () => uiStore.set({ online: false }));
}
