import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { uiStore } from '../../lib/store.ts';
import { useIsMobile } from '../../lib/hooks.ts';
import { Button, Avatar, cx } from '../../ui/primitives.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { Tooltip } from '../../ui/overlays.tsx';
import { NotificationsPopover } from '../../features/inbox/NotificationsPopover.tsx';
import { presenceStore } from '../../lib/realtime.ts';
import { useMe } from '../auth.tsx';
import { modKey } from '../../lib/format.ts';
import { Link } from '../../lib/router.tsx';

export interface Crumb {
  label: ReactNode;
  to?: string;
}
interface TopbarState {
  crumbs: Crumb[];
  actions: ReactNode;
  title: string;
}
const TopbarCtx = createContext<{ state: TopbarState; set: (s: Partial<TopbarState>) => void } | null>(null);

export function TopbarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TopbarState>({ crumbs: [], actions: null, title: '' });
  const set = (s: Partial<TopbarState>) => setState((p) => ({ ...p, ...s }));
  return <TopbarCtx.Provider value={{ state, set }}>{children}</TopbarCtx.Provider>;
}

/** Pages call this to set breadcrumbs / document title / right-side actions. */
export function useTopbar(crumbs: Crumb[], actions: ReactNode = null, deps: unknown[] = []) {
  const ctx = useContext(TopbarCtx);
  useEffect(() => {
    if (!ctx) return;
    const title = crumbs.map((c) => (typeof c.label === 'string' ? c.label : '')).filter(Boolean).reverse().join(' · ');
    ctx.set({ crumbs, actions, title });
    document.title = title ? `${title} · TeamTask` : 'TeamTask';
    return () => ctx.set({ crumbs: [], actions: null, title: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function Topbar() {
  const ctx = useContext(TopbarCtx);
  const isMobile = useIsMobile();
  const presence = presenceStore.use((s) => s.users);
  const me = useMe();
  const connected = uiStore.use((s) => s.realtimeConnected);
  const others = presence.filter((u) => u.userId !== me.id);
  const crumbs = ctx?.state.crumbs ?? [];
  return (
    <header className="topbar">
      {isMobile ? (
        <Button variant="ghost" size="sm" icon="menu" iconOnly onClick={() => uiStore.set({ mobileSidebarOpen: true })}>
          Open menu
        </Button>
      ) : null}
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i} className="crumb-wrap">
            {i > 0 ? <Icon name="chevron-right" size={13} className="crumb-sep" /> : null}
            {c.to && i < crumbs.length - 1 ? (
              <Link to={c.to} className="crumb">
                {c.label}
              </Link>
            ) : (
              <span className={cx('crumb', i === crumbs.length - 1 && 'is-current')}>{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="topbar-actions">
        {ctx?.state.actions}
        {others.length ? (
          <Tooltip content={`${others.map((u) => u.name).join(', ')} online`} placement="bottom">
            <span className="presence-stack">
              {others.slice(0, 4).map((u) => (
                <Avatar key={u.userId} name={u.name} src={u.avatarUrl} size={22} />
              ))}
              {others.length > 4 ? <span className="presence-more">+{others.length - 4}</span> : null}
            </span>
          </Tooltip>
        ) : null}
        <Tooltip content={connected ? 'Live updates connected' : 'Reconnecting…'} placement="bottom">
          <span className={cx('live-dot', connected && 'is-on')} aria-label={connected ? 'Connected' : 'Reconnecting'} />
        </Tooltip>
        {!isMobile ? (
          <Tooltip content="Search" shortcut={`${modKey} K`} placement="bottom">
            <Button variant="ghost" size="sm" icon="search" iconOnly onClick={() => uiStore.set({ commandOpen: true })}>
              Search
            </Button>
          </Tooltip>
        ) : null}
        <NotificationsPopover />
      </div>
    </header>
  );
}
