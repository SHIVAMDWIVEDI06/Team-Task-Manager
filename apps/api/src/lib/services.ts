// Cross-cutting services: activity log, notifications, mentions.
import { db, now } from '../db/index.ts';
import { newId } from './crypto.ts';
import { realtime } from './realtime.ts';
import { mailer, emailTemplate } from './mailer.ts';
import { config } from '../config.ts';
import { activityFromRow, notificationFromRow, meFromRow } from './serialize.ts';
import type { ActivityType, NotificationType } from '../../../../packages/shared/src/types.ts';

export const ACTIVITY_SELECT = `
  SELECT a.*, u.id AS actor_id, u.name AS actor_name, u.avatar_url AS actor_avatar,
         t.title AS task_title, t.number AS task_number,
         p.key AS project_key, p.name AS project_name, p.color AS project_color
  FROM activities a
  LEFT JOIN users u ON u.id = a.actor_id
  LEFT JOIN tasks t ON t.id = a.task_id
  LEFT JOIN projects p ON p.id = a.project_id`;

export function logActivity(input: {
  workspaceId: string;
  projectId?: string | null;
  taskId?: string | null;
  actorId: string | null;
  type: ActivityType;
  data?: Record<string, unknown>;
}) {
  const id = newId();
  db.run(
    `INSERT INTO activities (id, workspace_id, project_id, task_id, actor_id, type, data, created_at) VALUES (?,?,?,?,?,?,?,?)`,
    [id, input.workspaceId, input.projectId ?? null, input.taskId ?? null, input.actorId, input.type, JSON.stringify(input.data || {}), now()],
  );
  const row = db.one(`${ACTIVITY_SELECT} WHERE a.id = ?`, [id]);
  if (row) realtime.publish(input.workspaceId, { type: 'activity', activity: activityFromRow(row) });
  return id;
}

const NOTIF_SELECT = `SELECT n.*, u.id AS actor_id, u.name AS actor_name, u.avatar_url AS actor_avatar
  FROM notifications n LEFT JOIN users u ON u.id = n.actor_id`;

export function notify(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string | null;
  actorId?: string | null;
  email?: { subject: string; lines: string[]; cta?: { label: string; url: string } };
}) {
  if (input.actorId && input.actorId === input.userId) return; // never notify yourself
  const userRow = db.one('SELECT * FROM users WHERE id = ?', [input.userId]);
  if (!userRow) return;
  const me = meFromRow(userRow);
  const prefs = me.preferences.notifications;
  const enabledByType: Record<NotificationType, boolean> = {
    assigned: prefs.assigned,
    mentioned: prefs.mentioned,
    commented: prefs.comments,
    status_changed: prefs.statusChanges,
    due_soon: prefs.dueSoon,
    invite: true,
    watching: prefs.comments,
  };
  if (!enabledByType[input.type]) return;

  const id = newId();
  db.run(
    `INSERT INTO notifications (id, user_id, type, title, body, link, actor_id, created_at) VALUES (?,?,?,?,?,?,?,?)`,
    [id, input.userId, input.type, input.title, input.body || '', input.link ?? null, input.actorId ?? null, now()],
  );
  const row = db.one(`${NOTIF_SELECT} WHERE n.id = ?`, [id]);
  if (row) realtime.publishToUser(input.userId, { type: 'notification', notification: notificationFromRow(row) });

  if (input.email && prefs.email && mailer.enabled) {
    const cta = input.email.cta || (input.link ? { label: 'Open in TeamTask', url: `${config.appUrl}${input.link}` } : undefined);
    void mailer.send({
      to: me.email,
      subject: input.email.subject,
      text: `${input.email.lines.join('\n')}${cta ? `\n\n${cta.url}` : ''}`,
      html: emailTemplate(input.title, input.email.lines, cta),
    });
  }
}

/** Extract @mentions of the form @[Name](userId) or @userId from markdown-ish text. */
export function extractMentions(text: string): string[] {
  const ids = new Set<string>();
  const re = /@\[[^\]]+\]\(([A-Za-z0-9_-]{6,32})\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) ids.add(m[1]);
  return [...ids];
}

/** Everyone who should hear about changes to a task (assignee, reporter, watchers) except the actor. */
export function taskAudience(taskId: string, exceptUserId: string | null): string[] {
  const rows = db.all<{ user_id: string }>(
    `SELECT assignee_id AS user_id FROM tasks WHERE id = ? AND assignee_id IS NOT NULL
     UNION SELECT reporter_id FROM tasks WHERE id = ? AND reporter_id IS NOT NULL
     UNION SELECT user_id FROM task_watchers WHERE task_id = ?`,
    [taskId, taskId, taskId],
  );
  return rows.map((r) => r.user_id).filter((id) => id && id !== exceptUserId);
}

export function taskLink(workspaceSlug: string, projectKey: string, number: number): string {
  return `/w/${workspaceSlug}/p/${projectKey}?task=${projectKey}-${number}`;
}
