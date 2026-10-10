// Activity: humanized per-task history (from the task activity feed, kept live by lib/realtime).
import { useMemo, type ReactNode } from 'react';
import type { Activity } from '../../../../../../packages/shared/src/types.ts';
import { formatMinutes } from '../../../../../../packages/shared/src/utils.ts';
import { useTaskActivity } from '../../../app/data.ts';
import { useWorkspace } from '../../../app/workspace.tsx';
import { formatDate, formatDateTime, relativeTime } from '../../../lib/format.ts';
import { Avatar, Button, EmptyState, Skeleton } from '../../../ui/primitives.tsx';
import { Tooltip } from '../../../ui/overlays.tsx';
import { Icon, type IconName } from '../../../ui/Icon.tsx';
import { useTaskCtx } from './Section.tsx';

type Change = { from: unknown; to: unknown };
const ICONS: Partial<Record<Activity['type'], IconName>> = {
  'task.created': 'plus',
  'task.updated': 'pencil',
  'task.moved': 'circle-half',
  'task.completed': 'circle-check',
  'task.assigned': 'user',
  'task.commented': 'message',
  'task.attachment_added': 'paperclip',
  'task.time_logged': 'clock',
  'task.deleted': 'trash',
};

const b = (v: ReactNode) => <b className="task-activity-value">{v}</b>;
const str = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
const plain = (s: string) => s.replace(/@\[([^\]]+)\]\([A-Za-z0-9_-]+\)/g, '@$1').replace(/\s+/g, ' ').trim();

/** Build a list of sentence fragments ("changed status from X to Y") for one activity. */
function describe(a: Activity, name: (id: unknown) => string): ReactNode[] {
  const d = a.data as { changes?: Record<string, Change>; minutes?: number; files?: string[]; excerpt?: string };
  const changes = d.changes ?? {};
  const out: ReactNode[] = [];
  switch (a.type) {
    case 'task.created':
      return ['created this task'];
    case 'task.commented':
      return [<>commented{d.excerpt ? <>: <span className="task-activity-excerpt">“{plain(d.excerpt)}”</span></> : null}</>];
    case 'task.attachment_added':
      return [<>added {d.files?.length === 1 ? <>attachment {b(d.files[0])}</> : <>{d.files?.length ?? ''} attachments{d.files?.length ? ` (${d.files.join(', ')})` : ''}</>}</>];
    case 'task.time_logged':
      return [<>logged {b(formatMinutes(d.minutes ?? 0))}</>];
    case 'task.deleted':
      return ['deleted this task'];
    default:
      break;
  }
  for (const [field, c] of Object.entries(changes)) {
    switch (field) {
      case 'status':
        out.push(<>changed status from {b(str(c.from) ?? '—')} to {b(str(c.to) ?? '—')}</>);
        break;
      case 'statusId':
        break;
      case 'assigneeId':
        out.push(c.to ? <>assigned to {b(name(c.to))}</> : <>unassigned {b(name(c.from))}</>);
        break;
      case 'priority':
        out.push(<>changed priority from {b(str(c.from) ?? 'None')} to {b(str(c.to) ?? 'None')}</>);
        break;
      case 'title':
        out.push(<>renamed to {b(str(c.to))}</>);
        break;
      case 'description':
        out.push('edited the description');
        break;
      case 'dueDate':
        out.push(c.to ? <>set due date to {b(formatDate(String(c.to)))}</> : 'removed the due date');
        break;
      case 'startDate':
        out.push(c.to ? <>set start date to {b(formatDate(String(c.to)))}</> : 'removed the start date');
        break;
      case 'estimateMinutes':
        out.push(c.to ? <>set estimate to {b(formatMinutes(Number(c.to)))}</> : 'removed the estimate');
        break;
      case 'labelIds':
        out.push('updated labels');
        break;
      case 'archived':
        out.push(c.to ? 'archived this task' : 'unarchived this task');
        break;
      case 'parentId':
        out.push(c.to ? 'made this a subtask' : 'made this a top-level task');
        break;
      case 'recurrence':
        out.push(c.to ? 'set a recurrence' : 'removed the recurrence');
        break;
      case 'position':
        break;
      default:
        out.push(`updated ${field}`);
    }
  }
  if (!out.length) out.push(a.type === 'task.completed' ? 'completed this task' : a.type === 'task.moved' ? 'moved this task' : a.type === 'task.assigned' ? 'changed the assignee' : 'updated this task');
  return out;
}

function joinFragments(parts: ReactNode[]): ReactNode {
  return parts.map((p, i) => (
    <span key={i}>
      {i > 0 ? (i === parts.length - 1 ? ' and ' : ', ') : ''}
      {p}
    </span>
  ));
}

export function ActivityList() {
  const { task } = useTaskCtx();
  const ws = useWorkspace();
  const q = useTaskActivity(task.id);
  const name = (id: unknown) => (typeof id === 'string' ? ws.member(id)?.user.name ?? 'someone' : 'someone');
  const items = useMemo(() => [...(q.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [q.data]);

  if (q.isLoading) {
    return (
      <div className="col gap-3 mt-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="row gap-3"><Skeleton width={22} height={22} radius="50%" /><Skeleton height={12} width={i % 2 ? '70%' : '55%'} /></div>
        ))}
      </div>
    );
  }
  if (q.error) return <EmptyState compact icon="alert-circle" title="Couldn't load activity" description={q.error.message} action={<Button size="sm" onClick={() => void q.refetch()}>Retry</Button>} />;
  if (!items.length) return <EmptyState compact icon="activity" title="No activity yet" />;
  return (
    <ol className="task-activity" aria-label="Activity">
      {items.map((a) => (
        <li key={a.id} className="task-activity-item">
          <span className="task-activity-avatar">
            {a.actor ? <Avatar name={a.actor.name} src={a.actor.avatarUrl} size={22} /> : <span className="task-activity-sys"><Icon name="zap" size={12} /></span>}
            <span className="task-activity-type"><Icon name={ICONS[a.type] ?? 'activity'} size={9} /></span>
          </span>
          <span className="task-activity-text">
            <span className="task-activity-actor">{a.actor?.name ?? 'System'}</span> {joinFragments(describe(a, name))}
          </span>
          <Tooltip content={formatDateTime(a.createdAt)}><span className="task-activity-time xs muted">{relativeTime(a.createdAt)}</span></Tooltip>
        </li>
      ))}
    </ol>
  );
}
