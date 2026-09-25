// Task detail body (title, properties, description, sections, comments/activity). Reusable: the peek panel and any
// full page can render it. Expects a flex-column parent; it scrolls internally.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Label, ProjectBundle, TaskDetail as TaskDetailT } from '../../../../../packages/shared/src/types.ts';
import { formatMinutes } from '../../../../../packages/shared/src/utils.ts';
import { keys, projectApi, taskApi, updateTask, useComments, type TaskPatch } from '../../app/data.ts';
import { useWorkspace } from '../../app/workspace.tsx';
import { useMe } from '../../app/auth.tsx';
import { invalidate } from '../../lib/query.ts';
import { toast } from '../../lib/toast.ts';
import { useHotkey, useTick } from '../../lib/hooks.ts';
import { formatDateTime, relativeTime } from '../../lib/format.ts';
import { Avatar, Button, cx, Kbd } from '../../ui/primitives.tsx';
import { Tabs, Tooltip } from '../../ui/overlays.tsx';
import { DatePicker } from '../../ui/pickers.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { AssigneePicker, DueDateButton, EstimateInput, LabelChips, LabelPicker, PriorityPicker, RecurrencePicker, StatusPicker } from './fields.tsx';
import { Editor, EditorHint, MarkdownView } from './Editor.tsx';
import { Section, TaskCtxProvider, openAttachment } from './sections/Section.tsx';
import { Subtasks } from './sections/Subtasks.tsx';
import { Checklist } from './sections/Checklist.tsx';
import { Relations } from './sections/Relations.tsx';
import { Attachments, useUploader } from './sections/Attachments.tsx';
import { TimeTracking } from './sections/TimeTracking.tsx';
import { Comments } from './sections/Comments.tsx';
import { ActivityList } from './sections/Activity.tsx';

const overlayOpen = () => Boolean(document.querySelector('.popover, .dialog-overlay, .mention-menu'));
const draftKey = (id: string) => `tt.desc.draft.${id}`;
const readDraft = (id: string): string | null => {
  try {
    return localStorage.getItem(draftKey(id));
  } catch {
    return null;
  }
};
const writeDraft = (id: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(draftKey(id));
    else localStorage.setItem(draftKey(id), v);
  } catch {
    /* ignore */
  }
};

export interface TaskDetailProps {
  task: TaskDetailT;
  bundle: ProjectBundle | undefined;
  canEdit: boolean;
  canManage: boolean;
  openTask: (key: string) => void;
  className?: string;
}

export function TaskDetail({ task, bundle, canEdit, canManage, openTask, className }: TaskDetailProps) {
  const ws = useWorkspace();
  const me = useMe();
  const statuses = useMemo(() => [...(bundle?.statuses ?? [])].sort((a, b) => a.position - b.position), [bundle?.statuses]);
  const labels = bundle?.labels ?? [];
  const isDone = task.statusCategory === 'done' || task.statusCategory === 'cancelled';
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const [timeFormOpen, setTimeFormOpen] = useState(false);
  const comments = useComments(task.id);
  const commentCount = comments.data?.length ?? task.commentCount;

  const patch = useCallback((p: TaskPatch, optimistic?: Parameters<typeof updateTask>[2]) => updateTask(task, p, optimistic).catch((e) => toast.fromError(e)), [task]);

  // ---- Title ----
  const [title, setTitle] = useState(task.title);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const titleFocused = useRef(false);
  useEffect(() => {
    if (!titleFocused.current) setTitle(task.title);
  }, [task.title]);
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);
  const saveTitle = () => {
    const t = title.trim();
    if (!t) {
      setTitle(task.title);
      return;
    }
    if (t !== task.title) void patch({ title: t });
    setTitle(t);
  };

  // ---- Description ----
  const [editingDesc, setEditingDesc] = useState(() => readDraft(task.id) !== null);
  const [desc, setDesc] = useState(() => readDraft(task.id) ?? task.description);
  const [savingDesc, setSavingDesc] = useState(false);
  const startEditDesc = () => {
    if (!canEdit) return;
    setDesc(readDraft(task.id) ?? task.description);
    setEditingDesc(true);
  };
  const changeDesc = (v: string) => {
    setDesc(v);
    writeDraft(task.id, v);
  };
  const cancelDesc = () => {
    writeDraft(task.id, null);
    setEditingDesc(false);
    setDesc(task.description);
  };
  const saveDesc = async () => {
    if (savingDesc) return;
    setSavingDesc(true);
    try {
      if (desc !== task.description) await updateTask(task, { description: desc });
      writeDraft(task.id, null);
      setEditingDesc(false);
    } catch (e) {
      toast.fromError(e);
    } finally {
      setSavingDesc(false);
    }
  };
  const { upload, uploading } = useUploader(task.id);
  const descFiles = async (files: File[]) => {
    const added = await upload(files);
    if (added.length) changeDesc(desc + (desc && !desc.endsWith('\n') ? '\n' : '') + added.map((a) => `[${a.filename}](${a.url})`).join('\n') + '\n');
  };

  // ---- Labels ----
  const createLabel = async (name: string): Promise<Label | void> => {
    try {
      const l = await projectApi.addLabel(task.projectId, { name });
      invalidate(keys.bundle(task.projectId));
      return l;
    } catch (e) {
      toast.fromError(e);
    }
  };

  // ---- Keyboard: S/P/A/D/L open pickers (StatusPicker is controlled; others: click their trigger) ----
  const [statusOpen, setStatusOpen] = useState(false);
  const priorityRef = useRef<HTMLDivElement | null>(null);
  const assigneeRef = useRef<HTMLDivElement | null>(null);
  const dueRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const clickIn = (ref: React.RefObject<HTMLDivElement | null>) => () => {
    if (overlayOpen() || !canEdit) return;
    const btn = ref.current?.querySelector<HTMLButtonElement>('button');
    btn?.focus();
    btn?.click();
  };
  useHotkey('s', () => { if (!overlayOpen() && canEdit && statuses.length) setStatusOpen(true); });
  useHotkey('p', clickIn(priorityRef));
  useHotkey('a', clickIn(assigneeRef));
  useHotkey('d', clickIn(dueRef));
  useHotkey('l', clickIn(labelsRef));

  // Attachment links inside rendered markdown need the auth token → open them through the blob helper.
  const onBodyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('/api/attachments/')) {
      e.preventDefault();
      void openAttachment(href);
    }
  };

  const reporter = ws.member(task.reporterId)?.user;
  const openTimeForm = () => {
    setTimeFormOpen(true);
    setTimeout(() => document.getElementById(`time-${task.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
  };

  useTick(60_000);

  return (
    <TaskCtxProvider value={{ task, bundle, canEdit, canManage, meId: me.id, openTask }}>
      <div ref={bodyRef} className={cx('task-detail', className)} onClick={onBodyClick}>
        {/* Title */}
        <textarea
          ref={titleRef}
          className={cx('task-title', isDone && 'is-done')}
          value={title}
          rows={1}
          maxLength={200}
          readOnly={!canEdit}
          aria-label="Task title"
          placeholder="Task title"
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => { titleFocused.current = true; }}
          onBlur={() => { titleFocused.current = false; saveTitle(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setTitle(task.title); requestAnimationFrame(() => titleRef.current?.blur()); }
          }}
        />

        {/* Properties */}
        <div className="task-props" role="group" aria-label="Properties">
          <Prop label="Status" shortcut="S">
            <StatusPicker value={task.statusId} statuses={statuses} showLabel variant="outline" size="sm" disabled={!canEdit || !statuses.length} open={statusOpen} onOpenChange={setStatusOpen} onChange={(sid) => { const s = statuses.find((x) => x.id === sid); void patch({ statusId: sid }, s ? { statusName: s.name, statusCategory: s.category, statusColor: s.color } : undefined); }} />
          </Prop>
          <Prop label="Priority" shortcut="P">
            <div ref={priorityRef} className="task-prop-inner"><PriorityPicker value={task.priority} showLabel variant="outline" disabled={!canEdit} onChange={(p) => void patch({ priority: p })} /></div>
          </Prop>
          <Prop label="Assignee" shortcut="A">
            <div ref={assigneeRef} className="task-prop-inner"><AssigneePicker value={task.assigneeId} showLabel variant="outline" disabled={!canEdit} onChange={(id) => void patch({ assigneeId: id })} /></div>
          </Prop>
          <Prop label="Labels" shortcut="L">
            <div ref={labelsRef} className="task-prop-inner">
              <LabelPicker value={task.labelIds} labels={labels} variant="outline" disabled={!canEdit} onChange={(ids) => void patch({ labelIds: ids })} onCreate={canEdit ? createLabel : undefined}>
                {task.labelIds.length ? <LabelChips labelIds={task.labelIds} labels={labels} max={4} /> : <span className="row gap-1 muted"><Icon name="tag" size={14} /> Add labels</span>}
              </LabelPicker>
            </div>
          </Prop>
          <Prop label="Start date">
            <DatePicker value={task.startDate} placeholder="Set start" variant="outline" disabled={!canEdit} className="field-btn" onChange={(d) => void patch({ startDate: d })} />
          </Prop>
          <Prop label="Due date" shortcut="D">
            <div ref={dueRef} className="task-prop-inner"><DueDateButton value={task.dueDate} done={isDone} variant="outline" disabled={!canEdit} label="Set due date" onChange={(d) => void patch({ dueDate: d })} /></div>
          </Prop>
          <Prop label="Estimate">
            {canEdit ? <EstimateInput value={task.estimateMinutes} variant="outline" onChange={(m) => void patch({ estimateMinutes: m })} /> : <span className="task-prop-text">{task.estimateMinutes ? formatMinutes(task.estimateMinutes) : <span className="muted">—</span>}</span>}
          </Prop>
          <Prop label="Time spent">
            <span className="row gap-2">
              <span className={cx('task-prop-text tabular', task.estimateMinutes && task.timeSpentMinutes > task.estimateMinutes && 'is-over')} title={task.estimateMinutes ? `${formatMinutes(task.timeSpentMinutes)} of ${formatMinutes(task.estimateMinutes)} estimated` : undefined}>
                {formatMinutes(task.timeSpentMinutes)}
                {task.estimateMinutes ? <span className="muted">{' / '}{formatMinutes(task.estimateMinutes)}</span> : null}
              </span>
              {canEdit ? <Button size="sm" variant="ghost" icon="clock" onClick={openTimeForm} className="task-prop-action">Log time</Button> : null}
            </span>
          </Prop>
          <Prop label="Recurrence">
            {canEdit ? <RecurrencePicker value={task.recurrence} variant="outline" onChange={(r) => void patch({ recurrence: r })} /> : <span className="task-prop-text muted">{task.recurrence ? 'Repeats' : '—'}</span>}
          </Prop>
          <Prop label="Reporter">
            <span className="row gap-2 task-prop-text">
              {reporter ? <Avatar name={reporter.name} src={reporter.avatarUrl} size={18} /> : <span className="assignee-empty"><Icon name="user" size={12} /></span>}
              <span className="truncate">{reporter?.name ?? 'Unknown'}</span>
            </span>
          </Prop>
          <Prop label="Created">
            <Tooltip content={formatDateTime(task.createdAt)}><span className="task-prop-text muted">{relativeTime(task.createdAt)}</span></Tooltip>
          </Prop>
          <Prop label="Updated">
            <Tooltip content={formatDateTime(task.updatedAt)}><span className="task-prop-text muted">{relativeTime(task.updatedAt)}</span></Tooltip>
          </Prop>
        </div>

        {/* Description */}
        <Section
          title="Description"
          icon="text"
          className="task-description"
          actions={canEdit && !editingDesc && task.description ? <Button size="sm" variant="ghost" icon="pencil" onClick={startEditDesc}>Edit</Button> : null}
        >
          {editingDesc ? (
            <div className="task-description-editor">
              <Editor value={desc} onChange={changeDesc} autoFocus minRows={5} onSubmit={() => void saveDesc()} onCancel={cancelDesc} onFiles={(f) => void descFiles(f)} placeholder="Add a description… Markdown supported, @ to mention" />
              <div className="row between mt-2">
                <span className="row gap-2">
                  <EditorHint />
                  {uploading.length ? <span className="xs muted row gap-1"><Icon name="loader" size={12} className="spinner" /> Uploading {uploading.length} file{uploading.length > 1 ? 's' : ''}…</span> : null}
                </span>
                <span className="row gap-1">
                  <Button size="sm" variant="ghost" onClick={cancelDesc}>Cancel</Button>
                  <Button size="sm" variant="primary" loading={savingDesc} onClick={() => void saveDesc()}>Save</Button>
                </span>
              </div>
            </div>
          ) : task.description.trim() ? (
            <div className={cx('task-description-view', canEdit && 'is-editable')} onClick={(e) => { const t = e.target as HTMLElement; if (t.closest('a, input, button')) return; startEditDesc(); }} title={canEdit ? 'Click to edit' : undefined}>
              <MarkdownView source={task.description} onChange={canEdit ? (next) => void patch({ description: next }) : undefined} />
            </div>
          ) : canEdit ? (
            <button type="button" className="task-description-empty" onClick={startEditDesc}>
              <Icon name="plus" size={14} /> Add a description…
            </button>
          ) : (
            <p className="muted small">No description.</p>
          )}
        </Section>

        {task.parentId && task.parent ? (
          <div className="task-parent-note">
            <Icon name="git-branch" size={13} className="muted" />
            <span className="muted small">Subtask of</span>
            <button type="button" className="task-link" onClick={() => openTask(task.parent!.key)}>
              <span className="mono">{task.parent.key}</span> <span className="truncate">{task.parent.title}</span>
            </button>
          </div>
        ) : (
          <Subtasks statuses={statuses} />
        )}
        <Checklist />
        <Relations />
        <Attachments />
        <TimeTracking formOpen={timeFormOpen} setFormOpen={setTimeFormOpen} />

        {/* Comments / Activity */}
        <div className="task-feed">
          <Tabs value={tab} onChange={setTab} size="sm" tabs={[{ value: 'comments', label: 'Comments', icon: 'message', count: commentCount }, { value: 'activity', label: 'Activity', icon: 'activity' }]} />
          {tab === 'comments' ? <Comments comments={comments} /> : <ActivityList />}
        </div>
      </div>
    </TaskCtxProvider>
  );
}

function Prop({ label, shortcut, children }: { label: string; shortcut?: string; children: React.ReactNode }) {
  return (
    <div className="task-prop">
      <span className="task-prop-label" title={shortcut ? `Press ${shortcut} to change` : undefined}>
        {label}
        {shortcut ? <Kbd className="task-prop-kbd">{shortcut}</Kbd> : null}
      </span>
      <span className="task-prop-value">{children}</span>
    </div>
  );
}
