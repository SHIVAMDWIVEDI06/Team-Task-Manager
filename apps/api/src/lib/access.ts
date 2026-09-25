// Authorization helpers: workspace roles and project visibility.
import { db } from '../db/index.ts';
import { errors } from './errors.ts';
import { ROLE_RANK } from '../../../../packages/shared/src/constants.ts';
import type { WorkspaceRole } from '../../../../packages/shared/src/types.ts';

export interface ProjectRow extends Record<string, unknown> {
  id: string;
  workspace_id: string;
  key: string;
  name: string;
  visibility: string;
  state: string;
}

export function roleIn(userId: string, workspaceId: string): WorkspaceRole | null {
  const r = db.one<{ role: WorkspaceRole }>('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [workspaceId, userId]);
  return r?.role ?? null;
}

/** Throws 404 (not 403) when the user is not a member, to avoid leaking workspace existence. */
export function requireMember(userId: string, workspaceId: string, minRole: WorkspaceRole = 'guest'): WorkspaceRole {
  const role = roleIn(userId, workspaceId);
  if (!role) throw errors.notFound('Workspace');
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) throw errors.forbidden(`This action requires the ${minRole} role`);
  return role;
}

export function projectById(projectId: string): ProjectRow {
  const p = db.one<ProjectRow>('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!p) throw errors.notFound('Project');
  return p;
}

export interface ProjectAccess {
  project: ProjectRow;
  role: WorkspaceRole;
  canEdit: boolean; // member+ (guests are read-only)
  canManage: boolean; // admin+ or project lead
}

/** Resolve a project the user can see; enforces private-project membership. */
export function requireProject(userId: string, projectId: string, need: 'view' | 'edit' | 'manage' = 'view'): ProjectAccess {
  const project = projectById(projectId);
  const role = roleIn(userId, project.workspace_id);
  if (!role) throw errors.notFound('Project');
  const isAdmin = ROLE_RANK[role] >= ROLE_RANK.admin;
  if (project.visibility === 'private' && !isAdmin) {
    const m = db.one('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, userId]);
    if (!m) throw errors.notFound('Project');
  }
  const canEdit = ROLE_RANK[role] >= ROLE_RANK.member;
  const canManage = isAdmin || project.lead_id === userId;
  if (need === 'edit' && !canEdit) throw errors.forbidden('Guests cannot make changes');
  if (need === 'manage' && !canManage) throw errors.forbidden('Only admins or the project lead can do that');
  return { project, role, canEdit, canManage };
}

export interface TaskRow extends Record<string, unknown> {
  id: string;
  project_id: string;
  number: number;
  title: string;
  status_id: string;
  assignee_id: string | null;
  parent_id: string | null;
}

export function requireTask(userId: string, taskId: string, need: 'view' | 'edit' = 'view'): { task: TaskRow; access: ProjectAccess } {
  const task = db.one<TaskRow>('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) throw errors.notFound('Task');
  const access = requireProject(userId, task.project_id, need);
  return { task, access };
}

/** SQL fragment restricting projects to those the user can see in a workspace. Use with params [userId]. */
export const VISIBLE_PROJECTS_SQL = `(p.visibility = 'public'
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ?)
  OR EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = p.workspace_id AND wm.user_id = ? AND wm.role IN ('owner','admin')))`;
