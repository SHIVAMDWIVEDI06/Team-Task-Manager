// Contract between ProjectPage (container) and the four views. Do not change without updating all views.
import type { Label, Project, Task, TaskStatus, WorkspaceMember, TaskFilters } from '../../../../../../packages/shared/src/types.ts';

export interface ViewProps {
  project: Project;
  statuses: TaskStatus[]; // ordered by position
  labels: Label[];
  members: WorkspaceMember[];
  /** Tasks after filters have been applied (top-level tasks unless filters.includeSubtasks). */
  tasks: Task[];
  /** Every task in the project (unfiltered, includes subtasks). */
  allTasks: Task[];
  filters: TaskFilters;
  canEdit: boolean;
  /** Opens the task peek panel (sets ?task=KEY in the URL). */
  openTask: (task: Task) => void;
  /** Opens the create-task dialog with defaults. */
  createTask: (defaults?: { statusId?: string; dueDate?: string; startDate?: string; assigneeId?: string | null }) => void;
  /** Selected task ids (multi-select) and setter, shared across views so bulk actions work everywhere. */
  selection: Set<string>;
  setSelection: (ids: Set<string>) => void;
  groupBy: 'status' | 'assignee' | 'priority' | 'label' | 'none';
  sortBy: string; // e.g. 'position' | 'priority' | 'dueDate' | 'createdAt' | 'title' | 'updatedAt'
}
