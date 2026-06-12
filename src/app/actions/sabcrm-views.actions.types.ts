/**
 * SabCRM Views — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the views actions surface to their (client) callers lives in
 * this plain sibling module. Importing it has no runtime cost.
 *
 * These wrap the Rust views client wire shapes
 * (`@/lib/rust-client/sabcrm-views`) into the small, serialisable payloads the
 * Twenty index pages' view switcher consumes.
 */

import type {
  SabcrmRustView,
  SabcrmViewCreateInput,
  SabcrmViewUpdateInput,
} from '@/lib/rust-client/sabcrm-views';
import type { SabcrmRustRecord } from '@/lib/rust-client/sabcrm-records';

export type {
  SabcrmRustView,
  SabcrmViewCreateInput,
  SabcrmViewUpdateInput,
  SabcrmViewRunOpts,
  SabcrmQueueState,
  SabcrmQueueMarkAction,
} from '@/lib/rust-client/sabcrm-views';
export type { SabcrmRustRecord } from '@/lib/rust-client/sabcrm-records';

/** Input accepted by {@link createViewTw} — the flattened view document. */
export type CreateViewTwInput = SabcrmViewCreateInput;

/**
 * Partial patch accepted by {@link updateViewTw}. Includes the additive
 * work-queue config key (`queue`) — the Rust handlers `$set` flattened body
 * keys verbatim, so the config persists on the view document and round-trips
 * (the `columnWidths` precedent).
 */
export type UpdateViewTwPatch = SabcrmViewUpdateInput & {
  queue?: Record<string, unknown>;
};

/** Result of a {@link runViewTw} call — a page of records. */
export interface SabcrmViewRunPage {
  records: SabcrmRustRecord[];
  total: number;
}
