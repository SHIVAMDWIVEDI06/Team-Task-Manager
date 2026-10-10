// Reusable activity feed row + sentence builder (used by the dashboard; the Activity page may reuse it).
import type { ReactNode } from 'react';
import type { Activity } from '../../../../../packages/shared/src/types.ts';
import { formatMinutes } from '../../../../../packages/shared/src/utils.ts';
import { Link } from '../../lib/router.tsx';
import { relativeTime, formatDate, formatDateTime } from '../../lib/format.ts';
import { useWorkspaceOptional } from '../../app/workspace.tsx';
import { Avatar, cx } from '../../ui/primitives.tsx';
import { Icon, type IconName } from '../../ui/Icon.tsx';

type Change = { from: unknown; to: unknown };

export interface ActivityParts {
  actor: string;
  verb: string; // e.g. "completed"
  target?: { label: string; kind: 'task' | 'project' | 'text' };
  detail?: string; // trailing detail, e.g. "· priority → High"
  icon: IconName | string;
  tone?: 'success' | 'danger' | 'neutral' | 'brand' | 'warning';
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v ? v : fallback;
}

function describeChanges(changes: Record<string, Change> | undefined, lookup?: (id: string) => string | undefined): string[] {
  if (!changes) return [];
  const out: string[] = [];
  for (const [k, c] of Object.entries(changes)) {
    switch (k) {
      case 'title':
        out.push(`renamed to “${str(c.to)}”`);
        break;
      case 'priority':
        out.push(`priority → ${str(c.to, 'None')}`);
        break;
      case 'status':
        out.push(`status → ${str(c.to)}`);
        break;
      case 'dueDate':
        out.push(c.to ? `due ${formatDate(String(c.to))}` : 'cleared the due date');
        break;
      case 'startDate':
        out.push(c.to ? `starts ${formatDate(String(c.to))}` : 'cleared the start date');
        break;
      case 'assigneeId':
        out.push(c.to ? `assigned to ${lookup?.(String(c.to)) ?? 'a teammate'}` : 'unassigned');
        break;
      case 'labelIds':
        out.push('changed labels');
        break;
      case 'description':
        out.push('edited the description');
        break;
      case 'estimateMinutes':
        out.push(c.to ? `estimate ${formatMinutes(Number(c.to))}` : 'cleared the estimate');
        break;
      case 'recurrence':
        out.push(c.to ? 'set to repeat' : 'stopped repeating');
        break;
      case 'parentId':
        out.push(c.to ? 'made it a subtask' : 'detached it from its parent');
        break;
      case 'archived':
        out.push(c.to ? 'archived it' : 'restored it');
        break;
      case 'statusId':
        break;
      default:
        out.push(`updated ${k}`);
    }
  }
  return out;
}

/** Structured parts of an activity sentence. `lookup` resolves user ids to names for assignment changes. */
export function activityParts(a: Activity, lookup?: (id: string) => string | undefined): ActivityParts {
  const actor = a.actor?.name ?? 'Someone';
  const d = a.data ?? {};
  const taskLabel = a.task ? `${a.task.key} ${a.task.title}` : `${str(d.key)} ${str(d.title)}`.trim();
  const task = (): ActivityParts['target'] => (taskLabel ? { label: taskLabel, kind: a.task ? 'task' : 'text' } : undefined);
  const project = (): ActivityParts['target'] => (a.project ? { label: a.project.name, kind: 'project' } : str(d.name) ? { label: str(d.name), kind: 'text' } : undefined);
  const changes = d.changes as Record<string, Change> | undefined;
  switch (a.type) {
    case 'task.created':
      return { actor, verb: 'created', target: task(), icon: 'plus', tone: 'brand' };
    case 'task.completed':
      return { actor, verb: 'completed', target: task(), icon: 'circle-check', tone: 'success' };
    case 'task.moved':
      return { actor, verb: changes?.status?.to ? `moved` : 'updated', target: task(), detail: changes?.status?.to ? `to ${str(changes.status.to)}` : undefined, icon: 'move' };
    case 'task.assigned': {
      const to = changes?.assigneeId?.to;
      return { actor, verb: to ? 'assigned' : 'unassigned', target: task(), detail: to ? `to ${lookup?.(String(to)) ?? 'a teammate'}` : undefined, icon: 'user' };
    }
    case 'task.updated': {
      const bits = describeChanges(changes, lookup).filter((b) => !b.startsWith('assigned') && !b.startsWith('unassigned'));
      return { actor, verb: 'updated', target: task(), detail: bits.length ? `· ${bits.slice(0, 2).join(', ')}${bits.length > 2 ? ` +${bits.length - 2}` : ''}` : undefined, icon: 'pencil' };
    }
    case 'task.deleted':
      return { actor, verb: 'deleted', target: task(), icon: 'trash', tone: 'danger' };
    case 'task.commented':
      return { actor, verb: 'commented on', target: task(), detail: str(d.excerpt) ? `“${str(d.excerpt).slice(0, 80)}${str(d.excerpt).length > 80 ? '…' : ''}”` : undefined, icon: 'message' };
    case 'task.attachment_added': {
      const files = Array.isArray(d.files) ? (d.files as string[]) : [];
      return { actor, verb: files.length === 1 ? `attached ${files[0]} to` : `attached ${files.length || 'some'} files to`, target: task(), icon: 'paperclip' };
    }
    case 'task.time_logged':
      return { actor, verb: `logged ${formatMinutes(Number(d.minutes) || 0)} on`, target: task(), icon: 'timer' };
    case 'project.created':
      return { actor, verb: 'created project', target: project(), icon: 'folder-plus', tone: 'brand' };
    case 'project.updated':
      return { actor, verb: 'updated project', target: project(), icon: 'folder' };
    case 'project.archived':
      return { actor, verb: 'archived project', target: project(), icon: 'archive', tone: 'warning' };
    case 'project.deleted':
      return { actor, verb: 'deleted project', target: project(), icon: 'trash', tone: 'danger' };
    case 'member.joined':
      return { actor, verb: 'joined the workspace', detail: str(d.role) ? `as ${str(d.role)}` : undefined, icon: 'user-plus', tone: 'success' };
    case 'member.role_changed':
      return { actor, verb: `changed ${lookup?.(str(d.userId)) ?? 'a member'}'s role`, detail: str(d.to) ? `to ${str(d.to)}` : undefined, icon: 'shield' };
    case 'member.removed':
      return d.left ? { actor, verb: 'left the workspace', icon: 'log-out' } : { actor, verb: `removed ${lookup?.(str(d.userId)) ?? 'a member'}`, icon: 'ban', tone: 'danger' };
    case 'invite.sent':
      return { actor, verb: 'invited', target: { label: str(d.email, 'someone'), kind: 'text' }, icon: 'mail' };
    case 'invite.revoked':
      return { actor, verb: 'revoked the invitation for', target: { label: str(d.email, 'someone'), kind: 'text' }, icon: 'ban' };
    case 'workspace.updated':
      return { actor, verb: 'updated workspace settings', icon: 'settings' };
    default:
      return { actor, verb: String(a.type).replace('.', ' '), icon: 'activity' };
  }
}

/** Plain-text sentence, e.g. "Shivam completed APP-12 Fix login". */
export function activitySentence(a: Activity, lookup?: (id: string) => string | undefined): string {
  const p = activityParts(a, lookup);
  return [p.actor, p.verb, p.target?.label, p.detail].filter(Boolean).join(' ');
}

export function ActivityItem({ activity, base, showProject = true, compact }: { activity: Activity; base: string; showProject?: boolean; compact?: boolean }) {
  const ws = useWorkspaceOptional();
  const lookup = (id: string) => ws?.member(id)?.user.name;
  const p = activityParts(activity, lookup);
  let target: ReactNode = null;
  if (p.target) {
    if (p.target.kind === 'task' && activity.task) {
      const projectKey = activity.project?.key ?? activity.task.key.split('-')[0];
      target = (
        <Link to={`${base}/p/${projectKey}?task=${activity.task.key}`} className="actv-target actv-task" onClick={(e) => e.stopPropagation()}>
          <span className="task-key mono">{activity.task.key}</span>
          <span className="actv-task-title">{activity.task.title}</span>
        </Link>
      );
    } else if (p.target.kind === 'project' && activity.project) {
      target = (
        <Link to={`${base}/p/${activity.project.key}`} className="actv-target actv-project" onClick={(e) => e.stopPropagation()}>
          <span className="dot" style={{ background: activity.project.color, width: 8, height: 8 }} />
          {activity.project.name}
        </Link>
      );
    } else target = <span className="actv-target">{p.target.label}</span>;
  }
  return (
    <div className={cx('actv-item', compact && 'is-compact', p.tone && `tone-${p.tone}`)}>
      <span className="actv-avatar">
        {activity.actor ? <Avatar name={activity.actor.name} src={activity.actor.avatarUrl} size={compact ? 22 : 26} /> : <span className="avatar actv-avatar-sys"><Icon name="zap" size={12} /></span>}
        <span className="actv-icon"><Icon name={p.icon} size={9} strokeWidth={2.5} /></span>
      </span>
      <span className="actv-body">
        <span className="actv-sentence">
          <b>{p.actor}</b> {p.verb} {target}
          {p.detail ? <span className="actv-detail">{p.detail}</span> : null}
        </span>
        <span className="actv-meta xs muted">
          <time dateTime={activity.createdAt} title={formatDateTime(activity.createdAt)}>{relativeTime(activity.createdAt)}</time>
          {showProject && activity.project && p.target?.kind !== 'project' ? (
            <>
              <span className="actv-meta-sep" />
              <span className="row gap-1"><span className="dot" style={{ background: activity.project.color, width: 6, height: 6 }} />{activity.project.name}</span>
            </>
          ) : null}
        </span>
      </span>
    </div>
  );
}
