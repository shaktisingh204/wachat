/**
 * SabCRM — server-action types.
 *
 * A 'use server' module may export ONLY async functions. Every `export type` /
 * `export interface` / type re-export in `sabcrm.actions.ts` would otherwise be
 * treated by the RSC layer as an action reference and break the production
 * build. This plain (non-"use server") module is therefore the single home for
 * all the types the actions layer surfaces to its callers.
 *
 * It is a pure type module: importing it has no runtime cost.
 */

import type {
  CrmRecordWithLabel,
  RecordQuery,
  RecordPage,
  FieldRelation,
} from '@/lib/sabcrm/types';
import type {
  TimelineActivityType,
  TaskStatus,
  ActivityAttachment,
  ActivityMention,
} from '@/lib/sabcrm/activities.server';
import type {
  RawRow,
  ColumnMapping,
} from '@/lib/sabcrm/import-export.server';
import type {
  CountByFieldResult,
  SumByFieldResult,
  TimeSeriesResult,
  RecordTotalsResult,
  TimeInterval,
} from '@/lib/sabcrm/analytics.server';
import type { CreateReportInput } from '@/lib/sabcrm/reports.server';
import type {
  FeedFilter,
  FeedPageOptions,
  FeedPage,
  FeedCursorOptions,
  FeedCursorPage,
  FeedDigest,
} from '@/lib/sabcrm/feed.server';

// ---------------------------------------------------------------------------
// Type re-exports
//
// These shapes live in the server-only library layer. Re-exporting them here
// lets client-component consumers type their state against the same interfaces
// without importing from a server-only `*.server` module.
// ---------------------------------------------------------------------------

export type { SavedView, SaveViewInput } from '@/lib/sabcrm/views.server';
export type { MappingValidationIssue } from '@/lib/sabcrm/import-export.server';
export type {
  SavedReport,
  CreateReportInput,
  UpdateReportPatch,
  ReportDataSeries,
  ReportMetric,
  ReportChartType,
  ReportTimeBucket,
  ReportDataPoint,
} from '@/lib/sabcrm/reports.server';
export type {
  CrmDashboardKpis,
  ObjectRecordCount,
  OpportunityKpi,
  TaskKpi,
  NewThisWeekKpi,
} from '@/lib/sabcrm/kpis.server';
export type {
  CountByFieldResult,
  SumByFieldResult,
  TimeSeriesResult,
  RecordTotalsResult,
  TimeInterval,
} from '@/lib/sabcrm/analytics.server';
export type {
  FeedFilter,
  FeedPageOptions,
  FeedPage,
  FeedCursorOptions,
  FeedCursorPage,
  FeedDigest,
  FeedActivityType,
  FeedCursor,
} from '@/lib/sabcrm/feed.server';
export type {
  WebhookSubscription,
  CreateWebhookInput,
  UpdateWebhookPatch,
} from '@/lib/sabcrm/webhooks.server';
export type {
  SabcrmApiKey,
  IssuedSabcrmApiKey,
} from '@/lib/sabcrm/apikeys.server';
export type {
  AutomationRule,
  CreateAutomationRuleInput,
  UpdateAutomationRulePatch,
  AutomationRuleStatus,
  AutomationEvent,
  AutomationCondition,
  AutomationConditionOp,
  AutomationAction,
  AutomationActionCreateTask,
  AutomationActionSendNotification,
  AutomationActionCallWebhook,
} from '@/lib/sabcrm/automation.server';

// ---------------------------------------------------------------------------
// Extended query types (additive — actions-layer only)
//
// These wire shapes describe the table/board/relation-picker surfaces. They do
// not change `types.ts`; `SabcrmRecordQuery` is a superset of `RecordQuery` and
// `SabcrmRecordPage` extends `RecordPage`, so existing callers stay compatible.
// ---------------------------------------------------------------------------

/**
 * Per-field filter value: either an exact match (legacy behaviour) or an
 * operator object that maps 1:1 to Mongo query operators.
 */
export type SabcrmFilterValue =
  | string
  | number
  | boolean
  | null
  | {
      $eq?: unknown;
      $ne?: unknown;
      $gt?: unknown;
      $gte?: unknown;
      $lt?: unknown;
      $lte?: unknown;
      $in?: unknown[];
      $nin?: unknown[];
      $regex?: string;
      $options?: string;
      $exists?: boolean;
    };

/** One clause of a multi-field sort. */
export interface SabcrmSortClause {
  field: string;
  dir: 'asc' | 'desc';
}

/** Superset of {@link RecordQuery}: typed operators, multi-sort, expansion. */
export interface SabcrmRecordQuery extends Omit<RecordQuery, 'filters'> {
  filters?: Record<string, SabcrmFilterValue>;
  /** Multi-field sort. Takes precedence over legacy `sortBy`/`sortDir`. */
  multiSort?: SabcrmSortClause[];
  /** RELATION field keys to populate alongside the page. */
  expandRelations?: string[];
}

/** A record page that may carry resolved relations. */
export interface SabcrmRecordPage extends RecordPage {
  /** fieldKey -> (relatedRecordId -> related record). Present when expanded. */
  expanded?: Record<string, Record<string, CrmRecordWithLabel>>;
}

/** A board column: one bucket per SELECT option value (plus "Ungrouped"). */
export interface SabcrmRecordGroup {
  key: string;
  label: string;
  color?: string;
  records: CrmRecordWithLabel[];
  total: number;
}

export interface SabcrmGroupedRecordPage {
  groupByField: string;
  groups: SabcrmRecordGroup[];
  total: number;
}

/** A lightweight option used to populate a relation picker. */
export interface SabcrmPickerOption {
  id: string;
  label: string;
  object: string;
}

// ---------------------------------------------------------------------------
// Activity / task action inputs
// ---------------------------------------------------------------------------

/** Input accepted by `createActivityAction`. */
export interface CreateActivityActionInput {
  type: TimelineActivityType;
  title: string;
  body?: string;
  targetObject: string;
  targetRecordId: string;
  attachments?: ActivityAttachment[];
  mentions?: ActivityMention[];
  /** TASK-only. Defaults to "TODO". */
  status?: TaskStatus;
  /** TASK-only assignee user id. */
  assigneeId?: string;
  /** TASK-only due date (ISO string or timestamp). */
  dueAt?: string | number | Date;
}

/** Input accepted by `updateActivityAction`. */
export interface UpdateActivityActionInput {
  title?: string;
  body?: string;
  type?: TimelineActivityType;
  attachments?: ActivityAttachment[];
  mentions?: ActivityMention[];
  status?: TaskStatus;
  assigneeId?: string | null;
  dueAt?: string | number | Date | null;
}

// ---------------------------------------------------------------------------
// Relation definition input
// ---------------------------------------------------------------------------

/** Input shape for `createRelationAction`. */
export interface CreateRelationActionInput {
  /** Slug of the object that owns the forward relation field. */
  fromSlug: string;
  /** Field key for the new relation field on `fromSlug`. */
  fieldKey: string;
  /** Relation descriptor (targetObject + kind, optionally labelField). */
  relation: FieldRelation;
  /** Optional forward field label. Defaults to the target object's singular label. */
  forwardLabel?: string;
  /** Set `false` to skip creating the reciprocal field on the target object. */
  inverse?: boolean;
  /** Override the auto-generated inverse field key. */
  inverseFieldKey?: string;
  /** Override the auto-generated inverse field label. */
  inverseLabel?: string;
}

// ---------------------------------------------------------------------------
// Import / export inputs
// ---------------------------------------------------------------------------

/** Input accepted by `importRecordsAction`. */
export interface ImportRecordsActionInput {
  /** Object slug to import into (e.g. `"companies"`). */
  object: string;
  /**
   * Column→field mapping: field key → CSV column header. Fields absent from
   * the mapping fall back to their `defaultValue`. RELATION and FILE field
   * keys are silently skipped.
   */
  columnMapping: ColumnMapping;
  /**
   * Raw rows from a parsed CSV/XLSX: column header → raw string value.
   * Must not exceed 5,000 rows per call; chunk larger files.
   */
  rows: RawRow[];
  /**
   * When `true`, aborts on the first validation or insert error.
   * Default: `false` — per-row failures are collected and reported back.
   */
  stopOnFirstError?: boolean;
}

/** Options accepted by `exportRecordsAction`. */
export interface ExportRecordsActionInput {
  /** Object slug to export (e.g. `"opportunities"`). */
  object: string;
  /**
   * Ordered list of field keys to include. Defaults to every non-RELATION,
   * non-FILE field declared on the object.
   */
  fields?: string[];
  /**
   * Maximum rows to export. Capped at 10,000; defaults to 1,000.
   */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Analytics spec / result
// ---------------------------------------------------------------------------

/** Discriminated union describing which aggregation to run and with what args. */
export type AnalyticsSpec =
  | {
      kind: 'countByField';
      object: string;
      fieldKey: string;
    }
  | {
      kind: 'sumByField';
      object: string;
      groupFieldKey: string;
      sumFieldKey: string;
    }
  | {
      kind: 'timeSeries';
      object: string;
      dateField: string;
      interval?: TimeInterval;
    }
  | {
      kind: 'recordTotals';
    };

/** Union of all possible result shapes that `runAnalyticsAction` may return. */
export type AnalyticsResult =
  | CountByFieldResult
  | SumByFieldResult
  | TimeSeriesResult
  | RecordTotalsResult;

// ---------------------------------------------------------------------------
// Saved report save input
// ---------------------------------------------------------------------------

/** Input for `saveReportAction`: a report definition with an optional id. */
export interface SaveReportActionInput extends CreateReportInput {
  /**
   * When supplied, the existing report with this id is patched rather than
   * creating a new document. Must be a valid hex ObjectId of a report that
   * belongs to the active project.
   */
  id?: string;
}

// ---------------------------------------------------------------------------
// Activity feed spec / result
// ---------------------------------------------------------------------------

/** Discriminated union describing which feed query mode to use. */
export type ActivityFeedSpec =
  | {
      /** Offset-based pagination (default). Returns total count. */
      mode: 'page';
      filter?: FeedFilter;
      options?: FeedPageOptions;
    }
  | {
      /** Cursor-based streaming for infinite-scroll UIs. No count query. */
      mode: 'cursor';
      filter?: FeedFilter;
      options?: FeedCursorOptions;
    }
  | {
      /** Aggregated digest statistics over a time window. */
      mode: 'digest';
      since?: string | Date;
      until?: string | Date;
      filter?: Omit<FeedFilter, 'since' | 'until'>;
    };

/** Union of all possible results from `getActivityFeedAction`. */
export type ActivityFeedResult = FeedPage | FeedCursorPage | FeedDigest;
