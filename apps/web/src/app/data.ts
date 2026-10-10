// Canonical data hooks + mutation helpers. Every feature should go through these so cache keys stay consistent.
import type {
  Activity, Attachment, ChecklistItem, Comment, DashboardData, Invite, Label, Notification, Project, ProjectBundle, SavedView, SearchResults, Task, TaskDetail, TaskStatus, TimeEntry, Workspace, WorkspaceMember, User,
} from '../../../../packages/shared/src/types.ts';
import { api } from '../lib/api.ts';
import { getQueryData, invalidate, setQueryData, useQuery, type QueryOptions } from '../lib/query.ts';

export type MemberWithPresence = WorkspaceMember & { online?: boolean };

// ---- Keys ----
export const keys = {
  workspaces: 'workspaces',
  workspace: (slug: string) => `workspace:${slug}`,
  projects: (wsId: string) => `projects:${wsId}`,
  members: (wsId: string) => `members:${wsId}`,
  invites: (wsId: string) => `invites:${wsId}`,
  bundle: (projectId: string) => `bundle:${projectId}`,
  tasks: (projectId: string) => `tasks:${projectId}`,
  task: (taskId: string) => `task:${taskId}`,
  taskByKey: (wsId: string, key: string) => `taskByKey:${wsId}:${key}`,
  comments: (taskId: string) => `comments:${taskId}`,
  time: (taskId: string) => `time:${taskId}`,
  taskActivity: (taskId: string) => `activity:task:${taskId}`,
  activity: (wsId: string) => `activity:${wsId}`,
  projectActivity: (projectId: string) => `activity:project:${projectId}`,
  notifications: 'notifications',
  dashboard: (wsId: string) => `dashboard:${wsId}`,
  myTasks: (wsId: string) => `mytasks:${wsId}`,
  search: (wsId: string, q: string) => `search:${wsId}:${q}`,
};

// ---- Queries ----
export const useWorkspaces = () => useQuery<Workspace[]>(keys.workspaces, () => api.get('/api/workspaces'));
export const useWorkspaceBySlug = (slug: string | null) => useQuery<Workspace>(slug ? keys.workspace(slug) : null, () => api.get(`/api/workspaces/by-slug/${encodeURIComponent(slug!)}`));
export const useProjects = (wsId: string | null, opts?: QueryOptions) => useQuery<Project[]>(wsId ? keys.projects(wsId) : null, () => api.get(`/api/workspaces/${wsId}/projects`), opts);
export const useArchivedProjects = (wsId: string | null) => useQuery<Project[]>(wsId ? `${keys.projects(wsId)}:archived` : null, () => api.get(`/api/workspaces/${wsId}/projects?archived=true`));
export const useMembers = (wsId: string | null) => useQuery<MemberWithPresence[]>(wsId ? keys.members(wsId) : null, () => api.get(`/api/workspaces/${wsId}/members`), { staleTime: 60_000 });
export const useInvites = (wsId: string | null) => useQuery<Invite[]>(wsId ? keys.invites(wsId) : null, () => api.get(`/api/workspaces/${wsId}/invites`));
export const useBundle = (projectId: string | null) => useQuery<ProjectBundle>(projectId ? keys.bundle(projectId) : null, () => api.get(`/api/projects/${projectId}/bundle`));
export const useTasks = (projectId: string | null, includeArchived = false) => useQuery<Task[]>(projectId ? keys.tasks(projectId) + (includeArchived ? ':archived' : '') : null, () => api.get(`/api/projects/${projectId}/tasks${includeArchived ? '?archived=true' : ''}`));
export const useTask = (taskId: string | null) => useQuery<TaskDetail>(taskId ? keys.task(taskId) : null, () => api.get(`/api/tasks/${taskId}`));
export const useTaskByKey = (wsId: string | null, key: string | null) => useQuery<TaskDetail>(wsId && key ? keys.taskByKey(wsId, key) : null, () => api.get(`/api/tasks/by-key/${encodeURIComponent(key!)}?workspace=${wsId}`), { staleTime: 0 });
export const useComments = (taskId: string | null) => useQuery<Comment[]>(taskId ? keys.comments(taskId) : null, () => api.get(`/api/tasks/${taskId}/comments`));
export const useTimeEntries = (taskId: string | null) => useQuery<TimeEntry[]>(taskId ? keys.time(taskId) : null, () => api.get(`/api/tasks/${taskId}/time`));
export const useTaskActivity = (taskId: string | null) => useQuery<Activity[]>(taskId ? keys.taskActivity(taskId) : null, () => api.get(`/api/tasks/${taskId}/activity`));
export const useWorkspaceActivity = (wsId: string | null, projectId?: string | null) => useQuery<Activity[]>(wsId ? (projectId ? keys.projectActivity(projectId) : keys.activity(wsId)) : null, () => api.get(`/api/workspaces/${wsId}/activity?limit=100${projectId ? `&project=${projectId}` : ''}`));
export const useNotifications = () => useQuery<{ items: Notification[]; unread: number }>(keys.notifications, () => api.get('/api/notifications?limit=100'), { refetchInterval: 120_000 });
export const useDashboard = (wsId: string | null) => useQuery<DashboardData>(wsId ? keys.dashboard(wsId) : null, () => api.get(`/api/workspaces/${wsId}/dashboard`), { staleTime: 15_000 });
export const useMyTasks = (wsId: string | null) => useQuery<Task[]>(wsId ? keys.myTasks(wsId) : null, () => api.get(`/api/workspaces/${wsId}/my-tasks`));
export const useSearch = (wsId: string | null, q: string) => useQuery<SearchResults>(wsId && q.trim() ? keys.search(wsId, q.trim().toLowerCase()) : null, () => api.get(`/api/workspaces/${wsId}/search?q=${encodeURIComponent(q.trim())}`), { staleTime: 20_000 });

// ---- Task mutations (with optimistic cache patches) ----
export function patchTaskCache(projectId: string, taskId: string, patch: Partial<Task>) {
  setQueryData<Task[]>(keys.tasks(projectId), (prev) => (prev ? prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) : prev));
  setQueryData<TaskDetail>(keys.task(taskId), (prev) => (prev ? { ...prev, ...patch } : prev));
}

export function snapshotTask(projectId: string, taskId: string): Task | undefined {
  return getQueryData<Task[]>(keys.tasks(projectId))?.find((t) => t.id === taskId) ?? getQueryData<TaskDetail>(keys.task(taskId));
}

export interface TaskPatch {
  title?: string;
  description?: string;
  statusId?: string;
  priority?: 0 | 1 | 2 | 3 | 4;
  assigneeId?: string | null;
  parentId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimateMinutes?: number | null;
  labelIds?: string[];
  recurrence?: Task['recurrence'];
  archived?: boolean;
  position?: number;
}

/** Optimistically update a task, then persist. Returns a rollback on failure (handled internally). */
export async function updateTask(task: Pick<Task, 'id' | 'projectId'>, patch: TaskPatch, optimistic?: Partial<Task>): Promise<Task> {
  const before = snapshotTask(task.projectId, task.id);
  if (optimistic || patch) patchTaskCache(task.projectId, task.id, { ...(patch as Partial<Task>), ...(optimistic || {}) });
  try {
    const updated = await api.patch<Task>(`/api/tasks/${task.id}`, patch);
    patchTaskCache(task.projectId, task.id, updated);
    if (patch.parentId !== undefined || patch.archived !== undefined) invalidate([keys.tasks(task.projectId)]);
    return updated;
  } catch (e) {
    if (before) patchTaskCache(task.projectId, task.id, before);
    throw e;
  }
}

export async function moveTask(task: Task, target: { statusId: string; beforeId: string | null; afterId: string | null; position?: number }, statuses?: TaskStatus[]): Promise<Task> {
  const before = snapshotTask(task.projectId, task.id);
  const st = statuses?.find((s) => s.id === target.statusId);
  patchTaskCache(task.projectId, task.id, { statusId: target.statusId, statusName: st?.name, statusCategory: st?.category, statusColor: st?.color, position: target.position ?? task.position });
  try {
    const updated = await api.post<Task>(`/api/tasks/${task.id}/move`, target);
    patchTaskCache(task.projectId, task.id, updated);
    return updated;
  } catch (e) {
    if (before) patchTaskCache(task.projectId, task.id, before);
    throw e;
  }
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  statusId?: string;
  priority?: 0 | 1 | 2 | 3 | 4;
  assigneeId?: string | null;
  parentId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimateMinutes?: number | null;
  labelIds?: string[];
  recurrence?: Task['recurrence'];
  position?: number;
}

export async function createTask(projectId: string, input: CreateTaskInput): Promise<Task> {
  const task = await api.post<Task>(`/api/projects/${projectId}/tasks`, input);
  setQueryData<Task[]>(keys.tasks(projectId), (prev) => (prev ? (prev.some((t) => t.id === task.id) ? prev : [...prev, task]) : prev));
  if (task.parentId) invalidate(keys.task(task.parentId));
  invalidate(['dashboard', 'mytasks']);
  return task;
}

export async function deleteTask(task: Pick<Task, 'id' | 'projectId' | 'parentId'>): Promise<void> {
  setQueryData<Task[]>(keys.tasks(task.projectId), (prev) => (prev ? prev.filter((t) => t.id !== task.id && t.parentId !== task.id) : prev));
  try {
    await api.del(`/api/tasks/${task.id}`);
  } finally {
    invalidate([keys.tasks(task.projectId), 'dashboard', 'mytasks']);
    if (task.parentId) invalidate(keys.task(task.parentId));
  }
}

export async function bulkUpdateTasks(projectId: string, taskIds: string[], patch: TaskPatch): Promise<Task[]> {
  const updated = await api.post<Task[]>('/api/tasks/bulk', { taskIds, patch });
  setQueryData<Task[]>(keys.tasks(projectId), (prev) => (prev ? prev.map((t) => updated.find((u) => u.id === t.id) ?? t) : prev));
  invalidate(['dashboard', 'mytasks']);
  return updated;
}

export async function bulkDeleteTasks(projectId: string, taskIds: string[]): Promise<void> {
  const set = new Set(taskIds);
  setQueryData<Task[]>(keys.tasks(projectId), (prev) => (prev ? prev.filter((t) => !set.has(t.id) && !(t.parentId && set.has(t.parentId))) : prev));
  await api.post('/api/tasks/bulk-delete', { taskIds });
  invalidate([keys.tasks(projectId), 'dashboard', 'mytasks']);
}

// ---- Task detail sub-resources ----
export const taskApi = {
  duplicate: (taskId: string) => api.post<Task>(`/api/tasks/${taskId}/duplicate`),
  watch: (taskId: string, watch: boolean) => (watch ? api.post(`/api/tasks/${taskId}/watch`) : api.del(`/api/tasks/${taskId}/watch`)),
  addChecklist: (taskId: string, text: string) => api.post<ChecklistItem>(`/api/tasks/${taskId}/checklist`, { text }),
  updateChecklist: (itemId: string, patch: { text?: string; done?: boolean; position?: number }) => api.patch<ChecklistItem>(`/api/checklist/${itemId}`, patch),
  deleteChecklist: (itemId: string) => api.del(`/api/checklist/${itemId}`),
  addRelation: (taskId: string, type: 'blocks' | 'blocked_by' | 'relates' | 'duplicates', targetTaskId: string) => api.post<{ id: string }>(`/api/tasks/${taskId}/relations`, { type, targetTaskId }),
  deleteRelation: (relId: string) => api.del(`/api/relations/${relId}`),
  upload: (taskId: string, files: File[]) => api.upload<Attachment[]>(`/api/tasks/${taskId}/attachments`, files),
  deleteAttachment: (id: string) => api.del(`/api/attachments/${id}`),
  addComment: (taskId: string, body: string) => api.post<Comment>(`/api/tasks/${taskId}/comments`, { body }),
  updateComment: (id: string, body: string) => api.patch<Comment>(`/api/comments/${id}`, { body }),
  deleteComment: (id: string) => api.del(`/api/comments/${id}`),
  logTime: (taskId: string, input: { minutes: number; note?: string; date?: string }) => api.post<TimeEntry>(`/api/tasks/${taskId}/time`, input),
  deleteTime: (id: string) => api.del(`/api/time/${id}`),
  typing: (taskId: string) => api.post(`/api/tasks/${taskId}/typing`).catch(() => {}),
};

// ---- Projects ----
export const projectApi = {
  create: (wsId: string, input: { name: string; key: string; description?: string; color?: string; icon?: string; visibility?: 'public' | 'private'; leadId?: string | null; startDate?: string | null; targetDate?: string | null; withSampleTasks?: boolean }) => api.post<Project>(`/api/workspaces/${wsId}/projects`, input),
  update: (projectId: string, patch: Partial<Pick<Project, 'name' | 'key' | 'description' | 'color' | 'icon' | 'visibility' | 'state' | 'leadId' | 'startDate' | 'targetDate'>>) => api.patch<Project>(`/api/projects/${projectId}`, patch),
  remove: (projectId: string) => api.del(`/api/projects/${projectId}`),
  setMembers: (projectId: string, userIds: string[]) => api.put(`/api/projects/${projectId}/members`, { userIds }),
  addStatus: (projectId: string, input: { name: string; color?: string; category?: TaskStatus['category'] }) => api.post<TaskStatus>(`/api/projects/${projectId}/statuses`, input),
  updateStatus: (projectId: string, statusId: string, patch: { name?: string; color?: string; category?: TaskStatus['category']; position?: number }) => api.patch<TaskStatus>(`/api/projects/${projectId}/statuses/${statusId}`, patch),
  reorderStatuses: (projectId: string, statusIds: string[]) => api.put(`/api/projects/${projectId}/statuses/order`, { statusIds }),
  deleteStatus: (projectId: string, statusId: string, moveTo?: string) => api.del(`/api/projects/${projectId}/statuses/${statusId}${moveTo ? `?moveTo=${moveTo}` : ''}`),
  addLabel: (projectId: string, input: { name: string; color?: string }) => api.post<Label>(`/api/projects/${projectId}/labels`, input),
  updateLabel: (projectId: string, labelId: string, patch: { name?: string; color?: string }) => api.patch<Label>(`/api/projects/${projectId}/labels/${labelId}`, patch),
  deleteLabel: (projectId: string, labelId: string) => api.del(`/api/projects/${projectId}/labels/${labelId}`),
  createView: (projectId: string, input: { name: string; kind: SavedView['kind']; filters: SavedView['filters']; groupBy?: string; sortBy?: string; shared?: boolean }) => api.post<SavedView>(`/api/projects/${projectId}/views`, input),
  updateView: (projectId: string, viewId: string, patch: Partial<{ name: string; filters: SavedView['filters']; groupBy: string | null; sortBy: string | null; kind: SavedView['kind'] }>) => api.patch<SavedView>(`/api/projects/${projectId}/views/${viewId}`, patch),
  deleteView: (projectId: string, viewId: string) => api.del(`/api/projects/${projectId}/views/${viewId}`),
};

// ---- Workspace ----
export const workspaceApi = {
  create: (name: string, withSampleProject = true) => api.post<Workspace>('/api/workspaces', { name, withSampleProject }),
  update: (wsId: string, patch: { name?: string; logoUrl?: string | null }) => api.patch<Workspace>(`/api/workspaces/${wsId}`, patch),
  remove: (wsId: string) => api.del(`/api/workspaces/${wsId}`),
  setRole: (wsId: string, userId: string, role: WorkspaceMember['role']) => api.patch(`/api/workspaces/${wsId}/members/${userId}`, { role }),
  removeMember: (wsId: string, userId: string) => api.del(`/api/workspaces/${wsId}/members/${userId}`),
  invite: (wsId: string, emails: string[], role: 'admin' | 'member' | 'guest', message?: string) => api.post<{ results: { email: string; status: string; link?: string; emailed?: boolean }[]; emailConfigured: boolean }>(`/api/workspaces/${wsId}/invites`, { emails, role, message }),
  revokeInvite: (wsId: string, inviteId: string) => api.del(`/api/workspaces/${wsId}/invites/${inviteId}`),
};

export const notificationApi = {
  markRead: (ids: string[]) => api.post('/api/notifications/read', { ids }),
  markAllRead: () => api.post('/api/notifications/read', { all: true }),
  markUnread: (ids: string[]) => api.post('/api/notifications/unread', { ids }),
  remove: (id: string) => api.del(`/api/notifications/${id}`),
  clear: (readOnly: boolean) => api.del(`/api/notifications${readOnly ? '?read=true' : ''}`),
};

export type { User };
