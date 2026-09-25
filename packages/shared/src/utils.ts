import type { ISODate, Recurrence, Task, TaskFilters } from './types.ts';

/** Today's date as YYYY-MM-DD in local time. */
export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toISODate(d: Date): ISODate {
  return todayISO(d);
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

/** Compute the next occurrence date for a recurring task after `from`. */
export function nextOccurrence(rec: Recurrence, from: ISODate): ISODate {
  const interval = Math.max(1, rec.interval || 1);
  const d = parseISODate(from);
  if (rec.freq === 'daily') {
    d.setDate(d.getDate() + interval);
  } else if (rec.freq === 'weekly') {
    const days = rec.weekdays && rec.weekdays.length ? [...rec.weekdays].sort() : [d.getDay()];
    // find next weekday strictly after `from`
    for (let i = 1; i <= 7 * interval + 7; i++) {
      const cand = new Date(d);
      cand.setDate(d.getDate() + i);
      const weeksAhead = Math.floor((i + d.getDay()) / 7);
      if (days.includes(cand.getDay()) && (weeksAhead % interval === 0 || i < 7)) {
        return toISODate(cand);
      }
    }
    d.setDate(d.getDate() + 7 * interval);
  } else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + interval);
    const max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, max));
  }
  return toISODate(d);
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'workspace';
}

export function projectKeyFromName(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  let key = '';
  if (words.length >= 2) key = words.map((w) => w[0]).join('').toUpperCase().slice(0, 4);
  else key = (words[0] || 'PRJ').toUpperCase().replace(/[AEIOU]/g, (m, i) => (i === 0 ? m : '')).slice(0, 4);
  if (key.length < 2) key = (words[0] || 'PRJ').toUpperCase().slice(0, 3);
  return key.padEnd(2, 'X');
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatMinutes(min: number | null | undefined): string {
  if (!min) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Parse "1h 30m", "90m", "2h", "1.5h", "45" (minutes) into minutes. */
export function parseDuration(s: string): number | null {
  const t = s.trim().toLowerCase();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t));
  let total = 0;
  let matched = false;
  const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|d|day|days)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    matched = true;
    const n = Number(m[1]);
    const u = m[2][0];
    total += u === 'h' ? n * 60 : u === 'd' ? n * 480 : n;
  }
  return matched ? Math.round(total) : null;
}

/** Client-side filter that mirrors the server's filter semantics (used for realtime patches & saved views). */
export function taskMatchesFilters(t: Task, f: TaskFilters, meId: string | null, today: ISODate = todayISO()): boolean {
  if (!f.includeArchived && t.archivedAt) return false;
  if (f.statusIds?.length && !f.statusIds.includes(t.statusId)) return false;
  if (f.statusCategories?.length && (!t.statusCategory || !f.statusCategories.includes(t.statusCategory))) return false;
  if (f.priorities?.length && !f.priorities.includes(t.priority)) return false;
  if (f.labelIds?.length && !f.labelIds.some((l) => t.labelIds.includes(l))) return false;
  if (f.assigneeIds?.length) {
    const okAssignee = f.assigneeIds.some((a) => {
      if (a === 'me') return meId !== null && t.assigneeId === meId;
      if (a === 'unassigned') return t.assigneeId === null;
      return t.assigneeId === a;
    });
    if (!okAssignee) return false;
  }
  if (f.due && f.due !== 'any') {
    if (f.due === 'none') {
      if (t.dueDate) return false;
    } else if (!t.dueDate) return false;
    else if (f.due === 'overdue' && !(t.dueDate < today && t.statusCategory !== 'done' && t.statusCategory !== 'cancelled')) return false;
    else if (f.due === 'today' && t.dueDate !== today) return false;
    else if (f.due === 'week' && (t.dueDate < today || diffDays(today, t.dueDate) > 7)) return false;
  }
  if (f.search) {
    const q = f.search.toLowerCase();
    if (!t.title.toLowerCase().includes(q) && !t.key.toLowerCase().includes(q)) return false;
  }
  if (!f.includeSubtasks && t.parentId) return false;
  return true;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Compute a position between two neighbours (fractional indexing on floats). */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1000;
  if (before === null) return (after as number) - 1000;
  if (after === null) return before + 1000;
  return (before + after) / 2;
}
