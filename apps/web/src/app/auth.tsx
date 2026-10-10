import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Me } from '../../../../packages/shared/src/types.ts';
import { api, refreshAccessToken, tokenStore, sessionFlag } from '../lib/api.ts';
import { clearCache, setQueryData } from '../lib/query.ts';
import { realtime } from '../lib/realtime.ts';
import { applyTheme, setDensity, uiStore, writeLS } from '../lib/store.ts';

interface AuthResponse {
  accessToken: string;
  user: Me;
  joinedWorkspaceSlug?: string | null;
}

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Me>;
  signup: (input: { name: string; email: string; password: string; inviteToken?: string }) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  setMe: (me: Me) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

function syncPrefs(me: Me) {
  // Server preferences win over local ones once we know them.
  uiStore.set({ theme: me.preferences.theme, density: me.preferences.density });
  writeLS('tt.theme', me.preferences.theme);
  writeLS('tt.density', me.preferences.density);
  applyTheme(me.preferences.theme);
  setDensity(me.preferences.density);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMeState] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const setMe = useCallback((m: Me) => {
    setMeState(m);
    setQueryData('me', m);
    syncPrefs(m);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await refreshAccessToken();
      if (cancelled) return;
      if (token) {
        try {
          const m = await api.get<Me>('/api/auth/me');
          if (!cancelled) setMe(m);
        } catch {
          /* not signed in */
        }
      }
      if (!cancelled) setLoading(false);
    })();
    // If the token gets cleared (refresh failed), drop the session.
    const unsub = tokenStore.subscribe((t) => {
      if (t === null) setMeState(null);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [setMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api.post<AuthResponse>('/api/auth/login', { email, password });
      sessionFlag.set(true);
      tokenStore.set(r.accessToken);
      setMe(r.user);
      return r.user;
    },
    [setMe],
  );

  const signup = useCallback(
    async (input: { name: string; email: string; password: string; inviteToken?: string }) => {
      const r = await api.post<AuthResponse>('/api/auth/signup', { ...input, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      sessionFlag.set(true);
      tokenStore.set(r.accessToken);
      setMe(r.user);
      return r;
    },
    [setMe],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      /* ignore */
    }
    realtime.disconnect();
    sessionFlag.set(false);
    tokenStore.set(null);
    clearCache();
    setMeState(null);
  }, []);

  const refresh = useCallback(async () => {
    const m = await api.get<Me>('/api/auth/me');
    setMe(m);
  }, [setMe]);

  const value = useMemo(() => ({ me, loading, login, signup, logout, setMe, refresh }), [me, loading, login, signup, logout, setMe, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

/** Non-null current user for authenticated routes. */
export function useMe(): Me {
  const { me } = useAuth();
  if (!me) throw new Error('useMe called while signed out');
  return me;
}
