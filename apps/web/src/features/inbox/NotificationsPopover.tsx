import { useRef, useState } from 'react';
import { navigate } from '../../lib/router.tsx';
import { useWorkspace } from '../../app/workspace.tsx';
import { notificationApi, useNotifications, keys } from '../../app/data.ts';
import { setQueryData } from '../../lib/query.ts';
import { Popover, Tooltip } from '../../ui/overlays.tsx';
import { Avatar, Button, EmptyState, cx } from '../../ui/primitives.tsx';
import { Icon, type IconName } from '../../ui/Icon.tsx';
import { relativeTime } from '../../lib/format.ts';
import type { Notification } from '../../../../../packages/shared/src/types.ts';
import './inbox.css';

export const NOTIFICATION_ICON: Record<Notification['type'], IconName> = {
  assigned: 'user',
  mentioned: 'at-sign',
  commented: 'message',
  status_changed: 'circle-check',
  due_soon: 'clock',
  invite: 'mail',
  watching: 'eye',
};

export function markNotificationsRead(ids: string[]) {
  setQueryData<{ items: Notification[]; unread: number }>(keys.notifications, (prev) => {
    if (!prev) return prev;
    const set = new Set(ids);
    let changed = 0;
    const items = prev.items.map((n) => {
      if (set.has(n.id) && !n.readAt) {
        changed++;
        return { ...n, readAt: new Date().toISOString() };
      }
      return n;
    });
    return { items, unread: Math.max(0, prev.unread - changed) };
  });
  void notificationApi.markRead(ids).catch(() => {});
}

export function openNotification(n: Notification, base: string) {
  if (!n.readAt) markNotificationsRead([n.id]);
  if (n.link) navigate(n.link.startsWith('/w/') || n.link.startsWith('/invite') ? n.link : `${base}${n.link}`);
}

export function NotificationItem({ n, onOpen, compact }: { n: Notification; onOpen: () => void; compact?: boolean }) {
  return (
    <button type="button" className={cx('notif', !n.readAt && 'is-unread', compact && 'is-compact')} onClick={onOpen}>
      <span className="notif-avatar">
        {n.actor ? <Avatar name={n.actor.name} src={n.actor.avatarUrl} size={compact ? 26 : 32} /> : <span className="notif-icon-wrap"><Icon name={NOTIFICATION_ICON[n.type] || 'bell'} size={14} /></span>}
        {n.actor ? <span className="notif-type"><Icon name={NOTIFICATION_ICON[n.type] || 'bell'} size={9} /></span> : null}
      </span>
      <span className="notif-body">
        <span className="notif-title">{n.title}</span>
        {n.body ? <span className="notif-text truncate">{n.body}</span> : null}
        <span className="notif-time">{relativeTime(n.createdAt)}</span>
      </span>
      {!n.readAt ? <span className="notif-dot" /> : null}
    </button>
  );
}

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);
  const { base } = useWorkspace();
  const q = useNotifications();
  const items = q.data?.items ?? [];
  const unread = q.data?.unread ?? 0;
  const recent = items.slice(0, 8);
  return (
    <>
      <Tooltip content="Notifications" placement="bottom">
        <button ref={ref} type="button" className="btn btn-ghost btn-sm btn-icon notif-bell" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} aria-haspopup="dialog" aria-expanded={open}>
          <Icon name="bell" size={16} />
          {unread ? <span className="notif-badge">{unread > 99 ? '99+' : unread}</span> : null}
        </button>
      </Tooltip>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} align="end" width={380} className="notif-popover">
        <div className="notif-head">
          <span className="semibold">Notifications</span>
          <span className="row gap-1">
            {unread ? (
              <Button size="sm" variant="ghost" icon="check-check" onClick={() => { markNotificationsRead(items.filter((n) => !n.readAt).map((n) => n.id)); }}>
                Mark all read
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => { setOpen(false); navigate(`${base}/inbox`); }}>
              View all
            </Button>
          </span>
        </div>
        <div className="notif-list">
          {recent.length ? recent.map((n) => <NotificationItem key={n.id} n={n} compact onOpen={() => { setOpen(false); openNotification(n, base); }} />) : <EmptyState compact icon="bell" title="You're all caught up" description="Mentions, assignments and updates will show up here." />}
        </div>
      </Popover>
    </>
  );
}
