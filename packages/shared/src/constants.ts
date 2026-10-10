import type { Priority, StatusCategory, WorkspaceRole, RelationType } from './types.ts';

export const PRIORITIES: { value: Priority; label: string; short: string }[] = [
  { value: 4, label: 'Urgent', short: 'P0' },
  { value: 3, label: 'High', short: 'P1' },
  { value: 2, label: 'Medium', short: 'P2' },
  { value: 1, label: 'Low', short: 'P3' },
  { value: 0, label: 'No priority', short: '—' },
];

export const PRIORITY_LABEL: Record<Priority, string> = {
  0: 'No priority',
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Urgent',
};

export const STATUS_CATEGORIES: { value: StatusCategory; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const ROLES: { value: WorkspaceRole; label: string; description: string }[] = [
  { value: 'owner', label: 'Owner', description: 'Full control, including billing and deleting the workspace.' },
  { value: 'admin', label: 'Admin', description: 'Manage members, projects and settings.' },
  { value: 'member', label: 'Member', description: 'Create and edit tasks in projects they can see.' },
  { value: 'guest', label: 'Guest', description: 'View-only access to projects they are added to.' },
];

export const ROLE_RANK: Record<WorkspaceRole, number> = { guest: 0, member: 1, admin: 2, owner: 3 };

export const RELATION_TYPES: { value: RelationType; label: string; inverse: RelationType }[] = [
  { value: 'blocks', label: 'Blocks', inverse: 'blocked_by' },
  { value: 'blocked_by', label: 'Blocked by', inverse: 'blocks' },
  { value: 'relates', label: 'Relates to', inverse: 'relates' },
  { value: 'duplicates', label: 'Duplicates', inverse: 'duplicates' },
];

export const DEFAULT_STATUSES: { name: string; color: string; category: StatusCategory }[] = [
  { name: 'Backlog', color: '#8b8fa3', category: 'backlog' },
  { name: 'Todo', color: '#6b7cff', category: 'todo' },
  { name: 'In Progress', color: '#f5a524', category: 'in_progress' },
  { name: 'In Review', color: '#a855f7', category: 'in_progress' },
  { name: 'Done', color: '#22c55e', category: 'done' },
  { name: 'Cancelled', color: '#ef4444', category: 'cancelled' },
];

export const DEFAULT_LABELS: { name: string; color: string }[] = [
  { name: 'Bug', color: '#ef4444' },
  { name: 'Feature', color: '#8b5cf6' },
  { name: 'Improvement', color: '#3b82f6' },
  { name: 'Documentation', color: '#14b8a6' },
];

export const PROJECT_COLORS = [
  '#6b7cff', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#f5a524',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#64748b', '#a16207',
];

export const LABEL_COLORS = PROJECT_COLORS;

export const PROJECT_ICONS = ['◆', '●', '▲', '■', '★', '⬢', '✦', '◈', '❖', '⬟', '✱', '⚑'];

export const LIMITS = {
  nameMax: 80,
  titleMax: 200,
  descriptionMax: 50_000,
  commentMax: 10_000,
  keyMin: 2,
  keyMax: 6,
  passwordMin: 8,
};
