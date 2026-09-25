import { useEffect, useState, type FormEvent } from 'react';
import { navigate } from '../../lib/router.tsx';
import { useWorkspace } from '../../app/workspace.tsx';
import { useMe } from '../../app/auth.tsx';
import { projectApi } from '../../app/data.ts';
import { invalidate } from '../../lib/query.ts';
import { toast } from '../../lib/toast.ts';
import { RequestError } from '../../lib/api.ts';
import { Dialog } from '../../ui/overlays.tsx';
import { Button, Checkbox, Field, Input, Textarea, Segmented, cx } from '../../ui/primitives.tsx';
import { ColorPicker, Select } from '../../ui/pickers.tsx';
import { PROJECT_COLORS, PROJECT_ICONS, projectKeyFromName } from '../../../../../packages/shared/src/index.ts';
import { memberItems } from '../tasks/fields.tsx';
import { Icon } from '../../ui/Icon.tsx';

export function CreateProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workspace, base, members } = useWorkspace();
  const me = useMe();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [icon, setIcon] = useState(PROJECT_ICONS[0]);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [leadId, setLeadId] = useState<string | null>(me.id);
  const [sample, setSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName('');
      setKey('');
      setKeyTouched(false);
      setDescription('');
      setColor(PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]);
      setIcon(PROJECT_ICONS[Math.floor(Math.random() * PROJECT_ICONS.length)]);
      setVisibility('public');
      setLeadId(me.id);
      setSample(false);
      setErrors({});
    }
  }, [open, me.id]);

  useEffect(() => {
    if (!keyTouched) setKey(name.trim() ? projectKeyFromName(name) : '');
  }, [name, keyTouched]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const p = await projectApi.create(workspace.id, { name: name.trim(), key: key.trim().toUpperCase(), description, color, icon, visibility, leadId, withSampleTasks: sample });
      invalidate(['projects', 'dashboard']);
      toast.success(`Project ${p.name} created`);
      onClose();
      navigate(`${base}/p/${p.key}`);
    } catch (err) {
      if (err instanceof RequestError) {
        const fe = err.fieldErrors;
        setErrors(Object.keys(fe).length ? fe : { _: err.message });
      } else setErrors({ _: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New project"
      description="Projects group related tasks with their own workflow, labels and views."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" loading={busy} disabled={!name.trim() || key.length < 2} onClick={submit}>Create project</Button>
        </>
      }
    >
      <form className="form" onSubmit={submit}>
        {errors._ ? <div className="form-error">{errors._}</div> : null}
        <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
          <div className="col gap-2" style={{ alignItems: 'center' }}>
            <span className="project-icon" style={{ background: color, width: 44, height: 44, fontSize: 20, borderRadius: 12 }}>{icon}</span>
            <div className="row gap-1 wrap" style={{ maxWidth: 120, justifyContent: 'center' }}>
              {PROJECT_ICONS.map((i) => (
                <button key={i} type="button" className={cx('icon-choice', icon === i && 'is-active')} onClick={() => setIcon(i)} aria-label={`Icon ${i}`}>{i}</button>
              ))}
            </div>
          </div>
          <div className="col gap-3 grow">
            <Field label="Name" error={errors.name} htmlFor="p-name" required>
              <Input id="p-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Mobile app" maxLength={80} data-autofocus />
            </Field>
            <Field label="Key" hint="Short prefix for task IDs, e.g. APP-12." error={errors.key} htmlFor="p-key" required>
              <Input id="p-key" value={key} onChange={(e) => { setKeyTouched(true); setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); }} placeholder="APP" className="mono" style={{ maxWidth: 140 }} />
            </Field>
          </div>
        </div>
        <Field label="Color">
          <ColorPicker value={color} onChange={setColor} colors={PROJECT_COLORS} />
        </Field>
        <Field label="Description" htmlFor="p-desc">
          <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project about?" rows={2} />
        </Field>
        <div className="grid-2">
          <Field label="Lead">
            <Select value={leadId} onChange={setLeadId} items={memberItems(members, me.id)} placeholder="Choose a lead" searchable width={260} />
          </Field>
          <Field label="Visibility">
            <Segmented value={visibility} onChange={setVisibility} options={[{ value: 'public', label: 'Workspace', icon: 'globe', title: 'Everyone in the workspace' }, { value: 'private', label: 'Private', icon: 'lock', title: 'Only invited members' }]} />
          </Field>
        </div>
        <Checkbox checked={sample} onChange={setSample} label={<span className="row gap-2"><Icon name="sparkles" size={13} className="muted" /> Add a few sample tasks</span>} />
      </form>
    </Dialog>
  );
}
