// Project settings → Danger zone: archive / restore, delete.
import { useEffect, useState } from 'react';
import type { Project, ProjectBundle } from '../../../../../../packages/shared/src/types.ts';
import { keys, projectApi } from '../../../app/data.ts';
import { useWorkspace } from '../../../app/workspace.tsx';
import { invalidate, setQueryData } from '../../../lib/query.ts';
import { navigate } from '../../../lib/router.tsx';
import { toast } from '../../../lib/toast.ts';
import { Dialog, useConfirm } from '../../../ui/overlays.tsx';
import { Button, Field, Input } from '../../../ui/primitives.tsx';
import { DangerRow, SettingsCard, SettingsNotice } from '../../settings/SettingsLayout.tsx';

export function DangerTab({ project, taskCount, canManage }: { project: Project; taskCount: number; canManage: boolean }) {
  const { base } = useWorkspace();
  const confirm = useConfirm();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const archived = project.state === 'archived';

  const toggleArchive = async () => {
    if (!archived && !(await confirm({ title: `Archive ${project.name}?`, description: 'Archived projects are hidden from the sidebar and task lists. You can restore them at any time.', confirmLabel: 'Archive project' }))) return;
    setBusy(true);
    try {
      const updated = await projectApi.update(project.id, { state: archived ? 'active' : 'archived' });
      setQueryData<ProjectBundle>(keys.bundle(project.id), (prev) => (prev ? { ...prev, project: { ...prev.project, ...updated } } : prev));
      invalidate(['projects', 'dashboard', 'mytasks']);
      toast.success(archived ? 'Project restored' : 'Project archived');
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!canManage ? <SettingsNotice>Only workspace admins and the project lead can archive or delete this project.</SettingsNotice> : null}
      <SettingsCard title="Danger zone" description="Careful — these affect everyone in the project." danger>
        <DangerRow
          title={archived ? 'Restore project' : 'Archive project'}
          description={archived ? 'Bring it back to the sidebar and make it editable again.' : 'Hides the project and makes it read-only. Tasks and history are kept.'}
          action={<Button variant="outline" icon={archived ? 'refresh' : 'archive'} loading={busy} disabled={!canManage} onClick={() => void toggleArchive()}>{archived ? 'Restore' : 'Archive'}</Button>}
        />
        <DangerRow
          title="Delete project"
          description={`Permanently deletes ${project.name} and all ${taskCount} of its tasks, comments and attachments. This cannot be undone.`}
          action={<Button variant="danger" icon="trash" disabled={!canManage} onClick={() => setDeleteOpen(true)} data-testid="delete-project">Delete project</Button>}
        />
      </SettingsCard>
      <DeleteProjectDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} project={project} onDeleted={() => navigate(`${base}/projects`)} />
    </>
  );
}

function DeleteProjectDialog({ open, onClose, project, onDeleted }: { open: boolean; onClose: () => void; project: Project; onDeleted: () => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);
  const ok = typed.trim().toUpperCase() === project.key;
  const run = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      await projectApi.remove(project.id);
      invalidate(['projects', 'dashboard', 'mytasks']);
      toast.success(`Project ${project.name} deleted`);
      onClose();
      onDeleted();
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
      title={`Delete ${project.name}?`}
      description="Every task, comment, attachment and view in this project will be permanently removed."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={!ok} loading={busy} onClick={() => void run()}>Delete project</Button>
        </>
      }
    >
      <form className="form" onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <Field label={<span>Type the project key <strong className="mono">{project.key}</strong> to confirm</span>} htmlFor="ps-delete-confirm">
          <Input id="ps-delete-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={project.key} className="mono" autoComplete="off" data-autofocus />
        </Field>
      </form>
    </Dialog>
  );
}
