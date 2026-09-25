// My work: every task assigned to me across projects, with tabs, grouping, inline edits and j/k navigation.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Task, TaskStatus } from '../../../../../packages/shared/src/types.ts';
import { diffDays, todayISO } from '../../../../../packages/shared/src/utils.ts';
import { keys, updateTask, useBundle, useMyTasks, type TaskPatch } from '../../app/data.ts';
import { useWorkspace } from '../../app/workspace.tsx';
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { useSearchParams } from '../../lib/router.tsx';
import { setQueryData } from '../../lib/query.ts';
import { toast } from '../../lib/toast.ts';
import { useHotkey, useLocalStorage } from '../../lib/hooks.ts';
import { formatDate, pluralize } from '../../lib/format.ts';
import { Button, EmptyState, Kbd, Segmented, Switch, cx } from '../../ui/primitives.tsx';
import { Tabs } from '../../ui/overlays.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { TaskRow, TaskRowSkeleton, useOpenTask } from '../tasks/TaskRow.tsx';
import { openCreateTask } from '../tasks/CreateTaskDialog.tsx';
import { useMe } from '../../app/auth.tsx';
import './my-work.css';

type Tab = 'all' | 'overdue' | 'today' | 'week' | 'nodate';
type GroupBy = 'project' | 'date';
const TABS: Tab[] = ['all', 'overdue', 'today', 'week', 'nodate'];

const isDone = (t: Task) => t.statusCategory === 'done' || t.statusCategory === 'cancelled';

function tabOf(t: Task, today: string): Exclude<Tab, 'all'> | null {
  if (!t.dueDate) return 'nodate';
  if (isDone(t)) return null;
  if (t.dueDate < today) return 'overdue';
  if (t.dueDate === today) return 'today';
  if (diffDays(today, t.dueDate) <= 7) return 'week';
  return null;
}

function dateBucket(t: Task, today: string): { key: string; label: string; order: number } {
  if (!t.dueDate) return { key: 'none', label: 'No due date', order: 9 };
  if (isDone(t)) return { key: 'done', label: 'Completed', order: 8 };
  const d = diffDays(today, t.dueDate);
  if (d < 0) return { key: 'overdue', label: 'Overdue', order: 0 };
  if (d === 0) return { key: 'today', label: 'Today', order: 1 };
  if (d === 1) return { key: 'tomorrow', label: 'Tomorrow', order: 2 };
  if (d <= 7) return { key: 'week', label: 'This week', order: 3 };
  if (d <= 14) return { key: 'next', label: 'Next week', order: 4 };
  return { key: 'later', label: 'Later', order: 5 };
}

interface Group {
  key: string;
  label: string;
  color?: string;
  icon?: string;
  projectKey?: string;
  tasks: Task[];
}

/** Row that knows its project's statuses so status/priority/due can be edited inline. */
function EditableRow({ task, active, index, onPatch, canEdit, onOpen }: { task: Task; active: boolean; index: number; onPatch: (task: Task, patch: TaskPatch, statuses: TaskStatus[]) => void; canEdit: boolean; onOpen: (t: Task) => void }) {
  const bundle = useBundle(canEdit ? task.projectId : null);
  const statuses = useMemo(() => [...(bundle.data?.statuses ?? [])].sort((a, b) => a.position - b.position), [bundle.data?.statuses]);
  return <TaskRow task={task} active={active} data-index={index} showAssignee={false} statuses={statuses} onPatch={canEdit ? (p) => onPatch(task, p, statuses) : undefined} onOpen={onOpen} />;
}

export function MyWorkPage() {
  const ws = useWorkspace();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const tasksQ = useMyTasks(ws.workspace.id);
  const openTask = useOpenTask();
  const today = todayISO();

  const filterParam = params.get('filter');
  const [tab, setTabState] = useState<Tab>(() => (TABS.includes(filterParam as Tab) ? (filterParam as Tab) : 'all'));
  const [showCompleted, setShowCompleted] = useLocalStorage<boolean>('tt.mywork.completed', false);
  const [groupBy, setGroupBy] = useLocalStorage<GroupBy>('tt.mywork.group', 'project');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLDivElement | null>(null);

  useTopbar([{ label: 'My work' }]);

  // Honor ?filter=overdue|today|week|completed from the Home tiles.
  useEffect(() => {
    if (!filterParam) return;
    if (filterParam === 'completed') {
      setShowCompleted(true);
      setTabState('all');
    } else if (TABS.includes(filterParam as Tab)) setTabState(filterParam as Tab);
    setParams({ filter: null }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterParam]);

  const setTab = (t: Tab) => {
    setTabState(t);
    setActive(-1);
  };

  const all = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);
  const visibleBase = useMemo(() => all.filter((t) => showCompleted || !isDone(t)), [all, showCompleted]);
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: 0, overdue: 0, today: 0, week: 0, nodate: 0 };
    for (const t of visibleBase) {
      c.all++;
      const k = tabOf(t, today);
      if (k) c[k]++;
      if (k === 'today') c.week++;
    }
    return c;
  }, [visibleBase, today]);
  const openCount = useMemo(() => all.filter((t) => !isDone(t)).length, [all]);
  const doneCount = all.length - openCount;

  const filtered = useMemo(() => {
    if (tab === 'all') return visibleBase;
    return visibleBase.filter((t) => {
      const k = tabOf(t, today);
      return tab === 'week' ? k === 'week' || k === 'today' : k === tab;
    });
  }, [visibleBase, tab, today]);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group & { order: number }>();
    for (const t of filtered) {
      if (groupBy === 'project') {
        const p = ws.projectById(t.projectId);
        const key = t.projectId;
        if (!map.has(key)) map.set(key, { key, label: p?.name ?? t.projectName ?? t.projectKey ?? 'Project', color: p?.color ?? t.projectColor, icon: p?.icon, projectKey: p?.key ?? t.projectKey, tasks: [], order: ws.projects.findIndex((x) => x.id === key) });
        map.get(key)!.tasks.push(t);
      } else {
        const b = dateBucket(t, today);
        if (!map.has(b.key)) map.set(b.key, { key: b.key, label: b.label, tasks: [], order: b.order });
        map.get(b.key)!.tasks.push(t);
      }
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [filtered, groupBy, ws, today]);

  // Flattened list of rows (respecting collapsed groups) for j/k navigation.
  const flat = useMemo(() => groups.filter((g) => !collapsed.has(g.key)).flatMap((g) => g.tasks), [groups, collapsed]);
  useEffect(() => {
    if (active >= flat.length) setActive(flat.length - 1);
  }, [flat.length, active]);
  useEffect(() => {
    if (active < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const overlayOpen = () => Boolean(document.querySelector('.popover, .dialog-overlay'));
  useHotkey('j', () => { if (!overlayOpen()) setActive((a) => Math.min(flat.length - 1, a + 1)); });
  useHotkey('k', () => { if (!overlayOpen()) setActive((a) => Math.max(0, a - 1)); });
  useHotkey('enter', () => { if (!overlayOpen() && active >= 0 && flat[active]) openTask(flat[active]); });
  useHotkey('esc', () => setActive(-1), { enabled: active >= 0 });

  const patch = useCallback(
    (task: Task, p: TaskPatch, statuses: TaskStatus[]) => {
      const st = p.statusId ? statuses.find((s) => s.id === p.statusId) : undefined;
      const optimistic: Partial<Task> = { ...(p as Partial<Task>), ...(st ? { statusName: st.name, statusCategory: st.category, statusColor: st.color, completedAt: st.category === 'done' ? new Date().toISOString() : null } : {}) };
      const key = keys.myTasks(ws.workspace.id);
      setQueryData<Task[]>(key, (prev) => (prev ? prev.map((t) => (t.id === task.id ? { ...t, ...optimistic } : t)) : prev));
      updateTask(task, p, optimistic)
        .then((updated) => setQueryData<Task[]>(key, (prev) => (prev ? prev.map((t) => (t.id === task.id ? { ...t, ...updated } : t)) : prev)))
        .catch((e) => {
          setQueryData<Task[]>(key, (prev) => (prev ? prev.map((t) => (t.id === task.id ? task : t)) : prev));
          toast.fromError(e);
        });
    },
    [ws.workspace.id],
  );

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const loading = tasksQ.isLoading && !tasksQ.data;
  const tabItems = [
    { value: 'all' as Tab, label: 'All', count: counts.all },
    { value: 'overdue' as Tab, label: 'Overdue', count: counts.overdue },
    { value: 'today' as Tab, label: 'Today', count: counts.today },
    { value: 'week' as Tab, label: 'This week', count: counts.week },
    { value: 'nodate' as Tab, label: 'No date', count: counts.nodate },
  ];
  const emptyCopy: Record<Tab, { title: string; description: string; icon: string }> = {
    all: { title: showCompleted ? 'Nothing assigned to you' : "You're all caught up 🎉", description: showCompleted ? 'Tasks assigned to you will appear here.' : 'No open tasks are assigned to you right now.', icon: 'smile' },
    overdue: { title: 'Nothing overdue 🎉', description: 'Every task assigned to you is on schedule.', icon: 'circle-check' },
    today: { title: 'Nothing due today', description: 'Enjoy the breathing room, or pull something forward.', icon: 'sun' },
    week: { title: 'A clear week ahead', description: 'No tasks assigned to you are due in the next 7 days.', icon: 'calendar' },
    nodate: { title: 'Everything has a date', description: 'All your tasks have a due date set.', icon: 'calendar' },
  };

  let index = -1;

  return (
    <div className="page my-work">
      <header className="page-header my-work-header">
        <div>
          <h1 className="page-title">My work</h1>
          <p className="page-subtitle">
            {loading ? 'Loading your tasks…' : `${pluralize(openCount, 'open task')} assigned to you${counts.overdue ? ` · ${counts.overdue} overdue` : ''}${doneCount ? ` · ${doneCount} completed` : ''}`}
          </p>
        </div>
        <div className="row gap-2">
          {ws.canEdit ? (
            <Button variant="primary" icon="plus" onClick={() => openCreateTask({ assigneeId: me.id })} title="New task (C)">
              New task
            </Button>
          ) : null}
        </div>
      </header>

      <div className="my-work-toolbar">
        <Tabs value={tab} onChange={setTab} tabs={tabItems} className="my-work-tabs" />
        <span className="grow" />
        <div className="my-work-controls">
          <Segmented value={groupBy} onChange={setGroupBy} size="sm" options={[{ value: 'project', label: 'Project', icon: 'folder', title: 'Group by project' }, { value: 'date', label: 'Due date', icon: 'calendar', title: 'Group by due date' }]} />
          <Switch checked={showCompleted} onChange={(v) => { setShowCompleted(v); setActive(-1); }} label="Show completed" />
        </div>
      </div>

      <div className="card my-work-card" ref={listRef}>
        {tasksQ.error && !tasksQ.data ? (
          <EmptyState icon="alert-circle" title="Couldn't load your tasks" description={tasksQ.error.message} action={<Button variant="secondary" onClick={() => void tasksQ.refetch()}>Retry</Button>} />
        ) : loading ? (
          <div className="my-work-skeleton">
            <div className="my-work-group-head is-skeleton"><span className="skeleton" style={{ width: 120, height: 12 }} /></div>
            <TaskRowSkeleton rows={4} />
            <div className="my-work-group-head is-skeleton"><span className="skeleton" style={{ width: 90, height: 12 }} /></div>
            <TaskRowSkeleton rows={3} />
          </div>
        ) : !groups.length ? (
          <EmptyState icon={emptyCopy[tab].icon} title={emptyCopy[tab].title} description={emptyCopy[tab].description} action={tab !== 'all' ? <Button size="sm" variant="secondary" onClick={() => setTab('all')}>Show all tasks</Button> : ws.canEdit ? <Button size="sm" variant="secondary" icon="plus" onClick={() => openCreateTask({ assigneeId: me.id })}>Create a task</Button> : undefined} />
        ) : (
          groups.map((g) => {
            const isCollapsed = collapsed.has(g.key);
            const overdue = g.tasks.filter((t) => !isDone(t) && t.dueDate && t.dueDate < today).length;
            return (
              <section key={g.key} className={cx('my-work-group', isCollapsed && 'is-collapsed')} aria-label={g.label}>
                <button type="button" className="my-work-group-head" onClick={() => toggleGroup(g.key)} aria-expanded={!isCollapsed}>
                  <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={14} className="my-work-group-chevron" />
                  {g.color ? (
                    <span className="project-icon my-work-group-icon" style={{ background: g.color }} aria-hidden>{g.icon ?? '●'}</span>
                  ) : (
                    <Icon name={g.key === 'overdue' ? 'alert-circle' : g.key === 'done' ? 'circle-check' : g.key === 'none' ? 'circle-dashed' : 'calendar'} size={14} className={cx('my-work-group-glyph', g.key === 'overdue' && 'is-overdue')} />
                  )}
                  <span className="my-work-group-name">{g.label}</span>
                  {g.projectKey ? <span className="my-work-group-key mono">{g.projectKey}</span> : null}
                  <span className="my-work-group-count tabular">{g.tasks.length}</span>
                  {overdue && g.key !== 'overdue' ? <span className="my-work-group-overdue tabular">{overdue} overdue</span> : null}
                  {groupBy === 'date' && g.tasks[0]?.dueDate && g.key !== 'none' && g.key !== 'done' ? <span className="xs faint ml-auto">{g.tasks.length === 1 || g.tasks[0].dueDate === g.tasks[g.tasks.length - 1].dueDate ? formatDate(g.tasks[0].dueDate) : `${formatDate(g.tasks[0].dueDate)} – ${formatDate(g.tasks[g.tasks.length - 1].dueDate!)}`}</span> : null}
                </button>
                {!isCollapsed ? (
                  <div className="my-work-rows" role="list">
                    {g.tasks.map((t) => {
                      index++;
                      return <EditableRow key={t.id} task={t} index={index} active={index === active} onPatch={patch} canEdit={ws.canEdit} onOpen={(task) => { setActive(flat.indexOf(task)); openTask(task); }} />;
                    })}
                  </div>
                ) : null}
              </section>
            );
          })
        )}
      </div>
      {!loading && groups.length ? (
        <div className="my-work-hint xs faint">
          <Kbd>J</Kbd><Kbd>K</Kbd> to move · <Kbd>↵</Kbd> to open · click a status, priority or date to change it
        </div>
      ) : null}
    </div>
  );
}
