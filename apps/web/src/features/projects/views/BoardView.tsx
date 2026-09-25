// Kanban board: one column per status, drag & drop between/within columns, quick-add, card menus.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Label, Task, TaskStatus } from '../../../../../../packages/shared/src/types.ts';
import { positionBetween } from '../../../../../../packages/shared/src/utils.ts';
import type { ViewProps } from './types.ts';
import { DndProvider, useDraggable, useDroppable, useDragState, type DropResult } from '../../../lib/dnd.tsx';
import { createTask as createTaskApi, deleteTask, keys, moveTask, taskApi, updateTask } from '../../../app/data.ts';
import { useWorkspace } from '../../../app/workspace.tsx';
import { invalidate } from '../../../lib/query.ts';
import { toast } from '../../../lib/toast.ts';
import { useLocalStorage } from '../../../lib/hooks.ts';
import { Button, Checkbox, EmptyState, StatusIcon, cx } from '../../../ui/primitives.tsx';
import { Menu, Tooltip, useConfirm, type MenuItem } from '../../../ui/overlays.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { AssigneePicker, DueBadge, LabelChips, PriorityPicker, ProgressMini, TaskKey } from '../../tasks/fields.tsx';
import { countActiveFilters, isDone } from '../filters.ts';
import '../board.css';

/** Icon-only "..." trigger + menu (the shared MenuButton renders no icon without children). */
export function MoreMenu({ items, label = 'More actions', size = 'sm', variant = 'ghost', icon = 'more-h', className }: { items: MenuItem[]; label?: string; size?: 'sm' | 'md'; variant?: 'ghost' | 'outline' | 'secondary'; icon?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <Button ref={ref} size={size} variant={variant} icon={icon} iconOnly title={label} aria-label={label} aria-haspopup="menu" aria-expanded={open} className={className} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
        {label}
      </Button>
      <Menu open={open} onClose={() => setOpen(false)} anchorRef={ref} items={items} align="end" />
    </>
  );
}

interface CardCtx {
  project: ViewProps['project'];
  statuses: TaskStatus[];
  labels: Label[];
  members: ViewProps['members'];
  canEdit: boolean;
  openTask: ViewProps['openTask'];
  selection: Set<string>;
  toggleSelect: (id: string, e?: React.MouseEvent) => void;
  filtered: boolean;
}

// ---- Card ----
function BoardCard({ task, ctx, overlay }: { task: Task; ctx: CardCtx; overlay?: boolean }) {
  const { project, statuses, labels, canEdit, openTask, selection, toggleSelect } = ctx;
  const { base } = useWorkspace();
  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const drag = useDraggable(task.id, { task, getHeight: () => cardRef.current?.offsetHeight ?? 0 }, !canEdit || overlay);
  const done = isDone(task);
  const selected = selection.has(task.id);
  const patch = (p: Parameters<typeof updateTask>[1]) => updateTask(task, p).catch((e) => toast.fromError(e));

  const items: MenuItem[] = [
    { label: 'Open', icon: 'maximize', onSelect: () => openTask(task) },
    { label: 'Copy link', icon: 'link', onSelect: () => { void navigator.clipboard?.writeText(`${window.location.origin}${base}/p/${project.key}?task=${task.key}`); toast.success('Link copied'); } },
    { separator: true, label: '' },
    ...(canEdit
      ? [
          ...statuses.map<MenuItem>((s) => ({ key: `st:${s.id}`, label: s.name, checked: s.id === task.statusId, onSelect: () => { if (s.id !== task.statusId) void moveTask(task, { statusId: s.id, beforeId: null, afterId: null }, statuses).catch((e) => toast.fromError(e)); } })),
          { separator: true, label: '' },
          { label: 'Duplicate', icon: 'copy', onSelect: () => void taskApi.duplicate(task.id).then(() => { invalidate(keys.tasks(project.id)); toast.success('Task duplicated'); }).catch((e) => toast.fromError(e)) },
          { label: task.archivedAt ? 'Unarchive' : 'Archive', icon: 'archive', onSelect: () => void patch({ archived: !task.archivedAt }) },
          { label: 'Delete', icon: 'trash', danger: true, onSelect: async () => { if (await confirm({ title: `Delete ${task.key}?`, description: 'This permanently deletes the task, its subtasks, comments and attachments.', danger: true, confirmLabel: 'Delete' })) deleteTask(task).catch((e) => toast.fromError(e)); } },
        ]
      : []),
  ];

  const attrs = overlay ? {} : drag.attributes;
  const setRef = (el: HTMLDivElement | null) => {
    cardRef.current = el;
    drag.ref.current = el;
  };
  return (
    <div
      ref={setRef}
      {...attrs}
      style={undefined}
      className={cx('board-card', done && 'is-done', selected && 'is-selected', drag.isDragging && !overlay && 'is-dragging', overlay && 'is-overlay', !canEdit && 'is-readonly')}
      role="button"
      tabIndex={overlay ? -1 : 0}
      aria-label={`${task.key} ${task.title}`}
      onClick={(e) => {
        if (overlay) return;
        if (e.shiftKey || e.metaKey || e.ctrlKey) { toggleSelect(task.id, e); return; }
        openTask(task);
      }}
      onKeyDown={(e) => {
        if (overlay) return;
        if (e.key === 'Enter') { e.preventDefault(); openTask(task); }
        if (e.key === 'x') { e.preventDefault(); toggleSelect(task.id); }
      }}
      onContextMenu={(e) => { if (overlay) return; e.preventDefault(); setMenuRect(new DOMRect(e.clientX, e.clientY, 0, 0)); setMenuOpen(true); }}
    >
      <div className="board-card-top">
        <span className="board-card-check" data-no-drag>
          <Checkbox size={14} checked={selected} onChange={() => toggleSelect(task.id)} />
        </span>
        <TaskKey task={task} />
        {task.parentId ? <Tooltip content="Subtask"><Icon name="git-branch" size={11} className="muted" /></Tooltip> : null}
        <span className="grow" />
        {!overlay ? (
          <span className="board-card-menu" data-no-drag onClick={(e) => e.stopPropagation()}>
            <MoreMenu items={items} label="Task actions" />
          </span>
        ) : null}
      </div>
      <div className="board-card-title">{task.title}</div>
      {task.labelIds.length ? (
        <div className="board-card-labels">
          <LabelChips labelIds={task.labelIds} labels={labels} max={3} />
        </div>
      ) : null}
      <div className="board-card-bottom" data-no-drag>
        <span className="board-card-left" onClick={(e) => e.stopPropagation()}>
          <PriorityPicker value={task.priority} onChange={(p) => void patch({ priority: p })} disabled={!canEdit || overlay} />
          <DueBadge value={task.dueDate} done={done} />
        </span>
        <span className="board-card-meta">
          {task.subtaskCount ? <ProgressMini done={task.subtaskDoneCount} total={task.subtaskCount} title={`${task.subtaskDoneCount}/${task.subtaskCount} subtasks`} /> : null}
          {task.checklistCount ? (
            <span className="board-card-stat" title={`${task.checklistDoneCount}/${task.checklistCount} checklist items`}>
              <Icon name="check-square" size={12} />
              {task.checklistDoneCount}/{task.checklistCount}
            </span>
          ) : null}
          {task.commentCount ? (
            <span className="board-card-stat" title={`${task.commentCount} comments`}>
              <Icon name="message" size={12} />
              {task.commentCount}
            </span>
          ) : null}
          {task.attachmentCount ? (
            <span className="board-card-stat" title={`${task.attachmentCount} attachments`}>
              <Icon name="paperclip" size={12} />
              {task.attachmentCount}
            </span>
          ) : null}
          <span onClick={(e) => e.stopPropagation()}>
            <AssigneePicker value={task.assigneeId} onChange={(id) => void patch({ assigneeId: id })} disabled={!canEdit || overlay} />
          </span>
        </span>
      </div>
      {!overlay ? <Menu open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={cardRef} anchorRect={menuRect} items={items} /> : null}
    </div>
  );
}

// ---- Quick add ----
function QuickAdd({ projectId, statusId, onCreated }: { projectId: string; statusId: string; onCreated?: (t: Task) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  const submit = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const task = await createTaskApi(projectId, { title: t, statusId });
      setTitle('');
      onCreated?.(task);
      inputRef.current?.focus();
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(false);
    }
  };
  if (!open) {
    return (
      <button type="button" className="board-quick-add" onClick={() => setOpen(true)} data-no-drag>
        <Icon name="plus" size={14} />
        New task
      </button>
    );
  }
  return (
    <div className="board-quick-form" data-no-drag>
      <textarea
        ref={inputRef}
        className="board-quick-input"
        value={title}
        placeholder="Task title…"
        rows={2}
        maxLength={200}
        disabled={busy}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); }
          if (e.key === 'Escape') { e.preventDefault(); setTitle(''); setOpen(false); }
        }}
        onBlur={() => { if (!title.trim()) setOpen(false); }}
      />
      <div className="row gap-1 between">
        <span className="xs muted">Enter to add · Esc to cancel</span>
        <span className="row gap-1">
          <Button size="sm" variant="ghost" onClick={() => { setTitle(''); setOpen(false); }}>Cancel</Button>
          <Button size="sm" variant="primary" loading={busy} disabled={!title.trim()} onClick={() => void submit()}>Add</Button>
        </span>
      </div>
    </div>
  );
}

// ---- Column ----
function Column({ status, tasks, ctx, collapsed, onToggleCollapse, onCreate }: { status: TaskStatus; tasks: Task[]; ctx: CardCtx; collapsed: boolean; onToggleCollapse: () => void; onCreate: () => void }) {
  const drop = useDroppable(status.id, { statusId: status.id }, { sortable: true, axis: 'y' });
  const drag = useDragState();
  const activeTask = (drag.activeData.task as Task | undefined) ?? null;
  const dragging = Boolean(drag.activeId);
  const showPlaceholder = dragging && drop.isOver && ctx.canEdit;
  const phHeight = showPlaceholder ? Math.max(56, ((drag.activeData.getHeight as (() => number) | undefined)?.() ?? 0) || 72) : 0;
  const visible = tasks;
  // index among the cards excluding the one being dragged (the lib computes overIndex that way)
  const others = dragging ? visible.filter((t) => t.id !== drag.activeId).length : visible.length;
  const phIndex = Math.min(drop.overIndex ?? others, others);
  const doneCol = status.category === 'done' || status.category === 'cancelled';

  const menu: MenuItem[] = [
    { label: collapsed ? 'Expand column' : 'Collapse column', icon: collapsed ? 'chevrons-right' : 'chevrons-left', onSelect: onToggleCollapse },
    ...(ctx.canEdit ? [{ label: 'New task here', icon: 'plus', onSelect: onCreate }] : []),
  ];

  const rows: React.ReactNode[] = [];
  let j = 0;
  let placed = false;
  for (const t of visible) {
    const isActive = t.id === drag.activeId;
    if (showPlaceholder && !placed && !isActive && j === phIndex) {
      rows.push(<div key="ph" className="board-placeholder" style={{ height: phHeight }} />);
      placed = true;
    }
    rows.push(<BoardCard key={t.id} task={t} ctx={ctx} />);
    if (!isActive) j++;
  }
  if (showPlaceholder && !placed) rows.push(<div key="ph" className="board-placeholder" style={{ height: phHeight }} />);

  return (
    <section
      ref={drop.ref as React.RefObject<HTMLElement>}
      {...drop.attributes}
      className={cx('board-column', collapsed && 'is-collapsed', drop.isOver && dragging && 'is-over', doneCol && 'is-done-col', activeTask && activeTask.statusId === status.id && 'is-source')}
      aria-label={`${status.name} column`}
      style={{ ['--col-color' as string]: status.color }}
    >
      <header className="board-column-head">
        <button type="button" className="board-column-title" onClick={collapsed ? onToggleCollapse : undefined} title={collapsed ? 'Expand column' : status.name}>
          <StatusIcon category={status.category} color={status.color} size={15} />
          <span className="board-column-name truncate">{status.name}</span>
          <span className="board-column-count tabular">{tasks.length}</span>
        </button>
        {!collapsed ? (
          <span className="board-column-actions">
            {ctx.canEdit ? (
              <Tooltip content="New task">
                <Button size="sm" variant="ghost" icon="plus" iconOnly onClick={onCreate} aria-label={`New task in ${status.name}`}>New task</Button>
              </Tooltip>
            ) : null}
            <MoreMenu items={menu} label="Column options" />
          </span>
        ) : null}
      </header>
      {!collapsed ? (
        <div className="board-column-body">
          {rows}
          {!visible.length && !showPlaceholder ? (
            <div className="board-column-empty">{dragging ? 'Drop here' : ctx.filtered ? 'No matching tasks' : ctx.canEdit ? 'No tasks yet' : 'No tasks'}</div>
          ) : null}
          {ctx.canEdit ? <QuickAdd projectId={ctx.project.id} statusId={status.id} /> : null}
        </div>
      ) : (
        <div className="board-column-collapsed-body" onClick={onToggleCollapse}>
          <span className="board-column-vname">{status.name}</span>
        </div>
      )}
    </section>
  );
}

// ---- Board ----
export function BoardView(props: ViewProps) {
  const { project, statuses, labels, members, tasks, filters, canEdit, openTask, createTask, selection, setSelection } = props;
  const filtered = countActiveFilters(filters) > 0;
  const [collapsed, setCollapsed] = useLocalStorage<string[]>(`tt.board.collapsed.${project.id}`, []);
  const ordered = useMemo(() => [...statuses].sort((a, b) => a.position - b.position), [statuses]);
  const byStatus = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const s of ordered) m.set(s.id, []);
    for (const t of tasks) {
      const arr = m.get(t.statusId);
      if (arr) arr.push(t);
    }
    return m;
  }, [tasks, ordered]);
  const byStatusRef = useRef(byStatus);
  byStatusRef.current = byStatus;
  const lastClicked = useRef<string | null>(null);

  const toggleSelect = useCallback(
    (id: string, e?: React.MouseEvent) => {
      const next = new Set(selection);
      if (e?.shiftKey && lastClicked.current && lastClicked.current !== id) {
        // range within the same column
        const col = [...byStatusRef.current.values()].find((arr) => arr.some((t) => t.id === id) && arr.some((t) => t.id === lastClicked.current));
        if (col) {
          const a = col.findIndex((t) => t.id === id);
          const b = col.findIndex((t) => t.id === lastClicked.current);
          for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(col[i].id);
          setSelection(next);
          return;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      lastClicked.current = id;
      setSelection(next);
    },
    [selection, setSelection],
  );

  const ctx: CardCtx = useMemo(() => ({ project, statuses: ordered, labels, members, canEdit, openTask, selection, toggleSelect, filtered }), [project, ordered, labels, members, canEdit, openTask, selection, toggleSelect, filtered]);

  const onDragEnd = useCallback(
    (r: DropResult) => {
      if (!r.over) return;
      const task = r.activeData.task as Task;
      const statusId = r.over.data.statusId as string;
      if (!statusId) return;
      const list = (byStatusRef.current.get(statusId) ?? []).filter((t) => t.id !== task.id);
      const idx = Math.min(r.over.index ?? list.length, list.length);
      const before = list[idx - 1] ?? null; // task above the drop position
      const after = list[idx] ?? null; // task below
      if (task.statusId === statusId) {
        const cur = byStatusRef.current.get(statusId) ?? [];
        const curIdx = cur.findIndex((t) => t.id === task.id);
        const curBefore = cur[curIdx - 1] ?? null;
        const curAfter = cur[curIdx + 1] ?? null;
        if (curBefore?.id === before?.id && curAfter?.id === after?.id) return; // dropped in place
      }
      const position = positionBetween(before?.position ?? null, after?.position ?? null);
      moveTask({ ...task, position }, { statusId, beforeId: before?.id ?? null, afterId: after?.id ?? null }, statuses).catch((e) => toast.fromError(e));
    },
    [statuses],
  );

  if (!ordered.length) {
    return <EmptyState icon="board" title="No statuses" description="This project has no workflow statuses yet. Add some in project settings." />;
  }

  const collapsedSet = new Set(collapsed);
  const toggleCollapse = (id: string) => setCollapsed((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <DndProvider onDragEnd={onDragEnd} renderOverlay={(s) => (s.activeData.task ? <BoardCard task={s.activeData.task as Task} ctx={ctx} overlay /> : null)}>
      <div className={cx('board', selection.size > 0 && 'has-selection', !canEdit && 'is-readonly')} role="list" aria-label="Board">
        {ordered.map((s) => (
          <Column key={s.id} status={s} tasks={byStatus.get(s.id) ?? []} ctx={ctx} collapsed={collapsedSet.has(s.id)} onToggleCollapse={() => toggleCollapse(s.id)} onCreate={() => createTask({ statusId: s.id })} />
        ))}
        <div className="board-end" />
      </div>
    </DndProvider>
  );
}
