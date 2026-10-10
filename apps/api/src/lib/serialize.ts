// Row → domain object mappers. Column names are snake_case in SQL and camelCase in the API.
import { parseJSON } from '../db/index.ts';
import type {
  Activity, Attachment, ChecklistItem, Comment, Invite, Label, Me, Notification, Project, SavedView, Task,
  TaskStatus, TimeEntry, User, UserPreferences, Workspace, WorkspaceMember, WorkspaceRole,
} from '../../../../packages/shared/src/types.ts';

export const DEFAULT_PREFS: UserPreferences = {
  theme: 'system',
  notifications: { email: true, assigned: true, mentioned: true, comments: true, statusChanges: true, dueSoon: true },
  density: 'comfortable',
  startOfWeek: 1,
};

export function userFromRow(r: Record<string, unknown>): User {
  return {
    id: r.id as string,
    email: r.email as string,
    name: r.name as string,
    avatarUrl: (r.avatar_url as string | null) ?? null,
    timezone: (r.timezone as string) || 'UTC',
    createdAt: r.created_at as string,
    lastActiveAt: (r.last_active_at as string | null) ?? null,
  };
}

export function meFromRow(r: Record<string, unknown>): Me {
  const prefs = parseJSON<Partial<UserPreferences>>(r.preferences, {});
  return {
    ...userFromRow(r),
    preferences: {
      ...DEFAULT_PREFS,
      ...prefs,
      notifications: { ...DEFAULT_PREFS.notifications, ...(prefs.notifications || {}) },
    },
  };
}

export function userBrief(r: Record<string, unknown>, prefix = ''): Pick<User, 'id' | 'name' | 'avatarUrl'> | null {
  const id = r[`${prefix}id`] as string | null;
  if (!id) return null;
  return { id, name: (r[`${prefix}name`] as string) || 'Unknown', avatarUrl: (r[`${prefix}avatar_url`] as string | null) ?? null };
}

export function workspaceFromRow(r: Record<string, unknown>): Workspace {
  return {
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    logoUrl: (r.logo_url as string | null) ?? null,
    createdAt: r.created_at as string,
    role: (r.role as WorkspaceRole) || 'member',
    memberCount: r.member_count !== undefined ? Number(r.member_count) : undefined,
  };
}

export function memberFromRow(r: Record<string, unknown>): WorkspaceMember {
  return {
    workspaceId: r.workspace_id as string,
    userId: r.user_id as string,
    role: r.role as WorkspaceRole,
    joinedAt: r.joined_at as string,
    user: {
      id: r.user_id as string,
      email: r.email as string,
      name: r.name as string,
      avatarUrl: (r.avatar_url as string | null) ?? null,
      timezone: (r.timezone as string) || 'UTC',
      createdAt: r.created_at as string,
      lastActiveAt: (r.last_active_at as string | null) ?? null,
    },
  };
}

export function inviteFromRow(r: Record<string, unknown>): Invite {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    email: r.email as string,
    role: r.role as WorkspaceRole,
    token: r.token as string,
    invitedBy: r.invited_by as string,
    status: r.status as Invite['status'],
    expiresAt: r.expires_at as string,
    createdAt: r.created_at as string,
    inviter: r.inviter_id ? { id: r.inviter_id as string, name: r.inviter_name as string, avatarUrl: (r.inviter_avatar as string | null) ?? null } : undefined,
  };
}

export function projectFromRow(r: Record<string, unknown>): Project {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    name: r.name as string,
    key: r.key as string,
    description: (r.description as string) || '',
    color: r.color as string,
    icon: r.icon as string,
    state: r.state as Project['state'],
    visibility: r.visibility as Project['visibility'],
    leadId: (r.lead_id as string | null) ?? null,
    startDate: (r.start_date as string | null) ?? null,
    targetDate: (r.target_date as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    taskCount: r.task_count !== undefined ? Number(r.task_count) : undefined,
    doneCount: r.done_count !== undefined ? Number(r.done_count) : undefined,
    lead: r.lead_name ? { id: r.lead_id as string, name: r.lead_name as string, avatarUrl: (r.lead_avatar as string | null) ?? null } : null,
  };
}

export function statusFromRow(r: Record<string, unknown>): TaskStatus {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    name: r.name as string,
    color: r.color as string,
    category: r.category as TaskStatus['category'],
    position: Number(r.position),
  };
}

export function labelFromRow(r: Record<string, unknown>): Label {
  return { id: r.id as string, projectId: r.project_id as string, name: r.name as string, color: r.color as string };
}

export function taskFromRow(r: Record<string, unknown>): Task {
  const labelIds = typeof r.label_ids === 'string' && r.label_ids ? (r.label_ids as string).split(',') : [];
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    number: Number(r.number),
    key: `${r.project_key as string}-${r.number}`,
    title: r.title as string,
    description: (r.description as string) || '',
    statusId: r.status_id as string,
    priority: Number(r.priority) as Task['priority'],
    assigneeId: (r.assignee_id as string | null) ?? null,
    reporterId: r.reporter_id as string,
    parentId: (r.parent_id as string | null) ?? null,
    position: Number(r.position),
    startDate: (r.start_date as string | null) ?? null,
    dueDate: (r.due_date as string | null) ?? null,
    estimateMinutes: r.estimate_minutes === null || r.estimate_minutes === undefined ? null : Number(r.estimate_minutes),
    timeSpentMinutes: Number(r.time_spent || 0),
    completedAt: (r.completed_at as string | null) ?? null,
    recurrence: parseJSON(r.recurrence, null),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    archivedAt: (r.archived_at as string | null) ?? null,
    labelIds,
    subtaskCount: Number(r.subtask_count || 0),
    subtaskDoneCount: Number(r.subtask_done || 0),
    checklistCount: Number(r.checklist_count || 0),
    checklistDoneCount: Number(r.checklist_done || 0),
    commentCount: Number(r.comment_count || 0),
    attachmentCount: Number(r.attachment_count || 0),
    projectKey: r.project_key as string,
    projectName: r.project_name as string | undefined,
    projectColor: r.project_color as string | undefined,
    statusName: r.status_name as string | undefined,
    statusCategory: r.status_category as Task['statusCategory'],
    statusColor: r.status_color as string | undefined,
    assignee: r.assignee_id ? { id: r.assignee_id as string, name: (r.assignee_name as string) || 'Unknown', avatarUrl: (r.assignee_avatar as string | null) ?? null } : null,
  };
}

export function checklistFromRow(r: Record<string, unknown>): ChecklistItem {
  return { id: r.id as string, taskId: r.task_id as string, text: r.text as string, done: Boolean(r.done), position: Number(r.position) };
}

export function attachmentFromRow(r: Record<string, unknown>): Attachment {
  return {
    id: r.id as string,
    taskId: r.task_id as string,
    uploaderId: r.uploader_id as string,
    filename: r.filename as string,
    mime: r.mime as string,
    size: Number(r.size),
    url: `/api/attachments/${r.id as string}/${encodeURIComponent(r.filename as string)}`,
    createdAt: r.created_at as string,
    uploader: userBrief(r, 'uploader_') || undefined,
  };
}

export function commentFromRow(r: Record<string, unknown>): Comment {
  return {
    id: r.id as string,
    taskId: r.task_id as string,
    authorId: r.author_id as string,
    body: r.body as string,
    createdAt: r.created_at as string,
    editedAt: (r.edited_at as string | null) ?? null,
    author: userBrief(r, 'author_') || { id: '', name: 'Deleted user', avatarUrl: null },
  };
}

export function timeEntryFromRow(r: Record<string, unknown>): TimeEntry {
  return {
    id: r.id as string,
    taskId: r.task_id as string,
    userId: r.user_id as string,
    minutes: Number(r.minutes),
    note: (r.note as string) || '',
    date: r.date as string,
    createdAt: r.created_at as string,
    user: userBrief(r, 'user_') || undefined,
  };
}

export function activityFromRow(r: Record<string, unknown>): Activity {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    projectId: (r.project_id as string | null) ?? null,
    taskId: (r.task_id as string | null) ?? null,
    actorId: (r.actor_id as string | null) ?? null,
    type: r.type as Activity['type'],
    data: parseJSON(r.data, {}),
    createdAt: r.created_at as string,
    actor: userBrief(r, 'actor_'),
    task: r.task_title ? { id: r.task_id as string, key: `${r.project_key}-${r.task_number}`, title: r.task_title as string } : null,
    project: r.project_name ? { id: r.project_id as string, key: r.project_key as string, name: r.project_name as string, color: r.project_color as string } : null,
  };
}

export function notificationFromRow(r: Record<string, unknown>): Notification {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    type: r.type as Notification['type'],
    title: r.title as string,
    body: (r.body as string) || '',
    link: (r.link as string | null) ?? null,
    actorId: (r.actor_id as string | null) ?? null,
    readAt: (r.read_at as string | null) ?? null,
    createdAt: r.created_at as string,
    actor: userBrief(r, 'actor_'),
  };
}

export function viewFromRow(r: Record<string, unknown>): SavedView {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    userId: (r.user_id as string | null) ?? null,
    name: r.name as string,
    kind: r.kind as SavedView['kind'],
    filters: parseJSON(r.filters, {}),
    groupBy: (r.group_by as SavedView['groupBy']) || undefined,
    sortBy: (r.sort_by as string) || undefined,
    createdAt: r.created_at as string,
  };
}
