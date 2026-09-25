import { Router, created, noContent, type Ctx } from '../lib/http.ts';
import { db, now } from '../db/index.ts';
import { errors } from '../lib/errors.ts';
import { hashPassword, verifyPassword, newId, randomToken, sha256, signJwt } from '../lib/crypto.ts';
import { config } from '../config.ts';
import { RateLimiter } from '../lib/ratelimit.ts';
import { meFromRow, DEFAULT_PREFS } from '../lib/serialize.ts';
import { mailer, emailTemplate } from '../lib/mailer.ts';
import { v, LIMITS, slugify } from '../../../../packages/shared/src/index.ts';
import { acceptInviteForUser } from './invites.ts';

const REFRESH_COOKIE = 'tt_refresh';
const loginLimiter = new RateLimiter(10, 20);
const resetLimiter = new RateLimiter(5, 5);

const signupSchema = v.object({
  name: v.string({ min: 1, max: LIMITS.nameMax }),
  email: v.string({ email: true, max: 254 }),
  password: v.string({ min: LIMITS.passwordMin, max: 200, trim: false }),
  inviteToken: v.string({ max: 200 }).optional(),
  timezone: v.string({ max: 64 }).optional(),
});

const loginSchema = v.object({
  email: v.string({ email: true }),
  password: v.string({ min: 1, trim: false }),
});

function issueSession(ctx: Ctx, userId: string) {
  const refresh = randomToken(32);
  const id = newId();
  const ts = now();
  db.run(
    `INSERT INTO sessions (id, user_id, token_hash, user_agent, ip, created_at, expires_at, last_used_at) VALUES (?,?,?,?,?,?,?,?)`,
    [id, userId, sha256(refresh), (ctx.header('user-agent') || '').slice(0, 300), ctx.ip, ts, new Date(Date.now() + config.refreshTokenTtlSec * 1000).toISOString(), ts],
  );
  ctx.setCookie(REFRESH_COOKIE, refresh, {
    maxAge: config.refreshTokenTtlSec,
    path: '/api/auth',
    httpOnly: true,
    secure: config.isProd && config.appUrl.startsWith('https'),
    sameSite: 'Lax',
  });
  return accessToken(userId);
}

function accessToken(userId: string) {
  return { accessToken: signJwt({ sub: userId }, config.jwtSecret, config.accessTokenTtlSec), expiresIn: config.accessTokenTtlSec };
}

function currentMe(userId: string) {
  const row = db.one('SELECT * FROM users WHERE id = ?', [userId]);
  if (!row) throw errors.unauthorized();
  return meFromRow(row);
}

export const authRouter = new Router('/api/auth');

authRouter.post('/signup', async (ctx) => {
  if (!loginLimiter.take(`signup:${ctx.ip}`)) throw errors.rateLimited();
  const body = await ctx.json(signupSchema);
  const existing = db.one('SELECT id FROM users WHERE email = ?', [body.email.toLowerCase()]);
  if (existing) throw errors.conflict('An account with this email already exists');

  const id = newId();
  const ts = now();
  const passwordHash = await hashPassword(body.password);
  db.run(
    `INSERT INTO users (id, email, name, password_hash, timezone, preferences, created_at, last_active_at) VALUES (?,?,?,?,?,?,?,?)`,
    [id, body.email.toLowerCase(), body.name, passwordHash, body.timezone || 'UTC', JSON.stringify(DEFAULT_PREFS), ts, ts],
  );

  let joinedWorkspaceSlug: string | null = null;
  if (body.inviteToken) {
    try {
      const ws = acceptInviteForUser(body.inviteToken, id, body.email.toLowerCase());
      joinedWorkspaceSlug = ws.slug;
    } catch {
      /* invalid invite: the account is still created */
    }
  }
  const tokens = issueSession(ctx, id);
  return created({ ...tokens, user: currentMe(id), joinedWorkspaceSlug });
});

authRouter.post('/login', async (ctx) => {
  if (!loginLimiter.take(`login:${ctx.ip}`)) throw errors.rateLimited();
  const body = await ctx.json(loginSchema);
  const row = db.one<{ id: string; password_hash: string }>('SELECT id, password_hash FROM users WHERE email = ?', [body.email.toLowerCase()]);
  const okPassword = row ? await verifyPassword(body.password, row.password_hash) : await verifyPassword(body.password, 'scrypt$16384$8$1$AAAA$AAAA');
  if (!row || !okPassword) throw errors.unauthorized('Incorrect email or password');
  db.run('UPDATE users SET last_active_at = ? WHERE id = ?', [now(), row.id]);
  const tokens = issueSession(ctx, row.id);
  return { ...tokens, user: currentMe(row.id) };
});

authRouter.post('/refresh', (ctx) => {
  const refresh = ctx.cookies[REFRESH_COOKIE];
  if (!refresh) throw errors.unauthorized('No session');
  const session = db.one<{ id: string; user_id: string; expires_at: string }>('SELECT id, user_id, expires_at FROM sessions WHERE token_hash = ?', [sha256(refresh)]);
  if (!session || session.expires_at < now()) {
    ctx.clearCookie(REFRESH_COOKIE, '/api/auth');
    throw errors.unauthorized('Session expired');
  }
  // Rotate: delete the old session, issue a new one.
  db.run('DELETE FROM sessions WHERE id = ?', [session.id]);
  const tokens = issueSession(ctx, session.user_id);
  return { ...tokens, user: currentMe(session.user_id) };
});

authRouter.post('/logout', (ctx) => {
  const refresh = ctx.cookies[REFRESH_COOKIE];
  if (refresh) db.run('DELETE FROM sessions WHERE token_hash = ?', [sha256(refresh)]);
  ctx.clearCookie(REFRESH_COOKIE, '/api/auth');
  return noContent();
});

authRouter.post('/logout-all', (ctx) => {
  const user = ctx.requireUser();
  db.run('DELETE FROM sessions WHERE user_id = ?', [user.id]);
  ctx.clearCookie(REFRESH_COOKIE, '/api/auth');
  return noContent();
});

authRouter.get('/sessions', (ctx) => {
  const user = ctx.requireUser();
  const current = ctx.cookies[REFRESH_COOKIE] ? sha256(ctx.cookies[REFRESH_COOKIE]) : '';
  return db
    .all<Record<string, unknown>>('SELECT id, token_hash, user_agent, ip, created_at, last_used_at FROM sessions WHERE user_id = ? ORDER BY last_used_at DESC', [user.id])
    .map((s) => ({ id: s.id, userAgent: s.user_agent, ip: s.ip, createdAt: s.created_at, lastUsedAt: s.last_used_at, current: s.token_hash === current }));
});

authRouter.delete('/sessions/:id', (ctx) => {
  const user = ctx.requireUser();
  db.run('DELETE FROM sessions WHERE id = ? AND user_id = ?', [ctx.params.id, user.id]);
  return noContent();
});

authRouter.post('/forgot-password', async (ctx) => {
  if (!resetLimiter.take(`reset:${ctx.ip}`)) throw errors.rateLimited();
  const body = await ctx.json(v.object({ email: v.string({ email: true }) }));
  const user = db.one<{ id: string; name: string; email: string }>('SELECT id, name, email FROM users WHERE email = ?', [body.email.toLowerCase()]);
  let devLink: string | null = null;
  if (user) {
    const token = randomToken(32);
    db.run('DELETE FROM password_resets WHERE user_id = ?', [user.id]);
    db.run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?,?,?)', [sha256(token), user.id, new Date(Date.now() + 3600_000).toISOString()]);
    const link = `${config.appUrl}/reset-password?token=${token}`;
    const result = await mailer.send({
      to: user.email,
      subject: 'Reset your TeamTask password',
      text: `Hi ${user.name},\n\nUse this link to reset your password (valid for 1 hour):\n${link}\n\nIf you did not request this, you can ignore this email.`,
      html: emailTemplate('Reset your password', [`Hi ${user.name},`, 'Use the button below to choose a new password. The link is valid for 1 hour.'], { label: 'Reset password', url: link }),
    });
    if (!result.delivered && !config.isProd) devLink = link;
  }
  // Always respond the same way to avoid account enumeration.
  return { ok: true, devLink };
});

authRouter.post('/reset-password', async (ctx) => {
  const body = await ctx.json(v.object({ token: v.string({ min: 10, max: 200 }), password: v.string({ min: LIMITS.passwordMin, max: 200, trim: false }) }));
  const reset = db.one<{ user_id: string; expires_at: string; used_at: string | null }>('SELECT * FROM password_resets WHERE token_hash = ?', [sha256(body.token)]);
  if (!reset || reset.used_at || reset.expires_at < now()) throw errors.badRequest('This reset link is invalid or has expired');
  const passwordHash = await hashPassword(body.password);
  db.tx(() => {
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, reset.user_id]);
    db.run('UPDATE password_resets SET used_at = ? WHERE token_hash = ?', [now(), sha256(body.token)]);
    db.run('DELETE FROM sessions WHERE user_id = ?', [reset.user_id]);
  });
  const tokens = issueSession(ctx, reset.user_id);
  return { ...tokens, user: currentMe(reset.user_id) };
});

authRouter.post('/change-password', async (ctx) => {
  const user = ctx.requireUser();
  const body = await ctx.json(v.object({ currentPassword: v.string({ min: 1, trim: false }), newPassword: v.string({ min: LIMITS.passwordMin, max: 200, trim: false }) }));
  const row = db.one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [user.id]);
  if (!row || !(await verifyPassword(body.currentPassword, row.password_hash))) throw errors.badRequest('Current password is incorrect');
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(body.newPassword), user.id]);
  return noContent();
});

authRouter.get('/me', (ctx) => {
  const user = ctx.requireUser();
  return currentMe(user.id);
});

export { REFRESH_COOKIE, slugify };
