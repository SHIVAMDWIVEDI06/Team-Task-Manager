// Inbox: /w/:slug/inbox — full notifications list with tabs, type filter, keyboard navigation and a detail pane.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Notification, NotificationType } from '../../../../../packages/shared/src/types.ts';
import { keys, notificationApi, useNotifications } from '../../app/data.ts';
import { useTopbar } from '../../app/shell/Topbar.tsx';
import { useWorkspace } from '../../app/workspace.tsx';
import { useHotkey, useIsMobile } from '../../lib/hooks.ts';
import { invalidate, setQueryData } from '../../lib/query.ts';
import { formatDateTime, relativeTime } from '../../lib/format.ts';
import { toast } from '../../lib/toast.ts';
import { Icon } from '../../ui/Icon.tsx';
import { Tabs, Tooltip, useConfirm } from '../../ui/overlays.tsx';
import { Select, type PickerItem } from '../../ui/pickers.tsx';
import { Avatar, Badge, Button, EmptyState, Kbd, Skeleton, cx } from '../../ui/primitives.tsx';
import { NOTIFICATION_ICON, NotificationItem, markNotificationsRead, openNotification } from './NotificationsPopover.tsx';
import './inbox.css';

type Cache = { items: Notification[]; unread: number };
type TypeFilter = 'all' | NotificationType;

const TYPE_LABEL: Record<NotificationType, string> = {
  assigned: 'Assigned',
  mentioned: 'Mentioned',
  commented: 'Comments',
  status_changed: 'Status changes',
  due_soon: 'Due soon',
  invite: 'Invites',
  watching: 'Watching',
};

function patch(fn: (prev: Cache) => Cache) {
  setQueryData<Cache>(keys.notifications, (prev) => (prev ? fn(prev) : prev));
}

/** Flip a notification back to unread (optimistic). */
export function markNotificationUnread(id: string) {
  patch((prev) => ({ items: prev.items.map((n) => (n.id === id && n.readAt ? { ...n, readAt: null } : n)), unread: prev.unread + (prev.items.some((n) => n.id === id && n.readAt) ? 1 : 0) }));
  void notificationApi.markUnread([id]).catch(() => invalidate(keys.notifications));
}

export function deleteNotification(id: string) {
  patch((prev) => {
    const n = prev.items.find((x) => x.id === id);
    return { items: prev.items.filter((x) => x.id !== id), unread: Math.max(0, prev.unread - (n && !n.readAt ? 1 : 0)) };
  });
  void notificationApi.remove(id).catch(() => invalidate(keys.notifications));
}

const overlayOpen = () => Boolean(document.querySelector('.popover, .dialog-overlay'));

export function InboxPage() {
  const { base } = useWorkspace();
  const isMobile = useIsMobile();
  const confirm = useConfirm();
  const q = useNotifications();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [focusId, setFocusId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useTopbar([{ label: 'Inbox' }], null, []);

  const all = useMemo(() => q.data?.items ?? [], [q.data]);
  const unread = q.data?.unread ?? all.filter((n) => !n.readAt).length;
  const visible = useMemo(() => all.filter((n) => (tab === 'all' || !n.readAt) && (type === 'all' || n.type === type)), [all, tab, type]);
  const focused = visible.find((n) => n.id === focusId) ?? null;

  // keep the focused row valid
  useEffect(() => {
    if (focusId && !visible.some((n) => n.id === focusId)) setFocusId(visible[0]?.id ?? null);
  }, [visible, focusId]);
  useEffect(() => {
    if (!focusId) return;
    listRef.current?.querySelector<HTMLElement>(`[data-id="${focusId}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [focusId]);

  const move = useCallback(
    (delta: number) => {
      if (!visible.length) return;
      const idx = visible.findIndex((n) => n.id === focusId);
      const next = idx === -1 ? (delta > 0 ? 0 : visible.length - 1) : Math.min(visible.length - 1, Math.max(0, idx + delta));
      setFocusId(visible[next].id);
    },
    [visible, focusId],
  );

  const toggleRead = useCallback((n: Notification) => {
    if (n.readAt) markNotificationUnread(n.id);
    else markNotificationsRead([n.id]);
  }, []);

  const remove = useCallback(
    (n: Notification) => {
      const idx = visible.findIndex((x) => x.id === n.id);
      const next = visible[idx + 1] ?? visible[idx - 1] ?? null;
      deleteNotification(n.id);
      setFocusId(next?.id ?? null);
    },
    [visible],
  );

  const open = useCallback((n: Notification) => openNotification(n, base), [base]);

  useHotkey('j', () => { if (!overlayOpen()) move(1); });
  useHotkey('k', () => { if (!overlayOpen()) move(-1); });
  useHotkey('enter', () => { if (!overlayOpen() && focused) open(focused); });
  useHotkey('e', () => { if (!overlayOpen() && focused) toggleRead(focused); });
  useHotkey('backspace', () => { if (!overlayOpen() && focused) remove(focused); });

  const markAllRead = () => {
    const ids = all.filter((n) => !n.readAt).map((n) => n.id);
    if (!ids.length) return;
    patch((prev) => ({ items: prev.items.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })), unread: 0 }));
    void notificationApi.markAllRead().then(() => toast.success('All notifications marked as read'), () => invalidate(keys.notifications));
  };

  const clearRead = async () => {
    const count = all.filter((n) => n.readAt).length;
    if (!count) return;
    if (!(await confirm({ title: `Clear ${count} read notification${count === 1 ? '' : 's'}?`, description: 'Unread notifications are kept.', danger: true, confirmLabel: 'Clear read' }))) return;
    patch((prev) => ({ items: prev.items.filter((n) => !n.readAt), unread: prev.unread }));
    try {
      await notificationApi.clear(true);
      toast.success('Read notifications cleared');
    } catch (e) {
      toast.fromError(e);
      invalidate(keys.notifications);
    }
  };

  const typeItems: PickerItem<TypeFilter>[] = [
    { value: 'all', label: 'All types', icon: <Icon name="inbox" size={14} className="muted" /> },
    ...(['mentioned', 'assigned', 'commented', 'status_changed', 'due_soon', 'invite', 'watching'] as NotificationType[]).map((t) => ({ value: t, label: TYPE_LABEL[t], icon: <Icon name={NOTIFICATION_ICON[t]} size={14} className="muted" />, right: <span className="xs muted tabular">{all.filter((n) => n.type === t).length || ''}</span> })),
  ];

  const loading = q.isLoading && !q.data;

  return (
    <div className={cx('inbox', isMobile && 'is-mobile')}>
      <div className="inbox-main">
        <div className="inbox-head">
          <div className="inbox-head-top">
            <h1 className="inbox-title">
              Inbox
              {unread ? <span className="inbox-unread-pill tabular" data-testid="inbox-unread">{unread}</span> : null}
            </h1>
            <div className="row gap-1">
              <Tooltip content="Refresh">
                <Button size="sm" variant="ghost" icon="refresh" iconOnly loading={q.isFetching} onClick={() => void q.refetch()}>Refresh</Button>
              </Tooltip>
              <Button size="sm" variant="ghost" icon="check-check" disabled={!unread} onClick={markAllRead} data-testid="mark-all-read">{isMobile ? null : 'Mark all read'}</Button>
              <Button size="sm" variant="ghost" icon="trash" disabled={!all.some((n) => n.readAt)} onClick={() => void clearRead()}>{isMobile ? null : 'Clear read'}</Button>
            </div>
          </div>
          <div className="inbox-filters">
            <Tabs
              size="sm"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'all', label: 'All', count: all.length },
                { value: 'unread', label: 'Unread', count: unread },
              ]}
            />
            <Select size="sm" variant="ghost" value={type} onChange={setType} items={typeItems} width={230} searchable={false} title="Filter by type" />
          </div>
        </div>

        <div className="inbox-list" ref={listRef} role="list" aria-label="Notifications">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="inbox-skeleton">
                <Skeleton width={32} height={32} radius={16} />
                <div className="col gap-2 grow">
                  <Skeleton width={`${50 + ((i * 17) % 35)}%`} height={12} />
                  <Skeleton width="70%" height={10} />
                </div>
              </div>
            ))
          ) : q.error ? (
            <EmptyState icon="alert-circle" title="Couldn't load notifications" description={q.error.message} action={<Button variant="secondary" onClick={() => void q.refetch()}>Retry</Button>} />
          ) : !visible.length ? (
            <EmptyState icon={tab === 'unread' || all.length ? 'circle-check' : 'inbox'} title={all.length ? (tab === 'unread' ? "You're all caught up" : 'Nothing matches this filter') : "You're all caught up"} description={all.length ? (tab === 'unread' ? 'No unread notifications. Nice work.' : 'Try another type or switch to All.') : 'Mentions, assignments, comments and reminders will show up here.'} />
          ) : (
            visible.map((n) => (
              <div key={n.id} className={cx('inbox-item', focusId === n.id && 'is-focused')} data-id={n.id} role="listitem" onMouseEnter={() => setFocusId(n.id)} onFocus={() => setFocusId(n.id)}>
                <NotificationItem n={n} onOpen={() => { setFocusId(n.id); open(n); }} />
                <span className="inbox-item-actions" data-no-drag>
                  <Tooltip content={n.readAt ? 'Mark unread' : 'Mark read'} shortcut="E">
                    <Button size="sm" variant="ghost" icon={n.readAt ? 'mail' : 'check'} iconOnly onClick={() => toggleRead(n)}>{n.readAt ? 'Mark unread' : 'Mark read'}</Button>
                  </Tooltip>
                  <Tooltip content="Delete" shortcut="⌫">
                    <Button size="sm" variant="ghost" icon="x" iconOnly onClick={() => remove(n)}>Delete</Button>
                  </Tooltip>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {!isMobile ? (
        <aside className="inbox-side" aria-label="Details">
          {focused ? <NotificationDetail n={focused} onOpen={() => open(focused)} onToggleRead={() => toggleRead(focused)} onDelete={() => remove(focused)} /> : <InboxTips />}
        </aside>
      ) : null}
    </div>
  );
}

function NotificationDetail({ n, onOpen, onToggleRead, onDelete }: { n: Notification; onOpen: () => void; onToggleRead: () => void; onDelete: () => void }) {
  return (
    <div className="inbox-detail" data-testid="inbox-detail">
      <div className="inbox-detail-head">
        {n.actor ? <Avatar name={n.actor.name} src={n.actor.avatarUrl} size={40} /> : <span className="notif-icon-wrap" style={{ width: 40, height: 40 }}><Icon name={NOTIFICATION_ICON[n.type] || 'bell'} size={18} /></span>}
        <div className="col gap-1" style={{ minWidth: 0 }}>
          <Badge size="sm" icon={NOTIFICATION_ICON[n.type]} tone={n.readAt ? 'neutral' : 'brand'}>{TYPE_LABEL[n.type] ?? n.type}</Badge>
          <span className="xs muted" title={formatDateTime(n.createdAt)}>{relativeTime(n.createdAt)}{n.readAt ? ' · read' : ' · unread'}</span>
        </div>
      </div>
      <h2 className="inbox-detail-title">{n.title}</h2>
      {n.body ? <p className="inbox-detail-body">{n.body}</p> : null}
      <div className="inbox-detail-actions">
        {n.link ? <Button variant="primary" icon="arrow-up-right" onClick={onOpen}>Open</Button> : null}
        <Button variant="secondary" icon={n.readAt ? 'mail' : 'check'} onClick={onToggleRead}>{n.readAt ? 'Mark unread' : 'Mark read'}</Button>
        <Button variant="ghost" icon="trash" onClick={onDelete}>Delete</Button>
      </div>
      <div className="inbox-detail-meta">
        <span className="xs muted">{formatDateTime(n.createdAt)}</span>
      </div>
    </div>
  );
}

function InboxTips() {
  return (
    <div className="inbox-tips">
      <div className="section-title" style={{ marginBottom: 8 }}>Tips</div>
      <ul className="inbox-tips-list">
        <li><span><Kbd>J</Kbd> <Kbd>K</Kbd></span> Move between notifications</li>
        <li><span><Kbd>↵</Kbd></span> Open the task or invite</li>
        <li><span><Kbd>E</Kbd></span> Toggle read / unread</li>
        <li><span><Kbd>⌫</Kbd></span> Delete</li>
      </ul>
      <p className="xs muted" style={{ marginTop: 12 }}>New notifications arrive in real time. Manage what you receive in account settings.</p>
    </div>
  );
}
