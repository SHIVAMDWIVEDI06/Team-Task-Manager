// Account → Profile: avatar, name, email, timezone.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Me } from '../../../../../../packages/shared/src/types.ts';
import { useAuth, useMe } from '../../../app/auth.tsx';
import { api, RequestError } from '../../../lib/api.ts';
import { invalidate } from '../../../lib/query.ts';
import { toast } from '../../../lib/toast.ts';
import { Select, type PickerItem } from '../../../ui/pickers.tsx';
import { Avatar, Button, Input } from '../../../ui/primitives.tsx';
import { FormRow, SettingsCard } from '../SettingsLayout.tsx';
import { localTimeIn } from '../roles.tsx';

const FALLBACK_ZONES = [
  'UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Stockholm', 'Europe/Warsaw', 'Europe/Istanbul', 'Europe/Moscow',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Sao_Paulo', 'America/Buenos_Aires', 'America/Santiago',
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Taipei', 'Asia/Seoul', 'Asia/Tokyo', 'Asia/Manila', 'Asia/Tehran', 'Asia/Jerusalem', 'Asia/Riyadh',
  'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi', 'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth', 'Australia/Brisbane', 'Pacific/Auckland', 'Pacific/Honolulu',
];

function timezoneList(current: string): string[] {
  let zones: string[] = FALLBACK_ZONES;
  try {
    const sv = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (sv) zones = sv.call(Intl, 'timeZone');
  } catch {
    /* fall back */
  }
  if (current && !zones.includes(current)) zones = [current, ...zones];
  return zones;
}

export function ProfileSettings() {
  const me = useMe();
  const { setMe } = useAuth();
  const [name, setName] = useState(me.name);
  const [timezone, setTimezone] = useState(me.timezone);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setName(me.name);
    setTimezone(me.timezone);
  }, [me.name, me.timezone]);

  const zones = useMemo(() => timezoneList(me.timezone), [me.timezone]);
  const zoneItems: PickerItem<string>[] = useMemo(() => zones.map((z) => ({ value: z, label: z.replace(/_/g, ' '), keywords: z.replace(/[/_]/g, ' ') })), [zones]);
  const dirty = name.trim() !== me.name || timezone !== me.timezone;

  const save = async () => {
    if (!dirty || !name.trim()) return;
    setBusy(true);
    setErrors({});
    try {
      const patch: { name?: string; timezone?: string } = {};
      if (name.trim() !== me.name) patch.name = name.trim();
      if (timezone !== me.timezone) patch.timezone = timezone;
      const updated = await api.patch<Me>('/api/me', patch);
      setMe(updated);
      invalidate(['members', 'bundle']);
      toast.success('Profile updated');
    } catch (e) {
      if (e instanceof RequestError) {
        const fe = e.fieldErrors;
        setErrors(Object.keys(fe).length ? fe : { _: e.message });
      } else setErrors({ _: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) {
      toast.error('Choose a PNG, JPEG, GIF or WebP image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Images must be smaller than 5 MB');
      return;
    }
    setUploading(true);
    try {
      const updated = await api.upload<Me>('/api/me/avatar', [file]);
      setMe(updated);
      invalidate(['members', 'bundle']);
      toast.success('Photo updated');
    } catch (e) {
      toast.fromError(e);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeAvatar = async () => {
    setUploading(true);
    try {
      const updated = await api.patch<Me>('/api/me', { avatarUrl: null });
      setMe(updated);
      invalidate(['members', 'bundle']);
      toast.success('Photo removed');
    } catch (e) {
      toast.fromError(e);
    } finally {
      setUploading(false);
    }
  };

  const localNow = localTimeIn(timezone);

  return (
    <SettingsCard
      title="Profile"
      description="How you appear to your teammates."
      footer={
        <>
          {errors._ ? <span className="foot-note" style={{ color: 'var(--danger)' }}>{errors._}</span> : dirty ? <span className="foot-note">Unsaved changes</span> : null}
          <Button variant="ghost" disabled={!dirty || busy} onClick={() => { setName(me.name); setTimezone(me.timezone); setErrors({}); }}>Reset</Button>
          <Button variant="primary" disabled={!dirty || !name.trim()} loading={busy} onClick={() => void save()} data-testid="profile-save">Save changes</Button>
        </>
      }
    >
      <FormRow label="Photo" hint="PNG, JPEG, GIF or WebP up to 5 MB.">
        <div className="avatar-upload">
          <Avatar name={me.name} src={me.avatarUrl} size={64} />
          <div className="avatar-upload-actions">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} aria-label="Upload photo" data-testid="avatar-input" />
            <Button size="sm" variant="secondary" icon="upload" loading={uploading} onClick={() => fileRef.current?.click()}>Upload photo</Button>
            {me.avatarUrl ? <Button size="sm" variant="ghost" disabled={uploading} onClick={() => void removeAvatar()}>Remove</Button> : null}
          </div>
        </div>
      </FormRow>
      <FormRow label="Full name" htmlFor="me-name" error={errors.name}>
        <Input id="me-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} error={Boolean(errors.name)} placeholder="Your name" data-testid="profile-name" />
      </FormRow>
      <FormRow label="Email" hint="Used to sign in and for notifications. Contact support to change it.">
        <span className="readonly-value">{me.email}</span>
      </FormRow>
      <FormRow label="Timezone" hint={localNow ? `It's ${localNow} in this timezone right now.` : 'Used for due dates, reminders and the calendar.'} error={errors.timezone}>
        <Select value={timezone} onChange={setTimezone} items={zoneItems} searchable width={320} placeholder="Choose a timezone" icon="globe" />
      </FormRow>
    </SettingsCard>
  );
}
