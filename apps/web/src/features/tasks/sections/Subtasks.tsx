// Subtasks: list with inline status / assignee, progress and an inline "add subtask" input.
import { useEffect, useRef, useState } from 'react';
import type { Task, TaskDetail, TaskStatus } from '../../../../../../packages/shared/src/types.ts';
import { createTask, keys, updateTask } from '../../../app/data.ts';
import { invalidate, setQueryData } from '../../../lib/query.ts';
import { toast } from '../../../lib/toast.ts';
import { Button, Progress, cx } from '../../../ui/primitives.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { AssigneePicker, DueBadge, StatusPicker } from '../fields.tsx';
import { Section, useTaskCtx } from './Section.tsx';

export function Subtasks({ statuses }: { statuses: TaskStatus[] }) {
  const { task, canEdit, openTask } = useTaskCtx();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const list = task.subtasks;
  const done = list.filter((t) => t.statusCategory === 'done' || t.statusCategory === 'cancelled').length;
  if (!list.length && !canEdit) return null;

  const submit = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const created = await createTask(task.projectId, { title: t, parentId: task.id });
      // show it immediately; the parent detail is also invalidated by createTask()
      setQueryData<TaskDetail>(keys.task(task.id), (p) => (p && !p.subtasks.some((s) => s.id === created.id) ? { ...p, subtasks: [...p.subtasks, created], subtaskCount: p.subtaskCount + 1 } : p));
      invalidate(keys.task(task.id));
      setTitle('');
      inputRef.current?.focus();
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(false);
    }
  };

  const patchSub = (sub: Task, p: Parameters<typeof updateTask>[1], optimistic?: Partial<Task>) => {
    setQueryData<TaskDetail>(keys.task(task.id), (prev) => (prev ? { ...prev, subtasks: prev.subtasks.map((s) => (s.id === sub.id ? { ...s, ...(p as Partial<Task>), ...(optimistic ?? {}) } : s)) } : prev));
    updateTask(sub, p, optimistic)
      .then(() => invalidate(keys.task(task.id)))
      .catch((e) => {
        toast.fromError(e);
        invalidate(keys.task(task.id));
      });
  };

  return (
    <Section
      icon="git-branch"
      title="Subtasks"
      count={list.length ? `${done}/${list.length}` : undefined}
      actions={canEdit && !adding ? <Button size="sm" variant="ghost" icon="plus" onClick={() => setAdding(true)}>Add subtask</Button> : null}
    >
      {list.length ? (
        <>
          <Progress value={done} max={list.length} height={4} className="task-section-progress" color={done === list.length ? 'var(--success)' : undefined} title={`${done} of ${list.length} done`} />
          <div className="task-rows" role="list">
            {list.map((s) => {
              const sDone = s.statusCategory === 'done' || s.statusCategory === 'cancelled';
              return (
                <div key={s.id} className={cx('task-row-item task-subtask', sDone && 'is-done')} role="listitem">
                  <StatusPicker value={s.statusId} statuses={statuses} showLabel={false} disabled={!canEdit || !statuses.length} onChange={(sid) => { const st = statuses.find((x) => x.id === sid); patchSub(s, { statusId: sid }, st ? { statusName: st.name, statusCategory: st.category, statusColor: st.color } : undefined); }} />
                  <button type="button" className="task-row-title" onClick={() => openTask(s.key)} title={`Open ${s.key}`}>
                    <span className="task-key mono">{s.key}</span>
                    <span className="truncate">{s.title}</span>
                  </button>
                  <DueBadge value={s.dueDate} done={sDone} />
                  <AssigneePicker value={s.assigneeId} disabled={!canEdit} onChange={(id) => patchSub(s, { assigneeId: id })} />
                </div>
              );
            })}
          </div>
        </>
      ) : null}
      {adding ? (
        <div className="task-inline-add">
          <Icon name="plus" size={14} className="muted" />
          <input
            ref={inputRef}
            className="task-inline-input"
            value={title}
            placeholder="Subtask title… (Enter to add)"
            maxLength={200}
            aria-label="New subtask title"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void submit(); }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setTitle(''); setAdding(false); }
            }}
            onBlur={() => { if (!title.trim()) setAdding(false); }}
          />
          <Button size="sm" variant="primary" loading={busy} disabled={!title.trim()} onClick={() => void submit()}>Add</Button>
        </div>
      ) : !list.length ? (
        <button type="button" className="task-section-empty" onClick={() => setAdding(true)}>
          <Icon name="plus" size={14} /> Add a subtask
        </button>
      ) : null}
    </Section>
  );
}
