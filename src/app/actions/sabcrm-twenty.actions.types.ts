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
import type {
  SabcrmRustRecord,
  SabcrmRecordFilters,
  SabcrmAggregateMetric,
  SabcrmRecordAggregateGroup,
} from '@/lib/rust-client/sabcrm-records';
import type {
  SabcrmRustActivity,
  SabcrmAttachment,
} from '@/lib/rust-client/sabcrm-activities';
import type { SabcrmRustFavorite } from '@/lib/rust-client/sabcrm-favorites';

export type { ObjectMetadata } from '@/lib/sabcrm/types';
export type {
  SabcrmRustRecord,
  RecordRelation,
  SabcrmRecordFilters,
  SabcrmFilterGroup,
  SabcrmFilterCondition,
  SabcrmAggregateMetric,
  SabcrmRecordAggregateGroup,
  SabcrmRecordAggregateResponse,
  SabcrmRecordDuplicateGroup,
  SabcrmRecordDuplicatesResponse,
} from '@/lib/rust-client/sabcrm-records';
export type {
  SabcrmRustActivity,
  SabcrmAttachment,
  SabcrmComment,
} from '@/lib/rust-client/sabcrm-activities';
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
  /**
   * Structured field filters — either a flat field→condition map (each value a
   * bare scalar for equality, or `{ op, value }` with `op` in
   * `eq`|`ne`|`contains`|`gt`|`lt`|`gte`|`lte`|`in`|`isEmpty`|`isNotEmpty`) OR
   * a nested AND/OR group `{ op, conditions }` ({@link SabcrmRecordFilters}).
   * Threaded to the engine's `filters` query param.
   */
  filters?: SabcrmRecordFilters;
}

/** Result of a record list call. */
export interface SabcrmRecordsTwPage {
  records: SabcrmRustRecord[];
  total: number;
}

/**
 * Lightweight `{ id, label }` option for record relation pickers, returned by
 * {@link searchSabcrmRecordOptionsTw}. Labels are computed server-side via
 * {@link sabcrmRecordLabel} so the client never sees a raw record id.
 */
export interface SabcrmRecordOption {
  id: string;
  label: string;
}

/** Options accepted by {@link countSabcrmRecordsTw} (scope + filter only). */
export interface CountSabcrmRecordsTwParams {
  /** Free-text query (regex over common data.* fields, server-side). */
  q?: string;
  /**
   * Structured field filters — same shape as
   * {@link ListSabcrmRecordsTwParams.filters} (flat map OR nested AND/OR
   * group). Threaded to the engine's `filters` query param so the count
   * respects the active filter set.
   */
  filters?: SabcrmRecordFilters;
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

/** Options accepted by {@link aggregateSabcrmRecordsTw}. */
export interface AggregateSabcrmRecordsTwParams {
  /** Field key bucketed on `data.<groupByField>`. */
  groupByField: string;
  /** Reduction per bucket. `sum`/`avg`/`min`/`max` require `metricField`. */
  metric: SabcrmAggregateMetric;
  /** Field key the metric reduces over (`data.<metricField>`). */
  metricField?: string;
  /**
   * Structured field filters — same shape as
   * {@link ListSabcrmRecordsTwParams.filters} (flat map OR nested AND/OR
   * group), ANDed into the `{ projectId, object }` scope server-side.
   */
  filters?: SabcrmRecordFilters;
}

/** Result of an aggregate call. */
export interface SabcrmRecordTwAggregate {
  groups: SabcrmRecordAggregateGroup[];
  /** The same metric reduced over ALL matched records. */
  total: number;
}

/** Re-export so a single import covers the metadata + record contract. */
export type ObjectMetadataTw = ObjectMetadata;

// ---------------------------------------------------------------------------
// Activities (timeline)
// ---------------------------------------------------------------------------

/**
 * Known activity kinds the Twenty composer offers, plus `WHATSAPP` — the
 * touchpoint kind the SabCRM ↔ WaChat bridge (`sabcrm-comms.actions.ts`)
 * logs for outbound WhatsApp messages.
 */
export type SabcrmActivityKind =
  | 'NOTE'
  | 'TASK'
  | 'CALL'
  | 'MEETING'
  | 'EMAIL'
  | 'WHATSAPP';

/** Options accepted by {@link listSabcrmActivitiesTw}. */
export interface ListSabcrmActivitiesTwParams {
  /** Optional `type` filter (NOTE | TASK | CALL | MEETING | EMAIL | COMMENT | WHATSAPP). */
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
  /** SabFiles attachment refs (optional; never raw external URLs). */
  attachments?: SabcrmAttachment[];
}

/** Partial patch accepted by {@link updateSabcrmActivityTw}. */
export interface UpdateSabcrmActivityTwPatch {
  type?: string;
  title?: string;
  body?: string;
  status?: string;
  assigneeId?: string;
  dueAt?: string;
  /** Replacement SabFiles attachment list (optional). */
  attachments?: SabcrmAttachment[];
}
