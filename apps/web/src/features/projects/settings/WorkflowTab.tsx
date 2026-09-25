// Project settings → Workflow: ordered statuses with drag-to-reorder, inline edits, category, color and safe deletion.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectBundle, StatusCategory, Task, TaskStatus } from '../../../../../../packages/shared/src/types.ts';
import { DEFAULT_STATUSES, LABEL_COLORS, STATUS_CATEGORIES } from '../../../../../../packages/shared/src/constants.ts';
import { keys, projectApi } from '../../../app/data.ts';
import { DndProvider, useDragState, useDraggable, useDroppable, type DropResult } from '../../../lib/dnd.tsx';
import { invalidate, setQueryData } from '../../../lib/query.ts';
import { toast } from '../../../lib/toast.ts';
import { Icon } from '../../../ui/Icon.tsx';
import { Dialog, Popover } from '../../../ui/overlays.tsx';
import { ColorPicker, Select, type PickerItem } from '../../../ui/pickers.tsx';
import { Button, Input, StatusIcon, cx } from '../../../ui/primitives.tsx';
import { SettingsCard, SettingsNotice } from '../../settings/SettingsLayout.tsx';

const categoryItems: PickerItem<StatusCategory>[] = STATUS_CATEGORIES.map((c) => ({ value: c.value, label: c.label, icon: <StatusIcon category={c.value} color={DEFAULT_STATUSES.find((d) => d.category === c.value)?.color ?? '#888'} /> }));

function patchBundle(projectId: string, fn: (statuses: TaskStatus[]) => TaskStatus[]) {
  setQueryData<ProjectBundle>(keys.bundle(projectId), (prev) => (prev ? { ...prev, statuses: fn(prev.statuses) } : prev));
}

export function ColorSwatchButton({ value, onChange, disabled, label, dot }: { value: string; onChange: (c: string) => void; disabled?: boolean; label: string; dot?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={ref} type="button" className={cx('ps-swatch', dot && 'is-dot')} style={{ background: value }} onClick={() => !disabled && setOpen((o) => !o)} aria-label={label} title={disabled ? value : `${label} (${value})`} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} />
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={236} className="ps-color-popover">
        <ColorPicker value={value} onChange={(c) => { onChange(c); }} colors={LABEL_COLORS} />
      </Popover>
    </>
  );
}

function InlineName({ value, onCommit, disabled, ariaLabel }: { value: string; onCommit: (v: string) => void; disabled?: boolean; ariaLabel: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    const v = text.trim();
    if (!v || v === value) {
      setText(value);
      return;
    }
    onCommit(v);
  };
  return (
    <div className="ps-inline ps-status-name">
      <Input size="sm" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); if (e.key === 'Escape') { setText(value); (e.currentTarget as HTMLInputElement).blur(); } }} maxLength={40} disabled={disabled} aria-label={ariaLabel} />
    </div>
  );
}

function StatusRow({ status, count, canManage, onRename, onCategory, onColor, onDelete, overlay, overIndex, index, isLast }: { status: TaskStatus; count: number; canManage: boolean; onRename: (v: string) => void; onCategory: (c: StatusCategory) => void; onColor: (c: string) => void; onDelete: () => void; overlay?: boolean; overIndex: number | null; index: number; isLast: boolean }) {
  const drag = useDraggable(status.id, { status }, !canManage || overlay);
  const dragging = useDragState((s) => s.activeId);
  // Show an insertion line at the hovered index (index is computed excluding the dragged row).
  const showBefore = overIndex !== null && dragging && dragging !== status.id && overIndex === index;
  const showAfter = overIndex !== null && dragging && dragging !== status.id && isLast && overIndex > index;
  return (
    <div ref={drag.ref as React.RefObject<HTMLDivElement>} {...drag.attributes} className={cx('ps-status-row', !canManage && 'is-readonly', overlay && 'is-overlay', showBefore && 'is-over', showAfter && 'is-over-after')} data-testid="status-row" data-status-id={status.id} data-status-name={status.name}>
      {canManage ? (
        <span className="ps-grip" aria-label="Drag to reorder" title="Drag to reorder">
          <Icon name="grip" size={14} />
        </span>
      ) : null}
      <StatusIcon category={status.category} color={status.color} size={16} />
      {canManage ? <InlineName value={status.name} onCommit={onRename} ariaLabel={`Status name: ${status.name}`} /> : <span className="medium truncate">{status.name}</span>}
      <span data-no-drag>
        {canManage ? (
          <Select size="sm" variant="ghost" value={status.category} onChange={onCategory} items={categoryItems} width={220} searchable={false} title="Category" />
        ) : (
          <span className="small muted">{STATUS_CATEGORIES.find((c) => c.value === status.category)?.label}</span>
        )}
      </span>
      <span className="ps-count" title={`${count} task${count === 1 ? '' : 's'} in this status`}>{count} {count === 1 ? 'task' : 'tasks'}</span>
      {canManage ? (
        <span className="row gap-1" style={{ justifyContent: 'flex-end' }} data-no-drag>
          <ColorSwatchButton value={status.color} onChange={onColor} label={`Color for ${status.name}`} />
          <Button size="sm" variant="ghost" icon="trash" iconOnly onClick={onDelete} title={`Delete ${status.name}`}>{`Delete ${status.name}`}</Button>
        </span>
      ) : null}
    </div>
  );
}

function StatusList({ statuses, counts, canManage, onRename, onCategory, onColor, onDelete }: { statuses: TaskStatus[]; counts: Map<string, number>; canManage: boolean; onRename: (s: TaskStatus, v: string) => void; onCategory: (s: TaskStatus, c: StatusCategory) => void; onColor: (s: TaskStatus, c: string) => void; onDelete: (s: TaskStatus) => void }) {
  const drop = useDroppable('statuses', {}, { sortable: true, axis: 'y' });
  const activeId = useDragState((s) => s.activeId);
  // overIndex counts rows excluding the dragged one; map it onto full-list positions for the indicator
  let visualIndex = -1;
  const others = statuses.filter((s) => s.id !== activeId);
  const overIndex = drop.isOver && drop.overIndex !== null ? drop.overIndex : null;
  if (overIndex !== null) {
    const target = others[overIndex];
    visualIndex = target ? statuses.findIndex((s) => s.id === target.id) : statuses.length;
  }
  return (
    <div ref={drop.ref as React.RefObject<HTMLDivElement>} {...drop.attributes} className="ps-status-list" role="list" aria-label="Statuses">
      {statuses.map((s, i) => (
        <StatusRow key={s.id} status={s} count={counts.get(s.id) ?? 0} canManage={canManage} onRename={(v) => onRename(s, v)} onCategory={(c) => onCategory(s, c)} onColor={(c) => onColor(s, c)} onDelete={() => onDelete(s)} overIndex={overIndex === null ? null : visualIndex} index={i} isLast={i === statuses.length - 1} />
      ))}
    </div>
  );
}

export function WorkflowTab({ projectId, statuses: rawStatuses, tasks, canManage }: { projectId: string; statuses: TaskStatus[]; tasks: Task[]; canManage: boolean }) {
  const statuses = useMemo(() => [...rawStatuses].sort((a, b) => a.position - b.position), [rawStatuses]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks) m.set(t.statusId, (m.get(t.statusId) ?? 0) + 1);
    return m;
  }, [tasks]);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<StatusCategory>('todo');
  const [newColor, setNewColor] = useState(LABEL_COLORS[0]);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<TaskStatus | null>(null);

  const rename = async (s: TaskStatus, name: string) => {
    patchBundle(projectId, (list) => list.map((x) => (x.id === s.id ? { ...x, name } : x)));
    try {
      await projectApi.updateStatus(projectId, s.id, { name });
      invalidate(['tasks', keys.bundle(projectId)]);
    } catch (e) {
      patchBundle(projectId, (list) => list.map((x) => (x.id === s.id ? { ...x, name: s.name } : x)));
      toast.fromError(e);
    }
  };
  const setCategory = async (s: TaskStatus, category: StatusCategory) => {
    if (category === s.category) return;
    patchBundle(projectId, (list) => list.map((x) => (x.id === s.id ? { ...x, category } : x)));
    try {
      await projectApi.updateStatus(projectId, s.id, { category });
      invalidate(['tasks', keys.bundle(projectId), 'dashboard', 'mytasks']);
      toast.success(`${s.name} is now ${STATUS_CATEGORIES.find((c) => c.value === category)?.label}`);
    } catch (e) {
      patchBundle(projectId, (list) => list.map((x) => (x.id === s.id ? { ...x, category: s.category } : x)));
      toast.fromError(e);
    }
  };
  const setColor = async (s: TaskStatus, color: string) => {
    patchBundle(projectId, (list) => list.map((x) => (x.id === s.id ? { ...x, color } : x)));
    try {
      await projectApi.updateStatus(projectId, s.id, { color });
      invalidate(['tasks', keys.bundle(projectId)]);
    } catch (e) {
      patchBundle(projectId, (list) => list.map((x) => (x.id === s.id ? { ...x, color: s.color } : x)));
      toast.fromError(e);
    }
  };
  const onDragEnd = async (r: DropResult) => {
    if (!r.over || r.over.id !== 'statuses' || r.over.index === null) return;
    const others = statuses.filter((s) => s.id !== r.activeId);
    const active = statuses.find((s) => s.id === r.activeId);
    if (!active) return;
    const next = [...others.slice(0, r.over.index), active, ...others.slice(r.over.index)];
    if (next.every((s, i) => s.id === statuses[i].id)) return;
    const before = statuses;
    patchBundle(projectId, () => next.map((s, i) => ({ ...s, position: i })));
    try {
      await projectApi.reorderStatuses(projectId, next.map((s) => s.id));
      invalidate(keys.bundle(projectId));
    } catch (e) {
      patchBundle(projectId, () => before);
      toast.fromError(e);
    }
  };
  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    if (statuses.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      toast.error('A status with that name already exists');
      return;
    }
    setAdding(true);
    try {
      const created = await projectApi.addStatus(projectId, { name, category: newCategory, color: newColor });
      patchBundle(projectId, (list) => (list.some((s) => s.id === created.id) ? list : [...list, created]));
      invalidate(keys.bundle(projectId));
      setNewName('');
      toast.success(`Status “${name}” added`);
    } catch (e) {
      toast.fromError(e);
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      {!canManage ? <SettingsNotice>Only workspace admins and the project lead can change the workflow.</SettingsNotice> : null}
      <SettingsCard title="Workflow" description={`Statuses tasks move through, in board order.${canManage ? ' Drag rows to reorder.' : ''}`} flush>
        <div className="ps-category-legend">
          <span><StatusIcon category="backlog" color="#8b8fa3" /> Backlog and To do are “not started”</span>
          <span><StatusIcon category="in_progress" color="#f5a524" /> In progress counts as active</span>
          <span><StatusIcon category="done" color="#22c55e" /> Done and Cancelled mark tasks complete</span>
        </div>
        <DndProvider onDragEnd={(r) => void onDragEnd(r)} renderOverlay={(s) => (s.activeData.status ? <StatusRow status={s.activeData.status as TaskStatus} count={counts.get((s.activeData.status as TaskStatus).id) ?? 0} canManage overlay onRename={() => {}} onCategory={() => {}} onColor={() => {}} onDelete={() => {}} overIndex={null} index={-1} isLast={false} /> : null)}>
          <StatusList statuses={statuses} counts={counts} canManage={canManage} onRename={(s, v) => void rename(s, v)} onCategory={(s, c) => void setCategory(s, c)} onColor={(s, c) => void setColor(s, c)} onDelete={(s) => setDeleting(s)} />
        </DndProvider>
        {canManage ? (
          <form className="ps-add-row" onSubmit={(e) => { e.preventDefault(); void add(); }} data-testid="add-status">
            <ColorSwatchButton value={newColor} onChange={setNewColor} label="Color for the new status" />
            <Input size="sm" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New status, e.g. QA" maxLength={40} aria-label="New status name" data-testid="new-status-name" />
            <Select size="sm" value={newCategory} onChange={setNewCategory} items={categoryItems} width={220} searchable={false} title="Category" />
            <Button size="sm" variant="primary" type="submit" icon="plus" disabled={!newName.trim()} loading={adding}>Add status</Button>
          </form>
        ) : null}
      </SettingsCard>
      <DeleteStatusDialog status={deleting} statuses={statuses} count={deleting ? counts.get(deleting.id) ?? 0 : 0} projectId={projectId} onClose={() => setDeleting(null)} />
    </>
  );
}

function DeleteStatusDialog({ status, statuses, count, projectId, onClose }: { status: TaskStatus | null; statuses: TaskStatus[]; count: number; projectId: string; onClose: () => void }) {
  const others = statuses.filter((s) => s.id !== status?.id);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (status) setMoveTo(others.find((s) => s.category === status.category)?.id ?? others[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.id]);
  const items: PickerItem<string>[] = others.map((s) => ({ value: s.id, label: s.name, icon: <StatusIcon category={s.category} color={s.color} /> }));
  const run = async () => {
    if (!status) return;
    setBusy(true);
    try {
      await projectApi.deleteStatus(projectId, status.id, count ? moveTo ?? undefined : undefined);
      patchBundle(projectId, (list) => list.filter((s) => s.id !== status.id));
      invalidate(['tasks', keys.bundle(projectId), 'dashboard', 'mytasks']);
      toast.success(`Status “${status.name}” deleted`);
      onClose();
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={Boolean(status)}
      onClose={onClose}
      size="sm"
      title={status ? `Delete “${status.name}”?` : ''}
      description={others.length ? (count ? `${count} task${count === 1 ? '' : 's'} currently ${count === 1 ? 'uses' : 'use'} this status. Choose where to move ${count === 1 ? 'it' : 'them'}.` : 'No tasks use this status, so nothing will move.') : 'A project needs at least one status.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={!others.length || (count > 0 && !moveTo)} onClick={() => void run()} data-testid="confirm-delete-status">Delete status</Button>
        </>
      }
    >
      {count > 0 && others.length ? (
        <div className="col gap-2">
          <span className="field-label">Move tasks to</span>
          <Select value={moveTo} onChange={setMoveTo} items={items} width={260} searchable={others.length > 7} />
        </div>
      ) : null}
    </Dialog>
  );
}
