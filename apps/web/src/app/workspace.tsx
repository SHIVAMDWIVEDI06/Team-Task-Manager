// Workspace context: resolves the :slug route param, connects realtime, exposes projects/members.
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { Project, Workspace } from '../../../../packages/shared/src/types.ts';
import { useParams } from '../lib/router.tsx';
import { realtime } from '../lib/realtime.ts';
import { uiStore, writeLS } from '../lib/store.ts';
import { useMembers, useProjects, useWorkspaceBySlug, type MemberWithPresence } from './data.ts';
import { useMe } from './auth.tsx';
import { ROLE_RANK } from '../../../../packages/shared/src/constants.ts';

export interface WorkspaceCtx {
  workspace: Workspace;
  projects: Project[];
  members: MemberWithPresence[];
  isAdmin: boolean;
  canEdit: boolean;
  base: string; // "/w/slug"
  projectByKey: (key: string) => Project | undefined;
  projectById: (id: string) => Project | undefined;
  member: (userId: string | null | undefined) => MemberWithPresence | undefined;
}

const Ctx = createContext<WorkspaceCtx | null>(null);

export function useWorkspace(): WorkspaceCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWorkspace outside a workspace route');
  return v;
}

export function useWorkspaceOptional(): WorkspaceCtx | null {
  return useContext(Ctx);
}

export function WorkspaceProvider({ children, loading, notFound }: { children: ReactNode; loading: ReactNode; notFound: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const me = useMe();
  const ws = useWorkspaceBySlug(slug);
  const wsId = ws.data?.id ?? null;
  const projects = useProjects(wsId);
  const members = useMembers(wsId);

  useEffect(() => {
    if (!wsId) return;
    realtime.connect(wsId);
    uiStore.set({ lastWorkspace: slug });
    writeLS('tt.lastWorkspace', slug);
  }, [wsId, slug]);

  const value = useMemo<WorkspaceCtx | null>(() => {
    if (!ws.data) return null;
    const list = projects.data ?? [];
    const mem = members.data ?? [];
    return {
      workspace: ws.data,
      projects: list,
      members: mem,
      isAdmin: ROLE_RANK[ws.data.role] >= ROLE_RANK.admin,
      canEdit: ROLE_RANK[ws.data.role] >= ROLE_RANK.member,
      base: `/w/${ws.data.slug}`,
      projectByKey: (key: string) => list.find((p) => p.key === key.toUpperCase()),
      projectById: (id: string) => list.find((p) => p.id === id),
      member: (userId) => (userId ? mem.find((m) => m.userId === userId) : undefined),
    };
  }, [ws.data, projects.data, members.data]);

  if (ws.error) return <>{notFound}</>;
  if (!value || (projects.isLoading && !projects.data)) return <>{loading}</>;
  void me;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
