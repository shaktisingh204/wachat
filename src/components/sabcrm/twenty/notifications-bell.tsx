'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, X } from 'lucide-react';

import {
  listNotificationsTw,
  notificationsCountTw,
  markNotificationReadTw,
  markAllNotificationsReadTw,
  deleteNotificationTw,
} from '@/app/actions/sabcrm-notifications.actions';
import { useSabcrmSettings } from '@/components/sabcrm/twenty/sabcrm-settings-context';
import { StPortalPopover } from '@/components/sabcrm/twenty/st-portal-popover';

/** Shape returned by {@link listNotificationsTw}. */
type SabcrmNotification = {
  id: string;
  title: string;
  body?: string | null;
  kind?: string | null;
  targetObject?: string | null;
  targetRecordId?: string | null;
  read: boolean;
  createdAt: string | number | Date;
};

const POLL_INTERVAL_MS = 60_000;

/** Compact "2m ago" / "3h ago" / "5d ago" relative time, English only. */
function relativeTime(value: string | number | Date): string {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 45) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWk = Math.round(diffDay / 7);
  if (diffWk < 5) return `${diffWk}w ago`;
  return new Date(then).toLocaleDateString();
}

/**
 * Twenty-style notifications bell. Polls the unread count on mount and every
 * ~60s; opening the dropdown refreshes both the count and the recent list.
 * Every engine call is graceful — a failure leaves the bell at 0 / empty and
 * never throws.
 */
export function NotificationsBell(): React.JSX.Element {
  const router = useRouter();
  const { notifications = {} } = useSabcrmSettings();
  const muteAll = notifications.muteAll === true;
  const eventPrefs = notifications.events ?? {};

  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const [items, setItems] = React.useState<SabcrmNotification[]>([]);
  const [loading, setLoading] = React.useState(false);

  const btnRef = React.useRef<HTMLButtonElement>(null);

  const refreshCount = React.useCallback(async () => {
    try {
      const res = await notificationsCountTw();
      setUnread(res.ok ? res.data.unread : 0);
    } catch {
      setUnread(0);
    }
  }, []);

  const refreshList = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listNotificationsTw();
      setItems(res.ok ? (res.data as SabcrmNotification[]) : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll the unread count on mount and on an interval.
  React.useEffect(() => {
    let active = true;
    void (async () => {
      const res = await notificationsCountTw().catch(() => null);
      if (active) setUnread(res?.ok ? res.data.unread : 0);
    })();
    const id = window.setInterval(() => {
      void refreshCount();
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [refreshCount]);

  // When the panel opens, refresh both the list and the count.
  React.useEffect(() => {
    if (!open) return;
    void refreshList();
    void refreshCount();
  }, [open, refreshList, refreshCount]);

  // Outside-click + Escape close is handled by StPortalPopover (the panel is
  // body-portalled so the sidebar's `overflow:hidden` can't clip it).

  const handleOpenItem = React.useCallback(
    async (n: SabcrmNotification) => {
      // Optimistically mark read locally, then persist.
      if (!n.read) {
        setItems((prev) =>
          prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)),
        );
        setUnread((u) => Math.max(0, u - 1));
        try {
          await markNotificationReadTw(n.id, true);
        } catch {
          /* graceful: local state already updated */
        }
      }
      if (n.targetObject && n.targetRecordId) {
        setOpen(false);
        router.push(`/sabcrm/${n.targetObject}/${n.targetRecordId}`);
      }
    },
    [router],
  );

  const handleMarkAll = React.useCallback(async () => {
    setItems((prev) => prev.map((it) => ({ ...it, read: true })));
    setUnread(0);
    try {
      await markAllNotificationsReadTw();
    } catch {
      /* graceful */
    }
  }, []);

  const handleDelete = React.useCallback(
    async (e: React.MouseEvent, n: SabcrmNotification) => {
      e.stopPropagation();
      setItems((prev) => prev.filter((it) => it.id !== n.id));
      if (!n.read) setUnread((u) => Math.max(0, u - 1));
      try {
        await deleteNotificationTw(n.id);
      } catch {
        /* graceful */
      }
    },
    [],
  );

  // Suppress badge when muted; filter items whose event kind has inApp=false.
  const hasUnread = !muteAll && unread > 0;
  const badgeText = unread > 99 ? '99+' : String(unread);

  const visibleItems = React.useMemo(
    () =>
      items.filter((n) => {
        if (!n.kind) return true; // unknown kind — always show
        const pref = eventPrefs[n.kind];
        if (!pref) return true; // no pref for this kind — always show
        return pref.inApp !== false;
      }),
    [items, eventPrefs],
  );

  return (
    <div className="st-notif">
      <button
        ref={btnRef}
        type="button"
        className={`st-notif__btn${open ? ' active' : ''}${muteAll ? ' st-notif__btn--muted' : ''}`}
        aria-label={
          muteAll
            ? 'Notifications muted'
            : hasUnread
              ? `Notifications, ${unread} unread`
              : 'Notifications'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {muteAll ? (
          <BellOff size={16} aria-hidden="true" style={{ opacity: 0.55 }} />
        ) : (
          <Bell size={16} aria-hidden="true" />
        )}
        {hasUnread ? (
          <span className="st-notif__badge" aria-hidden="true">
            {badgeText}
          </span>
        ) : null}
      </button>

      <StPortalPopover
        anchorRef={btnRef}
        open={open}
        onClose={() => setOpen(false)}
        align="end"
        role="dialog"
        ariaLabel="Notifications"
        className="st-notif__panel--portal"
      >
        <div className="st-notif__panel-inner">
          <div className="st-notif__header">
            <span className="st-notif__title">
              Notifications
              {muteAll ? (
                <span
                  className="st-notif__muted-hint"
                  style={{ marginLeft: 6, fontSize: '0.72em', opacity: 0.55, fontWeight: 400 }}
                >
                  Muted
                </span>
              ) : null}
            </span>
            <button
              type="button"
              className="st-notif__mark-all"
              onClick={() => void handleMarkAll()}
              disabled={!hasUnread}
            >
              Mark all read
            </button>
          </div>

          <div className="st-notif__list">
            {loading && visibleItems.length === 0 ? (
              <div className="st-notif__empty">Loading…</div>
            ) : visibleItems.length === 0 ? (
              <div className="st-notif__empty">You're all caught up</div>
            ) : (
              visibleItems.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="st-notif__item"
                  onClick={() => void handleOpenItem(n)}
                >
                  <span
                    className={`st-notif__dot${n.read ? ' st-notif__dot--read' : ''}`}
                    aria-hidden="true"
                  />
                  <span className="st-notif__body">
                    <span
                      className={`st-notif__item-title${n.read ? ' st-notif__item-title--read' : ''}`}
                    >
                      {n.title}
                    </span>
                    {n.body ? (
                      <span className="st-notif__item-text">{n.body}</span>
                    ) : null}
                    <span className="st-notif__time">
                      {relativeTime(n.createdAt)}
                    </span>
                  </span>
                  <span
                    className="st-notif__del"
                    role="button"
                    tabIndex={-1}
                    aria-label="Dismiss notification"
                    onClick={(e) => void handleDelete(e, n)}
                  >
                    <X size={13} aria-hidden="true" />
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </StPortalPopover>
    </div>
  );
}

export default NotificationsBell;
