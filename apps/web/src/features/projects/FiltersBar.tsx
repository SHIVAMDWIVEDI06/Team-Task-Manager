// Filter toolbar for project views: multi-select pickers, search, toggles, group/sort and removable chips.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Label, Priority, TaskFilters, TaskStatus, WorkspaceMember } from '../../../../../packages/shared/src/types.ts';
import { PRIORITIES, PRIORITY_LABEL } from '../../../../../packages/shared/src/constants.ts';
import { Popover } from '../../ui/overlays.tsx';
import { ListPicker, Select, type PickerItem } from '../../ui/pickers.tsx';
import { Avatar, Button, Checkbox, Input, PriorityIcon, StatusIcon, cx } from '../../ui/primitives.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { useDebouncedCallback } from '../../lib/hooks.ts';
import { useMe } from '../../app/auth.tsx';
import { DUE_OPTIONS, GROUP_OPTIONS, SORT_OPTIONS, countActiveFilters, parseSort, type GroupBy, type SortField } from './filters.ts';
import './projects.css';

export interface FiltersBarProps {
  filters: TaskFilters;
  onChange: (f: TaskFilters) => void;
  statuses: TaskStatus[];
  labels: Label[];
  members: WorkspaceMember[];
  groupBy: GroupBy;
  sortBy: string;
  onGroupChange: (g: GroupBy) => void;
  onSortChange: (s: string) => void;
  /** List view shows group + sort; board only sort. */
  showGrouping: boolean;
  showArchivedToggle?: boolean;
}

/** A filter trigger button + popover with a multi-select list. */
function FilterPicker<V extends string>({ label, icon, items, value, onToggle, count, active, searchable, width = 240, placeholder }: { label: string; icon?: ReactNode; items: PickerItem<V>[]; value: V[]; onToggle: (v: V) => void; count?: number; active?: boolean; searchable?: boolean; width?: number; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);
  const n = count ?? value.length;
  return (
    <>
      <Button ref={ref} size="sm" variant="outline" className={cx('filter-trigger', (active ?? n > 0) && 'is-active')} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} iconRight="chevron-down">
        {icon ? <span className="filter-trigger-icon">{icon}</span> : null}
        <span>{label}</span>
        {n > 0 ? <span className="filter-count">{n}</span> : null}
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={width} role="listbox">
        <ListPicker items={items} value={value} multi searchable={searchable ?? items.length > 6} placeholder={placeholder ?? `Filter ${label.toLowerCase()}…`} onSelect={onToggle} emptyText="Nothing to filter" />
      </Popover>
    </>
  );
}

export function FiltersBar({ filters, onChange, statuses, labels, members, groupBy, sortBy, onGroupChange, onSortChange, showGrouping, showArchivedToggle = true }: FiltersBarProps) {
  const me = useMe();
  const [search, setSearch] = useState(filters.search ?? '');
  const lastCommitted = useRef(filters.search ?? '');
  const commitSearch = useDebouncedCallback((q: string) => {
    lastCommitted.current = q;
    onChange({ ...filters, search: q.trim() || undefined });
  }, 250);
  // keep local text in sync when filters change from outside (clear all, saved view)
  useEffect(() => {
    const ext = filters.search ?? '';
    if (ext !== lastCommitted.current) {
      lastCommitted.current = ext;
      setSearch(ext);
    }
  }, [filters.search]);

  const toggleIn = <K extends 'statusIds' | 'assigneeIds' | 'labelIds'>(key: K, v: string) => {
    const cur = (filters[key] ?? []) as string[];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    onChange({ ...filters, [key]: next.length ? next : undefined });
  };
  const togglePriority = (v: string) => {
    const p = Number(v) as Priority;
    const cur = filters.priorities ?? [];
    const next = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p];
    onChange({ ...filters, priorities: next.length ? next : undefined });
  };

  const sortedStatuses = [...statuses].sort((a, b) => a.position - b.position);
  const statusItems: PickerItem[] = sortedStatuses.map((s) => ({ value: s.id, label: s.name, icon: <StatusIcon category={s.category} color={s.color} />, keywords: s.category }));
  const sortedMembers = [...members].sort((a, b) => (a.userId === me.id ? -1 : b.userId === me.id ? 1 : a.user.name.localeCompare(b.user.name)));
  const assigneeItems: PickerItem[] = [
    { value: 'me', label: 'Me', icon: <Avatar name={me.name} src={me.avatarUrl} size={18} />, section: 'Quick' },
    { value: 'unassigned', label: 'Unassigned', icon: <span className="assignee-empty"><Icon name="user" size={12} /></span>, section: 'Quick' },
    ...sortedMembers.map((m) => ({ value: m.userId, label: m.user.name, description: m.user.email, keywords: m.user.email, icon: <Avatar name={m.user.name} src={m.user.avatarUrl} size={18} />, section: 'Members' })),
  ];
  const priorityItems: PickerItem[] = PRIORITIES.map((p) => ({ value: String(p.value), label: p.label, icon: <PriorityIcon priority={p.value} /> }));
  const labelItems: PickerItem[] = labels.map((l) => ({ value: l.id, label: l.name, icon: <span className="dot" style={{ background: l.color, width: 9, height: 9 }} /> }));
  const dueItems: PickerItem[] = DUE_OPTIONS.map((d) => ({ value: d.value, label: d.label, icon: <Icon name={d.value === 'overdue' ? 'alert-circle' : d.value === 'none' ? 'circle-dashed' : 'calendar'} size={14} /> }));

  const active = countActiveFilters(filters);
  const sort = parseSort(sortBy);
  const sortItems: PickerItem<SortField>[] = SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
  const groupItems: PickerItem<GroupBy>[] = GROUP_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

  // chips
  const chips: { key: string; label: ReactNode; onRemove: () => void }[] = [];
  for (const id of filters.statusIds ?? []) {
    const s = statuses.find((x) => x.id === id);
    chips.push({ key: `s:${id}`, label: <><StatusIcon category={s?.category ?? 'todo'} color={s?.color ?? '#999'} size={12} />{s?.name ?? 'Status'}</>, onRemove: () => toggleIn('statusIds', id) });
  }
  for (const a of filters.assigneeIds ?? []) {
    const m = members.find((x) => x.userId === a);
    const label = a === 'me' ? 'Me' : a === 'unassigned' ? 'Unassigned' : (m?.user.name ?? 'Member');
    chips.push({ key: `a:${a}`, label: <><Icon name="user" size={12} />{label}</>, onRemove: () => toggleIn('assigneeIds', a) });
  }
  for (const p of filters.priorities ?? []) chips.push({ key: `p:${p}`, label: <><PriorityIcon priority={p} size={12} />{PRIORITY_LABEL[p]}</>, onRemove: () => togglePriority(String(p)) });
  for (const id of filters.labelIds ?? []) {
    const l = labels.find((x) => x.id === id);
    chips.push({ key: `l:${id}`, label: <><span className="dot" style={{ background: l?.color ?? '#999', width: 8, height: 8 }} />{l?.name ?? 'Label'}</>, onRemove: () => toggleIn('labelIds', id) });
  }
  if (filters.due) chips.push({ key: 'due', label: <><Icon name="calendar" size={12} />{DUE_OPTIONS.find((d) => d.value === filters.due)?.label}</>, onRemove: () => onChange({ ...filters, due: undefined }) });
  if (filters.search?.trim()) chips.push({ key: 'q', label: <><Icon name="search" size={12} />“{filters.search.trim()}”</>, onRemove: () => { setSearch(''); lastCommitted.current = ''; onChange({ ...filters, search: undefined }); } });

  return (
    <div className="filters-bar" role="toolbar" aria-label="Filters">
      <div className="filters-row">
        <Input size="sm" icon="search" placeholder="Search title or key…" value={search} className="filters-search" aria-label="Search tasks" onChange={(e) => { setSearch(e.target.value); commitSearch(e.target.value); }} onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); commitSearch(''); (e.target as HTMLInputElement).blur(); } }} />
        <FilterPicker label="Status" icon={<Icon name="circle-dot" size={13} />} items={statusItems} value={filters.statusIds ?? []} onToggle={(v) => toggleIn('statusIds', v)} />
        <FilterPicker label="Assignee" icon={<Icon name="user" size={13} />} items={assigneeItems} value={(filters.assigneeIds ?? []) as string[]} onToggle={(v) => toggleIn('assigneeIds', v)} width={260} searchable />
        <FilterPicker label="Priority" icon={<Icon name="flag" size={13} />} items={priorityItems} value={(filters.priorities ?? []).map(String)} onToggle={togglePriority} searchable={false} width={200} />
        <FilterPicker label="Labels" icon={<Icon name="tag" size={13} />} items={labelItems} value={filters.labelIds ?? []} onToggle={(v) => toggleIn('labelIds', v)} />
        <Select<string>
          value={filters.due ?? null}
          onChange={(v) => onChange({ ...filters, due: v === filters.due ? undefined : (v as TaskFilters['due']) })}
          items={dueItems}
          size="sm"
          variant="outline"
          className={cx('filter-trigger', filters.due && 'is-active')}
          width={200}
          icon="calendar"
          renderValue={(it) => <span>{it ? it.label : 'Due'}</span>}
        />
        <div className="filters-toggles">
          <Checkbox size={14} checked={Boolean(filters.includeSubtasks)} onChange={(v) => onChange({ ...filters, includeSubtasks: v || undefined })} label={<span className="small">Subtasks</span>} />
          {showArchivedToggle ? <Checkbox size={14} checked={Boolean(filters.includeArchived)} onChange={(v) => onChange({ ...filters, includeArchived: v || undefined })} label={<span className="small">Archived</span>} /> : null}
        </div>
        <div className="filters-spacer" />
        {showGrouping ? (
          <Select<GroupBy> value={groupBy} onChange={onGroupChange} items={groupItems} size="sm" variant="ghost" width={180} icon="layers" title="Group by" renderValue={(it) => <span className="filters-select-value"><span className="muted">Group</span> {it?.label}</span>} align="end" />
        ) : null}
        <div className="row">
          <Select<SortField> value={sort.field} onChange={(f) => onSortChange(`${f}:${SORT_OPTIONS.find((o) => o.value === f)?.defaultDir ?? 'asc'}`)} items={sortItems} size="sm" variant="ghost" width={180} icon="sort" title="Sort by" renderValue={(it) => <span className="filters-select-value"><span className="muted">Sort</span> {it?.label}</span>} align="end" />
          {sort.field !== 'position' ? (
            <Button size="sm" variant="ghost" iconOnly icon={sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'} title={sort.dir === 'asc' ? 'Ascending' : 'Descending'} aria-label="Toggle sort direction" onClick={() => onSortChange(`${sort.field}:${sort.dir === 'asc' ? 'desc' : 'asc'}`)}>
              Toggle direction
            </Button>
          ) : null}
        </div>
      </div>
      {chips.length ? (
        <div className="filters-chips">
          {chips.map((c) => (
            <span key={c.key} className="filter-chip">
              {c.label}
              <button type="button" className="filter-chip-x" onClick={c.onRemove} aria-label="Remove filter">
                <Icon name="x" size={11} strokeWidth={2.5} />
              </button>
            </span>
          ))}
          {active > 0 ? (
            <Button size="sm" variant="link" onClick={() => { setSearch(''); lastCommitted.current = ''; onChange({}); }}>
              Clear all
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
