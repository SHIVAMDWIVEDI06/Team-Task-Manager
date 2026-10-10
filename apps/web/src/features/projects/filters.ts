// Filter / sort / group logic for project views + URL (de)serialization.
import type { Label, Priority, Task, TaskFilters, TaskStatus, ViewKind, WorkspaceMember } from '../../../../../packages/shared/src/types.ts';
import { PRIORITY_LABEL } from '../../../../../packages/shared/src/constants.ts';

export type GroupBy = 'status' | 'assignee' | 'priority' | 'label' | 'none';
export type SortField = 'position' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt' | 'title' | 'status' | 'assignee' | 'estimate';
export type SortDir = 'asc' | 'desc';

export const DEFAULT_SORT = 'position:asc';
export const DEFAULT_GROUP: GroupBy = 'status';
export const VIEW_KINDS: ViewKind[] = ['board', 'list', 'calendar', 'timeline'];

export const SORT_OPTIONS: { value: SortField; label: string; defaultDir: SortDir }[] = [
  { value: 'position', label: 'Manual', defaultDir: 'asc' },
  { value: 'priority', label: 'Priority', defaultDir: 'desc' },
  { value: 'dueDate', label: 'Due date', defaultDir: 'asc' },
  { value: 'status', label: 'Status', defaultDir: 'asc' },
  { value: 'assignee', label: 'Assignee', defaultDir: 'asc' },
  { value: 'title', label: 'Title', defaultDir: 'asc' },
  { value: 'estimate', label: 'Estimate', defaultDir: 'desc' },
  { value: 'createdAt', label: 'Created', defaultDir: 'desc' },
  { value: 'updatedAt', label: 'Updated', defaultDir: 'desc' },
];

export const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'priority', label: 'Priority' },
  { value: 'label', label: 'Label' },
  { value: 'none', label: 'No grouping' },
];

export const DUE_OPTIONS: { value: NonNullable<TaskFilters['due']>; label: string }[] = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Due this week' },
  { value: 'none', label: 'No due date' },
  { value: 'any', label: 'Has due date' },
];

// ---- URL (de)serialization ----
const list = (s: string | null) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);

export function parseFilters(params: URLSearchParams): TaskFilters {
  const f: TaskFilters = {};
  const status = list(params.get('status'));
  if (status.length) f.statusIds = status;
  const assignee = list(params.get('assignee'));
  if (assignee.length) f.assigneeIds = assignee as TaskFilters['assigneeIds'];
  const pr = list(params.get('priority'))
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 4) as Priority[];
  if (pr.length) f.priorities = pr;
  const label = list(params.get('label'));
  if (label.length) f.labelIds = label;
  const due = params.get('due');
  if (due && ['overdue', 'today', 'week', 'none', 'any'].includes(due)) f.due = due as TaskFilters['due'];
  const q = params.get('q');
  if (q) f.search = q;
  if (params.get('subtasks') === '1') f.includeSubtasks = true;
  if (params.get('archived') === '1') f.includeArchived = true;
  return f;
}

/** Returns a param patch (null deletes) suitable for `setParams`. */
export function filtersToParams(f: TaskFilters): Record<string, string | null> {
  return {
    status: f.statusIds?.length ? f.statusIds.join(',') : null,
    assignee: f.assigneeIds?.length ? f.assigneeIds.join(',') : null,
    priority: f.priorities?.length ? f.priorities.join(',') : null,
    label: f.labelIds?.length ? f.labelIds.join(',') : null,
    due: f.due ?? null,
    q: f.search?.trim() ? f.search.trim() : null,
    subtasks: f.includeSubtasks ? '1' : null,
    archived: f.includeArchived ? '1' : null,
  };
}

export function countActiveFilters(f: TaskFilters): number {
  let n = 0;
  if (f.statusIds?.length) n++;
  if (f.assigneeIds?.length) n++;
  if (f.priorities?.length) n++;
  if (f.labelIds?.length) n++;
  if (f.due) n++;
  if (f.search?.trim()) n++;
  if (f.includeSubtasks) n++;
  if (f.includeArchived) n++;
  return n;
}

export function normalizeFilters(f: TaskFilters | undefined | null): TaskFilters {
  const out: TaskFilters = {};
  if (!f) return out;
  if (f.statusIds?.length) out.statusIds = [...f.statusIds].sort();
  if (f.assigneeIds?.length) out.assigneeIds = [...f.assigneeIds].sort();
  if (f.priorities?.length) out.priorities = [...f.priorities].sort();
  if (f.labelIds?.length) out.labelIds = [...f.labelIds].sort();
  if (f.due) out.due = f.due;
  if (f.search?.trim()) out.search = f.search.trim();
  if (f.includeSubtasks) out.includeSubtasks = true;
  if (f.includeArchived) out.includeArchived = true;
  return out;
}

export function filtersEqual(a: TaskFilters | undefined | null, b: TaskFilters | undefined | null): boolean {
  return JSON.stringify(normalizeFilters(a)) === JSON.stringify(normalizeFilters(b));
}

// ---- Sorting ----
export function parseSort(sortBy: string | null | undefined): { field: SortField; dir: SortDir } {
  const [rawField, rawDir] = (sortBy || DEFAULT_SORT).split(':');
  const opt = SORT_OPTIONS.find((o) => o.value === rawField);
  const field = opt ? opt.value : 'position';
  const dir: SortDir = rawDir === 'asc' || rawDir === 'desc' ? rawDir : (opt?.defaultDir ?? 'asc');
  return { field, dir };
}

export function toggleSort(current: string, field: SortField): string {
  const cur = parseSort(current);
  const opt = SORT_OPTIONS.find((o) => o.value === field)!;
  if (cur.field !== field) return `${field}:${opt.defaultDir}`;
  return `${field}:${cur.dir === 'asc' ? 'desc' : 'asc'}`;
}

export function sortTasks(tasks: Task[], sortBy: string | null | undefined, statuses: TaskStatus[], members: WorkspaceMember[] = []): Task[] {
  const { field, dir } = parseSort(sortBy);
  const statusPos = new Map(statuses.map((s, i) => [s.id, s.position ?? i]));
  const memberName = new Map(members.map((m) => [m.userId, m.user.name.toLowerCase()]));
  const mul = dir === 'asc' ? 1 : -1;
  const cmpNullable = (a: string | number | null, b: string | number | null) => {
    // nulls always last regardless of direction
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return (a < b ? -1 : a > b ? 1 : 0) * mul;
  };
  const arr = [...tasks];
  arr.sort((a, b) => {
    let r = 0;
    switch (field) {
      case 'priority':
        r = (a.priority - b.priority) * mul;
        break;
      case 'dueDate':
        r = cmpNullable(a.dueDate, b.dueDate);
        break;
      case 'createdAt':
        r = (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) * mul;
        break;
      case 'updatedAt':
        r = (a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0) * mul;
        break;
      case 'title':
        r = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) * mul;
        break;
      case 'status':
        r = ((statusPos.get(a.statusId) ?? 0) - (statusPos.get(b.statusId) ?? 0)) * mul;
        break;
      case 'assignee':
        r = cmpNullable(a.assigneeId ? (memberName.get(a.assigneeId) ?? a.assigneeId) : null, b.assigneeId ? (memberName.get(b.assigneeId) ?? b.assigneeId) : null);
        break;
      case 'estimate':
        r = cmpNullable(a.estimateMinutes, b.estimateMinutes);
        break;
      case 'position':
      default:
        r = (a.position - b.position) * mul;
    }
    if (r !== 0) return r;
    // stable tie-breakers
    if (a.position !== b.position) return a.position - b.position;
    return a.number - b.number;
  });
  return arr;
}

// ---- Grouping ----
export interface TaskGroup {
  key: string;
  label: string;
  color?: string;
  icon?: 'status' | 'priority' | 'assignee' | 'label' | 'none';
  /** Extra info for rendering the group icon. */
  status?: TaskStatus;
  priority?: Priority;
  member?: WorkspaceMember;
  labelObj?: Label;
  /** Default values for tasks created inside this group. */
  createDefaults: { statusId?: string; assigneeId?: string | null };
  tasks: Task[];
}

export interface GroupCtx {
  statuses: TaskStatus[];
  labels: Label[];
  members: WorkspaceMember[];
}

export function groupTasks(tasks: Task[], groupBy: GroupBy, ctx: GroupCtx): TaskGroup[] {
  if (groupBy === 'none') {
    return [{ key: 'all', label: 'All tasks', icon: 'none', createDefaults: {}, tasks }];
  }
  if (groupBy === 'status') {
    const ordered = [...ctx.statuses].sort((a, b) => a.position - b.position);
    const groups = ordered.map<TaskGroup>((s) => ({ key: s.id, label: s.name, color: s.color, icon: 'status', status: s, createDefaults: { statusId: s.id }, tasks: [] }));
    const byId = new Map(groups.map((g) => [g.key, g]));
    const orphan: TaskGroup = { key: '__unknown__', label: 'Unknown status', icon: 'status', createDefaults: {}, tasks: [] };
    for (const t of tasks) (byId.get(t.statusId) ?? orphan).tasks.push(t);
    if (orphan.tasks.length) groups.push(orphan);
    return groups;
  }
  if (groupBy === 'priority') {
    const groups = ([4, 3, 2, 1, 0] as Priority[]).map<TaskGroup>((p) => ({ key: String(p), label: PRIORITY_LABEL[p], icon: 'priority', priority: p, createDefaults: {}, tasks: [] }));
    const byKey = new Map(groups.map((g) => [g.key, g]));
    for (const t of tasks) byKey.get(String(t.priority))?.tasks.push(t);
    return groups.filter((g) => g.tasks.length || g.priority !== 0 ? true : false);
  }
  if (groupBy === 'assignee') {
    const sorted = [...ctx.members].sort((a, b) => a.user.name.localeCompare(b.user.name));
    const groups = sorted.map<TaskGroup>((m) => ({ key: m.userId, label: m.user.name, icon: 'assignee', member: m, createDefaults: { assigneeId: m.userId }, tasks: [] }));
    const byId = new Map(groups.map((g) => [g.key, g]));
    const unassigned: TaskGroup = { key: '__unassigned__', label: 'Unassigned', icon: 'assignee', createDefaults: { assigneeId: null }, tasks: [] };
    for (const t of tasks) {
      if (!t.assigneeId) unassigned.tasks.push(t);
      else (byId.get(t.assigneeId) ?? unassigned).tasks.push(t);
    }
    // only show members who have tasks, plus unassigned first
    return [unassigned, ...groups.filter((g) => g.tasks.length)];
  }
  // label: a task appears in every label group it belongs to
  const groups = [...ctx.labels]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map<TaskGroup>((l) => ({ key: l.id, label: l.name, color: l.color, icon: 'label', labelObj: l, createDefaults: {}, tasks: [] }));
  const byId = new Map(groups.map((g) => [g.key, g]));
  const none: TaskGroup = { key: '__nolabel__', label: 'No label', icon: 'label', createDefaults: {}, tasks: [] };
  for (const t of tasks) {
    if (!t.labelIds.length) none.tasks.push(t);
    else for (const id of t.labelIds) byId.get(id)?.tasks.push(t);
  }
  return [...groups.filter((g) => g.tasks.length), none];
}

/** Summary used for the "unsaved changes" state of saved views. */
export interface ViewState {
  kind: ViewKind;
  filters: TaskFilters;
  groupBy: GroupBy;
  sortBy: string;
}

export function viewStateEqual(a: ViewState, b: ViewState): boolean {
  return a.kind === b.kind && a.groupBy === b.groupBy && a.sortBy === b.sortBy && filtersEqual(a.filters, b.filters);
}

export function isDone(t: Pick<Task, 'statusCategory'>): boolean {
  return t.statusCategory === 'done' || t.statusCategory === 'cancelled';
}
