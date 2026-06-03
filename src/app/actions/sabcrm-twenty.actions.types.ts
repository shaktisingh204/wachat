/**
 * SabCRM (Twenty UI slice) — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the Twenty actions surface to their (client) callers lives in
 * this plain sibling module. Importing it has no runtime cost.
 *
 * These wrap the Rust engine wire shapes (`@/lib/rust-client/sabcrm-records`)
 * and the metadata layer (`@/lib/sabcrm/types`) into the small, serialisable
 * payloads the Twenty index/detail pages consume.
 */

import type { ObjectMetadata } from '@/lib/sabcrm/types';
import type { SabcrmRustRecord } from '@/lib/rust-client/sabcrm-records';

export type { ObjectMetadata } from '@/lib/sabcrm/types';
export type { SabcrmRustRecord } from '@/lib/rust-client/sabcrm-records';

/** Options accepted by {@link listSabcrmRecordsTw}. */
export interface ListSabcrmRecordsTwParams {
  /** Free-text query (regex over common data.* fields, server-side). */
  q?: string;
  /** Field key to sort by; absent → engine default (`updatedAt`). */
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/** Result of a record list call. */
export interface SabcrmRecordsTwPage {
  records: SabcrmRustRecord[];
  total: number;
}

/** One kanban bucket returned by {@link groupSabcrmRecordsTw}. */
export interface SabcrmRecordTwGroup {
  /** The raw group value (SELECT option value), or `null` for ungrouped. */
  value: string | null;
  records: SabcrmRustRecord[];
}

/** Result of a board-grouping call. */
export interface SabcrmRecordTwGroups {
  groups: SabcrmRecordTwGroup[];
}

/** Re-export so a single import covers the metadata + record contract. */
export type ObjectMetadataTw = ObjectMetadata;
