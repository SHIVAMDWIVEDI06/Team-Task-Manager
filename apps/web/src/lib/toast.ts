import { createStore } from './store.ts';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration: number;
}

export const toastStore = createStore<{ toasts: Toast[] }>({ toasts: [] });
let seq = 0;

function push(kind: Toast['kind'], title: string, opts: { description?: string; action?: Toast['action']; duration?: number } = {}) {
  const id = ++seq;
  const t: Toast = { id, kind, title, description: opts.description, action: opts.action, duration: opts.duration ?? (kind === 'error' ? 6000 : 3500) };
  toastStore.set((s) => ({ toasts: [...s.toasts.slice(-4), t] }));
  if (t.duration > 0) setTimeout(() => dismiss(id), t.duration);
  return id;
}

export function dismiss(id: number) {
  toastStore.set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

export const toast = {
  success: (title: string, opts?: { description?: string; action?: Toast['action']; duration?: number }) => push('success', title, opts),
  error: (title: string, opts?: { description?: string; action?: Toast['action']; duration?: number }) => push('error', title, opts),
  info: (title: string, opts?: { description?: string; action?: Toast['action']; duration?: number }) => push('info', title, opts),
  /** Show an error toast from a thrown value. */
  fromError: (e: unknown, fallback = 'Something went wrong') => push('error', (e as Error)?.message || fallback),
};
