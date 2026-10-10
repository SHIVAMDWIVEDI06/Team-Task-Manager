// Account → Security: change password, active sessions, sign out everywhere, delete account.
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../../app/auth.tsx';
import { api, request, RequestError } from '../../../lib/api.ts';
import { useQuery } from '../../../lib/query.ts';
import { navigate } from '../../../lib/router.tsx';
import { relativeTime } from '../../../lib/format.ts';
import { toast } from '../../../lib/toast.ts';
import { Icon } from '../../../ui/Icon.tsx';
import { Dialog, useConfirm } from '../../../ui/overlays.tsx';
import { Badge, Button, EmptyState, Field, Input, Skeleton } from '../../../ui/primitives.tsx';
import { LIMITS } from '../../../../../../packages/shared/src/constants.ts';
import { DangerRow, FormRow, SettingsCard } from '../SettingsLayout.tsx';

interface Session {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  current: boolean;
}

/** "Chrome on Linux" style label from a user-agent string. */
export function describeUserAgent(ua: string | null | undefined): { label: string; icon: string } {
  if (!ua) return { label: 'Unknown device', icon: 'monitor' };
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /HeadlessChrome/.test(ua) ? 'Headless Chrome' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) && /Version\//.test(ua) ? 'Safari' : /curl\//.test(ua) ? 'curl' : /node|undici/i.test(ua) ? 'Node.js' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : null;
  const mobile = /Mobile|iPhone|Android/.test(ua);
  return { label: os ? `${browser} on ${os}` : browser, icon: mobile ? 'smile' : 'monitor' };
}

export function SecuritySettings() {
  const { logout } = useAuth();
  const confirm = useConfirm();
  const sessions = useQuery<Session[]>('auth:sessions', () => api.get('/api/auth/sessions'), { staleTime: 0 });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const revoke = async (s: Session) => {
    try {
      await api.del(`/api/auth/sessions/${s.id}`);
      toast.success('Session signed out');
      if (s.current) {
        await logout();
        navigate('/login');
        return;
      }
      void sessions.refetch();
    } catch (e) {
      toast.fromError(e);
    }
  };

  const signOutAll = async () => {
    if (!(await confirm({ title: 'Sign out of all devices?', description: 'Every session, including this one, will be signed out. You will need to sign in again.', danger: true, confirmLabel: 'Sign out everywhere' }))) return;
    try {
      await api.post('/api/auth/logout-all');
    } catch {
      /* the local logout below handles it either way */
    }
    await logout();
    navigate('/login');
  };

  const list = sessions.data ?? [];

  return (
    <>
      <ChangePasswordCard />
      <SettingsCard
        title="Active sessions"
        description="Devices that are currently signed in to your account."
        actions={<Button size="sm" variant="outline" icon="log-out" onClick={() => void signOutAll()}>Sign out of all devices</Button>}
      >
        {sessions.isLoading ? (
          <div className="col gap-3" style={{ padding: '14px 0' }}>
            <Skeleton height={34} />
            <Skeleton height={34} />
          </div>
        ) : sessions.error ? (
          <EmptyState compact icon="alert-circle" title="Couldn't load sessions" description={sessions.error.message} action={<Button size="sm" onClick={() => void sessions.refetch()}>Retry</Button>} />
        ) : !list.length ? (
          <EmptyState compact icon="shield" title="No active sessions" />
        ) : (
          <div data-testid="sessions">
            {list.map((s) => {
              const d = describeUserAgent(s.userAgent);
              return (
                <div key={s.id} className="session-row" data-testid="session-row">
                  <span className="session-icon"><Icon name={d.icon} size={16} /></span>
                  <div className="session-main">
                    <div className="session-title">
                      <span className="truncate">{d.label}</span>
                      {s.current ? <Badge tone="success" size="sm" dot>This device</Badge> : null}
                    </div>
                    <div className="session-meta truncate" title={s.userAgent ?? undefined}>
                      {s.ip ? `${s.ip} · ` : ''}
                      {s.lastUsedAt ? `Last active ${relativeTime(s.lastUsedAt)}` : `Signed in ${relativeTime(s.createdAt)}`}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void revoke(s)}>{s.current ? 'Sign out' : 'Revoke'}</Button>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>
      <SettingsCard title="Danger zone" danger>
        <DangerRow title="Delete account" description="Permanently deletes your account and every workspace you own. Workspaces where you are the only owner must be transferred first." action={<Button variant="danger" icon="trash" onClick={() => setDeleteOpen(true)}>Delete account</Button>} />
      </SettingsCard>
      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mismatch = confirmPw.length > 0 && next !== confirmPw;
  const tooShort = next.length > 0 && next.length < LIMITS.passwordMin;
  const canSubmit = current.length > 0 && next.length >= LIMITS.passwordMin && next === confirmPw && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErrors({});
    try {
      await api.post('/api/auth/change-password', { currentPassword: current, newPassword: next });
      toast.success('Password changed');
      setCurrent('');
      setNext('');
      setConfirmPw('');
    } catch (err) {
      if (err instanceof RequestError) {
        const fe = err.fieldErrors;
        setErrors(Object.keys(fe).length ? fe : { currentPassword: err.message });
      } else setErrors({ _: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <SettingsCard
        title="Password"
        description={`Use at least ${LIMITS.passwordMin} characters. Changing it keeps you signed in on this device.`}
        footer={
          <>
            {errors._ ? <span className="foot-note" style={{ color: 'var(--danger)' }}>{errors._}</span> : null}
            <Button type="submit" variant="primary" disabled={!canSubmit} loading={busy}>Update password</Button>
          </>
        }
      >
        <FormRow label="Current password" htmlFor="pw-current" error={errors.currentPassword}>
          <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={Boolean(errors.currentPassword)} />
        </FormRow>
        <FormRow label="New password" htmlFor="pw-new" error={errors.newPassword || (tooShort ? `At least ${LIMITS.passwordMin} characters` : undefined)}>
          <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={Boolean(errors.newPassword) || tooShort} />
        </FormRow>
        <FormRow label="Confirm new password" htmlFor="pw-confirm" error={mismatch ? "Passwords don't match" : undefined}>
          <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} error={mismatch} />
        </FormRow>
      </SettingsCard>
    </form>
  );
}

function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logout } = useAuth();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setTyped('');
      setError(null);
    }
  }, [open]);
  const ok = typed.trim() === 'DELETE';
  const run = async () => {
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await request('/api/me', { method: 'DELETE', body: { confirm: 'DELETE' } });
      toast.success('Your account has been deleted');
      onClose();
      await logout();
      navigate('/login');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Delete your account"
      description="This permanently removes your account, your data and every workspace you own. There is no undo."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={!ok} loading={busy} onClick={() => void run()}>Delete my account</Button>
        </>
      }
    >
      <form className="form" onSubmit={(e) => { e.preventDefault(); void run(); }}>
        {error ? <div className="form-error">{error}</div> : null}
        <Field label={<span>Type <strong>DELETE</strong> to confirm</span>} htmlFor="me-delete-confirm">
          <Input id="me-delete-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" autoComplete="off" data-autofocus />
        </Field>
      </form>
    </Dialog>
  );
}
