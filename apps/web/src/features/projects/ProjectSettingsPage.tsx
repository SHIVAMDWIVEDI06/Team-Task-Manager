// Project settings: /w/:slug/p/:key/settings[/:tab] — general | workflow | labels | members | danger.
import { useBundle, useTasks } from '../../app/data.ts';
import { useMe } from '../../app/auth.tsx';
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { useWorkspace } from '../../app/workspace.tsx';
import { Link, navigate, useParams } from '../../lib/router.tsx';
import { Badge, Button, EmptyState, Skeleton } from '../../ui/primitives.tsx';
import { SettingsLayout, SettingsNotice, type SettingsTab } from '../settings/SettingsLayout.tsx';
import { GeneralTab } from './settings/GeneralTab.tsx';
import { WorkflowTab } from './settings/WorkflowTab.tsx';
import { LabelsTab } from './settings/LabelsTab.tsx';
import { MembersTab } from './settings/MembersTab.tsx';
import { DangerTab } from './settings/DangerTab.tsx';
import './project-settings.css';

type Tab = 'general' | 'workflow' | 'labels' | 'members' | 'danger';
const TABS: SettingsTab<Tab>[] = [
  { value: 'general', label: 'General', icon: 'settings' },
  { value: 'workflow', label: 'Workflow', icon: 'columns' },
  { value: 'labels', label: 'Labels', icon: 'tag' },
  { value: 'members', label: 'Members', icon: 'users' },
  { value: 'danger', label: 'Danger zone', icon: 'alert-triangle', danger: true },
];
const isTab = (t: string | undefined): t is Tab => TABS.some((x) => x.value === t);

export function ProjectSettingsPage() {
  const { key, tab: tabParam } = useParams<{ key: string; tab?: string }>();
  const ws = useWorkspace();
  const me = useMe();
  const project = ws.projectByKey(key);
  const projectId = project?.id ?? null;
  const bundle = useBundle(projectId);
  const tasksQ = useTasks(projectId);
  const tab: Tab = isTab(tabParam) ? tabParam : 'general';
  const canManage = Boolean(project && (ws.isAdmin || (project.leadId != null && project.leadId === me.id)));

  useTopbar([{ label: 'Projects', to: `${ws.base}/projects` }, { label: project?.name ?? key, to: project ? `${ws.base}/p/${project.key}` : undefined }, { label: 'Settings' }], null, [project?.name, project?.key, key]);

  if (!project) {
    return (
      <div className="page">
        <EmptyState icon="folder" title="Project not found" description={`There is no project with the key “${key}” in this workspace, or you don't have access to it.`} action={<Link to={`${ws.base}/projects`} className="btn btn-primary btn-md">All projects</Link>} />
      </div>
    );
  }

  const setTab = (t: Tab) => navigate(t === 'general' ? `${ws.base}/p/${project.key}/settings` : `${ws.base}/p/${project.key}/settings/${t}`);
  const current = bundle.data?.project ?? project;
  const tasks = tasksQ.data ?? [];
  const loading = bundle.isLoading && !bundle.data;

  return (
    <SettingsLayout
      title={
        <span className="row gap-3">
          <span className="project-icon project-icon-md" style={{ background: current.color }} aria-hidden>{current.icon}</span>
          <span className="truncate">{current.name}</span>
          <Badge size="sm" className="mono">{current.key}</Badge>
          {current.state === 'archived' ? <Badge size="sm" tone="warning" icon="archive">Archived</Badge> : null}
        </span>
      }
      description={canManage ? 'Configure how this project works.' : "You're viewing these settings in read-only mode."}
      tabs={TABS}
      value={tab}
      onChange={setTab}
      navTitle="Project"
      actions={<Button variant="outline" size="sm" icon="arrow-left" onClick={() => navigate(`${ws.base}/p/${project.key}`)}>Back to project</Button>}
    >
      {!canManage && tab === 'general' ? <SettingsNotice>Only workspace admins and the project lead{current.lead ? ` (${current.lead.name})` : ''} can change project settings.</SettingsNotice> : null}
      {bundle.error ? (
        <EmptyState icon="alert-circle" title="Couldn't load project settings" description={bundle.error.message} action={<Button variant="secondary" onClick={() => void bundle.refetch()}>Retry</Button>} />
      ) : loading ? (
        <div className="settings-card">
          <div className="settings-card-body is-padded col gap-3">
            <Skeleton height={14} width="40%" />
            <Skeleton height={32} />
            <Skeleton height={32} />
            <Skeleton height={14} width="60%" />
          </div>
        </div>
      ) : tab === 'workflow' ? (
        <WorkflowTab projectId={project.id} statuses={bundle.data?.statuses ?? []} tasks={tasks} canManage={canManage} />
      ) : tab === 'labels' ? (
        <LabelsTab projectId={project.id} labels={bundle.data?.labels ?? []} tasks={tasks} canManage={canManage} />
      ) : tab === 'members' ? (
        <MembersTab project={current} bundle={bundle.data} canManage={canManage} />
      ) : tab === 'danger' ? (
        <DangerTab project={current} taskCount={tasks.length} canManage={canManage} />
      ) : (
        <GeneralTab project={current} canManage={canManage} />
      )}
    </SettingsLayout>
  );
}
