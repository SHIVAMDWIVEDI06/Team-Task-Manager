// Compact, reusable task row for cross-project lists (Home, My work, search results, command palette).
// Also owns the "recent tasks" memory used by the command palette.
import type { ReactNode } from 'react';
import type { Task, TaskStatus } from '../../../../../packages/shared/src/types.ts';
import { navigate, useLocation } from '../../lib/router.tsx';
import { useWorkspace } from '../../app/workspace.tsx';
import { Avatar, PriorityIcon, StatusIcon, cx } from '../../ui/primitives.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { DueBadge, DueDateButton, PriorityPicker, ProjectBadge, StatusPicker, TaskKey } from './fields.tsx';
import type { TaskPatch } from '../../app/data.ts';
import './task-row.css';

export type TaskLike = Pick<Task, 'key' | 'title'> & Partial<Task>;

export interface RecentTask {
  key: string;
  title: string;
  projectKey?: string;
  projectColor?: string;
  statusCategory?: string;
  statusColor?: string;
  at: number;
}

const RECENT_MAX = 8;
export const recentTasksKey = (wsId: string) => `tt.recentTasks:${wsId}`;

/** Remember a task as recently opened (most recent first, max 8). */
export function rememberRecentTask(wsId: string, task: TaskLike) {
  try {
    const list = readRecentTasks(wsId).filter((r) => r.key !== task.key);
    list.unshift({ key: task.key, title: task.title, projectKey: task.projectKey, projectColor: task.projectColor, statusCategory: task.statusCategory, statusColor: task.statusColor, at: Date.now() });
    localStorage.setItem(recentTasksKey(wsId), JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    /* ignore */
  }
}

export function readRecentTasks(wsId: string): RecentTask[] {
  try {
    const raw = localStorage.getItem(recentTasksKey(wsId));
    const list = raw ? (JSON.parse(raw) as RecentTask[]) : [];
    return Array.isArray(list) ? list.filter((r) => r && typeof r.key === 'string') : [];
  } catch {
    return [];
  }
}

/** Open a task from anywhere: stays on the current project page when possible, otherwise navigates to the task's project. */
export function openTaskAnywhere(base: string, task: TaskLike, wsId?: string) {
  if (wsId) rememberRecentTask(wsId, task);
  const projectKey = task.projectKey ?? task.key.split('-')[0];
  const projectPath = `${base}/p/${projectKey}`;
  const params = new URLSearchParams(window.location.search);
  params.set('task', task.key);
  const qs = params.toString();
  if (window.location.pathname === projectPath) navigate(`${projectPath}?${qs}`, { replace: false });
  else navigate(`${projectPath}?task=${encodeURIComponent(task.key)}`, { replace: false });
}

export function useOpenTask() {
  const { base, workspace } = useWorkspace();
  const loc = useLocation();
  void loc; // re-render when the route changes so the "same project" check stays accurate
  return (task: TaskLike) => openTaskAnywhere(base, task, workspace.id);
}

export interface TaskRowProps {
  task: Task;
  /** Show the project badge (default true). */
  showProject?: boolean;
  /** Show the assignee avatar (default true). */
  showAssignee?: boolean;
  /** Inline editing: pass the task's project statuses + a patch handler. */
  statuses?: TaskStatus[];
  onPatch?: (patch: TaskPatch) => void;
  active?: boolean;
  compact?: boolean;
  className?: string;
  /** Extra content at the right edge. */
  right?: ReactNode;
  onOpen?: (task: Task) => void;
  ['data-index']?: number;
}

export function TaskRow({ task, showProject = true, showAssignee = true, statuses, onPatch, active, compact, className, right, onOpen, ...rest }: TaskRowProps) {
  const open = useOpenTask();
  const done = task.statusCategory === 'done' || task.statusCategory === 'cancelled';
  const editable = Boolean(onPatch);
  const handleOpen = () => (onOpen ? onOpen(task) : open(task));
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div
      className={cx('task-row', done && 'is-done', active && 'is-active', compact && 'is-compact', editable && 'is-editable', className)}
      role="button"
      tabIndex={0}
      aria-label={`${task.key} ${task.title}`}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) {
          e.preventDefault();
          handleOpen();
        }
      }}
      data-index={rest['data-index']}
    >
      <span className="task-row-status" onClick={editable && statuses ? stop : undefined}>
        {editable && statuses?.length ? (
          <StatusPicker value={task.statusId} statuses={statuses} onChange={(statusId) => onPatch?.({ statusId })} showLabel={false} />
        ) : (
          <StatusIcon category={task.statusCategory || 'todo'} color={task.statusColor || 'var(--fg-faint)'} size={15} />
        )}
      </span>
      <TaskKey task={task} className="task-row-key" />
      <span className="task-row-title" title={task.title}>
        {task.parentId ? <Icon name="git-branch" size={11} className="task-row-sub" /> : null}
        {task.title}
      </span>
      {showProject && task.projectKey ? (
        <span className="task-row-project">
          <ProjectBadge projectKey={task.projectKey} color={task.projectColor} name={task.projectName} />
        </span>
      ) : null}
      <span className="task-row-meta" onClick={editable ? stop : undefined}>
        {editable ? (
          <>
            <PriorityPicker value={task.priority} onChange={(priority) => onPatch?.({ priority })} />
            <DueDateButton value={task.dueDate} onChange={(dueDate) => onPatch?.({ dueDate })} done={done} showEmpty={false} />
            {!task.dueDate ? <DueDateButton value={null} onChange={(dueDate) => onPatch?.({ dueDate })} className="task-row-due-empty" label="Due" /> : null}
          </>
        ) : (
          <>
            {task.priority ? <PriorityIcon priority={task.priority} size={14} /> : null}
            <DueBadge value={task.dueDate} done={done} />
          </>
        )}
        {showAssignee ? (
          task.assignee ? (
            <Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size={20} title={task.assignee.name} />
          ) : (
            <span className="assignee-empty" title="Unassigned" aria-label="Unassigned">
              <Icon name="user" size={11} />
            </span>
          )
        ) : null}
        {right}
      </span>
    </div>
  );
}

export function TaskRowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="task-row-skeletons" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="task-row is-skeleton">
          <span className="skeleton" style={{ width: 15, height: 15, borderRadius: 8 }} />
          <span className="skeleton" style={{ width: 48, height: 10 }} />
          <span className="skeleton" style={{ width: `${34 + ((i * 19) % 40)}%`, height: 12 }} />
          <span className="grow" />
          <span className="skeleton" style={{ width: 60, height: 10 }} />
          <span className="skeleton" style={{ width: 20, height: 20, borderRadius: 10 }} />
        </div>
      ))}
    </div>
  );
}
