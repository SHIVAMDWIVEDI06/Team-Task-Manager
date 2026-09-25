import { useEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from '../../lib/router.tsx';
import { uiStore, toggleSidebar } from '../../lib/store.ts';
import { useIsMobile, useHotkey } from '../../lib/hooks.ts';
import { Sidebar } from './Sidebar.tsx';
import { Topbar } from './Topbar.tsx';
import { cx } from '../../ui/primitives.tsx';
import { CommandPalette } from '../../features/command/CommandPalette.tsx';
import { CreateTaskHost } from '../../features/tasks/CreateTaskDialog.tsx';
import { TaskPanelHost } from '../../features/tasks/TaskPanel.tsx';
import { navigate } from '../../lib/router.tsx';
import { useWorkspace } from '../workspace.tsx';
import { ShortcutsDialog } from './ShortcutsDialog.tsx';
import { OfflineBanner } from './OfflineBanner.tsx';

export function AppShell({ children }: { children?: ReactNode }) {
  const collapsed = uiStore.use((s) => s.sidebarCollapsed);
  const mobileOpen = uiStore.use((s) => s.mobileSidebarOpen);
  const isMobile = useIsMobile();
  const loc = useLocation();
  const { base } = useWorkspace();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    if (isMobile) uiStore.set({ mobileSidebarOpen: false });
  }, [loc.pathname, isMobile]);

  // Global shortcuts
  useHotkey('mod+k', () => uiStore.set({ commandOpen: true }), { allowInInput: true });
  useHotkey('c', () => uiStore.set({ createTaskOpen: true }));
  useHotkey('mod+b', () => toggleSidebar(), { allowInInput: true });
  useHotkey('shift+?', () => setShortcutsOpen(true));
  useHotkey('g h', () => navigate(base));
  useHotkey('g m', () => navigate(`${base}/my-work`));
  useHotkey('g i', () => navigate(`${base}/inbox`));
  useHotkey('g p', () => navigate(`${base}/projects`));
  useHotkey('g t', () => navigate(`${base}/team`));
  useHotkey('g a', () => navigate(`${base}/activity`));
  useHotkey('g s', () => navigate(`${base}/settings`));

  return (
    <div className={cx('shell', collapsed && !isMobile && 'is-collapsed', isMobile && 'is-mobile')}>
      {isMobile && mobileOpen ? <div className="shell-scrim" onClick={() => uiStore.set({ mobileSidebarOpen: false })} /> : null}
      <Sidebar collapsed={collapsed && !isMobile} mobileOpen={isMobile && mobileOpen} />
      <div className="shell-main">
        <OfflineBanner />
        <Topbar />
        <main className="shell-content" id="main">
          {children ?? <Outlet />}
        </main>
      </div>
      <TaskPanelHost />
      <CreateTaskHost />
      <CommandPalette onOpenShortcuts={() => setShortcutsOpen(true)} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
