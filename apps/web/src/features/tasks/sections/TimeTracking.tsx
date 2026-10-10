// Time tracking: spent vs estimate, entries, inline "log time" form and a simple start/stop timer (localStorage).
import { useEffect, useRef, useState } from 'react';
import type { TimeEntry } from '../../../../../../packages/shared/src/types.ts';
import { formatMinutes, parseDuration, todayISO } from '../../../../../../packages/shared/src/utils.ts';
import { keys, taskApi, useTimeEntries } from '../../../app/data.ts';
import { invalidate, setQueryData } from '../../../lib/query.ts';
import { toast } from '../../../lib/toast.ts';
import { useTick } from '../../../lib/hooks.ts';
import { formatDate } from '../../../lib/format.ts';
import { Avatar, Button, Input, Progress, Skeleton, cx } from '../../../ui/primitives.tsx';
import { Tooltip, useConfirm } from '../../../ui/overlays.tsx';
import { DatePicker } from '../../../ui/pickers.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { Section, useTaskCtx } from './Section.tsx';

const timerKey = (taskId: string) => `tt.timer.${taskId}`;
function readTimer(taskId: string): number | null {
  try {
    const v = localStorage.getItem(timerKey(taskId));
    return v ? Number(v) || null : null;
  } catch {
    return null;
  }
}
function writeTimer(taskId: string, start: number | null) {
  try {
    if (start === null) localStorage.removeItem(timerKey(taskId));
    else localStorage.setItem(timerKey(taskId), String(start));
  } catch {
    /* ignore */
  }
}
function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`;
}

export function TimeTracking({ formOpen, setFormOpen }: { formOpen: boolean; setFormOpen: (v: boolean) => void }) {
  const { task, canEdit, canManage, meId } = useTaskCtx();
  const confirm = useConfirm();
  const entries = useTimeEntries(task.id);
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState<string | null>(todayISO());
  const [busy, setBusy] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(() => readTimer(task.id));
  const durationRef = useRef<HTMLInputElement | null>(null);
  useTick(timerStart ? 1000 : 60_000);

  useEffect(() => {
    if (formOpen) setTimeout(() => durationRef.current?.focus(), 0);
  }, [formOpen]);

  const list = entries.data ?? [];
  const spent = task.timeSpentMinutes;
  const est = task.estimateMinutes;
  const over = Boolean(est && spent > est);
  if (!list.length && !canEdit && !spent) return null;

  const parsed = parseDuration(duration);
  const submit = async () => {
    if (!parsed || parsed < 1 || busy) return;
    setBusy(true);
    try {
      const entry = await taskApi.logTime(task.id, { minutes: parsed, note: note.trim(), date: date ?? undefined });
      setQueryData<TimeEntry[]>(keys.time(task.id), (p) => (p ? [entry, ...p.filter((e) => e.id !== entry.id)] : p));
      invalidate([keys.time(task.id), keys.task(task.id)]);
      toast.success(`Logged ${formatMinutes(parsed)}`);
      setDuration('');
      setNote('');
      setDate(todayISO());
      setFormOpen(false);
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (e: TimeEntry) => {
    if (!(await confirm({ title: 'Delete time entry?', description: `${formatMinutes(e.minutes)} logged on ${formatDate(e.date)} will be removed.`, danger: true, confirmLabel: 'Delete' }))) return;
    setQueryData<TimeEntry[]>(keys.time(task.id), (p) => (p ? p.filter((x) => x.id !== e.id) : p));
    try {
      await taskApi.deleteTime(e.id);
      invalidate(keys.task(task.id));
    } catch (err) {
      toast.fromError(err);
      invalidate(keys.time(task.id));
    }
  };
  const startTimer = () => {
    const s = Date.now();
    writeTimer(task.id, s);
    setTimerStart(s);
  };
  const stopTimer = () => {
    if (!timerStart) return;
    const minutes = Math.max(1, Math.round((Date.now() - timerStart) / 60_000));
    writeTimer(task.id, null);
    setTimerStart(null);
    setDuration(formatMinutes(minutes));
    setDate(todayISO());
    setFormOpen(true);
  };

  return (
    <Section
      id={`time-${task.id}`}
      icon="timer"
      title="Time tracking"
      count={spent ? formatMinutes(spent) : undefined}
      actions={
        canEdit ? (
          <span className="row gap-1">
            {timerStart ? (
              <Button size="sm" variant="outline" icon="pause" onClick={stopTimer} className="task-timer is-running" aria-label="Stop timer">
                <span className="tabular">{clock(Date.now() - timerStart)}</span>
              </Button>
            ) : (
              <Tooltip content="Start a timer for this task"><Button size="sm" variant="ghost" icon="play" iconOnly onClick={startTimer} aria-label="Start timer">Start timer</Button></Tooltip>
            )}
            {!formOpen ? <Button size="sm" variant="ghost" icon="plus" onClick={() => setFormOpen(true)}>Log time</Button> : null}
          </span>
        ) : null
      }
    >
      {est || spent ? (
        <div className="task-time-summary">
          <Progress value={spent} max={est || spent || 1} height={5} color={over ? 'var(--warning)' : spent && est && spent >= est ? 'var(--success)' : undefined} title={est ? `${formatMinutes(spent)} of ${formatMinutes(est)} estimated` : formatMinutes(spent)} />
          <div className="row between xs muted mt-1">
            <span className={cx('tabular', over && 'task-time-over')}>
              {formatMinutes(spent)} spent{est ? ` of ${formatMinutes(est)} estimated` : ''}
              {over ? ` · ${formatMinutes(spent - est!)} over` : ''}
            </span>
            {est && !over ? <span className="tabular">{formatMinutes(est - spent)} left</span> : null}
          </div>
        </div>
      ) : null}

      {formOpen && canEdit ? (
        <form
          className="task-time-form"
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setFormOpen(false); } }}
        >
          <Input ref={durationRef} size="sm" icon="clock" placeholder="1h 30m" value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Duration" className="task-time-duration" error={Boolean(duration.trim()) && !parsed} />
          <Input size="sm" placeholder="What did you work on?" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" className="grow" maxLength={500} />
          <DatePicker value={date} onChange={setDate} size="sm" variant="outline" clearable={false} quick={false} />
          <span className="row gap-1">
            <Button size="sm" variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" type="submit" loading={busy} disabled={!parsed}>Log{parsed ? ` ${formatMinutes(parsed)}` : ''}</Button>
          </span>
        </form>
      ) : null}

      {entries.isLoading ? (
        <div className="col gap-2 mt-2"><Skeleton height={28} /><Skeleton height={28} width="80%" /></div>
      ) : entries.error ? (
        <p className="small muted">Couldn't load time entries. <button type="button" className="task-link-text" onClick={() => void entries.refetch()}>Retry</button></p>
      ) : list.length ? (
        <div className="task-rows" role="list">
          {list.map((e) => (
            <div key={e.id} className="task-row-item task-time-entry" role="listitem">
              <Avatar name={e.user?.name ?? '?'} src={e.user?.avatarUrl} size={20} />
              <span className="task-time-minutes tabular">{formatMinutes(e.minutes)}</span>
              <span className="task-time-note truncate" title={e.note}>{e.note || <span className="faint">No note</span>}</span>
              <span className="xs muted task-time-date" title={e.user?.name}>{formatDate(e.date)}</span>
              {canEdit && (e.userId === meId || canManage) ? (
                <span className="task-row-actions">
                  <Button size="sm" variant="ghost" icon="trash" iconOnly onClick={() => void remove(e)} aria-label="Delete time entry">Delete</Button>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : !formOpen && !spent ? (
        <p className="task-section-note xs muted"><Icon name="clock" size={12} /> No time logged yet.</p>
      ) : null}
    </Section>
  );
}
