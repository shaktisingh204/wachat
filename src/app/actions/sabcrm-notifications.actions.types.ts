/**
 * SabCRM Notifications — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the notifications actions surface to their (client) callers
 * lives in this plain sibling module. Importing it has no runtime cost.
 *
 * These re-export the Rust notifications client wire shapes
 * (`@/lib/rust-client/sabcrm-notifications`) for the SabCRM notification
 * bell / inbox UI.
 */

export type {
  SabcrmRustNotification,
  SabcrmNotificationKind,
  SabcrmNotificationCreateInput,
  SabcrmNotificationListOpts,
  SabcrmNotificationActor,
  SabcrmNotificationListResult,
  SabcrmNotificationStreamEvent,
} from '@/lib/rust-client/sabcrm-notifications';
