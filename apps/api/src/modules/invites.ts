import { Router, created, noContent } from '../lib/http.ts';
import { db, now } from '../db/index.ts';
import { errors } from '../lib/errors.ts';
import { newId, randomToken } from '../lib/crypto.ts';
import { config } from '../config.ts';
import { requireMember } from '../lib/access.ts';
import { inviteFromRow } from '../lib/serialize.ts';
import { logActivity, notify } from '../lib/services.ts';
import { realtime } from '../lib/realtime.ts';
import { mailer, emailTemplate } from '../lib/mailer.ts';
import { v } from '../../../../packages/shared/src/index.ts';
import type { WorkspaceRole } from '../../../../packages/shared/src/types.ts';

const INVITE_SELECT = `SELECT i.*, u.id AS inviter_id, u.name AS inviter_name, u.avatar_url AS inviter_avatar
  FROM invites i LEFT JOIN users u ON u.id = i.invited_by`;

export function inviteLink(token: string) {
  return `${config.appUrl}/invite/${token}`;
}

/** Accept an invite on behalf of a user. Returns the workspace. Throws on invalid/expired. */
export function acceptInviteForUser(token: string, userId: string, userEmail: string) {
  const inv = db.one<Record<string, unknown>>('SELECT * FROM invites WHERE token = ?', [token]);
  if (!inv) throw errors.notFound('Invite');
  if (inv.status !== 'pending') throw errors.badRequest('This invite is no longer valid');
  if ((inv.expires_at as string) < now()) {
    db.run(`UPDATE invites SET status = 'expired' WHERE id = ?`, [inv.id as string]);
    throw errors.badRequest('This invite has expired');
  }
  if ((inv.email as string).toLowerCase() !== userEmail.toLowerCase()) {
    throw errors.forbidden(`This invite was sent to ${inv.email as string}. Sign in with that email to accept it.`);
  }
  const ws = db.one<{ id: string; slug: string; name: string }>('SELECT id, slug, name FROM workspaces WHERE id = ?', [inv.workspace_id as string]);
  if (!ws) throw errors.notFound('Workspace');
  db.tx(() => {
    const existing = db.one('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [ws.id, userId]);
    if (!existing) {
      db.run('INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?,?,?,?)', [ws.id, userId, inv.role as string, now()]);
    }
    db.run(`UPDATE invites SET status = 'accepted', accepted_at = ? WHERE id = ?`, [now(), inv.id as string]);
  });
  logActivity({ workspaceId: ws.id, actorId: userId, type: 'member.joined', data: { role: inv.role } });
  realtime.publish(ws.id, { type: 'members.changed', workspaceId: ws.id });
  return ws;
}

export const invitesRouter = new Router('/api');

// List pending invites of a workspace (admin+)
invitesRouter.get('/workspaces/:id/invites', (ctx) => {
  const user = ctx.requireUser();
  requireMember(user.id, ctx.params.id, 'admin');
  return db
    .all(`${INVITE_SELECT} WHERE i.workspace_id = ? AND i.status = 'pending' ORDER BY i.created_at DESC`, [ctx.params.id])
    .map((r) => ({ ...inviteFromRow(r), link: inviteLink(r.token as string) }));
});

invitesRouter.post('/workspaces/:id/invites', async (ctx) => {
  const user = ctx.requireUser();
  const role = requireMember(user.id, ctx.params.id, 'admin');
  const body = await ctx.json(
    v.object({
      emails: v.array(v.string({ email: true }), { max: 50 }),
      role: v.enum(['admin', 'member', 'guest'] as const).default('member'),
      message: v.string({ max: 500 }).optional(),
    }),
  );
  if (body.role === 'admin' && role !== 'owner' && role !== 'admin') throw errors.forbidden();
  const ws = db.one<{ name: string; slug: string }>('SELECT name, slug FROM workspaces WHERE id = ?', [ctx.params.id])!;
  const inviter = db.one<{ name: string }>('SELECT name FROM users WHERE id = ?', [user.id])!;
  const results: { email: string; status: 'sent' | 'already_member' | 'already_invited'; link?: string; emailed?: boolean }[] = [];

  for (const emailRaw of body.emails) {
    const email = emailRaw.toLowerCase();
    const member = db.one('SELECT 1 FROM workspace_members wm JOIN users u ON u.id = wm.user_id WHERE wm.workspace_id = ? AND u.email = ?', [ctx.params.id, email]);
    if (member) {
      results.push({ email, status: 'already_member' });
      continue;
    }
    const pending = db.one<{ token: string }>(`SELECT token FROM invites WHERE workspace_id = ? AND email = ? AND status = 'pending' AND expires_at > ?`, [ctx.params.id, email, now()]);
    if (pending) {
      results.push({ email, status: 'already_invited', link: inviteLink(pending.token) });
      continue;
    }
    const token = randomToken(24);
    const id = newId();
    db.run(
      `INSERT INTO invites (id, workspace_id, email, role, token, invited_by, status, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, ctx.params.id, email, body.role, token, user.id, 'pending', new Date(Date.now() + 7 * 86400_000).toISOString(), now()],
    );
    const link = inviteLink(token);
    const sent = await mailer.send({
      to: email,
      subject: `${inviter.name} invited you to ${ws.name} on TeamTask`,
      text: `${inviter.name} invited you to join the "${ws.name}" workspace on TeamTask.\n${body.message ? `\n"${body.message}"\n` : ''}\nAccept the invite: ${link}\n\nThis link expires in 7 days.`,
      html: emailTemplate(`Join ${ws.name} on TeamTask`, [`${inviter.name} invited you to join the "${ws.name}" workspace.`, ...(body.message ? [`"${body.message}"`] : []), 'This link expires in 7 days.'], { label: 'Accept invitation', url: link }),
    });
    // If the invitee already has an account, also notify them in-app.
    const existingUser = db.one<{ id: string }>('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      notify({ userId: existingUser.id, type: 'invite', title: `${inviter.name} invited you to ${ws.name}`, body: 'Open the invitation to join the workspace.', link: `/invite/${token}`, actorId: user.id });
    }
    logActivity({ workspaceId: ctx.params.id, actorId: user.id, type: 'invite.sent', data: { email, role: body.role } });
    results.push({ email, status: 'sent', link, emailed: sent.delivered });
  }
  return created({ results, emailConfigured: mailer.enabled });
});

invitesRouter.delete('/workspaces/:id/invites/:inviteId', (ctx) => {
  const user = ctx.requireUser();
  requireMember(user.id, ctx.params.id, 'admin');
  const inv = db.one<{ email: string }>('SELECT email FROM invites WHERE id = ? AND workspace_id = ?', [ctx.params.inviteId, ctx.params.id]);
  if (!inv) throw errors.notFound('Invite');
  db.run(`UPDATE invites SET status = 'revoked' WHERE id = ?`, [ctx.params.inviteId]);
  logActivity({ workspaceId: ctx.params.id, actorId: user.id, type: 'invite.revoked', data: { email: inv.email } });
  return noContent();
});

// Public preview of an invite (no auth) so the landing page can show workspace name.
invitesRouter.get('/invites/:token', (ctx) => {
  const inv = db.one<Record<string, unknown>>(
    `SELECT i.*, w.name AS workspace_name, u.name AS inviter_name FROM invites i
     JOIN workspaces w ON w.id = i.workspace_id LEFT JOIN users u ON u.id = i.invited_by WHERE i.token = ?`,
    [ctx.params.token],
  );
  if (!inv) throw errors.notFound('Invite');
  const valid = inv.status === 'pending' && (inv.expires_at as string) > now();
  const hasAccount = Boolean(db.one('SELECT 1 FROM users WHERE email = ?', [inv.email as string]));
  return {
    workspaceName: inv.workspace_name,
    inviterName: inv.inviter_name || 'A teammate',
    email: inv.email,
    role: inv.role as WorkspaceRole,
    expiresAt: inv.expires_at,
    status: valid ? 'pending' : inv.status === 'pending' ? 'expired' : inv.status,
    hasAccount,
  };
});

invitesRouter.post('/invites/:token/accept', (ctx) => {
  const user = ctx.requireUser();
  const me = db.one<{ email: string }>('SELECT email FROM users WHERE id = ?', [user.id])!;
  const ws = acceptInviteForUser(ctx.params.token, user.id, me.email);
  return { workspaceId: ws.id, slug: ws.slug, name: ws.name };
});
