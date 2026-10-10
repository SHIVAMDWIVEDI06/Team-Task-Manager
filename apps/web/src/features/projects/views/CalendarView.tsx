// Calendar view: month grid / week columns, tasks placed by due date (multi-day spanning bars), drag to reschedule,
// "+N more" popovers, a collapsible "No due date" tray and a stacked agenda on narrow screens.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { ISODate, Task } from '../../../../../../packages/shared/src/types.ts';
import { addDays, diffDays, parseISODate, toISODate, todayISO } from '../../../../../../packages/shared/src/utils.ts';
import type { ViewProps } from './types.ts';
import { DndProvider, useDraggable, useDroppable, useDragState, type DropResult } from '../../../lib/dnd.tsx';
import { updateTask } from '../../../app/data.ts';
import { useMe } from '../../../app/auth.tsx';
import { useSearchParams } from '../../../lib/router.tsx';
import { useLocalStorage, useMediaQuery } from '../../../lib/hooks.ts';
import { toast } from '../../../lib/toast.ts';
import { DAYS_SHORT, MONTHS_LONG, formatDate, shortMonthDay } from '../../../lib/format.ts';
import { Avatar, Button, PriorityIcon, Segmented, StatusIcon, cx } from '../../../ui/primitives.tsx';
import { Popover, Tooltip } from '../../../ui/overlays.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { TaskKey } from '../../tasks/fields.tsx';
import { isDone } from '../filters.ts';
import './calendar.css';

type Mode = 'month' | 'week';
const LANE_H = 24; // chip lane height (px) — keep in sync with calendar.css
const DAY_HEAD_H = 26; // day-number header inside a cell (px)
const MIN_ROW_H = 96; // week rows never get shorter than this; the grid scrolls instead — keep in sync with --cal-row-min

interface Seg {
  task: Task;
  c0: number; // first column in this week (0..6)
  c1: number; // last column
  isStart: boolean; // segment begins at the task's real start
  isEnd: boolean; // segment ends at the task's real due date
  multi: boolean;
  lane: number;
}

interface CalCtx {
  canEdit: boolean;
  openTask: ViewProps['openTask'];
  dragging: boolean;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const isWeekend = (iso: ISODate) => {
  const d = parseISODate(iso).getDay();
  return d === 0 || d === 6;
};
function weekStartOf(iso: ISODate, startOfWeek: 0 | 1): ISODate {
  const off = (parseISODate(iso).getDay() - startOfWeek + 7) % 7;
  return addDays(iso, -off);
}
/** Effective [start, due] of a task on the calendar (tasks without a due date are never placed). */
function spanOf(t: Task): { start: ISODate; due: ISODate } | null {
  if (!t.dueDate) return null;
  const start = t.startDate && t.startDate < t.dueDate ? t.startDate : t.dueDate;
  return { start, due: t.dueDate };
}

/** Lay out the tasks intersecting a week row into lanes (Google-Calendar style). */
function layoutWeek(week: ISODate[], tasks: Task[]): Seg[] {
  const w0 = week[0];
  const w6 = week[6];
  const segs: Seg[] = [];
  for (const t of tasks) {
    const span = spanOf(t);
    if (!span) continue;
    if (span.due < w0 || span.start > w6) continue;
    const s = span.start < w0 ? w0 : span.start;
    const e = span.due > w6 ? w6 : span.due;
    segs.push({ task: t, c0: diffDays(w0, s), c1: diffDays(w0, e), isStart: span.start >= w0, isEnd: span.due <= w6, multi: span.start !== span.due, lane: 0 });
  }
  segs.sort((a, b) => a.c0 - b.c0 || b.c1 - b.c0 - (a.c1 - a.c0) || a.task.position - b.task.position || a.task.number - b.task.number);
  const lanes: { c0: number; c1: number }[][] = [];
  for (const s of segs) {
    let l = 0;
    while (lanes[l] && lanes[l].some((o) => !(s.c1 < o.c0 || s.c0 > o.c1))) l++;
    (lanes[l] ??= []).push({ c0: s.c0, c1: s.c1 });
    s.lane = l;
  }
  return segs;
}

// ---- Chip (single-day or a segment of a multi-day bar) ----
function Chip({ task, seg, weekStart, ctx, style, overlay, plain }: { task: Task; seg?: Seg; weekStart?: ISODate; ctx: CalCtx; style?: CSSProperties; overlay?: boolean; plain?: boolean }) {
  const dataRef = useRef<{ task: Task; grabDate: string | null }>({ task, grabDate: task.dueDate });
  dataRef.current.task = task;
  const drag = useDraggable(task.id, dataRef.current, !ctx.canEdit || Boolean(overlay) || Boolean(plain));
  const done = isDone(task);
  const color = task.statusColor || 'var(--fg-faint)';
  const attrs = overlay || plain ? {} : drag.attributes;
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // remember which day of a multi-day bar was grabbed so the whole bar shifts by the right delta on drop
    let grab: string | null = task.dueDate;
    if (seg && weekStart && seg.multi) {
      const rect = e.currentTarget.getBoundingClientRect();
      const span = seg.c1 - seg.c0 + 1;
      const idx = Math.min(span - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / Math.max(1, rect.width)) * span)));
      grab = addDays(weekStart, seg.c0 + idx);
    }
    dataRef.current.grabDate = grab;
    (attrs.onPointerDown as ((ev: React.PointerEvent) => void) | undefined)?.(e);
  };
  const setRef = (el: HTMLDivElement | null) => {
    drag.ref.current = el;
  };
  return (
    <div
      ref={setRef}
      {...attrs}
      onPointerDown={onPointerDown}
      style={{ ...style, ...((attrs.style as CSSProperties | undefined) ?? {}), ['--chip-color' as string]: color }}
      className={cx('calendar-chip', done && 'is-done', seg?.multi && 'is-multi', (!seg || seg.isStart) && 'is-start', (!seg || seg.isEnd) && 'is-end', drag.isDragging && !overlay && 'is-dragging', overlay && 'is-overlay', plain && 'is-plain', !ctx.canEdit && 'is-readonly')}
      role="button"
      tabIndex={overlay ? -1 : 0}
      aria-label={`${task.key} ${task.title}`}
      title={`${task.key} · ${task.title}${task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ''}`}
      data-task-id={task.id}
      onClick={(e) => {
        if (overlay) return;
        e.stopPropagation();
        ctx.openTask(task);
      }}
      onKeyDown={(e) => {
        if (overlay) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          ctx.openTask(task);
        }
      }}
    >
      {plain ? <StatusIcon category={task.statusCategory || 'todo'} color={task.statusColor || '#8b8fa3'} size={13} /> : seg?.multi && !seg.isStart ? <Icon name="chevron-left" size={11} className="calendar-chip-cont" /> : <span className="calendar-chip-dot" aria-hidden />}
      {task.priority >= 3 ? <PriorityIcon priority={task.priority} size={12} /> : null}
      <span className="calendar-chip-title truncate">{task.title}</span>
      {plain && task.startDate && task.dueDate && task.startDate < task.dueDate ? <span className="calendar-chip-range xs muted tabular">{shortMonthDay(task.startDate)} → {shortMonthDay(task.dueDate)}</span> : null}
      {plain ? <TaskKey task={task} className="xs" /> : null}
      {task.assignee && (!seg || seg.isEnd) ? <Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size={16} className="calendar-chip-avatar" /> : null}
      {seg?.multi && !seg.isEnd ? <Icon name="chevron-right" size={11} className="calendar-chip-cont" /> : null}
    </div>
  );
}

// ---- Day cell (droppable) ----
function DayCell({ date, col, mode, inMonth, today, ctx, hidden, onMore, onCreate }: { date: ISODate; col: number; mode: Mode; inMonth: boolean; today: boolean; ctx: CalCtx; hidden: number; onMore: (date: ISODate, rect: DOMRect) => void; onCreate: (date: ISODate) => void }) {
  const drop = useDroppable(`day:${date}`, { date });
  const d = parseISODate(date);
  const num = d.getDate();
  const label = mode === 'week' ? String(num) : num === 1 ? shortMonthDay(date) : String(num);
  return (
    <div
      ref={drop.ref as React.RefObject<HTMLDivElement>}
      {...drop.attributes}
      className={cx('calendar-day', !inMonth && 'is-outside', today && 'is-today', isWeekend(date) && 'is-weekend', drop.isOver && ctx.dragging && 'is-over')}
      style={{ gridColumn: col + 1 }}
      data-date={date}
      role="gridcell"
      aria-label={formatDate(date, { weekday: true, year: 'always' })}
    >
      <div className="calendar-day-head">
        {mode === 'week' ? <span className="calendar-day-dow">{DAYS_SHORT[d.getDay()]}</span> : null}
        <span className={cx('calendar-day-num', today && 'is-today')}>{label}</span>
        {ctx.canEdit ? (
          <button type="button" className="calendar-day-add" aria-label={`New task due ${formatDate(date)}`} title="New task" onClick={(e) => { e.stopPropagation(); onCreate(date); }}>
            <Icon name="plus" size={13} />
          </button>
        ) : null}
      </div>
      {hidden > 0 ? (
        <button type="button" className="calendar-more" onClick={(e) => { e.stopPropagation(); onMore(date, e.currentTarget.getBoundingClientRect()); }} aria-label={`${hidden} more tasks on ${formatDate(date)}`}>
          +{hidden} more
        </button>
      ) : null}
    </div>
  );
}

// ---- Week row: 7 droppable cells + an events layer with lanes ----
function WeekRow({ week, tasks, mode, month, maxLanes, ctx, onMore, onCreate }: { week: ISODate[]; tasks: Task[]; mode: Mode; month: number; maxLanes: number; ctx: CalCtx; onMore: (date: ISODate, rect: DOMRect) => void; onCreate: (date: ISODate) => void }) {
  const today = todayISO();
  const segs = useMemo(() => layoutWeek(week, tasks), [week, tasks]);
  // when the row overflows, give up one lane so the "+N more" button fits inside the cell
  const lanes = segs.some((s) => s.lane >= maxLanes) ? Math.max(1, maxLanes - 1) : maxLanes;
  const hiddenByCol = useMemo(() => {
    const out = [0, 0, 0, 0, 0, 0, 0];
    for (const s of segs) if (s.lane >= lanes) for (let c = s.c0; c <= s.c1; c++) out[c]++;
    return out;
  }, [segs, lanes]);
  return (
    <div className={cx('calendar-week', mode === 'week' && 'is-weekmode')} style={{ ['--lanes' as string]: lanes }} role="row">
      {week.map((d, i) => (
        <DayCell key={d} date={d} col={i} mode={mode} inMonth={mode === 'week' || parseISODate(d).getMonth() === month} today={d === today} ctx={ctx} hidden={hiddenByCol[i]} onMore={onMore} onCreate={onCreate} />
      ))}
      <div className="calendar-events" style={{ gridTemplateRows: `repeat(${lanes}, ${LANE_H}px)` }}>
        {segs
          .filter((s) => s.lane < lanes)
          .map((s) => (
            <Chip key={s.task.id} task={s.task} seg={s} weekStart={week[0]} ctx={ctx} style={{ gridColumn: `${s.c0 + 1} / ${s.c1 + 2}`, gridRow: s.lane + 1 }} />
          ))}
      </div>
    </div>
  );
}

// ---- Agenda (narrow screens) ----
function Agenda({ days, tasks, ctx, onCreate }: { days: ISODate[]; tasks: Task[]; ctx: CalCtx; onCreate: (date: ISODate) => void }) {
  const today = todayISO();
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      const d = t.dueDate;
      if (!d || d < days[0] || d > days[days.length - 1]) continue;
      (m.get(d) ?? m.set(d, []).get(d)!).push(t);
    }
    return m;
  }, [tasks, days]);
  const withTasks = days.filter((d) => byDay.has(d));
  if (!withTasks.length) {
    return (
      <div className="calendar-agenda-empty">
        <Icon name="calendar" size={22} strokeWidth={1.5} />
        <span>Nothing scheduled in this range.</span>
        {ctx.canEdit ? <Button size="sm" variant="secondary" icon="plus" onClick={() => onCreate(today)}>Add a task for today</Button> : null}
      </div>
    );
  }
  return (
    <div className="calendar-agenda">
      {withTasks.map((d) => (
        <section key={d} className={cx('calendar-agenda-day', d === today && 'is-today')}>
          <header className="calendar-agenda-head">
            <span className="calendar-agenda-date">{formatDate(d, { weekday: true })}</span>
            {d === today ? <span className="calendar-agenda-today">Today</span> : null}
            <span className="grow" />
            {ctx.canEdit ? <Button size="sm" variant="ghost" icon="plus" iconOnly aria-label={`New task due ${formatDate(d)}`} onClick={() => onCreate(d)}>New task</Button> : null}
          </header>
          <div className="calendar-agenda-list">
            {byDay.get(d)!.map((t) => (
              <Chip key={t.id} task={t} ctx={ctx} plain />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---- Calendar ----
export function CalendarView(props: ViewProps) {
  const { project, tasks, canEdit, openTask, createTask } = props;
  const me = useMe();
  const startOfWeek = me.preferences.startOfWeek ?? 1;
  const [params, setParams] = useSearchParams();
  const narrow = useMediaQuery('(max-width: 720px)');
  const today = todayISO();

  // ---- URL state: date=YYYY-MM (month) or date=YYYY-MM-DD (week containing that day) ----
  const dateParam = params.get('date');
  const { mode, year, month, anchor } = useMemo(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && !Number.isNaN(parseISODate(dateParam).getTime())) {
      const d = parseISODate(dateParam);
      return { mode: 'week' as Mode, year: d.getFullYear(), month: d.getMonth(), anchor: dateParam };
    }
    if (dateParam && /^\d{4}-\d{2}$/.test(dateParam)) {
      const [y, m] = dateParam.split('-').map(Number);
      if (m >= 1 && m <= 12) return { mode: 'month' as Mode, year: y, month: m - 1, anchor: `${dateParam}-01` };
    }
    const d = parseISODate(today);
    return { mode: 'month' as Mode, year: d.getFullYear(), month: d.getMonth(), anchor: today };
  }, [dateParam, today]);

  const setDate = useCallback((v: string | null) => setParams({ date: v }, { replace: true }), [setParams]);
  const goMonth = useCallback((y: number, m: number) => setDate(`${y}-${pad2(m + 1)}`), [setDate]);
  const prev = useCallback(() => {
    if (mode === 'week') setDate(addDays(anchor, -7));
    else goMonth(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);
  }, [mode, anchor, month, year, setDate, goMonth]);
  const next = useCallback(() => {
    if (mode === 'week') setDate(addDays(anchor, 7));
    else goMonth(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1);
  }, [mode, anchor, month, year, setDate, goMonth]);
  const goToday = useCallback(() => setDate(mode === 'week' ? today : null), [mode, today, setDate]);
  const setMode = useCallback(
    (m: Mode) => {
      if (m === mode) return;
      if (m === 'week') {
        const t = parseISODate(today);
        setDate(t.getFullYear() === year && t.getMonth() === month ? today : `${year}-${pad2(month + 1)}-01`);
      } else {
        const d = parseISODate(anchor);
        const t = parseISODate(today);
        setDate(d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() ? null : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
      }
    },
    [mode, today, year, month, anchor, setDate],
  );

  // ---- Grid days ----
  const days = useMemo(() => {
    if (mode === 'week') {
      const s = weekStartOf(anchor, startOfWeek);
      return Array.from({ length: 7 }, (_, i) => addDays(s, i));
    }
    const first = toISODate(new Date(year, month, 1));
    const s = weekStartOf(first, startOfWeek);
    const dim = new Date(year, month + 1, 0).getDate();
    const rows = Math.ceil((diffDays(s, first) + dim) / 7);
    return Array.from({ length: rows * 7 }, (_, i) => addDays(s, i));
  }, [mode, anchor, year, month, startOfWeek]);
  const weeks = useMemo(() => {
    const out: ISODate[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days]);
  const dowNames = useMemo(() => [...DAYS_SHORT.slice(startOfWeek), ...DAYS_SHORT.slice(0, startOfWeek)], [startOfWeek]);

  const title = useMemo(() => {
    if (mode === 'month') return `${MONTHS_LONG[month]} ${year}`;
    const a = parseISODate(days[0]);
    const b = parseISODate(days[6]);
    const sameMonth = a.getMonth() === b.getMonth();
    return `${shortMonthDay(days[0])} – ${sameMonth ? b.getDate() : shortMonthDay(days[6])}, ${b.getFullYear()}`;
  }, [mode, month, year, days]);

  // ---- Tasks ----
  const dated = useMemo(() => tasks.filter((t) => t.dueDate), [tasks]);
  const undated = useMemo(() => tasks.filter((t) => !t.dueDate), [tasks]);
  const [trayOpen, setTrayOpen] = useLocalStorage<boolean>(`tt.calendar.tray.${project.id}`, false);

  // ---- Visible lanes per week row (measured) ----
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridH, setGridH] = useState(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setGridH(entries[0]?.contentRect.height ?? 0));
    ro.observe(el);
    setGridH(el.clientHeight);
    return () => ro.disconnect();
  }, [narrow, mode]);
  const maxLanes = useMemo(() => {
    if (!gridH) return 3;
    const rowH = Math.max(MIN_ROW_H, gridH / weeks.length);
    return Math.min(60, Math.max(1, Math.floor((rowH - DAY_HEAD_H - 4) / LANE_H)));
  }, [gridH, weeks.length]);

  // ---- "+N more" popover ----
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [more, setMore] = useState<{ date: ISODate; rect: DOMRect } | null>(null);
  const moreTasks = useMemo(() => {
    if (!more) return [];
    return dated.filter((t) => {
      const s = spanOf(t)!;
      return s.start <= more.date && more.date <= s.due;
    });
  }, [more, dated]);

  // ---- Drag & drop ----
  const dragState = useDragState();
  const dragging = Boolean(dragState.activeId);
  const onDragEnd = useCallback((r: DropResult) => {
    if (!r.over) return;
    const task = r.activeData.task as Task | undefined;
    const date = r.over.data.date as ISODate | undefined;
    if (!task || !date) return;
    let patch: { dueDate: string; startDate?: string | null };
    if (!task.dueDate) {
      patch = { dueDate: date };
      if (task.startDate && task.startDate > date) patch.startDate = date;
    } else {
      const grab = (r.activeData.grabDate as string | null) || task.dueDate;
      const delta = diffDays(grab, date);
      if (!delta) return;
      patch = { dueDate: addDays(task.dueDate, delta) };
      if (task.startDate) patch.startDate = addDays(task.startDate, delta);
    }
    updateTask(task, patch).catch((e) => toast.fromError(e));
  }, []);

  const ctx: CalCtx = useMemo(() => ({ canEdit, openTask, dragging }), [canEdit, openTask, dragging]);
  const onCreate = useCallback((date: ISODate) => createTask({ dueDate: date }), [createTask]);
  const onMore = useCallback((date: ISODate, rect: DOMRect) => setMore({ date, rect }), []);

  // ---- Keyboard: ← → change period, t = today (when the calendar has focus) ----
  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 't' || e.key === 'T') { e.preventDefault(); goToday(); }
  };

  const isCurrent = mode === 'month' ? parseISODate(today).getFullYear() === year && parseISODate(today).getMonth() === month : days.includes(today);

  return (
    <DndProvider onDragEnd={onDragEnd} renderOverlay={(s) => (s.activeData.task ? <Chip task={s.activeData.task as Task} ctx={ctx} overlay style={{ width: '100%', height: '100%' }} /> : null)}>
      <div ref={rootRef} className={cx('calendar', `is-mode-${mode}`, narrow && 'is-narrow', !canEdit && 'is-readonly', dragging && 'is-dragging')} tabIndex={0} onKeyDown={onKeyDown} aria-label="Calendar">
        <header className="calendar-head">
          <div className="calendar-nav">
            <Tooltip content={mode === 'week' ? 'Previous week' : 'Previous month'} shortcut="←">
              <Button size="sm" variant="ghost" icon="chevron-left" iconOnly onClick={prev} aria-label={mode === 'week' ? 'Previous week' : 'Previous month'}>Previous</Button>
            </Tooltip>
            <Tooltip content={mode === 'week' ? 'Next week' : 'Next month'} shortcut="→">
              <Button size="sm" variant="ghost" icon="chevron-right" iconOnly onClick={next} aria-label={mode === 'week' ? 'Next week' : 'Next month'}>Next</Button>
            </Tooltip>
            <Tooltip content="Jump to today" shortcut="T">
              <Button size="sm" variant={isCurrent ? 'ghost' : 'outline'} onClick={goToday} className="calendar-today-btn">Today</Button>
            </Tooltip>
            <h2 className="calendar-title">{title}</h2>
          </div>
          <div className="calendar-head-right">
            {undated.length ? (
              <button type="button" className={cx('calendar-tray-toggle', trayOpen && 'is-open')} onClick={() => setTrayOpen((o) => !o)} aria-expanded={trayOpen} aria-controls="calendar-tray">
                <Icon name="inbox" size={14} />
                <span>No due date</span>
                <span className="calendar-tray-count tabular">{undated.length}</span>
                <Icon name={trayOpen ? 'chevron-down' : 'chevron-up'} size={13} />
              </button>
            ) : null}
            {!narrow ? <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }]} className="calendar-mode" /> : null}
          </div>
        </header>

        {narrow ? (
          <div className="calendar-body">
            <Agenda days={days} tasks={dated} ctx={ctx} onCreate={onCreate} />
          </div>
        ) : (
          <div className="calendar-body">
            <div className="calendar-dow" role="row">
              {dowNames.map((d) => (
                <div key={d} className="calendar-dow-cell" role="columnheader">{d}</div>
              ))}
            </div>
            <div ref={gridRef} className="calendar-grid" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(var(--cal-row-min), 1fr))` }} role="grid" aria-label={title}>
              {weeks.map((w) => (
                <WeekRow key={w[0]} week={w} tasks={dated} mode={mode} month={month} maxLanes={maxLanes} ctx={ctx} onMore={onMore} onCreate={onCreate} />
              ))}
              {!dated.length ? (
                <div className="calendar-hint" aria-live="polite">
                  <Icon name="calendar" size={20} strokeWidth={1.5} />
                  <span>{canEdit ? 'Drag tasks here or set due dates to plan your month' : 'No tasks with due dates yet'}</span>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {undated.length && trayOpen ? (
          <div id="calendar-tray" className="calendar-tray">
            <div className="calendar-tray-head">
              <span className="calendar-tray-title">No due date</span>
              <span className="xs muted">{canEdit && !narrow ? 'Drag onto a day to schedule' : `${undated.length} task${undated.length === 1 ? '' : 's'}`}</span>
            </div>
            <div className="calendar-tray-list">
              {undated.map((t) => (
                <Chip key={t.id} task={t} ctx={ctx} plain={narrow} />
              ))}
            </div>
          </div>
        ) : null}

        <Popover open={Boolean(more)} onClose={() => setMore(null)} anchorRef={rootRef} anchorRect={more?.rect} width={300} placement="bottom" align="start" className="calendar-more-popover">
          {more ? (
            <div className="calendar-more-panel">
              <div className="calendar-more-head">
                <span className="calendar-more-date">{formatDate(more.date, { weekday: true })}</span>
                <span className="xs muted tabular">{moreTasks.length} tasks</span>
              </div>
              <div className="calendar-more-list">
                {moreTasks.map((t) => (
                  <Chip key={t.id} task={t} ctx={ctx} plain />
                ))}
              </div>
              {canEdit ? (
                <div className="calendar-more-foot">
                  <Button size="sm" variant="ghost" icon="plus" onClick={() => { setMore(null); onCreate(more.date); }}>New task on this day</Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </Popover>
      </div>
    </DndProvider>
  );
}
