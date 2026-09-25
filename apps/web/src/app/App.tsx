import { useEffect, useMemo, type ReactNode } from 'react';
import { Navigate, Routes, useLocation, type RouteDef } from '../lib/router.tsx';
import { AuthProvider, useAuth } from './auth.tsx';
import { ConfirmProvider, Toaster } from '../ui/overlays.tsx';
import { WorkspaceProvider } from './workspace.tsx';
import { AppShell } from './shell/AppShell.tsx';
import { TopbarProvider } from './shell/Topbar.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage, InvitePage } from '../features/auth/AuthPages.tsx';
import { OnboardingPage } from '../features/onboarding/OnboardingPage.tsx';
import { HomePage } from '../features/dashboard/HomePage.tsx';
import { MyWorkPage } from '../features/my-work/MyWorkPage.tsx';
import { InboxPage } from '../features/inbox/InboxPage.tsx';
import { ProjectsPage } from '../features/projects/ProjectsPage.tsx';
import { ProjectPage } from '../features/projects/ProjectPage.tsx';
import { ProjectSettingsPage } from '../features/projects/ProjectSettingsPage.tsx';
import { TeamPage } from '../features/team/TeamPage.tsx';
import { ActivityPage } from '../features/activity/ActivityPage.tsx';
import { WorkspaceSettingsPage } from '../features/settings/WorkspaceSettingsPage.tsx';
import { AccountSettingsPage } from '../features/settings/AccountSettingsPage.tsx';
import { useWorkspaces } from './data.ts';
import { uiStore } from '../lib/store.ts';
import { Spinner, Button, EmptyState } from '../ui/primitives.tsx';
import { Logo } from '../ui/Logo.tsx';

function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="fullpage-loader" role="status" aria-live="polite">
      <Logo size={36} />
      <div className="row gap-2 muted">
        <Spinner size={14} /> {label}
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullPageLoader label="Signing you in…" />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullPageLoader />;
  if (me) {
    const next = new URLSearchParams(loc.search).get('next');
    return <Navigate to={next || '/'} />;
  }
  return <>{children}</>;
}

/** "/" → last used workspace, first workspace, or onboarding. */
function RootRedirect() {
  const ws = useWorkspaces();
  const last = uiStore.use((s) => s.lastWorkspace);
  if (!ws.data) return ws.error ? <Navigate to="/onboarding" /> : <FullPageLoader />;
  if (!ws.data.length) return <Navigate to="/onboarding" />;
  const target = ws.data.find((w) => w.slug === last) ?? ws.data[0];
  return <Navigate to={`/w/${target.slug}`} />;
}

function WorkspaceNotFound() {
  return (
    <div className="fullpage-loader">
      <EmptyState icon="alert-circle" title="Workspace not found" description="It may have been deleted, or you don't have access." action={<Button variant="primary" onClick={() => (window.location.href = '/')}>Go home</Button>} />
    </div>
  );
}

function WorkspaceLayout() {
  return (
    <RequireAuth>
      <WorkspaceProvider loading={<FullPageLoader label="Opening workspace…" />} notFound={<WorkspaceNotFound />}>
        <TopbarProvider>
          <AppShell />
        </TopbarProvider>
      </WorkspaceProvider>
    </RequireAuth>
  );
}

function Page({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function NotFound() {
  return (
    <div className="page">
      <EmptyState icon="help-circle" title="Page not found" description="The page you're looking for doesn't exist." action={<Button variant="primary" onClick={() => (window.location.href = '/')}>Go home</Button>} />
    </div>
  );
}

export function App() {
  const routes = useMemo<RouteDef[]>(
    () => [
      { path: '/login', element: <RedirectIfAuthed><LoginPage /></RedirectIfAuthed> },
      { path: '/signup', element: <RedirectIfAuthed><SignupPage /></RedirectIfAuthed> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/invite/:token', element: <InvitePage /> },
      { path: '/onboarding', element: <RequireAuth><OnboardingPage /></RequireAuth> },
      { path: '/', element: <RequireAuth><RootRedirect /></RequireAuth> },
      {
        path: '/w/:slug',
        element: <WorkspaceLayout />,
        children: [
          { path: '', element: <Page><HomePage /></Page> },
          { path: '/my-work', element: <Page><MyWorkPage /></Page> },
          { path: '/inbox', element: <Page><InboxPage /></Page> },
          { path: '/projects', element: <Page><ProjectsPage /></Page> },
          { path: '/p/:key', element: <Page><ProjectPage /></Page> },
          { path: '/p/:key/settings', element: <Page><ProjectSettingsPage /></Page> },
          { path: '/p/:key/settings/:tab', element: <Page><ProjectSettingsPage /></Page> },
          { path: '/team', element: <Page><TeamPage /></Page> },
          { path: '/activity', element: <Page><ActivityPage /></Page> },
          { path: '/settings', element: <Page><WorkspaceSettingsPage /></Page> },
          { path: '/settings/:tab', element: <Page><WorkspaceSettingsPage /></Page> },
          { path: '/account', element: <Page><AccountSettingsPage /></Page> },
          { path: '/account/:tab', element: <Page><AccountSettingsPage /></Page> },
          { path: '/*', element: <NotFound /> },
        ],
      },
    ],
    [],
  );
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConfirmProvider>
          <Routes routes={routes} fallback={<NotFound />} />
          <Toaster />
        </ConfirmProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · TeamTask` : 'TeamTask';
  }, [title]);
}
