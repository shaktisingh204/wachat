'use client';

/**
 * SabCRM — NotificationBell (stateful header bell).
 *
 * The live, data-bound wrapper around the presentational 20ui
 * `NotificationPopover`. It owns the data lifecycle the presentational
 * component deliberately does NOT:
 *
 *   - polls `unreadCountTw` on a gentle interval so the badge stays live even
 *     while the popover is closed (no third-party realtime — pure polling, per
 *     the in-house rule);
 *   - fetches the feed via `listNotificationsTw` when the popover opens (and on
 *     project change);
 *   - marks a row read + deep-links to its `href` on click (optimistic);
 *   - marks all read via `markAllReadTw` (optimistic).
 *
 * Reads from the IN-HOUSE Mongo inbox actions
 * (`@/app/actions/sabcrm-notification-inbox.actions`) — the recipient is always
 * the authenticated session user, enforced server-side. Degrades silently when
 * the engine/DB is unreachable (the bell simply shows zero unread).
 *
 * Mount this in the SabCRM shell header (see `notification-bell.tsx` usage in
 * the suite frame). Pure 20ui; lucide icons resolved per-kind and rendered by
 * the presentational component via its `renderIcon` helper.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AtSign,
  UserCheck,
  AlarmClock,
  ShieldCheck,
  MessageSquare,
  Bell,
  Info,
  type LucideIcon,
} from 'lucide-react';

import { NotificationPopover, type Notification } from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listNotificationsTw,
  unreadCountTw,
  markReadTw,
  markAllReadTw,
} from '@/app/actions/sabcrm-notification-inbox.actions';
import type {
  SabcrmInboxNotification,
  NotificationKind,
} from '@/lib/sabcrm/notifications.server';

/** Lucide icon per kind (mirrors `iconForKind` in the pure module). */
const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  mention: AtSign,
  assignment: UserCheck,
  sla_breach: AlarmClock,
  approval: ShieldCheck,
  comment: MessageSquare,
  system: Bell,
  info: Info,
};

/** How often (ms) to refresh the unread badge while mounted. */
const POLL_MS = 60_000;
/** How many rows the dropdown shows. */
const FEED_LIMIT = 30;

interface BellState {
  items: SabcrmInboxNotification[];
  unread: number;
}

/** Map a stored inbox row → the presentational `Notification` the popover wants. */
function toFeedItem(n: SabcrmInboxNotification): Notification {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    read: n.read,
    time: n.createdAt,
    icon: KIND_ICON[n.kind] ?? Info,
  };
}

export function NotificationBell({
  projectId: explicitProjectId,
}: {
  /** Override the active project (defaults to the context's active project). */
  projectId?: string;
}): React.ReactElement {
  const router = useRouter();
  const { activeProjectId } = useProject();
  const projectId = explicitProjectId ?? activeProjectId ?? undefined;

  const [state, setState] = React.useState<BellState>({ items: [], unread: 0 });
  // A stable ref the deep-link click handler reads so navigation always sees
  // the freshest feed without re-creating the callback on every fetch.
  const itemsRef = React.useRef<SabcrmInboxNotification[]>([]);
  itemsRef.current = state.items;

  /** Refresh just the unread badge (cheap; runs on the poll interval). */
  const refreshCount = React.useCallback(async () => {
    if (!projectId) return;
    const res = await unreadCountTw(projectId);
    if (res.ok) {
      setState((s) => ({ ...s, unread: res.data.unread }));
    }
  }, [projectId]);

  /** Fetch the feed + recompute unread from it (runs when the popover opens). */
  const refreshFeed = React.useCallback(async () => {
    if (!projectId) return;
    const res = await listNotificationsTw({ limit: FEED_LIMIT }, projectId);
    if (res.ok) {
      const items = res.data;
      setState({ items, unread: items.reduce((n, x) => n + (x.read ? 0 : 1), 0) });
    }
  }, [projectId]);

  // Initial count + gentle polling while mounted. Re-runs on project change.
  React.useEffect(() => {
    if (!projectId) {
      setState({ items: [], unread: 0 });
      return;
    }
    let alive = true;
    void (async () => {
      const res = await unreadCountTw(projectId);
      if (alive && res.ok) setState((s) => ({ ...s, unread: res.data.unread }));
    })();
    const id = window.setInterval(() => {
      void refreshCount();
    }, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [projectId, refreshCount]);

  /** Open → fetch the latest feed. */
  const handleOpen = React.useCallback(() => {
    void refreshFeed();
  }, [refreshFeed]);

  /** Mark all read (optimistic), then reconcile with the server count. */
  const handleMarkAllRead = React.useCallback(() => {
    if (!projectId) return;
    setState((s) => ({
      items: s.items.map((x) => ({ ...x, read: true })),
      unread: 0,
    }));
    void (async () => {
      await markAllReadTw(projectId);
      await refreshCount();
    })();
  }, [projectId, refreshCount]);

  /** Row click → mark read (optimistic) + deep-link to its href. */
  const handleItemClick = React.useCallback(
    (item: Notification) => {
      const full = itemsRef.current.find((x) => x.id === item.id);
      const wasUnread = full ? !full.read : !item.read;
      setState((s) => ({
        items: s.items.map((x) => (x.id === item.id ? { ...x, read: true } : x)),
        unread: wasUnread ? Math.max(0, s.unread - 1) : s.unread,
      }));
      if (projectId && wasUnread) {
        void markReadTw(item.id, true, projectId);
      }
      const href = full?.href;
      if (href) router.push(href);
    },
    [projectId, router],
  );

  return (
    <NotificationPopover
      notifications={state.items.map(toFeedItem)}
      unreadCount={state.unread}
      onOpen={handleOpen}
      onItemClick={handleItemClick}
      onMarkAllRead={handleMarkAllRead}
      emptyText="You are all caught up."
    />
  );
}

export default NotificationBell;
