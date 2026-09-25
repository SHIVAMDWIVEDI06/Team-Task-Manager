// Project settings → General.
import { useEffect, useState } from 'react';
import type { Project, ProjectBundle } from '../../../../../../packages/shared/src/types.ts';
import { PROJECT_COLORS, PROJECT_ICONS } from '../../../../../../packages/shared/src/constants.ts';
import { keys, projectApi } from '../../../app/data.ts';
import { useMe } from '../../../app/auth.tsx';
import { useWorkspace } from '../../../app/workspace.tsx';
import { RequestError } from '../../../lib/api.ts';
import { invalidate, setQueryData } from '../../../lib/query.ts';
import { navigate } from '../../../lib/router.tsx';
import { toast } from '../../../lib/toast.ts';
import { ColorPicker, DatePicker, Select } from '../../../ui/pickers.tsx';
import { Button, Input, Segmented, Textarea, cx } from '../../../ui/primitives.tsx';
import { FormRow, SettingsCard, SettingsNotice } from '../../settings/SettingsLayout.tsx';
import { memberItems } from '../../tasks/fields.tsx';

interface Form {
  name: string;
  key: string;
  description: string;
  icon: string;
  color: string;
  leadId: string | null;
  startDate: string | null;
  targetDate: string | null;
  visibility: 'public' | 'private';
}

const fromProject = (p: Project): Form => ({ name: p.name, key: p.key, description: p.description ?? '', icon: p.icon, color: p.color, leadId: p.leadId, startDate: p.startDate, targetDate: p.targetDate, visibility: p.visibility });

export function GeneralTab({ project, canManage }: { project: Project; canManage: boolean }) {
  const { base, members } = useWorkspace();
  const me = useMe();
  const [form, setForm] = useState<Form>(() => fromProject(project));
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setForm(fromProject(project));
    setErrors({});
  }, [project.id, project.updatedAt]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const initial = fromProject(project);
  const diff: Partial<Form> = {};
  for (const k of Object.keys(form) as (keyof Form)[]) {
    const a = k === 'name' || k === 'key' || k === 'description' ? String(form[k]).trim() : form[k];
    if (a !== initial[k]) (diff as Record<string, unknown>)[k] = a;
  }
  const dirty = Object.keys(diff).length > 0;
  const keyValid = /^[A-Z][A-Z0-9]{1,5}$/.test(form.key.trim());
  const keyChanged = form.key.trim() !== project.key;
  const dateError = form.startDate && form.targetDate && form.startDate > form.targetDate ? 'Start date must be before the target date' : undefined;

  const save = async () => {
    if (!dirty || !form.name.trim() || !keyValid || dateError) return;
    setBusy(true);
    setErrors({});
    try {
      const updated = await projectApi.update(project.id, diff);
      setQueryData<ProjectBundle>(keys.bundle(project.id), (prev) => (prev ? { ...prev, project: { ...prev.project, ...updated } } : prev));
      invalidate(['projects', keys.bundle(project.id), 'dashboard']);
      if (keyChanged) invalidate(['tasks', 'mytasks']);
      toast.success('Project updated');
      if (updated.key !== project.key) navigate(`${base}/p/${updated.key}/settings`, { replace: true });
    } catch (e) {
      if (e instanceof RequestError) {
        const fe = e.fieldErrors;
        setErrors(Object.keys(fe).length ? fe : { _: e.message });
      } else setErrors({ _: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const ro = !canManage;

  return (
    <SettingsCard
      title="General"
      description="Name, identity and schedule for this project."
      footer={
        canManage ? (
          <>
            {errors._ ? <span className="foot-note" style={{ color: 'var(--danger)' }}>{errors._}</span> : dirty ? <span className="foot-note">Unsaved changes</span> : null}
            <Button variant="ghost" disabled={!dirty || busy} onClick={() => { setForm(fromProject(project)); setErrors({}); }}>Reset</Button>
            <Button variant="primary" disabled={!dirty || !form.name.trim() || !keyValid || Boolean(dateError)} loading={busy} onClick={() => void save()} data-testid="project-save">Save changes</Button>
          </>
        ) : null
      }
    >
      <FormRow label="Icon & color" hint="Shown in the sidebar and on task cards.">
        <div className="ps-icon-row">
          <span className="project-icon ps-icon-preview" style={{ background: form.color }} aria-hidden>{form.icon}</span>
          <div className="col gap-3">
            <div className="ps-icon-choices" role="radiogroup" aria-label="Icon">
              {PROJECT_ICONS.map((i) => (
                <button key={i} type="button" role="radio" aria-checked={form.icon === i} className={cx('ps-icon-choice', form.icon === i && 'is-active')} onClick={() => set('icon', i)} disabled={ro} aria-label={`Icon ${i}`}>{i}</button>
              ))}
            </div>
            {!ro ? <ColorPicker value={form.color} onChange={(c) => set('color', c)} colors={PROJECT_COLORS} /> : null}
          </div>
        </div>
      </FormRow>
      <FormRow label="Name" htmlFor="ps-name" error={errors.name}>
        <Input id="ps-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} disabled={ro} error={Boolean(errors.name)} />
      </FormRow>
      <FormRow label="Key" hint="2–6 uppercase letters or digits. Prefixes every task ID." htmlFor="ps-key" error={errors.key || (!keyValid && form.key ? 'Use 2–6 characters: A–Z and 0–9, starting with a letter' : undefined)}>
        <Input id="ps-key" value={form.key} onChange={(e) => set('key', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} className="mono" style={{ maxWidth: 160 }} disabled={ro} error={Boolean(errors.key) || (!keyValid && Boolean(form.key))} />
        {keyChanged && keyValid ? (
          <SettingsNotice warning>
            Changing the key renames every task in this project (e.g. {project.key}-12 becomes {form.key.trim()}-12). Old links will stop working.
          </SettingsNotice>
        ) : null}
      </FormRow>
      <FormRow label="Description" htmlFor="ps-desc" error={errors.description}>
        <Textarea id="ps-desc" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="What is this project about?" disabled={ro} />
      </FormRow>
      <FormRow label="Lead" hint="Leads can manage this project's settings." error={errors.leadId}>
        <Select value={form.leadId} onChange={(v) => set('leadId', v === '__none__' ? null : v)} items={[{ value: '__none__', label: 'No lead' }, ...memberItems(members, me.id)]} placeholder="Choose a lead" searchable width={280} disabled={ro} />
      </FormRow>
      <FormRow label="Schedule" hint="Optional start and target dates for the timeline." error={dateError || errors.startDate || errors.targetDate}>
        <div className="row gap-2 wrap">
          <DatePicker value={form.startDate} onChange={(d) => set('startDate', d)} placeholder="Start date" size="md" disabled={ro} startOfWeek={me.preferences.startOfWeek} />
          <span className="muted">→</span>
          <DatePicker value={form.targetDate} onChange={(d) => set('targetDate', d)} placeholder="Target date" size="md" disabled={ro} startOfWeek={me.preferences.startOfWeek} min={form.startDate ?? undefined} />
        </div>
      </FormRow>
      <FormRow label="Visibility" hint={form.visibility === 'private' ? 'Only project members can see it. Manage them in the Members tab.' : 'Everyone in the workspace can see and open this project.'} error={errors.visibility}>
        {ro ? (
          <span className="readonly-value" style={{ textTransform: 'capitalize' }}>{form.visibility === 'public' ? 'Workspace' : 'Private'}</span>
        ) : (
          <Segmented value={form.visibility} onChange={(v) => set('visibility', v)} options={[{ value: 'public', label: 'Workspace', icon: 'globe' }, { value: 'private', label: 'Private', icon: 'lock' }]} />
        )}
      </FormRow>
    </SettingsCard>
  );
}
