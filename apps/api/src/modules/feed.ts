// Notifications inbox, workspace activity feed, search, dashboard analytics, realtime events endpoint.
import { Router, noContent } from '../lib/http.ts';
import { db, now } from '../db/index.ts';
import { errors } from '../lib/errors.ts';
import { config } from '../config.ts';
import { verifyJwt } from '../lib/crypto.ts';
import { requireMember, requireProject, VISIBLE_PROJECTS_SQL } from '../lib/access.ts';
import { notificationFromRow, activityFromRow, taskFromRow, projectFromRow, userFromRow } from '../lib/serialize.ts';
import { ACTIVITY_SELECT, notify } from '../lib/services.ts';
import { realtime } from '../lib/realtime.ts';
import { TASK_SELECT } from './tasks.ts';
import { PROJECT_SELECT } from './projects.ts';
import { v, todayISO, addDays } from '../../../../packages/shared/src/index.ts';
import type { DashboardData, Priority, StatusCategory } from '../../../../packages/shared/src/types.ts';

function clampInt(raw: string | null, fallback: number, max: number): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, Math.floor(n));
}

const NOTIF_SELECT = `SELECT n.*, u.id AS actor_id, u.name AS actor_name, u.avatar_url AS actor_avatar FROM notifications n LEFT JOIN users u ON u.id = n.actor_id`;

export const feedRouter = new Router('/api');

// ---- Notifications ----
feedRouter.get('/notifications', (ctx) => {
  const user = ctx.requireUser();
  const unreadOnly = ctx.query.get('unread') === 'true';
  const limit = clampInt(ctx.query.get('limit'), 50, 200);
  const rows = db.all(`${NOTIF_SELECT} WHERE n.user_id = ? ${unreadOnly ? 'AND n.read_at IS NULL' : ''} ORDER BY n.created_at DESC LIMIT ?`, [user.id, limit]);
  const unread = db.one<{ c: number }>('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL', [user.id])!.c;
  return { items: rows.map(notificationFromRow), unread };
});

feedRouter.post('/notifications/read', async (ctx) => {
  const user = ctx.requireUser();
  const body = await ctx.json(v.object({ ids: v.array(v.string(), { max: 500 }).optional(), all: v.boolean().default(false) }));
  if (body.all) db.run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [now(), user.id]);
  else if (body.ids?.length) for (const id of body.ids) db.run('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?', [now(), id, user.id]);
  return noContent();
});

feedRouter.post('/notifications/unread', async (ctx) => {
  const user = ctx.requireUser();
  const body = await ctx.json(v.object({ ids: v.array(v.string(), { max: 500 }) }));
  for (const id of body.ids) db.run('UPDATE notifications SET read_at = NULL WHERE id = ? AND user_id = ?', [id, user.id]);
  return noContent();
});

feedRouter.delete('/notifications/:id', (ctx) => {
  const user = ctx.requireUser();
  db.run('DELETE FROM notifications WHERE id = ? AND user_id = ?', [ctx.params.id, user.id]);
  return noContent();
});

feedRouter.delete('/notifications', (ctx) => {
  const user = ctx.requireUser();
  const readOnly = ctx.query.get('read') === 'true';
  db.run(`DELETE FROM notifications WHERE user_id = ? ${readOnly ? 'AND read_at IS NOT NULL' : ''}`, [user.id]);
  return noContent();
});

// ---- Activity feed ----
feedRouter.get('/workspaces/:id/activity', (ctx) => {
  const user = ctx.requireUser();
  requireMember(user.id, ctx.params.id);
  const limit = clampInt(ctx.query.get('limit'), 50, 200);
  const before = ctx.query.get('before');
  const projectId = ctx.query.get('project');
  const rows = db.all(
    `${ACTIVITY_SELECT} WHERE a.workspace_id = ? ${before ? 'AND a.created_at < ?' : ''} ${projectId ? 'AND a.project_id = ?' : ''}
     AND (a.project_id IS NULL OR EXISTS (SELECT 1 FROM projects p WHERE p.id = a.project_id AND ${VISIBLE_PROJECTS_SQL}))
     ORDER BY a.created_at DESC LIMIT ?`,
    [ctx.params.id, ...(before ? [before] : []), ...(projectId ? [projectId] : []), user.id, user.id, limit],
  );
  return rows.map(activityFromRow);
});

feedRouter.get('/projects/:id/activity', (ctx) => {
  const user = ctx.requireUser();
  const { project } = requireProject(user.id, ctx.params.id);
  const limit = clampInt(ctx.query.get('limit'), 50, 200);
  return db.all(`${ACTIVITY_SELECT} WHERE a.project_id = ? ORDER BY a.created_at DESC LIMIT ?`, [project.id, limit]).map(activityFromRow);
});

// ---- Search ----
feedRouter.get('/workspaces/:id/search', (ctx) => {
  const user = ctx.requireUser();
  requireMember(user.id, ctx.params.id);
  const q = (ctx.query.get('q') || '').trim();
  if (!q) return { tasks: [], projects: [], members: [] };
  const like = `%${q.replace(/[%_]/g, (m) => '\\' + m)}%`;
  const keyMatch = /^([A-Za-z][A-Za-z0-9]{1,5})-(\d+)$/.exec(q);
  const tasks = db.all(
    `${TASK_SELECT} WHERE p.workspace_id = ? AND t.archived_at IS NULL AND ${VISIBLE_PROJECTS_SQL}
     AND (t.title LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\' ${keyMatch ? 'OR (p.key = ? AND t.number = ?)' : ''})
     ORDER BY CASE WHEN t.title LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, t.updated_at DESC LIMIT 25`,
    [ctx.params.id, user.id, user.id, like, like, ...(keyMatch ? [keyMatch[1].toUpperCase(), Number(keyMatch[2])] : []), like],
  );
  const projects = db.all(`${PROJECT_SELECT} WHERE p.workspace_id = ? AND ${VISIBLE_PROJECTS_SQL} AND (p.name LIKE ? ESCAPE '\\' OR p.key LIKE ? ESCAPE '\\') LIMIT 10`, [ctx.params.id, user.id, user.id, like, like]);
  const members = db.all(`SELECT u.* FROM users u JOIN workspace_members wm ON wm.user_id = u.id WHERE wm.workspace_id = ? AND (u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\') LIMIT 10`, [ctx.params.id, like, like]);
  return { tasks: tasks.map(taskFromRow), projects: projects.map(projectFromRow), members: members.map(userFromRow) };
});

// ---- My tasks across the workspace ----
feedRouter.get('/workspaces/:id/my-tasks', (ctx) => {
  const user = ctx.requireUser();
  requireMember(user.id, ctx.params.id);
  return db
    .all(`${TASK_SELECT} WHERE p.workspace_id = ? AND t.assignee_id = ? AND t.archived_at IS NULL AND p.state = 'active' ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date, t.priority DESC, t.updated_at DESC`, [ctx.params.id, user.id])
    .map(taskFromRow);
});

// ---- Dashboard ----
feedRouter.get('/workspaces/:id/dashboard', (ctx) => {
  const user = ctx.requireUser();
  requireMember(user.id, ctx.params.id);
  const wsId = ctx.params.id;
  const today = todayISO();
  const weekEnd = addDays(today, 7);
  const weekStart = addDays(today, -7);
  const base = `FROM tasks t JOIN projects p ON p.id = t.project_id JOIN task_statuses s ON s.id = t.status_id WHERE p.workspace_id = ? AND t.archived_at IS NULL AND p.state = 'active' AND ${VISIBLE_PROJECTS_SQL}`;
  const baseParams = [wsId, user.id, user.id];
  const open = `s.category NOT IN ('done','cancelled')`;
  const count = (extra: string, params: (string | number)[] = []) => db.one<{ c: number }>(`SELECT COUNT(*) AS c ${base} ${extra}`, [...baseParams, ...params])!.c;

  const counts = {
    assigned: count(`AND t.assignee_id = ? AND ${open}`, [user.id]),
    overdue: count(`AND t.assignee_id = ? AND ${open} AND t.due_date < ?`, [user.id, today]),
    dueToday: count(`AND t.assignee_id = ? AND ${open} AND t.due_date = ?`, [user.id, today]),
    dueThisWeek: count(`AND t.assignee_id = ? AND ${open} AND t.due_date >= ? AND t.due_date <= ?`, [user.id, today, weekEnd]),
    completedThisWeek: count(`AND t.parent_id IS NULL AND t.completed_at >= ?`, [weekStart]),
    createdThisWeek: count(`AND t.parent_id IS NULL AND t.created_at >= ?`, [weekStart]),
  };
  const myTasks = db.all(`${TASK_SELECT} WHERE p.workspace_id = ? AND t.assignee_id = ? AND t.archived_at IS NULL AND p.state = 'active' AND ${open} ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date, t.priority DESC LIMIT 12`, [wsId, user.id]).map(taskFromRow);
  const overdue = db.all(`${TASK_SELECT} WHERE p.workspace_id = ? AND t.archived_at IS NULL AND p.state = 'active' AND ${open} AND t.due_date < ? AND ${VISIBLE_PROJECTS_SQL} ORDER BY t.due_date LIMIT 12`, [wsId, today, user.id, user.id]).map(taskFromRow);
  const upcoming = db.all(`${TASK_SELECT} WHERE p.workspace_id = ? AND t.archived_at IS NULL AND p.state = 'active' AND ${open} AND t.due_date >= ? AND t.due_date <= ? AND ${VISIBLE_PROJECTS_SQL} ORDER BY t.due_date LIMIT 12`, [wsId, today, weekEnd, user.id, user.id]).map(taskFromRow);
  const recentActivity = db.all(`${ACTIVITY_SELECT} WHERE a.workspace_id = ? AND (a.project_id IS NULL OR EXISTS (SELECT 1 FROM projects p WHERE p.id = a.project_id AND ${VISIBLE_PROJECTS_SQL})) ORDER BY a.created_at DESC LIMIT 15`, [wsId, user.id, user.id]).map(activityFromRow);
  const byStatusCategory = db.all<{ category: StatusCategory; count: number }>(`SELECT s.category, COUNT(*) AS count ${base} AND t.parent_id IS NULL GROUP BY s.category`, baseParams);
  const byPriority = db.all<{ priority: Priority; count: number }>(`SELECT t.priority, COUNT(*) AS count ${base} AND ${open} AND t.parent_id IS NULL GROUP BY t.priority`, baseParams);
  const throughput: DashboardData['throughput'] = [];
  for (let i = 13; i >= 0; i--) {
    const date = addDays(today, -i);
    const completed = count(`AND t.parent_id IS NULL AND substr(t.completed_at, 1, 10) = ?`, [date]);
    const createdN = count(`AND t.parent_id IS NULL AND substr(t.created_at, 1, 10) = ?`, [date]);
    throughput.push({ date, completed, created: createdN });
  }
  const overdueByProject = db.all<{ project_id: string; c: number }>(`SELECT t.project_id, COUNT(*) AS c FROM tasks t JOIN task_statuses s ON s.id = t.status_id JOIN projects p ON p.id = t.project_id WHERE p.workspace_id = ? AND t.archived_at IS NULL AND ${open} AND t.due_date < ? GROUP BY t.project_id`, [wsId, today]);
  const projects = db
    .all(`${PROJECT_SELECT} WHERE p.workspace_id = ? AND p.state = 'active' AND ${VISIBLE_PROJECTS_SQL} ORDER BY p.created_at`, [wsId, user.id, user.id])
    .map((r) => ({ ...projectFromRow(r), taskCount: Number(r.task_count), doneCount: Number(r.done_count), overdueCount: Number(overdueByProject.find((o) => o.project_id === r.id)?.c || 0) }));
  const perUser = db.all<{ assignee_id: string; open: number; overdue: number; done: number }>(
    `SELECT t.assignee_id,
       SUM(CASE WHEN ${open} THEN 1 ELSE 0 END) AS open,
       SUM(CASE WHEN ${open} AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue,
       SUM(CASE WHEN t.completed_at >= ? THEN 1 ELSE 0 END) AS done
     ${base} AND t.assignee_id IS NOT NULL GROUP BY t.assignee_id`,
    [today, weekStart, ...baseParams],
  );
  const workload = db
    .all<{ id: string; name: string; avatar_url: string | null }>(`SELECT u.id, u.name, u.avatar_url FROM users u JOIN workspace_members wm ON wm.user_id = u.id WHERE wm.workspace_id = ? ORDER BY u.name COLLATE NOCASE LIMIT 30`, [wsId])
    .map((r) => {
      const s = perUser.find((x) => x.assignee_id === r.id);
      return { user: { id: r.id, name: r.name, avatarUrl: r.avatar_url }, open: Number(s?.open || 0), overdue: Number(s?.overdue || 0), done: Number(s?.done || 0) };
    })
    .sort((a, b) => b.open - a.open);

  const data: DashboardData = { counts, myTasks, overdue, upcoming, recentActivity, byStatusCategory, byPriority, throughput, projects, workload };
  return data;
});

// ---- Realtime (SSE) ----
feedRouter.get('/events', (ctx) => {
  // EventSource cannot set headers, so accept the access token as a query param here only.
  let userId = ctx.user?.id ?? null;
  if (!userId) {
    const token = ctx.query.get('token');
    const payload = token ? verifyJwt(token, config.jwtSecret) : null;
    if (!payload) throw errors.unauthorized();
    userId = payload.sub;
  }
  const workspaceId = ctx.query.get('workspace');
  if (!workspaceId) throw errors.badRequest('workspace is required');
  requireMember(userId, workspaceId);
  const me = db.one<{ id: string; name: string; avatar_url: string | null }>('SELECT id, name, avatar_url FROM users WHERE id = ?', [userId])!;
  ctx.responded = true;
  realtime.attach(ctx.res, { id: me.id, name: me.name, avatarUrl: me.avatar_url }, workspaceId, ctx.query.get('location'));
});

feedRouter.post('/presence', async (ctx) => {
  const user = ctx.requireUser();
  const body = await ctx.json(v.object({ workspaceId: v.string(), location: v.string({ max: 200 }).nullable().default(null) }));
  requireMember(user.id, body.workspaceId);
  realtime.setLocation(user.id, body.workspaceId, body.location);
  db.run('UPDATE users SET last_active_at = ? WHERE id = ?', [now(), user.id]);
  return noContent();
});

/** Daily "due soon" reminders: called from a timer in server.ts. */
export function sendDueSoonReminders() {
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const rows = db.all<Record<string, unknown>>(
    `SELECT t.id, t.title, t.number, t.due_date, t.assignee_id, p.key, w.slug FROM tasks t
     JOIN projects p ON p.id = t.project_id JOIN workspaces w ON w.id = p.workspace_id JOIN task_statuses s ON s.id = t.status_id
     WHERE t.archived_at IS NULL AND t.assignee_id IS NOT NULL AND s.category NOT IN ('done','cancelled') AND t.due_date IN (?, ?)
     AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = t.assignee_id AND n.type = 'due_soon' AND n.link LIKE '%task=' || p.key || '-' || t.number AND n.created_at > ?)`,
    [today, tomorrow, addDays(today, -1)],
  );
  for (const r of rows) {
    const key = `${r.key}-${r.number}`;
    notify({ userId: r.assignee_id as string, type: 'due_soon', title: `${key} is due ${r.due_date === today ? 'today' : 'tomorrow'}`, body: r.title as string, link: `/w/${r.slug}/p/${r.key}?task=${key}`, email: { subject: `[${key}] Due ${r.due_date === today ? 'today' : 'tomorrow'}: ${r.title}`, lines: [`"${r.title}" is due ${r.due_date === today ? 'today' : 'tomorrow'}.`] } });
  }
}
