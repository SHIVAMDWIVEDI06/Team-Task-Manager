// Workspace activity: /w/:slug/activity — filter by project and event group, load older pages, live updates.
import { useEffect, useMemo, useState } from 'react';
import type { Activity } from '../../../../../packages/shared/src/types.ts';
import { useWorkspaceActivity } from '../../app/data.ts';
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { useWorkspace } from '../../app/workspace.tsx';
import { api } from '../../lib/api.ts';
import { uiStore } from '../../lib/store.ts';
import { toast } from '../../lib/toast.ts';
import { useSearchParams } from '../../lib/router.tsx';
import { Select, type PickerItem } from '../../ui/pickers.tsx';
import { Button, EmptyState, Segmented, Skeleton, cx } from '../../ui/primitives.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { ActivityFeed, activityGroup } from './ActivityFeed.tsx';
import './activity.css';

type Group = 'all' | 'tasks' | 'comments' | 'people';
const PAGE = 100;

export function ActivityPage() {
  const ws = useWorkspace();
  const [params, setParams] = useSearchParams();
  const projectParam = params.get('project');
  const project = projectParam ? ws.projects.find((p) => p.id === projectParam || p.key === projectParam) ?? null : null;
  const projectId = project?.id ?? null;
  const groupParam = params.get('type') as Group | null;
  const group: Group = groupParam && ['all', 'tasks', 'comments', 'people'].includes(groupParam) ? groupParam : 'all';
  const connected = uiStore.use((s) => s.realtimeConnected);

  useTopbar([{ label: 'Activity' }], null, []);

  const q = useWorkspaceActivity(ws.workspace.id, projectId);
  const [older, setOlder] = useState<{ projectId: string | null; items: Activity[]; done: boolean }>({ projectId, items: [], done: false });
  const [loadingMore, setLoadingMore] = useState(false);

  // Reset the "older" pages when the project filter changes.
  useEffect(() => {
    setOlder((o) => (o.projectId === projectId ? o : { projectId, items: [], done: false }));
  }, [projectId]);

  const merged = useMemo(() => {
    const seen = new Set<string>();
    const out: Activity[] = [];
    for (const a of [...(q.data ?? []), ...(older.projectId === projectId ? older.items : [])]) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      out.push(a);
    }
    return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }, [q.data, older, projectId]);

  const visible = useMemo(() => (group === 'all' ? merged : merged.filter((a) => activityGroup(a.type) === group)), [merged, group]);

  const loadOlder = async () => {
    const last = merged[merged.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.get<Activity[]>(`/api/workspaces/${ws.workspace.id}/activity?limit=${PAGE}&before=${encodeURIComponent(last.createdAt)}${projectId ? `&project=${projectId}` : ''}`);
      setOlder((o) => ({ projectId, items: o.projectId === projectId ? [...o.items, ...page] : page, done: page.length < PAGE }));
    } catch (e) {
      toast.fromError(e);
    } finally {
      setLoadingMore(false);
    }
  };

  const projectItems: PickerItem<string>[] = [
    { value: '__all__', label: 'All projects', icon: <Icon name="layers" size={14} className="muted" /> },
    ...ws.projects.map((p) => ({ value: p.id, label: p.name, description: p.key, keywords: p.key, icon: <span className="project-icon" style={{ background: p.color }}>{p.icon}</span> })),
  ];

  const counts = useMemo(() => {
    const c = { all: merged.length, tasks: 0, comments: 0, people: 0 };
    for (const a of merged) c[activityGroup(a.type)]++;
    return c;
  }, [merged]);

  const exhausted = older.done || (q.data !== undefined && q.data.length < PAGE && older.items.length === 0);
  const loading = q.isLoading && !q.data;

  return (
    <div className="page page-narrow activity-page">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>Activity</h1>
          <p className="page-subtitle">Everything that happens across {project ? project.name : ws.workspace.name}, as it happens.</p>
        </div>
      </div>
      <div className="activity-toolbar">
        <Select value={projectId ?? '__all__'} onChange={(v) => setParams({ project: v === '__all__' ? null : ws.projects.find((p) => p.id === v)?.key ?? v })} items={projectItems} size="sm" searchable={ws.projects.length > 6} width={260} title="Filter by project" />
        <Segmented
          size="sm"
          value={group}
          onChange={(g) => setParams({ type: g === 'all' ? null : g })}
          options={[
            { value: 'all', label: `All`, title: `${counts.all} events loaded` },
            { value: 'tasks', label: 'Tasks', icon: 'check-square', title: `${counts.tasks} task events` },
            { value: 'comments', label: 'Comments', icon: 'message', title: `${counts.comments} comments` },
            { value: 'people', label: 'Members & projects', icon: 'users', title: `${counts.people} events` },
          ]}
        />
        <span className={cx('activity-live', connected && 'is-on')} title={connected ? 'New activity appears automatically' : 'Reconnecting to live updates…'} data-testid="activity-live">
          <span className="activity-live-dot" />
          {connected ? 'Live' : 'Offline'}
        </span>
      </div>

      {loading ? (
        <div className="activity-group">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="activity-skeleton">
              <Skeleton width={28} height={28} radius={14} />
              <div className="col gap-2 grow">
                <Skeleton width={`${45 + ((i * 19) % 40)}%`} height={12} />
                <Skeleton width={80} height={9} />
              </div>
            </div>
          ))}
        </div>
      ) : q.error ? (
        <EmptyState icon="alert-circle" title="Couldn't load activity" description={q.error.message} action={<Button variant="secondary" onClick={() => void q.refetch()}>Retry</Button>} />
      ) : !visible.length ? (
        <EmptyState icon="activity" title={merged.length ? 'Nothing here for this filter' : 'No activity yet'} description={merged.length ? 'Try a different type or load older activity.' : 'Create a task, leave a comment or invite someone and it will show up here.'} action={merged.length && !exhausted ? <Button variant="secondary" loading={loadingMore} onClick={() => void loadOlder()}>Load older</Button> : undefined} />
      ) : (
        <ActivityFeed
          activities={visible}
          base={ws.base}
          showProject={!project}
          footer={
            <div className="activity-footer">
              {exhausted ? (
                <span className="row gap-2"><Icon name="check" size={13} /> You've reached the beginning</span>
              ) : (
                <Button variant="outline" size="sm" icon="history" loading={loadingMore} onClick={() => void loadOlder()} data-testid="load-older">Load older</Button>
              )}
            </div>
          }
        />
      )}
    </div>
  );
}
