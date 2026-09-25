// Checklist: check / edit / delete / drag-reorder items with optimistic cache updates on the task detail.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChecklistItem, TaskDetail } from '../../../../../../packages/shared/src/types.ts';
import { positionBetween } from '../../../../../../packages/shared/src/utils.ts';
import { keys, taskApi } from '../../../app/data.ts';
import { invalidate, setQueryData } from '../../../lib/query.ts';
import { DndProvider, useDraggable, useDroppable, useDragState, type DropResult } from '../../../lib/dnd.tsx';
import { toast } from '../../../lib/toast.ts';
import { Button, Checkbox, Progress, cx } from '../../../ui/primitives.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { Section, useTaskCtx } from './Section.tsx';

function patchChecklist(taskId: string, fn: (items: ChecklistItem[]) => ChecklistItem[]) {
  setQueryData<TaskDetail>(keys.task(taskId), (p) => {
    if (!p) return p;
    const checklist = fn(p.checklist);
    return { ...p, checklist, checklistCount: checklist.length, checklistDoneCount: checklist.filter((i) => i.done).length };
  });
}

function Row({ item, canEdit, onToggle, onRename, onDelete, overlay }: { item: ChecklistItem; canEdit: boolean; onToggle: (v: boolean) => void; onRename: (text: string) => void; onDelete: () => void; overlay?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const drag = useDraggable(item.id, { item }, !canEdit || overlay || editing);
  useEffect(() => {
    if (!editing) setText(item.text);
  }, [item.text, editing]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);
  const commit = () => {
    const t = text.trim();
    setEditing(false);
    if (!t) {
      setText(item.text);
      return;
    }
    if (t !== item.text) onRename(t);
  };
  return (
    <div ref={drag.ref as React.RefObject<HTMLDivElement>} {...(overlay ? {} : drag.attributes)} className={cx('task-row-item task-check', item.done && 'is-done', drag.isDragging && !overlay && 'is-dragging', overlay && 'is-overlay', editing && 'is-editing')} role="listitem">
      {canEdit ? <span className="task-check-grip" aria-hidden="true"><Icon name="grip" size={12} /></span> : null}
      <Checkbox checked={item.done} disabled={!canEdit} onChange={onToggle} size={15} />
      {editing ? (
        <input
          ref={inputRef}
          className="task-inline-input"
          value={text}
          maxLength={500}
          aria-label="Checklist item"
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setText(item.text); setEditing(false); }
          }}
        />
      ) : (
        <span className={cx('task-check-text', canEdit && 'is-editable')} onClick={() => canEdit && !overlay && setEditing(true)} title={canEdit ? 'Click to edit' : undefined}>
          {item.text}
        </span>
      )}
      {canEdit && !overlay ? (
        <span className="task-row-actions">
          <Button size="sm" variant="ghost" icon="trash" iconOnly onClick={onDelete} aria-label="Delete item">Delete</Button>
        </span>
      ) : null}
    </div>
  );
}

function SortableList({ taskId, items, canEdit, toggle, rename, remove }: { taskId: string; items: ChecklistItem[]; canEdit: boolean; toggle: (i: ChecklistItem, v: boolean) => void; rename: (i: ChecklistItem, t: string) => void; remove: (i: ChecklistItem) => void }) {
  const drop = useDroppable(`checklist:${taskId}`, {}, { sortable: true, axis: 'y' });
  const dragState = useDragState();
  const dragging = Boolean(dragState.activeId) && items.some((i) => i.id === dragState.activeId);
  const showPh = dragging && drop.isOver;
  const others = dragging ? items.filter((i) => i.id !== dragState.activeId).length : items.length;
  const phIndex = Math.min(drop.overIndex ?? others, others);
  const rows: React.ReactNode[] = [];
  let j = 0;
  let placed = false;
  for (const it of items) {
    const isActive = it.id === dragState.activeId;
    if (showPh && !placed && !isActive && j === phIndex) {
      rows.push(<div key="ph" className="task-check-placeholder" />);
      placed = true;
    }
    rows.push(<Row key={it.id} item={it} canEdit={canEdit} onToggle={(v) => toggle(it, v)} onRename={(t) => rename(it, t)} onDelete={() => remove(it)} />);
    if (!isActive) j++;
  }
  if (showPh && !placed) rows.push(<div key="ph" className="task-check-placeholder" />);
  // always rendered (even empty) so the droppable stays registered once items appear
  return (
    <div ref={drop.ref as React.RefObject<HTMLDivElement>} {...drop.attributes} className={cx('task-rows task-checklist', dragging && 'is-dragging')} role="list">
      {rows}
    </div>
  );
}

export function Checklist() {
  const { task, canEdit } = useTaskCtx();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const items = useMemo(() => [...task.checklist].sort((a, b) => a.position - b.position), [task.checklist]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const done = items.filter((i) => i.done).length;
  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  if (!items.length && !canEdit) return null;

  const rollback = (e: unknown) => {
    toast.fromError(e);
    invalidate(keys.task(task.id));
  };
  const toggle = (item: ChecklistItem, v: boolean) => {
    patchChecklist(task.id, (l) => l.map((i) => (i.id === item.id ? { ...i, done: v } : i)));
    taskApi.updateChecklist(item.id, { done: v }).catch(rollback);
  };
  const rename = (item: ChecklistItem, t: string) => {
    patchChecklist(task.id, (l) => l.map((i) => (i.id === item.id ? { ...i, text: t } : i)));
    taskApi.updateChecklist(item.id, { text: t }).catch(rollback);
  };
  const remove = (item: ChecklistItem) => {
    patchChecklist(task.id, (l) => l.filter((i) => i.id !== item.id));
    taskApi.deleteChecklist(item.id).catch(rollback);
  };
  const add = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const created = await taskApi.addChecklist(task.id, t);
      patchChecklist(task.id, (l) => (l.some((i) => i.id === created.id) ? l : [...l, created]));
      setText('');
      inputRef.current?.focus();
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(false);
    }
  };
  const onDragEnd = (r: DropResult) => {
    if (!r.over || r.over.index === null) return;
    const cur = itemsRef.current;
    const item = cur.find((i) => i.id === r.activeId);
    if (!item) return;
    const others = cur.filter((i) => i.id !== item.id);
    const idx = Math.min(r.over.index, others.length);
    const before = others[idx - 1] ?? null;
    const after = others[idx] ?? null;
    const curIdx = cur.findIndex((i) => i.id === item.id);
    if ((cur[curIdx - 1]?.id ?? null) === (before?.id ?? null) && (cur[curIdx + 1]?.id ?? null) === (after?.id ?? null)) return;
    const position = positionBetween(before?.position ?? null, after?.position ?? null);
    patchChecklist(task.id, (l) => l.map((i) => (i.id === item.id ? { ...i, position } : i)));
    taskApi.updateChecklist(item.id, { position }).catch(rollback);
  };

  return (
    <Section
      icon="check-square"
      title="Checklist"
      count={items.length ? `${done}/${items.length}` : undefined}
      actions={canEdit && !adding ? <Button size="sm" variant="ghost" icon="plus" onClick={() => setAdding(true)}>Add item</Button> : null}
    >
      {items.length ? <Progress value={done} max={items.length} height={4} className="task-section-progress" color={done === items.length ? 'var(--success)' : undefined} title={`${done} of ${items.length} done`} /> : null}
      <DndProvider onDragEnd={onDragEnd} renderOverlay={(s) => (s.activeData.item ? <Row item={s.activeData.item as ChecklistItem} canEdit={false} onToggle={() => {}} onRename={() => {}} onDelete={() => {}} overlay /> : null)}>
        <SortableList taskId={task.id} items={items} canEdit={canEdit} toggle={toggle} rename={rename} remove={remove} />
      </DndProvider>
      {adding ? (
        <div className="task-inline-add">
          <span className="task-check-add-box" />
          <input
            ref={inputRef}
            className="task-inline-input"
            value={text}
            placeholder="Checklist item… (Enter to add)"
            maxLength={500}
            aria-label="New checklist item"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void add(); }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setText(''); setAdding(false); }
            }}
            onBlur={() => { if (!text.trim()) setAdding(false); }}
          />
          <Button size="sm" variant="primary" loading={busy} disabled={!text.trim()} onClick={() => void add()}>Add</Button>
        </div>
      ) : !items.length ? (
        <button type="button" className="task-section-empty" onClick={() => setAdding(true)}>
          <Icon name="plus" size={14} /> Add a checklist item
        </button>
      ) : null}
    </Section>
  );
}
