import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, navigate, useLocation, useParams } from '../../lib/router.tsx';
import { useAuth } from '../../app/auth.tsx';
import { api, RequestError } from '../../lib/api.ts';
import { Button, Field, Input, cx } from '../../ui/primitives.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { toast } from '../../lib/toast.ts';
import { useQuery } from '../../lib/query.ts';
import type { WorkspaceRole } from '../../../../../packages/shared/src/types.ts';
import { Logo } from '../../ui/Logo.tsx';

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="auth-brand">
          <Logo size={30} />
          <span>TeamTask</span>
        </div>
        <div className="auth-hero">
          <h1>Plan, track and ship work — together.</h1>
          <p>Boards, lists, calendars and timelines that stay in sync for everyone on your team, in real time.</p>
          <ul className="auth-points">
            <li><Icon name="board" size={16} /> Drag-and-drop boards with custom workflows</li>
            <li><Icon name="zap" size={16} /> Live updates, presence and @mentions</li>
            <li><Icon name="layers" size={16} /> Subtasks, checklists, relations and time tracking</li>
            <li><Icon name="shield" size={16} /> Roles, private projects and a full audit log</li>
          </ul>
        </div>
        <div className="auth-side-foot muted small">© {new Date().getFullYear()} TeamTask</div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <Logo size={28} />
            <span>TeamTask</span>
          </div>
          <h2 className="auth-title">{title}</h2>
          {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
          {children}
          {footer ? <div className="auth-footer">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

function useFieldErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const capture = (e: unknown) => {
    if (e instanceof RequestError) {
      const fe = e.fieldErrors;
      setErrors(Object.keys(fe).length ? fe : { _: e.message });
    } else setErrors({ _: (e as Error).message || 'Something went wrong' });
  };
  return { errors, setErrors, capture };
}

export function LoginPage() {
  const { login } = useAuth();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { errors, setErrors, capture } = useFieldErrors();
  const next = new URLSearchParams(loc.search).get('next');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await login(email, password);
      navigate(next || '/', { replace: true });
    } catch (err) {
      capture(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your workspace." footer={<>New to TeamTask? <Link to={`/signup${loc.search}`} className="auth-link">Create an account</Link></>}>
      <form className="form" onSubmit={submit} noValidate>
        {errors._ ? <div className="form-error">{errors._}</div> : null}
        <Field label="Email" error={errors.email} htmlFor="email">
          <Input id="email" type="email" size="lg" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" error={Boolean(errors.email)} />
        </Field>
        <Field label={<span className="row between w-full">Password <Link to="/forgot-password" className="auth-link small" tabIndex={-1}>Forgot password?</Link></span>} error={errors.password} htmlFor="password">
          <Input id="password" type="password" size="lg" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" error={Boolean(errors.password)} />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}

export function SignupPage() {
  const { signup } = useAuth();
  const loc = useLocation();
  const params = new URLSearchParams(loc.search);
  const inviteToken = params.get('invite') || undefined;
  const [name, setName] = useState('');
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { errors, setErrors, capture } = useFieldErrors();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const r = await signup({ name, email, password, inviteToken });
      navigate(r.joinedWorkspaceSlug ? `/w/${r.joinedWorkspaceSlug}` : '/onboarding', { replace: true });
    } catch (err) {
      capture(err);
    } finally {
      setBusy(false);
    }
  };
  const strength = password.length === 0 ? 0 : password.length < 8 ? 1 : /[A-Z]/.test(password) && /[0-9]/.test(password) && password.length >= 12 ? 3 : 2;
  return (
    <AuthLayout title="Create your account" subtitle={inviteToken ? "You've been invited — create an account to join the workspace." : 'Free for your whole team. No credit card needed.'} footer={<>Already have an account? <Link to={`/login${loc.search}`} className="auth-link">Sign in</Link></>}>
      <form className="form" onSubmit={submit} noValidate>
        {errors._ ? <div className="form-error">{errors._}</div> : null}
        <Field label="Full name" error={errors.name} htmlFor="name">
          <Input id="name" size="lg" autoComplete="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" error={Boolean(errors.name)} />
        </Field>
        <Field label="Work email" error={errors.email} htmlFor="email">
          <Input id="email" type="email" size="lg" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" error={Boolean(errors.email)} disabled={Boolean(inviteToken && params.get('email'))} />
        </Field>
        <Field label="Password" error={errors.password} hint={!errors.password ? 'At least 8 characters.' : undefined} htmlFor="password">
          <Input id="password" type="password" size="lg" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a strong password" error={Boolean(errors.password)} />
          <div className="pw-meter" aria-hidden>
            {[1, 2, 3].map((i) => (
              <span key={i} className={cx('pw-bar', strength >= i && `is-${strength}`)} />
            ))}
          </div>
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          Create account
        </Button>
        <p className="xs muted" style={{ textAlign: 'center' }}>By continuing you agree to our terms of service and privacy policy.</p>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ devLink: string | null } | null>(null);
  const { errors, setErrors, capture } = useFieldErrors();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const r = await api.post<{ ok: boolean; devLink: string | null }>('/api/auth/forgot-password', { email });
      setSent(r);
    } catch (err) {
      capture(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to choose a new password." footer={<Link to="/login" className="auth-link"><Icon name="arrow-left" size={14} /> Back to sign in</Link>}>
      {sent ? (
        <div className="auth-success">
          <Icon name="mail" size={22} />
          <p>If an account exists for <strong>{email}</strong>, a reset link is on its way.</p>
          {sent.devLink ? (
            <p className="small muted">
              Email isn't configured on this server, so here is your link: <a className="auth-link" href={sent.devLink}>Reset password</a>
            </p>
          ) : null}
        </div>
      ) : (
        <form className="form" onSubmit={submit} noValidate>
          {errors._ ? <div className="form-error">{errors._}</div> : null}
          <Field label="Email" error={errors.email} htmlFor="email">
            <Input id="email" type="email" size="lg" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </Field>
          <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const loc = useLocation();
  const token = new URLSearchParams(loc.search).get('token') || '';
  const { setMe } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const { errors, setErrors, capture } = useFieldErrors();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setErrors({ confirm: 'Passwords do not match' });
    setBusy(true);
    setErrors({});
    try {
      const r = await api.post<{ accessToken: string; user: Parameters<typeof setMe>[0] }>('/api/auth/reset-password', { token, password });
      const { tokenStore, sessionFlag } = await import('../../lib/api.ts');
      sessionFlag.set(true);
      tokenStore.set(r.accessToken);
      setMe(r.user);
      toast.success('Password updated');
      navigate('/', { replace: true });
    } catch (err) {
      capture(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout title="Choose a new password" footer={<Link to="/login" className="auth-link">Back to sign in</Link>}>
      <form className="form" onSubmit={submit} noValidate>
        {errors._ ? <div className="form-error">{errors._}</div> : null}
        <Field label="New password" error={errors.password} htmlFor="password">
          <Input id="password" type="password" size="lg" autoFocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password" error={errors.confirm} htmlFor="confirm">
          <Input id="confirm" type="password" size="lg" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}

interface InvitePreview {
  workspaceName: string;
  inviterName: string;
  email: string;
  role: WorkspaceRole;
  status: 'pending' | 'expired' | 'accepted' | 'revoked';
  hasAccount: boolean;
}

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { me, loading } = useAuth();
  const preview = useQuery<InvitePreview>(`invite:${token}`, () => api.get(`/api/invites/${token}`));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ slug: string; name: string }>(`/api/invites/${token}/accept`);
      toast.success(`Welcome to ${r.name}!`);
      navigate(`/w/${r.slug}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // signed-in users with the right email: accept automatically
    if (me && preview.data?.status === 'pending' && me.email.toLowerCase() === preview.data.email.toLowerCase()) void accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, preview.data?.status]);

  const p = preview.data;
  return (
    <AuthLayout title={p ? `Join ${p.workspaceName}` : 'Workspace invitation'} subtitle={p ? `${p.inviterName} invited you to collaborate as a ${p.role}.` : undefined}>
      {preview.error ? (
        <div className="form-error">This invitation link is invalid.</div>
      ) : !p || loading ? (
        <p className="muted">Loading invitation…</p>
      ) : p.status !== 'pending' ? (
        <div className="form-error">This invitation has {p.status === 'accepted' ? 'already been accepted' : p.status === 'revoked' ? 'been revoked' : 'expired'}. Ask {p.inviterName} for a new one.</div>
      ) : me ? (
        me.email.toLowerCase() === p.email.toLowerCase() ? (
          <div className="col gap-3">
            {error ? <div className="form-error">{error}</div> : null}
            <Button variant="primary" size="lg" loading={busy} onClick={accept}>
              Accept invitation
            </Button>
          </div>
        ) : (
          <div className="col gap-3">
            <div className="form-error">This invite was sent to <strong>{p.email}</strong>, but you're signed in as {me.email}.</div>
            <Button variant="secondary" size="lg" onClick={() => navigate(`/login?next=/invite/${token}`)}>
              Sign in with a different account
            </Button>
          </div>
        )
      ) : (
        <div className="col gap-3">
          <p className="secondary">The invite is for <strong>{p.email}</strong>.</p>
          {p.hasAccount ? (
            <Button variant="primary" size="lg" onClick={() => navigate(`/login?next=/invite/${token}`)}>
              Sign in to accept
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={() => navigate(`/signup?invite=${token}&email=${encodeURIComponent(p.email)}`)}>
              Create account & join
            </Button>
          )}
          {p.hasAccount ? <Link to={`/signup?invite=${token}&email=${encodeURIComponent(p.email)}`} className="auth-link">Create a new account instead</Link> : <Link to={`/login?next=/invite/${token}`} className="auth-link">I already have an account</Link>}
        </div>
      )}
    </AuthLayout>
  );
}
