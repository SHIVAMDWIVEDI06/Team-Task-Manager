// Relations: grouped by type (blocked by / blocks / relates / duplicates) with an "add relation" popover.
import { useMemo, useRef, useState } from 'react';
import type { RelationType, TaskDetail, TaskRelationView } from '../../../../../../packages/shared/src/types.ts';
import { RELATION_TYPES } from '../../../../../../packages/shared/src/constants.ts';
import { keys, taskApi, useTasks } from '../../../app/data.ts';
import { invalidate, setQueryData } from '../../../lib/query.ts';
import { toast } from '../../../lib/toast.ts';
import { Button, StatusIcon, cx } from '../../../ui/primitives.tsx';
import { Popover } from '../../../ui/overlays.tsx';
import { ListPicker, Select, type PickerItem } from '../../../ui/pickers.tsx';
import { Icon, type IconName } from '../../../ui/Icon.tsx';
import { Section, useTaskCtx } from './Section.tsx';

const ORDER: RelationType[] = ['blocked_by', 'blocks', 'relates', 'duplicates'];
const ICON: Record<RelationType, IconName> = { blocked_by: 'ban', blocks: 'alert-triangle', relates: 'link', duplicates: 'copy' };

export function Relations() {
  const { task, canEdit, openTask } = useTaskCtx();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RelationType>('blocked_by');
  const [busy, setBusy] = useState(false);
  const anchor = useRef<HTMLButtonElement | null>(null);
  const tasks = useTasks(open ? task.projectId : null).data;

  const groups = useMemo(() => {
    const m = new Map<RelationType, TaskRelationView[]>();
    for (const r of task.relations) {
      const arr = m.get(r.type) ?? [];
      arr.push(r);
      m.set(r.type, arr);
    }
    return ORDER.filter((t) => m.has(t)).map((t) => ({ type: t, label: RELATION_TYPES.find((x) => x.value === t)?.label ?? t, items: m.get(t)! }));
  }, [task.relations]);

  const related = useMemo(() => new Set(task.relations.map((r) => r.task.id)), [task.relations]);
  const items: PickerItem<string>[] = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.id !== task.id && !related.has(t.id) && !t.archivedAt)
        .map((t) => ({ value: t.id, label: t.title, description: t.key, keywords: t.key, icon: <StatusIcon category={t.statusCategory || 'todo'} color={t.statusColor || '#8b8fa3'} /> })),
    [tasks, task.id, related],
  );

  if (!task.relations.length && !canEdit) return null;

  const add = async (targetId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await taskApi.addRelation(task.id, type, targetId);
      invalidate([keys.task(task.id), keys.task(targetId)]);
      setOpen(false);
      toast.success('Relation added');
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(false);
    }
  };
  const remove = (r: TaskRelationView) => {
    setQueryData<TaskDetail>(keys.task(task.id), (p) => (p ? { ...p, relations: p.relations.filter((x) => x.id !== r.id) } : p));
    taskApi
      .deleteRelation(r.id)
      .then(() => invalidate(keys.task(r.task.id)))
      .catch((e) => {
        toast.fromError(e);
        invalidate(keys.task(task.id));
      });
  };

  const addButton = canEdit ? (
    <>
      <Button ref={anchor} size="sm" variant="ghost" icon="plus" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}>Add relation</Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} width={340} align="end" className="task-relation-popover">
        <div className="task-relation-form">
          <div className="row gap-2 between" style={{ padding: '8px 8px 0' }}>
            <span className="small secondary">This task</span>
            <Select<RelationType> value={type} onChange={setType} size="sm" width={180} items={RELATION_TYPES.map((t) => ({ value: t.value, label: t.label, icon: <Icon name={ICON[t.value]} size={14} /> }))} />
          </div>
          <ListPicker items={items} placeholder="Search tasks by key or title…" emptyText={tasks ? 'No matching tasks' : 'Loading…'} loading={!tasks || busy} onSelect={(v) => void add(v)} maxHeight={260} />
        </div>
      </Popover>
    </>
  ) : null;

  return (
    <Section icon="link" title="Relations" count={task.relations.length || undefined} actions={task.relations.length ? addButton : null}>
      {groups.length ? (
        <div className="task-relations">
          {groups.map((g) => (
            <div key={g.type} className="task-relation-group">
              <div className="task-relation-type xs muted">
                <Icon name={ICON[g.type]} size={12} />
                {g.label}
              </div>
              <div className="task-rows" role="list">
                {g.items.map((r) => {
                  const rDone = r.task.statusCategory === 'done' || r.task.statusCategory === 'cancelled';
                  return (
                    <div key={r.id} className={cx('task-row-item task-relation', rDone && 'is-done')} role="listitem">
                      <StatusIcon category={r.task.statusCategory || 'todo'} color={r.task.statusColor || '#8b8fa3'} />
                      <button type="button" className="task-row-title" onClick={() => openTask(r.task.key)} title={`Open ${r.task.key}`}>
                        <span className="task-key mono">{r.task.key}</span>
                        <span className="truncate">{r.task.title}</span>
                      </button>
                      {r.task.statusName ? <span className="xs muted task-relation-status">{r.task.statusName}</span> : null}
                      {canEdit ? (
                        <span className="task-row-actions">
                          <Button size="sm" variant="ghost" icon="x" iconOnly onClick={() => remove(r)} aria-label="Remove relation">Remove</Button>
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="task-section-empty-row">{addButton}</div>
      )}
    </Section>
  );
}
