/**
 * SabCRM notification-inbox — server-action types.
 *
 * A `'use server'` module may export ONLY async functions, so every non-async
 * type/interface the inbox actions surface to their (client) callers lives in
 * this plain sibling module. Importing it has no runtime cost.
 */

import type { SabcrmInboxNotification } from '@/lib/sabcrm/notifications.server';

/** Re-export the serialisable notification shape for client callers. */
export type { SabcrmInboxNotification };

/** Options the notification bell may pass to `listNotificationsTw`. */
export interface ListNotificationsTwOpts {
  /** When true, only unread rows are returned. */
  unreadOnly?: boolean;
  /** Page size (1..=100). Defaults to 30. */
  limit?: number;
  /** Zero-based offset into the result set. Defaults to 0. */
  skip?: number;
}
