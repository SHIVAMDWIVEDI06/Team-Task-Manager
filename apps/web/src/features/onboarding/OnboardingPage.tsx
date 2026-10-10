import { useState, type FormEvent } from 'react';
import { navigate, useLocation } from '../../lib/router.tsx';
import { useAuth } from '../../app/auth.tsx';
import { useWorkspaces, workspaceApi } from '../../app/data.ts';
import { invalidate } from '../../lib/query.ts';
import { Button, Checkbox, Field, Input } from '../../ui/primitives.tsx';
import { Logo } from '../../ui/Logo.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { toast } from '../../lib/toast.ts';

export function OnboardingPage() {
  const { me, logout } = useAuth();
  const loc = useLocation();
  const forceNew = new URLSearchParams(loc.search).get('new') === '1';
  const workspaces = useWorkspaces();
  const [name, setName] = useState(me ? `${me.name.split(' ')[0]}'s workspace` : '');
  const [sample, setSample] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already has a workspace and didn't ask for a new one → go there.
  if (!forceNew && workspaces.data && workspaces.data.length) {
    navigate(`/w/${workspaces.data[0].slug}`, { replace: true });
    return null;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const ws = await workspaceApi.create(name.trim(), sample);
      invalidate('workspaces');
      toast.success(`Workspace "${ws.name}" created`);
      navigate(`/w/${ws.slug}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="row gap-2 mb-4">
          <Logo size={28} />
          <span className="semibold">TeamTask</span>
        </div>
        <h1 className="mb-2">{forceNew ? 'Create a workspace' : `Welcome, ${me?.name.split(' ')[0]} 👋`}</h1>
        <p className="secondary mb-4">A workspace is where your team's projects live. You can invite teammates right after.</p>
        <form className="form" onSubmit={submit}>
          {error ? <div className="form-error">{error}</div> : null}
          <Field label="Workspace name" htmlFor="ws-name">
            <Input id="ws-name" size="lg" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc" maxLength={80} />
          </Field>
          <Checkbox checked={sample} onChange={setSample} label="Add a sample project so I can explore the features" />
          <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!name.trim()} iconRight="arrow-right">
            Create workspace
          </Button>
        </form>
        <div className="row between mt-6">
          {forceNew && workspaces.data?.length ? (
            <Button variant="ghost" size="sm" icon="arrow-left" onClick={() => navigate(`/w/${workspaces.data![0].slug}`)}>
              Back
            </Button>
          ) : <span />}
          <Button variant="ghost" size="sm" icon="log-out" onClick={() => void logout().then(() => navigate('/login'))}>
            Sign out
          </Button>
        </div>
      </div>
      <div className="onboarding-tips muted small">
        <span className="row gap-2"><Icon name="sparkles" size={14} /> Tip: press <kbd className="kbd">?</kbd> anywhere to see keyboard shortcuts.</span>
      </div>
    </div>
  );
}
