// Project settings → Labels.
import { useEffect, useMemo, useState } from 'react';
import type { Label, ProjectBundle, Task } from '../../../../../../packages/shared/src/types.ts';
import { LABEL_COLORS } from '../../../../../../packages/shared/src/constants.ts';
import { keys, projectApi } from '../../../app/data.ts';
import { invalidate, setQueryData } from '../../../lib/query.ts';
import { toast } from '../../../lib/toast.ts';
import { useConfirm } from '../../../ui/overlays.tsx';
import { Badge, Button, EmptyState, Input, cx } from '../../../ui/primitives.tsx';
import { SettingsCard, SettingsNotice } from '../../settings/SettingsLayout.tsx';
import { ColorSwatchButton } from './WorkflowTab.tsx';

function patchLabels(projectId: string, fn: (labels: Label[]) => Label[]) {
  setQueryData<ProjectBundle>(keys.bundle(projectId), (prev) => (prev ? { ...prev, labels: fn(prev.labels) } : prev));
}

function LabelName({ value, onCommit, disabled }: { value: string; onCommit: (v: string) => void; disabled?: boolean }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    const v = text.trim();
    if (!v || v === value) {
      setText(value);
      return;
    }
    onCommit(v);
  };
  if (disabled) return <span className="medium truncate">{value}</span>;
  return (
    <div className="ps-inline">
      <Input size="sm" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); if (e.key === 'Escape') { setText(value); (e.currentTarget as HTMLInputElement).blur(); } }} maxLength={40} aria-label={`Label name: ${value}`} />
    </div>
  );
}

export function LabelsTab({ projectId, labels, tasks, canManage }: { projectId: string; labels: Label[]; tasks: Task[]; canManage: boolean }) {
  const confirm = useConfirm();
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks) for (const id of t.labelIds ?? []) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [tasks]);
  const sorted = useMemo(() => [...labels].sort((a, b) => a.name.localeCompare(b.name)), [labels]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)]);
  const [adding, setAdding] = useState(false);

  const update = async (l: Label, patch: { name?: string; color?: string }) => {
    patchLabels(projectId, (list) => list.map((x) => (x.id === l.id ? { ...x, ...patch } : x)));
    try {
      await projectApi.updateLabel(projectId, l.id, patch);
      invalidate(keys.bundle(projectId));
    } catch (e) {
      patchLabels(projectId, (list) => list.map((x) => (x.id === l.id ? l : x)));
      toast.fromError(e);
    }
  };
  const remove = async (l: Label) => {
    const n = usage.get(l.id) ?? 0;
    if (!(await confirm({ title: `Delete label “${l.name}”?`, description: n ? `It will be removed from ${n} task${n === 1 ? '' : 's'}.` : 'No tasks use this label.', danger: true, confirmLabel: 'Delete label' }))) return;
    try {
      await projectApi.deleteLabel(projectId, l.id);
      patchLabels(projectId, (list) => list.filter((x) => x.id !== l.id));
      invalidate(['tasks', keys.bundle(projectId)]);
      toast.success(`Label “${l.name}” deleted`);
    } catch (e) {
      toast.fromError(e);
    }
  };
  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    if (labels.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
      toast.error('A label with that name already exists');
      return;
    }
    setAdding(true);
    try {
      const created = await projectApi.addLabel(projectId, { name, color: newColor });
      patchLabels(projectId, (list) => (list.some((x) => x.id === created.id) ? list : [...list, created]));
      invalidate(keys.bundle(projectId));
      setNewName('');
      setNewColor(LABEL_COLORS[(LABEL_COLORS.indexOf(newColor) + 1) % LABEL_COLORS.length]);
      toast.success(`Label “${name}” added`);
    } catch (e) {
      toast.fromError(e);
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      {!canManage ? <SettingsNotice>Only workspace admins and the project lead can edit labels.</SettingsNotice> : null}
      <SettingsCard title={`Labels · ${labels.length}`} description="Tag tasks to group and filter them. Click a name to rename it." flush>
        {!sorted.length ? (
          <EmptyState compact icon="tag" title="No labels yet" description="Add one below to start tagging tasks." />
        ) : (
          <div role="list" aria-label="Labels" data-testid="label-list">
            {sorted.map((l) => {
              const n = usage.get(l.id) ?? 0;
              return (
                <div key={l.id} className={cx('ps-label-row', !canManage && 'is-readonly')} role="listitem" data-testid="label-row" data-label-name={l.name}>
                  <ColorSwatchButton value={l.color} onChange={(c) => void update(l, { color: c })} label={`Color for ${l.name}`} disabled={!canManage} dot />
                  <div className="row gap-2" style={{ minWidth: 0 }}>
                    <LabelName value={l.name} onCommit={(v) => void update(l, { name: v })} disabled={!canManage} />
                    <Badge color={l.color} size="sm" dot className="hidden-mobile">{l.name}</Badge>
                  </div>
                  <span className="ps-count">{n} {n === 1 ? 'task' : 'tasks'}</span>
                  {canManage ? <Button size="sm" variant="ghost" icon="trash" iconOnly onClick={() => void remove(l)} title={`Delete ${l.name}`}>{`Delete ${l.name}`}</Button> : null}
                </div>
              );
            })}
          </div>
        )}
        {canManage ? (
          <form className="ps-add-row" onSubmit={(e) => { e.preventDefault(); void add(); }} data-testid="add-label">
            <ColorSwatchButton value={newColor} onChange={setNewColor} label="Color for the new label" />
            <Input size="sm" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New label, e.g. Design" maxLength={40} aria-label="New label name" data-testid="new-label-name" />
            <Button size="sm" variant="primary" type="submit" icon="plus" disabled={!newName.trim()} loading={adding}>Add label</Button>
          </form>
        ) : null}
      </SettingsCard>
    </>
  );
}
