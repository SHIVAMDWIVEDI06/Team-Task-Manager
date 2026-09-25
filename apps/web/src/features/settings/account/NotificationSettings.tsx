// Account → Notifications: per-event switches (optimistic).
import { useState } from 'react';
import type { Me, UserPreferences } from '../../../../../../packages/shared/src/types.ts';
import { useAuth, useMe } from '../../../app/auth.tsx';
import { api } from '../../../lib/api.ts';
import { toast } from '../../../lib/toast.ts';
import { Switch } from '../../../ui/primitives.tsx';
import { SettingsCard, SettingsNotice } from '../SettingsLayout.tsx';

type NotifKey = keyof UserPreferences['notifications'];

const IN_APP: { key: NotifKey; label: string; description: string }[] = [
  { key: 'assigned', label: 'Assigned to me', description: 'When someone assigns you a task.' },
  { key: 'mentioned', label: 'Mentions', description: 'When someone @mentions you in a comment or description.' },
  { key: 'comments', label: 'Comments', description: 'New comments on tasks you created, are assigned to or watch.' },
  { key: 'statusChanges', label: 'Status changes', description: 'When a task you follow moves to a different status.' },
  { key: 'dueSoon', label: 'Due soon', description: 'Reminders for your tasks that are due within 24 hours or overdue.' },
];

export function NotificationSettings() {
  const me = useMe();
  const { setMe } = useAuth();
  const [saving, setSaving] = useState<NotifKey | null>(null);
  const prefs = me.preferences.notifications;

  const toggle = async (key: NotifKey, value: boolean) => {
    const previous = me;
    // optimistic
    setMe({ ...me, preferences: { ...me.preferences, notifications: { ...prefs, [key]: value } } });
    setSaving(key);
    try {
      const updated = await api.patch<Me>('/api/me/preferences', { notifications: { [key]: value } });
      setMe(updated);
    } catch (e) {
      setMe(previous);
      toast.fromError(e);
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <SettingsCard title="Email" description="A daily summary of what needs your attention.">
        <div className="switch-list">
          <Switch checked={prefs.email} onChange={(v) => void toggle('email', v)} disabled={saving === 'email'} label="Email digest" description="Receive assignments, mentions and due-soon reminders by email as well as in the inbox." />
        </div>
        {!prefs.email ? <div style={{ paddingBottom: 14 }}><SettingsNotice>Email notifications are off — you'll still see everything in your inbox.</SettingsNotice></div> : null}
      </SettingsCard>
      <SettingsCard title="Inbox notifications" description="Choose which events land in your inbox.">
        <div className="switch-list" data-testid="notif-switches">
          {IN_APP.map((n) => (
            <div key={n.key} data-testid={`notif-${n.key}`}>
              <Switch checked={prefs[n.key]} onChange={(v) => void toggle(n.key, v)} disabled={saving === n.key} label={n.label} description={n.description} />
            </div>
          ))}
        </div>
      </SettingsCard>
    </>
  );
}
