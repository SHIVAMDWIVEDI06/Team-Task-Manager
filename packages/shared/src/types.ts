// Domain types shared by the API and the web client.
// Keep this file free of runtime code so it can be imported anywhere.

export type ID = string;
export type ISODate = string; // 'YYYY-MM-DD'
export type ISODateTime = string; // full ISO-8601 timestamp

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';
export type ProjectVisibility = 'public' | 'private';
export type ProjectState = 'active' | 'archived';
export type StatusCategory = 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled';
export type Priority = 0 | 1 | 2 | 3 | 4; // none, low, medium, high, urgent
export type RelationType = 'blocks' | 'blocked_by' | 'relates' | 'duplicates';
export type ViewKind = 'board' | 'list' | 'calendar' | 'timeline';
export type Theme = 'system' | 'light' | 'dark';

export interface User {
  id: ID;
  email: string;
  name: string;
  avatarUrl: string | null;
  timezone: string;
  createdAt: ISODateTime;
  lastActiveAt: ISODateTime | null;
}

export interface UserPreferences {
  theme: Theme;
  notifications: {
    email: boolean;
    assigned: boolean;
    mentioned: boolean;
    comments: boolean;
    statusChanges: boolean;
    dueSoon: boolean;
  };
  density: 'comfortable' | 'compact';
  startOfWeek: 0 | 1;
}

export interface Me extends User {
  preferences: UserPreferences;
}

export interface Workspace {
  id: ID;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: ISODateTime;
  role: WorkspaceRole; // the current user's role in it
  memberCount?: number;
}

export interface WorkspaceMember {
  workspaceId: ID;
  userId: ID;
  role: WorkspaceRole;
  joinedAt: ISODateTime;
  user: User;
}

export interface Invite {
  id: ID;
  workspaceId: ID;
  email: string;
  role: WorkspaceRole;
  token: string;
  invitedBy: ID;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: ISODateTime;
  createdAt: ISODateTime;
  inviter?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
  link?: string;
}

export interface InvitePreview {
  workspaceName: string;
  inviterName: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: ISODateTime;
}

export interface Project {
  id: ID;
  workspaceId: ID;
  name: string;
  key: string; // e.g. "ENG"
  description: string;
  color: string;
  icon: string;
  state: ProjectState;
  visibility: ProjectVisibility;
  leadId: ID | null;
  startDate: ISODate | null;
  targetDate: ISODate | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  // aggregates
  taskCount?: number;
  doneCount?: number;
  memberIds?: ID[];
  lead?: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
}

export interface TaskStatus {
  id: ID;
  projectId: ID;
  name: string;
  color: string;
  category: StatusCategory;
  position: number;
}

export interface Label {
  id: ID;
  projectId: ID;
  name: string;
  color: string;
}

export interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly';
  interval: number; // every N
  weekdays?: number[]; // for weekly, 0 = Sunday
}

export interface Task {
  id: ID;
  projectId: ID;
  number: number;
  key: string; // "ENG-42"
  title: string;
  description: string;
  statusId: ID;
  priority: Priority;
  assigneeId: ID | null;
  reporterId: ID;
  parentId: ID | null;
  position: number;
  startDate: ISODate | null;
  dueDate: ISODate | null;
  estimateMinutes: number | null;
  timeSpentMinutes: number;
  completedAt: ISODateTime | null;
  recurrence: Recurrence | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt: ISODateTime | null;
  labelIds: ID[];
  subtaskCount: number;
  subtaskDoneCount: number;
  checklistCount: number;
  checklistDoneCount: number;
  commentCount: number;
  attachmentCount: number;
  // denormalized helpers for cross-project lists (dashboard, search)
  projectKey?: string;
  projectName?: string;
  projectColor?: string;
  statusName?: string;
  statusCategory?: StatusCategory;
  statusColor?: string;
  assignee?: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
}

export interface TaskDetail extends Task {
  subtasks: Task[];
  checklist: ChecklistItem[];
  relations: TaskRelationView[];
  attachments: Attachment[];
  watcherIds: ID[];
  parent: Pick<Task, 'id' | 'key' | 'title'> | null;
}

export interface ChecklistItem {
  id: ID;
  taskId: ID;
  text: string;
  done: boolean;
  position: number;
}

export interface TaskRelationView {
  id: ID;
  type: RelationType;
  task: Pick<Task, 'id' | 'key' | 'title' | 'statusId' | 'statusName' | 'statusCategory' | 'statusColor' | 'projectId'>;
}

export interface Attachment {
  id: ID;
  taskId: ID;
  uploaderId: ID;
  filename: string;
  mime: string;
  size: number;
  url: string;
  createdAt: ISODateTime;
  uploader?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}

export interface Comment {
  id: ID;
  taskId: ID;
  authorId: ID;
  body: string;
  createdAt: ISODateTime;
  editedAt: ISODateTime | null;
  author: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}

export interface TimeEntry {
  id: ID;
  taskId: ID;
  userId: ID;
  minutes: number;
  note: string;
  date: ISODate;
  createdAt: ISODateTime;
  user?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}

export type ActivityType =
  | 'task.created'
  | 'task.updated'
  | 'task.moved'
  | 'task.deleted'
  | 'task.completed'
  | 'task.assigned'
  | 'task.commented'
  | 'task.attachment_added'
  | 'task.time_logged'
  | 'project.created'
  | 'project.updated'
  | 'project.archived'
  | 'project.deleted'
  | 'member.joined'
  | 'member.role_changed'
  | 'member.removed'
  | 'invite.sent'
  | 'invite.revoked'
  | 'workspace.updated';

export interface Activity {
  id: ID;
  workspaceId: ID;
  projectId: ID | null;
  taskId: ID | null;
  actorId: ID | null;
  type: ActivityType;
  data: Record<string, unknown>;
  createdAt: ISODateTime;
  actor?: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
  task?: Pick<Task, 'id' | 'key' | 'title'> | null;
  project?: Pick<Project, 'id' | 'key' | 'name' | 'color'> | null;
}

export type NotificationType =
  | 'assigned'
  | 'mentioned'
  | 'commented'
  | 'status_changed'
  | 'due_soon'
  | 'invite'
  | 'watching';

export interface Notification {
  id: ID;
  userId: ID;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  actorId: ID | null;
  readAt: ISODateTime | null;
  createdAt: ISODateTime;
  actor?: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
}

export interface TaskFilters {
  statusIds?: ID[];
  statusCategories?: StatusCategory[];
  assigneeIds?: (ID | 'me' | 'unassigned')[];
  priorities?: Priority[];
  labelIds?: ID[];
  due?: 'overdue' | 'today' | 'week' | 'none' | 'any';
  search?: string;
  includeSubtasks?: boolean;
  includeArchived?: boolean;
}

export interface SavedView {
  id: ID;
  projectId: ID;
  userId: ID | null; // null = shared with the project
  name: string;
  kind: ViewKind;
  filters: TaskFilters;
  groupBy?: 'status' | 'assignee' | 'priority' | 'label' | 'none';
  sortBy?: string;
  createdAt: ISODateTime;
}

export interface DashboardData {
  counts: {
    assigned: number;
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
    completedThisWeek: number;
    createdThisWeek: number;
  };
  myTasks: Task[];
  overdue: Task[];
  upcoming: Task[];
  recentActivity: Activity[];
  byStatusCategory: { category: StatusCategory; count: number }[];
  byPriority: { priority: Priority; count: number }[];
  throughput: { date: ISODate; completed: number; created: number }[]; // last 14 days
  projects: (Project & { taskCount: number; doneCount: number; overdueCount: number })[];
  workload: { user: Pick<User, 'id' | 'name' | 'avatarUrl'>; open: number; overdue: number; done: number }[];
}

export interface SearchResults {
  tasks: Task[];
  projects: Project[];
  members: User[];
}

export interface ProjectBundle {
  project: Project;
  statuses: TaskStatus[];
  labels: Label[];
  members: WorkspaceMember[];
  views: SavedView[];
}

export interface PresenceUser {
  userId: ID;
  name: string;
  avatarUrl: string | null;
  location: string | null; // e.g. "project:ID" or "task:ID"
  lastSeen: number;
}

// ---- Realtime events (Server-Sent Events) ----
export type RealtimeEvent =
  | { type: 'task.created'; projectId: ID; task: Task }
  | { type: 'task.updated'; projectId: ID; task: Task }
  | { type: 'task.deleted'; projectId: ID; taskId: ID }
  | { type: 'tasks.reordered'; projectId: ID; taskIds: ID[] }
  | { type: 'comment.created'; projectId: ID; taskId: ID; comment: Comment }
  | { type: 'comment.updated'; projectId: ID; taskId: ID; comment: Comment }
  | { type: 'comment.deleted'; projectId: ID; taskId: ID; commentId: ID }
  | { type: 'task.detail_changed'; projectId: ID; taskId: ID } // checklist/relations/attachments/time changed
  | { type: 'project.updated'; project: Project }
  | { type: 'project.deleted'; projectId: ID }
  | { type: 'project.meta_changed'; projectId: ID } // statuses/labels/members/views changed
  | { type: 'workspace.updated'; workspace: Workspace }
  | { type: 'members.changed'; workspaceId: ID }
  | { type: 'notification'; notification: Notification }
  | { type: 'presence'; users: PresenceUser[] }
  | { type: 'typing'; taskId: ID; userId: ID; name: string }
  | { type: 'activity'; activity: Activity };

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
