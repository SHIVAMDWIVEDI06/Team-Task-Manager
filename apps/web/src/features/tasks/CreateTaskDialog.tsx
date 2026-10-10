// Global "New task" dialog. Opens from uiStore.createTaskOpen (true or a defaults object).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Label, Priority, Recurrence } from '../../../../../packages/shared/src/types.ts';
import { LIMITS } from '../../../../../packages/shared/src/constants.ts';
import { createTask, useBundle, useTask, type CreateTaskInput } from '../../app/data.ts';
import { useWorkspace } from '../../app/workspace.tsx';
import { useMe } from '../../app/auth.tsx';
import { useLocation } from '../../lib/router.tsx';
import { uiStore } from '../../lib/store.ts';
import { toast } from '../../lib/toast.ts';
import { RequestError } from '../../lib/api.ts';
import { modKey } from '../../lib/format.ts';
import { Dialog } from '../../ui/overlays.tsx';
import { Badge, Button, EmptyState, Field, Kbd, Switch, cx } from '../../ui/primitives.tsx';
import { DatePicker, Select, type PickerItem } from '../../ui/pickers.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { Editor } from './Editor.tsx';
import { AssigneePicker, DueDateButton, EstimateInput, LabelChips, LabelPicker, PriorityPicker, RecurrencePicker, StatusPicker } from './fields.tsx';
import { openTaskAnywhere } from './TaskRow.tsx';
import './create-task.css';

export interface CreateTaskDefaults {
  projectId?: string;
  parentId?: string;
  statusId?: string;
  dueDate?: string;
  startDate?: string;
  assigneeId?: string | null;
}

/** Open the global create-task dialog, optionally with prefilled fields. */
export function openCreateTask(defaults?: CreateTaskDefaults) {
  const value = (defaults ?? true) as ReturnType<typeof uiStore.get>['createTaskOpen'];
  uiStore.set({ createTaskOpen: value });
}

const DRAFT_KEY = 'tt.createTaskDraft';
function readDraft(): { title: string; description: string } | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as { title: string; description: string }) : null;
  } catch {
    return null;
  }
}
function writeDraft(d: { title: string; description: string } | null) {
  try {
    if (d && (d.title || d.description)) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

// ---- Smart title tokens: "!high" sets priority, "#Bug" applies a label ----
const PRIORITY_WORDS: Record<string, Priority> = { urgent: 4, p0: 4, high: 3, p1: 3, medium: 2, med: 2, p2: 2, low: 1, p3: 1, none: 0, p4: 0 };
const TOKEN_RE = /(^|\s)([!#])([\w-]+)/g;

interface ParsedTitle {
  clean: string;
  priority: Priority | null;
  labelIds: string[];
  tokens: string[];
}
export function parseTitleTokens(title: string, labels: Label[]): ParsedTitle {
  const out: ParsedTitle = { clean: title, priority: null, labelIds: [], tokens: [] };
  const consumed: string[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(title))) {
    const [full, , sigil, word] = m;
    if (sigil === '!') {
      const p = PRIORITY_WORDS[word.toLowerCase()];
      if (p !== undefined) {
        out.priority = p;
        consumed.push(full);
        out.tokens.push(`!${word}`);
      }
    } else {
      const label = labels.find((l) => l.name.toLowerCase() === word.toLowerCase());
      if (label) {
        if (!out.labelIds.includes(label.id)) out.labelIds.push(label.id);
        consumed.push(full);
        out.tokens.push(`#${word}`);
      }
    }
  }
  let clean = title;
  for (const c of consumed) clean = clean.replace(c, ' ');
  out.clean = clean.replace(/\s+/g, ' ').trim();
  return out;
}

export function CreateTaskHost() {
  const open = uiStore.use((s) => s.createTaskOpen);
  const ws = useWorkspace();
  const close = () => uiStore.set({ createTaskOpen: false });
  if (!open) return null;
  if (!ws.canEdit) {
    return (
      <Dialog open onClose={close} size="sm" title="New task">
        <EmptyState compact icon="lock" title="Read-only access" description="Guests can view tasks but can't create them. Ask an admin to change your role." />
      </Dialog>
    );
  }
  if (!ws.projects.length) {
    return (
      <Dialog open onClose={close} size="sm" title="New task">
        <EmptyState compact icon="folder-plus" title="No projects yet" description="Create a project first, then add tasks to it." />
      </Dialog>
    );
  }
  const defaults: CreateTaskDefaults = typeof open === 'object' ? (open as CreateTaskDefaults) : {};
  return <CreateTaskDialog defaults={defaults} onClose={close} />;
}

function CreateTaskDialog({ defaults, onClose }: { defaults: CreateTaskDefaults; onClose: () => void }) {
  const ws = useWorkspace();
  const me = useMe();
  const loc = useLocation();

  const routeProject = useMemo(() => {
    const m = new RegExp(`^${ws.base.replace(/[/]/g, '\\/')}\\/p\\/([^/?#]+)`).exec(loc.pathname);
    return m ? ws.projectByKey(decodeURIComponent(m[1])) : undefined;
  }, [loc.pathname, ws]);
  const activeProjects = useMemo(() => ws.projects.filter((p) => p.state === 'active'), [ws.projects]);
  const initialProjectId = (defaults.projectId && ws.projectById(defaults.projectId)?.id) || routeProject?.id || activeProjects[0]?.id || ws.projects[0]?.id || null;

  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const bundle = useBundle(projectId);
  const statuses = useMemo(() => [...(bundle.data?.statuses ?? [])].sort((a, b) => a.position - b.position), [bundle.data?.statuses]);
  const labels = useMemo(() => bundle.data?.labels ?? [], [bundle.data?.labels]);
  const parent = useTask(defaults.parentId ?? null);

  const draft = useMemo(() => readDraft(), []);
  const [title, setTitle] = useState(draft?.title ?? '');
  const [description, setDescription] = useState(draft?.description ?? '');
  const [statusId, setStatusId] = useState<string | null>(defaults.statusId ?? null);
  const [priority, setPriority] = useState<Priority>(0);
  const [assigneeId, setAssigneeId] = useState<string | null>(defaults.assigneeId ?? null);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string | null>(defaults.dueDate ?? null);
  const [startDate, setStartDate] = useState<string | null>(defaults.startDate ?? null);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  const [createMore, setCreateMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdCount, setCreatedCount] = useState(0);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const appliedTokens = useRef<Set<string>>(new Set());

  // Keep a valid status when the project (and therefore its workflow) changes.
  useEffect(() => {
    if (!statuses.length) return;
    if (!statusId || !statuses.some((s) => s.id === statusId)) {
      const preferred = statuses.find((s) => s.category === 'todo') ?? statuses.find((s) => s.category === 'backlog') ?? statuses[0];
      setStatusId((defaults.statusId && statuses.some((s) => s.id === defaults.statusId) ? defaults.statusId : preferred.id) ?? null);
    }
  }, [statuses, statusId, defaults.statusId]);
  // Labels belong to a project: drop them when switching.
  const prevProject = useRef(projectId);
  useEffect(() => {
    if (prevProject.current !== projectId) {
      prevProject.current = projectId;
      setLabelIds([]);
      appliedTokens.current.clear();
    }
  }, [projectId]);

  // Persist the draft so an accidental close doesn't lose the text.
  useEffect(() => {
    writeDraft({ title, description });
  }, [title, description]);

  // Smart tokens: apply "!high" / "#Bug" as they are typed (each token once).
  const parsed = useMemo(() => parseTitleTokens(title, labels), [title, labels]);
  useEffect(() => {
    for (const t of parsed.tokens) {
      if (appliedTokens.current.has(t.toLowerCase())) continue;
      appliedTokens.current.add(t.toLowerCase());
      if (t.startsWith('!') && parsed.priority !== null) setPriority(parsed.priority);
      if (t.startsWith('#')) setLabelIds((prev) => Array.from(new Set([...prev, ...parsed.labelIds])));
    }
  }, [parsed]);

  const projectItems: PickerItem<string>[] = activeProjects.map((p) => ({
    value: p.id,
    label: p.name,
    description: p.key,
    keywords: p.key,
    icon: (
      <span className="project-icon ct-project-icon" style={{ background: p.color }} aria-hidden>
        {p.icon}
      </span>
    ),
  }));
  const project = projectId ? ws.projectById(projectId) : undefined;
  const cleanTitle = parsed.clean;
  const canSubmit = Boolean(projectId && cleanTitle && !busy);

  const busyRef = useRef(false);
  const submit = async () => {
    if (!projectId || busyRef.current) return;
    if (!cleanTitle) {
      setErrors({ title: 'Give the task a title.' });
      titleRef.current?.focus();
      return;
    }
    if (cleanTitle.length > LIMITS.titleMax) {
      setErrors({ title: `Keep the title under ${LIMITS.titleMax} characters.` });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setErrors({});
    const input: CreateTaskInput = {
      title: cleanTitle,
      description: description.trim() ? description : undefined,
      statusId: statusId ?? undefined,
      priority,
      assigneeId,
      parentId: defaults.parentId ?? null,
      dueDate,
      startDate,
      estimateMinutes: estimate,
      labelIds: labelIds.length ? labelIds : undefined,
      recurrence,
    };
    try {
      const task = await createTask(projectId, input);
      const base = ws.base;
      const wsId = ws.workspace.id;
      toast.success(`${task.key} created`, { description: task.title, action: { label: 'Open', onClick: () => openTaskAnywhere(base, task, wsId) } });
      writeDraft(null);
      if (createMore) {
        setTitle('');
        setDescription('');
        setErrors({});
        appliedTokens.current.clear();
        setCreatedCount((n) => n + 1);
        setTimeout(() => titleRef.current?.focus(), 0);
      } else onClose();
    } catch (e) {
      if (e instanceof RequestError) {
        const fe = e.fieldErrors;
        setErrors(Object.keys(fe).length ? fe : { _: e.message });
      } else setErrors({ _: (e as Error).message || 'Something went wrong' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  };

  const header = (
    <div className="ct-header-left">
      <Select value={projectId} onChange={setProjectId} items={projectItems} placeholder="Project" size="sm" variant="ghost" searchable={activeProjects.length > 6} width={280} className="ct-project-select" title="Project" />
      {defaults.parentId ? (
        <>
          <Icon name="chevron-right" size={13} className="faint" />
          <Badge size="sm" icon="git-branch" title={parent.data?.title}>
            Subtask of {parent.data?.key ?? '…'}
          </Badge>
        </>
      ) : null}
      {createdCount ? <span className="ct-created-count xs muted tabular">{createdCount} created</span> : null}
    </div>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      className="ct-dialog"
      title={header}
      footer={
        <div className="ct-footer">
          <Switch checked={createMore} onChange={setCreateMore} label="Create more" />
          <span className="grow" />
          <Button variant="ghost" onClick={() => { writeDraft(null); onClose(); }}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!canSubmit} onClick={() => void submit()} title={`Create (${modKey} ↵)`}>
            Create task
            <span className="ct-submit-kbd">
              <Kbd>{modKey}</Kbd>
              <Kbd>↵</Kbd>
            </span>
          </Button>
        </div>
      }
    >
      <div className="ct-body" onKeyDown={onKeyDown}>
        {errors._ ? <div className="form-error">{errors._}</div> : null}
        <div className={cx('field', errors.title && 'has-error')}>
          <input
            ref={titleRef}
            className={cx('ct-title', errors.title && 'is-error')}
            value={title}
            placeholder="Task title"
            maxLength={LIMITS.titleMax + 40}
            aria-label="Title"
            data-autofocus
            autoComplete="off"
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          {errors.title ? <div className="field-error">{errors.title}</div> : null}
          {parsed.tokens.length ? (
            <div className="ct-token-hint xs muted">
              <Icon name="sparkles" size={11} />
              {parsed.tokens.map((t) => (
                <code key={t} className="ct-token">{t}</code>
              ))}
              applied · removed from the title on create
            </div>
          ) : null}
        </div>
        <Field error={errors.description}>
          <Editor value={description} onChange={setDescription} placeholder="Add details… Markdown and @mentions" minRows={3} compact onSubmit={() => void submit()} />
        </Field>
        <div className="ct-fields" role="group" aria-label="Task fields">
          {statuses.length ? (
            <StatusPicker value={statusId ?? statuses[0].id} statuses={statuses} onChange={setStatusId} variant="outline" showLabel />
          ) : (
            <Button size="sm" variant="outline" disabled icon="circle" className="field-btn">Status</Button>
          )}
          <PriorityPicker value={priority} onChange={setPriority} variant="outline" showLabel />
          <AssigneePicker value={assigneeId} onChange={setAssigneeId} variant="outline" showLabel members={bundle.data?.members ?? ws.members} />
          <LabelPicker value={labelIds} labels={labels} onChange={setLabelIds} variant="outline">
            {labelIds.length ? <LabelChips labelIds={labelIds} labels={labels} max={2} /> : <span className="row gap-1 muted"><Icon name="tag" size={14} /> Labels</span>}
          </LabelPicker>
          <DueDateButton value={dueDate} onChange={setDueDate} variant="outline" label="Due date" />
          <DatePicker value={startDate} onChange={setStartDate} variant="outline" placeholder="Start date" icon="play" className="field-btn" />
          <EstimateInput value={estimate} onChange={setEstimate} variant="outline" />
          <RecurrencePicker value={recurrence} onChange={setRecurrence} variant="outline" />
        </div>
        {errors.statusId || errors.assigneeId || errors.dueDate || errors.labelIds ? <div className="field-error">{errors.statusId || errors.assigneeId || errors.dueDate || errors.labelIds}</div> : null}
        <div className="ct-hints xs faint">
          <span>
            Type <code className="ct-token">!high</code> or <code className="ct-token">#{labels[0]?.name ?? 'Bug'}</code> in the title to set priority or labels
          </span>
          {project ? (
            <span className="ct-hint-project">
              Creating in <b>{project.name}</b>{me ? ` as ${me.name.split(' ')[0]}` : ''}
            </span>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
