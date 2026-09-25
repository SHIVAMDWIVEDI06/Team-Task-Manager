// Comments, attachments, time entries and per-task activity.
import fs from 'node:fs';
import path from 'node:path';
import { Router, created, noContent } from '../lib/http.ts';
import { db, now } from '../db/index.ts';
import { errors } from '../lib/errors.ts';
import { newId } from '../lib/crypto.ts';
import { config } from '../config.ts';
import { verifyJwt } from '../lib/crypto.ts';
import { requireTask } from '../lib/access.ts';
import { commentFromRow, attachmentFromRow, timeEntryFromRow, activityFromRow } from '../lib/serialize.ts';
import { logActivity, notify, extractMentions, taskAudience, taskLink, ACTIVITY_SELECT } from '../lib/services.ts';
import { realtime } from '../lib/realtime.ts';
import { sendFile } from '../lib/static.ts';
import { v, LIMITS } from '../../../../packages/shared/src/index.ts';
import { loadTask } from './tasks.ts';

const COMMENT_SELECT = `SELECT c.*, u.id AS author_id, u.name AS author_name, u.avatar_url AS author_avatar_url
  FROM comments c LEFT JOIN users u ON u.id = c.author_id`;

function slugOf(workspaceId: string) {
  return db.one<{ slug: string }>('SELECT slug FROM workspaces WHERE id = ?', [workspaceId])!.slug;
}

export const collabRouter = new Router('/api');

// ---- Comments ----
collabRouter.get('/tasks/:id/comments', (ctx) => {
  const user = ctx.requireUser();
  requireTask(user.id, ctx.params.id);
  return db.all(`${COMMENT_SELECT} WHERE c.task_id = ? ORDER BY c.created_at ASC`, [ctx.params.id]).map(commentFromRow);
});

collabRouter.post('/tasks/:id/comments', async (ctx) => {
  const user = ctx.requireUser();
  const { task, access } = requireTask(user.id, ctx.params.id, 'edit');
  const body = await ctx.json(v.object({ body: v.string({ min: 1, max: LIMITS.commentMax, trim: false }) }));
  const id = newId();
  db.run('INSERT INTO comments (id, task_id, author_id, body, created_at) VALUES (?,?,?,?,?)', [id, task.id, user.id, body.body, now()]);
  db.run('INSERT OR IGNORE INTO task_watchers (task_id, user_id) VALUES (?,?)', [task.id, user.id]);
  db.run('UPDATE tasks SET updated_at = ? WHERE id = ?', [now(), task.id]);
  const comment = commentFromRow(db.one(`${COMMENT_SELECT} WHERE c.id = ?`, [id])!);
  const t = loadTask(task.id)!;
  const wsId = access.project.workspace_id;
  realtime.publish(wsId, { type: 'comment.created', projectId: task.project_id, taskId: task.id, comment });
  realtime.publish(wsId, { type: 'task.updated', projectId: task.project_id, task: t });
  logActivity({ workspaceId: wsId, projectId: task.project_id, taskId: task.id, actorId: user.id, type: 'task.commented', data: { key: t.key, title: t.title, excerpt: body.body.slice(0, 140) } });
  const link = taskLink(slugOf(wsId), access.project.key, task.number);
  const mentioned = new Set(extractMentions(body.body));
  for (const uid of mentioned) {
    notify({ userId: uid, type: 'mentioned', title: `${comment.author.name} mentioned you in ${t.key}`, body: body.body.slice(0, 200), link, actorId: user.id, email: { subject: `[${t.key}] ${comment.author.name} mentioned you`, lines: [`${comment.author.name} mentioned you in a comment on "${t.title}":`, body.body.slice(0, 500)] } });
  }
  for (const uid of taskAudience(task.id, user.id)) {
    if (mentioned.has(uid)) continue;
    notify({ userId: uid, type: 'commented', title: `${comment.author.name} commented on ${t.key}`, body: body.body.slice(0, 200), link, actorId: user.id, email: { subject: `[${t.key}] New comment from ${comment.author.name}`, lines: [`${comment.author.name} commented on "${t.title}":`, body.body.slice(0, 500)] } });
  }
  return created(comment);
});

collabRouter.patch('/comments/:id', async (ctx) => {
  const user = ctx.requireUser();
  const row = db.one<{ task_id: string; author_id: string }>('SELECT task_id, author_id FROM comments WHERE id = ?', [ctx.params.id]);
  if (!row) throw errors.notFound('Comment');
  const { task, access } = requireTask(user.id, row.task_id, 'edit');
  if (row.author_id !== user.id && !access.canManage) throw errors.forbidden('You can only edit your own comments');
  const body = await ctx.json(v.object({ body: v.string({ min: 1, max: LIMITS.commentMax, trim: false }) }));
  db.run('UPDATE comments SET body = ?, edited_at = ? WHERE id = ?', [body.body, now(), ctx.params.id]);
  const comment = commentFromRow(db.one(`${COMMENT_SELECT} WHERE c.id = ?`, [ctx.params.id])!);
  realtime.publish(access.project.workspace_id, { type: 'comment.updated', projectId: task.project_id, taskId: task.id, comment });
  return comment;
});

collabRouter.delete('/comments/:id', (ctx) => {
  const user = ctx.requireUser();
  const row = db.one<{ task_id: string; author_id: string }>('SELECT task_id, author_id FROM comments WHERE id = ?', [ctx.params.id]);
  if (!row) throw errors.notFound('Comment');
  const { task, access } = requireTask(user.id, row.task_id, 'edit');
  if (row.author_id !== user.id && !access.canManage) throw errors.forbidden('You can only delete your own comments');
  db.run('DELETE FROM comments WHERE id = ?', [ctx.params.id]);
  realtime.publish(access.project.workspace_id, { type: 'comment.deleted', projectId: task.project_id, taskId: task.id, commentId: ctx.params.id });
  const t = loadTask(task.id);
  if (t) realtime.publish(access.project.workspace_id, { type: 'task.updated', projectId: task.project_id, task: t });
  return noContent();
});

// ---- Attachments ----
const SAFE_EXT = /\.(png|jpe?g|gif|webp|svg|pdf|txt|md|csv|json|zip|docx?|xlsx?|pptx?|mp4|mov|webm|mp3|wav)$/i;

collabRouter.post('/tasks/:id/attachments', async (ctx) => {
  const user = ctx.requireUser();
  const { task, access } = requireTask(user.id, ctx.params.id, 'edit');
  ctx.maxUploadBytes = config.maxUploadBytes;
  const { files } = await ctx.multipart();
  if (!files.length) throw errors.badRequest('No file uploaded');
  const out = [];
  for (const f of files) {
    if (f.data.length > config.maxUploadBytes) throw errors.tooLarge(`Files must be under ${Math.round(config.maxUploadBytes / 1048576)} MB`);
    const id = newId();
    const ext = path.extname(f.filename).toLowerCase();
    const storageKey = `${id}${SAFE_EXT.test(f.filename) ? ext : '.bin'}`;
    fs.writeFileSync(path.join(config.uploadsDir, storageKey), f.data);
    db.run('INSERT INTO attachments (id, task_id, uploader_id, filename, mime, size, storage_key, created_at) VALUES (?,?,?,?,?,?,?,?)', [id, task.id, user.id, f.filename, f.mime, f.data.length, storageKey, now()]);
    out.push(attachmentFromRow(db.one(`SELECT at.*, u.id AS uploader_id, u.name AS uploader_name, u.avatar_url AS uploader_avatar_url FROM attachments at LEFT JOIN users u ON u.id = at.uploader_id WHERE at.id = ?`, [id])!));
  }
  db.run('UPDATE tasks SET updated_at = ? WHERE id = ?', [now(), task.id]);
  const t = loadTask(task.id)!;
  realtime.publish(access.project.workspace_id, { type: 'task.detail_changed', projectId: task.project_id, taskId: task.id });
  realtime.publish(access.project.workspace_id, { type: 'task.updated', projectId: task.project_id, task: t });
  logActivity({ workspaceId: access.project.workspace_id, projectId: task.project_id, taskId: task.id, actorId: user.id, type: 'task.attachment_added', data: { key: t.key, title: t.title, files: out.map((a) => a.filename) } });
  return created(out);
});

collabRouter.get('/attachments/:id/:filename', (ctx) => {
  // Direct links (e.g. from a comment opened in a new tab) may carry the access token as ?token=
  if (!ctx.user) {
    const t = ctx.query.get('token');
    const payload = t ? verifyJwt(t, config.jwtSecret) : null;
    if (payload) ctx.user = { id: payload.sub };
  }
  const user = ctx.requireUser();
  const row = db.one<{ task_id: string; storage_key: string; filename: string; mime: string }>('SELECT task_id, storage_key, filename, mime FROM attachments WHERE id = ?', [ctx.params.id]);
  if (!row) throw errors.notFound('Attachment');
  requireTask(user.id, row.task_id);
  const inline = /^(image\/|application\/pdf|text\/plain|video\/|audio\/)/.test(row.mime) && ctx.query.get('download') !== '1';
  const file = path.join(config.uploadsDir, row.storage_key);
  if (!sendFile(ctx, file, { cache: 'private, max-age=86400', download: inline ? undefined : row.filename, contentType: inline ? row.mime : 'application/octet-stream' })) throw errors.notFound('File');
});

collabRouter.delete('/attachments/:id', (ctx) => {
  const user = ctx.requireUser();
  const row = db.one<{ task_id: string; storage_key: string; uploader_id: string }>('SELECT task_id, storage_key, uploader_id FROM attachments WHERE id = ?', [ctx.params.id]);
  if (!row) throw errors.notFound('Attachment');
  const { task, access } = requireTask(user.id, row.task_id, 'edit');
  if (row.uploader_id !== user.id && !access.canManage) throw errors.forbidden('You can only delete your own attachments');
  db.run('DELETE FROM attachments WHERE id = ?', [ctx.params.id]);
  try {
    fs.unlinkSync(path.join(config.uploadsDir, row.storage_key));
  } catch {
    /* ignore */
  }
  realtime.publish(access.project.workspace_id, { type: 'task.detail_changed', projectId: task.project_id, taskId: task.id });
  const t = loadTask(task.id);
  if (t) realtime.publish(access.project.workspace_id, { type: 'task.updated', projectId: task.project_id, task: t });
  return noContent();
});

// ---- Time tracking ----
const TIME_SELECT = `SELECT te.*, u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar_url FROM time_entries te LEFT JOIN users u ON u.id = te.user_id`;

collabRouter.get('/tasks/:id/time', (ctx) => {
  const user = ctx.requireUser();
  requireTask(user.id, ctx.params.id);
  return db.all(`${TIME_SELECT} WHERE te.task_id = ? ORDER BY te.date DESC, te.created_at DESC`, [ctx.params.id]).map(timeEntryFromRow);
});

collabRouter.post('/tasks/:id/time', async (ctx) => {
  const user = ctx.requireUser();
  const { task, access } = requireTask(user.id, ctx.params.id, 'edit');
  const body = await ctx.json(v.object({ minutes: v.number({ int: true, min: 1, max: 24 * 60 * 30 }), note: v.string({ max: 500 }).default(''), date: v.string({ date: true }).optional() }));
  const id = newId();
  db.run('INSERT INTO time_entries (id, task_id, user_id, minutes, note, date, created_at) VALUES (?,?,?,?,?,?,?)', [id, task.id, user.id, body.minutes, body.note, body.date || now().slice(0, 10), now()]);
  const t = loadTask(task.id)!;
  realtime.publish(access.project.workspace_id, { type: 'task.detail_changed', projectId: task.project_id, taskId: task.id });
  realtime.publish(access.project.workspace_id, { type: 'task.updated', projectId: task.project_id, task: t });
  logActivity({ workspaceId: access.project.workspace_id, projectId: task.project_id, taskId: task.id, actorId: user.id, type: 'task.time_logged', data: { key: t.key, title: t.title, minutes: body.minutes } });
  return created(timeEntryFromRow(db.one(`${TIME_SELECT} WHERE te.id = ?`, [id])!));
});

collabRouter.delete('/time/:id', (ctx) => {
  const user = ctx.requireUser();
  const row = db.one<{ task_id: string; user_id: string }>('SELECT task_id, user_id FROM time_entries WHERE id = ?', [ctx.params.id]);
  if (!row) throw errors.notFound('Time entry');
  const { task, access } = requireTask(user.id, row.task_id, 'edit');
  if (row.user_id !== user.id && !access.canManage) throw errors.forbidden();
  db.run('DELETE FROM time_entries WHERE id = ?', [ctx.params.id]);
  realtime.publish(access.project.workspace_id, { type: 'task.detail_changed', projectId: task.project_id, taskId: task.id });
  const t = loadTask(task.id);
  if (t) realtime.publish(access.project.workspace_id, { type: 'task.updated', projectId: task.project_id, task: t });
  return noContent();
});

// ---- Task activity ----
collabRouter.get('/tasks/:id/activity', (ctx) => {
  const user = ctx.requireUser();
  requireTask(user.id, ctx.params.id);
  return db.all(`${ACTIVITY_SELECT} WHERE a.task_id = ? ORDER BY a.created_at DESC LIMIT 200`, [ctx.params.id]).map(activityFromRow);
});
