/**
 * SabCRM Tags — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the tags actions surface to their (client) callers lives in
 * this plain sibling module. Importing it has no runtime cost.
 *
 * These re-export the Rust tags client wire shapes
 * (`@/lib/rust-client/sabcrm-tags`) the SabCRM UI consumes.
 */

import type {
  SabcrmTagCreateInput,
  SabcrmTagUpdateInput,
} from '@/lib/rust-client/sabcrm-tags';

export type {
  SabcrmRustTag,
  SabcrmTagCreateInput,
  SabcrmTagUpdateInput,
} from '@/lib/rust-client/sabcrm-tags';

/** Input accepted by {@link createTagTw}. */
export type CreateTagTwInput = SabcrmTagCreateInput;

/** Partial patch accepted by {@link updateTagTw}. */
export type UpdateTagTwPatch = SabcrmTagUpdateInput;
