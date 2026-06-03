/**
 * SabCRM Global Search — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so the (non-async)
 * types the search action surfaces to its callers live in this plain sibling
 * module. Importing it has no runtime cost.
 *
 * Re-exports the Rust search client wire shape
 * (`@/lib/rust-client/sabcrm-records`) consumed by the command-menu / global
 * search UI.
 */

import type { SabcrmSearchHit } from '@/lib/rust-client/sabcrm-records';

export type { SabcrmSearchHit } from '@/lib/rust-client/sabcrm-records';

/** A single cross-object global-search result returned by {@link globalSearchTw}. */
export type GlobalSearchHit = SabcrmSearchHit;
