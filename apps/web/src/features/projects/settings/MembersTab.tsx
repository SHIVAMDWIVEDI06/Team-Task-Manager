// Project settings → Members: access list for private projects.
import { useEffect, useMemo, useState } from 'react';
import type { Project, ProjectBundle } from '../../../../../../packages/shared/src/types.ts';
import { keys, projectApi } from '../../../app/data.ts';
import { useMe } from '../../../app/auth.tsx';
import { useWorkspace } from '../../../app/workspace.tsx';
import { invalidate, setQueryData } from '../../../lib/query.ts';
import { toast } from '../../../lib/toast.ts';
import { Icon } from '../../../ui/Icon.tsx';
import { useConfirm } from '../../../ui/overlays.tsx';
import { Avatar, Badge, Button, Checkbox, EmptyState, Input, cx } from '../../../ui/primitives.tsx';
import { SettingsCard, SettingsNotice } from '../../settings/SettingsLayout.tsx';
import { RoleBadge } from '../../settings/roles.tsx';

export function MembersTab({ project, bundle, canManage }: { project: Project; bundle: ProjectBundle | undefined; canManage: boolean }) {
  const { members: wsMembers } = useWorkspace();
  const me = useMe();
  const confirm = useConfirm();
  const currentIds = useMemo(() => new Set((project.memberIds ?? bundle?.members.map((m) => m.userId) ?? []) as string[]), [project.memberIds, bundle?.members]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(currentIds));
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelected(new Set(currentIds));
  }, [currentIds]);

  const locked = new Set<string>([...(project.leadId ? [project.leadId] : []), me.id]);
  const dirty = selected.size !== currentIds.size || [...selected].some((id) => !currentIds.has(id));
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const l = q ? wsMembers.filter((m) => m.user.name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q)) : wsMembers;
    return [...l].sort((a, b) => (a.userId === me.id ? -1 : b.userId === me.id ? 1 : a.user.name.localeCompare(b.user.name)));
  }, [wsMembers, query, me.id]);

  const toggle = (id: string) => {
    if (!canManage || locked.has(id)) return;
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const save = async () => {
    setBusy(true);
    try {
      const ids = [...new Set([...selected, ...locked])];
      await projectApi.setMembers(project.id, ids);
      setQueryData<ProjectBundle>(keys.bundle(project.id), (prev) => (prev ? { ...prev, project: { ...prev.project, memberIds: ids }, members: wsMembers.filter((m) => ids.includes(m.userId)) } : prev));
      invalidate(['projects', keys.bundle(project.id)]);
      toast.success('Project members updated');
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(false);
    }
  };
  const makePrivate = async () => {
    if (!(await confirm({ title: `Make ${project.name} private?`, description: 'Only members you add will be able to see it. You and the project lead are added automatically.', confirmLabel: 'Make private' }))) return;
    try {
      const updated = await projectApi.update(project.id, { visibility: 'private' });
      setQueryData<ProjectBundle>(keys.bundle(project.id), (prev) => (prev ? { ...prev, project: { ...prev.project, ...updated } } : prev));
      invalidate(['projects', keys.bundle(project.id)]);
      toast.success('Project is now private');
    } catch (e) {
      toast.fromError(e);
    }
  };
  const makePublic = async () => {
    try {
      const updated = await projectApi.update(project.id, { visibility: 'public' });
      setQueryData<ProjectBundle>(keys.bundle(project.id), (prev) => (prev ? { ...prev, project: { ...prev.project, ...updated } } : prev));
      invalidate(['projects', keys.bundle(project.id)]);
      toast.success('Project is now visible to the whole workspace');
    } catch (e) {
      toast.fromError(e);
    }
  };

  if (project.visibility === 'public') {
    return (
      <SettingsCard title="Members" description="Who can see and work in this project." flush>
        <div className="ps-visibility-hero">
          <span className="ps-visibility-icon"><Icon name="globe" size={20} /></span>
          <div className="grow">
            <div className="medium">Everyone in the workspace can access this project</div>
            <div className="small muted">All {wsMembers.length} workspace members can see it. Guests can view; members and admins can edit.</div>
          </div>
          {canManage ? <Button variant="outline" icon="lock" onClick={() => void makePrivate()}>Make private</Button> : null}
        </div>
      </SettingsCard>
    );
  }

  return (
    <>
      {!canManage ? <SettingsNotice>Only workspace admins and the project lead can change who has access.</SettingsNotice> : null}
      <SettingsCard
        title={`Members · ${currentIds.size}`}
        description="This project is private. Only the people checked below can see it."
        flush
        actions={canManage ? <Button size="sm" variant="ghost" icon="globe" onClick={() => void makePublic()}>Make visible to workspace</Button> : null}
        footer={
          canManage ? (
            <>
              {dirty ? <span className="foot-note">{selected.size} selected · unsaved</span> : <span className="foot-note">{selected.size} selected</span>}
              <Button variant="ghost" disabled={!dirty || busy} onClick={() => setSelected(new Set(currentIds))}>Reset</Button>
              <Button variant="primary" disabled={!dirty} loading={busy} onClick={() => void save()} data-testid="members-save">Save members</Button>
            </>
          ) : null
        }
      >
        <div className="members-toolbar">
          <Input size="sm" icon="search" placeholder="Search workspace members" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search members" />
        </div>
        <div className="ps-member-list" role="list">
          {list.map((m) => {
            const on = selected.has(m.userId) || locked.has(m.userId);
            const isLocked = locked.has(m.userId);
            if (!canManage && !on) return null;
            return (
              <div key={m.userId} className={cx('ps-member-row', (isLocked || !canManage) && 'is-locked')} role="listitem" onClick={() => toggle(m.userId)} data-testid="project-member-row" data-user-id={m.userId}>
                {canManage ? <Checkbox checked={on} onChange={() => toggle(m.userId)} disabled={isLocked} /> : null}
                <Avatar name={m.user.name} src={m.user.avatarUrl} size={30} />
                <div className="ps-member-main">
                  <span className="ps-member-name">
                    <span className="truncate">{m.user.name}</span>
                    {m.userId === me.id ? <Badge size="sm">You</Badge> : null}
                    {m.userId === project.leadId ? <Badge size="sm" tone="brand" icon="star">Lead</Badge> : null}
                  </span>
                  <span className="ps-member-email truncate">{m.user.email}</span>
                </div>
                <RoleBadge role={m.role} />
              </div>
            );
          })}
          {!list.length ? <EmptyState compact icon="users" title="No members match" /> : null}
        </div>
      </SettingsCard>
    </>
  );
}
