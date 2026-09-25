// Humanized activity feed: one sentence per event, grouped by day, task keys link to the task peek panel.
import { Fragment, useMemo, type ReactNode } from 'react';
import type { Activity } from '../../../../../packages/shared/src/types.ts';
import { formatMinutes } from '../../../../../packages/shared/src/utils.ts';
import { useWorkspace } from '../../app/workspace.tsx';
import { navigate } from '../../lib/router.tsx';
import { formatDateTime, relativeTime } from '../../lib/format.ts';
import { Icon, type IconName } from '../../ui/Icon.tsx';
import { Avatar, cx } from '../../ui/primitives.tsx';
import './activity.css';

type Change = { from: unknown; to: unknown };
type Changes = Record<string, Change>;

const FIELD_LABEL: Record<string, string> = {
  title: 'title',
  description: 'description',
  priority: 'priority',
  dueDate: 'due date',
  startDate: 'start date',
  estimateMinutes: 'estimate',
  labelIds: 'labels',
  parentId: 'parent',
  recurrence: 'recurrence',
  archived: 'archive state',
  assigneeId: 'assignee',
  status: 'status',
  name: 'name',
  key: 'key',
  color: 'color',
  icon: 'icon',
  leadId: 'lead',
  visibility: 'visibility',
  targetDate: 'target date',
  logoUrl: 'logo',
  state: 'state',
};

function fieldList(obj: Record<string, unknown> | undefined, skip: string[] = []): string {
  if (!obj) return '';
  const names = Object.keys(obj).filter((k) => !skip.includes(k)).map((k) => FIELD_LABEL[k] ?? k.replace(/([A-Z])/g, ' $1').toLowerCase());
  if (!names.length) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function str(v: unknown): string {
  return v == null || v === '' ? '' : String(v);
}

export interface ActivityText {
  /** Verb phrase before the target, e.g. "moved". */
  action: string;
  /** Task the event is about (may be missing for deleted tasks). */
  task?: { key: string; title: string } | null;
  /** Text after the target, e.g. "from Todo to Done". */
  detail?: string;
  /** Quoted excerpt (comments). */
  excerpt?: string;
  icon: IconName;
}

/** Structured description of an activity. `nameOf` resolves user ids to display names. */
export function describeActivity(a: Activity, nameOf: (id: string) => string | undefined = () => undefined): ActivityText {
  const d = (a.data ?? {}) as Record<string, unknown>;
  const changes = (d.changes ?? {}) as Changes;
  const task = a.task ? { key: a.task.key, title: a.task.title } : d.key ? { key: String(d.key), title: str(d.title) } : null;
  const who = (id: unknown) => (id ? nameOf(String(id)) ?? 'a former member' : '');
  const projectName = a.project?.name ?? str(d.name);
  switch (a.type) {
    case 'task.created':
      return { action: 'created', task, icon: 'plus' };
    case 'task.deleted':
      return { action: 'deleted', task, icon: 'trash' };
    case 'task.moved': {
      const s = changes.status;
      return { action: 'moved', task, detail: s ? `from ${str(s.from)} to ${str(s.to)}` : '', icon: 'move' };
    }
    case 'task.completed': {
      const s = changes.status;
      return { action: 'completed', task, detail: s && s.from ? `(${str(s.from)} → ${str(s.to)})` : '', icon: 'circle-check' };
    }
    case 'task.assigned': {
      const c = changes.assigneeId;
      if (c && !c.to) return { action: 'unassigned', task, detail: c.from ? `(was ${who(c.from)})` : '', icon: 'user' };
      const to = c ? who(c.to) : '';
      return { action: 'assigned', task, detail: to === nameOf(a.actorId ?? '') ? 'to themselves' : `to ${to || 'someone'}`, icon: 'user' };
    }
    case 'task.updated': {
      const fields = fieldList(changes);
      return { action: fields ? `updated ${fields} on` : 'updated', task, icon: 'pencil' };
    }
    case 'task.commented':
      return { action: 'commented on', task, excerpt: str(d.excerpt), icon: 'message' };
    case 'task.attachment_added': {
      const files = Array.isArray(d.files) ? (d.files as string[]) : [];
      return { action: files.length === 1 ? 'attached a file to' : `attached ${files.length || 'some'} files to`, task, detail: files.length === 1 ? `(${files[0]})` : '', icon: 'paperclip' };
    }
    case 'task.time_logged':
      return { action: `logged ${formatMinutes(Number(d.minutes) || 0)} on`, task, icon: 'timer' };
    case 'project.created':
      return { action: `created project ${projectName}`, icon: 'folder-plus' };
    case 'project.updated': {
      const fields = fieldList(d, ['changes']);
      return { action: `updated ${fields ? `${fields} of ` : ''}project ${projectName}`, icon: 'folder' };
    }
    case 'project.archived':
      return { action: `archived project ${projectName}`, icon: 'archive' };
    case 'project.deleted':
      return { action: `deleted project ${projectName}${d.key ? ` (${str(d.key)})` : ''}`, icon: 'trash' };
    case 'member.joined':
      return { action: `joined the workspace${d.role ? ` as ${str(d.role)}` : ''}`, icon: 'user-plus' };
    case 'member.role_changed':
      return { action: `changed ${who(d.userId)}'s role from ${str(d.from)} to ${str(d.to)}`, icon: 'shield' };
    case 'member.removed':
      return d.left ? { action: 'left the workspace', icon: 'log-out' } : { action: `removed ${who(d.userId)} from the workspace`, icon: 'user' };
    case 'invite.sent':
      return { action: `invited ${str(d.email)}${d.role ? ` as ${str(d.role)}` : ''}`, icon: 'mail' };
    case 'invite.revoked':
      return { action: `revoked the invite for ${str(d.email)}`, icon: 'ban' };
    case 'workspace.updated': {
      const fields = fieldList(d);
      return { action: `updated the workspace${fields ? ` ${fields}` : ' settings'}`, icon: 'settings' };
    }
    default:
      return { action: String(a.type).replace('.', ' '), task, icon: 'activity' };
  }
}

/** Plain-text sentence, e.g. "Priya moved APP-12 from Todo to Done". */
export function activitySentence(a: Activity, nameOf?: (id: string) => string | undefined): string {
  const t = describeActivity(a, nameOf);
  const actor = a.actor?.name ?? (a.actorId ? nameOf?.(a.actorId) : null) ?? 'Someone';
  const parts = [actor, t.action];
  if (t.task) parts.push(t.task.key);
  if (t.detail) parts.push(t.detail);
  let s = parts.join(' ');
  if (t.excerpt) s += `: ${t.excerpt}`;
  return s;
}

export function activityGroup(type: Activity['type']): 'tasks' | 'comments' | 'people' {
  if (type === 'task.commented') return 'comments';
  if (type.startsWith('task.')) return 'tasks';
  return 'people';
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayLabel(key: string): string {
  const today = dayKey(new Date().toISOString());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === today) return 'Today';
  if (key === dayKey(y.toISOString())) return 'Yesterday';
  const [yy, mm, dd] = key.split('-').map(Number);
  const d = new Date(yy, mm - 1, dd);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

export function ActivityItem({ activity, base, showProject = true }: { activity: Activity; base: string; showProject?: boolean }) {
  const ws = useWorkspace();
  const nameOf = (id: string) => ws.member(id)?.user.name;
  const t = describeActivity(activity, nameOf);
  const actorName = activity.actor?.name ?? (activity.actorId ? nameOf(activity.actorId) : null) ?? 'Someone';
  const canOpen = Boolean(t.task && activity.project?.key && activity.type !== 'task.deleted');
  const open = () => {
    if (!canOpen || !t.task || !activity.project) return;
    navigate(`${base}/p/${activity.project.key}?task=${encodeURIComponent(t.task.key)}`);
  };
  return (
    <div className="activity-item" data-activity-id={activity.id} data-type={activity.type}>
      <span className="activity-avatar">
        {activity.actor ? <Avatar name={activity.actor.name} src={activity.actor.avatarUrl} size={28} /> : <span className="activity-avatar-fallback"><Icon name="zap" size={13} /></span>}
        <span className="activity-type-icon"><Icon name={t.icon} size={9} /></span>
      </span>
      <div className="activity-body">
        <div className="activity-sentence">
          <span className="activity-actor">{actorName}</span> {t.action}{' '}
          {t.task ? (
            canOpen ? (
              <button type="button" className="activity-task" onClick={open} title={t.task.title}>
                <span className="mono activity-task-key">{t.task.key}</span>
                <span className="activity-task-title truncate">{t.task.title}</span>
              </button>
            ) : (
              <span className="activity-task is-static" title={t.task.title}>
                <span className="mono activity-task-key">{t.task.key}</span>
                <span className="activity-task-title truncate">{t.task.title}</span>
              </span>
            )
          ) : null}
          {t.detail ? <span className="activity-detail"> {t.detail}</span> : null}
        </div>
        {t.excerpt ? <div className="activity-excerpt">{t.excerpt}</div> : null}
        <div className="activity-meta">
          {showProject && activity.project ? (
            <span className="activity-project" title={activity.project.name}>
              <span className="dot" style={{ background: activity.project.color, width: 7, height: 7 }} />
              {activity.project.key}
            </span>
          ) : null}
          <time dateTime={activity.createdAt} title={formatDateTime(activity.createdAt)}>{relativeTime(activity.createdAt)}</time>
        </div>
      </div>
    </div>
  );
}

export function ActivityFeed({ activities, base, showProject = true, className, footer }: { activities: Activity[]; base: string; showProject?: boolean; className?: string; footer?: ReactNode }) {
  const groups = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of activities) {
      const k = dayKey(a.createdAt);
      const arr = map.get(k);
      if (arr) arr.push(a);
      else map.set(k, [a]);
    }
    return [...map.entries()];
  }, [activities]);
  return (
    <div className={cx('activity-feed', className)}>
      {groups.map(([day, items]) => (
        <Fragment key={day}>
          <div className="activity-day" role="heading" aria-level={3}>
            <span>{dayLabel(day)}</span>
            <span className="activity-day-count tabular">{items.length}</span>
          </div>
          <div className="activity-group">
            {items.map((a) => (
              <ActivityItem key={a.id} activity={a} base={base} showProject={showProject} />
            ))}
          </div>
        </Fragment>
      ))}
      {footer}
    </div>
  );
}
