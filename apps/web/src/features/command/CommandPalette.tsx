// Command palette (mod+K): actions, navigation, projects, recent tasks and server search.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { Project, Task, User } from '../../../../../packages/shared/src/types.ts';
import { useSearch } from '../../app/data.ts';
import { useWorkspace } from '../../app/workspace.tsx';
import { useAuth } from '../../app/auth.tsx';
import { navigate, useLocation } from '../../lib/router.tsx';
import { setTheme, uiStore } from '../../lib/store.ts';
import { useDebouncedValue } from '../../lib/hooks.ts';
import { modKey } from '../../lib/format.ts';
import { Dialog } from '../../ui/overlays.tsx';
import { ListPicker, type PickerItem } from '../../ui/pickers.tsx';
import { Avatar, Kbd, StatusIcon, cx } from '../../ui/primitives.tsx';
import { Icon, type IconName } from '../../ui/Icon.tsx';
import { ProjectBadge } from '../tasks/fields.tsx';
import { openTaskAnywhere, readRecentTasks, type RecentTask } from '../tasks/TaskRow.tsx';
import { CreateProjectDialog } from '../projects/CreateProjectDialog.tsx';
import './command.css';

type Entry =
  | { kind: 'action'; icon: IconName | string; run: () => void; checked?: boolean }
  | { kind: 'project'; project: Project; run: () => void }
  | { kind: 'view'; project: Project; run: () => void; icon: IconName | string }
  | { kind: 'task'; task: Task; run: () => void }
  | { kind: 'recent'; recent: RecentTask; run: () => void }
  | { kind: 'member'; user: User; run: () => void }
  | { kind: 'jump'; key: string; run: () => void };

const TASK_KEY_RE = /^([a-z][a-z0-9]{1,5})-(\d+)$/i;

/** Every word of the query must appear somewhere in the haystack. */
function matches(hay: string, q: string): boolean {
  if (!q) return true;
  const h = hay.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => h.includes(w));
}

export function CommandPalette({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  const open = uiStore.use((s) => s.commandOpen);
  const [createProject, setCreateProject] = useState(false);
  const close = () => uiStore.set({ commandOpen: false });
  return (
    <>
      <Dialog open={open} onClose={close} hideClose className="cmdk" size="md">
        {open ? <Palette onClose={close} onOpenShortcuts={onOpenShortcuts} onCreateProject={() => setCreateProject(true)} /> : null}
      </Dialog>
      <CreateProjectDialog open={createProject} onClose={() => setCreateProject(false)} />
    </>
  );
}

function Palette({ onClose, onOpenShortcuts, onCreateProject }: { onClose: () => void; onOpenShortcuts: () => void; onCreateProject: () => void }) {
  const ws = useWorkspace();
  const { logout } = useAuth();
  const loc = useLocation();
  const theme = uiStore.use((s) => s.theme);
  const [query, setQuery] = useState('');
  const actionsOnly = query.startsWith('>');
  const q = (actionsOnly ? query.slice(1) : query).trim();
  const debounced = useDebouncedValue(q, 180);
  const searchQ = !actionsOnly && debounced.length >= 2 ? debounced : '';
  const search = useSearch(ws.workspace.id, searchQ);
  const searching = Boolean(searchQ) && (search.isLoading || (search.isFetching && !search.data));
  const stale = Boolean(q.length >= 2 && !actionsOnly && debounced !== q);
  const recent = useMemo(() => readRecentTasks(ws.workspace.id), [ws.workspace.id]);
  const entries = useRef(new Map<string, Entry>());
  entries.current.clear();

  const base = ws.base;
  const routeProject = useMemo(() => {
    const m = /\/p\/([^/?#]+)/.exec(loc.pathname.slice(base.length));
    return m ? ws.projectByKey(decodeURIComponent(m[1])) : undefined;
  }, [loc.pathname, base, ws]);

  const go = (to: string) => () => navigate(to);
  const add = (value: string, item: Omit<PickerItem<string>, 'value'>, entry: Entry): PickerItem<string> => {
    entries.current.set(value, entry);
    // ListPicker filters by label/keywords on its own; we already filtered, so let the raw query pass through.
    return { value, ...item, keywords: `${item.keywords ?? ''} ${query}` };
  };

  const items: PickerItem<string>[] = [];
  let projectHit = false; // a project's name/key matched the query → list projects (and their views) first

  // ---- Direct task-key jump ("APP-12") ----
  const keyMatch = TASK_KEY_RE.exec(q);
  if (keyMatch && !actionsOnly) {
    const key = `${keyMatch[1].toUpperCase()}-${keyMatch[2]}`;
    items.push(add(`jump:${key}`, { label: `Open ${key}`, description: 'Jump straight to this task', section: 'Go to', shortcut: '↵' }, { kind: 'jump', key, run: () => openTaskAnywhere(base, { key, title: key }, ws.workspace.id) }));
  }

  // ---- Actions ----
  const actions: { id: string; label: string; icon: IconName | string; keywords?: string; shortcut?: string; run: () => void; checked?: boolean; description?: string }[] = [
    ...(ws.canEdit ? [{ id: 'create-task', label: 'Create task', icon: 'plus', shortcut: 'C', keywords: 'new add issue', run: () => uiStore.set({ createTaskOpen: routeProject ? { projectId: routeProject.id } : true }) }] : []),
    ...(ws.canEdit ? [{ id: 'create-project', label: 'Create project', icon: 'folder-plus', keywords: 'new add', run: onCreateProject }] : []),
    { id: 'go-home', label: 'Go to Home', icon: 'home', shortcut: 'G H', keywords: 'dashboard', run: go(base) },
    { id: 'go-my-work', label: 'Go to My work', icon: 'square-check-big', shortcut: 'G M', keywords: 'assigned tasks', run: go(`${base}/my-work`) },
    { id: 'go-inbox', label: 'Go to Inbox', icon: 'inbox', shortcut: 'G I', keywords: 'notifications', run: go(`${base}/inbox`) },
    { id: 'go-projects', label: 'Go to Projects', icon: 'folder', shortcut: 'G P', run: go(`${base}/projects`) },
    { id: 'go-team', label: 'Go to Team', icon: 'users', shortcut: 'G T', keywords: 'members people', run: go(`${base}/team`) },
    { id: 'go-activity', label: 'Go to Activity', icon: 'activity', shortcut: 'G A', keywords: 'feed history', run: go(`${base}/activity`) },
    { id: 'go-settings', label: 'Go to Settings', icon: 'settings', shortcut: 'G S', keywords: 'workspace preferences', run: go(`${base}/settings`) },
    { id: 'go-account', label: 'Account settings', icon: 'user', keywords: 'profile preferences password', run: go(`${base}/account`) },
    { id: 'theme-light', label: 'Theme: Light', icon: 'sun', keywords: 'toggle theme appearance', checked: theme === 'light', run: () => setTheme('light') },
    { id: 'theme-dark', label: 'Theme: Dark', icon: 'moon', keywords: 'toggle theme appearance', checked: theme === 'dark', run: () => setTheme('dark') },
    { id: 'theme-system', label: 'Theme: System', icon: 'monitor', keywords: 'toggle theme appearance auto', checked: theme === 'system', run: () => setTheme('system') },
    { id: 'shortcuts', label: 'Keyboard shortcuts', icon: 'keyboard', shortcut: '?', keywords: 'help keys', run: onOpenShortcuts },
    { id: 'sign-out', label: 'Sign out', icon: 'log-out', keywords: 'logout leave', run: () => void logout().then(() => navigate('/login')) },
  ];
  for (const a of actions) {
    if (!matches(`${a.label} ${a.keywords ?? ''}`, q)) continue;
    items.push(add(`action:${a.id}`, { label: a.label, description: a.description, section: 'Actions', shortcut: a.shortcut, keywords: a.keywords }, { kind: 'action', icon: a.icon, run: a.run, checked: a.checked }));
  }

  if (!actionsOnly) {
    // ---- Projects (+ view sub-actions when the query names the project) ----
    const projects = ws.projects.filter((p) => p.state === 'active' && matches(`${p.name} ${p.key}`, q));
    projectHit = Boolean(q) && projects.length > 0 && projects.length <= 2;
    for (const p of projects.slice(0, q ? 6 : 8)) {
      items.push(add(`project:${p.id}`, { label: p.name, description: p.key, section: 'Projects' }, { kind: 'project', project: p, run: go(`${base}/p/${p.key}`) }));
      if (q && projects.length <= 2) {
        const views: { kind: 'board' | 'list' | 'calendar' | 'timeline'; label: string }[] = [
          { kind: 'board', label: 'Board' },
          { kind: 'list', label: 'List' },
          { kind: 'calendar', label: 'Calendar' },
          { kind: 'timeline', label: 'Timeline' },
        ];
        for (const v of views) items.push(add(`view:${p.id}:${v.kind}`, { label: `${p.name} › ${v.label}`, section: 'Projects' }, { kind: 'view', project: p, icon: v.kind, run: go(`${base}/p/${p.key}${v.kind === 'board' ? '' : `?view=${v.kind}`}`) }));
      }
    }

    // ---- Server search results ----
    if (searchQ && search.data) {
      const seen = new Set<string>();
      for (const t of search.data.tasks.slice(0, projectHit ? 6 : 12)) {
        seen.add(t.key);
        items.push(add(`task:${t.id}`, { label: t.title, section: 'Tasks' }, { kind: 'task', task: t, run: () => openTaskAnywhere(base, t, ws.workspace.id) }));
      }
      for (const p of search.data.projects) {
        if (items.some((i) => i.value === `project:${p.id}`)) continue;
        items.push(add(`project:${p.id}`, { label: p.name, description: p.key, section: 'Projects' }, { kind: 'project', project: p, run: go(`${base}/p/${p.key}`) }));
      }
      for (const u of search.data.members.slice(0, 6)) items.push(add(`member:${u.id}`, { label: u.name, description: u.email, section: 'Members' }, { kind: 'member', user: u, run: go(`${base}/team`) }));
      // Recent tasks that also match but were not returned (e.g. archived)
      for (const r of recent) if (!seen.has(r.key) && matches(`${r.key} ${r.title}`, q)) items.push(add(`recent:${r.key}`, { label: r.title, section: 'Recent tasks' }, { kind: 'recent', recent: r, run: () => openTaskAnywhere(base, { key: r.key, title: r.title, projectKey: r.projectKey }, ws.workspace.id) }));
    } else {
      // ---- Recent tasks ----
      for (const r of recent.filter((r) => matches(`${r.key} ${r.title}`, q))) items.push(add(`recent:${r.key}`, { label: r.title, section: 'Recent tasks' }, { kind: 'recent', recent: r, run: () => openTaskAnywhere(base, { key: r.key, title: r.title, projectKey: r.projectKey }, ws.workspace.id) }));
    }
  }

  // Sort so sections stay grouped in a sensible order.
  const order: Record<string, number> = { 'Go to': 0, Tasks: projectHit ? 2 : 1, Actions: q ? 3 : 2, Projects: projectHit ? 1 : q ? 2 : 3, Members: 4, 'Recent tasks': q ? 5 : 1 };
  const sorted = items.map((it, i) => ({ it, i })).sort((a, b) => (order[a.it.section ?? ''] ?? 9) - (order[b.it.section ?? ''] ?? 9) || a.i - b.i).map(({ it }) => it);

  const select = (value: string) => {
    const e = entries.current.get(value);
    if (!e) return;
    onClose();
    // run after the dialog has unregistered its layer so nested dialogs/popovers stack correctly
    setTimeout(() => e.run(), 0);
  };

  const renderItem = (item: PickerItem<string>): ReactNode => {
    const e = entries.current.get(item.value);
    if (!e) return null;
    switch (e.kind) {
      case 'task': {
        const t = e.task;
        return (
          <>
            <span className="picker-icon">
              <StatusIcon category={t.statusCategory || 'todo'} color={t.statusColor || 'var(--fg-faint)'} size={15} />
            </span>
            <span className="cmdk-task">
              <span className="task-key mono">{t.key}</span>
              <span className={cx('cmdk-task-title truncate', (t.statusCategory === 'done' || t.statusCategory === 'cancelled') && 'is-done')}>{t.title}</span>
            </span>
            <span className="cmdk-task-right">
              <ProjectBadge projectKey={t.projectKey} color={t.projectColor} name={t.projectName} />
              {t.assignee ? <Avatar name={t.assignee.name} src={t.assignee.avatarUrl} size={18} /> : null}
            </span>
          </>
        );
      }
      case 'recent': {
        const r = e.recent;
        return (
          <>
            <span className="picker-icon">
              <StatusIcon category={r.statusCategory || 'todo'} color={r.statusColor || 'var(--fg-faint)'} size={15} />
            </span>
            <span className="cmdk-task">
              <span className="task-key mono">{r.key}</span>
              <span className="cmdk-task-title truncate">{r.title}</span>
            </span>
            <span className="cmdk-task-right">{r.projectKey ? <ProjectBadge projectKey={r.projectKey} color={r.projectColor} /> : null}</span>
          </>
        );
      }
      case 'project':
        return (
          <>
            <span className="picker-icon">
              <span className="project-icon cmdk-project-icon" style={{ background: e.project.color }} aria-hidden>{e.project.icon}</span>
            </span>
            <span className="picker-label">
              <span className="truncate">{e.project.name}</span>
            </span>
            <span className="picker-right mono xs">{e.project.key}</span>
          </>
        );
      case 'view':
        return (
          <>
            <span className="picker-icon cmdk-indent"><Icon name={e.icon} size={15} /></span>
            <span className="picker-label"><span className="truncate">{item.label}</span></span>
          </>
        );
      case 'member':
        return (
          <>
            <span className="picker-icon"><Avatar name={e.user.name} src={e.user.avatarUrl} size={20} /></span>
            <span className="picker-label">
              <span className="truncate">{e.user.name}</span>
              <span className="picker-desc truncate">{e.user.email}</span>
            </span>
          </>
        );
      case 'jump':
        return (
          <>
            <span className="picker-icon"><Icon name="arrow-up-right" size={15} /></span>
            <span className="picker-label">
              <span className="truncate">{item.label}</span>
              <span className="picker-desc truncate">{item.description}</span>
            </span>
            <Kbd className="picker-shortcut">↵</Kbd>
          </>
        );
      case 'action':
      default:
        return (
          <>
            <span className="picker-icon"><Icon name={e.icon} size={15} /></span>
            <span className="picker-label">
              <span className="truncate">{item.label}</span>
              {item.description ? <span className="picker-desc truncate">{item.description}</span> : null}
            </span>
            {e.checked ? <Icon name="check" size={14} className="picker-selected-mark" /> : null}
            {item.shortcut ? (
              <span className="cmdk-kbds">
                {item.shortcut.split(' ').map((k, i) => (
                  <Kbd key={i}>{k}</Kbd>
                ))}
              </span>
            ) : null}
          </>
        );
    }
  };

  return (
    <div className={cx('cmdk-panel', actionsOnly && 'is-actions')}>
      <ListPicker<string>
        items={sorted}
        query={query}
        onQueryChange={setQuery}
        onSelect={select}
        searchable
        autoFocus
        placeholder={actionsOnly ? 'Run a command…' : 'Search tasks, projects, people… or type > for commands'}
        loading={searching || stale}
        maxHeight={440}
        renderItem={renderItem}
        emptyText={
          searching || stale ? (
            <span className="row gap-2 center"><Icon name="loader" size={14} className="spinner" /> Searching…</span>
          ) : q.length === 1 && !actionsOnly ? (
            'Keep typing to search'
          ) : (
            <span className="col gap-1" style={{ alignItems: 'center' }}>
              <span>No results for “{q}”</span>
              <span className="xs faint">Try a task key like APP-12, or &gt; for commands</span>
            </span>
          )
        }
        className="cmdk-picker"
        footer={
          <span className="cmdk-footer">
            <span className="row gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
            <span className="row gap-1"><Kbd>↵</Kbd> select</span>
            <span className="row gap-1"><Kbd>esc</Kbd> close</span>
            <span className="grow" />
            <span className="row gap-1 faint"><Kbd>&gt;</Kbd> commands · <Kbd>{modKey}</Kbd><Kbd>K</Kbd></span>
          </span>
        }
      />
    </div>
  );
}
