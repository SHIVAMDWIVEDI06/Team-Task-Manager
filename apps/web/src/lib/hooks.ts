import { useCallback, useEffect, useRef, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export const useIsMobile = () => useMediaQuery('(max-width: 860px)');

export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay = 300) {
  const ref = useRef(fn);
  ref.current = fn;
  const timer = useRef<number | null>(null);
  return useCallback(
    (...args: A) => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => ref.current(...args), delay);
    },
    [delay],
  );
}

export function useClickOutside(refs: React.RefObject<HTMLElement | null>[], onOutside: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as Node;
      if (refs.some((r) => r.current && r.current.contains(target))) return;
      onOutside();
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [refs, onOutside, enabled]);
}

/** Global keyboard shortcut. Ignored while typing in inputs unless `allowInInput`. Supports "mod+k", "shift+?", "g b" (sequence). */
export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void, opts: { allowInInput?: boolean; enabled?: boolean } = {}) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (opts.enabled === false) return;
    const parts = combo.toLowerCase().split(' ');
    let seqIndex = 0;
    let seqTimer: number | null = null;
    const matches = (e: KeyboardEvent, spec: string) => {
      const keys = spec.split('+');
      const key = keys[keys.length - 1];
      const mod = keys.includes('mod');
      const shift = keys.includes('shift');
      const alt = keys.includes('alt');
      const isMac = navigator.platform.toLowerCase().includes('mac');
      if (mod !== (isMac ? e.metaKey : e.ctrlKey)) return false;
      if (!mod && (e.metaKey || e.ctrlKey)) return false;
      if (shift !== e.shiftKey && key.length === 1 && !/[?!@#$%^&*()_+{}|:"<>~]/.test(key)) return false;
      if (alt !== e.altKey) return false;
      const k = e.key.toLowerCase();
      return k === key || (key === 'esc' && k === 'escape') || (key === 'space' && k === ' ');
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if (typing && !opts.allowInInput) return;
      if (matches(e, parts[seqIndex])) {
        if (seqIndex === parts.length - 1) {
          e.preventDefault();
          seqIndex = 0;
          ref.current(e);
        } else {
          seqIndex++;
          if (seqTimer) window.clearTimeout(seqTimer);
          seqTimer = window.setTimeout(() => (seqIndex = 0), 800);
        }
      } else if (seqIndex > 0 && !['shift', 'control', 'meta', 'alt'].includes(e.key.toLowerCase())) {
        seqIndex = 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo, opts.allowInInput, opts.enabled]);
}

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: T | ((p: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [key],
  );
  return [value, set];
}

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

/** Auto-grow a textarea to fit its content. */
export function useAutosize(ref: React.RefObject<HTMLTextAreaElement | null>, value: string, maxHeight = 400) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(maxHeight, el.scrollHeight)}px`;
  }, [ref, value, maxHeight]);
}

export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** Re-render every `ms` (for relative timestamps). */
export function useTick(ms = 30_000) {
  const [, setN] = useState(0);
  useInterval(() => setN((n) => n + 1), ms);
}
