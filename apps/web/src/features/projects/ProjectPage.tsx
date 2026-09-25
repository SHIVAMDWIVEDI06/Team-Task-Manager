// Project container page: header, view switcher, saved views, filters, selection + bulk bar, and the active view.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SavedView, Task, TaskFilters, ViewKind } from '../../../../../packages/shared/src/types.ts';
import { taskMatchesFilters } from '../../../../../packages/shared/src/utils.ts';
import { keys, projectApi, useBundle, useTasks } from '../../app/data.ts';
import { useWorkspace } from '../../app/workspace.tsx';
import { useMe } from '../../app/auth.tsx';
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { Link, navigate, useParams, useSearchParams } from '../../lib/router.tsx';
import { invalidate } from '../../lib/query.ts';
import { uiStore } from '../../lib/store.ts';
import { toast } from '../../lib/toast.ts';
import { useHotkey, useIsMobile } from '../../lib/hooks.ts';
import { Avatar, AvatarStack, Badge, Button, Checkbox, EmptyState, Field, Input, Progress, Segmented, Skeleton, cx } from '../../ui/primitives.tsx';
import { Dialog, Menu, Popover, Tooltip, useConfirm, type MenuItem } from '../../ui/overlays.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { FiltersBar } from './FiltersBar.tsx';
import { BulkBar } from './BulkBar.tsx';
import { DEFAULT_GROUP, DEFAULT_SORT, VIEW_KINDS, countActiveFilters, filtersToParams, isDone, parseFilters, sortTasks, viewStateEqual, type GroupBy, type ViewState } from './filters.ts';
import { BoardView, MoreMenu } from "./views/BoardView.tsx";
import { ListView } from './views/ListView.tsx';
import { CalendarView } from './views/CalendarView.tsx';
import { TimelineView } from './views/TimelineView.tsx';
import type { ViewProps } from './views/types.ts';
import './projects.css';

const VIEW_OPTIONS: { value: ViewKind; label: string; icon: string; title: string }[] = [
  { value: 'board', label: 'Board', icon: 'board', title: 'Board (1)' },
  { value: 'list', label: 'List', icon: 'list', title: 'List (2)' },
  { value: 'calendar', label: 'Calendar', icon: 'calendar', title: 'Calendar (3)' },
  { value: 'timeline', label: 'Timeline', icon: 'timeline', title: 'Timeline (4)' },
];

const overlayOpen = () => Boolean(document.querySelector('.popover, .dialog-overlay'));

// ---- Save / rename view dialog ----
function ViewDialog({ open, onClose, mode, initial, canShare, onSubmit }: { open: boolean; onClose: () => void; mode: 'create' | 'rename'; initial?: { name: string; shared: boolean }; canShare: boolean; onSubmit: (v: { name: string; shared: boolean }) => Promise<void> }) {
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setShared(initial?.shared ?? false);
    }
  }, [open, initial?.name, initial?.shared]);
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), shared });
      onClose();
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={mode === 'create' ? 'Save view' : 'Rename view'}
      description={mode === 'create' ? 'Saves the current view type, filters, grouping and sort.' : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={() => void submit()}>{mode === 'create' ? 'Save view' : 'Rename'}</Button>
        </>
      }
    >
      <form className="form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Name" htmlFor="view-name" required>
          <Input id="view-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My open bugs" maxLength={80} data-autofocus />
        </Field>
        {mode === 'create' && canShare ? <Checkbox checked={shared} onChange={setShared} label="Share with everyone in the project" /> : null}
      </form>
    </Dialog>
  );
}

// ---- Saved views dropdown ----
function ViewsMenu({ views, current, dirty, canManage, onSelect, onSave, onUpdate, onRename, onDelete, onReset }: { views: SavedView[]; current: SavedView | null; dirty: boolean; canManage: boolean; onSelect: (v: SavedView) => void; onSave: () => void; onUpdate: () => void; onRename: (v: SavedView) => void; onDelete: (v: SavedView) => void; onReset: () => void }) {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<SavedView | null>(null);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLButtonElement | null>(null);
  const shared = views.filter((v) => v.userId === null);
  const mine = views.filter((v) => v.userId !== null);
  const canEditView = (v: SavedView) => v.userId === me.id || (v.userId === null && canManage);
  const row = (v: SavedView) => (
    <div key={v.id} className={cx('views-item', current?.id === v.id && 'is-active')}>
      <button type="button" className="views-item-main" onClick={() => { onSelect(v); setOpen(false); }}>
        <Icon name={v.kind} size={14} className="muted" />
        <span className="truncate">{v.name}</span>
        {v.userId === null ? <Tooltip content="Shared with the project"><Icon name="users" size={12} className="faint" /></Tooltip> : null}
        {current?.id === v.id ? <Icon name="check" size={14} className="views-check" /> : null}
      </button>
      {canEditView(v) ? (
        <button type="button" className="views-item-more" aria-label={`Options for ${v.name}`} onClick={(e) => { e.stopPropagation(); setMenuRect((e.currentTarget as HTMLElement).getBoundingClientRect()); setMenuFor(v); }}>
          <Icon name="more-h" size={14} />
        </button>
      ) : null}
    </div>
  );
  const menuItems: MenuItem[] = menuFor
    ? [
        { label: 'Rename', icon: 'pencil', onSelect: () => { onRename(menuFor); setOpen(false); } },
        { label: 'Delete view', icon: 'trash', danger: true, onSelect: () => { onDelete(menuFor); setOpen(false); } },
      ]
    : [];
  return (
    <>
      <Button ref={ref} size="sm" variant={current ? 'secondary' : 'ghost'} icon="layers" iconRight="chevron-down" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="views-trigger">
        <span className="truncate">{current ? current.name : 'Views'}</span>
        {current && dirty ? <span className="views-dirty" title="Unsaved changes" /> : null}
      </Button>
      <Popover open={open} onClose={() => { setOpen(false); setMenuFor(null); }} anchorRef={ref} width={280} align="start" className="views-popover">
        <div className="views-list">
          {!views.length ? <div className="views-empty">No saved views yet. Set up filters, then save them here.</div> : null}
          {shared.length ? (
            <>
              <div className="views-section">Shared</div>
              {shared.map(row)}
            </>
          ) : null}
          {mine.length ? (
            <>
              <div className="views-section">Mine</div>
              {mine.map(row)}
            </>
          ) : null}
        </div>
        <div className="views-footer">
          {current && dirty && canEditView(current) ? (
            <Button size="sm" variant="primary" icon="check" onClick={() => { onUpdate(); setOpen(false); }}>Update “{current.name}”</Button>
          ) : null}
          <Button size="sm" variant="ghost" icon="plus" onClick={() => { onSave(); setOpen(false); }}>Save current view…</Button>
          {current ? <Button size="sm" variant="ghost" icon="x" onClick={() => { onReset(); setOpen(false); }}>Reset to default</Button> : null}
        </div>
      </Popover>
      <Menu open={Boolean(menuFor)} onClose={() => setMenuFor(null)} anchorRef={ref} anchorRect={menuRect} items={menuItems} align="end" />
    </>
  );
}

// ---- Page ----
export function ProjectPage() {
  const { key } = useParams<{ key: string }>();
  const ws = useWorkspace();
  const me = useMe();
  const isMobile = useIsMobile();
  const confirm = useConfirm();
  const project = ws.projectByKey(key);
  const projectId = project?.id ?? null;
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const bundle = useBundle(projectId);
  const tasksQ = useTasks(projectId, Boolean(filters.includeArchived));
  const [selection, setSelectionState] = useState<Set<string>>(() => new Set());
  const [filtersOpen, setFiltersOpen] = useState(() => countActiveFilters(parseFilters(new URLSearchParams(window.location.search))) > 0);
  const [viewDialog, setViewDialog] = useState<{ mode: 'create' | 'rename'; view?: SavedView } | null>(null);

  const viewParam = params.get('view');
  const view: ViewKind = VIEW_KINDS.includes(viewParam as ViewKind) ? (viewParam as ViewKind) : 'board';
  const groupBy = (params.get('group') as GroupBy | null) || DEFAULT_GROUP;
  const sortBy = params.get('sort') || DEFAULT_SORT;
  const viewId = params.get('v');

  useTopbar([{ label: 'Projects', to: `${ws.base}/projects` }, { label: project?.name ?? key }], null, [project?.name, key]);

  // reset selection when the project changes
  useEffect(() => {
    setSelectionState(new Set());
  }, [projectId]);

  const allTasks: Task[] = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);
  const statuses = useMemo(() => [...(bundle.data?.statuses ?? [])].sort((a, b) => a.position - b.position), [bundle.data?.statuses]);
  const labels = bundle.data?.labels ?? [];
  const members = bundle.data?.members ?? [];
  const views = bundle.data?.views ?? [];

  const visibleTasks = useMemo(() => sortTasks(allTasks.filter((t) => taskMatchesFilters(t, filters, me.id)), sortBy, statuses, members), [allTasks, filters, me.id, sortBy, statuses, members]);

  // drop selected ids that no longer exist
  const setSelection = useCallback((ids: Set<string>) => setSelectionState(ids), []);
  useEffect(() => {
    if (!selection.size) return;
    const existing = new Set(allTasks.map((t) => t.id));
    if ([...selection].some((id) => !existing.has(id))) setSelectionState(new Set([...selection].filter((id) => existing.has(id))));
  }, [allTasks, selection]);

  const canEdit = ws.canEdit;
  const canManage = ws.isAdmin || (project?.leadId != null && project.leadId === me.id);

  const setView = useCallback((v: ViewKind) => setParams({ view: v === 'board' ? null : v }, { replace: true }), [setParams]);
  const setFilters = useCallback((f: TaskFilters) => setParams(filtersToParams(f), { replace: true }), [setParams]);

  useHotkey('1', () => { if (!overlayOpen()) setView('board'); });
  useHotkey('2', () => { if (!overlayOpen()) setView('list'); });
  useHotkey('3', () => { if (!overlayOpen()) setView('calendar'); });
  useHotkey('4', () => { if (!overlayOpen()) setView('timeline'); });
  useHotkey('f', () => { if (!overlayOpen()) setFiltersOpen((o) => !o); });
  useHotkey('esc', () => { if (selection.size) setSelectionState(new Set()); }, { enabled: selection.size > 0, allowInInput: true });

  const openTask = useCallback((task: Task) => setParams({ task: task.key }, { replace: false }), [setParams]);
  const createTask = useCallback(
    (defaults?: { statusId?: string; dueDate?: string; startDate?: string; assigneeId?: string | null }) => {
      if (!projectId) return;
      const payload = { projectId, ...(defaults ?? {}) };
      uiStore.set({ createTaskOpen: payload });
    },
    [projectId],
  );

  // ---- saved views ----
  const currentView = viewId ? (views.find((v) => v.id === viewId) ?? null) : null;
  const currentState: ViewState = useMemo(() => ({ kind: view, filters, groupBy, sortBy }), [view, filters, groupBy, sortBy]);
  const savedState = (v: SavedView): ViewState => ({ kind: v.kind, filters: v.filters ?? {}, groupBy: (v.groupBy as GroupBy) ?? DEFAULT_GROUP, sortBy: v.sortBy || DEFAULT_SORT });
  const dirty = currentView ? !viewStateEqual(currentState, savedState(currentView)) : false;
  const applyView = (v: SavedView) => {
    setParams({ view: v.kind === 'board' ? null : v.kind, v: v.id, group: v.groupBy && v.groupBy !== DEFAULT_GROUP ? v.groupBy : null, sort: v.sortBy && v.sortBy !== DEFAULT_SORT ? v.sortBy : null, ...filtersToParams(v.filters ?? {}) }, { replace: true });
    if (countActiveFilters(v.filters ?? {}) > 0) setFiltersOpen(true);
  };
  const resetView = () => setParams({ view: null, v: null, group: null, sort: null, ...filtersToParams({}) }, { replace: true });
  const saveView = async ({ name, shared }: { name: string; shared: boolean }) => {
    if (!projectId) return;
    const v = await projectApi.createView(projectId, { name, kind: view, filters, groupBy, sortBy, shared });
    invalidate(keys.bundle(projectId));
    toast.success(`View “${name}” saved`);
    setParams({ v: v.id }, { replace: true });
  };
  const updateView = async () => {
    if (!projectId || !currentView) return;
    try {
      await projectApi.updateView(projectId, currentView.id, { kind: view, filters, groupBy, sortBy });
      invalidate(keys.bundle(projectId));
      toast.success(`View “${currentView.name}” updated`);
    } catch (e) {
      toast.fromError(e);
    }
  };
  const renameView = async (v: SavedView, name: string) => {
    if (!projectId) return;
    await projectApi.updateView(projectId, v.id, { name });
    invalidate(keys.bundle(projectId));
  };
  const deleteView = async (v: SavedView) => {
    if (!projectId) return;
    if (!(await confirm({ title: `Delete view “${v.name}”?`, danger: true, confirmLabel: 'Delete' }))) return;
    try {
      await projectApi.deleteView(projectId, v.id);
      invalidate(keys.bundle(projectId));
      if (viewId === v.id) setParams({ v: null }, { replace: true });
      toast.success('View deleted');
    } catch (e) {
      toast.fromError(e);
    }
  };

  // ---- project actions ----
  const projectMenu: MenuItem[] = project
    ? [
        { label: 'Project settings', icon: 'settings', onSelect: () => navigate(`${ws.base}/p/${project.key}/settings`), disabled: !canManage },
        { label: 'Copy link', icon: 'link', onSelect: () => { void navigator.clipboard?.writeText(`${window.location.origin}${ws.base}/p/${project.key}`); toast.success('Link copied'); } },
        { separator: true, label: '' },
        {
          label: project.state === 'archived' ? 'Restore project' : 'Archive project',
          icon: 'archive',
          disabled: !canManage,
          onSelect: async () => {
            const archiving = project.state !== 'archived';
            if (archiving && !(await confirm({ title: `Archive ${project.name}?`, description: 'Archived projects are hidden from the sidebar. You can restore them from the Projects page.', confirmLabel: 'Archive' }))) return;
            try {
              await projectApi.update(project.id, { state: archiving ? 'archived' : 'active' });
              invalidate('projects');
              toast.success(archiving ? 'Project archived' : 'Project restored');
              if (archiving) navigate(`${ws.base}/projects`);
            } catch (e) {
              toast.fromError(e);
            }
          },
        },
        {
          label: 'Delete project',
          icon: 'trash',
          danger: true,
          disabled: !canManage,
          onSelect: async () => {
            if (!(await confirm({ title: `Delete ${project.name}?`, description: `This permanently deletes the project and all ${allTasks.length} of its tasks. This cannot be undone.`, danger: true, confirmLabel: 'Delete project' }))) return;
            try {
              await projectApi.remove(project.id);
              invalidate(['projects', 'dashboard']);
              toast.success('Project deleted');
              navigate(`${ws.base}/projects`);
            } catch (e) {
              toast.fromError(e);
            }
          },
        },
      ]
    : [];

  if (!project) {
    return (
      <div className="page">
        <EmptyState icon="folder" title="Project not found" description={`There is no project with the key “${key}” in this workspace, or you don't have access to it.`} action={<Link to={`${ws.base}/projects`} className="btn btn-primary btn-md">All projects</Link>} />
      </div>
    );
  }

  const loading = (bundle.isLoading && !bundle.data) || (tasksQ.isLoading && !tasksQ.data);
  const error = bundle.error || tasksQ.error;
  const doneCount = allTasks.filter((t) => !t.parentId && isDone(t)).length;
  const topCount = allTasks.filter((t) => !t.parentId).length;
  const overdue = allTasks.filter((t) => !isDone(t) && t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10)).length;
  const activeFilterCount = countActiveFilters(filters);
  const lead = project.lead ?? (project.leadId ? ws.member(project.leadId)?.user : null);

  const viewProps: ViewProps = {
    project,
    statuses,
    labels,
    members,
    tasks: visibleTasks,
    allTasks,
    filters,
    canEdit,
    openTask,
    createTask,
    selection,
    setSelection,
    groupBy,
    sortBy,
  };

  return (
    <div className={cx('project-page', `view-${view}`)}>
      <header className="project-header">
        <div className="project-header-main">
          <span className="project-icon project-icon-lg" style={{ background: project.color }} aria-hidden>
            {project.icon}
          </span>
          <div className="project-heading">
            <div className="row gap-2">
              <h1 className="project-name truncate">{project.name}</h1>
              <Badge size="sm" className="mono">{project.key}</Badge>
              {project.visibility === 'private' ? (
                <Tooltip content="Private project — only invited members can see it">
                  <Icon name="lock" size={14} className="muted" />
                </Tooltip>
              ) : null}
              {project.state === 'archived' ? <Badge size="sm" tone="warning" icon="archive">Archived</Badge> : null}
            </div>
            <div className="project-meta">
              {lead ? (
                <span className="row gap-1" title={`Lead: ${lead.name}`}>
                  <Avatar name={lead.name} src={lead.avatarUrl} size={16} />
                  <span className="truncate">{lead.name}</span>
                </span>
              ) : (
                <span className="faint">No lead</span>
              )}
              <span className="project-meta-sep" />
              {loading ? (
                <Skeleton width={140} height={10} />
              ) : (
                <span className="project-progress" title={`${doneCount} of ${topCount} tasks done`}>
                  <Progress value={doneCount} max={topCount} height={5} className="project-progress-bar" color={topCount && doneCount === topCount ? 'var(--success)' : undefined} />
                  <span className="tabular">{doneCount}/{topCount} done</span>
                </span>
              )}
              {overdue ? (
                <>
                  <span className="project-meta-sep" />
                  <span className="project-overdue" title={`${overdue} overdue`}>
                    <Icon name="alert-circle" size={12} />
                    {overdue} overdue
                  </span>
                </>
              ) : null}
              {project.description && !isMobile ? (
                <>
                  <span className="project-meta-sep" />
                  <span className="truncate project-desc" title={project.description}>{project.description}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="project-header-actions">
          {members.length ? (
            <Tooltip content={`${members.length} member${members.length === 1 ? '' : 's'}`}>
              <span className="project-members"><AvatarStack users={members.map((m) => m.user)} size={24} max={isMobile ? 3 : 5} /></span>
            </Tooltip>
          ) : null}
          {canEdit ? (
            <Button variant="primary" size={isMobile ? 'sm' : 'md'} icon="plus" onClick={() => createTask()} iconOnly={isMobile} title="New task (C)">
              New task
            </Button>
          ) : null}
          <MoreMenu items={projectMenu} label="Project actions" size={isMobile ? "sm" : "md"} variant="outline" />
        </div>
      </header>

      <div className="project-toolbar">
        <Segmented value={view} onChange={setView} options={VIEW_OPTIONS.map((o) => ({ value: o.value, label: isMobile ? '' : o.label, icon: o.icon, title: o.title }))} size="sm" className="project-view-switcher" />
        <ViewsMenu views={views} current={currentView} dirty={dirty} canManage={canManage} onSelect={applyView} onSave={() => setViewDialog({ mode: 'create' })} onUpdate={() => void updateView()} onRename={(v) => setViewDialog({ mode: 'rename', view: v })} onDelete={(v) => void deleteView(v)} onReset={resetView} />
        {currentView && dirty ? <span className="project-unsaved">Unsaved changes</span> : null}
        <span className="grow" />
        <Tooltip content={filtersOpen ? 'Hide filters' : 'Show filters'} shortcut="F">
          <Button size="sm" variant={filtersOpen || activeFilterCount ? 'secondary' : 'ghost'} icon="filter" active={filtersOpen} onClick={() => setFiltersOpen((o) => !o)} aria-pressed={filtersOpen} aria-label="Toggle filters">
            {!isMobile ? 'Filter' : null}
            {activeFilterCount ? <span className="filter-count">{activeFilterCount}</span> : null}
          </Button>
        </Tooltip>
        {!isMobile ? (
          <span className="xs muted tabular project-count">
            {loading ? '' : `${visibleTasks.length}${visibleTasks.length !== topCount ? ` of ${filters.includeSubtasks ? allTasks.length : topCount}` : ''} tasks`}
          </span>
        ) : null}
      </div>

      {filtersOpen ? (
        <FiltersBar filters={filters} onChange={setFilters} statuses={statuses} labels={labels} members={members} groupBy={groupBy} sortBy={sortBy} onGroupChange={(g) => setParams({ group: g === DEFAULT_GROUP ? null : g }, { replace: true })} onSortChange={(s) => setParams({ sort: s === DEFAULT_SORT ? null : s }, { replace: true })} showGrouping={view === 'list'} />
      ) : null}

      <div className="project-view">
        {error ? (
          <EmptyState icon="alert-circle" title="Couldn't load this project" description={error.message} action={<Button variant="secondary" onClick={() => { void bundle.refetch(); void tasksQ.refetch(); }}>Retry</Button>} />
        ) : loading ? (
          <ViewSkeleton view={view} />
        ) : view === 'list' ? (
          <ListView {...viewProps} />
        ) : view === 'calendar' ? (
          <CalendarView {...viewProps} />
        ) : view === 'timeline' ? (
          <TimelineView {...viewProps} />
        ) : (
          <BoardView {...viewProps} />
        )}
      </div>

      {selection.size > 0 && canEdit ? <BulkBar projectId={project.id} tasks={allTasks} statuses={statuses} labels={labels} members={members} selection={selection} setSelection={setSelection} /> : null}

      <ViewDialog
        open={Boolean(viewDialog)}
        onClose={() => setViewDialog(null)}
        mode={viewDialog?.mode ?? 'create'}
        initial={viewDialog?.view ? { name: viewDialog.view.name, shared: viewDialog.view.userId === null } : undefined}
        canShare={canManage}
        onSubmit={async (v) => {
          if (viewDialog?.mode === 'rename' && viewDialog.view) await renameView(viewDialog.view, v.name);
          else await saveView(v);
        }}
      />
    </div>
  );
}

function ViewSkeleton({ view }: { view: ViewKind }) {
  if (view === 'list') {
    return (
      <div className="project-skeleton-list">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="row gap-3" style={{ height: 40 }}>
            <Skeleton width={14} height={14} radius={4} />
            <Skeleton width={56} height={10} />
            <Skeleton width={`${30 + ((i * 17) % 40)}%`} height={12} />
            <span className="grow" />
            <Skeleton width={90} height={10} />
            <Skeleton width={20} height={20} radius={10} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="project-skeleton-board">
      {Array.from({ length: 4 }).map((_, c) => (
        <div key={c} className="project-skeleton-col">
          <div className="row gap-2" style={{ padding: '4px 6px 10px' }}>
            <Skeleton width={14} height={14} radius={7} />
            <Skeleton width={80} height={12} />
          </div>
          {Array.from({ length: 3 - (c % 2) }).map((_, i) => (
            <div key={i} className="project-skeleton-card">
              <Skeleton width={48} height={9} />
              <Skeleton width={`${60 + ((i * 23 + c * 11) % 35)}%`} height={12} />
              <Skeleton width="45%" height={12} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
