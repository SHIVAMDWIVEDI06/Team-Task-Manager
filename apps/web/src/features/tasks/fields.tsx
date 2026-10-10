// Shared task field widgets: pickers (status, priority, assignee, labels, due date, estimate) and read-only badges.
// Every view (board, list, calendar, timeline, task panel, create dialog) uses these so the app feels consistent.
import { useRef, useState, type ReactNode } from 'react';
import type { Label, Priority, Task, TaskStatus, Recurrence } from '../../../../../packages/shared/src/types.ts';
import { PRIORITIES, PRIORITY_LABEL } from '../../../../../packages/shared/src/constants.ts';
import { formatMinutes, parseDuration } from '../../../../../packages/shared/src/utils.ts';
import { Popover } from '../../ui/overlays.tsx';
import { ListPicker, DatePicker, type PickerItem } from '../../ui/pickers.tsx';
import { Avatar, Badge, Button, PriorityIcon, StatusIcon, cx, Input } from '../../ui/primitives.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { dueLabel } from '../../lib/format.ts';
import { useWorkspace } from '../../app/workspace.tsx';
import { useMe } from '../../app/auth.tsx';
import type { MemberWithPresence } from '../../app/data.ts';

type Size = 'sm' | 'md';

// ---- Status ----
export function StatusPicker({ value, statuses, onChange, size = 'sm', variant = 'ghost', showLabel = true, disabled, className, open: controlledOpen, onOpenChange }: { value: string; statuses: TaskStatus[]; onChange: (statusId: string) => void; size?: Size; variant?: 'ghost' | 'outline'; showLabel?: boolean; disabled?: boolean; className?: string; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (o: boolean) => {
    setInnerOpen(o);
    onOpenChange?.(o);
  };
  const ref = useRef<HTMLButtonElement | null>(null);
  const current = statuses.find((s) => s.id === value);
  const items: PickerItem[] = statuses.map((s) => ({ value: s.id, label: s.name, icon: <StatusIcon category={s.category} color={s.color} />, keywords: s.category }));
  return (
    <>
      <Button ref={ref} size={size} variant={variant} className={cx('field-btn', className)} disabled={disabled} onClick={(e) => { e.stopPropagation(); setOpen(!open); }} title={`Status: ${current?.name ?? '—'}`} aria-label={`Status: ${current?.name ?? 'none'}`} iconOnly={!showLabel}>
        {current ? <StatusIcon category={current.category} color={current.color} /> : <Icon name="circle" size={14} />}
        {showLabel ? <span className="truncate">{current?.name ?? 'Status'}</span> : null}
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={240} role="listbox">
        <ListPicker items={items} value={value} placeholder="Change status…" searchable={statuses.length > 6} onSelect={(v) => { onChange(v); setOpen(false); }} footer={<span className="row gap-2"><kbd className="kbd">S</kbd> opens this from anywhere</span>} />
      </Popover>
    </>
  );
}

// ---- Priority ----
const priorityItems: PickerItem<string>[] = PRIORITIES.map((p) => ({ value: String(p.value), label: p.label, icon: <PriorityIcon priority={p.value} />, shortcut: String(p.value) }));

export function PriorityPicker({ value, onChange, size = 'sm', variant = 'ghost', showLabel = false, disabled, className }: { value: Priority; onChange: (p: Priority) => void; size?: Size; variant?: 'ghost' | 'outline'; showLabel?: boolean; disabled?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <Button ref={ref} size={size} variant={variant} className={cx('field-btn', className)} disabled={disabled} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} title={`Priority: ${PRIORITY_LABEL[value]}`} aria-label={`Priority: ${PRIORITY_LABEL[value]}`} iconOnly={!showLabel}>
        <PriorityIcon priority={value} />
        {showLabel ? <span>{value === 0 ? 'Priority' : PRIORITY_LABEL[value]}</span> : null}
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={220} role="listbox">
        <ListPicker items={priorityItems} value={String(value)} searchable={false} onSelect={(v) => { onChange(Number(v) as Priority); setOpen(false); }} />
      </Popover>
    </>
  );
}

// ---- Assignee ----
export function memberItems(members: MemberWithPresence[], meId?: string): PickerItem<string>[] {
  const sorted = [...members].sort((a, b) => (a.userId === meId ? -1 : b.userId === meId ? 1 : a.user.name.localeCompare(b.user.name)));
  return sorted.map((m) => ({ value: m.userId, label: m.userId === meId ? `${m.user.name} (you)` : m.user.name, description: m.user.email, icon: <Avatar name={m.user.name} src={m.user.avatarUrl} size={18} />, keywords: m.user.email }));
}

export function AssigneePicker({ value, onChange, size = 'sm', variant = 'ghost', showLabel = false, disabled, className, members: membersProp }: { value: string | null; onChange: (userId: string | null) => void; size?: Size; variant?: 'ghost' | 'outline'; showLabel?: boolean; disabled?: boolean; className?: string; members?: MemberWithPresence[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);
  const ws = useWorkspace();
  const me = useMe();
  const members = membersProp ?? ws.members;
  const current = members.find((m) => m.userId === value);
  const items: PickerItem<string>[] = [{ value: '__none__', label: 'Unassigned', icon: <Icon name="user" size={16} className="muted" /> }, ...memberItems(members, me.id)];
  return (
    <>
      <Button ref={ref} size={size} variant={variant} className={cx('field-btn', className)} disabled={disabled} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} title={current ? `Assignee: ${current.user.name}` : 'Unassigned'} aria-label={current ? `Assignee: ${current.user.name}` : 'Assign'} iconOnly={!showLabel}>
        {current ? <Avatar name={current.user.name} src={current.user.avatarUrl} size={size === 'sm' ? 18 : 20} /> : <span className="assignee-empty"><Icon name="user" size={12} /></span>}
        {showLabel ? <span className="truncate">{current?.user.name ?? 'Assignee'}</span> : null}
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={260} role="listbox">
        <ListPicker items={items} value={value ?? '__none__'} placeholder="Assign to…" onSelect={(v) => { onChange(v === '__none__' ? null : v); setOpen(false); }} />
      </Popover>
    </>
  );
}

// ---- Labels ----
export function LabelPicker({ value, labels, onChange, onCreate, size = 'sm', variant = 'ghost', disabled, className, children }: { value: string[]; labels: Label[]; onChange: (labelIds: string[]) => void; onCreate?: (name: string) => Promise<Label | void>; size?: Size; variant?: 'ghost' | 'outline'; disabled?: boolean; className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);
  const items: PickerItem<string>[] = labels.map((l) => ({ value: l.id, label: l.name, icon: <span className="dot" style={{ background: l.color, width: 9, height: 9 }} /> }));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <>
      <Button ref={ref} size={size} variant={variant} className={cx('field-btn', className)} disabled={disabled} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} title="Labels" aria-label="Labels" iconOnly={!children} icon={children ? undefined : 'tag'}>
        {children}
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={250} role="listbox">
        <ListPicker items={items} value={value} multi placeholder="Add labels…" onSelect={toggle} onCreate={onCreate ? (q) => void onCreate(q).then((l) => l && onChange([...value, l.id])) : undefined} createLabel={(q) => `Create label "${q}"`} emptyText="No labels yet" />
      </Popover>
    </>
  );
}

export function LabelChips({ labelIds, labels, max = 3, size = 'sm' }: { labelIds: string[]; labels: Label[]; max?: number; size?: 'sm' | 'md' }) {
  const list = labelIds.map((id) => labels.find((l) => l.id === id)).filter(Boolean) as Label[];
  if (!list.length) return null;
  const shown = list.slice(0, max);
  return (
    <span className="row gap-1 wrap">
      {shown.map((l) => (
        <Badge key={l.id} color={l.color} size={size} dot>
          {l.name}
        </Badge>
      ))}
      {list.length > shown.length ? <Badge size={size} title={list.slice(max).map((l) => l.name).join(', ')}>+{list.length - shown.length}</Badge> : null}
    </span>
  );
}

// ---- Due date ----
export function DueDateButton({ value, onChange, done, size = 'sm', variant = 'ghost', disabled, className, showEmpty = true, label = 'Due' }: { value: string | null; onChange: (d: string | null) => void; done?: boolean; size?: Size; variant?: 'ghost' | 'outline'; disabled?: boolean; className?: string; showEmpty?: boolean; label?: string }) {
  const { label: text, tone } = dueLabel(value, done);
  if (!value && !showEmpty) return null;
  return <DatePicker value={value} onChange={onChange} size={size} variant={variant} disabled={disabled} className={cx('field-btn', `due-${tone}`, className)} icon="calendar" label={value ? text : <span className="muted">{label}</span>} />;
}

export function DueBadge({ value, done, size = 'sm' }: { value: string | null; done?: boolean; size?: 'sm' | 'md' }) {
  if (!value) return null;
  const { label, tone } = dueLabel(value, done);
  return (
    <span className={cx('due-badge', `due-${tone}`, size === 'md' && 'due-md')} title={value}>
      <Icon name={tone === 'overdue' ? 'alert-circle' : 'calendar'} size={size === 'sm' ? 12 : 13} />
      {label}
    </span>
  );
}

// ---- Estimate ----
export function EstimateInput({ value, onChange, size = 'sm', variant = 'ghost', className, placeholder = 'Estimate' }: { value: number | null; onChange: (minutes: number | null) => void; size?: Size; variant?: 'ghost' | 'outline'; className?: string; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const ref = useRef<HTMLButtonElement | null>(null);
  const commit = () => {
    const t = text.trim();
    if (!t) onChange(null);
    else {
      const m = parseDuration(t);
      if (m !== null) onChange(m);
    }
    setOpen(false);
  };
  return (
    <>
      <Button ref={ref} size={size} variant={variant} className={cx('field-btn', className)} icon="timer" onClick={(e) => { e.stopPropagation(); setText(value ? formatMinutes(value) : ''); setOpen((o) => !o); }} title="Estimate">
        {value ? formatMinutes(value) : <span className="muted">{placeholder}</span>}
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={220}>
        <div className="col gap-2 p-4" style={{ padding: 10 }}>
          <Input size="sm" autoFocus value={text} placeholder="e.g. 2h 30m" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
          <div className="row gap-1 wrap">
            {[30, 60, 120, 240, 480].map((m) => (
              <Button key={m} size="sm" variant="outline" onClick={() => { onChange(m); setOpen(false); }}>{formatMinutes(m)}</Button>
            ))}
          </div>
          <div className="row between">
            <Button size="sm" variant="ghost" onClick={() => { onChange(null); setOpen(false); }}>Clear</Button>
            <Button size="sm" variant="primary" onClick={commit}>Set</Button>
          </div>
        </div>
      </Popover>
    </>
  );
}

// ---- Recurrence ----
export function RecurrencePicker({ value, onChange, size = 'sm', variant = 'ghost', className }: { value: Recurrence | null; onChange: (r: Recurrence | null) => void; size?: Size; variant?: 'ghost' | 'outline'; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);
  const label = !value ? 'Repeat' : value.freq === 'daily' ? (value.interval > 1 ? `Every ${value.interval} days` : 'Daily') : value.freq === 'weekly' ? (value.interval > 1 ? `Every ${value.interval} weeks` : 'Weekly') : value.interval > 1 ? `Every ${value.interval} months` : 'Monthly';
  const presets: { label: string; value: Recurrence | null }[] = [
    { label: 'Does not repeat', value: null },
    { label: 'Daily', value: { freq: 'daily', interval: 1 } },
    { label: 'Every weekday', value: { freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] } },
    { label: 'Weekly', value: { freq: 'weekly', interval: 1 } },
    { label: 'Every 2 weeks', value: { freq: 'weekly', interval: 2 } },
    { label: 'Monthly', value: { freq: 'monthly', interval: 1 } },
    { label: 'Quarterly', value: { freq: 'monthly', interval: 3 } },
  ];
  return (
    <>
      <Button ref={ref} size={size} variant={variant} className={cx('field-btn', className)} icon="repeat" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} title="Recurrence">
        <span className={cx(!value && 'muted')}>{label}</span>
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={220} role="listbox">
        <ListPicker items={presets.map((p, i) => ({ value: String(i), label: p.label, icon: p.value ? <Icon name="repeat" size={14} /> : <Icon name="x" size={14} /> }))} value={String(Math.max(0, presets.findIndex((p) => JSON.stringify(p.value) === JSON.stringify(value))))} searchable={false} onSelect={(v) => { onChange(presets[Number(v)].value); setOpen(false); }} />
      </Popover>
    </>
  );
}

// ---- Compact read-only badges ----
export function StatusBadge({ task, size = 'sm' }: { task: Pick<Task, 'statusName' | 'statusCategory' | 'statusColor'>; size?: 'sm' | 'md' }) {
  return (
    <span className={cx('status-badge', size === 'md' && 'status-md')}>
      <StatusIcon category={task.statusCategory || 'todo'} color={task.statusColor || '#8b8fa3'} size={size === 'sm' ? 13 : 15} />
      <span>{task.statusName}</span>
    </span>
  );
}

export function ProjectBadge({ projectKey, color, name }: { projectKey?: string; color?: string; name?: string }) {
  return (
    <span className="project-badge" title={name}>
      <span className="dot" style={{ background: color || 'var(--fg-faint)', width: 8, height: 8 }} />
      {projectKey}
    </span>
  );
}

export function TaskKey({ task, className }: { task: Pick<Task, 'key'>; className?: string }) {
  return <span className={cx('task-key mono', className)}>{task.key}</span>;
}

export function ProgressMini({ done, total, title }: { done: number; total: number; title?: string }) {
  if (!total) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <span className="progress-mini" title={title ?? `${done}/${total}`}>
      <svg width={14} height={14} viewBox="0 0 14 14">
        <circle cx={7} cy={7} r={5.5} fill="none" stroke="var(--border-strong)" strokeWidth={2} />
        <circle cx={7} cy={7} r={5.5} fill="none" stroke={pct === 100 ? 'var(--success)' : 'var(--brand)'} strokeWidth={2} strokeDasharray={`${(pct / 100) * 34.6} 34.6`} strokeLinecap="round" transform="rotate(-90 7 7)" />
      </svg>
      <span className="xs muted tabular">{done}/{total}</span>
    </span>
  );
}
