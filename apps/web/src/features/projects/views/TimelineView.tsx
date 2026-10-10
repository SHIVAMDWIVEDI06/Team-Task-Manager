// Timeline (Gantt) view: sticky task list grouped by status + horizontally scrollable day grid with draggable /
// resizable bars, today line, weekend shading and Day / Week / Month zoom.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { ISODate, Task, TaskStatus } from '../../../../../../packages/shared/src/types.ts';
import { addDays, diffDays, parseISODate, todayISO } from '../../../../../../packages/shared/src/utils.ts';
import type { ViewProps } from './types.ts';
import { updateTask } from '../../../app/data.ts';
import { useMe } from '../../../app/auth.tsx';
import { useLocalStorage, useMediaQuery } from '../../../lib/hooks.ts';
import { toast } from '../../../lib/toast.ts';
import { DAYS_SHORT, MONTHS_LONG, formatDate, shortMonthDay } from '../../../lib/format.ts';
import { Avatar, Button, EmptyState, PriorityIcon, Segmented, StatusIcon, cx } from '../../../ui/primitives.tsx';
import { Tooltip } from '../../../ui/overlays.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { countActiveFilters, isDone } from '../filters.ts';
import './timeline.css';

type Scale = 'day' | 'week' | 'month';
const DAY_W: Record<Scale, number> = { day: 40, week: 16, month: 6 };
const ROW_H = 36;
const MAX_AUTO_RANGE = 400; // days
const EXTEND_BY = 60; // days per "Show earlier / later" click

type DragMode = 'move' | 'start' | 'end';
interface Preview {
  id: string;
  start: ISODate;
  due: ISODate;
}

interface TlCtx {
  canEdit: boolean;
  dayW: number;
  rangeStart: ISODate;
  today: ISODate;
  openTask: ViewProps['openTask'];
  beginDrag: (e: React.PointerEvent, task: Task, mode: DragMode) => void;
  preview: Preview | null;
  suppressClick: React.MutableRefObject<boolean>;
  narrow: boolean;
}

const effectiveSpan = (t: Task): { start: ISODate; due: ISODate } | null => {
  const s = t.startDate ?? t.dueDate;
  const d = t.dueDate ?? t.startDate;
  if (!s || !d) return null;
  return s <= d ? { start: s, due: d } : { start: d, due: s };
};
const spanLabel = (start: ISODate, due: ISODate) => {
  const n = diffDays(start, due) + 1;
  return start === due ? `${shortMonthDay(start)} · 1d` : `${shortMonthDay(start)} → ${shortMonthDay(due)} · ${n}d`;
};

// ---- Bar ----
function Bar({ task, ctx }: { task: Task; ctx: TlCtx }) {
  const span = effectiveSpan(task)!;
  const pv = ctx.preview?.id === task.id ? ctx.preview : null;
  const start = pv?.start ?? span.start;
  const due = pv?.due ?? span.due;
  const left = diffDays(ctx.rangeStart, start) * ctx.dayW;
  const width = (diffDays(start, due) + 1) * ctx.dayW;
  const done = isDone(task);
  const overdue = !done && task.dueDate !== null && task.dueDate < ctx.today;
  const color = task.statusColor || 'var(--fg-faint)';
  const labelInside = width >= 96;
  const milestone = !task.startDate && Boolean(task.dueDate);
  const label = (
    <>
      {done ? <Icon name="check" size={12} strokeWidth={3} className="timeline-bar-check" /> : null}
      {task.priority >= 3 ? <PriorityIcon priority={task.priority} size={12} /> : null}
      <span className="timeline-bar-title truncate">{task.title}</span>
    </>
  );
  return (
    <>
      <div
        className={cx('timeline-bar', done && 'is-done', overdue && 'is-overdue', pv && 'is-previewing', milestone && 'is-milestone', !ctx.canEdit && 'is-readonly')}
        style={{ left, width: Math.max(ctx.dayW, width) - 2, ['--bar-color' as string]: color } as CSSProperties}
        role="button"
        tabIndex={0}
        aria-label={`${task.key} ${task.title}, ${spanLabel(start, due)}`}
        title={`${task.key} · ${task.title}\n${spanLabel(start, due)}`}
        data-task-id={task.id}
        onPointerDown={(e) => ctx.beginDrag(e, task, 'move')}
        onClick={(e) => {
          e.stopPropagation();
          if (ctx.suppressClick.current) return;
          ctx.openTask(task);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            ctx.openTask(task);
          }
        }}
      >
        {ctx.canEdit ? <span className="timeline-bar-handle is-left" onPointerDown={(e) => ctx.beginDrag(e, task, 'start')} aria-hidden /> : null}
        {labelInside ? <span className="timeline-bar-label">{label}</span> : null}
        {task.assignee && width >= 48 ? <Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size={18} className="timeline-bar-avatar" /> : null}
        {ctx.canEdit ? <span className="timeline-bar-handle is-right" onPointerDown={(e) => ctx.beginDrag(e, task, 'end')} aria-hidden /> : null}
      </div>
      {!labelInside ? (
        <span className={cx('timeline-bar-aside', done && 'is-done')} style={{ left: left + Math.max(ctx.dayW, width) + 6 }} onClick={() => ctx.openTask(task)}>
          {label}
          {task.assignee && width < 48 ? <Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size={16} /> : null}
        </span>
      ) : null}
    </>
  );
}

// ---- Row ----
function Row({ task, ctx, gridW }: { task: Task; ctx: TlCtx; gridW: number }) {
  const scheduled = Boolean(task.startDate || task.dueDate);
  const [ghost, setGhost] = useState<number | null>(null);
  const done = isDone(task);
  const dayAt = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.floor((e.clientX - rect.left) / ctx.dayW));
  };
  const schedule = (start: ISODate) => updateTask(task, { startDate: start, dueDate: addDays(start, 2) }).catch((e) => toast.fromError(e));
  return (
    <div className={cx('timeline-row', done && 'is-done', !scheduled && 'is-unscheduled')} style={{ height: ROW_H }} data-task-id={task.id} role="row">
      <div className="timeline-row-left">
        <StatusIcon category={task.statusCategory || 'todo'} color={task.statusColor || '#8b8fa3'} size={13} />
        {!ctx.narrow ? <span className="timeline-row-key mono">{task.key}</span> : null}
        <button type="button" className="timeline-row-title truncate" onClick={() => ctx.openTask(task)} title={`${task.key} · ${task.title}`}>
          {task.title}
        </button>
        {!scheduled && ctx.canEdit ? (
          <Button size="sm" variant="outline" className="timeline-schedule" onClick={() => void schedule(ctx.today)} title="Schedule: today → +2 days">
            Schedule
          </Button>
        ) : null}
      </div>
      <div
        className={cx('timeline-row-right', !scheduled && ctx.canEdit && 'is-placeable')}
        style={{ width: gridW }}
        onMouseMove={!scheduled && ctx.canEdit ? (e) => setGhost(dayAt(e)) : undefined}
        onMouseLeave={!scheduled ? () => setGhost(null) : undefined}
        onClick={!scheduled && ctx.canEdit ? (e) => void schedule(addDays(ctx.rangeStart, dayAt(e))) : undefined}
        aria-label={scheduled ? undefined : 'Click a day to schedule this task'}
      >
        {scheduled ? <Bar task={task} ctx={ctx} /> : ghost !== null ? (
          <div className="timeline-ghost" style={{ left: ghost * ctx.dayW, width: 3 * ctx.dayW - 2 }}>
            <span className="timeline-ghost-label">{shortMonthDay(addDays(ctx.rangeStart, ghost))} · 3d</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---- Timeline ----
export function TimelineView(props: ViewProps) {
  const { project, statuses, tasks, canEdit, openTask, createTask } = props;
  const me = useMe();
  const startOfWeek = me.preferences.startOfWeek ?? 1;
  const narrow = useMediaQuery('(max-width: 720px)');
  const leftW = narrow ? 160 : 260;
  const today = todayISO();
  const [scale, setScale] = useLocalStorage<Scale>(`tt.timeline.scale.${project.id}`, 'day');
  const dayW = DAY_W[scale];
  const [collapsed, setCollapsed] = useLocalStorage<string[]>(`tt.timeline.collapsed.${project.id}`, []);
  const [ext, setExt] = useState({ before: 0, after: 0 });

  // ---- Range ----
  const base = useMemo(() => {
    let min = addDays(today, -30);
    let max = addDays(today, 60);
    for (const t of tasks) {
      const s = effectiveSpan(t);
      if (!s) continue;
      const a = addDays(s.start, -14);
      const b = addDays(s.due, 30);
      if (a < min) min = a;
      if (b > max) max = b;
    }
    if (diffDays(min, max) > MAX_AUTO_RANGE) {
      const lo = addDays(today, -MAX_AUTO_RANGE / 2);
      const hi = addDays(today, MAX_AUTO_RANGE / 2);
      if (min < lo) min = lo;
      if (max > hi) max = hi;
    }
    return { min, max };
  }, [tasks, today]);
  const rangeStart = addDays(base.min, -ext.before);
  const rangeEnd = addDays(base.max, ext.after);
  const totalDays = diffDays(rangeStart, rangeEnd) + 1;
  const gridW = totalDays * dayW;
  const todayIdx = diffDays(rangeStart, today);
  const todayX = todayIdx * dayW + dayW / 2;

  // ---- Header segments ----
  const months = useMemo(() => {
    const out: { key: string; label: string; days: number }[] = [];
    let d = rangeStart;
    while (d <= rangeEnd) {
      const dt = parseISODate(d);
      const endOfMonth = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);
      const end = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;
      const segEnd = end < rangeEnd ? end : rangeEnd;
      out.push({ key: d, label: `${MONTHS_LONG[dt.getMonth()]} ${dt.getFullYear()}`, days: diffDays(d, segEnd) + 1 });
      d = addDays(segEnd, 1);
    }
    return out;
  }, [rangeStart, rangeEnd]);
  const dayCells = useMemo(() => {
    const out: { key: string; label: string; sub?: string; days: number; today: boolean; weekend: boolean }[] = [];
    if (scale === 'day') {
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(rangeStart, i);
        const dt = parseISODate(d);
        out.push({ key: d, label: String(dt.getDate()), sub: DAYS_SHORT[dt.getDay()], days: 1, today: d === today, weekend: dt.getDay() === 0 || dt.getDay() === 6 });
      }
      return out;
    }
    let d = rangeStart;
    while (d <= rangeEnd) {
      const dt = parseISODate(d);
      const toNext = (7 - ((dt.getDay() - startOfWeek + 7) % 7)) % 7 || 7; // days until next week start
      const segEnd = addDays(d, toNext - 1) < rangeEnd ? addDays(d, toNext - 1) : rangeEnd;
      const n = diffDays(d, segEnd) + 1;
      out.push({ key: d, label: n >= 4 ? (scale === 'week' ? shortMonthDay(d) : String(dt.getDate())) : '', days: n, today: d <= today && today <= segEnd, weekend: false });
      d = addDays(segEnd, 1);
    }
    return out;
  }, [scale, rangeStart, rangeEnd, totalDays, today, startOfWeek]);

  // background: weekend stripes + grid lines (crisp 1px) as gradients so the range can be long without many nodes
  const firstSat = (6 - parseISODate(rangeStart).getDay() + 7) % 7;
  const firstWeekStart = (startOfWeek - parseISODate(rangeStart).getDay() + 7) % 7;
  const lineW = scale === 'day' ? dayW : 7 * dayW;
  const bgStyle: CSSProperties = {
    backgroundImage: `repeating-linear-gradient(to right, var(--timeline-weekend) 0 ${2 * dayW}px, transparent ${2 * dayW}px ${7 * dayW}px), linear-gradient(to right, var(--border-subtle) 1px, transparent 1px)`,
    backgroundSize: `${7 * dayW}px 100%, ${lineW}px 100%`,
    backgroundPosition: `${firstSat * dayW}px 0, ${(scale === 'day' ? 0 : firstWeekStart * dayW)}px 0`,
  };

  // ---- Groups ----
  const groups = useMemo(() => {
    const ordered = [...statuses].sort((a, b) => a.position - b.position);
    const by = new Map<string, Task[]>(ordered.map((s) => [s.id, []]));
    const orphan: Task[] = [];
    for (const t of tasks) (by.get(t.statusId) ?? orphan).push(t);
    const out: { status: TaskStatus | null; key: string; label: string; tasks: Task[] }[] = ordered.map((s) => ({ status: s, key: s.id, label: s.name, tasks: by.get(s.id)! }));
    if (orphan.length) out.push({ status: null, key: '__unknown__', label: 'Other', tasks: orphan });
    return out.filter((g) => g.tasks.length);
  }, [statuses, tasks]);
  const collapsedSet = useMemo(() => new Set(collapsed), [collapsed]);
  const toggleGroup = (key: string) => setCollapsed((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const scheduledCount = tasks.filter((t) => t.startDate || t.dueDate).length;

  // ---- Scrolling ----
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollToDay = useCallback(
    (idx: number, smooth = false) => {
      const el = scrollRef.current;
      if (!el) return;
      const visible = el.clientWidth - leftW;
      const left = Math.max(0, idx * dayW + dayW / 2 - visible / 2);
      if (smooth) el.scrollTo({ left, behavior: 'smooth' });
      else el.scrollLeft = left;
    },
    [dayW, leftW],
  );
  const centeredOnce = useRef(false);
  useLayoutEffect(() => {
    if (centeredOnce.current) return;
    centeredOnce.current = true;
    scrollToDay(todayIdx);
  }, [scrollToDay, todayIdx]);
  // keep the same day centered when zooming, and keep position when extending the range on the left
  const prevScale = useRef({ dayW, rangeStart });
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const prev = prevScale.current;
    prevScale.current = { dayW, rangeStart };
    if (!el) return;
    const visible = el.clientWidth - leftW;
    if (prev.dayW !== dayW) {
      const centerDay = (el.scrollLeft + visible / 2) / prev.dayW;
      el.scrollLeft = Math.max(0, centerDay * dayW - visible / 2);
    } else if (prev.rangeStart !== rangeStart) {
      const shift = diffDays(rangeStart, prev.rangeStart);
      if (shift > 0) el.scrollLeft += shift * dayW;
    }
  }, [dayW, rangeStart, leftW]);

  // ---- Bar dragging (move / resize) ----
  const [preview, setPreview] = useState<Preview | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const suppressClick = useRef(false);
  const beginDrag = useCallback(
    (e: React.PointerEvent, task: Task, mode: DragMode) => {
      if (!canEdit) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const scrollEl = scrollRef.current;
      const span = effectiveSpan(task);
      if (!scrollEl || !span) return;
      e.preventDefault();
      e.stopPropagation();
      const gridX = (clientX: number) => clientX - scrollEl.getBoundingClientRect().left + scrollEl.scrollLeft - leftW;
      const startGX = gridX(e.clientX);
      const startClientX = e.clientX;
      const target = e.currentTarget as HTMLElement;
      const pointerId = e.pointerId;
      let moved = false;
      let cur = { start: span.start, due: span.due };
      let raf = 0;
      let lastX = e.clientX;
      let lastY = e.clientY;
      try {
        target.setPointerCapture?.(pointerId);
      } catch {
        /* ignore */
      }
      const compute = (clientX: number) => {
        const delta = Math.round((gridX(clientX) - startGX) / dayW);
        if (mode === 'move') return { start: addDays(span.start, delta), due: addDays(span.due, delta) };
        if (mode === 'start') {
          const s = addDays(span.start, delta);
          return { start: s > span.due ? span.due : s, due: span.due };
        }
        const d = addDays(span.due, delta);
        return { start: span.start, due: d < span.start ? span.start : d };
      };
      const tick = () => {
        raf = 0;
        // auto-scroll near the horizontal edges
        const r = scrollEl.getBoundingClientRect();
        if (lastX > r.right - 40) scrollEl.scrollLeft += 12;
        else if (lastX < r.left + leftW + 40) scrollEl.scrollLeft -= 12;
        const next = compute(lastX);
        if (next.start !== cur.start || next.due !== cur.due) {
          cur = next;
          setPreview({ id: task.id, ...next });
        }
        setTip({ x: lastX, y: lastY, text: spanLabel(cur.start, cur.due) });
      };
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        lastX = ev.clientX;
        lastY = ev.clientY;
        if (!moved) {
          if (Math.abs(ev.clientX - startClientX) < 3) return;
          moved = true;
          document.body.classList.add(mode === 'move' ? 'timeline-moving' : 'timeline-resizing');
          setPreview({ id: task.id, ...cur });
        }
        ev.preventDefault();
        if (!raf) raf = requestAnimationFrame(tick);
      };
      const finish = (cancelled: boolean) => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onCancel);
        document.removeEventListener('keydown', onKey);
        document.body.classList.remove('timeline-moving', 'timeline-resizing');
        if (raf) cancelAnimationFrame(raf);
        try {
          target.releasePointerCapture?.(pointerId);
        } catch {
          /* ignore */
        }
        setTip(null);
        setPreview(null);
        if (!moved) return;
        suppressClick.current = true;
        setTimeout(() => (suppressClick.current = false), 80);
        if (cancelled) return;
        const final = compute(lastX);
        if (final.start === span.start && final.due === span.due) return;
        const patch: { startDate?: string | null; dueDate?: string | null } = {};
        if (mode === 'move') {
          if (task.startDate) patch.startDate = final.start;
          if (task.dueDate) patch.dueDate = final.due;
          if (!task.startDate && !task.dueDate) return;
        } else if (mode === 'start') {
          patch.startDate = final.start;
          if (!task.dueDate) patch.dueDate = final.due;
        } else {
          patch.dueDate = final.due;
          if (!task.startDate) patch.startDate = final.start;
        }
        updateTask(task, patch).catch((err) => toast.fromError(err));
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        lastX = ev.clientX;
        finish(false);
      };
      const onCancel = () => finish(true);
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') {
          ev.stopPropagation();
          finish(true);
        }
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onCancel);
      document.addEventListener('keydown', onKey, true);
    },
    [canEdit, dayW, leftW],
  );

  // clear collapsed keys that no longer exist (statuses deleted)
  useEffect(() => {
    if (!collapsed.length) return;
    const valid = new Set(statuses.map((s) => s.id).concat('__unknown__'));
    if (collapsed.some((k) => !valid.has(k))) setCollapsed((prev) => prev.filter((k) => valid.has(k)));
  }, [statuses, collapsed, setCollapsed]);

  const ctx: TlCtx = useMemo(() => ({ canEdit, dayW, rangeStart, today, openTask, beginDrag, preview, suppressClick, narrow }), [canEdit, dayW, rangeStart, today, openTask, beginDrag, preview, narrow]);

  if (!tasks.length) {
    const filtered = countActiveFilters(props.filters) > 0;
    return (
      <div className="timeline timeline-empty">
        <EmptyState
          icon={filtered ? 'filter' : 'timeline'}
          title={filtered ? 'No matching tasks' : 'Plan work over time'}
          description={filtered ? 'No tasks match the current filters.' : 'Tasks with a start or due date show up here as bars you can drag and resize. Create one to get started.'}
          action={canEdit && !filtered ? <Button variant="primary" icon="plus" onClick={() => createTask({ startDate: today, dueDate: addDays(today, 2) })}>New task</Button> : undefined}
        />
      </div>
    );
  }

  return (
    <div className={cx('timeline', `timeline-scale-${scale}`, narrow && 'is-narrow', !canEdit && 'is-readonly')} style={{ ['--timeline-left' as string]: `${leftW}px`, ['--timeline-day-w' as string]: `${dayW}px` } as CSSProperties}>
      <div className="timeline-toolbar">
        <Tooltip content="Scroll to today">
          <Button size="sm" variant="outline" icon="target" onClick={() => scrollToDay(todayIdx, true)}>
            Today
          </Button>
        </Tooltip>
        <Segmented size="sm" value={scale} onChange={setScale} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} className="timeline-scale" />
        <span className="grow" />
        {!narrow ? (
          <span className="xs muted tabular timeline-summary">
            {scheduledCount} scheduled · {tasks.length - scheduledCount} unscheduled
          </span>
        ) : null}
        <Tooltip content={`Show ${EXTEND_BY} earlier days`}>
          <Button size="sm" variant="ghost" icon="chevrons-left" iconOnly onClick={() => setExt((x) => ({ ...x, before: x.before + EXTEND_BY }))} aria-label="Show earlier">Show earlier</Button>
        </Tooltip>
        <Tooltip content={`Show ${EXTEND_BY} later days`}>
          <Button size="sm" variant="ghost" icon="chevrons-right" iconOnly onClick={() => setExt((x) => ({ ...x, after: x.after + EXTEND_BY }))} aria-label="Show later">Show later</Button>
        </Tooltip>
      </div>

      <div ref={scrollRef} className="timeline-scroll" role="grid" aria-label="Timeline" aria-rowcount={tasks.length}>
        <div className="timeline-inner" style={{ width: leftW + gridW }}>
          <div className="timeline-head" role="row">
            <div className="timeline-head-left">
              <span className="xs muted">Task</span>
              <span className="xs muted tabular">{tasks.length}</span>
            </div>
            <div className="timeline-head-right" style={{ width: gridW }}>
              <div className="timeline-months">
                {months.map((m) => (
                  <div key={m.key} className="timeline-month" style={{ width: m.days * dayW }}>
                    <span className="timeline-month-label">{m.label}</span>
                  </div>
                ))}
              </div>
              <div className="timeline-days" style={bgStyle}>
                {dayCells.map((c) => (
                  <div key={c.key} className={cx('timeline-day', c.today && 'is-today', c.weekend && 'is-weekend')} style={{ width: c.days * dayW }} title={scale === 'day' ? formatDate(c.key, { weekday: true }) : `Week of ${formatDate(c.key)}`}>
                    {c.sub ? <span className="timeline-day-sub">{c.sub[0]}</span> : null}
                    {c.label ? <span className="timeline-day-num">{c.label}</span> : null}
                  </div>
                ))}
              </div>
              <div className="timeline-today-marker" style={{ left: todayX }} aria-hidden>
                <span>Today</span>
              </div>
            </div>
          </div>

          <div className="timeline-rows">
            <div className="timeline-bg" style={{ left: leftW, width: gridW, ...bgStyle }} aria-hidden />
            <div className="timeline-today-line" style={{ left: leftW + todayX }} aria-hidden />
            {groups.map((g) => {
              const isCollapsed = collapsedSet.has(g.key);
              return (
                <div key={g.key} className="timeline-group-wrap">
                  <div className="timeline-group" role="row">
                    <button type="button" className="timeline-group-left" onClick={() => toggleGroup(g.key)} aria-expanded={!isCollapsed} aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${g.label}`}>
                      <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={13} className="timeline-group-chev" />
                      {g.status ? <StatusIcon category={g.status.category} color={g.status.color} size={14} /> : <Icon name="circle" size={14} className="muted" />}
                      <span className="timeline-group-name truncate">{g.label}</span>
                      <span className="timeline-group-count tabular">{g.tasks.length}</span>
                    </button>
                    <div className="timeline-group-right" style={{ width: gridW }}>
                      {isCollapsed ? <GroupSummary tasks={g.tasks} ctx={ctx} /> : null}
                    </div>
                  </div>
                  {!isCollapsed ? g.tasks.map((t) => <Row key={t.id} task={t} ctx={ctx} gridW={gridW} />) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {tip
        ? createPortal(
            <div className="timeline-tip" style={{ left: tip.x + 14, top: tip.y + 16 }} role="status">
              {tip.text}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Thin summary bar for a collapsed group: spans from the earliest start to the latest due date. */
function GroupSummary({ tasks, ctx }: { tasks: Task[]; ctx: TlCtx }) {
  let min: ISODate | null = null;
  let max: ISODate | null = null;
  for (const t of tasks) {
    const s = effectiveSpan(t);
    if (!s) continue;
    if (!min || s.start < min) min = s.start;
    if (!max || s.due > max) max = s.due;
  }
  if (!min || !max) return null;
  const left = diffDays(ctx.rangeStart, min) * ctx.dayW;
  const width = (diffDays(min, max) + 1) * ctx.dayW;
  return <div className="timeline-group-summary" style={{ left, width }} title={spanLabel(min, max)} />;
}
