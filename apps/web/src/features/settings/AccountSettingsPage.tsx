// Account settings: /w/:slug/account[/:tab] — profile | preferences | notifications | security.
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { useMe } from '../../app/auth.tsx';
import { useWorkspace } from '../../app/workspace.tsx';
import { navigate, useParams } from '../../lib/router.tsx';
import { Avatar } from '../../ui/primitives.tsx';
import { SettingsLayout, type SettingsTab } from './SettingsLayout.tsx';
import { ProfileSettings } from './account/ProfileSettings.tsx';
import { PreferencesSettings } from './account/PreferencesSettings.tsx';
import { NotificationSettings } from './account/NotificationSettings.tsx';
import { SecuritySettings } from './account/SecuritySettings.tsx';

type Tab = 'profile' | 'preferences' | 'notifications' | 'security';
const TABS: SettingsTab<Tab>[] = [
  { value: 'profile', label: 'Profile', icon: 'user' },
  { value: 'preferences', label: 'Preferences', icon: 'sliders' },
  { value: 'notifications', label: 'Notifications', icon: 'bell' },
  { value: 'security', label: 'Security', icon: 'shield' },
];
const isTab = (t: string | undefined): t is Tab => TABS.some((x) => x.value === t);

export function AccountSettingsPage() {
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const { base } = useWorkspace();
  const me = useMe();
  const tab: Tab = isTab(tabParam) ? tabParam : 'profile';

  useTopbar([{ label: 'Account settings' }], null, []);

  const setTab = (t: Tab) => navigate(t === 'profile' ? `${base}/account` : `${base}/account/${t}`);

  return (
    <SettingsLayout
      title={
        <span className="row gap-3">
          <Avatar name={me.name} src={me.avatarUrl} size={28} />
          <span className="truncate">{me.name}</span>
        </span>
      }
      description="Your profile, preferences and security across every workspace."
      tabs={TABS}
      value={tab}
      onChange={setTab}
      navTitle="Account"
    >
      {tab === 'profile' ? <ProfileSettings /> : tab === 'preferences' ? <PreferencesSettings /> : tab === 'notifications' ? <NotificationSettings /> : <SecuritySettings />}
    </SettingsLayout>
  );
}
