// Floating multi-select action bar (status, priority, assignee, labels, due date, archive, delete).
import { useRef, useState, type ReactNode } from 'react';
import type { Label, Priority, Task, TaskStatus, WorkspaceMember } from '../../../../../packages/shared/src/types.ts';
import { PRIORITIES } from '../../../../../packages/shared/src/constants.ts';
import { bulkDeleteTasks, bulkUpdateTasks, updateTask, type TaskPatch } from '../../app/data.ts';
import { useMe } from '../../app/auth.tsx';
import { invalidate } from '../../lib/query.ts';
import { toast } from '../../lib/toast.ts';
import { useHotkey } from '../../lib/hooks.ts';
import { Popover, Tooltip, useConfirm } from '../../ui/overlays.tsx';
import { DatePicker, ListPicker, type PickerItem } from '../../ui/pickers.tsx';
import { Button, PriorityIcon, StatusIcon } from '../../ui/primitives.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { memberItems } from '../tasks/fields.tsx';
import './projects.css';

export interface BulkBarProps {
  projectId: string;
  tasks: Task[];
  statuses: TaskStatus[];
  labels: Label[];
  members: WorkspaceMember[];
  selection: Set<string>;
  setSelection: (ids: Set<string>) => void;
}

function BulkPicker<V extends string>({ label, icon, items, onSelect, width = 240, searchable, multi, value }: { label: string; icon: ReactNode; items: PickerItem<V>[]; onSelect: (v: V) => void; width?: number; searchable?: boolean; multi?: boolean; value?: V[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <Button ref={ref} size="sm" variant="ghost" className="bulk-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        {icon}
        <span>{label}</span>
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={width} placement="top" role="listbox">
        <ListPicker items={items} value={value} multi={multi} searchable={searchable ?? items.length > 6} placeholder={`${label}…`} onSelect={(v) => { onSelect(v); if (!multi) setOpen(false); }} />
      </Popover>
    </>
  );
}

export function BulkBar({ projectId, tasks, statuses, labels, members, selection, setSelection }: BulkBarProps) {
  const me = useMe();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const ids = [...selection];
  const selected = tasks.filter((t) => selection.has(t.id));
  const n = ids.length;
  const clear = () => setSelection(new Set());
  useHotkey('esc', clear, { allowInInput: true });

  const apply = async (patch: TaskPatch, msg: string) => {
    setBusy(true);
    try {
      await bulkUpdateTasks(projectId, ids, patch);
      toast.success(msg);
      if (patch.archived !== undefined) {
        invalidate(`tasks:${projectId}`);
        clear();
      }
    } catch (e) {
      toast.fromError(e);
      invalidate(`tasks:${projectId}`);
    } finally {
      setBusy(false);
    }
  };

  const addLabel = async (labelId: string) => {
    setBusy(true);
    try {
      await Promise.all(selected.filter((t) => !t.labelIds.includes(labelId)).map((t) => updateTask(t, { labelIds: [...t.labelIds, labelId] })));
      toast.success(`Label added to ${n} task${n === 1 ? '' : 's'}`);
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!(await confirm({ title: `Delete ${n} task${n === 1 ? '' : 's'}?`, description: 'This permanently deletes the selected tasks and their subtasks, comments and attachments.', danger: true, confirmLabel: 'Delete' }))) return;
    setBusy(true);
    try {
      await bulkDeleteTasks(projectId, ids);
      toast.success(`Deleted ${n} task${n === 1 ? '' : 's'}`);
      clear();
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(false);
    }
  };

  const statusItems: PickerItem[] = [...statuses].sort((a, b) => a.position - b.position).map((s) => ({ value: s.id, label: s.name, icon: <StatusIcon category={s.category} color={s.color} /> }));
  const priorityItems: PickerItem[] = PRIORITIES.map((p) => ({ value: String(p.value), label: p.label, icon: <PriorityIcon priority={p.value} /> }));
  const assigneeItems: PickerItem[] = [{ value: '__none__', label: 'Unassigned', icon: <Icon name="user" size={16} className="muted" /> }, ...memberItems(members, me.id)];
  const labelItems: PickerItem[] = labels.map((l) => ({ value: l.id, label: l.name, icon: <span className="dot" style={{ background: l.color, width: 9, height: 9 }} /> }));
  const allDone = selected.length > 0 && selected.every((t) => t.statusCategory === 'done');
  const doneStatus = statuses.find((s) => s.category === 'done');

  return (
    <div className="bulk-bar" role="region" aria-label="Bulk actions" aria-busy={busy}>
      <div className="bulk-count">
        <span className="bulk-count-n">{n}</span> selected
      </div>
      <div className="bulk-sep" />
      <div className="bulk-actions">
        {doneStatus && !allDone ? (
          <Tooltip content="Mark as done">
            <Button size="sm" variant="ghost" className="bulk-btn" icon="circle-check" onClick={() => apply({ statusId: doneStatus.id }, `${n} marked done`)}>Done</Button>
          </Tooltip>
        ) : null}
        <BulkPicker label="Status" icon={<Icon name="circle-dot" size={14} />} items={statusItems} onSelect={(v) => apply({ statusId: v }, 'Status updated')} />
        <BulkPicker label="Priority" icon={<Icon name="flag" size={14} />} items={priorityItems} searchable={false} width={200} onSelect={(v) => apply({ priority: Number(v) as Priority }, 'Priority updated')} />
        <BulkPicker label="Assignee" icon={<Icon name="user" size={14} />} items={assigneeItems} width={260} onSelect={(v) => apply({ assigneeId: v === '__none__' ? null : v }, 'Assignee updated')} />
        <BulkPicker label="Label" icon={<Icon name="tag" size={14} />} items={labelItems} onSelect={addLabel} />
        <DatePicker value={null} onChange={(d) => apply({ dueDate: d }, d ? 'Due date set' : 'Due date cleared')} size="sm" variant="ghost" className="bulk-btn" label={<span>Due date</span>} clearable={false} />
        <div className="bulk-sep" />
        <Tooltip content="Archive selected">
          <Button size="sm" variant="ghost" className="bulk-btn" icon="archive" onClick={() => apply({ archived: true }, `Archived ${n} task${n === 1 ? '' : 's'}`)}>Archive</Button>
        </Tooltip>
        <Tooltip content="Delete selected">
          <Button size="sm" variant="ghost" className="bulk-btn is-danger" icon="trash" onClick={del}>Delete</Button>
        </Tooltip>
      </div>
      <div className="bulk-sep" />
      <Tooltip content="Clear selection" shortcut="Esc">
        <Button size="sm" variant="ghost" icon="x" iconOnly onClick={clear} aria-label="Clear selection">Clear selection</Button>
      </Tooltip>
      {busy ? <Icon name="loader" size={14} className="spinner muted" /> : null}
    </div>
  );
}
