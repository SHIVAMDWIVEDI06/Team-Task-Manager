import { Router, created, noContent } from '../lib/http.ts';
import { db, now } from '../db/index.ts';
import { errors } from '../lib/errors.ts';
import { newId } from '../lib/crypto.ts';
import { requireMember, roleIn } from '../lib/access.ts';
import { workspaceFromRow, memberFromRow } from '../lib/serialize.ts';
import { logActivity } from '../lib/services.ts';
import { realtime } from '../lib/realtime.ts';
import { v, LIMITS, slugify, ROLE_RANK } from '../../../../packages/shared/src/index.ts';
import type { WorkspaceRole } from '../../../../packages/shared/src/types.ts';
import { createProjectInternal } from './projects.ts';

const WS_SELECT = `SELECT w.*, wm.role, (SELECT COUNT(*) FROM workspace_members m2 WHERE m2.workspace_id = w.id) AS member_count
  FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?`;

function uniqueSlug(base: string): string {
  let slug = slugify(base);
  let i = 2;
  while (db.one('SELECT 1 FROM workspaces WHERE slug = ?', [slug])) slug = `${slugify(base)}-${i++}`;
  return slug;
}

export function createWorkspaceInternal(userId: string, name: string, opts: { withSampleProject?: boolean } = {}) {
  const id = newId();
  const ts = now();
  const slug = uniqueSlug(name);
  db.tx(() => {
    db.run('INSERT INTO workspaces (id, name, slug, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?)', [id, name, slug, userId, ts, ts]);
    db.run('INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?,?,?,?)', [id, userId, 'owner', ts]);
    if (opts.withSampleProject) {
      createProjectInternal({ workspaceId: id, userId, name: 'Getting started', key: 'START', description: 'A sample project to explore TeamTask.', color: '#6b7cff', icon: '✦', seedSample: true });
    }
  });
  return db.one(`${WS_SELECT} WHERE w.id = ?`, [userId, id])!;
}

export const workspacesRouter = new Router('/api/workspaces');

workspacesRouter.get('', (ctx) => {
  const user = ctx.requireUser();
  return db.all(`${WS_SELECT} ORDER BY w.created_at ASC`, [user.id]).map(workspaceFromRow);
});

workspacesRouter.post('', async (ctx) => {
  const user = ctx.requireUser();
  const body = await ctx.json(v.object({ name: v.string({ min: 1, max: LIMITS.nameMax }), withSampleProject: v.boolean().default(false) }));
  const row = createWorkspaceInternal(user.id, body.name, { withSampleProject: body.withSampleProject });
  return created(workspaceFromRow(row));
});

workspacesRouter.get('/:id', (ctx) => {
  const user = ctx.requireUser();
  requireMember(user.id, ctx.params.id);
  const row = db.one(`${WS_SELECT} WHERE w.id = ?`, [user.id, ctx.params.id]);
  if (!row) throw errors.notFound('Workspace');
  return workspaceFromRow(row);
});

workspacesRouter.get('/by-slug/:slug', (ctx) => {
  const user = ctx.requireUser();
  const row = db.one(`${WS_SELECT} WHERE w.slug = ?`, [user.id, ctx.params.slug]);
  if (!row) throw errors.notFound('Workspace');
  return workspaceFromRow(row);
});

workspacesRouter.patch('/:id', async (ctx) => {
  const user = ctx.requireUser();
  requireMember(user.id, ctx.params.id, 'admin');
  const body = await ctx.json(v.object({ name: v.string({ min: 1, max: LIMITS.nameMax }).optional(), logoUrl: v.string({ max: 500 }).nullable().optional() }));
  const sets: string[] = [];
  const params: (string | null)[] = [];
  if (body.name !== undefined) {
    sets.push('name = ?');
    params.push(body.name);
  }
  if (body.logoUrl !== undefined) {
    sets.push('logo_url = ?');
    params.push(body.logoUrl);
  }
  if (sets.length) {
    sets.push('updated_at = ?');
    params.push(now());
    db.run(`UPDATE workspaces SET ${sets.join(', ')} WHERE id = ?`, [...params, ctx.params.id]);
    logActivity({ workspaceId: ctx.params.id, actorId: user.id, type: 'workspace.updated', data: body });
  }
  const row = workspaceFromRow(db.one(`${WS_SELECT} WHERE w.id = ?`, [user.id, ctx.params.id])!);
  realtime.publish(ctx.params.id, { type: 'workspace.updated', workspace: row });
  return row;
});

workspacesRouter.delete('/:id', (ctx) => {
  const user = ctx.requireUser();
  requireMember(user.id, ctx.params.id, 'owner');
  db.run('DELETE FROM workspaces WHERE id = ?', [ctx.params.id]);
  return noContent();
});

// ---- Members ----
const MEMBER_SELECT = `SELECT wm.*, u.email, u.name, u.avatar_url, u.timezone, u.created_at, u.last_active_at
  FROM workspace_members wm JOIN users u ON u.id = wm.user_id`;

workspacesRouter.get('/:id/members', (ctx) => {
  const user = ctx.requireUser();
  requireMember(user.id, ctx.params.id);
  const online = realtime.onlineUserIds();
  return db.all(`${MEMBER_SELECT} WHERE wm.workspace_id = ? ORDER BY u.name COLLATE NOCASE`, [ctx.params.id]).map((r) => ({ ...memberFromRow(r), online: online.has(r.user_id as string) }));
});

workspacesRouter.patch('/:id/members/:userId', async (ctx) => {
  const user = ctx.requireUser();
  const myRole = requireMember(user.id, ctx.params.id, 'admin');
  const body = await ctx.json(v.object({ role: v.enum(['owner', 'admin', 'member', 'guest'] as const) }));
  const targetRole = roleIn(ctx.params.userId, ctx.params.id);
  if (!targetRole) throw errors.notFound('Member');
  if (ROLE_RANK[body.role] > ROLE_RANK[myRole] || ROLE_RANK[targetRole] > ROLE_RANK[myRole]) throw errors.forbidden('You cannot assign a role above your own');
  if (targetRole === 'owner' && body.role !== 'owner') {
    const owners = db.one<{ c: number }>(`SELECT COUNT(*) AS c FROM workspace_members WHERE workspace_id = ? AND role = 'owner'`, [ctx.params.id])!;
    if (owners.c <= 1) throw errors.badRequest('A workspace needs at least one owner');
  }
  db.run('UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?', [body.role, ctx.params.id, ctx.params.userId]);
  logActivity({ workspaceId: ctx.params.id, actorId: user.id, type: 'member.role_changed', data: { userId: ctx.params.userId, from: targetRole, to: body.role } });
  realtime.publish(ctx.params.id, { type: 'members.changed', workspaceId: ctx.params.id });
  return noContent();
});

workspacesRouter.delete('/:id/members/:userId', (ctx) => {
  const user = ctx.requireUser();
  const myRole = roleIn(user.id, ctx.params.id);
  if (!myRole) throw errors.notFound('Workspace');
  const isSelf = ctx.params.userId === user.id;
  const targetRole = roleIn(ctx.params.userId, ctx.params.id);
  if (!targetRole) throw errors.notFound('Member');
  if (!isSelf) {
    if (ROLE_RANK[myRole] < ROLE_RANK.admin) throw errors.forbidden();
    if (ROLE_RANK[targetRole] > ROLE_RANK[myRole]) throw errors.forbidden('You cannot remove someone with a higher role');
  }
  if (targetRole === 'owner') {
    const owners = db.one<{ c: number }>(`SELECT COUNT(*) AS c FROM workspace_members WHERE workspace_id = ? AND role = 'owner'`, [ctx.params.id])!;
    if (owners.c <= 1) throw errors.badRequest('Transfer ownership before leaving the workspace');
  }
  db.tx(() => {
    db.run('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [ctx.params.id, ctx.params.userId]);
    db.run('DELETE FROM project_members WHERE user_id = ? AND project_id IN (SELECT id FROM projects WHERE workspace_id = ?)', [ctx.params.userId, ctx.params.id]);
    db.run('UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ? AND project_id IN (SELECT id FROM projects WHERE workspace_id = ?)', [ctx.params.userId, ctx.params.id]);
  });
  logActivity({ workspaceId: ctx.params.id, actorId: user.id, type: 'member.removed', data: { userId: ctx.params.userId, left: isSelf } });
  realtime.publish(ctx.params.id, { type: 'members.changed', workspaceId: ctx.params.id });
  return noContent();
});

export type { WorkspaceRole };
