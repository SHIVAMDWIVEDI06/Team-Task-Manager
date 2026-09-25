import { Router, created, noContent } from '../lib/http.ts';
import { db, now } from '../db/index.ts';
import { errors } from '../lib/errors.ts';
import { newId } from '../lib/crypto.ts';
import { requireMember, requireProject, VISIBLE_PROJECTS_SQL } from '../lib/access.ts';
import { projectFromRow, statusFromRow, labelFromRow, memberFromRow, viewFromRow } from '../lib/serialize.ts';
import { logActivity } from '../lib/services.ts';
import { realtime } from '../lib/realtime.ts';
import { v, LIMITS, DEFAULT_STATUSES, DEFAULT_LABELS, PROJECT_COLORS } from '../../../../packages/shared/src/index.ts';
import type { StatusCategory } from '../../../../packages/shared/src/types.ts';
import { createTaskInternal } from './tasks.ts';

export const PROJECT_SELECT = `SELECT p.*, l.name AS lead_name, l.avatar_url AS lead_avatar,
  (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.archived_at IS NULL AND t.parent_id IS NULL) AS task_count,
  (SELECT COUNT(*) FROM tasks t JOIN task_statuses s ON s.id = t.status_id WHERE t.project_id = p.id AND t.archived_at IS NULL AND t.parent_id IS NULL AND s.category IN ('done','cancelled')) AS done_count
  FROM projects p LEFT JOIN users l ON l.id = p.lead_id`;

const KEY_RE = /^[A-Z][A-Z0-9]{1,5}$/;

export function createProjectInternal(input: {
  workspaceId: string;
  userId: string;
  name: string;
  key: string;
  description?: string;
  color?: string;
  icon?: string;
  visibility?: 'public' | 'private';
  leadId?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  seedSample?: boolean;
}) {
  const id = newId();
  const ts = now();
  const key = input.key.toUpperCase();
  if (!KEY_RE.test(key)) throw errors.badRequest('Project key must be 2–6 uppercase letters/digits, starting with a letter');
  if (db.one('SELECT 1 FROM projects WHERE workspace_id = ? AND key = ?', [input.workspaceId, key])) throw errors.conflict(`Project key ${key} is already used in this workspace`);
  if (input.leadId && !db.one('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [input.workspaceId, input.leadId])) throw errors.badRequest('Lead must be a workspace member');
  const statusIds: Record<string, string> = {};
  db.tx(() => {
    db.run(
      `INSERT INTO projects (id, workspace_id, name, key, description, color, icon, state, visibility, lead_id, start_date, target_date, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, input.workspaceId, input.name, key, input.description || '', input.color || PROJECT_COLORS[0], input.icon || '◆', 'active', input.visibility || 'public', input.leadId ?? input.userId, input.startDate ?? null, input.targetDate ?? null, ts, ts],
    );
    DEFAULT_STATUSES.forEach((s, i) => {
      const sid = newId();
      statusIds[s.category + ':' + s.name] = sid;
      db.run('INSERT INTO task_statuses (id, project_id, name, color, category, position) VALUES (?,?,?,?,?,?)', [sid, id, s.name, s.color, s.category, (i + 1) * 1000]);
    });
    DEFAULT_LABELS.forEach((l) => db.run('INSERT INTO labels (id, project_id, name, color) VALUES (?,?,?,?)', [newId(), id, l.name, l.color]));
    if (input.visibility === 'private') db.run('INSERT INTO project_members (project_id, user_id, added_at) VALUES (?,?,?)', [id, input.userId, ts]);
    if (input.seedSample) seedSampleTasks(id, input.userId, statusIds);
  });
  logActivity({ workspaceId: input.workspaceId, projectId: id, actorId: input.userId, type: 'project.created', data: { name: input.name, key } });
  return id;
}

function seedSampleTasks(projectId: string, userId: string, statusIds: Record<string, string>) {
  const todo = statusIds['todo:Todo'];
  const inProgress = statusIds['in_progress:In Progress'];
  const done = statusIds['done:Done'];
  const labels = db.all<{ id: string; name: string }>('SELECT id, name FROM labels WHERE project_id = ?', [projectId]);
  const label = (n: string) => labels.find((l) => l.name === n)?.id;
  const today = new Date();
  const d = (offset: number) => {
    const x = new Date(today);
    x.setDate(x.getDate() + offset);
    return x.toISOString().slice(0, 10);
  };
  const samples = [
    { title: 'Welcome to TeamTask 👋', description: 'This is a sample task. Open it to see the full task view: description, subtasks, checklist, comments, attachments and activity.\n\n- Press **C** anywhere to create a task\n- Press **⌘K** / **Ctrl+K** for the command palette\n- Drag cards between columns on the Board', status: inProgress, priority: 3, due: d(2), labels: [label('Documentation')] },
    { title: 'Try the Board, List, Calendar and Timeline views', description: 'Switch views from the tabs at the top of the project.', status: todo, priority: 2, due: d(5), labels: [label('Improvement')] },
    { title: 'Invite your teammates', description: 'Go to **Workspace settings → Members** to invite people by email.', status: todo, priority: 4, due: d(1), labels: [label('Feature')] },
    { title: 'Customize workflow statuses', description: 'Project settings let you add, rename, reorder and recolor statuses.', status: todo, priority: 1, due: null, labels: [] },
    { title: 'Set up your first project', description: '', status: done, priority: 2, due: d(-1), labels: [label('Feature')] },
  ];
  for (const s of samples) {
    const t = createTaskInternal({ projectId, userId, title: s.title, description: s.description, statusId: s.status, priority: s.priority as 0 | 1 | 2 | 3 | 4, assigneeId: userId, dueDate: s.due, labelIds: s.labels.filter(Boolean) as string[], silent: true });
    if (s.title.startsWith('Welcome')) {
      ['Open this task', 'Add a comment with an @mention', 'Drag it to Done'].forEach((text, i) =>
        db.run('INSERT INTO checklist_items (id, task_id, text, done, position) VALUES (?,?,?,?,?)', [newId(), t.id, text, i === 0 ? 1 : 0, (i + 1) * 1000]),
      );
      createTaskInternal({ projectId, userId, title: 'A sample subtask', statusId: todo, priority: 0, parentId: t.id, silent: true });
    }
  }
}

export const projectsRouter = new Router('/api');

projectsRouter.get('/workspaces/:id/projects', (ctx) => {
  const user = ctx.requireUser();
  requireMember(user.id, ctx.params.id);
  const includeArchived = ctx.query.get('archived') === 'true';
  const rows = db.all(
    `${PROJECT_SELECT} WHERE p.workspace_id = ? AND ${VISIBLE_PROJECTS_SQL} ${includeArchived ? '' : `AND p.state = 'active'`} ORDER BY p.created_at ASC`,
    [ctx.params.id, user.id, user.id],
  );
  const members = db.all<{ project_id: string; user_id: string }>('SELECT project_id, user_id FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = ?)', [ctx.params.id]);
  return rows.map((r) => ({ ...projectFromRow(r), memberIds: members.filter((m) => m.project_id === r.id).map((m) => m.user_id) }));
});

const projectBody = v.object({
  name: v.string({ min: 1, max: LIMITS.nameMax }),
  key: v.string({ min: LIMITS.keyMin, max: LIMITS.keyMax }),
  description: v.string({ max: 2000 }).default(''),
  color: v.string({ pattern: /^#[0-9a-fA-F]{6}$/ }).optional(),
  icon: v.string({ max: 4 }).optional(),
  visibility: v.enum(['public', 'private'] as const).default('public'),
  leadId: v.string().nullable().optional(),
  startDate: v.string({ date: true }).nullable().optional(),
  targetDate: v.string({ date: true }).nullable().optional(),
  withSampleTasks: v.boolean().default(false),
});

projectsRouter.post('/workspaces/:id/projects', async (ctx) => {
  const user = ctx.requireUser();
  requireMember(user.id, ctx.params.id, 'member');
  const body = await ctx.json(projectBody);
  const id = createProjectInternal({ workspaceId: ctx.params.id, userId: user.id, ...body, seedSample: body.withSampleTasks });
  const row = projectFromRow(db.one(`${PROJECT_SELECT} WHERE p.id = ?`, [id])!);
  realtime.publish(ctx.params.id, { type: 'project.updated', project: row });
  return created(row);
});

/** Everything the client needs to render a project: project, statuses, labels, members, views. */
projectsRouter.get('/projects/:id/bundle', (ctx) => {
  const user = ctx.requireUser();
  const { project } = requireProject(user.id, ctx.params.id);
  const projectRow = db.one(`${PROJECT_SELECT} WHERE p.id = ?`, [project.id])!;
  const memberIds = db.all<{ user_id: string }>('SELECT user_id FROM project_members WHERE project_id = ?', [project.id]).map((m) => m.user_id);
  return {
    project: { ...projectFromRow(projectRow), memberIds },
    statuses: db.all('SELECT * FROM task_statuses WHERE project_id = ? ORDER BY position', [project.id]).map(statusFromRow),
    labels: db.all('SELECT * FROM labels WHERE project_id = ? ORDER BY name COLLATE NOCASE', [project.id]).map(labelFromRow),
    members: db
      .all(
        `SELECT wm.*, u.email, u.name, u.avatar_url, u.timezone, u.created_at, u.last_active_at FROM workspace_members wm JOIN users u ON u.id = wm.user_id WHERE wm.workspace_id = ? ORDER BY u.name COLLATE NOCASE`,
        [project.workspace_id],
      )
      .map(memberFromRow),
    views: db.all('SELECT * FROM saved_views WHERE project_id = ? AND (user_id IS NULL OR user_id = ?) ORDER BY created_at', [project.id, user.id]).map(viewFromRow),
  };
});

projectsRouter.get('/projects/:id', (ctx) => {
  const user = ctx.requireUser();
  const { project } = requireProject(user.id, ctx.params.id);
  return projectFromRow(db.one(`${PROJECT_SELECT} WHERE p.id = ?`, [project.id])!);
});

projectsRouter.patch('/projects/:id', async (ctx) => {
  const user = ctx.requireUser();
  const { project } = requireProject(user.id, ctx.params.id, 'manage');
  const body = await ctx.json(
    v.object({
      name: v.string({ min: 1, max: LIMITS.nameMax }).optional(),
      key: v.string({ min: LIMITS.keyMin, max: LIMITS.keyMax }).optional(),
      description: v.string({ max: 2000 }).optional(),
      color: v.string({ pattern: /^#[0-9a-fA-F]{6}$/ }).optional(),
      icon: v.string({ max: 4 }).optional(),
      visibility: v.enum(['public', 'private'] as const).optional(),
      state: v.enum(['active', 'archived'] as const).optional(),
      leadId: v.string().nullable().optional(),
      startDate: v.string({ date: true }).nullable().optional(),
      targetDate: v.string({ date: true }).nullable().optional(),
    }),
  );
  if (body.leadId && !db.one('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [project.workspace_id, body.leadId])) throw errors.badRequest('Lead must be a workspace member');
  const map: Record<string, string> = { name: 'name', key: 'key', description: 'description', color: 'color', icon: 'icon', visibility: 'visibility', state: 'state', leadId: 'lead_id', startDate: 'start_date', targetDate: 'target_date' };
  const sets: string[] = [];
  const params: (string | null)[] = [];
  for (const [k, col] of Object.entries(map)) {
    const val = (body as Record<string, unknown>)[k];
    if (val === undefined) continue;
    if (k === 'key') {
      const key = String(val).toUpperCase();
      if (!KEY_RE.test(key)) throw errors.badRequest('Invalid project key');
      if (db.one('SELECT 1 FROM projects WHERE workspace_id = ? AND key = ? AND id != ?', [project.workspace_id, key, project.id])) throw errors.conflict('Key already in use');
      sets.push(`${col} = ?`);
      params.push(key);
    } else {
      sets.push(`${col} = ?`);
      params.push(val as string | null);
    }
  }
  if (sets.length) {
    sets.push('updated_at = ?');
    params.push(now());
    db.run(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, [...params, project.id]);
    if (body.visibility === 'private') {
      db.run('INSERT OR IGNORE INTO project_members (project_id, user_id, added_at) VALUES (?,?,?)', [project.id, user.id, now()]);
    }
    logActivity({ workspaceId: project.workspace_id, projectId: project.id, actorId: user.id, type: body.state === 'archived' ? 'project.archived' : 'project.updated', data: body });
  }
  const row = projectFromRow(db.one(`${PROJECT_SELECT} WHERE p.id = ?`, [project.id])!);
  realtime.publish(project.workspace_id, { type: 'project.updated', project: row });
  return row;
});

projectsRouter.delete('/projects/:id', (ctx) => {
  const user = ctx.requireUser();
  const { project } = requireProject(user.id, ctx.params.id, 'manage');
  db.run('DELETE FROM projects WHERE id = ?', [project.id]);
  logActivity({ workspaceId: project.workspace_id, actorId: user.id, type: 'project.deleted', data: { name: project.name, key: project.key } });
  realtime.publish(project.workspace_id, { type: 'project.deleted', projectId: project.id });
  return noContent();
});

// ---- Project members (for private projects) ----
projectsRouter.put('/projects/:id/members', async (ctx) => {
  const user = ctx.requireUser();
  const { project } = requireProject(user.id, ctx.params.id, 'manage');
  const body = await ctx.json(v.object({ userIds: v.array(v.string(), { max: 500 }) }));
  db.tx(() => {
    db.run('DELETE FROM project_members WHERE project_id = ?', [project.id]);
    for (const uid of new Set([...body.userIds, user.id])) {
      if (db.one('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [project.workspace_id, uid])) {
        db.run('INSERT INTO project_members (project_id, user_id, added_at) VALUES (?,?,?)', [project.id, uid, now()]);
      }
    }
  });
  realtime.publish(project.workspace_id, { type: 'project.meta_changed', projectId: project.id });
  return noContent();
});

// ---- Statuses ----
const statusBody = v.object({
  name: v.string({ min: 1, max: 40 }),
  color: v.string({ pattern: /^#[0-9a-fA-F]{6}$/ }).optional(),
  category: v.enum(['backlog', 'todo', 'in_progress', 'done', 'cancelled'] as const).optional(),
});

projectsRouter.post('/projects/:id/statuses', async (ctx) => {
  const user = ctx.requireUser();
  const { project } = requireProject(user.id, ctx.params.id, 'manage');
  const body = await ctx.json(statusBody);
  const max = db.one<{ m: number | null }>('SELECT MAX(position) AS m FROM task_statuses WHERE project_id = ?', [project.id])!;
  const id = newId();
  db.run('INSERT INTO task_statuses (id, project_id, name, color, category, position) VALUES (?,?,?,?,?,?)', [id, project.id, body.name, body.color || '#8b8fa3', body.category || 'todo', (max.m || 0) + 1000]);
  realtime.publish(project.workspace_id, { type: 'project.meta_changed', projectId: project.id });
  return created(statusFromRow(db.one('SELECT * FROM task_statuses WHERE id = ?', [id])!));
});

projectsRouter.patch('/projects/:id/statuses/:statusId', async (ctx) => {
  const user = ctx.requireUser();
  const { project } = requireProject(user.id, ctx.params.id, 'manage');
  const body = await ctx.json(v.object({ name: v.string({ min: 1, max: 40 }).optional(), color: v.string({ pattern: /^#[0-9a-fA-F]{6}$/ }).optional(), category: v.enum(['backlog', 'todo', 'in_progress', 'done', 'cancelled'] as const).optional(), position: v.number().optional() }));
  const sets: string[] = [];
  const params: (string | number)[] = [];
  for (const k of ['name', 'color', 'category', 'position'] as const) {
    if (body[k] !== undefined) {
      sets.push(`${k} = ?`);
      params.push(body[k] as string | number);
    }
  }
  if (sets.length) db.run(`UPDATE task_statuses SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`, [...params, ctx.params.statusId, project.id]);
  if (body.category) {
    // keep completed_at consistent when a status changes category
    const doneLike = body.category === 'done' || body.category === 'cancelled';
    db.run(`UPDATE tasks SET completed_at = ${doneLike ? 'COALESCE(completed_at, ?)' : 'NULL'} WHERE status_id = ?`, doneLike ? [now(), ctx.params.statusId] : [ctx.params.statusId]);
  }
  realtime.publish(project.workspace_id, { type: 'project.meta_changed', projectId: project.id });
  const row = db.one('SELECT * FROM task_statuses WHERE id = ?', [ctx.params.statusId]);
  if (!row) throw errors.notFound('Status');
  return statusFromRow(row);
});

projectsRouter.put('/projects/:id/statuses/order', async (ctx) => {
  const user = ctx.requireUser();
  const { project } = requireProject(user.id, ctx.params.id, 'manage');
  const body = await ctx.json(v.object({ statusIds: v.array(v.string(), { max: 50 }) }));
  db.tx(() => body.statusIds.forEach((sid, i) => db.run('UPDATE task_statuses SET position = ? WHERE id = ? AND project_id = ?', [(i + 1) * 1000, sid, project.id])));
  realtime.publish(project.workspace_id, { type: 'project.meta_changed', projectId: project.id });
  return noContent();
});

projectsRouter.delete('/projects/:id/statuses/:statusId', async (ctx) => {
  const user = ctx.requireUser();
  const { project } = requireProject(user.id, ctx.params.id, 'manage');
  const moveTo = ctx.query.get('moveTo');
  if (moveTo === ctx.params.statusId) throw errors.badRequest('Choose a different status to move tasks to');
  const count = db.one<{ c: number }>('SELECT COUNT(*) AS c FROM task_statuses WHERE project_id = ?', [project.id])!;
  if (count.c <= 1) throw errors.badRequest('A project needs at least one status');
  const target = moveTo ? db.one<{ id: string; category: StatusCategory }>('SELECT id, category FROM task_statuses WHERE id = ? AND project_id = ?', [moveTo, project.id]) : db.one<{ id: string; category: StatusCategory }>('SELECT id, category FROM task_statuses WHERE project_id = ? AND id != ? ORDER BY position LIMIT 1', [project.id, ctx.params.statusId]);
  if (!target) throw errors.badRequest('Invalid target status');
  db.tx(() => {
    db.run('UPDATE tasks SET status_id = ?, updated_at = ? WHERE status_id = ?', [target.id, now(), ctx.params.statusId]);
    db.run('DELETE FROM task_statuses WHERE id = ? AND project_id = ?', [ctx.params.statusId, project.id]);
  });
  realtime.publish(project.workspace_id, { type: 'project.meta_changed', projectId: project.id });
  return noContent();
});

// ---- Labels ----
projectsRouter.post('/projects/:id/labels', async (ctx) => {
  const user = ctx.requireUser();
  const { project } = requireProject(user.id, ctx.params.id, 'edit');
  const body = await ctx.json(v.object({ name: v.string({ min: 1, max: 40 }), color: v.string({ pattern: /^#[0-9a-fA-F]{6}$/ }).optional() }));
  if (db.one('SELECT 1 FROM labels WHERE project_id = ? AND name = ? COLLATE NOCASE', [project.id, body.name])) throw errors.conflict('Label already exists');
  const id = newId();
  db.run('INSERT INTO labels (id, project_id, name, color) VALUES (?,?,?,?)', [id, project.id, body.name, body.color || PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]]);
  realtime.publish(project.workspace_id, { type: 'project.meta_changed', projectId: project.id });
  return created(labelFromRow(db.one('SELECT * FROM labels WHERE id = ?', [id])!));
});

projectsRouter.patch('/projects/:id/labels/:labelId', async (ctx) => {
  const user = ctx.requireUser();
  const { project } = requireProject(user.id, ctx.params.id, 'edit');
  const body = await ctx.json(v.object({ name: v.string({ min: 1, max: 40 }).optional(), color: v.string({ pattern: /^#[0-9a-fA-F]{6}$/ }).optional() }));
  if (body.name !== undefined) db.run('UPDATE labels SET name = ? WHERE id = ? AND project_id = ?', [body.name, ctx.params.labelId, project.id]);
  if (body.color !== undefined) db.run('UPDATE labels SET color = ? WHERE id = ? AND project_id = ?', [body.color, ctx.params.labelId, project.id]);
  realtime.publish(project.workspace_id, { type: 'project.meta_changed', projectId: project.id });
  const row = db.one('SELECT * FROM labels WHERE id = ?', [ctx.params.labelId]);
  if (!row) throw errors.notFound('Label');
  return labelFromRow(row);
});

projectsRouter.delete('/projects/:id/labels/:labelId', (ctx) => {
  const user = ctx.requireUser();
  const { project } = requireProject(user.id, ctx.params.id, 'edit');
  db.run('DELETE FROM labels WHERE id = ? AND project_id = ?', [ctx.params.labelId, project.id]);
  realtime.publish(project.workspace_id, { type: 'project.meta_changed', projectId: project.id });
  return noContent();
});

// ---- Saved views ----
const viewBody = v.object({
  name: v.string({ min: 1, max: 60 }),
  kind: v.enum(['board', 'list', 'calendar', 'timeline'] as const),
  filters: v.any().default({}),
  groupBy: v.string({ max: 20 }).optional(),
  sortBy: v.string({ max: 40 }).optional(),
  shared: v.boolean().default(false),
});

projectsRouter.post('/projects/:id/views', async (ctx) => {
  const user = ctx.requireUser();
  const { project, canManage } = requireProject(user.id, ctx.params.id, 'view');
  const body = await ctx.json(viewBody);
  const id = newId();
  db.run('INSERT INTO saved_views (id, project_id, user_id, name, kind, filters, group_by, sort_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)', [id, project.id, body.shared && canManage ? null : user.id, body.name, body.kind, JSON.stringify(body.filters || {}), body.groupBy ?? null, body.sortBy ?? null, now()]);
  if (body.shared) realtime.publish(project.workspace_id, { type: 'project.meta_changed', projectId: project.id });
  return created(viewFromRow(db.one('SELECT * FROM saved_views WHERE id = ?', [id])!));
});

projectsRouter.patch('/projects/:id/views/:viewId', async (ctx) => {
  const user = ctx.requireUser();
  const { project, canManage } = requireProject(user.id, ctx.params.id, 'view');
  const row = db.one<{ user_id: string | null }>('SELECT user_id FROM saved_views WHERE id = ? AND project_id = ?', [ctx.params.viewId, project.id]);
  if (!row) throw errors.notFound('View');
  if (row.user_id !== user.id && !(row.user_id === null && canManage)) throw errors.forbidden();
  const body = await ctx.json(v.object({ name: v.string({ min: 1, max: 60 }).optional(), filters: v.any().optional(), groupBy: v.string({ max: 20 }).nullable().optional(), sortBy: v.string({ max: 40 }).nullable().optional(), kind: v.enum(['board', 'list', 'calendar', 'timeline'] as const).optional() }));
  if (body.name !== undefined) db.run('UPDATE saved_views SET name = ? WHERE id = ?', [body.name, ctx.params.viewId]);
  if (body.filters !== undefined) db.run('UPDATE saved_views SET filters = ? WHERE id = ?', [JSON.stringify(body.filters), ctx.params.viewId]);
  if (body.groupBy !== undefined) db.run('UPDATE saved_views SET group_by = ? WHERE id = ?', [body.groupBy, ctx.params.viewId]);
  if (body.sortBy !== undefined) db.run('UPDATE saved_views SET sort_by = ? WHERE id = ?', [body.sortBy, ctx.params.viewId]);
  if (body.kind !== undefined) db.run('UPDATE saved_views SET kind = ? WHERE id = ?', [body.kind, ctx.params.viewId]);
  if (row.user_id === null) realtime.publish(project.workspace_id, { type: 'project.meta_changed', projectId: project.id });
  return viewFromRow(db.one('SELECT * FROM saved_views WHERE id = ?', [ctx.params.viewId])!);
});

projectsRouter.delete('/projects/:id/views/:viewId', (ctx) => {
  const user = ctx.requireUser();
  const { project, canManage } = requireProject(user.id, ctx.params.id, 'view');
  const row = db.one<{ user_id: string | null }>('SELECT user_id FROM saved_views WHERE id = ? AND project_id = ?', [ctx.params.viewId, project.id]);
  if (!row) throw errors.notFound('View');
  if (row.user_id !== user.id && !(row.user_id === null && canManage)) throw errors.forbidden();
  db.run('DELETE FROM saved_views WHERE id = ?', [ctx.params.viewId]);
  if (row.user_id === null) realtime.publish(project.workspace_id, { type: 'project.meta_changed', projectId: project.id });
  return noContent();
});
