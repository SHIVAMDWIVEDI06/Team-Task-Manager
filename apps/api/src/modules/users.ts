import fs from 'node:fs';
import path from 'node:path';
import { Router, noContent } from '../lib/http.ts';
import { db, now } from '../db/index.ts';
import { errors } from '../lib/errors.ts';
import { newId } from '../lib/crypto.ts';
import { config } from '../config.ts';
import { meFromRow, DEFAULT_PREFS } from '../lib/serialize.ts';
import { sendFile } from '../lib/static.ts';
import { v, LIMITS } from '../../../../packages/shared/src/index.ts';

export const usersRouter = new Router('/api');

usersRouter.patch('/me', async (ctx) => {
  const user = ctx.requireUser();
  const body = await ctx.json(v.object({ name: v.string({ min: 1, max: LIMITS.nameMax }).optional(), timezone: v.string({ max: 64 }).optional(), avatarUrl: v.string({ max: 500 }).nullable().optional() }));
  if (body.name !== undefined) db.run('UPDATE users SET name = ? WHERE id = ?', [body.name, user.id]);
  if (body.timezone !== undefined) db.run('UPDATE users SET timezone = ? WHERE id = ?', [body.timezone, user.id]);
  if (body.avatarUrl !== undefined) db.run('UPDATE users SET avatar_url = ? WHERE id = ?', [body.avatarUrl, user.id]);
  return meFromRow(db.one('SELECT * FROM users WHERE id = ?', [user.id])!);
});

usersRouter.patch('/me/preferences', async (ctx) => {
  const user = ctx.requireUser();
  const body = await ctx.json(
    v.object({
      theme: v.enum(['system', 'light', 'dark'] as const).optional(),
      density: v.enum(['comfortable', 'compact'] as const).optional(),
      startOfWeek: v.enum([0, 1] as const).optional(),
      notifications: v
        .object({
          email: v.boolean().optional(),
          assigned: v.boolean().optional(),
          mentioned: v.boolean().optional(),
          comments: v.boolean().optional(),
          statusChanges: v.boolean().optional(),
          dueSoon: v.boolean().optional(),
        })
        .optional(),
    }),
  );
  const current = meFromRow(db.one('SELECT * FROM users WHERE id = ?', [user.id])!).preferences;
  const next = { ...DEFAULT_PREFS, ...current, ...body, notifications: { ...current.notifications, ...(body.notifications || {}) } };
  db.run('UPDATE users SET preferences = ? WHERE id = ?', [JSON.stringify(next), user.id]);
  return meFromRow(db.one('SELECT * FROM users WHERE id = ?', [user.id])!);
});

usersRouter.post('/me/avatar', async (ctx) => {
  const user = ctx.requireUser();
  ctx.maxUploadBytes = 5 * 1024 * 1024;
  const { files } = await ctx.multipart();
  const f = files[0];
  if (!f) throw errors.badRequest('No image uploaded');
  if (!/^image\/(png|jpe?g|gif|webp)$/.test(f.mime)) throw errors.badRequest('Avatar must be a PNG, JPEG, GIF or WebP image');
  const ext = f.mime === 'image/png' ? 'png' : f.mime === 'image/gif' ? 'gif' : f.mime === 'image/webp' ? 'webp' : 'jpg';
  const key = `avatar-${user.id}-${newId(6)}.${ext}`;
  fs.writeFileSync(path.join(config.uploadsDir, key), f.data);
  const url = `/api/files/${key}`;
  db.run('UPDATE users SET avatar_url = ? WHERE id = ?', [url, user.id]);
  return meFromRow(db.one('SELECT * FROM users WHERE id = ?', [user.id])!);
});

// Public files (avatars, workspace logos) — names are unguessable.
usersRouter.get('/files/:key', (ctx) => {
  const key = ctx.params.key;
  if (!/^[A-Za-z0-9._-]+$/.test(key) || key.includes('..')) throw errors.notFound('File');
  if (!sendFile(ctx, path.join(config.uploadsDir, key), { cache: 'public, max-age=86400' })) throw errors.notFound('File');
});

usersRouter.delete('/me', async (ctx) => {
  const user = ctx.requireUser();
  const body = await ctx.json(v.object({ confirm: v.literal('DELETE') }));
  void body;
  const soleOwner = db.one(
    `SELECT 1 FROM workspace_members wm WHERE wm.user_id = ? AND wm.role = 'owner'
     AND (SELECT COUNT(*) FROM workspace_members o WHERE o.workspace_id = wm.workspace_id AND o.role = 'owner') = 1
     AND (SELECT COUNT(*) FROM workspace_members m WHERE m.workspace_id = wm.workspace_id) > 1`,
    [user.id],
  );
  if (soleOwner) throw errors.badRequest('Transfer ownership of your workspaces before deleting your account');
  db.tx(() => {
    db.run(`DELETE FROM workspaces WHERE id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ? AND role = 'owner')`, [user.id]);
    db.run('DELETE FROM users WHERE id = ?', [user.id]);
  });
  ctx.clearCookie('tt_refresh', '/api/auth');
  return noContent();
});

export function touchLastActive(userId: string) {
  db.run('UPDATE users SET last_active_at = ? WHERE id = ?', [now(), userId]);
}
