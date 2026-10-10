// Invite people to the workspace: paste emails, pick a role, get shareable links back.
import { useEffect, useMemo, useState } from 'react';
import type { WorkspaceRole } from '../../../../../packages/shared/src/types.ts';
import { ROLES, ROLE_RANK } from '../../../../../packages/shared/src/constants.ts';
import { keys, workspaceApi } from '../../app/data.ts';
import { useWorkspace } from '../../app/workspace.tsx';
import { RequestError } from '../../lib/api.ts';
import { invalidate } from '../../lib/query.ts';
import { toast } from '../../lib/toast.ts';
import { Icon } from '../../ui/Icon.tsx';
import { Dialog } from '../../ui/overlays.tsx';
import { Select, type PickerItem } from '../../ui/pickers.tsx';
import { Badge, Button, Field, Input, Textarea, cx } from '../../ui/primitives.tsx';
import './settings.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
type InviteRole = 'admin' | 'member' | 'guest';

export function parseEmails(text: string): { email: string; valid: boolean }[] {
  const seen = new Set<string>();
  const out: { email: string; valid: boolean }[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const email = raw.trim().replace(/^<|>$/g, '').toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ email, valid: EMAIL_RE.test(email) });
  }
  return out;
}

export function copyText(text: string, message = 'Copied to clipboard') {
  const done = () => toast.success(message);
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => toast.error("Couldn't copy"));
  else {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      done();
    } catch {
      toast.error("Couldn't copy");
    }
  }
}

type InviteResult = { email: string; status: string; link?: string; emailed?: boolean };

const STATUS_LABEL: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  sent: { label: 'Invite sent', tone: 'success' },
  already_member: { label: 'Already a member', tone: 'neutral' },
  already_invited: { label: 'Already invited', tone: 'warning' },
};

export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workspace } = useWorkspace();
  const [text, setText] = useState('');
  const [role, setRole] = useState<InviteRole>('member');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ results: InviteResult[]; emailConfigured: boolean } | null>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setRole('member');
      setMessage('');
      setError(null);
      setResult(null);
      setBusy(false);
    }
  }, [open]);

  const parsed = useMemo(() => parseEmails(text), [text]);
  const valid = parsed.filter((p) => p.valid).map((p) => p.email);
  const invalidCount = parsed.length - valid.length;

  const myRank = ROLE_RANK[workspace.role as WorkspaceRole];
  const roleItems: PickerItem<InviteRole>[] = ROLES.filter((r) => r.value !== 'owner' && ROLE_RANK[r.value] <= myRank).map((r) => ({ value: r.value as InviteRole, label: r.label, description: r.description }));

  const remove = (email: string) => {
    setText(parsed.filter((p) => p.email !== email).map((p) => p.email).join(', '));
  };

  const submit = async () => {
    if (!valid.length) return;
    setBusy(true);
    setError(null);
    try {
      const r = await workspaceApi.invite(workspace.id, valid, role, message.trim() || undefined);
      setResult(r);
      invalidate([keys.invites(workspace.id), keys.activity(workspace.id)]);
      const sent = r.results.filter((x) => x.status === 'sent').length;
      if (sent) toast.success(sent === 1 ? 'Invite sent' : `${sent} invites sent`);
    } catch (e) {
      setError(e instanceof RequestError ? Object.values(e.fieldErrors)[0] || e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite people"
      description={`Invite teammates to ${workspace.name}. Links expire in 7 days.`}
      footer={
        result ? (
          <>
            <Button variant="ghost" onClick={() => setResult(null)}>Invite more</Button>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!valid.length} onClick={() => void submit()} data-testid="invite-submit">
              {valid.length > 1 ? `Send ${valid.length} invites` : 'Send invite'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="col gap-3">
          {!result.emailConfigured ? (
            <div className="settings-notice is-warning" role="note">
              <Icon name="alert-triangle" size={15} />
              <div>Email isn't configured on this server — share the links below directly.</div>
            </div>
          ) : null}
          <div className="invite-results" data-testid="invite-results">
            {result.results.map((r) => {
              const s = STATUS_LABEL[r.status] ?? { label: r.status, tone: 'neutral' as const };
              return (
                <div key={r.email} className="invite-result">
                  <div className="invite-result-head">
                    <span className="semibold truncate">{r.email}</span>
                    <Badge tone={s.tone} size="sm">{s.label}{r.status === 'sent' && result.emailConfigured && r.emailed === false ? ' (email failed)' : ''}</Badge>
                  </div>
                  {r.link ? (
                    <div className="invite-link">
                      <Input size="sm" readOnly value={r.link} onFocus={(e) => e.currentTarget.select()} aria-label={`Invite link for ${r.email}`} data-testid="invite-link" />
                      <Button size="sm" variant="secondary" icon="copy" onClick={() => copyText(r.link!, 'Invite link copied')}>Copy</Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {error ? <div className="form-error">{error}</div> : null}
          <Field label="Email addresses" hint="Separate multiple addresses with commas, spaces or new lines." htmlFor="invite-emails" required error={invalidCount ? `${invalidCount} address${invalidCount === 1 ? ' is' : 'es are'} not valid` : undefined}>
            <Textarea id="invite-emails" value={text} onChange={(e) => setText(e.target.value)} placeholder="ana@example.com, ben@example.com" rows={3} data-autofocus autoResize />
          </Field>
          {parsed.length ? (
            <div className="invite-chips" aria-label="Recipients">
              {parsed.map((p) => (
                <span key={p.email} className={cx('invite-chip', !p.valid && 'is-invalid')} title={p.valid ? p.email : 'Invalid email address'}>
                  {!p.valid ? <Icon name="alert-circle" size={12} /> : null}
                  {p.email}
                  <button type="button" onClick={() => remove(p.email)} aria-label={`Remove ${p.email}`}>
                    <Icon name="x" size={11} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <Field label="Role" hint={ROLES.find((r) => r.value === role)?.description}>
            <Select value={role} onChange={setRole} items={roleItems} width={300} />
          </Field>
          <Field label="Personal message" hint="Optional — included in the invitation email." htmlFor="invite-message">
            <Textarea id="invite-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Come join us on TeamTask!" rows={2} maxLength={500} />
          </Field>
        </form>
      )}
    </Dialog>
  );
}
