// HTTP client with access-token auth, transparent refresh and typed errors.
import type { ApiError } from '../../../../packages/shared/src/types.ts';

export class RequestError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  /** Field-level issues from validation errors, keyed by path. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) for (const i of this.details as { path: string; message: string }[]) if (!out[i.path]) out[i.path] = i.message;
    return out;
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
const authListeners = new Set<(token: string | null) => void>();

export const tokenStore = {
  get: () => accessToken,
  set(token: string | null) {
    accessToken = token;
    for (const l of authListeners) l(token);
  },
  subscribe(l: (token: string | null) => void) {
    authListeners.add(l);
    return () => authListeners.delete(l);
  },
};

/** Uses the httpOnly refresh cookie to mint a new access token. Deduplicated. */
const SESSION_FLAG = 'tt.session';
export const sessionFlag = {
  get: () => {
    try {
      return localStorage.getItem(SESSION_FLAG) === '1';
    } catch {
      return true;
    }
  },
  set: (on: boolean) => {
    try {
      if (on) localStorage.setItem(SESSION_FLAG, '1');
      else localStorage.removeItem(SESSION_FLAG);
    } catch {
      /* ignore */
    }
  },
};

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        if (!sessionFlag.get()) return null;
        const r = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
        if (!r.ok) {
          if (r.status === 401) sessionFlag.set(false);
          tokenStore.set(null);
          return null;
        }
        const data = (await r.json()) as { accessToken: string };
        sessionFlag.set(true);
        tokenStore.set(data.accessToken);
        return data.accessToken;
      } catch {
        return null;
      } finally {
        setTimeout(() => (refreshPromise = null), 0);
      }
    })();
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  retry?: boolean;
}

export async function request<T>(url: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) body = opts.body;
  else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(url, { method: opts.method || 'GET', headers, body, signal: opts.signal, credentials: 'include' });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new RequestError(0, 'network', 'Network error — check your connection');
  }
  if (res.status === 401 && opts.retry !== false && !url.startsWith('/api/auth/')) {
    const token = await refreshAccessToken();
    if (token) return request<T>(url, { ...opts, retry: false });
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = (data as ApiError)?.error;
    throw new RequestError(res.status, err?.code || 'error', err?.message || `Request failed (${res.status})`, err?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string, signal?: AbortSignal) => request<T>(url, { signal }),
  post: <T>(url: string, body?: unknown) => request<T>(url, { method: 'POST', body }),
  put: <T>(url: string, body?: unknown) => request<T>(url, { method: 'PUT', body }),
  patch: <T>(url: string, body?: unknown) => request<T>(url, { method: 'PATCH', body }),
  del: <T = void>(url: string) => request<T>(url, { method: 'DELETE' }),
  upload: <T>(url: string, files: File[], field = 'file') => {
    const fd = new FormData();
    for (const f of files) fd.append(field, f, f.name);
    return request<T>(url, { method: 'POST', body: fd });
  },
};
