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
import type { SabcrmRustActivity } from '@/lib/rust-client/sabcrm-activities';
import type { SabcrmRustFavorite } from '@/lib/rust-client/sabcrm-favorites';

export type { ObjectMetadata } from '@/lib/sabcrm/types';
export type { SabcrmRustRecord } from '@/lib/rust-client/sabcrm-records';
export type { SabcrmRustActivity } from '@/lib/rust-client/sabcrm-activities';
export type { SabcrmRustFavorite } from '@/lib/rust-client/sabcrm-favorites';

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

// ---------------------------------------------------------------------------
// Activities (timeline)
// ---------------------------------------------------------------------------

/** Known activity kinds the Twenty composer offers. */
export type SabcrmActivityKind = 'NOTE' | 'TASK' | 'CALL' | 'MEETING' | 'EMAIL';

/** Options accepted by {@link listSabcrmActivitiesTw}. */
export interface ListSabcrmActivitiesTwParams {
  /** Optional `type` filter (NOTE | TASK | CALL | MEETING | EMAIL | COMMENT). */
  type?: string;
  /** Page size. Clamped at 200 server-side; defaults to 50. */
  limit?: number;
}

/** Input accepted by {@link createSabcrmActivityTw} (authorId is server-set). */
export interface CreateSabcrmActivityTwInput {
  /** Object slug of the record this entry attaches to. */
  targetObject: string;
  /** Serialized id of the record this entry attaches to. */
  targetRecordId: string;
  /** Entry kind (NOTE | TASK | CALL | MEETING | EMAIL | COMMENT). */
  type: string;
  title: string;
  body?: string;
  status?: string;
  assigneeId?: string;
  dueAt?: string;
}

/** Partial patch accepted by {@link updateSabcrmActivityTw}. */
export interface UpdateSabcrmActivityTwPatch {
  type?: string;
  title?: string;
  body?: string;
  status?: string;
  assigneeId?: string;
  dueAt?: string;
}
