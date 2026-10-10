// Workspace → Members: manage roles, remove members, pending invites.
import { useMemo, useState } from 'react';
import type { Invite, WorkspaceRole } from '../../../../../packages/shared/src/types.ts';
import { keys, useInvites, workspaceApi, type MemberWithPresence } from '../../app/data.ts';
import { useMe } from '../../app/auth.tsx';
import { useWorkspace } from '../../app/workspace.tsx';
import { invalidate, setQueryData } from '../../lib/query.ts';
import { relativeTime } from '../../lib/format.ts';
import { toast } from '../../lib/toast.ts';
import { useConfirm } from '../../ui/overlays.tsx';
import { Select } from '../../ui/pickers.tsx';
import { Avatar, Badge, Button, EmptyState, Input, Skeleton, cx } from '../../ui/primitives.tsx';
import { SettingsCard, SettingsNotice } from './SettingsLayout.tsx';
import { RoleBadge, canManageRole, expiresIn, formatJoined, roleItemsFor } from './roles.tsx';
import { copyText } from './InviteDialog.tsx';

export function MembersSettings({ onInvite }: { onInvite: () => void }) {
  const { workspace, members, isAdmin } = useWorkspace();
  const me = useMe();
  const confirm = useConfirm();
  const [query, setQuery] = useState('');
  const myRole = workspace.role;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? members.filter((m) => m.user.name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q)) : members;
    return [...list].sort((a, b) => a.user.name.localeCompare(b.user.name));
  }, [members, query]);

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
    if (!(await confirm({ title: `Remove ${m.user.name}?`, description: `They will lose access to ${workspace.name} and be unassigned from their tasks. You can invite them again later.`, danger: true, confirmLabel: 'Remove member' }))) return;
    try {
      await workspaceApi.removeMember(workspace.id, m.userId);
      setQueryData<MemberWithPresence[]>(keys.members(workspace.id), (list) => list?.filter((x) => x.userId !== m.userId));
      invalidate([keys.members(workspace.id), 'bundle', 'dashboard', keys.activity(workspace.id)]);
      toast.success(`${m.user.name} removed from the workspace`);
    } catch (e) {
      toast.fromError(e);
    }
  };

  return (
    <>
      {!isAdmin ? <SettingsNotice>Only admins can change roles or remove members. Ask an admin if you need someone invited.</SettingsNotice> : null}
      <SettingsCard
        title={`Members · ${members.length}`}
        description="Everyone with access to this workspace."
        flush
        actions={isAdmin ? <Button variant="primary" size="sm" icon="user-plus" onClick={onInvite} data-testid="invite-open">Invite members</Button> : null}
      >
        <div className="members-toolbar">
          <Input size="sm" icon="search" placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search members" />
          <span className="grow" />
          <span className="xs muted tabular">{filtered.length === members.length ? `${members.length} member${members.length === 1 ? '' : 's'}` : `${filtered.length} of ${members.length}`}</span>
        </div>
        <div className="members-table" role="table" aria-label="Members" data-testid="members-table">
          <div className="member-row is-head" role="row">
            <span>Member</span>
            <span>Role</span>
            <span>Joined</span>
            <span>Last active</span>
            <span />
          </div>
          {filtered.map((m) => {
            const isMe = m.userId === me.id;
            const editable = isAdmin && !isMe && canManageRole(myRole, m.role);
            return (
              <div key={m.userId} className="member-row" role="row" data-testid="member-row" data-user-id={m.userId} data-email={m.user.email}>
                <div className="member-cell-user">
                  <Avatar name={m.user.name} src={m.user.avatarUrl} size={32} online={m.online} />
                  <div className="col" style={{ minWidth: 0 }}>
                    <span className="member-cell-name">
                      <span className="truncate">{m.user.name}</span>
                      {isMe ? <Badge size="sm">You</Badge> : null}
                    </span>
                    <span className="member-cell-email truncate">{m.user.email}</span>
                  </div>
                </div>
                <div className="member-cell-role">
                  {editable ? (
                    <Select size="sm" value={m.role} onChange={(r) => void changeRole(m, r)} items={roleItemsFor(myRole)} width={280} renderValue={() => <RoleBadge role={m.role} />} title={`Change ${m.user.name}'s role`} />
                  ) : (
                    <RoleBadge role={m.role} />
                  )}
                </div>
                <span className="member-cell-muted" title={m.joinedAt}>{formatJoined(m.joinedAt)}</span>
                <span className="member-cell-muted" title={m.user.lastActiveAt ?? undefined}>{m.online ? <span className="row gap-1"><span className="dot" style={{ width: 7, height: 7, background: 'var(--success)' }} /> Online</span> : m.user.lastActiveAt ? relativeTime(m.user.lastActiveAt) : '—'}</span>
                <span className="row" style={{ justifyContent: 'flex-end' }}>
                  {editable ? <Button size="sm" variant="ghost" icon="trash" iconOnly onClick={() => void remove(m)} title={`Remove ${m.user.name}`}>{`Remove ${m.user.name}`}</Button> : null}
                </span>
              </div>
            );
          })}
          {!filtered.length ? <EmptyState compact icon="users" title="No members match" description="Try a different name or email." /> : null}
        </div>
      </SettingsCard>
      {isAdmin ? <PendingInvites onInvite={onInvite} /> : null}
    </>
  );
}

export function PendingInvites({ onInvite, compact }: { onInvite?: () => void; compact?: boolean }) {
  const { workspace, member, isAdmin } = useWorkspace();
  const confirm = useConfirm();
  const q = useInvites(isAdmin ? workspace.id : null);
  const invites = q.data ?? [];

  const revoke = async (inv: Invite) => {
    if (!(await confirm({ title: `Revoke invite for ${inv.email}?`, description: 'The invitation link will stop working immediately.', danger: true, confirmLabel: 'Revoke' }))) return;
    try {
      await workspaceApi.revokeInvite(workspace.id, inv.id);
      setQueryData<Invite[]>(keys.invites(workspace.id), (list) => list?.filter((x) => x.id !== inv.id));
      invalidate(keys.activity(workspace.id));
      toast.success('Invite revoked');
    } catch (e) {
      toast.fromError(e);
    }
  };

  return (
    <SettingsCard title={`Pending invites${invites.length ? ` · ${invites.length}` : ''}`} description="People who have been invited but haven't joined yet." flush actions={onInvite && compact ? <Button size="sm" variant="secondary" icon="user-plus" onClick={onInvite}>Invite</Button> : null}>
      <div data-testid="pending-invites">
        {q.isLoading ? (
          <div className="col gap-2" style={{ padding: '12px 20px' }}>
            <Skeleton height={14} width="60%" />
            <Skeleton height={14} width="40%" />
          </div>
        ) : q.error ? (
          <EmptyState compact icon="alert-circle" title="Couldn't load invites" description={q.error.message} action={<Button size="sm" onClick={() => void q.refetch()}>Retry</Button>} />
        ) : !invites.length ? (
          <EmptyState compact icon="mail" title="No pending invites" description="Invites you send will show up here until they're accepted." action={onInvite ? <Button size="sm" variant="secondary" icon="user-plus" onClick={onInvite}>Invite people</Button> : undefined} />
        ) : (
          invites.map((inv) => {
            const inviter = inv.inviter ?? member(inv.invitedBy)?.user;
            const expired = Date.parse(inv.expiresAt) < Date.now();
            return (
              <div key={inv.id} className={cx('invite-row')} data-testid="invite-row" data-email={inv.email}>
                <div className="col" style={{ minWidth: 0 }}>
                  <span className="invite-email truncate">{inv.email}</span>
                  <span className="member-cell-email truncate">Invited by {inviter?.name ?? 'someone'} · {relativeTime(inv.createdAt)}</span>
                </div>
                <RoleBadge role={inv.role} />
                <span className="member-cell-muted" title={inv.expiresAt}>{expired ? <span style={{ color: 'var(--danger)' }}>Expired</span> : `Expires ${expiresIn(inv.expiresAt)}`}</span>
                <span className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                  {inv.link ? <Button size="sm" variant="ghost" icon="link" onClick={() => copyText(inv.link!, 'Invite link copied')}>Copy link</Button> : null}
                  <Button size="sm" variant="ghost" icon="x" iconOnly onClick={() => void revoke(inv)} title="Revoke invite">{`Revoke invite for ${inv.email}`}</Button>
                </span>
              </div>
            );
          })
        )}
      </div>
    </SettingsCard>
  );
}
