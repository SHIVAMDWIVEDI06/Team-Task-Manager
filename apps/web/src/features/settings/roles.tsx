// Role helpers shared by the Team page and workspace member settings.
import type { WorkspaceRole } from '../../../../../packages/shared/src/types.ts';
import { ROLES, ROLE_RANK } from '../../../../../packages/shared/src/constants.ts';
import { Badge } from '../../ui/primitives.tsx';
import type { PickerItem } from '../../ui/pickers.tsx';

export const ROLE_TONE: Record<WorkspaceRole, 'brand' | 'info' | 'neutral' | 'warning'> = { owner: 'brand', admin: 'info', member: 'neutral', guest: 'warning' };

export function RoleBadge({ role, size = 'sm' }: { role: WorkspaceRole; size?: 'sm' | 'md' }) {
  const def = ROLES.find((r) => r.value === role);
  return (
    <Badge tone={ROLE_TONE[role]} size={size} title={def?.description} icon={role === 'owner' ? 'crown' : undefined}>
      {def?.label ?? role}
    </Badge>
  );
}

/** Roles the current user may assign: never above their own; "owner" only if they are an owner. */
export function roleItemsFor(myRole: WorkspaceRole): PickerItem<WorkspaceRole>[] {
  return ROLES.filter((r) => ROLE_RANK[r.value] <= ROLE_RANK[myRole] && (r.value !== 'owner' || myRole === 'owner')).map((r) => ({ value: r.value, label: r.label, description: r.description }));
}

/** Whether `myRole` may change `targetRole` at all (cannot touch people above you). */
export function canManageRole(myRole: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  return ROLE_RANK[myRole] >= ROLE_RANK.admin && ROLE_RANK[targetRole] <= ROLE_RANK[myRole];
}

export function formatJoined(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Current local time in a timezone, e.g. "3:42 PM" — null when the timezone is unknown. */
export function localTimeIn(timeZone: string, now = new Date()): string | null {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone, hour: 'numeric', minute: '2-digit' }).format(now);
  } catch {
    return null;
  }
}

/** Hour offset relative to the viewer's own timezone, e.g. "+5.5h" — "" when identical/unknown. */
export function tzOffsetLabel(timeZone: string, now = new Date()): string {
  try {
    const mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (mine === timeZone) return 'same time';
    const at = (tz: string) => {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(now);
      const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
      return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
    };
    const diff = (at(timeZone) - at(mine)) / 3_600_000;
    if (!diff) return 'same time';
    const abs = Math.abs(diff);
    const str = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
    return `${diff > 0 ? '+' : '−'}${str}h`;
  } catch {
    return '';
  }
}

/** "in 6 days" / "in 3 hours" / "Expired" for a future timestamp. */
export function expiresIn(iso: string, now = Date.now()): string {
  const diff = Date.parse(iso) - now;
  if (diff <= 0) return 'Expired';
  const h = Math.round(diff / 3_600_000);
  if (h < 1) return 'in less than an hour';
  if (h < 24) return `in ${h} hour${h === 1 ? '' : 's'}`;
  const d = Math.round(h / 24);
  return `in ${d} day${d === 1 ? '' : 's'}`;
}
