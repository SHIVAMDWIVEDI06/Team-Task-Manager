// Projects index: searchable grid of project cards, archived toggle, create dialog.
import { useMemo, useState } from 'react';
import type { Project } from '../../../../../packages/shared/src/types.ts';
import { projectApi, useArchivedProjects, useDashboard } from '../../app/data.ts';
import { useWorkspace } from '../../app/workspace.tsx';
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { Link } from '../../lib/router.tsx';
import { invalidate } from '../../lib/query.ts';
import { toast } from '../../lib/toast.ts';
import { relativeTime } from '../../lib/format.ts';
import { useLocalStorage, useTick } from '../../lib/hooks.ts';
import { Avatar, Button, EmptyState, Input, Progress, Segmented, Skeleton, Switch, cx } from '../../ui/primitives.tsx';
import { Tooltip } from '../../ui/overlays.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { CreateProjectDialog } from './CreateProjectDialog.tsx';
import './projects.css';

type SortKey = 'recent' | 'name' | 'progress';

function ProjectCard({ project, overdue, onRestore, restoring }: { project: Project; overdue?: number; onRestore?: () => void; restoring?: boolean }) {
  const { base } = useWorkspace();
  const total = project.taskCount ?? 0;
  const done = project.doneCount ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const archived = project.state === 'archived';
  const memberCount = project.memberIds?.length ?? 0;
  return (
    <Link to={`${base}/p/${project.key}`} className={cx('project-card', archived && 'is-archived')} aria-label={`${project.name} (${project.key})`}>
      <div className="project-card-top">
        <span className="project-icon project-icon-md" style={{ background: project.color }} aria-hidden>
          {project.icon}
        </span>
        <div className="project-card-heading">
          <div className="row gap-2">
            <span className="project-card-name truncate">{project.name}</span>
            {project.visibility === 'private' ? (
              <Tooltip content="Private project">
                <Icon name="lock" size={12} className="muted" />
              </Tooltip>
            ) : null}
          </div>
          <span className="project-card-key mono">{project.key}</span>
        </div>
        {archived && onRestore ? (
          <Button size="sm" variant="outline" icon="refresh" loading={restoring} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRestore(); }}>
            Restore
          </Button>
        ) : null}
      </div>
      <p className={cx('project-card-desc', !project.description && 'is-empty')}>{project.description || 'No description'}</p>
      <div className="project-card-progress">
        <Progress value={done} max={total} height={5} color={total && done === total ? 'var(--success)' : undefined} title={`${done} of ${total} tasks done`} />
        <span className="xs muted tabular">{total ? `${done}/${total} · ${pct}%` : 'No tasks'}</span>
      </div>
      <div className="project-card-foot">
        {project.lead ? (
          <Tooltip content={`Lead: ${project.lead.name}`}>
            <span className="row gap-1 small secondary">
              <Avatar name={project.lead.name} src={project.lead.avatarUrl} size={18} />
              <span className="truncate project-card-lead">{project.lead.name}</span>
            </span>
          </Tooltip>
        ) : (
          <span className="small faint">No lead</span>
        )}
        <span className="project-card-stats">
          {overdue ? (
            <span className="project-overdue" title={`${overdue} overdue`}>
              <Icon name="alert-circle" size={12} />
              {overdue}
            </span>
          ) : null}
          {memberCount ? (
            <span className="project-card-stat" title={`${memberCount} members`}>
              <Icon name="users" size={12} />
              {memberCount}
            </span>
          ) : null}
          <span className="project-card-stat" title={`Updated ${project.updatedAt}`}>
            <Icon name="clock" size={12} />
            {relativeTime(project.updatedAt)}
          </span>
        </span>
      </div>
    </Link>
  );
}

export function ProjectsPage() {
  const { workspace, projects, canEdit, isAdmin } = useWorkspace();
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useLocalStorage('tt.projects.archived', false);
  const [sort, setSort] = useLocalStorage<SortKey>('tt.projects.sort', 'recent');
  const [createOpen, setCreateOpen] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const archived = useArchivedProjects(showArchived ? workspace.id : null);
  const dashboard = useDashboard(workspace.id);
  useTick(60_000);
  useTopbar([{ label: 'Projects' }]);

  const overdueById = useMemo(() => new Map((dashboard.data?.projects ?? []).map((p) => [p.id, p.overdueCount])), [dashboard.data]);

  const list = useMemo(() => {
    const all = showArchived ? [...projects, ...(archived.data ?? []).filter((a) => !projects.some((p) => p.id === a.id))] : projects;
    const q = query.trim().toLowerCase();
    const filtered = q ? all.filter((p) => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)) : all;
    const sorted = [...filtered].sort((a, b) => {
      if (a.state !== b.state) return a.state === 'archived' ? 1 : -1;
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'progress') {
        const pa = a.taskCount ? (a.doneCount ?? 0) / a.taskCount : -1;
        const pb = b.taskCount ? (b.doneCount ?? 0) / b.taskCount : -1;
        return pb - pa || a.name.localeCompare(b.name);
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return sorted;
  }, [projects, archived.data, showArchived, query, sort]);

  const restore = async (p: Project) => {
    setRestoring(p.id);
    try {
      await projectApi.update(p.id, { state: 'active' });
      invalidate(['projects', 'dashboard']);
      toast.success(`${p.name} restored`);
    } catch (e) {
      toast.fromError(e);
    } finally {
      setRestoring(null);
    }
  };

  const canCreate = canEdit;
  const loadingArchived = showArchived && archived.isLoading && !archived.data;
  const activeCount = projects.length;
  const archivedCount = archived.data?.length ?? 0;

  return (
    <div className="page projects-page">
      <div className="page-header">
        <div>
          <div className="page-title">
            <h1>Projects</h1>
            <span className="badge badge-neutral badge-sm tabular">{activeCount}</span>
          </div>
          <p className="page-subtitle">
            {activeCount ? `${activeCount} active project${activeCount === 1 ? '' : 's'}` : 'No active projects yet'}
            {showArchived && archivedCount ? ` · ${archivedCount} archived` : ''}
          </p>
        </div>
        {canCreate ? (
          <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
            New project
          </Button>
        ) : null}
      </div>

      <div className="projects-toolbar">
        <Input icon="search" placeholder="Search projects…" value={query} onChange={(e) => setQuery(e.target.value)} className="projects-search" aria-label="Search projects" onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }} />
        <Segmented<SortKey> value={sort} onChange={setSort} size="sm" options={[{ value: 'recent', label: 'Recent', icon: 'clock' }, { value: 'name', label: 'Name', icon: 'text' }, { value: 'progress', label: 'Progress', icon: 'trending-up' }]} />
        <Switch checked={showArchived} onChange={setShowArchived} label={<span className="small">Show archived</span>} />
      </div>

      {list.length ? (
        <div className="projects-grid">
          {list.map((p) => (
            <ProjectCard key={p.id} project={p} overdue={overdueById.get(p.id)} onRestore={isAdmin || canEdit ? () => void restore(p) : undefined} restoring={restoring === p.id} />
          ))}
          {loadingArchived ? Array.from({ length: 2 }).map((_, i) => <div key={`sk${i}`} className="project-card project-card-skeleton"><Skeleton width="60%" height={14} /><Skeleton width="90%" height={10} /><Skeleton width="100%" height={5} /></div>) : null}
        </div>
      ) : loadingArchived ? (
        <div className="projects-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="project-card project-card-skeleton">
              <Skeleton width="60%" height={14} />
              <Skeleton width="90%" height={10} />
              <Skeleton width="100%" height={5} />
            </div>
          ))}
        </div>
      ) : query.trim() ? (
        <EmptyState icon="search" title="No projects match" description={`Nothing named “${query.trim()}”. Try a different search${showArchived ? '' : ', or include archived projects'}.`} action={<Button variant="secondary" onClick={() => setQuery('')}>Clear search</Button>} />
      ) : (
        <EmptyState
          icon="folder-plus"
          title="No projects yet"
          description="Projects group related tasks with their own workflow, labels and views. Create the first one to get started."
          action={canCreate ? <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>Create a project</Button> : undefined}
        />
      )}

      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
