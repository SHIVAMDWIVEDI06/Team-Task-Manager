// Workspace settings: /w/:slug/settings[/:tab] — general | members.
import { useEffect, useState } from 'react';
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { useWorkspace } from '../../app/workspace.tsx';
import { navigate, useParams, useSearchParams } from '../../lib/router.tsx';
import { Avatar } from '../../ui/primitives.tsx';
import { SettingsLayout, type SettingsTab } from './SettingsLayout.tsx';
import { GeneralSettings } from './GeneralSettings.tsx';
import { MembersSettings } from './MembersSettings.tsx';
import { InviteDialog } from './InviteDialog.tsx';

type Tab = 'general' | 'members';
const TABS: SettingsTab<Tab>[] = [
  { value: 'general', label: 'General', icon: 'settings' },
  { value: 'members', label: 'Members', icon: 'users' },
];

export function WorkspaceSettingsPage() {
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const { workspace, base, isAdmin } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [inviteOpen, setInviteOpen] = useState(false);
  const tab: Tab = tabParam === 'members' ? 'members' : 'general';

  useTopbar([{ label: 'Workspace settings' }], null, []);

  // Sidebar links to /settings/members?invite=1 — open the dialog and clean the URL.
  const wantsInvite = params.get('invite') === '1';
  useEffect(() => {
    if (!wantsInvite) return;
    if (isAdmin) setInviteOpen(true);
    setParams({ invite: null }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsInvite, isAdmin]);

  const setTab = (t: Tab) => navigate(t === 'general' ? `${base}/settings` : `${base}/settings/${t}`);

  return (
    <SettingsLayout
      title={
        <span className="row gap-3">
          <Avatar name={workspace.name} src={workspace.logoUrl} size={28} square />
          <span className="truncate">{workspace.name}</span>
        </span>
      }
      description="Manage your workspace, its members and how people join."
      tabs={TABS}
      value={tab}
      onChange={setTab}
      navTitle="Workspace"
    >
      {tab === 'general' ? <GeneralSettings /> : <MembersSettings onInvite={() => setInviteOpen(true)} />}
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </SettingsLayout>
  );
}
