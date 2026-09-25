// Account → Preferences: theme, density, start of week. Applied instantly, then persisted.
import { useState } from 'react';
import type { Me, Theme, UserPreferences } from '../../../../../../packages/shared/src/types.ts';
import { useAuth, useMe } from '../../../app/auth.tsx';
import { api } from '../../../lib/api.ts';
import { setDensity, setTheme, uiStore } from '../../../lib/store.ts';
import { toast } from '../../../lib/toast.ts';
import { Icon } from '../../../ui/Icon.tsx';
import { Segmented, cx } from '../../../ui/primitives.tsx';
import { FormRow, SettingsCard } from '../SettingsLayout.tsx';

type PrefPatch = Partial<Pick<UserPreferences, 'theme' | 'density' | 'startOfWeek'>>;

export function usePreferenceMutation() {
  const { setMe } = useAuth();
  const [pending, setPending] = useState<string | null>(null);
  const mutate = async (patch: PrefPatch | { notifications: Partial<UserPreferences['notifications']> }, label: string, rollback?: () => void) => {
    setPending(label);
    try {
      const updated = await api.patch<Me>('/api/me/preferences', patch);
      setMe(updated);
      return updated;
    } catch (e) {
      rollback?.();
      toast.fromError(e);
      return null;
    } finally {
      setPending(null);
    }
  };
  return { mutate, pending };
}

const THEMES: { value: Theme; label: string; icon: string; hint: string }[] = [
  { value: 'system', label: 'System', icon: 'monitor', hint: 'Follows your OS setting' },
  { value: 'light', label: 'Light', icon: 'sun', hint: 'Always light' },
  { value: 'dark', label: 'Dark', icon: 'moon', hint: 'Always dark' },
];

export function PreferencesSettings() {
  const me = useMe();
  const { mutate } = usePreferenceMutation();
  const theme = uiStore.use((s) => s.theme);
  const density = uiStore.use((s) => s.density);
  const startOfWeek = me.preferences.startOfWeek;

  const changeTheme = (t: Theme) => {
    if (t === theme) return;
    const prev = theme;
    setTheme(t);
    void mutate({ theme: t }, 'theme', () => setTheme(prev)).then((r) => r && toast.success(`Theme set to ${t}`));
  };
  const changeDensity = (d: UserPreferences['density']) => {
    if (d === density) return;
    const prev = density;
    setDensity(d);
    void mutate({ density: d }, 'density', () => setDensity(prev)).then((r) => r && toast.success(`Density set to ${d}`));
  };
  const changeStart = (s: '0' | '1') => {
    const v = Number(s) as 0 | 1;
    if (v === startOfWeek) return;
    void mutate({ startOfWeek: v }, 'startOfWeek').then((r) => r && toast.success(`Weeks now start on ${v === 1 ? 'Monday' : 'Sunday'}`));
  };

  return (
    <SettingsCard title="Appearance" description="Changes apply immediately and sync to all your devices.">
      <FormRow label="Theme" hint="Choose how TeamTask looks.">
        <div className="pref-option-grid" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button key={t.value} type="button" role="radio" aria-checked={theme === t.value} className={cx('pref-option', theme === t.value && 'is-active')} onClick={() => changeTheme(t.value)} data-testid={`theme-${t.value}`}>
              <span className={cx('pref-option-preview', `is-${t.value}`)} aria-hidden />
              <span className="pref-option-label">
                <Icon name={t.icon} size={14} className="muted" />
                {t.label}
                {theme === t.value ? <Icon name="check" size={14} style={{ marginLeft: 'auto', color: 'var(--brand)' }} /> : null}
              </span>
              <span className="xs muted">{t.hint}</span>
            </button>
          ))}
        </div>
      </FormRow>
      <FormRow label="Density" hint="Compact shows more rows on screen." center>
        <Segmented value={density} onChange={changeDensity} options={[{ value: 'comfortable', label: 'Comfortable', icon: 'layout' }, { value: 'compact', label: 'Compact', icon: 'list' }]} />
      </FormRow>
      <FormRow label="Start of week" hint="Affects calendars and date pickers." center>
        <Segmented value={String(startOfWeek) as '0' | '1'} onChange={changeStart} options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]} />
      </FormRow>
    </SettingsCard>
  );
}
