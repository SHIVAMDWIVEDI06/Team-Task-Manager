// A small history-based router: nested routes via <Outlet/>, params, search params, Link, navigate.
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

export interface Location {
  pathname: string;
  search: string;
  hash: string;
}

const listeners = new Set<() => void>();
function snapshot(): Location {
  return { pathname: window.location.pathname, search: window.location.search, hash: window.location.hash };
}
let current = typeof window !== 'undefined' ? snapshot() : { pathname: '/', search: '', hash: '' };

function emit() {
  current = snapshot();
  for (const l of listeners) l();
}
if (typeof window !== 'undefined') window.addEventListener('popstate', emit);

export function navigate(to: string, opts: { replace?: boolean; state?: unknown } = {}) {
  const url = new URL(to, window.location.origin);
  const same = url.pathname === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash;
  if (same && !opts.replace) return;
  if (opts.replace) window.history.replaceState(opts.state ?? null, '', url.pathname + url.search + url.hash);
  else window.history.pushState(opts.state ?? null, '', url.pathname + url.search + url.hash);
  emit();
}

export function useLocation(): Location {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current,
  );
}

export function useNavigate() {
  return navigate;
}

/** Search params as an object + setter that merges (null deletes). */
export function useSearchParams(): [URLSearchParams, (patch: Record<string, string | null | undefined>, opts?: { replace?: boolean }) => void] {
  const loc = useLocation();
  const params = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const set = (patch: Record<string, string | null | undefined>, opts: { replace?: boolean } = {}) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, val] of Object.entries(patch)) {
      if (val === null || val === undefined || val === '') next.delete(k);
      else next.set(k, val);
    }
    const qs = next.toString();
    navigate(window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash, { replace: opts.replace ?? true });
  };
  return [params, set];
}

// ---- Route matching ----
export interface RouteDef {
  path: string; // e.g. "/w/:slug/p/:key" — trailing "/*" allows nested children
  element: ReactNode;
  children?: RouteDef[];
}

interface Match {
  params: Record<string, string>;
  chain: ReactNode[]; // elements from root to leaf
}

function segmentize(p: string) {
  return p.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
}

function matchPath(pattern: string, pathname: string, prefix = true): { params: Record<string, string>; rest: string[] } | null {
  const pSeg = segmentize(pattern);
  const uSeg = segmentize(pathname);
  const params: Record<string, string> = {};
  let i = 0;
  for (; i < pSeg.length; i++) {
    const p = pSeg[i];
    if (p === '*') {
      params['*'] = uSeg.slice(i).join('/');
      return { params, rest: [] };
    }
    const u = uSeg[i];
    if (u === undefined) return null;
    if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(u);
    else if (p !== u) return null;
  }
  const rest = uSeg.slice(i);
  if (!prefix && rest.length) return null;
  return { params, rest };
}

function matchRoutes(routes: RouteDef[], pathname: string, parentParams: Record<string, string> = {}): Match | null {
  for (const r of routes) {
    const hasChildren = Boolean(r.children?.length);
    const m = matchPath(r.path, pathname, hasChildren);
    if (!m) continue;
    const params = { ...parentParams, ...m.params };
    if (hasChildren) {
      const restPath = '/' + m.rest.join('/');
      const child = matchRoutes(r.children!, restPath, params);
      if (child) return { params: child.params, chain: [r.element, ...child.chain] };
      // index route
      const index = r.children!.find((c) => c.path === '' || c.path === '/');
      if (index && m.rest.length === 0) return { params, chain: [r.element, index.element] };
      continue;
    }
    return { params, chain: [r.element] };
  }
  return null;
}

const ParamsContext = createContext<Record<string, string>>({});
const OutletContext = createContext<ReactNode[]>([]);

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useContext(ParamsContext) as T;
}

export function Outlet() {
  const chain = useContext(OutletContext);
  if (!chain.length) return null;
  const [head, ...rest] = chain;
  return <OutletContext.Provider value={rest}>{head}</OutletContext.Provider>;
}

export function Routes({ routes, fallback }: { routes: RouteDef[]; fallback: ReactNode }) {
  const loc = useLocation();
  const match = useMemo(() => matchRoutes(routes, loc.pathname), [routes, loc.pathname]);
  if (!match) return <>{fallback}</>;
  const [head, ...rest] = match.chain;
  return (
    <ParamsContext.Provider value={match.params}>
      <OutletContext.Provider value={rest}>{head}</OutletContext.Provider>
    </ParamsContext.Provider>
  );
}

export function Navigate({ to, replace = true }: { to: string; replace?: boolean }) {
  useEffect(() => {
    navigate(to, { replace });
  }, [to, replace]);
  return null;
}

export function Link({ to, replace, className, children, onClick, ...rest }: { to: string; replace?: boolean; className?: string; children?: ReactNode; onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void; [k: string]: unknown }) {
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to, { replace });
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export function useIsActive(path: string, exact = false): boolean {
  const loc = useLocation();
  return exact ? loc.pathname === path : loc.pathname === path || loc.pathname.startsWith(path + '/');
}
