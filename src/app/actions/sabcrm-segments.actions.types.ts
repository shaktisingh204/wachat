/**
 * SabCRM Segments — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the segments actions surface to their (client) callers lives
 * in this plain sibling module. Importing it has no runtime cost.
 *
 * These wrap the Rust segments client wire shapes
 * (`@/lib/rust-client/sabcrm-segments`) into the small, serialisable payloads
 * the Twenty index pages' smart-list switcher consumes.
 */

import type {
  SabcrmRustSegment,
  SabcrmSegmentCreateInput,
  SabcrmSegmentUpdateInput,
} from '@/lib/rust-client/sabcrm-segments';

export type {
  SabcrmRustSegment,
  SabcrmSegmentCreateInput,
  SabcrmSegmentUpdateInput,
} from '@/lib/rust-client/sabcrm-segments';

/** Input accepted by {@link createSegmentTw} — the flattened segment document. */
export type CreateSegmentTwInput = SabcrmSegmentCreateInput;

/** Partial patch accepted by {@link updateSegmentTw}. */
export type UpdateSegmentTwPatch = SabcrmSegmentUpdateInput;

/** Re-export for convenience at the action callsite. */
export type SegmentTw = SabcrmRustSegment;
