// A compact async cache with subscriptions, invalidation, optimistic updates and dedup (TanStack-Query-like).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

interface Entry<T = unknown> {
  data: T | undefined;
  error: Error | null;
  updatedAt: number;
  promise: Promise<T> | null;
  subscribers: Set<() => void>;
  fetcher: (() => Promise<T>) | null;
  stale: boolean;
  version: number;
}

const cache = new Map<string, Entry>();
const globalListeners = new Set<(key: string) => void>();

function entry<T>(key: string): Entry<T> {
  let e = cache.get(key) as Entry<T> | undefined;
  if (!e) {
    e = { data: undefined, error: null, updatedAt: 0, promise: null, subscribers: new Set(), fetcher: null, stale: true, version: 0 };
    cache.set(key, e as Entry);
  }
  return e;
}

function notify(key: string) {
  const e = cache.get(key);
  if (!e) return;
  e.version++;
  for (const s of e.subscribers) s();
  for (const g of globalListeners) g(key);
}

export function fetchQuery<T>(key: string, fetcher: () => Promise<T>, force = false): Promise<T> {
  const e = entry<T>(key);
  e.fetcher = fetcher;
  if (e.promise && !force) return e.promise;
  if (e.promise && force) return e.promise.then(() => fetchQuery(key, fetcher, true));
  const p = fetcher()
    .then((data) => {
      e.data = data;
      e.error = null;
      e.updatedAt = Date.now();
      e.stale = false;
      e.promise = null;
      notify(key);
      return data;
    })
    .catch((err: Error) => {
      e.error = err;
      e.promise = null;
      notify(key);
      throw err;
    });
  e.promise = p;
  notify(key);
  return p;
}

export function getQueryData<T>(key: string): T | undefined {
  return cache.get(key)?.data as T | undefined;
}

export function setQueryData<T>(key: string, updater: T | ((prev: T | undefined) => T | undefined)) {
  const e = entry<T>(key);
  const next = typeof updater === 'function' ? (updater as (p: T | undefined) => T | undefined)(e.data) : updater;
  if (next === undefined) return;
  e.data = next;
  e.error = null;
  e.updatedAt = Date.now();
  e.stale = false;
  notify(key);
}

/** Mark matching queries stale; active ones refetch immediately. */
export function invalidate(prefix: string | string[] | ((key: string) => boolean)) {
  const test = typeof prefix === 'function' ? prefix : (k: string) => (Array.isArray(prefix) ? prefix : [prefix]).some((p) => k === p || k.startsWith(p + ':') || k.startsWith(p + '?'));
  for (const [key, e] of cache) {
    if (!test(key)) continue;
    e.stale = true;
    if (e.subscribers.size && e.fetcher) void fetchQuery(key, e.fetcher, true).catch(() => {});
  }
}

export function removeQueries(prefix: string) {
  for (const key of [...cache.keys()]) if (key === prefix || key.startsWith(prefix + ':')) cache.delete(key);
}

export function clearCache() {
  cache.clear();
}

export function subscribeAll(listener: (key: string) => void) {
  globalListeners.add(listener);
  return () => globalListeners.delete(listener);
}

export interface QueryResult<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean; // no data yet and fetching
  isFetching: boolean;
  refetch: () => Promise<T | undefined>;
}

export interface QueryOptions {
  enabled?: boolean;
  staleTime?: number; // ms; default 30s
  refetchOnFocus?: boolean;
  refetchInterval?: number;
}

export function useQuery<T>(key: string | null, fetcher: () => Promise<T>, opts: QueryOptions = {}): QueryResult<T> {
  const { enabled = true, staleTime = 30_000, refetchOnFocus = true, refetchInterval } = opts;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const active = enabled && key !== null;
  const k = key ?? '__disabled__';

  const subscribe = useCallback(
    (cb: () => void) => {
      if (!active) return () => {};
      const e = entry<T>(k);
      e.subscribers.add(cb);
      return () => {
        e.subscribers.delete(cb);
      };
    },
    [k, active],
  );
  const getSnapshot = useCallback(() => (active ? entry<T>(k).version : -1), [k, active]);
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!active) return;
    const e = entry<T>(k);
    e.fetcher = () => fetcherRef.current();
    const isStale = e.stale || Date.now() - e.updatedAt > staleTime;
    if ((e.data === undefined && !e.promise) || (isStale && !e.promise)) void fetchQuery(k, e.fetcher, false).catch(() => {});
  }, [k, active, staleTime]);

  useEffect(() => {
    if (!active || !refetchOnFocus) return;
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      const e = entry<T>(k);
      if (Date.now() - e.updatedAt > staleTime && e.fetcher && !e.promise) void fetchQuery(k, e.fetcher, false).catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [k, active, refetchOnFocus, staleTime]);

  useEffect(() => {
    if (!active || !refetchInterval) return;
    const id = setInterval(() => {
      const e = entry<T>(k);
      if (e.fetcher && !e.promise && document.visibilityState === 'visible') void fetchQuery(k, e.fetcher, true).catch(() => {});
    }, refetchInterval);
    return () => clearInterval(id);
  }, [k, active, refetchInterval]);

  const e = active ? entry<T>(k) : null;
  const refetch = useCallback(async () => {
    if (!active) return undefined;
    try {
      return await fetchQuery(k, () => fetcherRef.current(), true);
    } catch {
      return undefined;
    }
  }, [k, active]);

  return {
    data: e?.data,
    error: e?.error ?? null,
    isLoading: Boolean(active && e && e.data === undefined && !e.error),
    isFetching: Boolean(e?.promise),
    refetch,
  };
}

export interface MutationOptions<TArgs, TResult> {
  onMutate?: (args: TArgs) => void | (() => void); // return a rollback fn for optimistic updates
  onSuccess?: (result: TResult, args: TArgs) => void;
  onError?: (error: Error, args: TArgs) => void;
  onSettled?: () => void;
}

export function useMutation<TArgs = void, TResult = unknown>(fn: (args: TArgs) => Promise<TResult>, opts: MutationOptions<TArgs, TResult> = {}) {
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const mutateAsync = useCallback(async (args: TArgs): Promise<TResult> => {
    setPending(true);
    setError(null);
    const rollback = optsRef.current.onMutate?.(args);
    try {
      const result = await fnRef.current(args);
      optsRef.current.onSuccess?.(result, args);
      return result;
    } catch (e) {
      if (typeof rollback === 'function') rollback();
      setError(e as Error);
      optsRef.current.onError?.(e as Error, args);
      throw e;
    } finally {
      setPending(false);
      optsRef.current.onSettled?.();
    }
  }, []);
  const mutate = useCallback((args: TArgs) => void mutateAsync(args).catch(() => {}), [mutateAsync]);
  return { mutate, mutateAsync, isPending, error };
}
