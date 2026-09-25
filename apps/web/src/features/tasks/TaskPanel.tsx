// Task peek panel: a right-side sliding panel driven by `?task=KEY-12`. Mounted once in the AppShell.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Task, TaskDetail as TaskDetailT } from '../../../../../packages/shared/src/types.ts';
import { useWorkspaceOptional, type WorkspaceCtx } from '../../app/workspace.tsx';
import { useMe } from '../../app/auth.tsx';
import { deleteTask, keys, taskApi, updateTask, useBundle, useTask, useTaskByKey, useTasks } from '../../app/data.ts';
import { getQueryData, invalidate, setQueryData } from '../../lib/query.ts';
import { useSearchParams } from '../../lib/router.tsx';
import { onRealtime } from '../../lib/realtime.ts';
import { useHotkey, useIsMobile, useLocalStorage } from '../../lib/hooks.ts';
import { toast } from '../../lib/toast.ts';
import { RequestError } from '../../lib/api.ts';
import { Button, EmptyState, Skeleton, cx } from '../../ui/primitives.tsx';
import { MenuButton, Tooltip, useConfirm, type MenuItem } from '../../ui/overlays.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { ProjectBadge } from './fields.tsx';
import { TaskDetail } from './TaskDetail.tsx';
import './task-panel.css';

const overlayOpen = () => Boolean(document.querySelector('.popover, .dialog-overlay, .mention-menu'));
const inInput = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));
};

export function TaskPanelHost() {
  const ws = useWorkspaceOptional();
  const [params, setParams] = useSearchParams();
  const raw = params.get('task');
  const key = raw ? raw.trim().toUpperCase() : null;
  const close = useCallback(() => setParams({ task: null }), [setParams]);
  const open = useCallback((k: string) => setParams({ task: k }, { replace: true }), [setParams]);
  if (!ws || !key) return null;
  return <TaskPanel ws={ws} taskKey={key} close={close} open={open} />;
}

function TaskPanel({ ws, taskKey, close, open }: { ws: WorkspaceCtx; taskKey: string; close: () => void; open: (key: string) => void }) {
  const isMobile = useIsMobile();
  const [wide, setWide] = useLocalStorage<boolean>('tt.taskPanel.wide', false);
  const panelRef = useRef<HTMLElement | null>(null);

  // Resolve KEY → id: from the project's task list cache when possible (no extra request), else by-key lookup.
  const project = ws.projectByKey(taskKey.split('-')[0]);
  const cachedId = project ? getQueryData<Task[]>(keys.tasks(project.id))?.find((t) => t.key === taskKey)?.id : undefined;
  const byKey = useTaskByKey(cachedId ? null : ws.workspace.id, taskKey);
  const id = cachedId ?? byKey.data?.id ?? null;
  useEffect(() => {
    if (byKey.data && !getQueryData(keys.task(byKey.data.id))) setQueryData(keys.task(byKey.data.id), byKey.data);
  }, [byKey.data]);
  const detail = useTask(id);
  const task: TaskDetailT | undefined = detail.data ?? (byKey.data && byKey.data.id === id ? byKey.data : undefined);
  const notFound = (byKey.error instanceof RequestError && byKey.error.status === 404) || (detail.error instanceof RequestError && detail.error.status === 404);
  const error = !notFound && !task ? byKey.error || detail.error : null;

  // Focus the panel on open so Escape / shortcuts work right away.
  useEffect(() => {
    const t = setTimeout(() => {
      if (panelRef.current && !panelRef.current.contains(document.activeElement)) panelRef.current.focus({ preventScroll: true });
    }, 30);
    return () => clearTimeout(t);
  }, [taskKey]);

  // Escape closes the panel unless an overlay (which handles its own Escape) or a text field has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || overlayOpen() || inInput(e) || document.body.classList.contains('dragging')) return;
      e.preventDefault();
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // If the task is deleted by someone else while we look at it, close gracefully.
  useEffect(() => {
    if (!id) return;
    return onRealtime('task.deleted', (e) => {
      if (e.type === 'task.deleted' && e.taskId === id) {
        toast.info(`${taskKey} was deleted`);
        close();
      }
    });
  }, [id, taskKey, close]);

  return (
    <>
      {isMobile ? <div className="task-panel-scrim" onClick={close} /> : null}
      <aside ref={panelRef} className={cx('task-panel', wide && 'is-wide')} role="dialog" aria-label={task ? `${task.key} ${task.title}` : `Task ${taskKey}`} tabIndex={-1} data-task-key={taskKey}>
        {task ? (
          <TaskPanelContent key={task.id} ws={ws} task={task} close={close} open={open} wide={wide} setWide={setWide} />
        ) : notFound ? (
          <>
            <PanelBar close={close} />
            <div className="task-panel-state">
              <EmptyState icon="circle-x" title="Task not found" description="This task doesn't exist or was deleted." action={<Button onClick={close}>Close</Button>} />
            </div>
          </>
        ) : error ? (
          <>
            <PanelBar close={close} />
            <div className="task-panel-state">
              <EmptyState icon="alert-circle" title="Couldn't load this task" description={error.message} action={<span className="row gap-2"><Button variant="primary" onClick={() => { void byKey.refetch(); void detail.refetch(); }}>Retry</Button><Button onClick={close}>Close</Button></span>} />
            </div>
          </>
        ) : (
          <>
            <PanelBar close={close} />
            <PanelSkeleton />
          </>
        )}
      </aside>
    </>
  );
}

function PanelBar({ close }: { close: () => void }) {
  return (
    <header className="task-panel-head">
      <span className="grow" />
      <Button size="sm" variant="ghost" icon="x" iconOnly onClick={close} aria-label="Close">Close</Button>
    </header>
  );
}

function PanelSkeleton() {
  return (
    <div className="task-panel-body" aria-busy="true">
      <Skeleton height={28} width="70%" />
      <div className="task-props" style={{ marginTop: 20 }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="task-prop">
            <Skeleton width={70} height={12} />
            <Skeleton width={i % 2 ? 120 : 90} height={22} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 28 }} className="col gap-2">
        <Skeleton height={12} />
        <Skeleton height={12} width="92%" />
        <Skeleton height={12} width="60%" />
      </div>
      <div style={{ marginTop: 28 }} className="col gap-2">
        <Skeleton height={14} width={120} />
        <Skeleton height={30} />
        <Skeleton height={30} />
      </div>
    </div>
  );
}

function TaskPanelContent({ ws, task, close, open, wide, setWide }: { ws: WorkspaceCtx; task: TaskDetailT; close: () => void; open: (key: string) => void; wide: boolean; setWide: (v: boolean) => void }) {
  const me = useMe();
  const confirm = useConfirm();
  const bundle = useBundle(task.projectId).data;
  const project = bundle?.project ?? ws.projectById(task.projectId);
  const projectKey = project?.key ?? task.projectKey ?? task.key.split('-')[0];
  const canEdit = ws.canEdit;
  const canManage = ws.isAdmin || (project?.leadId ?? null) === me.id;
  const watching = task.watcherIds.includes(me.id);
  const [busy, setBusy] = useState<string | null>(null);

  // Prev / next within the project's task list (cache order = position order).
  const tasks = useTasks(task.projectId).data;
  const siblings = useMemo(() => (tasks ?? []).filter((t) => (t.parentId ?? null) === (task.parentId ?? null) && (!t.archivedAt || t.id === task.id)), [tasks, task.id, task.parentId]);
  const idx = siblings.findIndex((t) => t.id === task.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const link = `${window.location.origin}${ws.base}/p/${projectKey}?task=${task.key}`;
  const copyLink = useCallback(() => {
    void navigator.clipboard?.writeText(link);
    toast.success('Link copied');
  }, [link]);
  const copyKey = () => {
    void navigator.clipboard?.writeText(task.key);
    toast.success('Key copied');
  };

  const toggleWatch = async () => {
    const nextIds = watching ? task.watcherIds.filter((x) => x !== me.id) : [...task.watcherIds, me.id];
    setQueryData<TaskDetailT>(keys.task(task.id), (p) => (p ? { ...p, watcherIds: nextIds } : p));
    try {
      await taskApi.watch(task.id, !watching);
      toast.success(watching ? 'Stopped watching' : 'Watching this task');
    } catch (e) {
      setQueryData<TaskDetailT>(keys.task(task.id), (p) => (p ? { ...p, watcherIds: task.watcherIds } : p));
      toast.fromError(e);
    }
  };
  const duplicate = async () => {
    setBusy('duplicate');
    try {
      const copy = await taskApi.duplicate(task.id);
      invalidate([keys.tasks(task.projectId), 'dashboard', 'mytasks']);
      toast.success(`Duplicated as ${copy.key}`);
      open(copy.key);
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    if (!(await confirm({ title: `Delete ${task.key}?`, description: 'This permanently deletes the task, its subtasks, comments and attachments.', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      await deleteTask(task);
      toast.success(`${task.key} deleted`);
      close();
    } catch (e) {
      toast.fromError(e);
    }
  };
  const patch = (p: Parameters<typeof updateTask>[1]) => updateTask(task, p).catch((e) => toast.fromError(e));

  const menu: MenuItem[] = [
    { label: 'Copy link', icon: 'link', shortcut: '⇧⌘C', onSelect: copyLink },
    { label: 'Copy key', icon: 'hash', onSelect: copyKey },
    { label: wide ? 'Collapse panel' : 'Open in full view', icon: wide ? 'minimize' : 'maximize', onSelect: () => setWide(!wide) },
    ...(canEdit
      ? ([
          { separator: true, label: '' },
          { label: 'Duplicate', icon: 'copy', onSelect: () => void duplicate() },
          ...(task.parentId ? [{ label: 'Make top-level task', icon: 'arrow-up', onSelect: () => void patch({ parentId: null }).then(() => toast.success('Now a top-level task')) }] : []),
          { label: 'Move to project…', icon: 'move', disabled: true, description: 'Not available yet' },
          { label: task.archivedAt ? 'Unarchive' : 'Archive', icon: 'archive', onSelect: () => void patch({ archived: !task.archivedAt }).then(() => toast.success(task.archivedAt ? 'Task unarchived' : 'Task archived')) },
          { separator: true, label: '' },
          { label: 'Delete', icon: 'trash', danger: true, onSelect: () => void remove() },
        ] as MenuItem[])
      : []),
  ];

  // Shortcuts (only while nothing else is open and no text field has focus)
  const guard = (fn: () => void) => () => {
    if (overlayOpen()) return;
    fn();
  };
  useHotkey('j', guard(() => next && open(next.key)));
  useHotkey('k', guard(() => prev && open(prev.key)));
  useHotkey('mod+shift+c', guard(copyLink));

  return (
    <>
      <header className="task-panel-head">
        <div className="task-panel-crumbs">
          <ProjectBadge projectKey={projectKey} color={project?.color ?? task.projectColor} name={project?.name ?? task.projectName} />
          {task.parent ? (
            <>
              <Icon name="chevron-right" size={12} className="faint" />
              <button type="button" className="task-panel-crumb" onClick={() => open(task.parent!.key)} title={task.parent.title}>
                <span className="mono">{task.parent.key}</span>
              </button>
            </>
          ) : null}
          <Icon name="chevron-right" size={12} className="faint" />
          <Tooltip content="Copy link" shortcut="⇧⌘C">
            <button type="button" className="task-panel-key mono" onClick={copyLink} aria-label={`${task.key} — copy link`}>
              {task.key}
              <Icon name="link" size={11} className="task-panel-key-icon" />
            </button>
          </Tooltip>
          {task.archivedAt ? <span className="badge badge-neutral badge-sm">Archived</span> : null}
        </div>
        <div className="task-panel-actions">
          {siblings.length > 1 ? (
            <span className="task-panel-nav" role="group" aria-label="Navigate tasks">
              <Tooltip content="Previous task" shortcut="K">
                <Button size="sm" variant="ghost" icon="chevron-up" iconOnly disabled={!prev} onClick={() => prev && open(prev.key)} aria-label="Previous task">Previous</Button>
              </Tooltip>
              <Tooltip content="Next task" shortcut="J">
                <Button size="sm" variant="ghost" icon="chevron-down" iconOnly disabled={!next} onClick={() => next && open(next.key)} aria-label="Next task">Next</Button>
              </Tooltip>
              <span className="task-panel-nav-pos xs muted tabular">{idx + 1}/{siblings.length}</span>
            </span>
          ) : null}
          <Tooltip content={watching ? 'Stop watching' : 'Watch task'}>
            <Button size="sm" variant="ghost" icon={watching ? 'eye' : 'eye-off'} iconOnly active={watching} onClick={() => void toggleWatch()} aria-label={watching ? 'Stop watching' : 'Watch task'} aria-pressed={watching}>Watch</Button>
          </Tooltip>
          <MenuButton items={menu} label="Task actions" />
          <Tooltip content={wide ? 'Collapse' : 'Expand'}>
            <Button size="sm" variant="ghost" icon={wide ? 'minimize' : 'maximize'} iconOnly onClick={() => setWide(!wide)} aria-label={wide ? 'Collapse panel' : 'Expand panel'} className="task-panel-expand" loading={busy === 'duplicate'}>Expand</Button>
          </Tooltip>
          <Tooltip content="Close" shortcut="Esc">
            <Button size="sm" variant="ghost" icon="x" iconOnly onClick={close} aria-label="Close">Close</Button>
          </Tooltip>
        </div>
      </header>
      <TaskDetail task={task} bundle={bundle} canEdit={canEdit} canManage={canManage} openTask={open} className="task-panel-body" />
    </>
  );
}
