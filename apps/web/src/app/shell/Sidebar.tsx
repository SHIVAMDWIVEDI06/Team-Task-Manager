import { useRef, useState } from 'react';
import { Link, useIsActive, useLocation, navigate } from '../../lib/router.tsx';
import { uiStore, toggleSidebar } from '../../lib/store.ts';
import { useWorkspace } from '../workspace.tsx';
import { useAuth, useMe } from '../auth.tsx';
import { useNotifications, useWorkspaces } from '../data.ts';
import { Icon, type IconName } from '../../ui/Icon.tsx';
import { Avatar, Button, cx, Kbd } from '../../ui/primitives.tsx';
import { Menu, Tooltip } from '../../ui/overlays.tsx';
import { modKey } from '../../lib/format.ts';
import { setTheme } from '../../lib/store.ts';
import { CreateProjectDialog } from '../../features/projects/CreateProjectDialog.tsx';

function NavItem({ to, icon, label, exact, badge, collapsed, shortcut }: { to: string; icon: IconName | string; label: string; exact?: boolean; badge?: number; collapsed: boolean; shortcut?: string }) {
  const active = useIsActive(to, exact);
  const content = (
    <Link to={to} className={cx('nav-item', active && 'is-active')} aria-current={active ? 'page' : undefined}>
      <Icon name={icon} size={17} />
      {!collapsed ? <span className="nav-label">{label}</span> : null}
      {badge ? <span className={cx('nav-badge', collapsed && 'is-dot')}>{collapsed ? '' : badge > 99 ? '99+' : badge}</span> : null}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={label} placement="right" shortcut={shortcut}>
      {content}
    </Tooltip>
  ) : (
    content
  );
}

export function Sidebar({ collapsed, mobileOpen }: { collapsed: boolean; mobileOpen: boolean }) {
  const { workspace, projects, base, canEdit } = useWorkspace();
  const me = useMe();
  const { logout } = useAuth();
  const notifications = useNotifications();
  const workspaces = useWorkspaces();
  const loc = useLocation();
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [createProject, setCreateProject] = useState(false);
  const wsRef = useRef<HTMLButtonElement | null>(null);
  const userRef = useRef<HTMLButtonElement | null>(null);
  const theme = uiStore.use((s) => s.theme);
  const unread = notifications.data?.unread ?? 0;
  const activeProjects = projects.filter((p) => p.state === 'active');

  return (
    <aside className={cx('sidebar', collapsed && 'is-collapsed', mobileOpen && 'is-open')} aria-label="Sidebar">
      <div className="sidebar-top">
        <button ref={wsRef} type="button" className="ws-switcher" onClick={() => setWsMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={wsMenuOpen} title={workspace.name}>
          <Avatar name={workspace.name} src={workspace.logoUrl} size={26} square />
          {!collapsed ? (
            <>
              <span className="ws-name truncate">{workspace.name}</span>
              <Icon name="chevrons-updown" size={14} className="muted" />
            </>
          ) : null}
        </button>
        <Menu
          open={wsMenuOpen}
          onClose={() => setWsMenuOpen(false)}
          anchorRef={wsRef}
          width={240}
          header={me.email}
          items={[
            ...(workspaces.data ?? []).map((w) => ({ key: w.id, label: w.name, checked: w.id === workspace.id, onSelect: () => navigate(`/w/${w.slug}`), description: w.role })),
            { separator: true, label: '' },
            { label: 'Workspace settings', icon: 'settings', onSelect: () => navigate(`${base}/settings`) },
            { label: 'Invite members', icon: 'user-plus', onSelect: () => navigate(`${base}/settings/members?invite=1`) },
            { label: 'Create workspace', icon: 'plus', onSelect: () => navigate('/onboarding?new=1') },
          ]}
        />
        {!collapsed ? (
          <Tooltip content="Collapse sidebar" shortcut={`${modKey} B`} placement="right">
            <Button variant="ghost" size="sm" icon="panel-left" iconOnly onClick={toggleSidebar} className="sidebar-collapse">
              Collapse sidebar
            </Button>
          </Tooltip>
        ) : null}
      </div>

      <div className="sidebar-actions">
        <Tooltip content="Create task" shortcut="C" placement="right">
          <Button variant="primary" size="sm" icon="plus" iconOnly={collapsed} className="w-full" onClick={() => uiStore.set({ createTaskOpen: true })} disabled={!canEdit}>
            New task
          </Button>
        </Tooltip>
        {!collapsed ? (
          <Tooltip content="Search & commands" shortcut={`${modKey} K`} placement="right">
            <Button variant="outline" size="sm" icon="search" iconOnly onClick={() => uiStore.set({ commandOpen: true })}>
              Search
            </Button>
          </Tooltip>
        ) : null}
      </div>

      <nav className="sidebar-nav">
        <NavItem to={base} icon="home" label="Home" exact collapsed={collapsed} shortcut="G H" />
        <NavItem to={`${base}/my-work`} icon="check-square" label="My work" collapsed={collapsed} shortcut="G M" />
        <NavItem to={`${base}/inbox`} icon="inbox" label="Inbox" badge={unread} collapsed={collapsed} shortcut="G I" />
        <NavItem to={`${base}/team`} icon="users" label="Team" collapsed={collapsed} shortcut="G T" />
        <NavItem to={`${base}/activity`} icon="activity" label="Activity" collapsed={collapsed} shortcut="G A" />

        <div className="sidebar-section">
          {!collapsed ? (
            <div className="sidebar-section-head">
              <Link to={`${base}/projects`} className={cx('sidebar-section-title', loc.pathname === `${base}/projects` && 'is-active')}>
                Projects
              </Link>
              {canEdit ? (
                <Tooltip content="New project" placement="right">
                  <Button variant="ghost" size="sm" icon="plus" iconOnly onClick={() => setCreateProject(true)}>
                    New project
                  </Button>
                </Tooltip>
              ) : null}
            </div>
          ) : (
            <NavItem to={`${base}/projects`} icon="folder" label="Projects" exact collapsed={collapsed} shortcut="G P" />
          )}
          <div className="sidebar-projects">
            {activeProjects.map((p) => {
              const to = `${base}/p/${p.key}`;
              const active = loc.pathname === to || loc.pathname.startsWith(to + '/');
              const item = (
                <Link key={p.id} to={to} className={cx('nav-item nav-project', active && 'is-active')} title={p.name}>
                  <span className="project-icon" style={{ background: p.color }}>
                    {p.icon}
                  </span>
                  {!collapsed ? (
                    <>
                      <span className="nav-label truncate">{p.name}</span>
                      {p.visibility === 'private' ? <Icon name="lock" size={12} className="faint" /> : null}
                    </>
                  ) : null}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={p.id} content={p.name} placement="right">
                  {item}
                </Tooltip>
              ) : (
                item
              );
            })}
            {!activeProjects.length && !collapsed ? <div className="sidebar-empty">No projects yet</div> : null}
          </div>
        </div>
      </nav>

      <div className="sidebar-bottom">
        {!collapsed ? (
          <button type="button" className="sidebar-help" onClick={() => uiStore.set({ commandOpen: true })}>
            <span className="row gap-2 muted small">
              <Icon name="keyboard" size={14} /> Shortcuts
            </span>
            <Kbd>?</Kbd>
          </button>
        ) : null}
        <button ref={userRef} type="button" className="user-menu-trigger" onClick={() => setUserMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={userMenuOpen} title={me.name}>
          <Avatar name={me.name} src={me.avatarUrl} size={28} online />
          {!collapsed ? (
            <span className="col grow" style={{ minWidth: 0 }}>
              <span className="truncate medium" style={{ fontSize: 'var(--fs-md)' }}>{me.name}</span>
              <span className="truncate xs muted">{me.email}</span>
            </span>
          ) : null}
        </button>
        <Menu
          open={userMenuOpen}
          onClose={() => setUserMenuOpen(false)}
          anchorRef={userRef}
          placement="top"
          width={230}
          items={[
            { label: 'Profile & preferences', icon: 'user', onSelect: () => navigate(`${base}/account`) },
            { label: 'Notifications', icon: 'bell', onSelect: () => navigate(`${base}/account/notifications`) },
            { separator: true, label: '' },
            { label: 'Theme: System', icon: 'monitor', checked: theme === 'system', onSelect: () => setTheme('system') },
            { label: 'Theme: Light', icon: 'sun', checked: theme === 'light', onSelect: () => setTheme('light') },
            { label: 'Theme: Dark', icon: 'moon', checked: theme === 'dark', onSelect: () => setTheme('dark') },
            { separator: true, label: '' },
            { label: 'Sign out', icon: 'log-out', onSelect: () => void logout().then(() => navigate('/login')) },
          ]}
        />
      </div>
      <CreateProjectDialog open={createProject} onClose={() => setCreateProject(false)} />
    </aside>
  );
}
