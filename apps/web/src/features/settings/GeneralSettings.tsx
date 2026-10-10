// Workspace → General: name, logo, slug, danger zone (leave / delete).
import { useEffect, useState } from 'react';
import { keys, workspaceApi } from '../../app/data.ts';
import { useMe } from '../../app/auth.tsx';
import { useWorkspace } from '../../app/workspace.tsx';
import { RequestError } from '../../lib/api.ts';
import { invalidate, removeQueries, setQueryData } from '../../lib/query.ts';
import { navigate } from '../../lib/router.tsx';
import { toast } from '../../lib/toast.ts';
import { Dialog, useConfirm } from '../../ui/overlays.tsx';
import { Avatar, Button, Field, Input } from '../../ui/primitives.tsx';
import { DangerRow, FormRow, SettingsCard, SettingsNotice } from './SettingsLayout.tsx';
import { copyText } from './InviteDialog.tsx';
import type { Workspace } from '../../../../../packages/shared/src/types.ts';

export function GeneralSettings() {
  const { workspace, isAdmin, members } = useWorkspace();
  const me = useMe();
  const confirm = useConfirm();
  const isOwner = workspace.role === 'owner';
  const [name, setName] = useState(workspace.name);
  const [logoUrl, setLogoUrl] = useState(workspace.logoUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setName(workspace.name);
    setLogoUrl(workspace.logoUrl ?? '');
  }, [workspace.name, workspace.logoUrl]);

  const dirty = name.trim() !== workspace.name || (logoUrl.trim() || null) !== (workspace.logoUrl || null);
  const logoLooksValid = !logoUrl.trim() || /^(https?:\/\/|\/)/.test(logoUrl.trim());

  const save = async () => {
    if (!dirty) return;
    setBusy(true);
    setErrors({});
    try {
      const patch: { name?: string; logoUrl?: string | null } = {};
      if (name.trim() !== workspace.name) patch.name = name.trim();
      if ((logoUrl.trim() || null) !== (workspace.logoUrl || null)) patch.logoUrl = logoUrl.trim() || null;
      const updated = await workspaceApi.update(workspace.id, patch);
      setQueryData<Workspace>(keys.workspace(workspace.slug), (prev) => (prev ? { ...prev, ...updated } : updated));
      invalidate(keys.workspaces);
      toast.success('Workspace updated');
    } catch (e) {
      if (e instanceof RequestError) {
        const fe = e.fieldErrors;
        setErrors(Object.keys(fe).length ? fe : { _: e.message });
      } else setErrors({ _: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const otherOwners = members.filter((m) => m.role === 'owner' && m.userId !== me.id).length;
  const leave = async () => {
    if (isOwner && otherOwners === 0) {
      toast.error('Transfer ownership to another member before leaving');
      return;
    }
    if (!(await confirm({ title: `Leave ${workspace.name}?`, description: 'You will lose access to all of its projects and tasks. An admin can invite you back later.', danger: true, confirmLabel: 'Leave workspace' }))) return;
    try {
      await workspaceApi.removeMember(workspace.id, me.id);
      removeQueries(keys.workspace(workspace.slug));
      invalidate(keys.workspaces);
      toast.success(`You left ${workspace.name}`);
      navigate('/');
    } catch (e) {
      toast.fromError(e);
    }
  };

  return (
    <>
      {!isAdmin ? <SettingsNotice>Only admins can change workspace settings. You can still leave the workspace below.</SettingsNotice> : null}
      <SettingsCard
        title="Workspace"
        description="How your workspace appears across TeamTask."
        footer={
          isAdmin ? (
            <>
              {errors._ ? <span className="foot-note" style={{ color: 'var(--danger)' }}>{errors._}</span> : dirty ? <span className="foot-note">Unsaved changes</span> : null}
              <Button variant="ghost" disabled={!dirty || busy} onClick={() => { setName(workspace.name); setLogoUrl(workspace.logoUrl ?? ''); setErrors({}); }}>Reset</Button>
              <Button variant="primary" disabled={!dirty || !name.trim() || !logoLooksValid} loading={busy} onClick={() => void save()} data-testid="ws-save">Save changes</Button>
            </>
          ) : null
        }
      >
        <FormRow label="Name" htmlFor="ws-name" error={errors.name}>
          <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} disabled={!isAdmin} error={Boolean(errors.name)} placeholder="Acme Inc." />
        </FormRow>
        <FormRow label="Logo" hint="Paste a link to a square image. Uploads aren't supported for workspace logos yet." htmlFor="ws-logo" error={errors.logoUrl || (!logoLooksValid ? 'Enter a full URL starting with https://' : undefined)}>
          <div className="row gap-3 w-full" style={{ alignItems: 'center' }}>
            <Avatar name={name || workspace.name} src={logoUrl.trim() && logoLooksValid ? logoUrl.trim() : null} size={44} square />
            <Input id="ws-logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" disabled={!isAdmin} className="grow" error={!logoLooksValid} />
          </div>
        </FormRow>
        <FormRow label="URL" hint="Your workspace's address. This can't be changed.">
          <div className="row gap-2">
            <span className="readonly-value mono" data-testid="ws-slug">{window.location.origin}/w/{workspace.slug}</span>
            <Button size="sm" variant="ghost" icon="copy" iconOnly onClick={() => copyText(`${window.location.origin}/w/${workspace.slug}`, 'Workspace link copied')}>Copy workspace link</Button>
          </div>
        </FormRow>
        <FormRow label="Your role">
          <span className="readonly-value" style={{ textTransform: 'capitalize' }}>{workspace.role}</span>
        </FormRow>
      </SettingsCard>

      <SettingsCard title="Danger zone" description="These actions are permanent. Please be careful." danger>
        <DangerRow
          title="Leave workspace"
          description={isOwner && otherOwners === 0 ? 'You are the only owner. Make someone else an owner before leaving.' : 'You will lose access to all projects in this workspace.'}
          action={<Button variant="outline" icon="log-out" onClick={() => void leave()} disabled={isOwner && otherOwners === 0}>Leave workspace</Button>}
        />
        {isOwner ? (
          <DangerRow
            title="Delete workspace"
            description="Permanently deletes the workspace, all of its projects, tasks, comments and files."
            action={<Button variant="danger" icon="trash" onClick={() => setDeleteOpen(true)}>Delete workspace</Button>}
          />
        ) : null}
      </SettingsCard>

      <DeleteWorkspaceDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </>
  );
}

function DeleteWorkspaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workspace } = useWorkspace();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);
  const ok = typed.trim() === workspace.name;
  const run = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      await workspaceApi.remove(workspace.id);
      removeQueries(keys.workspace(workspace.slug));
      invalidate(keys.workspaces);
      toast.success('Workspace deleted');
      onClose();
      navigate('/');
    } catch (e) {
      toast.fromError(e);
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Delete workspace"
      description="This cannot be undone. Everything in this workspace will be permanently removed."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={!ok} loading={busy} onClick={() => void run()}>Delete forever</Button>
        </>
      }
    >
      <form className="form" onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <Field label={<span>Type <strong>{workspace.name}</strong> to confirm</span>} htmlFor="ws-delete-confirm">
          <Input id="ws-delete-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={workspace.name} autoComplete="off" data-autofocus />
        </Field>
      </form>
    </Dialog>
  );
}
