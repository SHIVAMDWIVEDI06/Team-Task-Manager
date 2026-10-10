// Workspace dashboard: greeting, stat tiles, my tasks / overdue / upcoming, charts, projects, workload, activity.
import { useMemo, useState, type ReactNode } from 'react';
import type { DashboardData, Priority, StatusCategory, Task } from '../../../../../packages/shared/src/types.ts';
import { PRIORITIES, STATUS_CATEGORIES } from '../../../../../packages/shared/src/constants.ts';
import { diffDays, todayISO } from '../../../../../packages/shared/src/utils.ts';
import { useDashboard } from '../../app/data.ts';
import { useWorkspace } from '../../app/workspace.tsx';
import { useMe } from '../../app/auth.tsx';
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { Link, navigate } from '../../lib/router.tsx';
import { formatDate, pluralize } from '../../lib/format.ts';
import { Avatar, Badge, Button, EmptyState, PriorityIcon, Progress, Skeleton, cx } from '../../ui/primitives.tsx';
import { Icon, type IconName } from '../../ui/Icon.tsx';
import { Tooltip } from '../../ui/overlays.tsx';
import { TaskRow, TaskRowSkeleton } from '../tasks/TaskRow.tsx';
import { openCreateTask } from '../tasks/CreateTaskDialog.tsx';
import { CreateProjectDialog } from '../projects/CreateProjectDialog.tsx';
import { ActivityItem } from './ActivityItem.tsx';
import { DonutChart, HBarChart, Sparkline, ThroughputChart } from './charts.tsx';
import './dashboard.css';

const CATEGORY_COLOR: Record<StatusCategory, string> = {
  backlog: 'var(--fg-faint)',
  todo: 'var(--brand)',
  in_progress: 'var(--warning)',
  done: 'var(--success)',
  cancelled: 'var(--danger)',
};
const PRIORITY_COLOR: Record<Priority, string> = { 0: 'var(--p-none)', 1: 'var(--p-low)', 2: 'var(--p-medium)', 3: 'var(--p-high)', 4: 'var(--p-urgent)' };

function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function Card({ title, icon, action, children, className, count, id }: { title: ReactNode; icon?: IconName | string; action?: ReactNode; children: ReactNode; className?: string; count?: number; id?: string }) {
  return (
    <section className={cx('card home-card', className)} aria-labelledby={id}>
      <header className="home-card-head">
        <h2 className="home-card-title" id={id}>
          {icon ? <Icon name={icon} size={15} className="home-card-icon" /> : null}
          {title}
          {count !== undefined ? <span className="home-card-count tabular">{count}</span> : null}
        </h2>
        {action}
      </header>
      <div className="home-card-body">{children}</div>
    </section>
  );
}

function Tile({ label, value, tone, icon, to, hint, spark, sparkColor }: { label: string; value: number; tone?: 'danger' | 'warning' | 'success' | 'brand'; icon: IconName | string; to: string; hint?: string; spark?: number[]; sparkColor?: string }) {
  return (
    <Link to={to} className={cx('home-tile', tone && `tone-${tone}`)} title={hint}>
      <span className="home-tile-top">
        <span className="home-tile-label">{label}</span>
        <span className="home-tile-icon"><Icon name={icon} size={14} /></span>
      </span>
      <span className="home-tile-bottom">
        <span className="home-tile-value">{value}</span>
        {spark ? <Sparkline values={spark} color={sparkColor ?? 'var(--fg-faint)'} /> : null}
      </span>
    </Link>
  );
}

function dayHeading(iso: string, today: string): string {
  const d = diffDays(today, iso);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return formatDate(iso, { weekday: true });
}

export function HomePage() {
  const ws = useWorkspace();
  const me = useMe();
  const dash = useDashboard(ws.workspace.id);
  const [createProject, setCreateProject] = useState(false);
  const base = ws.base;
  const today = todayISO();

  useTopbar([{ label: 'Home' }]);

  const data = dash.data;
  const firstName = me.name.trim().split(/\s+/)[0] || me.name;
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const upcomingByDay = useMemo(() => {
    const groups = new Map<string, Task[]>();
    for (const t of data?.upcoming ?? []) {
      const k = t.dueDate ?? '';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(t);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data?.upcoming]);

  const statusSegments = useMemo(
    () =>
      STATUS_CATEGORIES.map((c) => ({ key: c.value, label: c.label, color: CATEGORY_COLOR[c.value], value: data?.byStatusCategory.find((s) => s.category === c.value)?.count ?? 0 })),
    [data?.byStatusCategory],
  );
  const priorityRows = useMemo(
    () =>
      PRIORITIES.map((p) => ({
        key: String(p.value),
        label: (
          <span className="row gap-2">
            <PriorityIcon priority={p.value} size={13} />
            <span>{p.label}</span>
          </span>
        ),
        value: data?.byPriority.find((x) => x.priority === p.value)?.count ?? 0,
        color: PRIORITY_COLOR[p.value],
        title: `${p.label}: ${data?.byPriority.find((x) => x.priority === p.value)?.count ?? 0} open tasks`,
      })),
    [data?.byPriority],
  );
  const maxOpen = Math.max(1, ...(data?.workload.map((w) => w.open) ?? [1]));
  const openTotal = statusSegments.filter((s) => s.key !== 'done' && s.key !== 'cancelled').reduce((a, s) => a + s.value, 0);

  // ---- empty workspace ----
  if (!ws.projects.length) {
    return (
      <div className="page home">
        <header className="home-header">
          <div>
            <h1 className="home-greeting">{greeting()}, {firstName}</h1>
            <p className="page-subtitle">{dateLine} · Welcome to {ws.workspace.name}</p>
          </div>
        </header>
        <div className="card home-onboarding">
          <div className="home-onboarding-art" aria-hidden>
            <Icon name="rocket" size={28} strokeWidth={1.5} />
          </div>
          <h2>Set up your first project</h2>
          <p className="secondary">Projects hold tasks with their own workflow, labels and views. Create one to get the board, list, calendar and timeline going.</p>
          <div className="home-onboarding-steps">
            <div className="home-onboarding-step"><span className="home-step-num">1</span><span><b>Create a project</b><span className="muted">Pick a name and a short key like APP.</span></span></div>
            <div className="home-onboarding-step"><span className="home-step-num">2</span><span><b>Add tasks</b><span className="muted">Press <kbd className="kbd">C</kbd> anywhere to create one.</span></span></div>
            <div className="home-onboarding-step"><span className="home-step-num">3</span><span><b>Invite your team</b><span className="muted">Assign work and follow progress here.</span></span></div>
          </div>
          <div className="row gap-2 wrap">
            {ws.canEdit ? <Button variant="primary" icon="folder-plus" onClick={() => setCreateProject(true)}>Create project</Button> : null}
            {ws.isAdmin ? <Button variant="secondary" icon="user-plus" onClick={() => navigate(`${base}/settings/members?invite=1`)}>Invite members</Button> : null}
          </div>
        </div>
        <CreateProjectDialog open={createProject} onClose={() => setCreateProject(false)} />
      </div>
    );
  }

  const loading = dash.isLoading && !data;
  const counts = data?.counts;
  const created = data?.throughput.map((t) => t.created) ?? [];
  const completed = data?.throughput.map((t) => t.completed) ?? [];

  return (
    <div className="page home">
      <header className="home-header">
        <div className="home-header-text">
          <h1 className="home-greeting">{greeting()}, {firstName}</h1>
          <p className="page-subtitle">
            {dateLine}
            {counts ? (
              <>
                {' · '}
                {counts.assigned ? `${pluralize(counts.assigned, 'open task')} assigned to you` : 'Nothing assigned to you'}
                {counts.overdue ? <>, <span className="home-subtitle-danger">{counts.overdue} overdue</span></> : null}
                {counts.dueToday ? `, ${counts.dueToday} due today` : ''}
              </>
            ) : null}
          </p>
        </div>
        <div className="home-header-actions">
          {ws.canEdit ? (
            <Button variant="primary" icon="plus" onClick={() => openCreateTask()} title="New task (C)">
              New task
            </Button>
          ) : null}
        </div>
      </header>

      {dash.error && !data ? (
        <EmptyState icon="alert-circle" title="Couldn't load the dashboard" description={dash.error.message} action={<Button variant="secondary" onClick={() => void dash.refetch()}>Retry</Button>} />
      ) : null}

      <div className="home-tiles">
        {loading || !counts ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="home-tile is-skeleton">
              <Skeleton width={90} height={10} />
              <Skeleton width={44} height={26} />
            </div>
          ))
        ) : (
          <>
            <Tile label="Assigned to me" value={counts.assigned} icon="user" to={`${base}/my-work`} hint="Open tasks assigned to you" tone="brand" />
            <Tile label="Overdue" value={counts.overdue} icon="alert-circle" to={`${base}/my-work?filter=overdue`} tone={counts.overdue > 0 ? 'danger' : undefined} hint="Your open tasks past their due date" />
            <Tile label="Due today" value={counts.dueToday} icon="clock" to={`${base}/my-work?filter=today`} tone={counts.dueToday > 0 ? 'warning' : undefined} hint="Your tasks due today" />
            <Tile label="Due this week" value={counts.dueThisWeek} icon="calendar" to={`${base}/my-work?filter=week`} hint="Your tasks due in the next 7 days" />
            <Tile label="Completed this week" value={counts.completedThisWeek} icon="circle-check" to={`${base}/my-work?filter=completed`} tone={counts.completedThisWeek > 0 ? 'success' : undefined} hint="Tasks completed across the workspace in the last 7 days" spark={completed.slice(-7)} sparkColor="var(--success)" />
            <Tile label="Created this week" value={counts.createdThisWeek} icon="sparkles" to={`${base}/activity`} hint="Tasks created across the workspace in the last 7 days" spark={created.slice(-7)} sparkColor="var(--brand)" />
          </>
        )}
      </div>

      <div className="home-charts">
        <Card title="Throughput" icon="bar-chart" id="home-throughput" action={<span className="xs muted">Last 14 days · workspace</span>}>
          {loading || !data ? <Skeleton height={190} radius={8} /> : <ThroughputChart data={data.throughput} />}
        </Card>
        <Card title="Tasks by status" icon="pie-chart" id="home-status" action={<span className="xs muted tabular">{openTotal} open</span>}>
          {loading || !data ? (
            <div className="row gap-4"><Skeleton width={150} height={150} radius={75} /><div className="col gap-2 grow"><Skeleton height={12} /><Skeleton height={12} /><Skeleton height={12} /><Skeleton height={12} /></div></div>
          ) : (
            <DonutChart segments={statusSegments} centerLabel="tasks" onSelect={() => navigate(`${base}/projects`)} />
          )}
          {data && !data.byStatusCategory.length ? <div className="xs muted" style={{ marginTop: 8 }}>No tasks yet.</div> : null}
        </Card>
      </div>

      <div className="home-grid">
        <div className="home-main">
          <Card
            title="My tasks"
            icon="square-check-big"
            id="home-my-tasks"
            count={counts?.assigned}
            action={
              <Link to={`${base}/my-work`} className="btn btn-ghost btn-sm">
                View all <Icon name="arrow-right" size={13} />
              </Link>
            }
          >
            {loading || !data ? (
              <TaskRowSkeleton rows={5} />
            ) : data.myTasks.length ? (
              <div className="home-list">
                {data.myTasks.map((t) => (
                  <TaskRow key={t.id} task={t} showAssignee={false} />
                ))}
                {counts && counts.assigned > data.myTasks.length ? (
                  <Link to={`${base}/my-work`} className="home-list-more">
                    {counts.assigned - data.myTasks.length} more assigned to you
                  </Link>
                ) : null}
              </div>
            ) : (
              <EmptyState compact icon="smile" title="Nothing on your plate" description="Tasks assigned to you will show up here." action={ws.canEdit ? <Button size="sm" variant="secondary" icon="plus" onClick={() => openCreateTask({ assigneeId: me.id })}>Create a task for yourself</Button> : undefined} />
            )}
          </Card>

          <Card title="Overdue" icon="alert-circle" id="home-overdue" count={data?.overdue.length} className={cx(data?.overdue.length && 'is-danger')} action={<span className="xs muted">Across the workspace</span>}>
            {loading || !data ? (
              <TaskRowSkeleton rows={3} />
            ) : data.overdue.length ? (
              <div className="home-list">
                {data.overdue.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            ) : (
              <EmptyState compact icon="circle-check" title="Nothing overdue" description="Every open task is on schedule." />
            )}
          </Card>

          <Card title="Upcoming this week" icon="calendar" id="home-upcoming" count={data?.upcoming.length}>
            {loading || !data ? (
              <TaskRowSkeleton rows={4} />
            ) : upcomingByDay.length ? (
              <div className="home-list">
                {upcomingByDay.map(([day, tasks]) => (
                  <div key={day} className="home-day-group">
                    <div className={cx('home-day-heading', day === today && 'is-today')}>
                      {dayHeading(day, today)}
                      <span className="home-day-count tabular">{tasks.length}</span>
                    </div>
                    {tasks.map((t) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState compact icon="calendar" title="A quiet week ahead" description="No tasks are due in the next 7 days." />
            )}
          </Card>
        </div>

        <aside className="home-side">
          <Card title="Projects" icon="folder" id="home-projects" count={data?.projects.length} action={<Link to={`${base}/projects`} className="btn btn-ghost btn-sm">All</Link>}>
            {loading || !data ? (
              <div className="col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="row gap-3"><Skeleton width={28} height={28} radius={8} /><div className="col gap-2 grow"><Skeleton width="60%" height={11} /><Skeleton height={5} /></div></div>
                ))}
              </div>
            ) : data.projects.length ? (
              <div className="home-projects">
                {data.projects.map((p) => {
                  const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
                  return (
                    <Link key={p.id} to={`${base}/p/${p.key}`} className="home-project">
                      <span className="project-icon home-project-icon" style={{ background: p.color }} aria-hidden>{p.icon}</span>
                      <span className="home-project-body">
                        <span className="home-project-top">
                          <span className="home-project-name truncate">{p.name}</span>
                          {p.overdueCount ? (
                            <Tooltip content={`${p.overdueCount} overdue`}>
                              <Badge size="sm" tone="danger" icon="alert-circle">{p.overdueCount}</Badge>
                            </Tooltip>
                          ) : null}
                          <span className="home-project-pct tabular xs muted">{p.doneCount}/{p.taskCount}</span>
                        </span>
                        <Progress value={p.doneCount} max={p.taskCount} height={5} color={p.taskCount && pct === 100 ? 'var(--success)' : p.color} title={`${pct}% done`} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState compact icon="folder" title="No projects" />
            )}
          </Card>

          <Card title="Open by priority" icon="flag" id="home-priority">
            {loading || !data ? <div className="col gap-2"><Skeleton height={14} /><Skeleton height={14} /><Skeleton height={14} /><Skeleton height={14} /><Skeleton height={14} /></div> : <HBarChart rows={priorityRows} />}
          </Card>

          <Card title="Team workload" icon="users" id="home-workload" action={<span className="xs muted">Open · overdue · done this week</span>}>
            {loading || !data ? (
              <div className="col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="row gap-3"><Skeleton width={24} height={24} radius={12} /><div className="col gap-2 grow"><Skeleton width="45%" height={11} /><Skeleton height={6} /></div></div>
                ))}
              </div>
            ) : data.workload.length ? (
              <div className="home-workload">
                {data.workload.map((w) => {
                  const openPct = (w.open / maxOpen) * 100;
                  const overduePct = (Math.min(w.overdue, w.open) / maxOpen) * 100;
                  return (
                    <div key={w.user.id} className={cx('home-worker', w.user.id === me.id && 'is-me')} title={`${w.user.name}: ${w.open} open, ${w.overdue} overdue, ${w.done} done this week`}>
                      <Avatar name={w.user.name} src={w.user.avatarUrl} size={24} />
                      <span className="home-worker-body">
                        <span className="home-worker-top">
                          <span className="home-worker-name truncate">{w.user.name}{w.user.id === me.id ? <span className="muted"> (you)</span> : null}</span>
                          <span className="home-worker-stats tabular xs">
                            <span className="muted">{w.open} open</span>
                            {w.overdue ? <span className="home-worker-overdue">{w.overdue} overdue</span> : null}
                            <span className="home-worker-done">{w.done} done</span>
                          </span>
                        </span>
                        <span className="home-worker-bar" aria-hidden>
                          <span className="home-worker-open" style={{ width: `${openPct}%` }} />
                          <span className="home-worker-overdue-seg" style={{ width: `${overduePct}%` }} />
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState compact icon="users" title="No members yet" />
            )}
          </Card>

          <Card title="Recent activity" icon="activity" id="home-activity" action={<Link to={`${base}/activity`} className="btn btn-ghost btn-sm">All activity</Link>}>
            {loading || !data ? (
              <div className="col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="row gap-3"><Skeleton width={26} height={26} radius={13} /><div className="col gap-2 grow"><Skeleton width={`${55 + ((i * 13) % 35)}%`} height={11} /><Skeleton width={60} height={9} /></div></div>
                ))}
              </div>
            ) : data.recentActivity.length ? (
              <div className="home-activity">
                {data.recentActivity.slice(0, 10).map((a) => (
                  <ActivityItem key={a.id} activity={a} base={base} compact />
                ))}
              </div>
            ) : (
              <EmptyState compact icon="activity" title="No activity yet" description="Changes across the workspace will appear here." />
            )}
          </Card>
        </aside>
      </div>
      <CreateProjectDialog open={createProject} onClose={() => setCreateProject(false)} />
    </div>
  );
}
