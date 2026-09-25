import { parseISODate, todayISO, diffDays } from '../../../../packages/shared/src/utils.ts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DAYS_SHORT = DAYS;

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  const diff = Math.round((now - t) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  const date = new Date(t);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}${date.getFullYear() !== new Date(now).getFullYear() ? `, ${date.getFullYear()}` : ''}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

/** "Mar 4" or "Mar 4, 2025" for a YYYY-MM-DD string. */
export function formatDate(iso: string | null | undefined, opts: { year?: 'auto' | 'always' | 'never'; weekday?: boolean } = {}): string {
  if (!iso) return '';
  const d = parseISODate(iso);
  const showYear = opts.year === 'always' || (opts.year !== 'never' && d.getFullYear() !== new Date().getFullYear());
  return `${opts.weekday ? DAYS[d.getDay()] + ', ' : ''}${MONTHS[d.getMonth()]} ${d.getDate()}${showYear ? `, ${d.getFullYear()}` : ''}`;
}

/** Human due date label with tone: overdue / today / tomorrow / in 3d / Mar 4 */
export function dueLabel(iso: string | null | undefined, done = false): { label: string; tone: 'overdue' | 'today' | 'soon' | 'normal' | 'none' } {
  if (!iso) return { label: 'No due date', tone: 'none' };
  const today = todayISO();
  const d = diffDays(today, iso);
  if (done) return { label: formatDate(iso), tone: 'normal' };
  if (d < 0) return { label: d === -1 ? 'Yesterday' : `${-d}d overdue`, tone: 'overdue' };
  if (d === 0) return { label: 'Today', tone: 'today' };
  if (d === 1) return { label: 'Tomorrow', tone: 'soon' };
  if (d <= 6) return { label: DAYS[parseISODate(iso).getDay()], tone: 'soon' };
  return { label: formatDate(iso), tone: 'normal' };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function pluralize(n: number, word: string, plural = `${word}s`): string {
  return `${n} ${n === 1 ? word : plural}`;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS_LONG[month]} ${year}`;
}

export function shortMonthDay(iso: string): string {
  const d = parseISODate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
export const modKey = isMac ? '⌘' : 'Ctrl';
