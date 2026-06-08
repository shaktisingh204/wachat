'use client';

/**
 * 20ui — NotificationPopover.
 *
 * A header bell that opens a popover feed. The bell is an icon-only pressable
 * with an unread-count badge layered on top; clicking it opens a 20ui Popover
 * containing a scrollable list of items (an unread dot, a title, an optional
 * body line, and a relative timestamp), a "Mark all read" action, and an empty
 * state when there is nothing to show.
 *
 * This component is presentational: it renders whatever `notifications` you give
 * it and surfaces intent through callbacks (`onItemClick`, `onMarkAllRead`,
 * `onOpen`). It does not fetch, poll, or own the read state — the parent decides
 * what to show, mirroring the rest of 20ui. No branded channel icons; the only
 * glyph is a neutral bell.
 *
 *   // notifications: [{ id: 'n1', title: 'Priya commented on Acme deal',
 *   //                   body: 'Looks good, ship it.', time: Date.now() - 6e4 }]
 *   <NotificationPopover
 *     notifications={items}
 *     onItemClick={(n) => router.push(`/inbox/${n.id}`)}
 *     onMarkAllRead={() => markAllRead()}
 *   />
 */

import * as React from 'react';
import { Bell, BellOff, Check } from 'lucide-react';

import { Popover, PopoverTrigger, PopoverContent } from './popover';
import { Button } from './button';
import { renderIcon, type IconProp } from './_icon';

import './notificationpopover.css';

/** A single feed entry. `time` may be a Date, epoch ms, or an ISO string. */
export interface Notification {
  /** Stable identity (used as the React key). */
  id: string;
  /** One-line headline. e.g. "Priya assigned you the Acme renewal" */
  title: string;
  /** Optional supporting line under the title. */
  body?: string;
  /** Whether the item has been read. Unread items show a dot + tint. */
  read?: boolean;
  /** When it happened — Date, epoch ms, or ISO string. Renders relative. */
  time?: Date | number | string;
  /** Optional leading glyph (a lucide node). Decorative; never branded. */
  icon?: IconProp;
}

export interface NotificationPopoverProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'onClick' | 'type' | 'children'
  > {
  /** The feed, newest first. */
  notifications: Notification[];
  /**
   * Unread count for the badge. Defaults to the number of items where
   * `read` is not true, so the badge stays correct without extra wiring.
   */
  unreadCount?: number;
  /** Fired when the popover opens (e.g. to mark the feed seen / refetch). */
  onOpen?: () => void;
  /** Fired when a row is activated (click or Enter/Space). */
  onItemClick?: (notification: Notification) => void;
  /** Fired by the "Mark all read" action. Hidden when there is nothing unread. */
  onMarkAllRead?: () => void;
  /** Copy shown when the feed is empty. */
  emptyText?: string;
  /** Where the panel anchors against the bell. Defaults to "end". */
  align?: 'start' | 'center' | 'end';
  /** Pixel gap between bell and panel. Defaults to 6. */
  sideOffset?: number;
  /** Override class on the trigger button. */
  triggerClassName?: string;
}

/** Cap the badge so a noisy inbox does not blow out the layout. */
const BADGE_CAP = 99;

/** Compact relative time. e.g. "now", "4m", "3h", "2d", else a short date. */
function formatRelative(time: Notification['time'], now: number): string {
  if (time == null) return '';
  const ts =
    time instanceof Date
      ? time.getTime()
      : typeof time === 'number'
        ? time
        : Date.parse(time);
  if (Number.isNaN(ts)) return '';

  const diff = now - ts;
  // Guard against clock skew / future-dated items.
  if (diff < 0) return 'now';

  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w`;

  // Older than a month: a short, locale-aware date, no year for this year.
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Build a full, machine-readable timestamp for the row's <time> element. */
function isoFor(time: Notification['time']): string | undefined {
  if (time == null) return undefined;
  const ts =
    time instanceof Date
      ? time.getTime()
      : typeof time === 'number'
        ? time
        : Date.parse(time);
  if (Number.isNaN(ts)) return undefined;
  return new Date(ts).toISOString();
}

export const NotificationPopover = React.forwardRef<
  HTMLButtonElement,
  NotificationPopoverProps
>(function NotificationPopover(
  {
    notifications = [],
    unreadCount,
    onOpen,
    onItemClick,
    onMarkAllRead,
    emptyText = 'You are all caught up.',
    align = 'end',
    sideOffset = 6,
    triggerClassName,
    className,
    ...rest
  },
  ref,
) {
  const [open, setOpen] = React.useState(false);

  // Derive the unread total when the caller does not pass one explicitly.
  const derivedUnread = React.useMemo(
    () => notifications.reduce((n, item) => n + (item.read ? 0 : 1), 0),
    [notifications],
  );
  const unread = unreadCount ?? derivedUnread;

  // A single "now" per render keeps every relative label consistent, and a
  // gentle tick refreshes them (and only them) while the panel is open.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [open]);

  // Fire onOpen exactly on the closed→open transition, not on every change.
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) onOpen?.();
    },
    [onOpen],
  );

  const triggerCls = ['u-notif__trigger', triggerClassName]
    .filter(Boolean)
    .join(' ');

  const hasItems = notifications.length > 0;
  const badge = unread > BADGE_CAP ? `${BADGE_CAP}+` : String(unread);
  const triggerLabel =
    unread > 0
      ? `Notifications, ${unread} unread`
      : 'Notifications, none unread';

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={ref}
          type="button"
          className={triggerCls}
          aria-label={triggerLabel}
          {...rest}
        >
          <Bell size={16} aria-hidden="true" />
          {unread > 0 ? (
            <span className="u-notif__count" aria-hidden="true">
              {badge}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        sideOffset={sideOffset}
        className={['u-notif', className].filter(Boolean).join(' ')}
        aria-label="Notifications"
      >
        <header className="u-notif__head">
          <div className="u-notif__heading">
            <span className="u-notif__title">Notifications</span>
            <span className="u-notif__sub">
              {unread > 0 ? `${unread} unread` : 'All read'}
            </span>
          </div>
          {unread > 0 && onMarkAllRead ? (
            <Button
              variant="ghost"
              size="sm"
              iconLeft={Check}
              onClick={onMarkAllRead}
              className="u-notif__markall"
            >
              Mark all read
            </Button>
          ) : null}
        </header>

        {hasItems ? (
          <ul className="u-notif__list" role="list">
            {notifications.map((item) => {
              const rel = formatRelative(item.time, now);
              const iso = isoFor(item.time);
              return (
                <li key={item.id} className="u-notif__row" role="listitem">
                  <button
                    type="button"
                    className={[
                      'u-notif__item',
                      !item.read && 'is-unread',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => onItemClick?.(item)}
                    aria-label={
                      item.read ? item.title : `Unread: ${item.title}`
                    }
                  >
                    <span className="u-notif__lead" aria-hidden="true">
                      {item.icon ? (
                        <span className="u-notif__icon">
                          {renderIcon(item.icon, { size: 16 })}
                        </span>
                      ) : (
                        <span
                          className={[
                            'u-notif__dot',
                            item.read && 'is-read',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        />
                      )}
                    </span>
                    <span className="u-notif__content">
                      <span className="u-notif__row-top">
                        <span className="u-notif__item-title">
                          {item.title}
                        </span>
                        {rel ? (
                          <time
                            className="u-notif__time"
                            dateTime={iso}
                            title={iso}
                          >
                            {rel}
                          </time>
                        ) : null}
                      </span>
                      {item.body ? (
                        <span className="u-notif__body">{item.body}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="u-notif__empty" role="status">
            <span className="u-notif__empty-icon" aria-hidden="true">
              <BellOff size={20} />
            </span>
            <p className="u-notif__empty-text">{emptyText}</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
});

export default NotificationPopover;
