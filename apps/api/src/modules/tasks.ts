import { Router, created, noContent } from '../lib/http.ts';
import { db, now, inList } from '../db/index.ts';
import { errors } from '../lib/errors.ts';
import { newId } from '../lib/crypto.ts';
import { requireProject, requireTask, filterWorkspaceMembers } from '../lib/access.ts';
import { taskFromRow, checklistFromRow, attachmentFromRow } from '../lib/serialize.ts';
import { logActivity, notify, extractMentions, taskAudience, taskLink } from '../lib/services.ts';
import { realtime } from '../lib/realtime.ts';
import { v, LIMITS, RELATION_TYPES, nextOccurrence, todayISO, PRIORITY_LABEL } from '../../../../packages/shared/src/index.ts';
import type { Priority, Recurrence, RelationType, Task, TaskDetail, StatusCategory } from '../../../../packages/shared/src/types.ts';

export const TASK_SELECT = `
  SELECT t.*, p.key AS project_key, p.name AS project_name, p.color AS project_color, p.workspace_id,
         s.name AS status_name, s.category AS status_category, s.color AS status_color,
         a.name AS assignee_name, a.avatar_url AS assignee_avatar,
         (SELECT group_concat(label_id) FROM task_labels tl WHERE tl.task_id = t.id) AS label_ids,
         (SELECT COUNT(*) FROM tasks st WHERE st.parent_id = t.id AND st.archived_at IS NULL) AS subtask_count,
         (SELECT COUNT(*) FROM tasks st JOIN task_statuses ss ON ss.id = st.status_id WHERE st.parent_id = t.id AND st.archived_at IS NULL AND ss.category IN ('done','cancelled')) AS subtask_done,
         (SELECT COUNT(*) FROM checklist_items ci WHERE ci.task_id = t.id) AS checklist_count,
         (SELECT COUNT(*) FROM checklist_items ci WHERE ci.task_id = t.id AND ci.done = 1) AS checklist_done,
         (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count,
         (SELECT COUNT(*) FROM attachments at WHERE at.task_id = t.id) AS attachment_count,
         (SELECT COALESCE(SUM(minutes), 0) FROM time_entries te WHERE te.task_id = t.id) AS time_spent
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  JOIN task_statuses s ON s.id = t.status_id
  LEFT JOIN users a ON a.id = t.assignee_id`;

export function loadTask(taskId: string): Task | null {
  const row = db.one(`${TASK_SELECT} WHERE t.id = ?`, [taskId]);
  return row ? taskFromRow(row) : null;
}

function workspaceOf(projectId: string): { workspace_id: string; slug: string; key: string } {
  return db.one<{ workspace_id: string; slug: string; key: string }>('SELECT p.workspace_id, p.key, w.slug FROM projects p JOIN workspaces w ON w.id = p.workspace_id WHERE p.id = ?', [projectId])!;
}

function broadcastTask(task: Task, kind: 'task.created' | 'task.updated') {
  const ws = workspaceOf(task.projectId);
  realtime.publish(ws.workspace_id, { type: kind, projectId: task.projectId, task });
}

const recurrenceSchema = v.object({
  freq: v.enum(['daily', 'weekly', 'monthly'] as const),
  interval: v.number({ int: true, min: 1, max: 365 }).default(1),
  weekdays: v.array(v.number({ int: true, min: 0, max: 6 }), { max: 7 }).optional(),
});

const priorityValues = [0, 1, 2, 3, 4] as const;

const createBody = v.object({
  title: v.string({ min: 1, max: LIMITS.titleMax }),
  description: v.string({ max: LIMITS.descriptionMax, trim: false }).default(''),
  statusId: v.string().optional(),
  priority: v.enum(priorityValues).default(0),
  assigneeId: v.string().nullable().optional(),
  parentId: v.string().nullable().optional(),
  startDate: v.string({ date: true }).nullable().optional(),
  dueDate: v.string({ date: true }).nullable().optional(),
  estimateMinutes: v.number({ int: true, min: 0, max: 100000 }).nullable().optional(),
  labelIds: v.array(v.string(), { max: 50 }).default([]),
  recurrence: recurrenceSchema.nullable().optional(),
  position: v.number().optional(),
});

export function createTaskInternal(input: {
  projectId: string;
  userId: string;
  title: string;
  description?: string;
  statusId?: string;
  priority?: Priority;
  assigneeId?: string | null;
  parentId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimateMinutes?: number | null;
  labelIds?: string[];
  recurrence?: Recurrence | null;
  position?: number;
  silent?: boolean;
}): Task {
  const ts = now();
  const id = newId();
  let statusId = input.statusId;
  if (statusId) {
    if (!db.one('SELECT 1 FROM task_statuses WHERE id = ? AND project_id = ?', [statusId, input.projectId])) throw errors.badRequest('Invalid status for this project');
  } else {
    const first = db.one<{ id: string }>(`SELECT id FROM task_statuses WHERE project_id = ? ORDER BY CASE category WHEN 'todo' THEN 0 WHEN 'backlog' THEN 1 ELSE 2 END, position LIMIT 1`, [input.projectId]);
    if (!first) throw errors.badRequest('Project has no statuses');
    statusId = first.id;
  }
  if (input.parentId) {
    const parent = db.one<{ project_id: string; parent_id: string | null }>('SELECT project_id, parent_id FROM tasks WHERE id = ?', [input.parentId]);
    if (!parent || parent.project_id !== input.projectId) throw errors.badRequest('Invalid parent task');
    if (parent.parent_id) throw errors.badRequest('Subtasks cannot have subtasks');
  }
  if (input.assigneeId) {
    const ws = workspaceOf(input.projectId);
    if (!db.one('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [ws.workspace_id, input.assigneeId])) throw errors.badRequest('Assignee is not a workspace member');
  }
  const status = db.one<{ category: StatusCategory }>('SELECT category FROM task_statuses WHERE id = ?', [statusId])!;
  const completedAt = status.category === 'done' || status.category === 'cancelled' ? ts : null;

  db.tx(() => {
    db.run('UPDATE projects SET task_counter = task_counter + 1 WHERE id = ?', [input.projectId]);
    const number = db.one<{ task_counter: number }>('SELECT task_counter FROM projects WHERE id = ?', [input.projectId])!.task_counter;
    let position = input.position;
    if (position === undefined) {
      const min = db.one<{ m: number | null }>('SELECT MIN(position) AS m FROM tasks WHERE status_id = ?', [statusId])!;
      position = (min.m ?? 1000) - 1000; // new tasks go to the top of the column
    }
    db.run(
      `INSERT INTO tasks (id, project_id, number, title, description, status_id, priority, assignee_id, reporter_id, parent_id, position, start_date, due_date, estimate_minutes, completed_at, recurrence, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, input.projectId, number, input.title, input.description || '', statusId, input.priority ?? 0, input.assigneeId ?? null, input.userId, input.parentId ?? null, position, input.startDate ?? null, input.dueDate ?? null, input.estimateMinutes ?? null, completedAt, input.recurrence ? JSON.stringify(input.recurrence) : null, ts, ts],
    );
    for (const lid of new Set(input.labelIds || [])) {
      if (db.one('SELECT 1 FROM labels WHERE id = ? AND project_id = ?', [lid, input.projectId])) db.run('INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?,?)', [id, lid]);
    }
    db.run('INSERT OR IGNORE INTO task_watchers (task_id, user_id) VALUES (?,?)', [id, input.userId]);
    if (input.assigneeId) db.run('INSERT OR IGNORE INTO task_watchers (task_id, user_id) VALUES (?,?)', [id, input.assigneeId]);
  });

  const task = loadTask(id)!;
  if (!input.silent) {
    const ws = workspaceOf(input.projectId);
    logActivity({ workspaceId: ws.workspace_id, projectId: input.projectId, taskId: id, actorId: input.userId, type: 'task.created', data: { title: task.title, key: task.key } });
    broadcastTask(task, 'task.created');
    const link = taskLink(ws.slug, ws.key, task.number);
    const actor = db.one<{ name: string }>('SELECT name FROM users WHERE id = ?', [input.userId])!;
    if (input.assigneeId && input.assigneeId !== input.userId) {
      notify({ userId: input.assigneeId, type: 'assigned', title: `${actor.name} assigned you ${task.key}`, body: task.title, link, actorId: input.userId, email: { subject: `[${task.key}] ${task.title}`, lines: [`${actor.name} assigned you a task: ${task.title}`] } });
    }
    for (const uid of filterWorkspaceMembers(ws.workspace_id, extractMentions(task.description))) {
      notify({ userId: uid, type: 'mentioned', title: `${actor.name} mentioned you in ${task.key}`, body: task.title, link, actorId: input.userId });
    }
    if (task.parentId) realtime.publish(ws.workspace_id, { type: 'task.detail_changed', projectId: task.projectId, taskId: task.parentId });
  }
  return task;
}

export function loadTaskDetail(taskId: string): TaskDetail {
  const task = loadTask(taskId);
  if (!task) throw errors.notFound('Task');
  const subtasks = db.all(`${TASK_SELECT} WHERE t.parent_id = ? AND t.archived_at IS NULL ORDER BY t.position, t.created_at`, [taskId]).map(taskFromRow);
  const checklist = db.all('SELECT * FROM checklist_items WHERE task_id = ? ORDER BY position', [taskId]).map(checklistFromRow);
  const relRows = db.all<Record<string, unknown>>(
    `SELECT r.id, r.type, r.source_task_id, r.target_task_id, t.id AS tid, t.title, t.number, t.status_id, t.project_id, p.key AS project_key, s.name AS status_name, s.category AS status_category, s.color AS status_color
     FROM task_relations r
     JOIN tasks t ON t.id = CASE WHEN r.source_task_id = ? THEN r.target_task_id ELSE r.source_task_id END
     JOIN projects p ON p.id = t.project_id JOIN task_statuses s ON s.id = t.status_id
     WHERE r.source_task_id = ? OR r.target_task_id = ?`,
    [taskId, taskId, taskId],
  );
  const relations = relRows.map((r) => {
    const direct = r.source_task_id === taskId;
    const type = r.type as RelationType;
    const shown = direct ? type : RELATION_TYPES.find((x) => x.value === type)!.inverse;
    return {
      id: r.id as string,
      type: shown,
      task: { id: r.tid as string, key: `${r.project_key}-${r.number}`, title: r.title as string, statusId: r.status_id as string, statusName: r.status_name as string, statusCategory: r.status_category as StatusCategory, statusColor: r.status_color as string, projectId: r.project_id as string },
    };
  });
  const attachments = db.all(`SELECT at.*, u.id AS uploader_id, u.name AS uploader_name, u.avatar_url AS uploader_avatar_url FROM attachments at LEFT JOIN users u ON u.id = at.uploader_id WHERE at.task_id = ? ORDER BY at.created_at`, [taskId]).map(attachmentFromRow);
  const watcherIds = db.all<{ user_id: string }>('SELECT user_id FROM task_watchers WHERE task_id = ?', [taskId]).map((w) => w.user_id);
  const parent = task.parentId ? db.one<{ id: string; title: string; number: number; key: string }>('SELECT t.id, t.title, t.number, p.key FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = ?', [task.parentId]) : null;
  return { ...task, subtasks, checklist, relations, attachments, watcherIds, parent: parent ? { id: parent.id, key: `${parent.key}-${parent.number}`, title: parent.title } : null };
}

/** Apply a field patch to a task. Returns the updated task and a list of changes for the activity log. */
export function updateTaskInternal(userId: string, taskId: string, patch: Record<string, unknown>): { task: Task; changes: Record<string, { from: unknown; to: unknown }> } {
  const before = loadTask(taskId);
  if (!before) throw errors.notFound('Task');
  const ws = workspaceOf(before.projectId);
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const ts = now();

  const simple: Record<string, string> = { title: 'title', description: 'description', priority: 'priority', startDate: 'start_date', dueDate: 'due_date', estimateMinutes: 'estimate_minutes', parentId: 'parent_id' };
  for (const [field, col] of Object.entries(simple)) {
    if (patch[field] === undefined) continue;
    const from = (before as unknown as Record<string, unknown>)[field];
    const to = patch[field];
    if (from === to) continue;
    if (field === 'parentId' && to) {
      const parent = db.one<{ project_id: string; parent_id: string | null }>('SELECT project_id, parent_id FROM tasks WHERE id = ?', [to as string]);
      if (!parent || parent.project_id !== before.projectId || parent.parent_id || to === taskId) throw errors.badRequest('Invalid parent task');
      if (before.subtaskCount > 0) throw errors.badRequest('A task with subtasks cannot become a subtask');
    }
    sets.push(`${col} = ?`);
    params.push(to as string | number | null);
    changes[field] = { from, to };
  }
  if (patch.assigneeId !== undefined && patch.assigneeId !== before.assigneeId) {
    if (patch.assigneeId && !db.one('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [ws.workspace_id, patch.assigneeId as string])) throw errors.badRequest('Assignee is not a workspace member');
    sets.push('assignee_id = ?');
    params.push((patch.assigneeId as string | null) ?? null);
    changes.assigneeId = { from: before.assigneeId, to: patch.assigneeId };
  }
  if (patch.recurrence !== undefined) {
    sets.push('recurrence = ?');
    params.push(patch.recurrence ? JSON.stringify(patch.recurrence) : null);
    changes.recurrence = { from: before.recurrence, to: patch.recurrence };
  }
  if (patch.archived !== undefined) {
    const archivedAt = patch.archived ? ts : null;
    if (Boolean(before.archivedAt) !== Boolean(patch.archived)) {
      sets.push('archived_at = ?');
      params.push(archivedAt);
      changes.archived = { from: Boolean(before.archivedAt), to: Boolean(patch.archived) };
    }
  }
  let statusChanged = false;
  if (patch.statusId !== undefined && patch.statusId !== before.statusId) {
    const status = db.one<{ id: string; category: StatusCategory; name: string }>('SELECT id, category, name FROM task_statuses WHERE id = ? AND project_id = ?', [patch.statusId as string, before.projectId]);
    if (!status) throw errors.badRequest('Invalid status for this project');
    sets.push('status_id = ?');
    params.push(status.id);
    const doneLike = status.category === 'done' || status.category === 'cancelled';
    sets.push('completed_at = ?');
    params.push(doneLike ? before.completedAt || ts : null);
    changes.statusId = { from: before.statusId, to: status.id };
    changes.status = { from: before.statusName, to: status.name };
    statusChanged = true;
    if (patch.position === undefined) {
      const min = db.one<{ m: number | null }>('SELECT MIN(position) AS m FROM tasks WHERE status_id = ?', [status.id])!;
      sets.push('position = ?');
      params.push((min.m ?? 1000) - 1000);
    }
  }
  if (patch.position !== undefined && typeof patch.position === 'number') {
    sets.push('position = ?');
    params.push(patch.position);
  }

  db.tx(() => {
    if (sets.length) {
      sets.push('updated_at = ?');
      params.push(ts);
      db.run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, [...params, taskId]);
    }
    if (Array.isArray(patch.labelIds)) {
      const want = new Set(patch.labelIds as string[]);
      const have = new Set(before.labelIds);
      const same = want.size === have.size && [...want].every((l) => have.has(l));
      if (!same) {
        db.run('DELETE FROM task_labels WHERE task_id = ?', [taskId]);
        for (const lid of want) {
          if (db.one('SELECT 1 FROM labels WHERE id = ? AND project_id = ?', [lid, before.projectId])) db.run('INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?,?)', [taskId, lid]);
        }
        db.run('UPDATE tasks SET updated_at = ? WHERE id = ?', [ts, taskId]);
        changes.labelIds = { from: before.labelIds, to: [...want] };
      }
    }
    if (changes.assigneeId?.to) db.run('INSERT OR IGNORE INTO task_watchers (task_id, user_id) VALUES (?,?)', [taskId, changes.assigneeId.to as string]);
    db.run('INSERT OR IGNORE INTO task_watchers (task_id, user_id) VALUES (?,?)', [taskId, userId]);
  });

  const task = loadTask(taskId)!;
  if (Object.keys(changes).length) {
    const actor = db.one<{ name: string }>('SELECT name FROM users WHERE id = ?', [userId])!;
    const link = taskLink(ws.slug, ws.key, task.number);
    const type = statusChanged ? (task.statusCategory === 'done' ? 'task.completed' : 'task.moved') : changes.assigneeId ? 'task.assigned' : 'task.updated';
    const logData: Record<string, unknown> = { key: task.key, title: task.title, changes: summarizeChanges(changes) };
    logActivity({ workspaceId: ws.workspace_id, projectId: task.projectId, taskId, actorId: userId, type, data: logData });
    broadcastTask(task, 'task.updated');
    if (changes.assigneeId?.to && changes.assigneeId.to !== userId) {
      notify({ userId: changes.assigneeId.to as string, type: 'assigned', title: `${actor.name} assigned you ${task.key}`, body: task.title, link, actorId: userId, email: { subject: `[${task.key}] ${task.title}`, lines: [`${actor.name} assigned you a task: ${task.title}`] } });
    }
    if (statusChanged) {
      for (const uid of taskAudience(taskId, userId)) {
        notify({ userId: uid, type: 'status_changed', title: `${actor.name} moved ${task.key} to ${task.statusName}`, body: task.title, link, actorId: userId });
      }
      // Recurring task completed → schedule the next occurrence
      if (task.recurrence && (task.statusCategory === 'done' || task.statusCategory === 'cancelled') && !task.parentId) {
        const base = task.dueDate || todayISO();
        const nextDue = nextOccurrence(task.recurrence, base);
        const span = task.startDate && task.dueDate ? Math.round((Date.parse(task.dueDate) - Date.parse(task.startDate)) / 86400000) : null;
        const nextStart = span !== null ? new Date(Date.parse(nextDue) - span * 86400000).toISOString().slice(0, 10) : null;
        const next = createTaskInternal({ projectId: task.projectId, userId, title: task.title, description: task.description, priority: task.priority, assigneeId: task.assigneeId, startDate: nextStart, dueDate: nextDue, estimateMinutes: task.estimateMinutes, labelIds: task.labelIds, recurrence: task.recurrence });
        db.run('UPDATE tasks SET recurrence = NULL WHERE id = ?', [taskId]);
        void next;
      }
    }
    if (changes.description) {
      const beforeMentions = new Set(extractMentions(String(changes.description.from || '')));
      for (const uid of filterWorkspaceMembers(ws.workspace_id, extractMentions(task.description))) {
        if (!beforeMentions.has(uid)) notify({ userId: uid, type: 'mentioned', title: `${actor.name} mentioned you in ${task.key}`, body: task.title, link, actorId: userId });
      }
    }
    if (task.parentId) realtime.publish(ws.workspace_id, { type: 'task.detail_changed', projectId: task.projectId, taskId: task.parentId });
    if (changes.parentId?.from) realtime.publish(ws.workspace_id, { type: 'task.detail_changed', projectId: task.projectId, taskId: changes.parentId.from as string });
  }
  return { task, changes };
}

function summarizeChanges(changes: Record<string, { from: unknown; to: unknown }>) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, c] of Object.entries(changes)) {
    if (k === 'statusId' || k === 'description') continue; // description diffs are noisy; status is logged by name
    if (k === 'priority') out[k] = { from: PRIORITY_LABEL[c.from as Priority], to: PRIORITY_LABEL[c.to as Priority] };
    else out[k] = c;
  }
  if (changes.description) out.description = { from: null, to: 'edited' };
  return out;
}

export const tasksRouter = new Router('/api');

tasksRouter.get('/projects/:id/tasks', (ctx) => {
  const user = ctx.requireUser();
  const { project } = requireProject(user.id, ctx.params.id);
  const includeArchived = ctx.query.get('archived') === 'true';
  const rows = db.all(`${TASK_SELECT} WHERE t.project_id = ? ${includeArchived ? '' : 'AND t.archived_at IS NULL'} ORDER BY t.position, t.created_at`, [project.id]);
  return rows.map(taskFromRow);
});

tasksRouter.post('/projects/:id/tasks', async (ctx) => {
  const user = ctx.requireUser();
  const { project } = requireProject(user.id, ctx.params.id, 'edit');
  const body = await ctx.json(createBody);
  const task = createTaskInternal({ projectId: project.id, userId: user.id, ...body });
  return created(task);
});

tasksRouter.get('/tasks/by-key/:key', (ctx) => {
  const user = ctx.requireUser();
  const m = /^([A-Z][A-Z0-9]{1,5})-(\d+)$/i.exec(ctx.params.key);
  if (!m) throw errors.notFound('Task');
  const workspaceId = ctx.query.get('workspace');
  const row = db.one<{ id: string }>(
    `SELECT t.id FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.key = ? AND t.number = ? ${workspaceId ? 'AND p.workspace_id = ?' : ''} ORDER BY t.created_at DESC LIMIT 1`,
    workspaceId ? [m[1].toUpperCase(), Number(m[2]), workspaceId] : [m[1].toUpperCase(), Number(m[2])],
  );
  if (!row) throw errors.notFound('Task');
  requireTask(user.id, row.id);
  return loadTaskDetail(row.id);
});

tasksRouter.get('/tasks/:id', (ctx) => {
  const user = ctx.requireUser();
  requireTask(user.id, ctx.params.id);
  return loadTaskDetail(ctx.params.id);
});

const patchBody = v.object({
  title: v.string({ min: 1, max: LIMITS.titleMax }).optional(),
  description: v.string({ max: LIMITS.descriptionMax, trim: false }).optional(),
  statusId: v.string().optional(),
  priority: v.enum(priorityValues).optional(),
  assigneeId: v.string().nullable().optional(),
  parentId: v.string().nullable().optional(),
  startDate: v.string({ date: true }).nullable().optional(),
  dueDate: v.string({ date: true }).nullable().optional(),
  estimateMinutes: v.number({ int: true, min: 0, max: 100000 }).nullable().optional(),
  labelIds: v.array(v.string(), { max: 50 }).optional(),
  recurrence: recurrenceSchema.nullable().optional(),
  archived: v.boolean().optional(),
  position: v.number().optional(),
});

tasksRouter.patch('/tasks/:id', async (ctx) => {
  const user = ctx.requireUser();
  requireTask(user.id, ctx.params.id, 'edit');
  const body = await ctx.json(patchBody);
  return updateTaskInternal(user.id, ctx.params.id, body).task;
});

/** Move within/between columns. Position is computed server-side from neighbours to avoid races. */
tasksRouter.post('/tasks/:id/move', async (ctx) => {
  const user = ctx.requireUser();
  const { task } = requireTask(user.id, ctx.params.id, 'edit');
  const body = await ctx.json(v.object({ statusId: v.string().optional(), beforeId: v.string().nullable().optional(), afterId: v.string().nullable().optional(), position: v.number().optional() }));
  let position = body.position;
  if (position === undefined) {
    const statusId = body.statusId || task.status_id;
    const before = body.beforeId ? db.one<{ position: number }>('SELECT position FROM tasks WHERE id = ? AND status_id = ?', [body.beforeId, statusId]) : null; // item above
    const after = body.afterId ? db.one<{ position: number }>('SELECT position FROM tasks WHERE id = ? AND status_id = ?', [body.afterId, statusId]) : null; // item below
    if (before && after) position = (before.position + after.position) / 2;
    else if (before) position = before.position + 1000;
    else if (after) position = after.position - 1000;
    else position = 1000;
  }
  return updateTaskInternal(user.id, task.id, { statusId: body.statusId, position }).task;
});

tasksRouter.post('/tasks/bulk', async (ctx) => {
  const user = ctx.requireUser();
  const body = await ctx.json(v.object({ taskIds: v.array(v.string(), { max: 200 }), patch: patchBody }));
  const out: Task[] = [];
  for (const id of body.taskIds) {
    requireTask(user.id, id, 'edit');
    out.push(updateTaskInternal(user.id, id, body.patch).task);
  }
  return out;
});

tasksRouter.post('/tasks/bulk-delete', async (ctx) => {
  const user = ctx.requireUser();
  const body = await ctx.json(v.object({ taskIds: v.array(v.string(), { max: 200 }) }));
  for (const id of body.taskIds) deleteTask(user.id, id);
  return noContent();
});

function deleteTask(userId: string, taskId: string) {
  const { task, access } = requireTask(userId, taskId, 'edit');
  const t = loadTask(taskId)!;
  const ws = workspaceOf(task.project_id);
  db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
  logActivity({ workspaceId: access.project.workspace_id, projectId: task.project_id, actorId: userId, type: 'task.deleted', data: { key: t.key, title: t.title } });
  realtime.publish(ws.workspace_id, { type: 'task.deleted', projectId: task.project_id, taskId });
  if (task.parent_id) realtime.publish(ws.workspace_id, { type: 'task.detail_changed', projectId: task.project_id, taskId: task.parent_id });
}

tasksRouter.delete('/tasks/:id', (ctx) => {
  const user = ctx.requireUser();
  deleteTask(user.id, ctx.params.id);
  return noContent();
});

tasksRouter.post('/tasks/:id/duplicate', (ctx) => {
  const user = ctx.requireUser();
  requireTask(user.id, ctx.params.id, 'edit');
  const src = loadTaskDetail(ctx.params.id);
  const copy = createTaskInternal({ projectId: src.projectId, userId: user.id, title: `${src.title} (copy)`, description: src.description, statusId: src.statusId, priority: src.priority, assigneeId: src.assigneeId, parentId: src.parentId, startDate: src.startDate, dueDate: src.dueDate, estimateMinutes: src.estimateMinutes, labelIds: src.labelIds, recurrence: src.recurrence });
  db.tx(() => src.checklist.forEach((c) => db.run('INSERT INTO checklist_items (id, task_id, text, done, position) VALUES (?,?,?,?,?)', [newId(), copy.id, c.text, 0, c.position])));
  return created(loadTask(copy.id));
});

// ---- Watchers ----
tasksRouter.post('/tasks/:id/watch', (ctx) => {
  const user = ctx.requireUser();
  requireTask(user.id, ctx.params.id);
  db.run('INSERT OR IGNORE INTO task_watchers (task_id, user_id) VALUES (?,?)', [ctx.params.id, user.id]);
  return noContent();
});
tasksRouter.delete('/tasks/:id/watch', (ctx) => {
  const user = ctx.requireUser();
  requireTask(user.id, ctx.params.id);
  db.run('DELETE FROM task_watchers WHERE task_id = ? AND user_id = ?', [ctx.params.id, user.id]);
  return noContent();
});

// ---- Checklist ----
function touch(taskId: string, projectId: string) {
  db.run('UPDATE tasks SET updated_at = ? WHERE id = ?', [now(), taskId]);
  const ws = workspaceOf(projectId);
  realtime.publish(ws.workspace_id, { type: 'task.detail_changed', projectId, taskId });
  const t = loadTask(taskId);
  if (t) realtime.publish(ws.workspace_id, { type: 'task.updated', projectId, task: t });
}

tasksRouter.post('/tasks/:id/checklist', async (ctx) => {
  const user = ctx.requireUser();
  const { task } = requireTask(user.id, ctx.params.id, 'edit');
  const body = await ctx.json(v.object({ text: v.string({ min: 1, max: 500 }) }));
  const max = db.one<{ m: number | null }>('SELECT MAX(position) AS m FROM checklist_items WHERE task_id = ?', [task.id])!;
  const id = newId();
  db.run('INSERT INTO checklist_items (id, task_id, text, done, position) VALUES (?,?,?,?,?)', [id, task.id, body.text, 0, (max.m || 0) + 1000]);
  touch(task.id, task.project_id);
  return created(checklistFromRow(db.one('SELECT * FROM checklist_items WHERE id = ?', [id])!));
});

tasksRouter.patch('/checklist/:itemId', async (ctx) => {
  const user = ctx.requireUser();
  const item = db.one<{ task_id: string }>('SELECT task_id FROM checklist_items WHERE id = ?', [ctx.params.itemId]);
  if (!item) throw errors.notFound('Checklist item');
  const { task } = requireTask(user.id, item.task_id, 'edit');
  const body = await ctx.json(v.object({ text: v.string({ min: 1, max: 500 }).optional(), done: v.boolean().optional(), position: v.number().optional() }));
  if (body.text !== undefined) db.run('UPDATE checklist_items SET text = ? WHERE id = ?', [body.text, ctx.params.itemId]);
  if (body.done !== undefined) db.run('UPDATE checklist_items SET done = ? WHERE id = ?', [body.done ? 1 : 0, ctx.params.itemId]);
  if (body.position !== undefined) db.run('UPDATE checklist_items SET position = ? WHERE id = ?', [body.position, ctx.params.itemId]);
  touch(task.id, task.project_id);
  return checklistFromRow(db.one('SELECT * FROM checklist_items WHERE id = ?', [ctx.params.itemId])!);
});

tasksRouter.delete('/checklist/:itemId', (ctx) => {
  const user = ctx.requireUser();
  const item = db.one<{ task_id: string }>('SELECT task_id FROM checklist_items WHERE id = ?', [ctx.params.itemId]);
  if (!item) throw errors.notFound('Checklist item');
  const { task } = requireTask(user.id, item.task_id, 'edit');
  db.run('DELETE FROM checklist_items WHERE id = ?', [ctx.params.itemId]);
  touch(task.id, task.project_id);
  return noContent();
});

// ---- Relations ----
tasksRouter.post('/tasks/:id/relations', async (ctx) => {
  const user = ctx.requireUser();
  const { task } = requireTask(user.id, ctx.params.id, 'edit');
  const body = await ctx.json(v.object({ type: v.enum(['blocks', 'blocked_by', 'relates', 'duplicates'] as const), targetTaskId: v.string() }));
  if (body.targetTaskId === task.id) throw errors.badRequest('A task cannot relate to itself');
  requireTask(user.id, body.targetTaskId);
  // Store "blocked_by" as the inverse "blocks" relation so each pair is stored once.
  let source = task.id;
  let target = body.targetTaskId;
  let type: RelationType = body.type;
  if (type === 'blocked_by') {
    type = 'blocks';
    source = body.targetTaskId;
    target = task.id;
  }
  const exists = db.one('SELECT 1 FROM task_relations WHERE type = ? AND ((source_task_id = ? AND target_task_id = ?) OR (source_task_id = ? AND target_task_id = ?))', [type, source, target, target, source]);
  if (exists) throw errors.conflict('This relation already exists');
  const id = newId();
  db.run('INSERT INTO task_relations (id, source_task_id, target_task_id, type, created_at) VALUES (?,?,?,?,?)', [id, source, target, type, now()]);
  touch(task.id, task.project_id);
  const other = db.one<{ project_id: string }>('SELECT project_id FROM tasks WHERE id = ?', [body.targetTaskId])!;
  touch(body.targetTaskId, other.project_id);
  return created({ id });
});

tasksRouter.delete('/relations/:relId', (ctx) => {
  const user = ctx.requireUser();
  const rel = db.one<{ source_task_id: string; target_task_id: string }>('SELECT source_task_id, target_task_id FROM task_relations WHERE id = ?', [ctx.params.relId]);
  if (!rel) throw errors.notFound('Relation');
  const { task } = requireTask(user.id, rel.source_task_id, 'edit');
  db.run('DELETE FROM task_relations WHERE id = ?', [ctx.params.relId]);
  touch(task.id, task.project_id);
  const other = db.one<{ project_id: string }>('SELECT project_id FROM tasks WHERE id = ?', [rel.target_task_id]);
  if (other) touch(rel.target_task_id, other.project_id);
  return noContent();
});

// ---- Typing indicator (comments) ----
tasksRouter.post('/tasks/:id/typing', (ctx) => {
  const user = ctx.requireUser();
  const { task, access } = requireTask(user.id, ctx.params.id);
  const me = db.one<{ name: string }>('SELECT name FROM users WHERE id = ?', [user.id])!;
  realtime.publish(access.project.workspace_id, { type: 'typing', taskId: task.id, userId: user.id, name: me.name }, { excludeUserId: user.id });
  return noContent();
});

export { inList };
