// Groupable table view with inline editing, keyboard navigation and expandable subtasks.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Task } from '../../../../../../packages/shared/src/types.ts';
import type { ViewProps } from './types.ts';
import { deleteTask, keys, taskApi, updateTask } from '../../../app/data.ts';
import { useWorkspace } from '../../../app/workspace.tsx';
import { invalidate } from '../../../lib/query.ts';
import { toast } from '../../../lib/toast.ts';
import { useHotkey, useIsMobile, useTick } from '../../../lib/hooks.ts';
import { useSearchParams } from '../../../lib/router.tsx';
import { relativeTime } from '../../../lib/format.ts';
import { Avatar, Button, Checkbox, EmptyState, PriorityIcon, StatusIcon, cx } from '../../../ui/primitives.tsx';
import { Tooltip, useConfirm, type MenuItem } from '../../../ui/overlays.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { AssigneePicker, DueDateButton, EstimateInput, LabelChips, LabelPicker, PriorityPicker, ProgressMini, StatusPicker, TaskKey } from '../../tasks/fields.tsx';
import { groupTasks, isDone, parseSort, sortTasks, toggleSort, type SortField, type TaskGroup } from '../filters.ts';
import { MoreMenu } from './BoardView.tsx';
import '../list.css';

interface FlatRow {
  task: Task;
  depth: number;
  groupKey: string;
}

const COLUMNS: { key: string; label: string; icon?: string; sort?: SortField; className?: string; mobile?: boolean }[] = [
  { key: 'check', label: '', mobile: true },
  { key: 'key', label: 'Key', className: 'list-col-key' },
  { key: 'title', label: 'Title', sort: 'title', mobile: true },
  { key: 'status', label: 'Status', sort: 'status', mobile: true },
  { key: 'priority', label: 'Priority', icon: 'flag', sort: 'priority', className: 'list-col-center', mobile: true },
  { key: 'assignee', label: 'Assignee', icon: 'user', sort: 'assignee', className: 'list-col-center', mobile: true },
  { key: 'labels', label: 'Labels' },
  { key: 'due', label: 'Due', sort: 'dueDate', mobile: true },
  { key: 'estimate', label: 'Estimate', sort: 'estimate' },
  { key: 'subtasks', label: 'Subtasks', icon: 'git-branch', className: 'list-col-center' },
  { key: 'updated', label: 'Updated', sort: 'updatedAt' },
  { key: 'menu', label: '' },
];

function GroupIcon({ g }: { g: TaskGroup }) {
  if (g.icon === 'status' && g.status) return <StatusIcon category={g.status.category} color={g.status.color} size={15} />;
  if (g.icon === 'priority' && g.priority !== undefined) return <PriorityIcon priority={g.priority} size={15} />;
  if (g.icon === 'assignee') return g.member ? <Avatar name={g.member.user.name} src={g.member.user.avatarUrl} size={18} /> : <span className="assignee-empty"><Icon name="user" size={12} /></span>;
  if (g.icon === 'label') return <span className="dot" style={{ background: g.labelObj?.color ?? 'var(--fg-faint)', width: 10, height: 10 }} />;
  return <Icon name="list" size={14} className="muted" />;
}

export function ListView(props: ViewProps) {
  const { project, statuses, labels, members, tasks, allTasks, filters, canEdit, openTask, createTask, selection, setSelection, groupBy, sortBy } = props;
  const isMobile = useIsMobile();
  const { base } = useWorkspace();
  const confirm = useConfirm();
  const [, setParams] = useSearchParams();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastClicked = useRef<string | null>(null);
  useTick(60_000);

  const ordered = useMemo(() => [...statuses].sort((a, b) => a.position - b.position), [statuses]);
  const groups = useMemo(() => groupTasks(tasks, groupBy, { statuses: ordered, labels, members }), [tasks, groupBy, ordered, labels, members]);
  const childrenOf = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of allTasks) {
      if (!t.parentId || t.archivedAt) continue;
      const arr = m.get(t.parentId) ?? [];
      arr.push(t);
      m.set(t.parentId, arr);
    }
    for (const [k, arr] of m) m.set(k, sortTasks(arr, sortBy, ordered, members));
    return m;
  }, [allTasks, sortBy, ordered, members]);
  const showChildren = !filters.includeSubtasks;

  const flat = useMemo(() => {
    const rows: FlatRow[] = [];
    for (const g of groups) {
      if (collapsedGroups.has(g.key)) continue;
      for (const t of g.tasks) {
        rows.push({ task: t, depth: 0, groupKey: g.key });
        if (showChildren && expanded.has(t.id)) for (const c of childrenOf.get(t.id) ?? []) rows.push({ task: c, depth: 1, groupKey: g.key });
      }
    }
    return rows;
  }, [groups, collapsedGroups, expanded, childrenOf, showChildren]);
  const flatRef = useRef(flat);
  flatRef.current = flat;

  // ---- keyboard navigation ----
  const focusRow = useCallback((id: string | null) => {
    setFocusId(id);
    if (!id) return;
    const el = listRef.current?.querySelector<HTMLElement>(`.list-row[data-task-id="${id}"]`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest' });
  }, []);
  const move = useCallback(
    (delta: number) => {
      const rows = flatRef.current;
      if (!rows.length) return;
      const idx = rows.findIndex((r) => r.task.id === focusId);
      const next = idx === -1 ? (delta > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, idx + delta));
      focusRow(rows[next].task.id);
    },
    [focusId, focusRow],
  );
  const inRow = (e: KeyboardEvent) => Boolean((e.target as HTMLElement)?.closest?.('.list-row'));
  useHotkey('j', (e) => { if (!inRow(e)) move(1); });
  useHotkey('k', (e) => { if (!inRow(e)) move(-1); });
  useHotkey('arrowdown', (e) => { if (!inRow(e)) move(1); });
  useHotkey('arrowup', (e) => { if (!inRow(e)) move(-1); });

  const toggleSelect = useCallback(
    (id: string, shift?: boolean) => {
      const next = new Set(selection);
      if (shift && lastClicked.current && lastClicked.current !== id) {
        const rows = flatRef.current;
        const a = rows.findIndex((r) => r.task.id === id);
        const b = rows.findIndex((r) => r.task.id === lastClicked.current);
        if (a !== -1 && b !== -1) {
          for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(rows[i].task.id);
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

  const clickField = (rowEl: HTMLElement, field: string) => {
    const btn = rowEl.querySelector<HTMLButtonElement>(`[data-field="${field}"] button`);
    btn?.click();
  };

  const onRowKey = (e: React.KeyboardEvent<HTMLDivElement>, task: Task) => {
    if (e.target !== e.currentTarget) return; // ignore keys from nested inputs/buttons
    const k = e.key.toLowerCase();
    if (k === 'j' || k === 'arrowdown') { e.preventDefault(); move(1); }
    else if (k === 'k' || k === 'arrowup') { e.preventDefault(); move(-1); }
    else if (k === 'enter' || k === 'o') { e.preventDefault(); openTask(task); }
    else if (k === 'x' || k === ' ') { e.preventDefault(); toggleSelect(task.id, e.shiftKey); }
    else if (canEdit && (k === 's' || k === 'p' || k === 'a' || k === 'd' || k === 'l')) {
      e.preventDefault();
      clickField(e.currentTarget, { s: 'status', p: 'priority', a: 'assignee', d: 'due', l: 'labels' }[k]!);
    } else if (canEdit && k === 'r' ) { e.preventDefault(); startEdit(task); }
    else if (k === 'arrowright' && showChildren && (childrenOf.get(task.id)?.length ?? 0) > 0) { e.preventDefault(); setExpanded((s) => new Set(s).add(task.id)); }
    else if (k === 'arrowleft' && expanded.has(task.id)) { e.preventDefault(); setExpanded((s) => { const n = new Set(s); n.delete(task.id); return n; }); }
  };

  // ---- inline rename ----
  const startEdit = (task: Task) => {
    if (!canEdit) return;
    setEditingId(task.id);
    setDraft(task.title);
  };
  const commitEdit = (task: Task) => {
    const t = draft.trim();
    setEditingId(null);
    if (t && t !== task.title) updateTask(task, { title: t }).catch((e) => toast.fromError(e));
  };
  useEffect(() => {
    if (!editingId) return;
    const el = listRef.current?.querySelector<HTMLInputElement>(`.list-row[data-task-id="${editingId}"] .list-title-input`);
    el?.focus();
    el?.select();
  }, [editingId]);

  const patch = (task: Task, p: Parameters<typeof updateTask>[1]) => updateTask(task, p).catch((e) => toast.fromError(e));
  const rowMenu = (task: Task): MenuItem[] => [
    { label: 'Open', icon: 'maximize', onSelect: () => openTask(task) },
    { label: 'Copy link', icon: 'link', onSelect: () => { void navigator.clipboard?.writeText(`${window.location.origin}${base}/p/${project.key}?task=${task.key}`); toast.success('Link copied'); } },
    ...(canEdit
      ? ([
          { label: 'Rename', icon: 'pencil', shortcut: 'R', onSelect: () => startEdit(task) },
          { separator: true, label: '' },
          { label: 'Duplicate', icon: 'copy', onSelect: () => void taskApi.duplicate(task.id).then(() => { invalidate(keys.tasks(project.id)); toast.success('Task duplicated'); }).catch((e) => toast.fromError(e)) },
          { label: task.archivedAt ? 'Unarchive' : 'Archive', icon: 'archive', onSelect: () => void patch(task, { archived: !task.archivedAt }) },
          { label: 'Delete', icon: 'trash', danger: true, onSelect: async () => { if (await confirm({ title: `Delete ${task.key}?`, description: 'This permanently deletes the task, its subtasks, comments and attachments.', danger: true, confirmLabel: 'Delete' })) deleteTask(task).catch((e) => toast.fromError(e)); } },
        ] as MenuItem[])
      : []),
  ];

  const sort = parseSort(sortBy);
  const cols = COLUMNS.filter((c) => !isMobile || c.mobile);
  const allSelected = tasks.length > 0 && tasks.every((t) => selection.has(t.id));
  const someSelected = tasks.some((t) => selection.has(t.id));

  const renderRow = (row: FlatRow) => {
    const { task, depth } = row;
    const done = isDone(task);
    const selected = selection.has(task.id);
    const kids = showChildren ? (childrenOf.get(task.id) ?? []) : [];
    const isExpanded = expanded.has(task.id);
    const editing = editingId === task.id;
    const cell = (key: string, content: ReactNode, extra?: string) => <div key={key} className={cx('list-cell', `list-cell-${key}`, extra)} data-field={key}>{content}</div>;
    return (
      <div
        key={task.id}
        className={cx('list-row', done && 'is-done', selected && 'is-selected', focusId === task.id && 'is-focused', depth > 0 && 'is-subtask', task.archivedAt && 'is-archived')}
        data-task-id={task.id}
        role="row"
        tabIndex={0}
        aria-selected={selected}
        onClick={(e) => {
          if (editing) return;
          if (e.shiftKey || e.metaKey || e.ctrlKey) { toggleSelect(task.id, e.shiftKey); return; }
          openTask(task);
        }}
        onFocus={() => setFocusId(task.id)}
        onKeyDown={(e) => onRowKey(e, task)}
        onDoubleClick={(e) => { if ((e.target as HTMLElement).closest('.list-cell-title')) { e.preventDefault(); startEdit(task); } }}
      >
        {cell('check', <span onClick={(e) => e.stopPropagation()}><Checkbox size={14} checked={selected} onChange={() => toggleSelect(task.id)} /></span>)}
        {!isMobile ? cell('key', <TaskKey task={task} />) : null}
        {cell(
          'title',
          <>
            {depth > 0 ? <span className="list-indent" /> : null}
            {kids.length ? (
              <button type="button" className={cx('list-chevron', isExpanded && 'is-open')} onClick={(e) => { e.stopPropagation(); setExpanded((s) => { const n = new Set(s); if (n.has(task.id)) n.delete(task.id); else n.add(task.id); return n; }); }} aria-label={isExpanded ? 'Collapse subtasks' : `Expand ${kids.length} subtasks`} aria-expanded={isExpanded}>
                <Icon name="chevron-right" size={13} />
              </button>
            ) : depth === 0 ? <span className="list-chevron-spacer" /> : null}
            {isMobile ? <TaskKey task={task} className="list-mobile-key" /> : null}
            {editing ? (
              <input
                className="list-title-input"
                value={draft}
                maxLength={200}
                onChange={(e) => setDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit(task); }
                  if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); }
                }}
                onBlur={() => commitEdit(task)}
                aria-label="Task title"
              />
            ) : (
              <span className="list-title truncate" title={task.title}>{task.title}</span>
            )}
            {!editing && canEdit ? (
              <button type="button" className="list-title-edit" onClick={(e) => { e.stopPropagation(); startEdit(task); }} aria-label="Rename task" title="Rename">
                <Icon name="pencil" size={12} />
              </button>
            ) : null}
            {task.parentId && depth === 0 ? <Tooltip content="Subtask"><Icon name="git-branch" size={12} className="muted" /></Tooltip> : null}
          </>,
        )}
        {cell('status', <StatusPicker value={task.statusId} statuses={ordered} onChange={(id) => void patch(task, { statusId: id })} disabled={!canEdit} showLabel={!isMobile} />)}
        {cell('priority', <PriorityPicker value={task.priority} onChange={(p) => void patch(task, { priority: p })} disabled={!canEdit} />, 'list-col-center')}
        {cell('assignee', <AssigneePicker value={task.assigneeId} onChange={(id) => void patch(task, { assigneeId: id })} disabled={!canEdit} members={members} />, 'list-col-center')}
        {!isMobile
          ? cell(
              'labels',
              <span onClick={(e) => e.stopPropagation()}>
                <LabelPicker value={task.labelIds} labels={labels} onChange={(ids) => void patch(task, { labelIds: ids })} disabled={!canEdit}>
                  {task.labelIds.length ? <LabelChips labelIds={task.labelIds} labels={labels} max={2} /> : undefined}
                </LabelPicker>
              </span>,
            )
          : null}
        {cell('due', <span onClick={(e) => e.stopPropagation()}><DueDateButton value={task.dueDate} onChange={(d) => void patch(task, { dueDate: d })} done={done} disabled={!canEdit} /></span>)}
        {!isMobile ? cell('estimate', canEdit ? <span onClick={(e) => e.stopPropagation()}><EstimateInput value={task.estimateMinutes} onChange={(m) => void patch(task, { estimateMinutes: m })} /></span> : <span className="small muted">{task.estimateMinutes ? `${task.estimateMinutes}m` : ''}</span>) : null}
        {!isMobile ? cell('subtasks', task.subtaskCount ? <ProgressMini done={task.subtaskDoneCount} total={task.subtaskCount} /> : <span className="faint">—</span>, 'list-col-center') : null}
        {!isMobile ? cell('updated', <span className="xs muted" title={task.updatedAt}>{relativeTime(task.updatedAt)}</span>) : null}
        {!isMobile ? cell('menu', <span onClick={(e) => e.stopPropagation()} className="list-row-menu"><MoreMenu items={rowMenu(task)} label="Task actions" /></span>) : null}
      </div>
    );
  };

  if (!tasks.length) {
    const hasFilters = Boolean(filters.statusIds?.length || filters.assigneeIds?.length || filters.priorities?.length || filters.labelIds?.length || filters.due || filters.search);
    return (
      <div className="list-empty">
        <EmptyState
          icon={hasFilters ? 'filter' : 'list'}
          title={hasFilters ? 'No tasks match these filters' : 'No tasks yet'}
          description={hasFilters ? 'Try removing a filter or two.' : 'Create the first task to get this project moving.'}
          action={canEdit && !hasFilters ? <Button variant="primary" icon="plus" onClick={() => createTask()}>Create task</Button> : undefined}
        />
      </div>
    );
  }

  return (
    <div ref={listRef} className={cx('list', isMobile && 'is-mobile', selection.size > 0 && 'has-selection', !canEdit && 'is-readonly')} role="table" aria-label="Tasks" aria-rowcount={flat.length}>
      <div className="list-head" role="row">
        {cols.map((c) => {
          const active = c.sort && sort.field === c.sort;
          if (c.key === 'check') {
            return (
              <div key={c.key} className="list-cell list-cell-check" role="columnheader">
                <Checkbox size={14} checked={allSelected} indeterminate={!allSelected && someSelected} onChange={(v) => setSelection(v ? new Set(tasks.map((t) => t.id)) : new Set())} />
              </div>
            );
          }
          return (
            <div key={c.key} className={cx('list-cell', `list-cell-${c.key}`, c.className, c.sort && 'is-sortable', active && 'is-sorted')} role="columnheader" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} onClick={c.sort ? () => setParams({ sort: toggleSort(sortBy, c.sort!) }) : undefined} title={c.sort ? `Sort by ${c.label.toLowerCase()}` : c.label || undefined} aria-label={c.label || undefined}>
              {c.icon ? <Icon name={c.icon} size={13} /> : <span>{c.label}</span>}
              {active ? <Icon name={sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'} size={11} /> : null}
            </div>
          );
        })}
      </div>
      {groups.map((g) => {
        const collapsed = collapsedGroups.has(g.key);
        const single = groupBy === 'none';
        return (
          <div key={g.key} className={cx('list-group', collapsed && 'is-collapsed')} role="rowgroup">
            {!single ? (
              <div className="list-group-head" role="row">
                <button type="button" className="list-group-toggle" onClick={() => setCollapsedGroups((s) => { const n = new Set(s); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })} aria-expanded={!collapsed}>
                  <Icon name="chevron-right" size={13} className={cx('list-group-chevron', !collapsed && 'is-open')} />
                  <GroupIcon g={g} />
                  <span className="list-group-label">{g.label}</span>
                  <span className="list-group-count tabular">{g.tasks.length}</span>
                </button>
                {canEdit ? (
                  <Tooltip content={`New task in ${g.label}`}>
                    <Button size="sm" variant="ghost" icon="plus" iconOnly className="list-group-add" onClick={() => createTask(g.createDefaults)} aria-label={`New task in ${g.label}`}>New task</Button>
                  </Tooltip>
                ) : null}
              </div>
            ) : null}
            {!collapsed ? (g.tasks.length ? flat.filter((r) => r.groupKey === g.key).map(renderRow) : <div className="list-group-empty">No tasks</div>) : null}
          </div>
        );
      })}
      <div className="list-foot xs muted">
        {tasks.length} task{tasks.length === 1 ? '' : 's'}
        {!isMobile ? <span className="list-foot-hint"> · <kbd className="kbd">J</kbd> <kbd className="kbd">K</kbd> navigate · <kbd className="kbd">↵</kbd> open · <kbd className="kbd">X</kbd> select · <kbd className="kbd">S</kbd> <kbd className="kbd">P</kbd> <kbd className="kbd">A</kbd> <kbd className="kbd">D</kbd> edit</span> : null}
      </div>
    </div>
  );
}
