// Team: /w/:slug/team — everyone in the workspace, with presence, local time, workload and admin actions.
import { useMemo, useState } from 'react';
import type { WorkspaceRole } from '../../../../../packages/shared/src/types.ts';
import { ROLES } from '../../../../../packages/shared/src/constants.ts';
import { keys, useDashboard, useMembers, workspaceApi, type MemberWithPresence } from '../../app/data.ts';
import { useMe } from '../../app/auth.tsx';
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { useWorkspace } from '../../app/workspace.tsx';
import { useTick } from '../../lib/hooks.ts';
import { invalidate, setQueryData } from '../../lib/query.ts';
import { navigate } from '../../lib/router.tsx';
import { relativeTime, formatDateTime } from '../../lib/format.ts';
import { toast } from '../../lib/toast.ts';
import { Icon } from '../../ui/Icon.tsx';
import { Dialog, MenuButton, useConfirm, type MenuItem } from '../../ui/overlays.tsx';
import { Avatar, Badge, Button, EmptyState, Input, Skeleton, cx } from '../../ui/primitives.tsx';
import { InviteDialog, copyText } from '../settings/InviteDialog.tsx';
import { PendingInvites } from '../settings/MembersSettings.tsx';
import { RoleBadge, canManageRole, formatJoined, localTimeIn, roleItemsFor, tzOffsetLabel } from '../settings/roles.tsx';
import './team.css';

type Stats = { open: number; overdue: number; done: number };

function useTeamActions() {
  const { workspace } = useWorkspace();
  const confirm = useConfirm();
  const changeRole = async (m: MemberWithPresence, role: WorkspaceRole) => {
    if (role === m.role) return;
    const prev = m.role;
    setQueryData<MemberWithPresence[]>(keys.members(workspace.id), (list) => list?.map((x) => (x.userId === m.userId ? { ...x, role } : x)));
    try {
      await workspaceApi.setRole(workspace.id, m.userId, role);
      toast.success(`${m.user.name} is now ${role === 'owner' || role === 'admin' ? 'an' : 'a'} ${role}`);
      invalidate([keys.members(workspace.id), keys.activity(workspace.id)]);
    } catch (e) {
      setQueryData<MemberWithPresence[]>(keys.members(workspace.id), (list) => list?.map((x) => (x.userId === m.userId ? { ...x, role: prev } : x)));
      toast.fromError(e);
    }
  };
  const remove = async (m: MemberWithPresence) => {
    if (!(await confirm({ title: `Remove ${m.user.name} from ${workspace.name}?`, description: 'They will lose access to every project and be unassigned from their tasks.', danger: true, confirmLabel: 'Remove member' }))) return false;
    try {
      await workspaceApi.removeMember(workspace.id, m.userId);
      setQueryData<MemberWithPresence[]>(keys.members(workspace.id), (list) => list?.filter((x) => x.userId !== m.userId));
      invalidate([keys.members(workspace.id), 'bundle', 'dashboard', keys.activity(workspace.id)]);
      toast.success(`${m.user.name} removed`);
      return true;
    } catch (e) {
      toast.fromError(e);
      return false;
    }
  };
  return { changeRole, remove };
}

function memberMenu(m: MemberWithPresence, opts: { myRole: WorkspaceRole; isMe: boolean; isAdmin: boolean; base: string; onProfile: () => void; onRole: (r: WorkspaceRole) => void; onRemove: () => void }): MenuItem[] {
  const items: MenuItem[] = [
    { label: 'View profile', icon: 'user', onSelect: opts.onProfile },
    { label: 'Copy email', icon: 'copy', onSelect: () => copyText(m.user.email, 'Email copied') },
    { label: 'Browse projects', icon: 'folder', onSelect: () => navigate(`${opts.base}/projects`) },
  ];
  if (opts.isAdmin && !opts.isMe && canManageRole(opts.myRole, m.role)) {
    items.push({ separator: true, label: '' });
    for (const r of roleItemsFor(opts.myRole)) items.push({ key: `role-${r.value}`, label: r.label, description: r.description, checked: m.role === r.value, onSelect: () => opts.onRole(r.value) });
    items.push({ separator: true, label: '' }, { label: 'Remove from workspace', icon: 'trash', danger: true, onSelect: opts.onRemove });
  }
  return items;
}

function StatTiles({ stats, compact }: { stats: Stats | null; compact?: boolean }) {
  const tile = (label: string, value: number | null, kind?: string) => (
    <div className={cx('team-stat', kind && `is-${kind}`, value === 0 && 'is-zero')} title={label}>
      <span className="team-stat-value tabular">{value === null ? '–' : value}</span>
      <span className="team-stat-label">{label}</span>
    </div>
  );
  return (
    <div className={cx('team-stats', compact && 'is-compact')}>
      {tile('Open', stats ? stats.open : null)}
      {tile('Overdue', stats ? stats.overdue : null, 'overdue')}
      {tile('Done · 7d', stats ? stats.done : null, 'done')}
    </div>
  );
}

function MemberCard({ m, stats, isMe, menu, onOpen }: { m: MemberWithPresence; stats: Stats | null; isMe: boolean; menu: MenuItem[]; onOpen: () => void }) {
  const local = localTimeIn(m.user.timezone);
  const offset = tzOffsetLabel(m.user.timezone);
  return (
    <div className="team-card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }} data-testid="team-card" data-user-id={m.userId} aria-label={`${m.user.name}, ${m.role}`}>
      <div className="team-card-head">
        <Avatar name={m.user.name} src={m.user.avatarUrl} size={44} online={m.online} />
        <div className="col" style={{ minWidth: 0, gap: 2 }}>
          <span className="team-card-name">
            <span className="truncate">{m.user.name}</span>
            {isMe ? <Badge size="sm">You</Badge> : null}
          </span>
          <span className="team-card-email truncate">{m.user.email}</span>
          <span className="row gap-2" style={{ marginTop: 2 }}>
            <RoleBadge role={m.role} />
            <span className={cx('xs', m.online ? 'secondary' : 'faint')}>{m.online ? 'Online now' : m.user.lastActiveAt ? `Active ${relativeTime(m.user.lastActiveAt)}` : 'Never active'}</span>
          </span>
        </div>
      </div>
      <div className="team-card-menu" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <MenuButton items={menu} label={`Actions for ${m.user.name}`} />
      </div>
      <div className="team-card-facts">
        <span className="team-fact" title={m.user.timezone}>
          <Icon name="clock" size={13} />
          <span className="team-fact-value truncate">{local ? `${local} local` : m.user.timezone || 'Unknown timezone'}{offset && local ? <span className="faint"> · {offset}</span> : null}</span>
        </span>
        <span className="team-fact" title={`Joined ${formatDateTime(m.joinedAt)}`}>
          <Icon name="calendar" size={13} />
          <span className="team-fact-value truncate">Joined {formatJoined(m.joinedAt)}</span>
        </span>
      </div>
      <StatTiles stats={stats} />
    </div>
  );
}

function MemberProfileDialog({ m, stats, onClose, menu }: { m: MemberWithPresence | null; stats: Stats | null; onClose: () => void; menu: MenuItem[] }) {
  const local = m ? localTimeIn(m.user.timezone) : null;
  const offset = m ? tzOffsetLabel(m.user.timezone) : '';
  const roleDef = m ? ROLES.find((r) => r.value === m.role) : null;
  return (
    <Dialog open={Boolean(m)} onClose={onClose} title="Member profile" size="sm" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {m ? (
        <div className="member-profile" data-testid="member-profile">
          <div className="member-profile-head">
            <Avatar name={m.user.name} src={m.user.avatarUrl} size={56} online={m.online} />
            <div className="col gap-1" style={{ minWidth: 0 }}>
              <span className="member-profile-name"><span className="truncate">{m.user.name}</span></span>
              <span className="row gap-2">
                <RoleBadge role={m.role} />
                <span className="xs muted">{m.online ? 'Online now' : m.user.lastActiveAt ? `Active ${relativeTime(m.user.lastActiveAt)}` : 'Never active'}</span>
              </span>
            </div>
            <span className="ml-auto"><MenuButton items={menu} label={`Actions for ${m.user.name}`} variant="outline" /></span>
          </div>
          <dl className="member-profile-facts">
            <dt>Email</dt>
            <dd className="row gap-1">
              <span className="truncate">{m.user.email}</span>
              <Button size="sm" variant="ghost" icon="copy" iconOnly onClick={() => copyText(m.user.email, 'Email copied')}>Copy email</Button>
            </dd>
            <dt>Local time</dt>
            <dd>{local ? `${local}` : '—'}{offset ? <span className="muted"> · {offset}</span> : null}<div className="xs muted">{m.user.timezone}</div></dd>
            <dt>Joined</dt>
            <dd>{formatJoined(m.joinedAt)}</dd>
            <dt>Role</dt>
            <dd>{roleDef?.label}<div className="xs muted">{roleDef?.description}</div></dd>
          </dl>
          <div>
            <div className="section-title" style={{ marginBottom: 8 }}>Workload</div>
            <StatTiles stats={stats} />
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

export function TeamPage() {
  const { workspace, base, isAdmin } = useWorkspace();
  const me = useMe();
  const membersQ = useMembers(workspace.id);
  const dash = useDashboard(workspace.id);
  const { changeRole, remove } = useTeamActions();
  const [query, setQuery] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  useTick(30_000);

  useTopbar([{ label: 'Team' }], null, []);

  const members = useMemo(() => membersQ.data ?? [], [membersQ.data]);
  const statsFor = useMemo(() => {
    const map = new Map<string, Stats>();
    for (const w of dash.data?.workload ?? []) map.set(w.user.id, { open: w.open, overdue: w.overdue, done: w.done });
    return (id: string): Stats | null => (dash.data ? map.get(id) ?? { open: 0, overdue: 0, done: 0 } : null);
  }, [dash.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? members.filter((m) => m.user.name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q) || m.role.includes(q)) : members;
    const rank: Record<WorkspaceRole, number> = { owner: 0, admin: 1, member: 2, guest: 3 };
    return [...list].sort((a, b) => (a.userId === me.id ? -1 : b.userId === me.id ? 1 : Number(b.online) - Number(a.online) || rank[a.role] - rank[b.role] || a.user.name.localeCompare(b.user.name)));
  }, [members, query, me.id]);

  const online = members.filter((m) => m.online).length;
  const profile = members.find((m) => m.userId === profileId) ?? null;
  const menuFor = (m: MemberWithPresence) =>
    memberMenu(m, {
      myRole: workspace.role,
      isMe: m.userId === me.id,
      isAdmin,
      base,
      onProfile: () => setProfileId(m.userId),
      onRole: (r) => void changeRole(m, r),
      onRemove: () => void remove(m).then((ok) => ok && profileId === m.userId && setProfileId(null)),
    });

  const loading = membersQ.isLoading && !membersQ.data;

  return (
    <div className="page team-page">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>Team</h1>
          <p className="page-subtitle">
            {members.length} member{members.length === 1 ? '' : 's'} in {workspace.name}
            {online ? <> · <span style={{ color: 'var(--success)' }}>{online} online</span></> : null}
          </p>
        </div>
        {isAdmin ? <Button variant="primary" icon="user-plus" onClick={() => setInviteOpen(true)} data-testid="team-invite">Invite people</Button> : null}
      </div>
      <div className="team-toolbar">
        <Input size="sm" icon="search" placeholder="Search people…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search members" />
        {query ? <span className="team-summary">{filtered.length} of {members.length}</span> : null}
        <span className="grow" />
        {dash.isLoading && !dash.data ? <span className="team-summary"><Skeleton width={90} height={10} /></span> : <span className="team-summary" title="Open / overdue / completed in the last 7 days, per person"><Icon name="bar-chart" size={13} /> Workload from assigned tasks</span>}
      </div>

      {loading ? (
        <div className="team-grid">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="team-card" style={{ cursor: 'default' }}>
              <div className="team-card-head">
                <Skeleton width={44} height={44} radius={22} />
                <div className="col gap-2 grow">
                  <Skeleton width="55%" height={12} />
                  <Skeleton width="75%" height={10} />
                </div>
              </div>
              <Skeleton height={44} />
            </div>
          ))}
        </div>
      ) : membersQ.error ? (
        <EmptyState icon="alert-circle" title="Couldn't load the team" description={membersQ.error.message} action={<Button variant="secondary" onClick={() => void membersQ.refetch()}>Retry</Button>} />
      ) : !filtered.length ? (
        <EmptyState icon="users" title="No one matches" description="Try a different name, email or role." action={<Button variant="ghost" onClick={() => setQuery('')}>Clear search</Button>} />
      ) : (
        <div className="team-grid" data-testid="team-grid">
          {filtered.map((m) => (
            <MemberCard key={m.userId} m={m} stats={statsFor(m.userId)} isMe={m.userId === me.id} menu={menuFor(m)} onOpen={() => setProfileId(m.userId)} />
          ))}
        </div>
      )}

      {isAdmin ? <PendingInvites onInvite={() => setInviteOpen(true)} compact /> : null}

      <MemberProfileDialog m={profile} stats={profile ? statsFor(profile.userId) : null} onClose={() => setProfileId(null)} menu={profile ? menuFor(profile) : []} />
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
